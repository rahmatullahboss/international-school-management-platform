import {
  assertIdentifier,
  authorizeOperations,
  createOperationsAudit,
  createOperationsEvent,
  type OperationsAuditWriter,
  type OperationsEventPublisher,
  type OperationsPrincipal,
  type OperationsScope,
} from '../../hr/src/index.js';

export type PatronType = 'student' | 'staff' | 'guardian' | 'external';
export type CopyStatus = 'available' | 'on-loan' | 'on-hold' | 'lost' | 'damaged' | 'withdrawn';
export type LoanStatus = 'active' | 'returned' | 'lost';
export type HoldStatus = 'active' | 'ready' | 'fulfilled' | 'cancelled' | 'expired';

export interface LibraryTitleInput {
  readonly id: string;
  readonly isbn: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly subjectCodes: readonly string[];
  readonly publisher: string;
  readonly publicationYear: number;
  readonly language: string;
}
export interface LibraryTitle extends LibraryTitleInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface LibraryCopyInput {
  readonly id: string;
  readonly titleId: string;
  readonly barcode: string;
  readonly homeLocationRef: string;
  readonly replacementCostMinor: number;
  readonly currency: string;
}
export interface LibraryCopy extends LibraryCopyInput {
  readonly status: CopyStatus;
  readonly version: number;
  readonly createdAt: string;
}

export interface LibraryPatronInput {
  readonly id: string;
  readonly personRef: string;
  readonly patronType: PatronType;
  readonly displayName: string;
  readonly active: boolean;
}
export interface LibraryPatron extends LibraryPatronInput {
  readonly version: number;
  readonly createdAt: string;
}

export interface CheckoutInput {
  readonly id: string;
  readonly copyId: string;
  readonly patronId: string;
  readonly checkedOutAt: string;
}
export interface LibraryLoan extends CheckoutInput {
  readonly dueAt: string;
  readonly returnedAt: string | null;
  readonly renewals: number;
  readonly status: LoanStatus;
  readonly fineMinor: number;
  readonly version: number;
  readonly createdBy: string;
}

export interface HoldInput {
  readonly id: string;
  readonly titleId: string;
  readonly patronId: string;
  readonly placedAt: string;
}
export interface LibraryHold extends HoldInput {
  readonly status: HoldStatus;
  readonly readyCopyId: string | null;
  readonly version: number;
  readonly createdBy: string;
}

export interface LibraryFineSourceDocument {
  readonly contractVersion: '1.0';
  readonly tenantId: string;
  readonly legalEntityId: string;
  readonly campusId: string;
  readonly sourceType: 'library-overdue' | 'library-lost' | 'library-damaged';
  readonly sourceId: string;
  readonly patronRef: string;
  readonly copyRef: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
}
export interface LibraryFineGateway {
  submitFineSource(document: LibraryFineSourceDocument): string;
}
export class InMemoryLibraryFineGateway implements LibraryFineGateway {
  readonly #documents: LibraryFineSourceDocument[] = [];
  readonly #refs = new Map<string, string>();
  get documents(): readonly LibraryFineSourceDocument[] {
    return Object.freeze([...this.#documents]);
  }
  submitFineSource(document: LibraryFineSourceDocument): string {
    const existing = this.#refs.get(document.idempotencyKey);
    if (existing) return existing;
    const ref = `fin-library:${document.sourceId}`;
    this.#documents.push(Object.freeze({ ...document }));
    this.#refs.set(document.idempotencyKey, ref);
    return ref;
  }
}

export interface LibraryReport {
  readonly titles: number;
  readonly copies: number;
  readonly availableCopies: number;
  readonly activeLoans: number;
  readonly overdueLoans: number;
  readonly activeHolds: number;
  readonly lostCopies: number;
  readonly overdueLoanIds: readonly string[];
}

interface Clock {
  now(): Date;
}
const systemClock: Clock = { now: () => new Date() };
const policies: Record<
  PatronType,
  { loanDays: number; maxLoans: number; renewalLimit: number; dailyFineMinor: number }
> = {
  student: { loanDays: 14, maxLoans: 5, renewalLimit: 2, dailyFineMinor: 100 },
  staff: { loanDays: 28, maxLoans: 10, renewalLimit: 3, dailyFineMinor: 100 },
  guardian: { loanDays: 14, maxLoans: 3, renewalLimit: 1, dailyFineMinor: 100 },
  external: { loanDays: 7, maxLoans: 2, renewalLimit: 0, dailyFineMinor: 200 },
};
function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}
function timestamp(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`OPS_INVALID_TIMESTAMP:${field}`);
  return date;
}
function addDays(value: string, days: number): string {
  const date = timestamp(value, 'date');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export class LibraryService {
  readonly #scope: OperationsScope;
  readonly #events: OperationsEventPublisher;
  readonly #audit: OperationsAuditWriter;
  readonly #fines: LibraryFineGateway;
  readonly #clock: Clock;
  readonly #titles = new Map<string, LibraryTitle>();
  readonly #isbns = new Set<string>();
  readonly #copies = new Map<string, LibraryCopy>();
  readonly #barcodes = new Set<string>();
  readonly #patrons = new Map<string, LibraryPatron>();
  readonly #personRefs = new Set<string>();
  readonly #loans = new Map<string, LibraryLoan>();
  readonly #holds = new Map<string, LibraryHold>();

  constructor(
    scope: OperationsScope,
    events: OperationsEventPublisher,
    audit: OperationsAuditWriter,
    fines: LibraryFineGateway,
    clock: Clock = systemClock,
  ) {
    this.#scope = frozen(scope);
    this.#events = events;
    this.#audit = audit;
    this.#fines = fines;
    this.#clock = clock;
  }

  registerTitle(
    input: LibraryTitleInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): LibraryTitle {
    authorizeOperations(principal, 'operations.library.catalog.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      isbn: input.isbn,
      title: input.title,
      publisher: input.publisher,
      language: input.language,
    }))
      assertIdentifier(value, `libraryTitle.${field}`);
    if (
      !Number.isInteger(input.publicationYear) ||
      input.publicationYear < 1000 ||
      input.publicationYear > 9999
    ) {
      throw new Error('OPS_INVALID_PUBLICATION_YEAR');
    }
    if (input.authors.length === 0) throw new Error('OPS_LIBRARY_AUTHOR_REQUIRED');
    const isbn = input.isbn.replaceAll('-', '');
    if (this.#titles.has(input.id) || this.#isbns.has(isbn))
      throw new Error('OPS_DUPLICATE_LIBRARY_TITLE');
    const title: LibraryTitle = frozen({
      ...input,
      isbn,
      authors: Object.freeze([...input.authors]),
      subjectCodes: Object.freeze([...input.subjectCodes]),
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#titles.set(title.id, title);
    this.#isbns.add(title.isbn);
    this.#record(
      'operations.library.title-registered.v1',
      'library-title',
      title.id,
      1,
      'operations.library.title.register',
      principal,
      correlationId,
      { isbn },
    );
    return title;
  }

  registerCopy(
    input: LibraryCopyInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): LibraryCopy {
    authorizeOperations(principal, 'operations.library.copy.write', this.#scope);
    this.#correlation(correlationId);
    this.#requireTitle(input.titleId);
    for (const [field, value] of Object.entries({
      id: input.id,
      barcode: input.barcode,
      homeLocationRef: input.homeLocationRef,
      currency: input.currency,
    }))
      assertIdentifier(value, `libraryCopy.${field}`);
    if (!Number.isSafeInteger(input.replacementCostMinor) || input.replacementCostMinor < 0) {
      throw new Error('OPS_INVALID_MONEY:replacementCostMinor');
    }
    const barcode = input.barcode.trim().toUpperCase();
    if (this.#copies.has(input.id) || this.#barcodes.has(barcode))
      throw new Error('OPS_DUPLICATE_LIBRARY_COPY');
    const copy: LibraryCopy = frozen({
      ...input,
      barcode,
      status: 'available',
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#copies.set(copy.id, copy);
    this.#barcodes.add(copy.barcode);
    this.#record(
      'operations.library.copy-registered.v1',
      'library-copy',
      copy.id,
      1,
      'operations.library.copy.register',
      principal,
      correlationId,
      { titleId: copy.titleId, barcode },
    );
    return copy;
  }

  registerPatron(
    input: LibraryPatronInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): LibraryPatron {
    authorizeOperations(principal, 'operations.library.patron.write', this.#scope);
    this.#correlation(correlationId);
    for (const [field, value] of Object.entries({
      id: input.id,
      personRef: input.personRef,
      displayName: input.displayName,
    })) {
      assertIdentifier(value, `libraryPatron.${field}`);
    }
    if (this.#patrons.has(input.id) || this.#personRefs.has(input.personRef))
      throw new Error('OPS_DUPLICATE_LIBRARY_PATRON');
    const patron: LibraryPatron = frozen({
      ...input,
      version: 1,
      createdAt: this.#clock.now().toISOString(),
    });
    this.#patrons.set(patron.id, patron);
    this.#personRefs.add(patron.personRef);
    this.#record(
      'operations.library.patron-registered.v1',
      'library-patron',
      patron.id,
      1,
      'operations.library.patron.register',
      principal,
      correlationId,
      { personRef: patron.personRef },
    );
    return patron;
  }

  checkout(
    input: CheckoutInput,
    principal: OperationsPrincipal,
    correlationId: string,
  ): LibraryLoan {
    authorizeOperations(principal, 'operations.library.circulation.write', this.#scope);
    this.#correlation(correlationId);
    const copy = this.#requireCopy(input.copyId);
    const patron = this.#requirePatron(input.patronId);
    if (!patron.active) throw new Error('OPS_LIBRARY_PATRON_INACTIVE');
    if (!['available', 'on-hold'].includes(copy.status))
      throw new Error('OPS_LIBRARY_COPY_UNAVAILABLE');
    const priorityHold = this.#nextHold(copy.titleId);
    if (priorityHold && priorityHold.patronId !== patron.id)
      throw new Error('OPS_LIBRARY_HOLD_PRIORITY');
    const activeLoans = [...this.#loans.values()].filter(
      (loan) => loan.patronId === patron.id && loan.status === 'active',
    ).length;
    const policy = policies[patron.patronType];
    if (activeLoans >= policy.maxLoans) throw new Error('OPS_LIBRARY_LOAN_LIMIT');
    assertIdentifier(input.id, 'libraryLoan.id');
    timestamp(input.checkedOutAt, 'libraryLoan.checkedOutAt');
    if (this.#loans.has(input.id)) throw new Error('OPS_DUPLICATE_LIBRARY_LOAN');
    const loan: LibraryLoan = frozen({
      ...input,
      dueAt: addDays(input.checkedOutAt, policy.loanDays),
      returnedAt: null,
      renewals: 0,
      status: 'active',
      fineMinor: 0,
      version: 1,
      createdBy: principal.principalId,
    });
    this.#loans.set(loan.id, loan);
    this.#copies.set(copy.id, frozen({ ...copy, status: 'on-loan', version: copy.version + 1 }));
    if (priorityHold)
      this.#holds.set(
        priorityHold.id,
        frozen({
          ...priorityHold,
          status: 'fulfilled',
          readyCopyId: copy.id,
          version: priorityHold.version + 1,
        }),
      );
    this.#record(
      'operations.library.copy-checked-out.v1',
      'library-loan',
      loan.id,
      1,
      'operations.library.checkout',
      principal,
      correlationId,
      { copyId: copy.id, patronId: patron.id, dueAt: loan.dueAt },
    );
    return loan;
  }

  renewLoan(loanId: string, principal: OperationsPrincipal, correlationId: string): LibraryLoan {
    authorizeOperations(principal, 'operations.library.circulation.write', this.#scope);
    const loan = this.#requireLoan(loanId);
    if (loan.status !== 'active') throw new Error('OPS_LIBRARY_LOAN_NOT_ACTIVE');
    const copy = this.#requireCopy(loan.copyId);
    if (this.#nextHold(copy.titleId)) throw new Error('OPS_LIBRARY_RENEWAL_BLOCKED_BY_HOLD');
    const patron = this.#requirePatron(loan.patronId);
    const policy = policies[patron.patronType];
    if (loan.renewals >= policy.renewalLimit) throw new Error('OPS_LIBRARY_RENEWAL_LIMIT');
    const renewed: LibraryLoan = frozen({
      ...loan,
      dueAt: addDays(loan.dueAt, policy.loanDays),
      renewals: loan.renewals + 1,
      version: loan.version + 1,
    });
    this.#loans.set(renewed.id, renewed);
    this.#record(
      'operations.library.loan-renewed.v1',
      'library-loan',
      renewed.id,
      renewed.version,
      'operations.library.loan.renew',
      principal,
      correlationId,
      { dueAt: renewed.dueAt, renewals: renewed.renewals },
    );
    return renewed;
  }

  returnCopy(
    input: {
      readonly loanId: string;
      readonly returnedAt: string;
      readonly condition: 'good' | 'damaged';
    },
    principal: OperationsPrincipal,
    correlationId: string,
  ): LibraryLoan {
    authorizeOperations(principal, 'operations.library.circulation.write', this.#scope);
    const loan = this.#requireLoan(input.loanId);
    if (loan.status !== 'active') return loan;
    const returnedAt = timestamp(input.returnedAt, 'libraryReturn.returnedAt');
    const dueAt = timestamp(loan.dueAt, 'libraryLoan.dueAt');
    const patron = this.#requirePatron(loan.patronId);
    const copy = this.#requireCopy(loan.copyId);
    const overdueDays = Math.max(
      0,
      Math.ceil((returnedAt.getTime() - dueAt.getTime()) / 86_400_000),
    );
    const fineMinor = overdueDays * policies[patron.patronType].dailyFineMinor;
    const returned: LibraryLoan = frozen({
      ...loan,
      returnedAt: returnedAt.toISOString(),
      status: 'returned',
      fineMinor,
      version: loan.version + 1,
    });
    this.#loans.set(returned.id, returned);
    const nextHold = this.#nextHold(copy.titleId);
    this.#copies.set(
      copy.id,
      frozen({
        ...copy,
        status: input.condition === 'damaged' ? 'damaged' : nextHold ? 'on-hold' : 'available',
        version: copy.version + 1,
      }),
    );
    if (nextHold && input.condition === 'good')
      this.#holds.set(
        nextHold.id,
        frozen({
          ...nextHold,
          status: 'ready',
          readyCopyId: copy.id,
          version: nextHold.version + 1,
        }),
      );
    if (fineMinor > 0)
      this.#submitFine(
        'library-overdue',
        returned.id,
        patron,
        copy,
        fineMinor,
        returnedAt.toISOString(),
        correlationId,
      );
    if (input.condition === 'damaged')
      this.#submitFine(
        'library-damaged',
        returned.id,
        patron,
        copy,
        Math.floor(copy.replacementCostMinor / 2),
        returnedAt.toISOString(),
        correlationId,
      );
    this.#record(
      'operations.library.copy-returned.v1',
      'library-loan',
      returned.id,
      returned.version,
      'operations.library.return',
      principal,
      correlationId,
      { fineMinor, condition: input.condition },
    );
    return returned;
  }

  placeHold(input: HoldInput, principal: OperationsPrincipal, correlationId: string): LibraryHold {
    authorizeOperations(principal, 'operations.library.hold.write', this.#scope);
    this.#correlation(correlationId);
    this.#requireTitle(input.titleId);
    this.#requirePatron(input.patronId);
    assertIdentifier(input.id, 'libraryHold.id');
    timestamp(input.placedAt, 'libraryHold.placedAt');
    if (this.#holds.has(input.id)) throw new Error('OPS_DUPLICATE_LIBRARY_HOLD');
    if (
      [...this.#holds.values()].some(
        (hold) =>
          hold.titleId === input.titleId &&
          hold.patronId === input.patronId &&
          ['active', 'ready'].includes(hold.status),
      )
    ) {
      throw new Error('OPS_DUPLICATE_LIBRARY_HOLD');
    }
    const hold: LibraryHold = frozen({
      ...input,
      status: 'active',
      readyCopyId: null,
      version: 1,
      createdBy: principal.principalId,
    });
    this.#holds.set(hold.id, hold);
    this.#record(
      'operations.library.hold-placed.v1',
      'library-hold',
      hold.id,
      1,
      'operations.library.hold.place',
      principal,
      correlationId,
      { titleId: hold.titleId, patronId: hold.patronId },
    );
    return hold;
  }

  markLost(
    loanId: string,
    lostAt: string,
    principal: OperationsPrincipal,
    correlationId: string,
  ): LibraryLoan {
    authorizeOperations(principal, 'operations.library.loss.write', this.#scope, {
      requireAal2: true,
    });
    const loan = this.#requireLoan(loanId);
    if (loan.status === 'lost') return loan;
    if (loan.status !== 'active') throw new Error('OPS_LIBRARY_LOAN_NOT_ACTIVE');
    const occurredAt = timestamp(lostAt, 'libraryLoss.lostAt').toISOString();
    const copy = this.#requireCopy(loan.copyId);
    const patron = this.#requirePatron(loan.patronId);
    const lost: LibraryLoan = frozen({
      ...loan,
      status: 'lost',
      returnedAt: occurredAt,
      fineMinor: copy.replacementCostMinor,
      version: loan.version + 1,
    });
    this.#loans.set(lost.id, lost);
    this.#copies.set(copy.id, frozen({ ...copy, status: 'lost', version: copy.version + 1 }));
    this.#submitFine(
      'library-lost',
      lost.id,
      patron,
      copy,
      copy.replacementCostMinor,
      occurredAt,
      correlationId,
    );
    this.#record(
      'operations.library.copy-lost.v1',
      'library-loan',
      lost.id,
      lost.version,
      'operations.library.loss.record',
      principal,
      correlationId,
      { copyId: copy.id, replacementCostMinor: copy.replacementCostMinor },
    );
    return lost;
  }

  libraryReport(asOf: string, principal: OperationsPrincipal): LibraryReport {
    authorizeOperations(principal, 'operations.library.report.read', this.#scope);
    const now = timestamp(asOf, 'libraryReport.asOf').getTime();
    const activeLoans = [...this.#loans.values()].filter((loan) => loan.status === 'active');
    const overdue = activeLoans.filter((loan) => Date.parse(loan.dueAt) < now);
    return frozen({
      titles: this.#titles.size,
      copies: this.#copies.size,
      availableCopies: [...this.#copies.values()].filter((copy) => copy.status === 'available')
        .length,
      activeLoans: activeLoans.length,
      overdueLoans: overdue.length,
      activeHolds: [...this.#holds.values()].filter((hold) =>
        ['active', 'ready'].includes(hold.status),
      ).length,
      lostCopies: [...this.#copies.values()].filter((copy) => copy.status === 'lost').length,
      overdueLoanIds: Object.freeze(overdue.map((loan) => loan.id).sort()),
    });
  }

  findTitle(id: string): LibraryTitle | undefined {
    return this.#titles.get(id);
  }
  findCopy(id: string): LibraryCopy | undefined {
    return this.#copies.get(id);
  }
  findPatron(id: string): LibraryPatron | undefined {
    return this.#patrons.get(id);
  }
  findLoan(id: string): LibraryLoan | undefined {
    return this.#loans.get(id);
  }

  #nextHold(titleId: string): LibraryHold | undefined {
    return [...this.#holds.values()]
      .filter((hold) => hold.titleId === titleId && ['active', 'ready'].includes(hold.status))
      .sort(
        (left, right) =>
          left.placedAt.localeCompare(right.placedAt) || left.id.localeCompare(right.id),
      )[0];
  }

  #submitFine(
    sourceType: LibraryFineSourceDocument['sourceType'],
    sourceId: string,
    patron: LibraryPatron,
    copy: LibraryCopy,
    amountMinor: number,
    occurredAt: string,
    correlationId: string,
  ): void {
    if (amountMinor <= 0) return;
    this.#fines.submitFineSource(
      frozen({
        contractVersion: '1.0',
        tenantId: this.#scope.tenantId,
        legalEntityId: this.#scope.legalEntityId,
        campusId: this.#scope.campusId,
        sourceType,
        sourceId,
        patronRef: patron.personRef,
        copyRef: copy.id,
        amountMinor,
        currency: copy.currency,
        occurredAt,
        correlationId,
        idempotencyKey: `${sourceType}:${sourceId}`,
      }),
    );
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
  #correlation(value: string): void {
    assertIdentifier(value, 'correlationId');
  }
  #requireTitle(id: string): LibraryTitle {
    const value = this.#titles.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:library-title');
    return value;
  }
  #requireCopy(id: string): LibraryCopy {
    const value = this.#copies.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:library-copy');
    return value;
  }
  #requirePatron(id: string): LibraryPatron {
    const value = this.#patrons.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:library-patron');
    return value;
  }
  #requireLoan(id: string): LibraryLoan {
    const value = this.#loans.get(id);
    if (!value) throw new Error('OPS_NOT_FOUND:library-loan');
    return value;
  }
}
