/*
THESIS: A school day should read as one traceable operating record, not a pile of disconnected software cards.
OWN-WORLD: Institutional ink, bright paper, teal actions, ruled ledger lines, precise status surfaces and one animated day marker.
STORY: The visitor recognizes fragmented work, sees every school domain join one governed record, compares rollout plans and opens the product preview.
FIRST VIEWPORT: A decisive headline and two actions sit beside a full-height illustrative campus-day ledger that makes the product mechanism visible immediately.
FORM: The school-day operating ledger is grounded structure five, staged as a vertical operational sweep in the existing “Operational Ledger” identity; seed f1149923.
*/

import React, { useState } from 'react';

type CapabilityGroup = {
  id: string;
  label: string;
  title: string;
  description: string;
  features: string[];
  evidence: string;
};

const capabilityGroups: CapabilityGroup[] = [
  {
    id: 'student-journey',
    label: 'Student journey',
    title: 'From first enquiry to alumni record',
    description:
      'Keep the applicant, student, household and enrollment history connected without duplicating the same person across departments.',
    features: [
      'Admissions CRM, forms, documents, interviews and offers',
      'One canonical person record with guardian relationships',
      'Enrollment, transfer, withdrawal and graduation history',
      'Certificates, letters, records requests and data-quality checks',
    ],
    evidence: 'Every status change retains its effective date, reason and audit history.',
  },
  {
    id: 'academics',
    label: 'Academics',
    title: 'Plan, teach, assess and publish with confidence',
    description:
      'Connect curriculum, classes, timetables, attendance and results so teachers work quickly while academic history remains stable.',
    features: [
      'Curriculum frameworks, courses, classes and teacher assignments',
      'Conflict-aware timetables, substitutions and publication controls',
      'Offline-safe attendance with duplicate-resistant synchronization',
      'Gradebook, moderation, report cards, transcripts and GPA policies',
    ],
    evidence: 'Published results are versioned; corrections preserve the original evidence.',
  },
  {
    id: 'finance',
    label: 'Fees & finance',
    title: 'Trace every balance back to its source',
    description:
      'Move from fee schedules to receipts, refunds and financial statements without hidden calculations or destructive journal edits.',
    features: [
      'Fee schedules, invoices, discounts, payment plans and statements',
      'Cash, bank, card and online payment allocation',
      'Refunds, reversals, aging and reconciliation workflows',
      'Immutable double-entry ledger and source-to-journal drill-down',
    ],
    evidence: 'Corrections use reversals and approvals instead of silently replacing history.',
  },
  {
    id: 'operations',
    label: 'School operations',
    title: 'Run the services around every classroom',
    description:
      'Bring staff, purchasing, assets and campus services into the same permission-aware operating model.',
    features: [
      'Staff records, contracts, leave, qualifications and workload links',
      'Procurement, vendors, inventory, assets and maintenance history',
      'Library catalog, loans, reservations, fines and barcode workflows',
      'Transport, residential, cafeteria, activities and trip operations',
    ],
    evidence:
      'Approvals, hand-offs and asset movements remain attributable to the responsible role.',
  },
  {
    id: 'care-governance',
    label: 'Care & governance',
    title: 'Protect sensitive context without losing continuity',
    description:
      'Give authorized teams the context they need while keeping health, wellbeing, learning-support and safeguarding records purpose-bound.',
    features: [
      'Health conditions, medications, care plans and clinic visits',
      'Behavior, wellbeing and learning-support workflows',
      'Restricted safeguarding case membership and controlled disclosure',
      'Purpose-based access, field masking and complete read evidence',
    ],
    evidence:
      'Broad school administration access never automatically reveals restricted care records.',
  },
  {
    id: 'international',
    label: 'International & open',
    title: 'Configure the country. Keep one core platform.',
    description:
      'Support different calendars, curricula, languages and integrations without creating a fragile custom fork for every school.',
    features: [
      'Country and curriculum packs with locale-aware documents',
      'Multilingual, RTL, currency, date and numbering support',
      'OpenAPI, webhooks, OneRoster, LTI, SSO and external identifiers',
      'Migration studio with validation, dry-runs and reconciliation',
    ],
    evidence:
      'Configuration extends the platform through governed contracts rather than private database edits.',
  },
];

const dayEvents = [
  {
    time: '07:40',
    area: 'Attendance',
    title: 'Morning rosters ready',
    detail: 'Offline capture enabled for 18 illustrative classes',
    status: 'Ready',
    tone: 'success',
  },
  {
    time: '08:10',
    area: 'Admissions',
    title: 'Applications need review',
    detail: 'Documents and duplicate checks grouped in one queue',
    status: 'Action',
    tone: 'warning',
  },
  {
    time: '09:30',
    area: 'Finance',
    title: 'Collections review prepared',
    detail: 'Balances link to invoices, allocations and ledger entries',
    status: 'Traceable',
    tone: 'information',
  },
  {
    time: '11:00',
    area: 'Student care',
    title: 'Restricted case review',
    detail: 'Purpose and approval checked before access is granted',
    status: 'Protected',
    tone: 'protected',
  },
  {
    time: '14:15',
    area: 'Transport',
    title: 'Route changes published',
    detail: 'Affected families receive the authorized update',
    status: 'Published',
    tone: 'success',
  },
];

const plans = [
  {
    name: 'Essential',
    price: '৳12,000',
    cadence: '/month',
    audience: 'For one campus with up to 500 active students',
    description:
      'Start with the daily student, academic and fee workflows that replace spreadsheets fastest.',
    features: [
      'Student and guardian records',
      'Admissions and enrollment',
      'Attendance, timetable and gradebook',
      'Fees, receipts and standard reports',
      'Admin, teacher and family access',
      'Email support and guided setup',
    ],
    cta: 'Explore Essential',
  },
  {
    name: 'Professional',
    price: '৳28,000',
    cadence: '/month',
    audience: 'For growing schools with up to 1,500 active students',
    description:
      'Connect the full school office, financial controls and operational services on one platform.',
    features: [
      'Everything in Essential',
      'Double-entry accounting and reconciliation',
      'HR, procurement, inventory and library',
      'Transport, activities and student support',
      'Advanced reports, API and webhooks',
      'Priority support and rollout reviews',
    ],
    cta: 'Explore Professional',
    recommended: true,
  },
  {
    name: 'School Group',
    price: 'Custom',
    cadence: '',
    audience: 'For multi-campus organizations and international groups',
    description:
      'Central governance with campus autonomy, enterprise identity and a tailored migration programme.',
    features: [
      'Multiple campuses and legal entities',
      'Central policies with campus overrides',
      'SSO, SCIM and advanced assurance controls',
      'Consolidated reporting and integrations',
      'Dedicated migration and success plan',
      'Optional regional deployment and SLA',
    ],
    cta: 'Plan a group rollout',
  },
];

const faqs = [
  {
    question: 'Can we migrate from spreadsheets or another school system?',
    answer:
      'Yes. The migration workflow supports mapped imports, validation, dry-runs and reconciliation before records become authoritative. The final scope depends on the quality and history of the source data.',
  },
  {
    question: 'Can one organization manage multiple campuses?',
    answer:
      'Yes. School groups can share governance, identity and reporting while campuses retain their own calendars, policies, operations and permission scopes.',
  },
  {
    question: 'Will attendance work with an unreliable connection?',
    answer:
      'The platform is designed for offline-safe attendance drafts and idempotent synchronization, so a retry does not create duplicate submissions.',
  },
  {
    question: 'Can we connect our LMS, payment gateway or identity provider?',
    answer:
      'The integration layer includes OpenAPI, webhooks, external identifiers, OneRoster, LTI and SSO contracts. Provider-specific implementation is confirmed during discovery.',
  },
  {
    question: 'What is included in onboarding?',
    answer:
      'Configuration, migration planning, import templates, role setup and team training are scoped once the school structure and source data are reviewed. One-time onboarding starts from ৳60,000.',
  },
  {
    question: 'Are SMS, payment and third-party provider fees included?',
    answer:
      'No. Subscription pricing covers the platform. Transactional SMS, payment processing, biometric devices and other provider charges are billed by their respective providers.',
  },
];

function CheckIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4 10 3.5 3.5L16 5.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ArrowIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PlatformMark(): React.JSX.Element {
  return (
    <span className="marketing-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function MarketingHeader(): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="marketing-header">
      <div className="marketing-container marketing-header__inner">
        <a className="marketing-brand" href="#top" aria-label="International School Platform home">
          <PlatformMark />
          <span>
            International School
            <strong>Platform</strong>
          </span>
        </a>
        <button
          className="marketing-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="marketing-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">Toggle navigation</span>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <nav
          id="marketing-navigation"
          className="marketing-navigation"
          data-open={menuOpen ? 'true' : 'false'}
          aria-label="Marketing navigation"
        >
          <a href="#platform" onClick={() => setMenuOpen(false)}>
            Platform
          </a>
          <a href="#teams" onClick={() => setMenuOpen(false)}>
            For your team
          </a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>
            Pricing
          </a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>
            FAQ
          </a>
          <a className="marketing-navigation__signin" href="/app">
            Product preview
          </a>
          <a className="button button--small" href="#pricing" onClick={() => setMenuOpen(false)}>
            View plans
          </a>
        </nav>
      </div>
    </header>
  );
}

function DayLedger(): React.JSX.Element {
  return (
    <div className="day-ledger" aria-label="Illustrative school-day operations timeline">
      <div className="day-ledger__header">
        <div>
          <span>Illustrative workspace</span>
          <strong>North Campus · Monday</strong>
        </div>
        <div className="day-ledger__sync">
          <span aria-hidden="true" />
          Synced 07:39
        </div>
      </div>
      <div className="day-ledger__summary">
        <div>
          <span>Operating scope</span>
          <strong>Whole school</strong>
        </div>
        <div>
          <span>Records needing action</span>
          <strong>Defined by source</strong>
        </div>
      </div>
      <ol className="day-ledger__events">
        {dayEvents.map((event, index) => (
          <li key={`${event.time}-${event.area}`}>
            <time>{event.time}</time>
            <span className="day-ledger__rail" aria-hidden="true">
              <span className={index === 1 ? 'is-current' : ''} />
            </span>
            <div className="day-ledger__event-copy">
              <span>{event.area}</span>
              <strong>{event.title}</strong>
              <p>{event.detail}</p>
            </div>
            <span className={`status status--${event.tone}`}>{event.status}</span>
          </li>
        ))}
      </ol>
      <div className="day-ledger__footer">
        <span>One record</span>
        <span>Permission aware</span>
        <span>History preserved</span>
      </div>
    </div>
  );
}

function CapabilityExplorer(): React.JSX.Element {
  const firstGroup = capabilityGroups[0]!;
  const [activeId, setActiveId] = useState(firstGroup.id);
  const activeGroup = capabilityGroups.find((group) => group.id === activeId) ?? firstGroup;

  return (
    <div className="capability-explorer">
      <div
        className="capability-explorer__tabs"
        role="group"
        aria-label="Platform capability groups"
      >
        {capabilityGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            aria-pressed={activeId === group.id}
            onClick={() => setActiveId(group.id)}
          >
            <span>{String(capabilityGroups.indexOf(group) + 1).padStart(2, '0')}</span>
            {group.label}
          </button>
        ))}
      </div>
      <div className="capability-explorer__panel" aria-live="polite" tabIndex={0}>
        <div className="capability-explorer__intro">
          <span>{activeGroup.label}</span>
          <h3>{activeGroup.title}</h3>
          <p>{activeGroup.description}</p>
        </div>
        <ul>
          {activeGroup.features.map((feature) => (
            <li key={feature}>
              <CheckIcon />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <div className="capability-explorer__evidence">
          <span>Governance built in</span>
          <p>{activeGroup.evidence}</p>
        </div>
      </div>
    </div>
  );
}

function PricingSection(): React.JSX.Element {
  return (
    <section
      className="marketing-section pricing-section"
      id="pricing"
      aria-labelledby="pricing-title"
    >
      <div className="marketing-container">
        <div className="section-heading section-heading--split">
          <div>
            <span className="section-kicker">Recommended launch pricing</span>
            <h2 id="pricing-title">Scale with active students, not staff logins.</h2>
          </div>
          <p>
            Every plan includes unlimited role-based users. Pay annually and receive two months
            free. Final pricing is confirmed after school structure and migration scope are
            reviewed.
          </p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article
              className="pricing-plan"
              data-recommended={plan.recommended ? 'true' : 'false'}
              key={plan.name}
            >
              {plan.recommended ? <span className="pricing-plan__flag">Recommended</span> : null}
              <div className="pricing-plan__heading">
                <span>{plan.name}</span>
                <div className="pricing-plan__price">
                  <strong>{plan.price}</strong>
                  <span>{plan.cadence}</span>
                </div>
                <p>{plan.audience}</p>
              </div>
              <p className="pricing-plan__description">{plan.description}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a className={plan.recommended ? 'button' : 'button button--secondary'} href="/app">
                {plan.cta}
                <ArrowIcon />
              </a>
            </article>
          ))}
        </div>
        <div className="pricing-note">
          <div>
            <span>One-time onboarding</span>
            <strong>From ৳60,000</strong>
          </div>
          <p>
            Includes configuration workshops, migration planning, import templates, permission setup
            and team training. Complex historical migration and custom integrations are quoted
            separately.
          </p>
        </div>
      </div>
    </section>
  );
}

export function MarketingLandingPage(): React.JSX.Element {
  return (
    <div className="marketing-page" id="top">
      <a className="skip-link marketing-skip-link" href="#marketing-main">
        Skip to main content
      </a>
      <MarketingHeader />
      <main id="marketing-main">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="marketing-container hero-section__grid">
            <div className="hero-copy">
              <div className="hero-copy__label">
                <span aria-hidden="true" />
                International K–12 school operating system
              </div>
              <h1 id="hero-title">One operating record for the whole school.</h1>
              <p>
                Run admissions, academics, fees, finance, staff and school services on one governed
                platform—without losing the history behind every change.
              </p>
              <div className="hero-copy__actions">
                <a className="button button--large" href="/app">
                  Open product preview
                  <ArrowIcon />
                </a>
                <a className="text-link" href="#platform">
                  Explore the platform
                  <ArrowIcon />
                </a>
              </div>
              <div className="hero-copy__fit">
                <span>Designed for</span>
                <p>
                  K–12 schools · Multi-campus groups · International curricula · Weak-network
                  environments
                </p>
              </div>
            </div>
            <DayLedger />
          </div>
        </section>

        <section className="trust-rail" aria-label="Platform principles">
          <div className="marketing-container trust-rail__inner">
            <div>
              <strong>One person record</strong>
              <span>Students and families stay connected across departments.</span>
            </div>
            <div>
              <strong>Traceable finance</strong>
              <span>Every balance links to its source and accounting entry.</span>
            </div>
            <div>
              <strong>Offline-aware work</strong>
              <span>Attendance survives weak connections and safe retries.</span>
            </div>
            <div>
              <strong>International by design</strong>
              <span>Language, curriculum and country differences are configurable.</span>
            </div>
          </div>
        </section>

        <section className="marketing-section problem-section" aria-labelledby="problem-title">
          <div className="marketing-container problem-section__grid">
            <div className="section-heading section-heading--sticky">
              <span className="section-kicker">The operating problem</span>
              <h2 id="problem-title">
                A school should not need five systems to answer one question.
              </h2>
              <p>
                When admissions, attendance, billing and student support live apart, teams re-enter
                data, totals lose context and important history becomes difficult to prove.
              </p>
            </div>
            <div className="record-comparison">
              <div className="record-comparison__fragmented">
                <span>Fragmented today</span>
                <div>
                  <strong>Student identity</strong>
                  <p>Repeated in admissions, finance and academic sheets</p>
                </div>
                <div>
                  <strong>Fee balance</strong>
                  <p>A number without the invoice, allocation or journal trail</p>
                </div>
                <div>
                  <strong>Attendance correction</strong>
                  <p>Changed without a reason, approval or reliable history</p>
                </div>
              </div>
              <div className="record-comparison__connector" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="record-comparison__governed">
                <span>One governed record</span>
                <dl>
                  <div>
                    <dt>Person and household</dt>
                    <dd>Canonical identity with verified relationships</dd>
                  </div>
                  <div>
                    <dt>Enrollment and academics</dt>
                    <dd>Effective-dated status, classes and published history</dd>
                  </div>
                  <div>
                    <dt>Fees and accounting</dt>
                    <dd>Source document, payment allocation and immutable journal</dd>
                  </div>
                  <div>
                    <dt>Permissions and audit</dt>
                    <dd>Purpose, scope, approval and disclosure evidence</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        <section
          className="marketing-section platform-section"
          id="platform"
          aria-labelledby="platform-title"
        >
          <div className="marketing-container">
            <div className="section-heading section-heading--split">
              <div>
                <span className="section-kicker">One modular platform</span>
                <h2 id="platform-title">Every school domain, joined by governed contracts.</h2>
              </div>
              <p>
                Activate the capabilities your school needs now. Add new modules later without
                breaking the records, permissions and reporting already in place.
              </p>
            </div>
            <CapabilityExplorer />
          </div>
        </section>

        <section className="marketing-section reality-section" aria-labelledby="reality-title">
          <div className="marketing-container">
            <div className="section-heading">
              <span className="section-kicker">Designed for the real school day</span>
              <h2 id="reality-title">
                Fast where work is concentrated. Careful where history matters.
              </h2>
            </div>
            <div className="reality-rows">
              <article>
                <div className="reality-rows__number">07:45</div>
                <div>
                  <span>Morning attendance</span>
                  <h3>Teachers record the room, not the network condition.</h3>
                  <p>
                    Touch-friendly rosters, clear attendance codes and offline-safe drafts keep the
                    morning moving. Idempotent synchronization prevents duplicate submissions during
                    recovery.
                  </p>
                </div>
                <div className="attendance-demo" aria-label="Illustrative attendance roster">
                  <div>
                    <span>Class 7A · Homeroom</span>
                    <strong>Draft saved on device</strong>
                  </div>
                  <ul>
                    <li>
                      <span>Amira Rahman</span>
                      <strong>Present</strong>
                    </li>
                    <li>
                      <span>Kenji Mori</span>
                      <strong>Present</strong>
                    </li>
                    <li>
                      <span>Leila Haddad</span>
                      <strong>Late · reason required</strong>
                    </li>
                  </ul>
                </div>
              </article>
              <article>
                <div className="reality-rows__number">11:20</div>
                <div>
                  <span>Finance and reporting</span>
                  <h3>A total is useful only when the school can explain it.</h3>
                  <p>
                    Metrics carry definitions, scope, source and refresh context. Finance teams can
                    move from a balance to invoices, payments, allocations and journal entries
                    without a spreadsheet detour.
                  </p>
                </div>
                <div className="trace-demo" aria-label="Illustrative traceable balance">
                  <div>
                    <span>Family balance</span>
                    <strong>৳84,500</strong>
                  </div>
                  <ol>
                    <li>
                      <span>Tuition invoice</span>
                      <strong>৳100,000</strong>
                    </li>
                    <li>
                      <span>Scholarship credit</span>
                      <strong>−৳10,000</strong>
                    </li>
                    <li>
                      <span>Payment allocated</span>
                      <strong>−৳5,500</strong>
                    </li>
                  </ol>
                  <p>Illustrative values · each line opens its source record</p>
                </div>
              </article>
              <article>
                <div className="reality-rows__number">15:10</div>
                <div>
                  <span>Sensitive student support</span>
                  <h3>The right context reaches the right professional—and no further.</h3>
                  <p>
                    Health, wellbeing, learning-support and safeguarding workflows use stricter
                    purpose, membership and disclosure controls than ordinary administration
                    records.
                  </p>
                </div>
                <div className="access-demo" aria-label="Illustrative restricted access decision">
                  <span>Access decision</span>
                  <strong>Additional assurance required</strong>
                  <dl>
                    <div>
                      <dt>Role</dt>
                      <dd>Safeguarding lead</dd>
                    </div>
                    <div>
                      <dt>Purpose</dt>
                      <dd>Scheduled case review</dd>
                    </div>
                    <div>
                      <dt>Evidence</dt>
                      <dd>Read event recorded</dd>
                    </div>
                  </dl>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section
          className="marketing-section teams-section"
          id="teams"
          aria-labelledby="teams-title"
        >
          <div className="marketing-container teams-section__grid">
            <div className="section-heading">
              <span className="section-kicker">Permission-aware by role</span>
              <h2 id="teams-title">The same school. The right view for every person.</h2>
              <p>
                Teams work from shared records, but each experience respects role, campus,
                relationship, purpose and publication state.
              </p>
            </div>
            <div className="role-ledger">
              <div>
                <span>School leadership</span>
                <strong>Exceptions, decisions and traceable drill-down</strong>
                <p>
                  See enrollment, attendance, finance and operations in context—then act at the
                  source.
                </p>
              </div>
              <div>
                <span>Teachers</span>
                <strong>Classes, attendance, assessment and communication</strong>
                <p>Complete high-frequency work quickly from desktop, tablet or phone.</p>
              </div>
              <div>
                <span>Finance teams</span>
                <strong>Charges, collections, reconciliation and ledgers</strong>
                <p>Preserve financial history from source transaction to statement.</p>
              </div>
              <div>
                <span>Families and students</span>
                <strong>Authorized information in one clear portal</strong>
                <p>
                  View attendance, published results, fees, forms, documents and school
                  communication.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section migration-section" aria-labelledby="migration-title">
          <div className="marketing-container migration-section__inner">
            <div>
              <span className="section-kicker">Change systems without losing the record</span>
              <h2 id="migration-title">A migration programme, not a blind import.</h2>
              <p>
                Map source fields, validate identities and relationships, run dry-runs, review
                reconciliation results and move authoritative data only when the school is ready.
              </p>
              <a className="text-link text-link--light" href="#pricing">
                See rollout options
                <ArrowIcon />
              </a>
            </div>
            <ol className="migration-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>Discover</strong>
                  <p>Structure, policies, source systems and data quality.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Map</strong>
                  <p>People, relationships, identifiers, balances and history.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Rehearse</strong>
                  <p>Dry-run imports, validation and reconciliation evidence.</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <strong>Launch</strong>
                  <p>Controlled cutover, training, recovery and support review.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <PricingSection />

        <section className="marketing-section faq-section" id="faq" aria-labelledby="faq-title">
          <div className="marketing-container faq-section__grid">
            <div className="section-heading section-heading--sticky">
              <span className="section-kicker">Questions schools ask first</span>
              <h2 id="faq-title">Clear answers before a rollout begins.</h2>
              <p>
                Pricing and implementation should become more precise as the school’s scope becomes
                clearer.
              </p>
            </div>
            <div className="faq-list">
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0}>
                  <summary>
                    <span>{faq.question}</span>
                    <span aria-hidden="true" />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="closing-section" aria-labelledby="closing-title">
          <div className="marketing-container closing-section__inner">
            <div>
              <span>Ready to see the operating record?</span>
              <h2 id="closing-title">Start with the school day you need to simplify first.</h2>
            </div>
            <div>
              <p>
                Explore the current product shell, then use the pricing framework to plan a phased
                rollout around your students, campuses and migration needs.
              </p>
              <div>
                <a className="button button--light" href="/app">
                  Open product preview
                  <ArrowIcon />
                </a>
                <a className="text-link text-link--light" href="#pricing">
                  Review pricing
                  <ArrowIcon />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="marketing-footer">
        <div className="marketing-container marketing-footer__inner">
          <a className="marketing-brand marketing-brand--footer" href="#top">
            <PlatformMark />
            <span>
              International School
              <strong>Platform</strong>
            </span>
          </a>
          <p>Governed school operations across students, academics, finance and services.</p>
          <nav aria-label="Footer navigation">
            <a href="#platform">Platform</a>
            <a href="#teams">For your team</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
            <a href="/app">Product preview</a>
          </nav>
          <small>
            © 2026 International School Platform. Pricing shown in BDT and subject to rollout scope.
          </small>
        </div>
      </footer>
    </div>
  );
}
