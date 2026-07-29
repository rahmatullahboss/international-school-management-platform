# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- School administrators and leaders configure campuses, academic structures, policies and modules; investigate operational, academic and financial exceptions; and require traceable drill-down rather than isolated headline totals.
- Admissions staff process enquiries, applications, forms, documents, reviews, interviews, decisions, offers and conversion to enrollment while resolving duplicate people and incomplete relationships.
- Finance staff and cashiers create and reconcile charges, invoices, payments, credits, refunds and immutable accounting entries.
- Teachers work from desktops, tablets and phones to view assigned classes, take attendance during concentrated morning periods, record assessments and communicate with authorized guardians and students.
- Guardians manage households and multiple children, complete forms and consent, and view authorized attendance, published grades, fees, documents and communications, often on low-cost devices and intermittent networks.
- Students view age-appropriate timetable, attendance, published results, documents, communication and permitted requests.
- Platform and support operators diagnose tenant and deployment health through approved, time-bound and audited workflows without unrestricted access to sensitive student data.

## Product Purpose

The International School Management Platform is a governed K–12 school operating system that combines SIS, academic, finance and school-operations capabilities on one modular data model. It exists so schools can run daily work without fragmented records, hidden calculations, unsafe cross-module access or country-specific core forks.

Success means each principal persona can complete the full daily job through permission-aware interfaces, every operational or financial total can be traced to its definition and source, historical records remain stable, and the platform remains usable across campuses, countries, languages, devices and weak-network conditions.

## Positioning

The product combines relationship-aware student and guardian access, finance-grade immutable accounting, international country/curriculum configuration, open integration and migration tooling, and stricter controls for sensitive student-support records. Reporting is evidence-led: metrics must define their meaning, scope, timestamp and drill-down path rather than appearing as disconnected dashboard numbers.

## Operating Context

- Administration uses dense forms, tables, filters, exception queues, print/export and approval workflows.
- Attendance entry is high-frequency and time-concentrated; offline capture and duplicate-safe replay are required.
- Teachers move between classes and need touch-friendly, small-screen workflows.
- Guardians and students may have intermittent connectivity, limited data plans and shared or low-cost devices.
- Names, identifiers, addresses, calendars, curricula, currencies, grading systems, documents and writing direction vary by country.
- Health, wellbeing, safeguarding and learning-support records require purpose-bound authorization, masked denials, read evidence and controlled disclosure.
- Financial and academic history uses amendment, reversal, versioning and publication controls rather than destructive edits.

## Capabilities and Constraints

- Cloudflare Workers-backed TypeScript web applications with responsive PWA behavior and Neon PostgreSQL.
- Multi-tenant and multi-campus operation with forced row-level security, deny-by-default authorization, scoped permissions and assurance step-up.
- Modular domains communicate through versioned application contracts, commands, events and bounded read models; interfaces never read another module’s private tables directly.
- Country packs, localization, RTL, long-content, CJK, date/number/currency formatting and multilingual templates are first-class constraints.
- Every relevant workflow accounts for first-run, empty, loading, slow/offline, validation, server error, unauthorized, masked, read-only, partial-success, reconciliation, duplicate-submission and concurrent-update states.
- Production deployment, destructive production mutation and use of real student data in development require separate authorization.
- A final public brand identity, logo system, custom typeface and marketing visual language are not yet approved. Product UI uses the documented incumbent operational design baseline until those decisions are explicitly reviewed.

## Evidence on Hand

- Approved product-design facts: `docs/design/01-product-design-input.md`.
- Architecture, ownership and execution contracts: `docs/execution/`.
- Implemented and verified Wave 1 and Wave 2 domain modules, migrations, application services, feature interfaces and browser evidence.
- No approved customer testimonials, market benchmarks, regulatory certification claims, production screenshots or public brand assets are present; future work must not fabricate them.

## Product Principles

1. **Exceptions before decoration.** Show what needs attention, why, who owns it and where to act.
2. **Trace every number.** Metrics, grades, balances and statuses expose definition, scope, timestamp and source/drill-down.
3. **Protect context and history.** Tenant, relationship, permission, purpose and assurance rules are visible in behavior; corrections preserve evidence rather than silently replacing records.
4. **Design for the real school day.** Keyboard, touch, mobile, dense records, morning bursts, low bandwidth and recoverable offline work are normal conditions.
5. **International by configuration.** Localization and country variation extend through governed packs and contracts, not core-domain forks.

## Accessibility & Inclusion

WCAG 2.2 AA is the minimum web target. Critical workflows support keyboard and screen-reader use, visible focus, touch-sized targets, 200% zoom/text scaling, reduced-motion alternatives, long translations, RTL and non-colour status cues. Child-facing experiences are age-appropriate, direct and privacy-preserving.
