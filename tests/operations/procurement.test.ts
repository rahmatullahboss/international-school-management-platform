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

const buyer = principal('buyer', [
  'operations.procurement.supplier.write',
  'operations.procurement.budget.write',
  'operations.procurement.requisition.write',
  'operations.procurement.order.write',
  'operations.procurement.receipt.write',
  'operations.procurement.invoice.write',
  'operations.procurement.report.read',
]);
const approver = principal('approver', [
  'operations.procurement.requisition.approve',
  'operations.procurement.payable.approve',
  'operations.procurement.report.read',
]);

function setup(): {
  service: ProcurementService;
  finance: InMemoryFinancePayableGateway;
  events: InMemoryOperationsEventPublisher;
} {
  const events = new InMemoryOperationsEventPublisher();
  const audit = new InMemoryOperationsAuditWriter();
  const finance = new InMemoryFinancePayableGateway();
  return { service: new ProcurementService(scope, events, audit, finance), finance, events };
}

function seed(service: ProcurementService): void {
  service.registerSupplier(
    {
      id: 'supplier-1',
      code: 'SUP-001',
      name: 'Dhaka Learning Supplies',
      taxReference: 'TAX-001',
      currency: 'BDT',
      status: 'active',
    },
    buyer,
    'corr-supplier',
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
    buyer,
    'corr-budget',
  );
}

function approvedRequisition(service: ProcurementService): string {
  const draft = service.createRequisition(
    {
      id: 'req-1',
      budgetEnvelopeId: 'budget-1',
      requestedByStaffRef: 'staff-1',
      neededBy: '2026-08-20',
      purpose: 'Science laboratory consumables',
      lines: [
        {
          id: 'req-line-1',
          description: 'Laboratory glassware set',
          quantity: 10,
          estimatedUnitMinor: 50_000,
          accountRef: 'fin-expense-lab',
        },
      ],
    },
    buyer,
    'corr-req-create',
  );
  service.submitRequisition(draft.id, buyer, 'corr-req-submit');
  return service.approveRequisition(draft.id, approver, 'corr-req-approve').id;
}

describe('OPS procurement, budgets and payables', () => {
  it('commits approved purchase orders against a public finance budget reference', () => {
    const { service, events } = setup();
    seed(service);
    const requisitionId = approvedRequisition(service);

    const order = service.issuePurchaseOrder(
      {
        id: 'po-1',
        requisitionId,
        supplierId: 'supplier-1',
        orderNumber: 'PO-2026-0001',
        orderedOn: '2026-07-28',
        expectedOn: '2026-08-15',
      },
      buyer,
      'corr-po',
    );

    expect(order.totalMinor).toBe(500_000);
    expect(service.getBudgetEnvelope('budget-1')).toMatchObject({
      amountMinor: 1_000_000,
      committedMinor: 500_000,
      availableMinor: 500_000,
    });
    expect(
      events.events.some(
        (event) => event.eventType === 'operations.procurement.budget-committed.v1',
      ),
    ).toBe(true);
  });

  it('enforces AAL2 separation of duties for requisition approval', () => {
    const { service } = setup();
    seed(service);
    const draft = service.createRequisition(
      {
        id: 'req-1',
        budgetEnvelopeId: 'budget-1',
        requestedByStaffRef: 'staff-1',
        neededBy: '2026-08-20',
        purpose: 'Science laboratory consumables',
        lines: [
          {
            id: 'req-line-1',
            description: 'Laboratory glassware set',
            quantity: 10,
            estimatedUnitMinor: 50_000,
            accountRef: 'fin-expense-lab',
          },
        ],
      },
      buyer,
      'corr-req-create',
    );
    service.submitRequisition(draft.id, buyer, 'corr-req-submit');

    expect(() => service.approveRequisition(draft.id, buyer, 'corr-self-approve')).toThrow(
      'OPS_SOD_VIOLATION:requisition-request-approve',
    );
    expect(() =>
      service.approveRequisition(
        draft.id,
        principal('approver-aal1', ['operations.procurement.requisition.approve'], 'aal1'),
        'corr-aal1',
      ),
    ).toThrow('OPS_STEP_UP_REQUIRED');
  });

  it('prevents commitments that exceed the budget envelope', () => {
    const { service } = setup();
    seed(service);
    service.createRequisition(
      {
        id: 'req-over',
        budgetEnvelopeId: 'budget-1',
        requestedByStaffRef: 'staff-2',
        neededBy: '2026-08-20',
        purpose: 'Large equipment order',
        lines: [
          {
            id: 'req-line-over',
            description: 'High value equipment',
            quantity: 1,
            estimatedUnitMinor: 1_500_000,
            accountRef: 'fin-expense-lab',
          },
        ],
      },
      buyer,
      'corr-over-create',
    );
    service.submitRequisition('req-over', buyer, 'corr-over-submit');
    service.approveRequisition('req-over', approver, 'corr-over-approve');

    expect(() =>
      service.issuePurchaseOrder(
        {
          id: 'po-over',
          requisitionId: 'req-over',
          supplierId: 'supplier-1',
          orderNumber: 'PO-2026-OVER',
          orderedOn: '2026-07-28',
          expectedOn: '2026-08-15',
        },
        buyer,
        'corr-over-po',
      ),
    ).toThrow('OPS_BUDGET_EXCEEDED');
  });

  it('three-way matches receipts and exports an immutable payable source document to FIN', () => {
    const { service, finance } = setup();
    seed(service);
    const requisitionId = approvedRequisition(service);
    service.issuePurchaseOrder(
      {
        id: 'po-1',
        requisitionId,
        supplierId: 'supplier-1',
        orderNumber: 'PO-2026-0001',
        orderedOn: '2026-07-28',
        expectedOn: '2026-08-15',
      },
      buyer,
      'corr-po',
    );
    service.recordGoodsReceipt(
      {
        id: 'receipt-1',
        purchaseOrderId: 'po-1',
        receivedOn: '2026-08-10',
        receivedByStaffRef: 'staff-storekeeper',
        lines: [{ requisitionLineId: 'req-line-1', quantityReceived: 10 }],
      },
      buyer,
      'corr-receipt',
    );
    const invoice = service.registerSupplierInvoice(
      {
        id: 'supplier-invoice-1',
        supplierId: 'supplier-1',
        purchaseOrderId: 'po-1',
        supplierInvoiceNumber: 'DLS-7788',
        invoiceDate: '2026-08-11',
        dueDate: '2026-09-10',
        currency: 'BDT',
        amountMinor: 500_000,
        taxMinor: 0,
        idempotencyKey: 'supplier-1:DLS-7788',
      },
      buyer,
      'corr-invoice',
    );

    expect(invoice.matchStatus).toBe('matched');
    const approved = service.approvePayable(invoice.id, approver, 'corr-payable');
    expect(approved.status).toBe('exported');
    expect(finance.documents).toHaveLength(1);
    expect(finance.documents[0]).toMatchObject({
      sourceDocumentType: 'supplier-invoice',
      sourceDocumentId: 'supplier-invoice-1',
      supplierRef: 'supplier-1',
      amountMinor: 500_000,
      currency: 'BDT',
      status: 'approved',
    });
    expect(service.getBudgetEnvelope('budget-1')).toMatchObject({
      committedMinor: 0,
      spentMinor: 500_000,
      availableMinor: 500_000,
    });
  });

  it('rejects duplicate supplier invoice numbers and unmatched quantities', () => {
    const { service } = setup();
    seed(service);
    const requisitionId = approvedRequisition(service);
    service.issuePurchaseOrder(
      {
        id: 'po-1',
        requisitionId,
        supplierId: 'supplier-1',
        orderNumber: 'PO-2026-0001',
        orderedOn: '2026-07-28',
        expectedOn: '2026-08-15',
      },
      buyer,
      'corr-po',
    );
    service.recordGoodsReceipt(
      {
        id: 'receipt-1',
        purchaseOrderId: 'po-1',
        receivedOn: '2026-08-10',
        receivedByStaffRef: 'staff-storekeeper',
        lines: [{ requisitionLineId: 'req-line-1', quantityReceived: 5 }],
      },
      buyer,
      'corr-receipt',
    );
    const invoice = service.registerSupplierInvoice(
      {
        id: 'supplier-invoice-1',
        supplierId: 'supplier-1',
        purchaseOrderId: 'po-1',
        supplierInvoiceNumber: 'DLS-7788',
        invoiceDate: '2026-08-11',
        dueDate: '2026-09-10',
        currency: 'BDT',
        amountMinor: 500_000,
        taxMinor: 0,
        idempotencyKey: 'supplier-1:DLS-7788',
      },
      buyer,
      'corr-invoice',
    );
    expect(invoice.matchStatus).toBe('quantity-mismatch');
    expect(() => service.approvePayable(invoice.id, approver, 'corr-unmatched')).toThrow(
      'OPS_PAYABLE_NOT_MATCHED',
    );
    expect(() =>
      service.registerSupplierInvoice(
        {
          ...invoice,
          id: 'supplier-invoice-duplicate',
          idempotencyKey: 'duplicate-key',
        },
        buyer,
        'corr-duplicate',
      ),
    ).toThrow('OPS_DUPLICATE_SUPPLIER_INVOICE');
  });

  it('reports budget, order and payable exceptions', () => {
    const { service } = setup();
    seed(service);
    const report = service.procurementReport(buyer);
    expect(report).toEqual({
      budgetTotalMinor: 1_000_000,
      committedMinor: 0,
      spentMinor: 0,
      availableMinor: 1_000_000,
      openRequisitions: 0,
      openPurchaseOrders: 0,
      unmatchedInvoices: 0,
      overdueSupplierInvoices: 0,
    });
  });
});
