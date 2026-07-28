# Product Design Input Brief

This file contains factual input for `$impeccable init` and later design shaping. It is not a substitute for `PRODUCT.md` or `DESIGN.md`.

## Platform

- Primary platform: web application and responsive PWA
- Primary runtime: Cloudflare Workers-backed web experiences
- Expected use: desktop administration plus mobile/tablet teacher, guardian and student workflows
- Native mobile applications may follow, but the first design authority is web

## Primary users and jobs

### School administrators and leadership

- Configure a tenant, campuses, academic years, policies and modules
- Understand operational and financial state with traceable drill-down
- Manage admissions, enrollment, attendance, records, staff and school services
- Investigate exceptions rather than only viewing summary numbers

### Admissions staff

- Process enquiries and applications
- Review forms, documents, interviews, decisions, offers and conversion to enrollment
- Resolve duplicate people and incomplete family relationships

### Finance staff and cashiers

- Create charges and invoices
- Receive and allocate payments
- Process credits, waivers and refunds
- Reconcile receivables and ledger postings
- Trace every total to source documents and immutable journal entries

### Teachers

- View assigned classes and students
- Take attendance quickly during concentrated morning periods
- Record assessments, grades and comments
- Communicate with authorized guardians/students
- Work reliably on smaller screens and weak connections

### Guardians

- Manage multiple children and households
- Complete admissions/re-enrollment forms
- View attendance, published grades, fees, documents and communication
- Make payments and give consent where available

### Students

- View timetable, attendance, published results, documents and school communication
- Complete age-appropriate permitted requests and forms

### Platform and support operators

- Provision tenants and deployment profiles
- Diagnose health without unrestricted access to sensitive student data
- Use time-bound, approved and audited support workflows

## Product purpose

The product is an international K–12 school operating platform combining SIS and School ERP capabilities on one governed data model. It should let schools run daily academic, administrative and financial work without fragmented records, hidden calculations or country-specific code forks.

## Durable differentiators

- International configuration through country and curriculum packs
- Finance-grade receivables and immutable double-entry accounting
- Multi-campus and school-group operation
- Relationship-aware guardian/student access
- Open interoperability and migration tooling
- Traceable dashboards and reports rather than disconnected headline metrics
- Strong tenant isolation, privacy and auditability
- Low-bandwidth, multilingual and RTL-ready workflows

## Operating context

- High-frequency attendance entry happens in a short morning window.
- Finance users require dense records, reconciliation and source-document traceability.
- School offices use long forms, tables, filters, print/export and exception queues.
- Teachers may use tablets or phones while moving between classes.
- Guardians may use low-cost mobile devices and intermittent networks.
- Names, addresses, identifiers, calendars, currencies, grading systems and documents vary by country.
- Sensitive health, wellbeing and safeguarding records require stricter read and disclosure controls.

## Required product states

Every relevant workflow must account for:

- First-run and configuration-incomplete
- Empty and no-result
- Loading, slow network and offline/retry
- Validation and server error
- Unauthorized, restricted, masked and read-only
- Partial success and reconciliation-required
- Duplicate submission and concurrent update
- Long names, long translations, RTL, CJK and large datasets
- Finalized/closed records and amendment/reversal flows

## Accessibility and inclusion

- WCAG 2.2 AA is the minimum web target.
- Keyboard and screen-reader use must be supported for all critical workflows.
- Touch targets, focus visibility, zoom and text scaling are required.
- Colour cannot be the only carrier of status.
- Reduced-motion alternatives must preserve feedback and state changes.
- Low-bandwidth behavior and resilient form recovery are product requirements.
- Child-facing experiences must be age-appropriate, clear and privacy-preserving.

## Product language

Preferred language is direct, precise and operational. Labels name the task or record using school terminology. Error messages explain what failed, what was preserved and how to recover. The product must not fabricate customers, benchmarks, outcomes or regulatory claims.

## Confirmed visual constraints

No final palette, typography family, visual metaphor or brand identity has been approved yet. Future agents must not invent these as settled facts. The initial visual direction must be established through the Impeccable new-work/design decision process and recorded in `DESIGN.md` after approval.

## Anti-goals

- Generic AI-generated SaaS appearance
- Dashboard pages made only of disconnected statistic cards
- Cards nested inside cards
- Decorative gradients, glows or motion without task meaning
- Over-rounded controls and pills used indiscriminately
- Important totals without source definitions and drill-down
- Desktop-only tables and forms
- Hidden permission failures or silent data loss
- Visual novelty that makes standard school operations harder to learn

## Design success criteria

- A trained user can identify the primary task and current state immediately.
- Dense information remains scannable without hiding necessary detail.
- Every number, status and alert has clear meaning and traceability.
- Common workflows remain fast on keyboard, touch and low-bandwidth connections.
- The same component and status vocabulary is consistent across modules.
- Localization, RTL, long content and permission states do not break the layout.
- The interface feels specific to international school operations rather than interchangeable with a generic admin template.
