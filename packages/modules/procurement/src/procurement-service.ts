import {
  assertDate,
  assertIdentifier,
  authorizeOperations,
  createOperationsAudit,
  createOperationsEvent,
  type OperationsAuditWriter,
  type OperationsEventPublisher,
  type OperationsPrincipal,
  type OperationsScope,
} from '../../hr/src/index.js';

export type CurrencyCode = string;
export type SupplierStatus = 'active' | 'suspended' | 'inactive';
export type RequisitionStatus =
  'draft' | 'submitted' | 'approved' | 'rejected' | 'ordered' | 'cancelled';
export type PurchaseOrderStatus =
  'issued' | 'partially-received' | 'received' | 'closed' | 'cancelled';
export type SupplierInvoiceStatus =
  'pending-match' | 'matched' | 'approved' | 'exported' | 'rejected';
export type MatchStatus = 'matched' | 'quantity-mismatch' | 'amount-mismatch' | 'currency-mismatch';

export interface Supplier {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly taxReference: string;
  readonly currency: CurrencyCode;
  readonly status: SupplierStatus;
  readonly version: number;
  readonly createdAt: string;
}

export interface BudgetEnvelopeInput {
  readonly id: string;
  readonly fiscalPeriodRef: string;
  readonly costCenterRef: string;
  readonly accountRef: string;
  readonly currency: CurrencyCode;
  readonly amountMinor: number;
}

export interface BudgetEnvelope extends BudgetEnvelopeInput {
  readonly committedMinor: number;
  readonly spentMinor: number;
  readonly availableMinor: number;
  readonly version: number;
  readonly createdAt: string;
}

export interface RequisitionLine {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly estimatedUnitMinor: number;
  readonly accountRef: string;
  readonly estimatedTotalMinor: number;
}

export interface RequisitionInput {
  readonly id: string;
  readonly budgetEnvelopeId: string;
  readonly requestedByStaffRef: string;
  readonly neededBy: string;
  readonly purpose: string;
  readonly lines: readonly Omit<RequisitionLine, 'estimatedTotalMinor'>[];
}

export interface Requisition extends Omit<RequisitionInput, 'lines'> {
  readonly lines: readonly RequisitionLine[];
  readonly totalMinor: number;
  readonly currency: CurrencyCode;
  readonly status: RequisitionStatus;
  readonly createdBy: string;
  readonly approvedBy: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PurchaseOrderInput {
  readonly id: string;
  readonly requisitionId: string;
  readonly supplierId: string;
  readonly orderNumber: string;
  readonly orderedOn: string;
  readonly expectedOn: string;
}

export interface PurchaseOrder extends PurchaseOrderInput {
  readonly budgetEnvelopeId: string;
  readonly currency: CurrencyCode;
  readonly totalMinor: number;
  readonly status: PurchaseOrderStatus;
  readonly issuedBy: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface GoodsReceiptInput {
  readonly id: string;
  readonly purchaseOrderId: string;
  readonly receivedOn: string;
  readonly receivedByStaffRef: string;
  readonly lines: readonly {
    readonly requisitionLineId: string;
    readonly quantityReceived: number;
  }[];
}

export interface GoodsReceipt extends GoodsReceiptInput {
  readonly recordedBy: string;
  readonly version: number;
  readonly createdAt: string;
}

export interface SupplierInvoiceInput {
  readonly id: string;
  readonly supplierId: string;
  readonly purchaseOrderId: string;
  readonly supplierInvoiceNumber: string;
  readonly invoiceDate: string;
  readonly dueDate: string;
  readonly currency: CurrencyCode;
  readonly amountMinor: number;
  readonly taxMinor: number;
  readonly idempotencyKey: string;
}

export interface SupplierInvoice extends SupplierInvoiceInput {
  readonly matchStatus: MatchStatus;
  readonly status: SupplierInvoiceStatus;
  readonly createdBy: string;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly financeDocumentRef: string | null;
  readonly version: number;
  readonly createdAt: string;
}

export interface FinancePayableSourceDocument {
  readonly contractVersion: '1.0';
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly campusId: string;
  readonly sourceDocumentType: 'supplier-invoice';
  readonly sourceDocumentId: string;
  readonly sourceDocumentNumber: string;
  readonly supplierRef: string;
  readonly purchaseOrderRef: string;
  readonly budgetEnvelopeRef: string;
  readonly fiscalPeriodRef: string;
  readonly costCenterRef: string;
  readonly accountRef: string;
  readonly invoiceDate: string;
  readonly dueDate: string;
  readonly amountMinor: number;
  readonly taxMinor: number;
  readonly currency: CurrencyCode;
  readonly status: 'approved';
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}

export interface FinancePayableGateway {
  submitPayableSourceDocument(document: FinancePayableSourceDocument): string;
}

export class InMemoryFinancePayableGateway implements FinancePayableGateway {
  readonly #documents: FinancePayableSourceDocument[] = [];
  readonly #references = new Map<string, string>();

  get documents(): readonly FinancePayableSourceDocument[] {
    return Object.freeze([...this.#documents]);
  }

  submitPayableSourceDocument(document: FinancePayableSourceDocument): string {
    const existing = this.#references.get(document.idempotencyKey);
    if (existing) return existing;
    const reference = `fin-payable:${document.sourceDocumentId}`;
    this.#documents.push(Object.freeze({ ...document }));
    this.#references.set(document.idempotencyKey, reference);
    return reference;
  }
}

export interface ProcurementReport {
  readonly budgetTotalMinor: number;
  readonly committedMinor: number;
  readonly spentMinor: number;
  readonly availableMinor: number;
  readonly openRequisitions: number;
  readonly openPurchaseOrders: number;
  readonly unmatchedInvoices: number;
  readonly overdueSupplierInvoices: number;
}

interface Clock {
  now(): Date;
}

const systemClock: Clock = { now: () => new Date() };

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function assertMinor(value: number, field: string, allowZero = false): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`OPS_INVALID_MONEY:${field}`);
  }
}

export class ProcurementService {
  readonly #scope: OperationsScope;
  readonly #events: OperationsEventPublisher;
  readonly #audit: OperationsAuditWriter;
  readonly #finance: FinancePayableGateway;
  readonly #clock: Clock;
  readonly #suppliers = new Map<string, Supplier>();
  readonly #supplierCodes = new Set<string>();
  readonly #budgets = new Map<string, BudgetEnvelope>();
  readonly #requisitions = new Map<string, Requisition>();
  readonly #orders = new Map<string, PurchaseOrder>();
  readonly #orderNumbers = new Set<string>();
  readonly #receipts = new Map<string, GoodsReceipt>();
  readonly #invoices = new Map<string, SupplierInvoice>();
  readonly #invoiceKeys = new Map<string, string>();
  readonly #supplierInvoiceNumbers = new Set<string>();

  constructor(
    scope: OperationsScope,
    events: OperationsEventPublisher,
    audit: OperationsAuditWriter,
    finance: FinancePayableGateway,
    clock: Clock = systemClock,
  ) {
    assertIdentifier(scope.tenantId, 'tenantId');
    assertIdentifier(scope.legalEntityId, 'legalEntityId');
    assertIdentifier(scope.campusId, 'campusId');
    this.#scope = frozen(scope);
    this.#events = events;
    this.#audit = audit;
    this.#finance = finance;
    this.#clock = clock;
  }

  registerSupplier(
    input: Omit<Supplier, 'version' | 'createdAt'>,
    principal: OperationsPrincipal,
    correlationId: string,
  ): Supplier {
    authorizeOperations(principal, 'operations.procurement.supplier.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      code: input.code,
      name: input.name,
      taxReference: input.taxReference,
      currency: input.currency,
    })) {
      assertIdentifier(value, `supplier.${field}`);
    }
    const code = input.code.trim().toUpperCase();
    if (this.#suppliers.has(input.id) || this.#supplierCodes.has(code)) {
      throw new Error('OPS_DUPLICATE_SUPPLIER');
    }
    const supplier: Supplier = frozen({
      ...input,
      code,
      name: input.name.trim(),
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#suppliers.set(supplier.id, supplier);
    this.#supplierCodes.add(supplier.code);
    this.#record(
      'operations.procurement.supplier-registered.v1',
      'supplier',
      supplier.id,
      supplier.version,
      'operations.procurement.supplier.register',
      principal,
      correlationId,
      { code: supplier.code },
    );
    return supplier;
  }

  createBudgetEnvelope(
    input: BudgetEnvelopeInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): BudgetEnvelope {
    authorizeOperations(principal, 'operations.procurement.budget.write', this.#scope, {
      requireAal2: true,
    });
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      fiscalPeriodRef: input.fiscalPeriodRef,
      costCenterRef: input.costCenterRef,
      accountRef: input.accountRef,
      currency: input.currency,
    })) {
      assertIdentifier(value, `budget.${field}`);
    }
    assertMinor(input.amountMinor, 'budget.amountMinor');
    if (this.#budgets.has(input.id)) throw new Error('OPS_DUPLICATE_BUDGET');
    const budget: BudgetEnvelope = frozen({
      ...input,
      committedMinor: 0,
      spentMinor: 0,
      availableMinor: input.amountMinor,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#budgets.set(budget.id, budget);
    this.#record(
      'operations.procurement.budget-created.v1',
      'budget-envelope',
      budget.id,
      budget.version,
      'operations.procurement.budget.create',
      principal,
      correlationId,
      { fiscalPeriodRef: budget.fiscalPeriodRef, amountMinor: budget.amountMinor },
    );
    return budget;
  }

  createRequisition(
    input: RequisitionInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): Requisition {
    authorizeOperations(principal, 'operations.procurement.requisition.write', this.#scope);
    this.#correlation(correlationId);
    const budget = this.#requireBudget(input.budgetEnvelopeId);
    assertIdentifier(input.id, 'requisition.id');
    assertIdentifier(input.requestedByStaffRef, 'requisition.requestedByStaffRef');
    assertDate(input.neededBy, 'requisition.neededBy');
    if (input.purpose.trim().length < 5) throw new Error('OPS_REQUISITION_PURPOSE_REQUIRED');
    if (input.lines.length === 0) throw new Error('OPS_REQUISITION_LINE_REQUIRED');
    if (this.#requisitions.has(input.id)) throw new Error('OPS_DUPLICATE_REQUISITION');
    const lineIds = new Set<string>();
    const lines = input.lines.map((line): RequisitionLine => {
      assertIdentifier(line.id, 'requisition.line.id');
      assertIdentifier(line.description, 'requisition.line.description');
      assertIdentifier(line.accountRef, 'requisition.line.accountRef');
      if (line.accountRef !== budget.accountRef) throw new Error('OPS_BUDGET_ACCOUNT_MISMATCH');
      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
        throw new Error('OPS_INVALID_QUANTITY');
      }
      assertMinor(line.estimatedUnitMinor, 'requisition.line.estimatedUnitMinor');
      if (lineIds.has(line.id)) throw new Error('OPS_DUPLICATE_REQUISITION_LINE');
      lineIds.add(line.id);
      const estimatedTotalMinor = line.quantity * line.estimatedUnitMinor;
      assertMinor(estimatedTotalMinor, 'requisition.line.estimatedTotalMinor');
      return frozen({ ...line, estimatedTotalMinor });
    });
    const totalMinor = lines.reduce((sum, line) => sum + line.estimatedTotalMinor, 0);
    assertMinor(totalMinor, 'requisition.totalMinor');
    const now = this.#clock.now().toISOString();
    const requisition: Requisition = frozen({
      ...input,
      purpose: input.purpose.trim(),
      lines: Object.freeze(lines),
      totalMinor,
      currency: budget.currency,
      status: 'draft',
      createdBy: principal.principalId,
      approvedBy: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    this.#requisitions.set(requisition.id, requisition);
    this.#record(
      'operations.procurement.requisition-created.v1',
      'requisition',
      requisition.id,
      requisition.version,
      'operations.procurement.requisition.create',
      principal,
      correlationId,
      { totalMinor, budgetEnvelopeId: requisition.budgetEnvelopeId },
    );
    return requisition;
  }

  submitRequisition(
    requisitionId: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): Requisition {
    authorizeOperations(principal, 'operations.procurement.requisition.write', this.#scope);
    const requisition = this.#requireRequisition(requisitionId);
    if (requisition.status === 'submitted') return requisition;
    if (requisition.status !== 'draft') throw new Error('OPS_INVALID_REQUISITION_STATE');
    const submitted = this.#transitionRequisition(
      requisition,
      'submitted',
      principal,
      correlationId,
    );
    this.#record(
      'operations.procurement.requisition-submitted.v1',
      'requisition',
      submitted.id,
      submitted.version,
      'operations.procurement.requisition.submit',
      principal,
      correlationId,
      { totalMinor: submitted.totalMinor },
    );
    return submitted;
  }

  approveRequisition(
    requisitionId: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): Requisition {
    const requisition = this.#requireRequisition(requisitionId);
    if (requisition.createdBy === principal.principalId) {
      throw new Error('OPS_SOD_VIOLATION:requisition-request-approve');
    }
    authorizeOperations(principal, 'operations.procurement.requisition.approve', this.#scope, {
      requireAal2: true,
    });
    if (requisition.status === 'approved') return requisition;
    if (requisition.status !== 'submitted') throw new Error('OPS_INVALID_REQUISITION_STATE');
    const approved: Requisition = frozen({
      ...requisition,
      status: 'approved',
      approvedBy: principal.principalId,
      version: requisition.version + 1,
      updatedAt: this.#clock.now().toISOString(),
    });
    this.#requisitions.set(approved.id, approved);
    this.#record(
      'operations.procurement.requisition-approved.v1',
      'requisition',
      approved.id,
      approved.version,
      'operations.procurement.requisition.approve',
      principal,
      correlationId,
      { totalMinor: approved.totalMinor },
    );
    return approved;
  }

  issuePurchaseOrder(
    input: PurchaseOrderInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): PurchaseOrder {
    authorizeOperations(principal, 'operations.procurement.order.write', this.#scope, {
      requireAal2: true,
    });
    this.#correlation(correlationId);
    const requisition = this.#requireRequisition(input.requisitionId);
    if (requisition.status !== 'approved') throw new Error('OPS_REQUISITION_NOT_APPROVED');
    const supplier = this.#requireSupplier(input.supplierId);
    if (supplier.status !== 'active') throw new Error('OPS_SUPPLIER_INACTIVE');
    if (supplier.currency !== requisition.currency) throw new Error('OPS_CURRENCY_MISMATCH');
    assertIdentifier(input.id, 'purchaseOrder.id');
    assertIdentifier(input.orderNumber, 'purchaseOrder.orderNumber');
    assertDate(input.orderedOn, 'purchaseOrder.orderedOn');
    assertDate(input.expectedOn, 'purchaseOrder.expectedOn');
    if (input.expectedOn < input.orderedOn) throw new Error('OPS_INVALID_DATE_RANGE');
    if (this.#orders.has(input.id) || this.#orderNumbers.has(input.orderNumber)) {
      throw new Error('OPS_DUPLICATE_PURCHASE_ORDER');
    }
    const budget = this.#requireBudget(requisition.budgetEnvelopeId);
    if (budget.availableMinor < requisition.totalMinor) throw new Error('OPS_BUDGET_EXCEEDED');
    const order: PurchaseOrder = frozen({
      ...input,
      budgetEnvelopeId: budget.id,
      currency: requisition.currency,
      totalMinor: requisition.totalMinor,
      status: 'issued',
      issuedBy: principal.principalId,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#orders.set(order.id, order);
    this.#orderNumbers.add(order.orderNumber);
    this.#requisitions.set(
      requisition.id,
      frozen({
        ...requisition,
        status: 'ordered',
        version: requisition.version + 1,
        updatedAt: this.#clock.now().toISOString(),
      }),
    );
    this.#budgets.set(
      budget.id,
      frozen({
        ...budget,
        committedMinor: budget.committedMinor + order.totalMinor,
        availableMinor: budget.availableMinor - order.totalMinor,
        version: budget.version + 1,
      }),
    );
    this.#record(
      'operations.procurement.purchase-order-issued.v1',
      'purchase-order',
      order.id,
      order.version,
      'operations.procurement.order.issue',
      principal,
      correlationId,
      { supplierId: order.supplierId, totalMinor: order.totalMinor },
    );
    this.#record(
      'operations.procurement.budget-committed.v1',
      'budget-envelope',
      budget.id,
      budget.version + 1,
      'operations.procurement.budget.commit',
      principal,
      correlationId,
      { purchaseOrderId: order.id, amountMinor: order.totalMinor },
    );
    return order;
  }

  recordGoodsReceipt(
    input: GoodsReceiptInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): GoodsReceipt {
    authorizeOperations(principal, 'operations.procurement.receipt.write', this.#scope);
    this.#correlation(correlationId);
    const order = this.#requireOrder(input.purchaseOrderId);
    if (!['issued', 'partially-received'].includes(order.status)) {
      throw new Error('OPS_PURCHASE_ORDER_NOT_RECEIVABLE');
    }
    const requisition = this.#requireRequisition(order.requisitionId);
    assertIdentifier(input.id, 'receipt.id');
    assertIdentifier(input.receivedByStaffRef, 'receipt.receivedByStaffRef');
    assertDate(input.receivedOn, 'receipt.receivedOn');
    if (input.lines.length === 0) throw new Error('OPS_RECEIPT_LINE_REQUIRED');
    if (this.#receipts.has(input.id)) throw new Error('OPS_DUPLICATE_RECEIPT');
    const receivedBefore = this.#receivedQuantities(order.id);
    for (const line of input.lines) {
      const requested = requisition.lines.find((item) => item.id === line.requisitionLineId);
      if (!requested) throw new Error('OPS_NOT_FOUND:requisition-line');
      if (!Number.isSafeInteger(line.quantityReceived) || line.quantityReceived <= 0) {
        throw new Error('OPS_INVALID_QUANTITY');
      }
      const already = receivedBefore.get(line.requisitionLineId) ?? 0;
      if (already + line.quantityReceived > requested.quantity) {
        throw new Error('OPS_RECEIPT_EXCEEDS_ORDER');
      }
      receivedBefore.set(line.requisitionLineId, already + line.quantityReceived);
    }
    const receipt: GoodsReceipt = frozen({
      ...input,
      lines: Object.freeze(input.lines.map((line) => frozen(line))),
      recordedBy: principal.principalId,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#receipts.set(receipt.id, receipt);
    const fullyReceived = requisition.lines.every(
      (line) => (receivedBefore.get(line.id) ?? 0) === line.quantity,
    );
    this.#orders.set(
      order.id,
      frozen({
        ...order,
        status: fullyReceived ? 'received' : 'partially-received',
        version: order.version + 1,
      }),
    );
    this.#record(
      'operations.procurement.goods-received.v1',
      'goods-receipt',
      receipt.id,
      receipt.version,
      'operations.procurement.receipt.record',
      principal,
      correlationId,
      { purchaseOrderId: order.id, fullyReceived },
    );
    return receipt;
  }

  registerSupplierInvoice(
    input: SupplierInvoiceInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): SupplierInvoice {
    authorizeOperations(principal, 'operations.procurement.invoice.write', this.#scope);
    this.#correlation(correlationId);
    const existingId = this.#invoiceKeys.get(input.idempotencyKey);
    if (existingId) return this.#invoices.get(existingId)!;
    const supplier = this.#requireSupplier(input.supplierId);
    const order = this.#requireOrder(input.purchaseOrderId);
    if (order.supplierId !== supplier.id) throw new Error('OPS_SUPPLIER_ORDER_MISMATCH');
    for (const [field, value] of Object.entries({
      id: input.id,
      supplierInvoiceNumber: input.supplierInvoiceNumber,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
    })) {
      assertIdentifier(value, `supplierInvoice.${field}`);
    }
    assertDate(input.invoiceDate, 'supplierInvoice.invoiceDate');
    assertDate(input.dueDate, 'supplierInvoice.dueDate');
    if (input.dueDate < input.invoiceDate) throw new Error('OPS_INVALID_DATE_RANGE');
    assertMinor(input.amountMinor, 'supplierInvoice.amountMinor');
    assertMinor(input.taxMinor, 'supplierInvoice.taxMinor', true);
    const invoiceNumberKey = `${supplier.id}:${input.supplierInvoiceNumber.trim().toUpperCase()}`;
    if (this.#invoices.has(input.id) || this.#supplierInvoiceNumbers.has(invoiceNumberKey)) {
      throw new Error('OPS_DUPLICATE_SUPPLIER_INVOICE');
    }
    const matchStatus = this.#matchInvoice(input, order);
    const invoice: SupplierInvoice = frozen({
      ...input,
      supplierInvoiceNumber: input.supplierInvoiceNumber.trim().toUpperCase(),
      matchStatus,
      status: matchStatus === 'matched' ? 'matched' : 'pending-match',
      createdBy: principal.principalId,
      approvedBy: null,
      approvedAt: null,
      financeDocumentRef: null,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#invoices.set(invoice.id, invoice);
    this.#invoiceKeys.set(invoice.idempotencyKey, invoice.id);
    this.#supplierInvoiceNumbers.add(invoiceNumberKey);
    this.#record(
      'operations.procurement.supplier-invoice-registered.v1',
      'supplier-invoice',
      invoice.id,
      invoice.version,
      'operations.procurement.invoice.register',
      principal,
      correlationId,
      { purchaseOrderId: order.id, matchStatus },
    );
    return invoice;
  }

  approvePayable(
    supplierInvoiceId: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): SupplierInvoice {
    const invoice = this.#requireInvoice(supplierInvoiceId);
    if (invoice.createdBy === principal.principalId) {
      throw new Error('OPS_SOD_VIOLATION:invoice-create-approve');
    }
    authorizeOperations(principal, 'operations.procurement.payable.approve', this.#scope, {
      requireAal2: true,
    });
    if (invoice.status === 'exported') return invoice;
    if (invoice.matchStatus !== 'matched') throw new Error('OPS_PAYABLE_NOT_MATCHED');
    const order = this.#requireOrder(invoice.purchaseOrderId);
    const budget = this.#requireBudget(order.budgetEnvelopeId);
    const approvedAt = this.#clock.now().toISOString();
    const document: FinancePayableSourceDocument = frozen({
      contractVersion: '1.0',
      tenantId: this.#scope.tenantId,
      legalEntityId: this.#scope.legalEntityId,
      campusId: this.#scope.campusId,
      sourceDocumentType: 'supplier-invoice',
      sourceDocumentId: invoice.id,
      sourceDocumentNumber: invoice.supplierInvoiceNumber,
      supplierRef: invoice.supplierId,
      purchaseOrderRef: order.id,
      budgetEnvelopeRef: budget.id,
      fiscalPeriodRef: budget.fiscalPeriodRef,
      costCenterRef: budget.costCenterRef,
      accountRef: budget.accountRef,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      amountMinor: invoice.amountMinor,
      taxMinor: invoice.taxMinor,
      currency: invoice.currency,
      status: 'approved',
      approvedBy: principal.principalId,
      approvedAt,
      correlationId,
      idempotencyKey: `ops-payable:${invoice.idempotencyKey}`,
    });
    const financeDocumentRef = this.#finance.submitPayableSourceDocument(document);
    const exported: SupplierInvoice = frozen({
      ...invoice,
      status: 'exported',
      approvedBy: principal.principalId,
      approvedAt,
      financeDocumentRef,
      version: invoice.version + 1,
    });
    this.#invoices.set(exported.id, exported);
    const payableTotal = invoice.amountMinor + invoice.taxMinor;
    this.#budgets.set(
      budget.id,
      frozen({
        ...budget,
        committedMinor: budget.committedMinor - order.totalMinor,
        spentMinor: budget.spentMinor + payableTotal,
        availableMinor: budget.amountMinor - budget.spentMinor - payableTotal,
        version: budget.version + 1,
      }),
    );
    this.#orders.set(order.id, frozen({ ...order, status: 'closed', version: order.version + 1 }));
    this.#record(
      'operations.procurement.payable-exported.v1',
      'supplier-invoice',
      exported.id,
      exported.version,
      'operations.procurement.payable.approve-export',
      principal,
      correlationId,
      { financeDocumentRef, amountMinor: payableTotal },
    );
    return exported;
  }

  procurementReport(principal: OperationsPrincipal, asOf = '9999-12-31'): ProcurementReport {
    authorizeOperations(principal, 'operations.procurement.report.read', this.#scope);
    assertDate(asOf, 'report.asOf');
    const budgets = [...this.#budgets.values()];
    const sum = (selector: (budget: BudgetEnvelope) => number): number =>
      budgets.reduce((total, budget) => total + selector(budget), 0);
    return frozen({
      budgetTotalMinor: sum((budget) => budget.amountMinor),
      committedMinor: sum((budget) => budget.committedMinor),
      spentMinor: sum((budget) => budget.spentMinor),
      availableMinor: sum((budget) => budget.availableMinor),
      openRequisitions: [...this.#requisitions.values()].filter((requisition) =>
        ['draft', 'submitted', 'approved'].includes(requisition.status),
      ).length,
      openPurchaseOrders: [...this.#orders.values()].filter((order) =>
        ['issued', 'partially-received', 'received'].includes(order.status),
      ).length,
      unmatchedInvoices: [...this.#invoices.values()].filter(
        (invoice) => invoice.matchStatus !== 'matched' && invoice.status !== 'rejected',
      ).length,
      overdueSupplierInvoices: [...this.#invoices.values()].filter(
        (invoice) => invoice.dueDate < asOf && invoice.status !== 'exported',
      ).length,
    });
  }

  getBudgetEnvelope(id: string): BudgetEnvelope | undefined {
    return this.#budgets.get(id);
  }

  getSupplierInvoice(id: string): SupplierInvoice | undefined {
    return this.#invoices.get(id);
  }

  listRequisitions(): readonly Requisition[] {
    return Object.freeze([...this.#requisitions.values()]);
  }

  listPurchaseOrders(): readonly PurchaseOrder[] {
    return Object.freeze([...this.#orders.values()]);
  }

  listGoodsReceipts(): readonly GoodsReceipt[] {
    return Object.freeze([...this.#receipts.values()]);
  }

  #matchInvoice(input: SupplierInvoiceInput, order: PurchaseOrder): MatchStatus {
    if (input.currency !== order.currency) return 'currency-mismatch';
    if (input.amountMinor + input.taxMinor !== order.totalMinor) return 'amount-mismatch';
    const requisition = this.#requireRequisition(order.requisitionId);
    const received = this.#receivedQuantities(order.id);
    const fullyReceived = requisition.lines.every(
      (line) => (received.get(line.id) ?? 0) === line.quantity,
    );
    return fullyReceived ? 'matched' : 'quantity-mismatch';
  }

  #receivedQuantities(purchaseOrderId: string): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const receipt of this.#receipts.values()) {
      if (receipt.purchaseOrderId !== purchaseOrderId) continue;
      for (const line of receipt.lines) {
        quantities.set(
          line.requisitionLineId,
          (quantities.get(line.requisitionLineId) ?? 0) + line.quantityReceived,
        );
      }
    }
    return quantities;
  }

  #transitionRequisition(
    requisition: Requisition,
    status: RequisitionStatus,
    principal: OperationsPrincipal,
    correlationId: string,
  ): Requisition {
    this.#correlation(correlationId);
    const next: Requisition = frozen({
      ...requisition,
      status,
      version: requisition.version + 1,
      updatedAt: this.#clock.now().toISOString(),
    });
    this.#requisitions.set(next.id, next);
    void principal;
    return next;
  }

  #record(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    aggregateVersion: number,
    action: string,
    principal: OperationsPrincipal,
    correlationId: string,
    payload: Readonly<Record<string, unknown>>,
  ): void {
    this.#correlation(correlationId);
    const occurredAt = this.#clock.now().toISOString();
    this.#events.publish(
      createOperationsEvent({
        eventType,
        scope: this.#scope,
        aggregateType,
        aggregateId,
        aggregateVersion,
        correlationId,
        actorId: principal.principalId,
        payload,
        occurredAt,
      }),
    );
    this.#audit.append(
      createOperationsAudit({
        scope: this.#scope,
        action,
        subjectType: aggregateType,
        subjectId: aggregateId,
        actorId: principal.principalId,
        correlationId,
        details: payload,
        occurredAt,
      }),
    );
  }

  #correlation(correlationId: string): void {
    assertIdentifier(correlationId, 'correlationId');
  }

  #requireSupplier(id: string): Supplier {
    const value = this.#suppliers.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:supplier');
    return value;
  }

  #requireBudget(id: string): BudgetEnvelope {
    const value = this.#budgets.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:budget-envelope');
    return value;
  }

  #requireRequisition(id: string): Requisition {
    const value = this.#requisitions.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:requisition');
    return value;
  }

  #requireOrder(id: string): PurchaseOrder {
    const value = this.#orders.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:purchase-order');
    return value;
  }

  #requireInvoice(id: string): SupplierInvoice {
    const value = this.#invoices.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:supplier-invoice');
    return value;
  }
}
