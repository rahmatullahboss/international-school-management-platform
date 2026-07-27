# 03 — Product Requirements and Full Feature Catalog

## 1. Product definition

The product is an international, multi-tenant K–12 Student Information System and School ERP. It supports one school, a multi-campus organization, or a school group with centralized governance and campus-level operational autonomy.

## 2. Personas

| Persona | Primary jobs |
|---|---|
| Platform operator | Tenant provisioning, region assignment, subscriptions, support access, platform health |
| School owner/board | Group performance, finance, enrollment, risk and compliance oversight |
| Head/principal | Academic, attendance, staffing, safeguarding and campus operations |
| Registrar/admissions officer | Enquiry, application, documents, review, offers and enrollment |
| Finance officer/accountant | Fees, invoices, receipts, collections, journals, reconciliation and statements |
| Academic coordinator | Curriculum, courses, classes, timetable, grading and report cards |
| Teacher | Attendance, class list, assessment, gradebook, communication and pastoral notes |
| Student | Timetable, attendance, tasks, grades, resources and requests |
| Parent/guardian | All children, fees, attendance, results, forms, communication and consent |
| HR/operations staff | Staff, contracts, leave, payroll adapters, assets, procurement and facilities |
| Counselor/nurse/safeguarding staff | Restricted wellbeing, health, incident and support records |
| Auditor/regulator | Time-bound read-only evidence, reports and disclosure history |

## 3. Cross-cutting platform capabilities

### P0 — Foundation

- Tenant, legal entity, campus and department hierarchy
- Tenant home region and data-residency policy
- Academic year, terms, holidays, instructional days and bell schedules
- Locale, time zone, currency, numbering and document configuration
- User identity, MFA/passkeys, sessions and account recovery
- OIDC/SAML SSO for enterprise tenants
- Role-based and attribute/scope-based authorization
- Field-level masking and break-glass access for sensitive records
- Complete audit trail and support-access approvals
- Workflow/approval engine
- Configurable forms and custom fields with validation
- Document templates, PDF generation and e-signature adapter
- Notifications through email, SMS, push, WhatsApp/provider adapters where legal
- Imports, exports, validation, dry-run and reconciliation
- OpenAPI, webhooks, idempotency and integration credentials
- Feature flags, plan entitlements and module activation
- Search, saved filters, bulk actions and background jobs
- Accessibility target: WCAG 2.2 AA
- Translation, RTL and locale-aware formatting
- Data-retention, legal hold and deletion workflows

### P1 — Platform maturity

- SCIM user provisioning
- Delegated tenant administration
- Configurable report builder
- Approval matrices by amount, campus and role
- Data classification and field registry
- Tenant sandbox/test environment
- Scheduled exports and secure file exchange
- In-product support diagnostics with privacy-safe traces
- Mobile application shell and offline synchronization framework

### P2 — Enterprise platform

- Customer-managed encryption keys where infrastructure permits
- Dedicated tenant database/region deployment
- Advanced data-loss prevention policies
- Cross-tenant school-group analytics with explicit data-sharing agreements
- Marketplace and partner application approval
- Enterprise data warehouse connectors

## 4. Organization and tenant administration

### P0

- Organization profile, branding and domains
- Legal entities and campuses
- Departments, divisions, houses and organizational units
- Campus-specific calendars, time zones and policies
- Academic year rollover with preview and rollback-safe workflow
- Number sequences for student IDs, invoices, receipts and certificates
- User invitation, account linking and guardian household access
- Role templates and permission scopes
- Subscription/module entitlement visibility
- Audit and security center

### P1

- School-group shared services
- Central policy with campus overrides
- Inter-campus transfers
- Shared course catalogs and staff pools
- Consolidated reporting and inter-entity accounting support

## 5. People, identity, family and master data

### P0

- One canonical person record per human
- Legal, preferred, former and native-script names
- Date of birth, gender fields configurable by jurisdiction, nationality and language preferences
- Multiple email, phone and address records with validity periods
- Household and family relationships
- Multiple guardians with legal authority, custody, billing and pickup permissions
- Emergency contacts and authorized pickup persons
- Duplicate detection and merge workflow
- Identity documents and sensitive identifiers with field encryption/masking
- Consent, communication preference and privacy notice acceptance
- Person-level documents and expiry reminders
- Complete change history

### P1

- Cross-campus identity matching
- Family account delegation
- Relationship verification and periodic data-update campaigns
- Alumni and former staff identity continuation

## 6. Admissions CRM and enrollment

### P0

- Enquiry/lead capture from forms, referrals and imports
- Applicant profile separate from active student record
- Configurable application forms by program/campus/year
- Required documents and checklists
- Application fees and payment
- Review stages, assignments, notes and scoring
- Interview, assessment and tour scheduling
- Duplicate applicant detection
- Offer, waitlist, rejection and withdrawal
- Offer letters, contracts, deposits and acceptance
- Re-enrollment workflow
- Applicant-to-student conversion with controlled field mapping
- Enrollment capacity and seat tracking
- Admissions communications and templates
- Funnel and conversion reports

### P1

- Confidential references
- Agent/partner/referral tracking
- Scholarship and financial-aid application workflow
- Automated nurture campaigns
- Family self-service application status
- Multi-school application within a school group

### P2

- Advanced admissions forecasting
- Territory/market analytics
- Configurable application scoring models with bias review

## 7. Student lifecycle and enrollment management

### P0

- Student number and campus/program enrollment
- Enrollment, transfer, withdrawal, graduation and alumni status history
- Cohort, grade/year level, homeroom/advisory and house
- Course/class enrollment and effective dates
- Student documents, certificates and letters
- Previous school and academic history
- Promotion, retention and year-end rollover
- Student directory with privacy controls
- Status-based access and billing rules
- Data quality and missing-information dashboard

### P1

- Concurrent/dual enrollment
- Exchange/visiting student workflow
- Graduation requirements and credit audit
- Student clearance workflow
- Alumni transition and records request

## 8. Curriculum, courses and academic structure

### P0

- Curriculum framework and version
- Program, pathway, subject, course and unit hierarchy
- Grade/year levels configurable by country/curriculum
- Course prerequisites and credit values
- Course catalog and availability by campus/year
- Learning standards/outcomes mapping
- Class/section creation
- Teacher, co-teacher and assistant assignment
- Room/resource assignment
- Course enrollment rules and capacity
- Academic policy versioning

### P1

- Dual/multiple curriculum support for one student
- Course requests and recommendations
- Graduation pathways
- Cross-campus and virtual classes
- Curriculum mapping and coverage analytics

## 9. Timetable and scheduling

### P0

- Bell schedules and rotating cycles
- Periods, rooms, teachers and class meetings
- Conflict detection
- Manual timetable builder
- Student and teacher timetable views
- Substitution and temporary room changes
- Calendar/event synchronization
- Publish/unpublish workflow

### P1

- Constraint-based master scheduling
- Teacher availability and workload rules
- Room/equipment constraints
- Student course request optimization
- Scenario comparison and scheduling quality score
- Exam timetable

### P2

- Advanced solver service
- Automatic rescheduling recommendations
- Transport/activity schedule coordination

## 10. Attendance, arrival and dismissal

### P0

- Daily and per-session/class attendance
- Configurable attendance codes and reasons
- Late arrival, early departure and partial attendance
- Teacher roster entry optimized for low latency
- Office corrections with reason and approval
- Guardian absence notification and evidence upload
- Attendance thresholds and alerts
- Real-time missing-student list
- Daily reconciliation and lock/finalization
- Attendance reports by student, class, campus and period
- Offline capture with idempotent synchronization

### P1

- Kiosk/QR/RFID/device adapter
- Bus attendance
- Activity attendance
- Dismissal authorization and pickup workflow
- Geofenced staff attendance where lawful
- Chronic absence interventions

### P2

- Predictive absence risk, opt-in and explainable
- Emergency accountability mode

## 11. Assessment, gradebook and reporting

### P0

- Traditional and standards/outcomes-based grading
- Configurable grade scales, categories, weighting and rounding
- Assessments, assignments and rubric criteria
- Scores, comments, exemptions and missing/late states
- Teacher gradebook with moderation and locking
- Grade calculation preview and explainability
- Publication windows
- Report card templates and localized comments
- Transcript and academic history
- GPA/credit rules as versioned policy
- Grade change request and audit
- Promotion and completion decisions

### P1

- Common assessments and moderation
- Competency/mastery progression
- Predicted/target grades
- Student portfolios
- External examination results
- Curriculum-specific report packs
- Digital credentials/certificates

### P2

- Advanced learning analytics
- Assessment item analysis
- Privacy-safe AI assistance for comment drafting, always teacher-reviewed

## 12. Learning management — integration-first scope

### P0

- Class announcements and basic resources
- Assignment metadata and due dates
- Deep links to external learning tools
- OneRoster roster/resource exchange
- LTI 1.3/LTI Advantage launch and grade-return integration

### P1

- Basic submissions, feedback and discussion
- Content repository and reusable templates
- Calendar aggregation

### Product guardrail

Do not build a complete content authoring, video, plagiarism, proctoring and virtual-classroom suite in the first product program. Integrate established tools first.

## 13. Fees, billing, collections and accounts receivable

### P0

- Fee catalog and fee schedules
- Tuition contract/financial responsibility
- One-time, recurring and installment charges
- Student, family, activity, transport and other charge sources
- Invoices, debit notes and credit notes
- Discounts, scholarships, waivers and financial aid
- Tax configuration and tax evidence
- Payment links and gateway adapters
- Cash, bank, card and online payment capture
- Payment allocation across invoices
- Partial payment, overpayment and unapplied credit
- Refund and reversal workflows
- Collection reminders and statements
- Aging, outstanding and collection dashboards
- Cashier shift and receipt control
- Bank deposit and reconciliation support
- Multi-currency display; authoritative ledger currency by legal entity

### P1

- Direct debit/ACH/standing instruction adapters
- Payment plans and dunning workflows
- Sponsor/employer/government billing
- Cross-campus family account
- Financial-aid workflow
- Collections case management

## 14. Accounting and financial management

### P0

- Configurable chart of accounts by legal entity
- Fiscal years and periods
- Immutable double-entry journal entries and lines
- Posting rules from invoices, payments, refunds and discounts
- Accounts receivable subledger reconciliation
- Manual journals with approvals
- Trial balance, general ledger, income statement and balance sheet
- Cost centers, campuses, departments and programs as dimensions
- Period close and lock
- Reversal rather than destructive editing
- Audit trail from source transaction to journal and back

### P1

- Accounts payable
- Purchase requisition, purchase order and vendor invoice
- Budgeting and budget controls
- Fixed assets and depreciation
- Bank feeds and automated matching
- Inter-entity transactions and consolidation support
- Tax filings/adapters by country

### P2

- Advanced consolidation and elimination
- Treasury/cash forecasting
- External ERP/general-ledger synchronization

## 15. HR, staff and payroll

### P0

- Staff profile and employment status
- Position, department, campus and supervisor
- Contract dates and document expiry
- Qualifications, certifications and safeguarding checks
- Leave requests and approvals
- Staff directory and access lifecycle
- Teacher workload links to timetable

### P1

- Recruitment and onboarding
- Appraisal/performance cycles
- Professional development
- Timesheets and overtime
- Payroll input preparation and country-specific payroll adapters
- Benefits and deductions configuration

### Guardrail

A universal payroll calculation engine should not be part of the early core. Payroll law changes by country; use country modules or integrations.

## 16. Health, wellbeing, behavior and safeguarding

### P0

- Health alerts visible only to authorized roles
- Conditions, allergies, medications and care plans
- Immunization records and expiry/requirement tracking
- Clinic visits and disposition
- Emergency action information
- Behavior incidents, actions and restorative follow-up
- Pastoral/wellbeing notes with stricter access policies
- Safeguarding concern workflow with restricted case membership
- Mandatory disclosure/access logging

### P1

- Counselor referrals and support plans
- Special education/additional learning needs
- Accommodation plans
- Risk assessment and case review
- External professional document exchange

### Critical rule

Health, safeguarding and counseling records must not inherit broad “school administrator” access automatically.

## 17. Communication, forms and engagement

### P0

- Announcements by campus/class/house/audience
- Email, SMS, push and provider adapters
- Multilingual templates and fallback language
- Delivery, bounce and read status where available
- Guardian communication preferences
- Secure two-way messaging with retention policy
- Forms, surveys, acknowledgements and consent
- Emergency notices and escalation
- Calendar and event invitations

### P1

- Campaign segmentation
- Translation workflow
- Parent-teacher meeting booking
- Community groups and newsletters
- Automated journeys triggered by events

## 18. Library, inventory, procurement, assets and facilities

### P1

- Library catalog, copies, loans, reservations, fines and barcode support
- Inventory items, locations, stock movement and reorder rules
- Requisitions, purchase orders, receiving and vendor management
- Fixed assets, assignment, maintenance and disposal
- Rooms, facilities and booking
- Work orders and preventive maintenance
- Consumables linked to departments/cost centers

### P2

- Vendor portal
- Advanced procurement tendering
- IoT/facility integrations

## 19. Transport, hostel, cafeteria and activities

### P1

- Routes, stops, vehicles, drivers and student assignment
- Transport fees and attendance
- Hostel buildings, rooms, beds, allocation and leave
- Meal plans, cafeteria account and POS adapter
- Clubs, sports, trips and activity registration
- Capacity, consent, medical information and activity fees
- Trip risk assessment and attendance

### P2

- GPS/fleet integration
- Smart-card/cashless campus integration
- Competition and athletics management

## 20. Analytics and reporting

### P0

- Operational dashboards with drill-down to source data
- Enrollment, attendance, academic and finance standard reports
- Report filters, saved views and exports
- Every metric has definition, data source, owner and refresh timestamp
- Scheduled reports and permission-aware exports
- Audit/disclosure reports
- Data quality reports

### P1

- Configurable report builder
- School-group consolidated dashboards
- Cohort and longitudinal analysis
- Early-warning rules using transparent thresholds
- Warehouse/lake export

### P2

- Predictive models with model cards, bias evaluation and human review
- Natural-language analytics over approved aggregated datasets

## 21. Mobile and offline requirements

### P0

- Responsive web application
- Installable PWA shell
- Low-bandwidth mode
- Offline-safe attendance draft capture
- Background retry with idempotency
- Device/session management

### P1

- Native mobile applications for family, student and staff
- Offline class roster and emergency contacts with encrypted local storage
- Push notifications
- Camera/document upload and QR scanning

## 22. Non-functional requirements

### Security and privacy

- Tenant isolation verified at application and database layers
- Least privilege, MFA, SSO and session controls
- Encryption in transit and at rest
- Sensitive-field encryption and masking
- Immutable audit and disclosure history
- Secure software development aligned to OWASP ASVS
- No advertising or commercial reuse of child data

### Reliability

- Idempotent writes for payments, attendance sync and integrations
- At-least-once queue consumers designed for duplicate delivery
- Transactional outbox for domain events
- Point-in-time recovery and tested restores
- Graceful degradation when external providers fail

### Performance

- Attendance and class roster operations optimized for morning burst load
- Heavy exports/reports run asynchronously
- Pagination and bounded queries by default
- Tenant-aware capacity testing

### Portability

- Complete tenant export in documented formats
- Standard identifiers and integration mappings
- Database migrations are forward-only with safe expand/migrate/contract patterns
- No business-critical data stored only in caches

## 23. Explicitly deferred from the first release

- Full virtual classroom/video conferencing
- Full content-authoring LMS
- Global payroll calculation engine
- Complex university degree audit
- AI-based autonomous student decisions
- Facial recognition attendance
- High-stakes automated proctoring
- Proprietary hardware dependency
- Blockchain credentials unless a paying customer and legal case justify it

## 24. Product acceptance principle

A feature is not complete merely because a screen exists. It is complete only when it has:

- Domain rules and invariants
- Authorization and privacy rules
- Audit events
- Localization
- Import/export behavior
- Reporting/read model
- Error/retry behavior
- Automated tests
- Operational metrics and support diagnostics
- Documentation and migration impact
