# 99 — Research References

**Research date:** 2026-07-28
**Source preference:** Official vendor, standards-body, regulator, project documentation and canonical repositories.

This catalog supports the market, architecture, privacy, standards and open-source conclusions in the documentation. Vendor feature pages are evidence of advertised product coverage, not an independent quality certification. Pricing, limits, licenses and compliance terms must be rechecked at procurement/implementation time.

## M — Commercial school-platform research

- **M01 — PowerSchool SIS overview:** [PowerSchool SIS](https://www1.powerschool.com/solutions/student-information/powerschool-sis/) — scheduling, attendance, grading, portals, reporting, customization and ecosystem positioning.
- **M02 — PowerSchool SIS feature list:** [PowerSchool SIS features](https://www.powerschool.com/classroom/powerschool-sis/) — student records, course history, enrollment, fees, health, scheduling, gradebook, reporting and integrations.
- **M03 — PowerSchool interoperability:** [Interoperability and standards](https://www.powerschool.com/interoperability/) — API/plugin and education interoperability positioning.
- **M04 — Infinite Campus SIS:** [Student Information System](https://www.infinitecampus.com/products/student-information-system) — SIS, LMS, registration, payments, family access and operational modules.
- **M05 — Infinite Campus attendance:** [Attendance](https://www.infinitecampus.com/products/student-information-system/attendance) — attendance workflows and notifications.
- **M06 — Skyward SIS:** [Student Information System](https://www.skyward.com/products/student-information-system) — scheduling, gradebook, attendance, fees, reporting and portals.
- **M07 — Skyward Qmlativ:** [Qmlativ Education Management System](https://www.skyward.com/products/qmlativ) — integrated SIS/ERP positioning.
- **M08 — Blackbaud education management:** [K–12 education management](https://www.blackbaud.com/solutions/organizational-and-program-management/education-management/k-12) — admissions, academics, family experience and school operations.
- **M09 — Blackbaud enrollment:** [Enrollment management](https://www.blackbaud.com/industry/education/independent-schools/enrollment-management) — admissions, contracts, re-enrollment and tuition/business-office integration.
- **M10 — FACTS SIS:** [Student Information System](https://factsmgt.com/features/student-information-system/) — admissions, academics, attendance, communications and tuition integration.
- **M11 — FACTS school management:** [School management solutions](https://factsmgt.com/) — finance, family engagement, tuition, accounting and analytics positioning.
- **M12 — iSAMS international schools:** [International school management system](https://www.isams.com/solutions/school-type/school-management-system-international-schools/) — multilingual, multi-curriculum, finance/HR and international-school capabilities.
- **M13 — iSAMS school groups:** [School group solutions](https://www.isams.com/solutions/school-type/school-groups/) — centralized reporting and group operations.
- **M14 — OpenApply:** [International school admissions](https://www.openapply.com/international-schools) — admissions CRM, bilingual forms, re-enrollment and international workflows.
- **M15 — OpenApply payments:** [OpenApply payments](https://www.openapply.com/features/payments) — multi-currency payment positioning.
- **M16 — ManageBac:** [ManageBac help center](https://help.managebac.com/) — international curriculum, teaching and learning workflows.

## O — Open-source project research

- **O01 — Frappe Education repository/license:** [frappe/education](https://github.com/frappe/education) — canonical source; repository license file states GNU GPL version 3.
- **O02 — Frappe Education documentation:** [Introduction](https://docs.frappe.io/education/introduction) — student, program, course, fees, scheduling and education workflows.
- **O03 — ERPNext repository/license:** [frappe/erpnext](https://github.com/frappe/erpnext) — canonical ERP/accounting project; GPL-3.0 license.
- **O04 — ERPNext documentation:** [ERPNext docs](https://docs.frappe.io/erpnext/) — accounting, receivables, payables, inventory, assets and HR concepts.
- **O05 — Gibbon documentation:** [Gibbon Documentation](https://docs.gibbonedu.org/) — school workflows, modules and administration.
- **O06 — Gibbon repository/license:** [GibbonEdu/core](https://github.com/GibbonEdu/core) — canonical source; GPL-3.0 license and dependency review point.
- **O07 — OpenEduCat repository/license:** [openeducat/openeducat_erp](https://github.com/openeducat/openeducat_erp) — Community Edition source; repository states LGPL-3.0 with file/dependency review still required.
- **O08 — openSIS Classic repository:** [OS4ED/openSIS-Classic](https://github.com/OS4ED/openSIS-Classic) — README indicates GNU GPL; exact version, activity, security and file licenses must be re-evaluated before reuse.
- **O09 — Frappe Framework repository/license:** [frappe/frappe](https://github.com/frappe/frappe) — framework source under MIT; this does not change the GPL license of Education/ERPNext application code.

## C — Cloudflare architecture sources

- **C01 — D1 limits:** [D1 platform limits](https://developers.cloudflare.com/d1/platform/limits/) — database size, execution and account limits.
- **C02 — D1 read replication:** [D1 read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/) — replicas, Sessions API and consistency behavior.
- **C03 — Workers storage selection:** [Workers storage options](https://developers.cloudflare.com/workers/platform/storage-options/) — D1, Hyperdrive, KV, R2, Durable Objects and workload guidance.
- **C04 — Hyperdrive:** [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) — connection pooling, database connectivity and caching behavior.
- **C05 — Workers limits:** [Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/) — CPU, memory, subrequests and runtime limits.
- **C06 — Service bindings:** [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) — private Worker-to-Worker calls and invocation behavior.
- **C07 — Queue delivery guarantees:** [Cloudflare Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/) — at-least-once delivery and duplicate handling requirements.
- **C08 — Dead-letter queues:** [Dead-letter queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/) — failed-message handling.
- **C09 — Workflows:** [Cloudflare Workflows](https://developers.cloudflare.com/workflows/) — durable multi-step execution, retries and state.
- **C10 — R2 data location:** [R2 data location](https://developers.cloudflare.com/r2/reference/data-location/) — location hints and jurisdiction restrictions.
- **C11 — Workers bindings:** [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) — resource permissions without embedding provider secrets in application code.
- **C12 — D1 pricing:** [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) — row-based usage and scale-to-zero model.
- **C13 — Cloudflare Workers with Neon:** [Connect to Neon from Workers](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/) — direct Neon serverless driver and optional Hyperdrive connection approaches.

## N — Neon Serverless PostgreSQL sources

- **N01 — Neon serverless driver:** [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver) — direct HTTP and WebSocket PostgreSQL connectivity for serverless/edge runtimes and request-lifetime connection guidance.
- **N02 — Connection pooling:** [Neon connection pooling](https://neon.com/docs/connect/connection-pooling) — PgBouncer pooled endpoints and serverless concurrency guidance.
- **N03 — Branching:** [Neon branching](https://neon.com/docs/introduction/branching) — copy-on-write branches for development, previews, testing and recovery workflows.
- **N04 — Branching workflow:** [Neon branching workflow](https://neon.com/docs/guides/branching-neon-api) — branch-per-preview/test automation patterns and branch lifecycle.
- **N05 — Autoscaling:** [Neon autoscaling](https://neon.com/docs/introduction/autoscaling) — compute autoscaling behavior and configuration.
- **N06 — Scale to zero:** [Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero) — suspend/resume and cold-start considerations.
- **N07 — Instant restore:** [Neon branch restore](https://neon.com/docs/introduction/branch-restore) — point-in-time branches and restore workflows.
- **N08 — Read replicas:** [Neon read replicas](https://neon.com/docs/introduction/read-replicas) — read-only compute endpoints sharing storage.

## L — Open-source licensing sources

- **L01 — GNU GPL FAQ:** [GNU GPL frequently asked questions](https://www.gnu.org/licenses/gpl-faq.html) — private use, distribution, combined works and source obligations.
- **L02 — GNU AGPL FAQ:** [GNU GPL/AGPL network-use guidance](https://www.gnu.org/licenses/gpl-faq.html#AGPLv3InteractingRemotely) — network interaction source-offer distinction.
- **L03 — GNU LGPL:** [GNU Lesser General Public License v3](https://www.gnu.org/licenses/lgpl-3.0.html) — combined-work, modification and relinking/source conditions.
- **L04 — GitHub licensing guidance:** [Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) — absence of a license leaves default copyright restrictions.

## U — Design-agent and Impeccable sources

- **U01 — Impeccable repository and README:** [pbakaus/impeccable](https://github.com/pbakaus/impeccable) — skill capabilities, command workflow, installation paths, detector, hooks and Apache-2.0 license.
- **U02 — Impeccable skill source:** [Impeccable SKILL.md](https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/SKILL.md) — product/design authority, modes, command routing and session workflow.
- **U03 — Impeccable hook guidance:** [Impeccable hooks](https://github.com/pbakaus/impeccable/blob/main/skill/reference/hooks.md) — design-relevant edit hooks and detector behavior.
- **U04 — GitHub agent skills:** [Adding agent skills for GitHub Copilot](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills) — repository-local `.github/skills`/`.agents/skills` structure and `SKILL.md` requirements.

## D — PostgreSQL data-platform sources

- **D01 — Row-level security:** [PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — row policies and default-deny behavior.
- **D02 — Declarative partitioning:** [PostgreSQL table partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) — partitioned-table design and management.
- **D03 — Logical replication:** [PostgreSQL logical replication](https://www.postgresql.org/docs/current/logical-replication.html) — publication/subscription and transactional change replication.
- **D04 — JSON/JSONB:** [PostgreSQL JSON functions and operators](https://www.postgresql.org/docs/current/functions-json.html) — bounded extensibility and query/index support.

## I — Education interoperability standards

- **I01 — OneRoster:** [1EdTech OneRoster](https://www.1edtech.org/standards/oneroster) — roster, course, class, user, enrollment, grades and resource exchange.
- **I02 — OneRoster 1.2 specification resources:** [OneRoster specification](https://www.imsglobal.org/spec/oneroster/v1p2) — CSV/REST implementation details.
- **I03 — LTI:** [1EdTech Learning Tools Interoperability](https://www.1edtech.org/standards/lti) — secure learning-tool integration.
- **I04 — LTI 1.3 core:** [LTI Core 1.3](https://www.imsglobal.org/spec/lti/v1p3/) — launch and security protocol.
- **I05 — LTI Advantage services:** [LTI Advantage](https://www.1edtech.org/standards/lti-advantage) — deep linking, names/roles and assignment/grade services.
- **I06 — Ed-Fi Data Standard:** [Ed-Fi Data Standard](https://docs.ed-fi.org/reference/data-exchange/data-standard/) — canonical K–12 data exchange model and releases.
- **I07 — SIF specifications:** [Access 4 Learning SIF specifications](https://www.a4l.org/page/SIFSpecifications) — education interoperability specifications.
- **I08 — OpenID Connect:** [OpenID Connect](https://openid.net/developers/how-connect-works/) — identity federation overview used alongside SAML/SCIM enterprise integrations.

## P — Privacy and child-data sources

- **P01 — GDPR principles:** [ICO guide to data-protection principles](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/) — lawfulness, purpose limitation, minimization, accuracy, storage limitation, security and accountability.
- **P02 — FERPA school-official/vendor conditions:** [U.S. Department of Education Student Privacy Policy Office](https://studentprivacy.ed.gov/faq/what-must-educational-agency-or-institution-do-ensure-its-outside-party-vendor-school-official) — direct control, legitimate interest and permitted-use conditions.
- **P03 — FERPA access controls:** [FERPA legitimate educational interest guidance](https://studentprivacy.ed.gov/faq/how-can-school-ensure-school-officials-only-obtain-access-education-records-which-they-have) — reasonable methods to limit access.
- **P04 — FERPA disclosure records:** [Record of access/disclosures](https://studentprivacy.ed.gov/faq/what-must-record-access-include) — disclosure logging expectations.
- **P05 — U.S. Department of Education data security:** [Data security guidance](https://studentprivacy.ed.gov/data-security) — security resources for education data.
- **P06 — FTC COPPA FAQ:** [Complying with COPPA](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) — under-13 online service requirements and school authorization context.
- **P07 — FTC education technology policy statement:** [Policy statement on education technology and COPPA](https://www.ftc.gov/legal-library/browse/policy-statement-federal-trade-commission-education-technology-childrens-online-privacy-protection) — limits on commercial use and retention.
- **P08 — FTC Edmodo enforcement:** [FTC action against Edmodo](https://www.ftc.gov/news-events/news/press-releases/2023/05/ftc-says-ed-tech-provider-edmodo-unlawfully-used-childrens-personal-information-advertising) — enforcement lessons on advertising, school authorization and retention.
- **P09 — UK Children’s Code:** [ICO Children’s Code guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/) — age-appropriate privacy expectations for services likely accessed by children.
- **P10 — GDPR privacy by design:** [ICO data protection by design and default](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/accountability-and-governance/data-protection-by-design-and-default/) — design/default controls.
- **P11 — FERPA overview:** [Family Educational Rights and Privacy Act](https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html) — U.S. education-record privacy overview.
- **P12 — COPPA Rule:** [FTC Children’s Online Privacy Protection Rule](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa) — regulatory source.

## S — Security and accessibility standards

- **S01 — WCAG 2.2:** [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) — W3C Recommendation for web accessibility.
- **S02 — WCAG 2.2 publication history:** [W3C WCAG 2.2 history](https://www.w3.org/standards/history/WCAG22/) — recommendation status and publication history.
- **S03 — OWASP ASVS:** [Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/) — secure application requirements and current stable release information.
- **S04 — NIST CSF 2.0:** [NIST Cybersecurity Framework 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20) — organizational cybersecurity-risk management framework.
- **S05 — NIST CSF resource center:** [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework) — current implementation resources.

## Reference maintenance rules

- Recheck Cloudflare limits, pricing and jurisdiction claims before implementation and at least quarterly during active architecture work.
- Recheck canonical repository licenses at the exact commit used; this catalog is not a license opinion.
- Recheck standards versions before building a connector.
- Recheck privacy/regulatory requirements with qualified counsel in each launch country.
- Preserve dated architecture decisions when a source change causes a recommendation change.
