import { describe, expect, it } from 'vitest';

import { PolicyEngine, type PermissionGrant } from '@school/policy';

import {
  BillingService,
  currencyCode,
  FinanceReportingService,
  HmacTestPaymentProviderAdapter,
  minorUnit,
  PaymentService,
  type FinancePrincipal,
  type VerifiedProviderEvent,
} from '../../packages/modules/billing/src/index.js';
import {
  SisApplicationService,
  type SisPermission,
  type SisRequestContext,
} from '../../packages/modules/admissions/src/index.js';
import { ImportExportStudio } from '../../packages/modules/integrations/src/index.js';
import {
  LedgerService,
  type LedgerAccountRecord,
} from '../../packages/modules/ledger/src/index.js';

const tenantId = '00000000-0000-4000-8000-0000000000a1';
const legalEntityId = '10000000-0000-4000-8000-0000000000a1';
const registrarId = '20000000-0000-4000-8000-0000000000a1';
const guardianPrincipalId = '20000000-0000-4000-8000-0000000000a2';
const bookId = '30000000-0000-4000-8000-0000000000a1';
const periodId = '40000000-0000-4000-8000-0000000000a1';
const gbp = currencyCode('GBP');
const clock = { now: () => new Date('2026-07-28T12:00:00.000Z') };

function sisContext(
  principalId = registrarId,
  assurance: SisRequestContext['assurance'] = 'aal2',
  personId?: string,
): SisRequestContext {
  return {
    tenantId,
    principalId,
    assurance,
    correlationId: crypto.randomUUID(),
    ...(personId === undefined ? {} : { personId }),
  };
}

function financePrincipal(
  principalId: string,
  permissions: FinancePrincipal['permissions'],
): FinancePrincipal {
  return {
    principalId,
    assurance: 'aal2',
    permissions,
    scope: { tenantId, legalEntityId },
  };
}

function ledgerAccount(
  id: string,
  code: string,
  type: LedgerAccountRecord['type'],
  controlAccount = false,
): LedgerAccountRecord {
  return {
    id,
    tenantId,
    legalEntityId,
    bookId,
    code,
    name: id,
    type,
    naturalBalance: type === 'asset' || type === 'expense' ? 'debit' : 'credit',
    controlAccount,
    active: true,
  };
}

describe('Wave 1 integrated applicant-to-reconciliation journey', () => {
  it('links SIS enrollment to finance settlement and a safe integration export', () => {
    const policy = new PolicyEngine();
    const sisPermissions: readonly SisPermission[] = [
      'sis.people.read',
      'sis.people.manage',
      'sis.guardian.manage',
      'sis.admissions.read',
      'sis.admissions.manage',
      'sis.admissions.review',
      'sis.admissions.convert',
      'sis.enrollment.read',
      'sis.enrollment.manage',
      'sis.import.manage',
      'sis.export.read',
    ];
    const grants: PermissionGrant[] = sisPermissions.map((permission) => ({
      permission,
      assurance:
        permission === 'sis.admissions.review' || permission === 'sis.admissions.convert'
          ? 'aal2'
          : 'aal1',
    }));
    policy.registerRole('registrar', grants);
    policy.registerRole('family', [
      { permission: 'sis.family.application.read', assurance: 'aal1' },
      { permission: 'sis.family.contract.sign', assurance: 'aal1' },
    ]);
    policy.assignRole({ principalId: registrarId, tenantId, roleId: 'registrar' });
    policy.assignRole({ principalId: guardianPrincipalId, tenantId, roleId: 'family' });

    const sis = new SisApplicationService({ authorizer: policy });
    const registrar = sisContext();
    const student = sis.createPerson(registrar, {
      names: [
        {
          usage: 'legal',
          givenName: 'Amina',
          familyName: 'Rahman',
          effectiveFrom: '2026-01-01',
        },
      ],
      dateOfBirth: '2015-05-10',
    });
    const guardian = sis.createPerson(registrar, {
      names: [
        {
          usage: 'legal',
          givenName: 'Nadia',
          familyName: 'Rahman',
          effectiveFrom: '2026-01-01',
        },
      ],
    });
    sis.setGuardianAuthority(registrar, {
      guardianPersonId: guardian.personId,
      studentPersonId: student.personId,
      authorities: ['legal', 'education', 'portal'],
      verificationStatus: 'verified',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2099-12-31',
    });
    const cycle = sis.createAdmissionsCycle(registrar, {
      name: '2027 Entry',
      opensAt: '2026-01-01T00:00:00.000Z',
      closesAt: '2027-01-01T00:00:00.000Z',
      status: 'open',
    });
    const form = sis.publishApplicationForm(registrar, {
      formKey: 'standard',
      schema: { required: ['legalName'] },
    });
    const application = sis.startApplication(registrar, {
      applicationNumber: 'APP-WAVE1-001',
      cycleId: cycle.cycleId,
      applicantPersonId: student.personId,
      submittingGuardianPersonId: guardian.personId,
      programChoiceIds: ['50000000-0000-4000-8000-0000000000a1'],
      formVersionId: form.formVersionId,
      initialAnswers: { legalName: 'Amina Rahman' },
    });
    const checklist = sis.addChecklistRequirement(registrar, application.applicationId, {
      requirementKey: 'identity',
      label: 'Identity document',
      required: true,
    });
    sis.updateChecklist(registrar, application.applicationId, {
      checklistItemId: checklist.checklistItemId,
      status: 'verified',
      documentId: '60000000-0000-4000-8000-0000000000a1',
    });
    sis.submitApplication(registrar, application.applicationId);
    sis.recordReview(registrar, application.applicationId, {
      recommendation: 'admit',
      score: 95,
      confidential: true,
    });
    sis.recordDecision(registrar, application.applicationId, {
      decision: 'admit',
      reasonCode: 'meets-criteria',
    });
    sis.issueOffer(registrar, application.applicationId, {
      programId: '50000000-0000-4000-8000-0000000000a1',
      campusId: '70000000-0000-4000-8000-0000000000a1',
      academicYearId: '80000000-0000-4000-8000-0000000000a1',
      gradeLevelId: '90000000-0000-4000-8000-0000000000a1',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    sis.issueContract(registrar, application.applicationId, {
      templateVersion: 'v1',
      documentId: '60000000-0000-4000-8000-0000000000a2',
    });
    sis.signContractAsGuardian(
      sisContext(guardianPrincipalId, 'aal1', guardian.personId),
      application.applicationId,
    );
    sis.acceptOffer(registrar, application.applicationId);
    const conversion = sis.convertAcceptedApplication(registrar, {
      applicationId: application.applicationId,
      idempotencyKey: 'convert-wave1-app-001',
      effectiveFrom: '2027-08-01',
    });

    const operator = financePrincipal('finance-operator', [
      'billing.account.write',
      'billing.fee.write',
      'billing.invoice.write',
      'billing.payment.write',
      'billing.allocation.write',
    ]);
    const invoicePoster = financePrincipal('invoice-poster', [
      'billing.invoice.post',
      'ledger.journal.post',
    ]);
    const paymentVerifier = financePrincipal('payment-verifier', [
      'billing.payment.verify',
      'ledger.journal.post',
    ]);
    const reporter = financePrincipal('finance-reporter', ['finance.report.read']);

    const ledger = new LedgerService({ tenantId, legalEntityId }, clock);
    ledger.registerAccount(ledgerAccount('cash', '1000', 'asset'));
    ledger.registerAccount(ledgerAccount('bank-deposit', '1010', 'asset'));
    ledger.registerAccount(ledgerAccount('receivable', '1100', 'asset', true));
    ledger.registerAccount(ledgerAccount('unapplied-cash', '2200', 'liability', true));
    ledger.registerAccount(ledgerAccount('tuition-income', '4100', 'income'));
    ledger.createPeriod({
      id: periodId,
      tenantId,
      legalEntityId,
      bookId,
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
    });

    const billing = new BillingService(
      { tenantId, legalEntityId },
      ledger,
      { bookId, receivableAccountId: 'receivable' },
      clock,
    );
    billing.createBillingAccount(
      {
        id: 'family-account-wave1',
        tenantId,
        legalEntityId,
        accountHolderRef: conversion.studentProfile.studentProfileId,
        currency: gbp,
        status: 'active',
        responsibleParties: [
          { personRef: guardian.personId, responsibilityBasisPoints: 10_000, priority: 1 },
        ],
      },
      operator,
    );
    billing.registerFeeItem(
      {
        id: 'admission-deposit',
        tenantId,
        legalEntityId,
        code: 'DEPOSIT',
        name: 'Admission deposit',
        description: null,
        amountMinor: minorUnit(5_000),
        currency: gbp,
        incomeAccountId: 'tuition-income',
        taxBasisPoints: 0,
        taxAccountId: null,
        active: true,
      },
      operator,
    );
    const draftInvoice = billing.createInvoice({
      billingAccountId: 'family-account-wave1',
      issueDate: '2026-07-01',
      dueDate: '2026-07-31',
      lines: [{ feeItemId: 'admission-deposit', quantity: 1 }],
      createdBy: operator,
      idempotencyKey: 'wave1-deposit-invoice',
    });
    const invoice = billing.postInvoice({
      invoiceId: draftInvoice.id,
      periodId,
      postedBy: invoicePoster,
      idempotencyKey: 'wave1-deposit-invoice',
      correlationId: 'wave1-deposit-invoice',
    });

    const payments = new PaymentService(
      { tenantId, legalEntityId },
      billing,
      ledger,
      {
        bookId,
        cashAccountId: 'cash',
        bankDepositAccountId: 'bank-deposit',
        receivableAccountId: 'receivable',
        unappliedCashAccountId: 'unapplied-cash',
      },
      clock,
    );
    const adapter = new HmacTestPaymentProviderAdapter(
      'wave1-provider',
      'wave1-integration-provider-secret-123456789',
    );
    const intent = payments.createPaymentIntent({
      billingAccountId: 'family-account-wave1',
      amountMinor: 5_000,
      currency: gbp,
      provider: adapter.provider,
      expiresAt: '2026-07-29T12:00:00.000Z',
      createdBy: operator,
      idempotencyKey: 'wave1-deposit-intent',
    });
    payments.bindProviderIntent(intent.id, 'wave1-provider-intent', operator);
    const event: VerifiedProviderEvent = {
      eventId: 'wave1-payment-event',
      eventType: 'payment.settled',
      provider: adapter.provider,
      providerPaymentId: 'wave1-provider-payment',
      paymentIntentId: intent.id,
      amountMinor: 5_000,
      currency: 'GBP',
      occurredAt: '2026-07-28T11:00:00.000Z',
      metadata: { journey: 'wave1' },
    };
    const payload = JSON.stringify(event);
    const payment = payments.processProviderEvent({
      payload,
      signature: adapter.sign(payload),
      adapter,
      verifiedBy: paymentVerifier,
      periodId,
      correlationId: 'wave1-payment',
    });
    expect(payment).not.toBeNull();
    payments.allocatePayment({
      paymentId: payment!.id,
      invoiceId: invoice.id,
      amountMinor: 5_000,
      principal: operator,
      periodId,
      idempotencyKey: 'wave1-payment-allocation',
      correlationId: 'wave1-payment-allocation',
    });

    const reporting = new FinanceReportingService(
      { tenantId, legalEntityId },
      billing,
      payments,
      ledger,
      {
        receivableAccountId: 'receivable',
        unappliedCashAccountId: 'unapplied-cash',
        maxRows: 100,
      },
    );
    const statement = reporting.accountStatement('family-account-wave1', '2026-07-31', reporter);
    const reconciliation = reporting.receivableReconciliation('2026-07-31', reporter);
    const trialBalance = reporting.trialBalance('2026-07-31', reporter);

    const exportStudio = new ImportExportStudio();
    const csv = exportStudio.exportCsv({
      columns: [
        'applicationId',
        'studentProfileId',
        'enrollmentId',
        'invoiceId',
        'paymentId',
        'closingBalanceMinor',
      ],
      rows: [
        {
          applicationId: application.applicationId,
          studentProfileId: conversion.studentProfile.studentProfileId,
          enrollmentId: conversion.enrollment.enrollmentId,
          invoiceId: invoice.id,
          paymentId: payment!.id,
          closingBalanceMinor: statement.closingBalanceMinor,
        },
      ],
      maxRows: 10,
    });

    expect(conversion.application.status).toBe('converted');
    expect(invoice.billingAccountId).toBe('family-account-wave1');
    expect(statement.entries.map((entry) => entry.type)).toEqual(['invoice', 'payment']);
    expect(statement.closingBalanceMinor).toBe(0);
    expect(reconciliation).toMatchObject({
      subledgerMinor: 0,
      controlAccountMinor: 0,
      differenceMinor: 0,
      reconciled: true,
    });
    expect(trialBalance.balanced).toBe(true);
    expect(csv).toContain(conversion.studentProfile.studentProfileId);
    expect(csv).toContain(invoice.id);
    expect(csv).toContain(payment!.id);
  });
});
