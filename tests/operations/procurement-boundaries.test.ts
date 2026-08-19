import { describe, expect, it } from 'vitest';

import {
  InMemoryOperationsAuditWriter,
  InMemoryOperationsEventPublisher,
  type OperationsPrincipal,
} from '../../packages/modules/hr/src/index.js';
import {
  InMemoryFinancePayableGateway,
  ProcurementService,
} from '../../packages/modules/procurement/src/index.js';

const scope = { tenantId: 'tenant-ops', legalEntityId: 'entity-school', campusId: 'campus-main' };

function principal(
  principalId: string,
  permissions: readonly string[],
  assurance: 'aal1' | 'aal2' = 'aal2',
): OperationsPrincipal {
  return {
    principalId,
    tenantId: scope.tenantId,
    campusIds: [scope.campusId],
    permissions,
    assurance,
  };
}

const operator = principal('procurement-operator', [
  'operations.procurement.supplier.write',
  'operations.procurement.budget.write',
  'operations.procurement.requisition.write',
  'operations.procurement.order.write',
  'operations.procurement.receipt.write',
  'operations.procurement.invoice.write',
  'operations.procurement.report.read',
]);
const approver = principal('procurement-approver', [
  'operations.procurement.requisition.approve',
  'operations.procurement.payable.approve',
  'operations.procurement.report.read',
]);

function setup() {
  const finance = new InMemoryFinancePayableGateway();
  const service = new ProcurementService(
    scope,
    new InMemoryOperationsEventPublisher(),
    new InMemoryOperationsAuditWriter(),
    finance,
  );
  return { service, finance };
}

function seedSupplierAndBudget(service: ProcurementService): void {
  service.registerSupplier(
    {
      id: 'supplier-1',
      code: 'SUP-001',
      name: 'Dhaka Learning Supplies',
      taxReference: 'TAX-001',
      currency: 'BDT',
      status: 'active',
    },
    operator,
    'corr-supplier-1',
  );
  service.createBudgetEnvelope(
    {
      id: 'budget-1',
      fiscalPeriodRef: 'fin-period-2026',
      costCenterRef: 'fin-cost-centre-science',
      accountRef: 'fin-expense-lab',
      currency: 'BDT',
      amountMinor: 1_000_000,
    },
    operator,
    'corr-budget-1',
  );
}

function createDraft(service: ProcurementService, id = 'req-1') {
  return service.createRequisition(
    {
      id,
      budgetEnvelopeId: 'budget-1',
      requestedByStaffRef: 'staff-1',
      neededBy: '2026-08-20',
      purpose: 'Science laboratory consumables',
      lines: [
        {
          id: `${id}-line-1`,
          description: 'Laboratory glassware set',
          quantity: 10,
          estimatedUnitMinor: 50_000,
          accountRef: 'fin-expense-lab',
        },
      ],
    },
    operator,
    `corr-${id}-create`,
  );
}

function approveRequisition(service: ProcurementService, id = 'req-1') {
  const draft = createDraft(service, id);
  service.submitRequisition(draft.id, operator, `corr-${id}-submit`);
  return service.approveRequisition(draft.id, approver, `corr-${id}-approve`);
}

function issueOrder(service: ProcurementService, requisitionId = 'req-1', id = 'po-1') {
  return service.issuePurchaseOrder(
    {
      id,
      requisitionId,
      supplierId: 'supplier-1',
      orderNumber: `PO-${id}`,
      orderedOn: '2026-07-28',
      expectedOn: '2026-08-15',
    },
    operator,
    `corr-${id}`,
  );
}

function receiveFully(
  service: ProcurementService,
  purchaseOrderId = 'po-1',
  lineId = 'req-1-line-1',
) {
  return service.recordGoodsReceipt(
    {
      id: `receipt-${purchaseOrderId}`,
      purchaseOrderId,
      receivedOn: '2026-08-10',
      receivedByStaffRef: 'staff-storekeeper',
      lines: [{ requisitionLineId: lineId, quantityReceived: 10 }],
    },
    operator,
    `corr-receipt-${purchaseOrderId}`,
  );
}

describe('procurement integrity boundaries', () => {
  it('rejects duplicate supplier/budget identities and malformed requisition lines', () => {
    const { service } = setup();
    seedSupplierAndBudget(service);

    expect(() =>
      service.registerSupplier(
        {
          id: 'supplier-1',
          code: 'SUP-002',
          name: 'Duplicate Supplier',
          taxReference: 'TAX-002',
          currency: 'BDT',
          status: 'active',
        },
        operator,
        'corr-duplicate-supplier-id',
      ),
    ).toThrow('OPS_DUPLICATE_SUPPLIER');
    expect(() =>
      service.registerSupplier(
        {
          id: 'supplier-2',
          code: ' sup-001 ',
          name: 'Duplicate Supplier Code',
          taxReference: 'TAX-002',
          currency: 'BDT',
          status: 'active',
        },
        operator,
        'corr-duplicate-supplier-code',
      ),
    ).toThrow('OPS_DUPLICATE_SUPPLIER');
    expect(() =>
      service.createBudgetEnvelope(
        {
          id: 'budget-1',
          fiscalPeriodRef: 'fin-period-2027',
          costCenterRef: 'fin-cost-centre-science',
          accountRef: 'fin-expense-lab',
          currency: 'BDT',
          amountMinor: 100_000,
        },
        operator,
        'corr-duplicate-budget',
      ),
    ).toThrow('OPS_DUPLICATE_BUDGET');

    const requisitionBase = {
      id: 'req-invalid',
      budgetEnvelopeId: 'budget-1',
      requestedByStaffRef: 'staff-1',
      neededBy: '2026-08-20',
      purpose: 'Valid procurement purpose',
    } as const;
    expect(() =>
      service.createRequisition(
        { ...requisitionBase, purpose: 'bad', lines: [] },
        operator,
        'corr-purpose',
      ),
    ).toThrow('OPS_REQUISITION_PURPOSE_REQUIRED');
    expect(() =>
      service.createRequisition({ ...requisitionBase, lines: [] }, operator, 'corr-no-lines'),
    ).toThrow('OPS_REQUISITION_LINE_REQUIRED');
    expect(() =>
      service.createRequisition(
        {
          ...requisitionBase,
          lines: [
            {
              id: 'line-account',
              description: 'Item',
              quantity: 1,
              estimatedUnitMinor: 100,
              accountRef: 'wrong-account',
            },
          ],
        },
        operator,
        'corr-account-mismatch',
      ),
    ).toThrow('OPS_BUDGET_ACCOUNT_MISMATCH');
    expect(() =>
      service.createRequisition(
        {
          ...requisitionBase,
          lines: [
            {
              id: 'line-quantity',
              description: 'Item',
              quantity: 0,
              estimatedUnitMinor: 100,
              accountRef: 'fin-expense-lab',
            },
          ],
        },
        operator,
        'corr-invalid-quantity',
      ),
    ).toThrow('OPS_INVALID_QUANTITY');
    expect(() =>
      service.createRequisition(
        {
          ...requisitionBase,
          lines: [
            {
              id: 'line-duplicate',
              description: 'Item one',
              quantity: 1,
              estimatedUnitMinor: 100,
              accountRef: 'fin-expense-lab',
            },
            {
              id: 'line-duplicate',
              description: 'Item two',
              quantity: 1,
              estimatedUnitMinor: 100,
              accountRef: 'fin-expense-lab',
            },
          ],
        },
        operator,
        'corr-duplicate-line',
      ),
    ).toThrow('OPS_DUPLICATE_REQUISITION_LINE');
  });

  it('keeps requisition approval and purchase-order issuance fail-closed across lifecycle states', () => {
    const { service } = setup();
    seedSupplierAndBudget(service);
    const draft = createDraft(service);

    expect(() => service.approveRequisition(draft.id, approver, 'corr-approve-draft')).toThrow(
      'OPS_INVALID_REQUISITION_STATE',
    );
    const submitted = service.submitRequisition(draft.id, operator, 'corr-submit');
    expect(service.submitRequisition(draft.id, operator, 'corr-submit-replay')).toEqual(submitted);
    const approved = service.approveRequisition(draft.id, approver, 'corr-approve');
    expect(service.approveRequisition(draft.id, approver, 'corr-approve-replay')).toEqual(approved);

    service.registerSupplier(
      {
        id: 'supplier-inactive',
        code: 'SUP-INACTIVE',
        name: 'Inactive Supplier',
        taxReference: 'TAX-INACTIVE',
        currency: 'BDT',
        status: 'inactive',
      },
      operator,
      'corr-supplier-inactive',
    );
    expect(() =>
      service.issuePurchaseOrder(
        {
          id: 'po-inactive',
          requisitionId: approved.id,
          supplierId: 'supplier-inactive',
          orderNumber: 'PO-INACTIVE',
          orderedOn: '2026-07-28',
          expectedOn: '2026-08-15',
        },
        operator,
        'corr-po-inactive',
      ),
    ).toThrow('OPS_SUPPLIER_INACTIVE');

    service.registerSupplier(
      {
        id: 'supplier-usd',
        code: 'SUP-USD',
        name: 'USD Supplier',
        taxReference: 'TAX-USD',
        currency: 'USD',
        status: 'active',
      },
      operator,
      'corr-supplier-usd',
    );
    expect(() =>
      service.issuePurchaseOrder(
        {
          id: 'po-currency',
          requisitionId: approved.id,
          supplierId: 'supplier-usd',
          orderNumber: 'PO-CURRENCY',
          orderedOn: '2026-07-28',
          expectedOn: '2026-08-15',
        },
        operator,
        'corr-po-currency',
      ),
    ).toThrow('OPS_CURRENCY_MISMATCH');
    expect(() =>
      service.issuePurchaseOrder(
        {
          id: 'po-date',
          requisitionId: approved.id,
          supplierId: 'supplier-1',
          orderNumber: 'PO-DATE',
          orderedOn: '2026-08-20',
          expectedOn: '2026-08-19',
        },
        operator,
        'corr-po-date',
      ),
    ).toThrow('OPS_INVALID_DATE_RANGE');

    const order = issueOrder(service, approved.id);
    expect(() =>
      service.issuePurchaseOrder(
        {
          id: order.id,
          requisitionId: approved.id,
          supplierId: 'supplier-1',
          orderNumber: 'PO-DUPLICATE',
          orderedOn: '2026-07-28',
          expectedOn: '2026-08-15',
        },
        operator,
        'corr-po-duplicate',
      ),
    ).toThrow('OPS_REQUISITION_NOT_APPROVED');
  });

  it('tracks partial receipts, prevents invalid and excess receipts, then closes receipt eligibility', () => {
    const { service } = setup();
    seedSupplierAndBudget(service);
    const requisition = approveRequisition(service);
    const order = issueOrder(service, requisition.id);

    expect(() =>
      service.recordGoodsReceipt(
        {
          id: 'receipt-empty',
          purchaseOrderId: order.id,
          receivedOn: '2026-08-10',
          receivedByStaffRef: 'staff-storekeeper',
          lines: [],
        },
        operator,
        'corr-receipt-empty',
      ),
    ).toThrow('OPS_RECEIPT_LINE_REQUIRED');
    expect(() =>
      service.recordGoodsReceipt(
        {
          id: 'receipt-missing-line',
          purchaseOrderId: order.id,
          receivedOn: '2026-08-10',
          receivedByStaffRef: 'staff-storekeeper',
          lines: [{ requisitionLineId: 'missing-line', quantityReceived: 1 }],
        },
        operator,
        'corr-receipt-missing-line',
      ),
    ).toThrow('OPS_NOT_FOUND:requisition-line');
    expect(() =>
      service.recordGoodsReceipt(
        {
          id: 'receipt-invalid-quantity',
          purchaseOrderId: order.id,
          receivedOn: '2026-08-10',
          receivedByStaffRef: 'staff-storekeeper',
          lines: [{ requisitionLineId: 'req-1-line-1', quantityReceived: 0 }],
        },
        operator,
        'corr-receipt-invalid-quantity',
      ),
    ).toThrow('OPS_INVALID_QUANTITY');

    const partial = service.recordGoodsReceipt(
      {
        id: 'receipt-partial',
        purchaseOrderId: order.id,
        receivedOn: '2026-08-10',
        receivedByStaffRef: 'staff-storekeeper',
        lines: [{ requisitionLineId: 'req-1-line-1', quantityReceived: 4 }],
      },
      operator,
      'corr-receipt-partial',
    );
    expect(partial.lines[0]?.quantityReceived).toBe(4);
    expect(service.listPurchaseOrders()[0]?.status).toBe('partially-received');
    expect(() =>
      service.recordGoodsReceipt(
        {
          id: 'receipt-excess',
          purchaseOrderId: order.id,
          receivedOn: '2026-08-11',
          receivedByStaffRef: 'staff-storekeeper',
          lines: [{ requisitionLineId: 'req-1-line-1', quantityReceived: 7 }],
        },
        operator,
        'corr-receipt-excess',
      ),
    ).toThrow('OPS_RECEIPT_EXCEEDS_ORDER');

    service.recordGoodsReceipt(
      {
        id: 'receipt-final',
        purchaseOrderId: order.id,
        receivedOn: '2026-08-12',
        receivedByStaffRef: 'staff-storekeeper',
        lines: [{ requisitionLineId: 'req-1-line-1', quantityReceived: 6 }],
      },
      operator,
      'corr-receipt-final',
    );
    expect(service.listGoodsReceipts()).toHaveLength(2);
    expect(service.listPurchaseOrders()[0]?.status).toBe('received');
    expect(() =>
      service.recordGoodsReceipt(
        {
          id: 'receipt-after-close',
          purchaseOrderId: order.id,
          receivedOn: '2026-08-13',
          receivedByStaffRef: 'staff-storekeeper',
          lines: [{ requisitionLineId: 'req-1-line-1', quantityReceived: 1 }],
        },
        operator,
        'corr-receipt-after-close',
      ),
    ).toThrow('OPS_PURCHASE_ORDER_NOT_RECEIVABLE');
  });

  it('preserves invoice idempotency and distinguishes currency, amount and quantity mismatches', () => {
    const { service } = setup();
    seedSupplierAndBudget(service);
    service.registerSupplier(
      {
        id: 'supplier-2',
        code: 'SUP-002',
        name: 'Second Supplier',
        taxReference: 'TAX-002',
        currency: 'BDT',
        status: 'active',
      },
      operator,
      'corr-supplier-2',
    );
    const requisition = approveRequisition(service);
    const order = issueOrder(service, requisition.id);

    const invoiceInput = {
      id: 'invoice-currency',
      supplierId: 'supplier-1',
      purchaseOrderId: order.id,
      supplierInvoiceNumber: 'INV-CURRENCY',
      invoiceDate: '2026-08-11',
      dueDate: '2026-09-10',
      currency: 'USD' as const,
      amountMinor: 500_000,
      taxMinor: 0,
      idempotencyKey: 'invoice-key-currency',
    };
    const currencyMismatch = service.registerSupplierInvoice(
      invoiceInput,
      operator,
      'corr-invoice-currency',
    );
    expect(currencyMismatch.matchStatus).toBe('currency-mismatch');
    expect(
      service.registerSupplierInvoice(invoiceInput, operator, 'corr-invoice-currency-replay'),
    ).toEqual(currencyMismatch);

    const amountMismatch = service.registerSupplierInvoice(
      {
        ...invoiceInput,
        id: 'invoice-amount',
        supplierInvoiceNumber: 'INV-AMOUNT',
        currency: 'BDT',
        amountMinor: 499_999,
        idempotencyKey: 'invoice-key-amount',
      },
      operator,
      'corr-invoice-amount',
    );
    expect(amountMismatch.matchStatus).toBe('amount-mismatch');

    expect(() =>
      service.registerSupplierInvoice(
        {
          ...invoiceInput,
          id: 'invoice-wrong-supplier',
          supplierId: 'supplier-2',
          supplierInvoiceNumber: 'INV-WRONG-SUPPLIER',
          currency: 'BDT',
          idempotencyKey: 'invoice-key-wrong-supplier',
        },
        operator,
        'corr-invoice-wrong-supplier',
      ),
    ).toThrow('OPS_SUPPLIER_ORDER_MISMATCH');
    expect(() =>
      service.registerSupplierInvoice(
        {
          ...invoiceInput,
          id: 'invoice-date',
          supplierInvoiceNumber: 'INV-DATE',
          currency: 'BDT',
          invoiceDate: '2026-09-11',
          dueDate: '2026-09-10',
          idempotencyKey: 'invoice-key-date',
        },
        operator,
        'corr-invoice-date',
      ),
    ).toThrow('OPS_INVALID_DATE_RANGE');

    receiveFully(service, order.id);
    const matched = service.registerSupplierInvoice(
      {
        ...invoiceInput,
        id: 'invoice-matched',
        supplierInvoiceNumber: 'INV-MATCHED',
        currency: 'BDT',
        idempotencyKey: 'invoice-key-matched',
      },
      operator,
      'corr-invoice-matched',
    );
    expect(matched.matchStatus).toBe('matched');
    expect(service.getSupplierInvoice(matched.id)).toEqual(matched);
    expect(() => service.approvePayable(matched.id, operator, 'corr-payable-self')).toThrow(
      'OPS_SOD_VIOLATION:invoice-create-approve',
    );
  });

  it('exports a matched payable once and exposes consistent report/list projections', () => {
    const { service, finance } = setup();
    seedSupplierAndBudget(service);
    const requisition = approveRequisition(service);
    const order = issueOrder(service, requisition.id);
    receiveFully(service, order.id);
    const invoice = service.registerSupplierInvoice(
      {
        id: 'invoice-1',
        supplierId: 'supplier-1',
        purchaseOrderId: order.id,
        supplierInvoiceNumber: 'INV-1',
        invoiceDate: '2026-08-11',
        dueDate: '2026-09-10',
        currency: 'BDT',
        amountMinor: 500_000,
        taxMinor: 0,
        idempotencyKey: 'invoice-key-1',
      },
      operator,
      'corr-invoice-1',
    );

    const exported = service.approvePayable(invoice.id, approver, 'corr-payable-1');
    expect(service.approvePayable(invoice.id, approver, 'corr-payable-replay')).toEqual(exported);
    expect(finance.documents).toHaveLength(1);
    expect(finance.submitPayableSourceDocument(finance.documents[0]!)).toBe(
      exported.financeDocumentRef,
    );
    expect(finance.documents).toHaveLength(1);
    expect(service.listRequisitions()).toHaveLength(1);
    expect(service.listPurchaseOrders()).toHaveLength(1);
    expect(service.listGoodsReceipts()).toHaveLength(1);
    expect(service.getSupplierInvoice(invoice.id)?.status).toBe('exported');
    expect(service.procurementReport(operator, '2026-10-01')).toMatchObject({
      committedMinor: 0,
      spentMinor: 500_000,
      availableMinor: 500_000,
      openRequisitions: 0,
      openPurchaseOrders: 0,
      unmatchedInvoices: 0,
      overdueSupplierInvoices: 0,
    });
  });
});
