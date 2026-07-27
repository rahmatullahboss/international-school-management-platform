# 02 — Market and Competitor Research

## 1. Research scope

গবেষণায় তিন ধরনের product দেখা হয়েছে:

- Large commercial SIS/ERP suites
- International/private-school platforms
- Open-source education management systems

Marketing claims-কে verified product behavior হিসেবে ধরা হয়নি। Vendor documentation থেকে feature coverage এবং product positioning নেওয়া হয়েছে; implementation quality, pricing, support এবং contractual compliance procurement-এর সময় আলাদাভাবে যাচাই করতে হবে।

## 2. Commercial market map

| Platform | Primary segment | Strongest observed capabilities | Product lessons for us |
|---|---|---|---|
| PowerSchool SIS | Public districts, charter, private and international | Scheduling, attendance, grading, compliance/state reporting, parent/student portals, customization, APIs and ecosystem integrations | Core SIS needs configurable data, strong reporting, scheduling and interoperability; portals cannot be secondary features |
| Infinite Campus | K–12 districts and schools | SIS + LMS, attendance, registration, payments, food service, family access, messaging and analytics | Operational modules become more useful when families use one identity and one app |
| Skyward | K–12 districts and municipalities | SIS/ERP pairing, gradebook, scheduling, attendance, fees, reports and finance/HR | Academic and administrative ERP data must share governance without becoming one tightly coupled codebase |
| Blackbaud Education Management | Private and independent schools | Admissions, enrollment, academics/LMS, tuition, billing, business office and family experience | Private schools buy an end-to-end enrollment-to-tuition journey, not isolated modules |
| FACTS | Private/faith-based schools | SIS, admissions, tuition, financial aid, accounting, family engagement and analytics | Enrollment contracts, billing and family communications are central commercial workflows |
| iSAMS | International and independent schools | Multi-curriculum, multilingual portals/apps, admissions, finance, HR, wellbeing and school-group reporting | International support requires configurable curricula, language, finance and group-level operations |
| OpenApply / ManageBac | International schools | Admissions CRM, bilingual forms, application workflows, re-enrollment, multi-currency payments, curriculum/learning workflows | Admissions and curriculum products can be excellent specialized experiences; open integration matters more than rebuilding every LMS function |

## 3. Feature patterns across leading platforms

### 3.1 Student information system foundation

Common mature capabilities:

- Student demographics, multiple names, contacts and identifiers
- Family/household and guardian relationships
- Enrollment status history, transfers and withdrawals
- Course/section enrollment and schedule history
- Attendance and attendance corrections
- Health, immunization, behavior and support records
- Fees, balances and payment visibility
- Custom fields and configurable forms
- Bulk import/export and change history

**Conclusion:** Student data cannot be modeled as one large `students` table. The product needs person, relationship, enrollment and history models that remain accurate when family, campus or academic status changes.

### 3.2 Academic operations

Market leaders generally include:

- Academic calendars and terms
- Course catalog, prerequisites and course requests
- Class/section creation and teacher assignment
- Master scheduling and timetable tools
- Traditional and standards-based gradebooks
- Rubrics, assessment categories and weighting
- GPA, credit, promotion and graduation tracking
- Report cards, transcripts and academic history
- Parent/student visibility with publication controls

**Conclusion:** Academic policies must be versioned. A later grading-policy change must not alter historical transcripts.

### 3.3 Admissions and enrollment

Strong private/international products provide:

- Enquiry and lead capture
- Application forms and document collection
- Configurable checklists and review stages
- Interview and assessment scheduling
- Confidential references
- Offer, acceptance, contract and deposit workflows
- Re-enrollment and waitlist management
- Admissions communications and campaign automation
- Enrollment conversion analytics

**Conclusion:** Admissions is a workflow/CRM domain linked to, but not identical with, active student records. An applicant should become a student through an explicit conversion process.

### 3.4 Finance and school operations

Competitive suites commonly provide some combination of:

- Fee schedules and tuition contracts
- Invoices, installments and payment plans
- Discounts, scholarships, financial aid and waivers
- Online payments, allocations, refunds and reconciliation
- General ledger and financial reporting
- Purchasing, inventory and fixed assets
- Payroll/HR or integrations to local payroll
- Cafeteria, transport, hostel, library and activity billing

**Conclusion:** A billing-only design will eventually fail. Receivables, payments and discounts must post into a double-entry ledger from the first finance release.

### 3.5 Family, student and teacher experience

Expected capabilities:

- One account for multiple children and campuses
- Mobile-responsive dashboards and mobile applications
- Grades, attendance, timetable, fees, notices and forms
- Secure messaging and announcements
- Teacher gradebook, attendance and class context
- Student submissions, resources and progress where LMS-lite is enabled
- Notification preferences and multilingual delivery

**Conclusion:** Role-based navigation is insufficient. The product needs persona-specific workflows and contextual dashboards.

### 3.6 Reporting and interoperability

Large platforms emphasize:

- Operational and regulatory reports
- Custom report builders
- Dashboards and early-warning indicators
- APIs, plugins and standards-based integrations
- OneRoster, SIF and Ed-Fi mappings in public-school ecosystems
- SSO and learning-tool integrations

**Conclusion:** Reporting and integration are platform capabilities, not final-phase add-ons. Every module must expose auditable query/read models and events.

## 4. Open-source market map

| Project | Technology orientation | Useful areas | Main cautions |
|---|---|---|---|
| Frappe Education + ERPNext | Python/Frappe, MariaDB-oriented ERP ecosystem | Student lifecycle, programs/courses, fees, scheduling, exams; mature ERP/accounting concepts in ERPNext | Copyleft license obligations, different target stack, framework lock-in, tenant/security model must be assessed |
| Gibbon | PHP/MySQL school platform | Teacher planning, student profiles, attendance, admissions, extensible modules and school-facing workflows | UI/architecture modernization and SaaS tenancy likely require significant work; verify current license and extension quality |
| OpenEduCat | Odoo/Python/PostgreSQL | Broad education modules, HR/finance/operations, modular ERP approach | Odoo dependency, licensing by module/edition, upgrade and commercial extension strategy need legal/technical review |
| openSIS Classic | Traditional open-source SIS | Data model and workflow reference for classic SIS capabilities | Perform repository activity, security, dependency and license audit before any reuse |

## 5. What should be reused versus rebuilt

### Good candidates for reference or licensed reuse

- Country-neutral domain terminology
- Import templates and migration mapping ideas
- Accounting chart and journal workflow concepts
- Admissions checklist patterns
- Timetable and gradebook workflow ideas
- Report templates where license permits
- Standards adapters and generic libraries
- UI component libraries, date/locale libraries and document generation libraries

### Must be owned by this product

- Tenant and regional data isolation
- Authorization and sensitive-data policy engine
- Core student/enrollment history model
- Finance posting rules and audit invariants
- Country-pack framework
- Integration/event contracts
- Observability and support tooling
- Upgrade/migration governance
- Product UX and design system

### Never copy

- Proprietary vendor code or database schemas obtained without permission
- Branding, screenshots or pixel-identical UI
- Confidential customer workflows or documents
- Open-source code without license/notice compliance

## 6. Market gaps worth targeting

### 6.1 International configuration without consulting-heavy customization

Many products support international schools, but country and curriculum differences can still require vendor services. A versioned configuration framework can reduce one-off code changes.

### 6.2 Finance correctness with modern user experience

Traditional ERP products can be financially capable but difficult for teachers and families. Lightweight school apps can be attractive but lack accounting integrity. Combining finance-grade internals with simple workflows is a strong differentiator.

### 6.3 Data residency as a tenant-level product feature

International school groups increasingly need to know where student data, files, backups and support access are located. Home-region routing, dedicated deployment options and disclosure logs should be visible product capabilities.

### 6.4 Migration and interoperability

Schools fear vendor lock-in and migration failure. A migration studio, dry-run validation, reconciliation reports, export guarantees and standards APIs can become sales features.

### 6.5 Low-bandwidth and operational resilience

Attendance, dismissal and emergency workflows must continue under weak connectivity. Offline-capable capture with safe synchronization can differentiate the platform in emerging markets and large campuses.

## 7. Competitive product strategy

The recommended product strategy is:

1. Build a reliable SIS and finance foundation.
2. Provide excellent teacher/family portals.
3. Integrate with specialist LMS and learning tools through OneRoster/LTI before attempting a complete LMS.
4. Add country packs one at a time with full support and tests.
5. Sell modules around a shared platform rather than creating separate disconnected products.
6. Keep APIs and exports open to reduce procurement objections.
7. Add advanced AI/analytics only after data quality, privacy and core workflows are mature.

## 8. Research basis

Primary vendor and open-source sources are catalogued in [99-references.md](99-references.md), especially references `M01–M16` and `O01–O08`.
