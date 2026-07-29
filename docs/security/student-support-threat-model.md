# Student Support High-Risk Data Threat Model

**Gate:** `GATE-STUDENT-SUPPORT-THREAT-MODEL`  
**Gate verdict:** PASS for CARE-01 implementation entry  
**Reviewed Wave 1 integration SHA:** `8cc8ee1562ade672b14c1c44af935fe7e2307976`  
**Current integrated documentation base:** `11f4536224b1bd31eb1c79bbb7c571e6e7fb470b`  
**Prepared:** 2026-07-29  
**Applies to:** `CARE-01 — Health, Wellbeing and Safeguarding`

## 1. Decision and scope

CARE-01 may begin implementation only while preserving every control and acceptance criterion in this document. This threat model is an implementation gate, not a claim that any deployment is legally compliant. Each launch jurisdiction and tenant remains responsible for approving legal basis, guardian/student rights, retention periods, mandatory-reporting duties and external disclosures.

The protected scope includes:

- student health profiles, medical conditions, allergies, medication authorizations and administration records;
- care plans, immunizations, emergency summaries, clinic visits, dispositions and health documents;
- behavior incidents, participants, actions, sanctions and restorative follow-up;
- pastoral and wellbeing notes, referrals, risk assessments, counselling records and support plans;
- safeguarding concerns, cases, case membership, actions, disclosures, external reports and legal holds;
- learning-support needs, diagnoses where recorded, accommodations, plans, goals and review evidence;
- restricted attachments, generated documents, exports, notifications, audit evidence and offline emergency data.

The gate does not authorize CARE-01 implementation to alter SIS, INT, foundation or OPS-owned tables or packages. CARE-01 consumes stable references and application contracts. It does not duplicate person, enrollment, guardian-authority, integration-governance, identity, audit or tenancy truth.

### 1.1 Reviewed inputs

This model was derived from the CARE-01 execution contract, the program board and tracker, module ownership rules, security/compliance architecture, data model, test strategy, SIS public contracts, INT import/export and connector governance contracts, and foundation authorization/audit primitives.

`PRODUCT.md` and `DESIGN.md` are named as authorities by the program board but are absent from the current integrated repository. The repository's `docs/design/01-product-design-input.md` was reviewed as factual product input. Their absence does not block this documentation-only security gate because no UI or product-design contract is changed here; CARE-01 must resolve the documented design-authority drift before shipping UI-bearing checkpoints.

## 2. Security objectives

CARE-01 must satisfy all of the following:

1. **Confidentiality:** highly restricted facts are available only to an authenticated person with a current role, permitted purpose, resource scope and need to know.
2. **Child safety:** privacy controls never suppress an urgent, lawful child-protection or emergency-care action; emergency access is narrow, time-bound and reviewed.
3. **Tenant isolation:** no request, job, cache, object, export, notification or integration can cross tenant boundaries.
4. **Relationship correctness:** guardian and student access follows current verified SIS authority plus CARE publication/disclosure policy, not account possession alone.
5. **Purpose limitation:** authorization includes a declared permitted purpose; consent or a broad role never creates unrestricted secondary use.
6. **Accountability:** every sensitive read, change, download, export, disclosure, support access and break-glass action creates immutable evidence.
7. **Data minimization:** APIs, events, reports, notifications and integrations expose only fields necessary for an approved task.
8. **History and retention:** amendments preserve material history; deletion obeys category policy, legal hold and destruction evidence.
9. **Fail closed:** missing tenant context, membership, purpose, assurance, audit availability, classification or policy produces denial rather than broad fallback.
10. **Safe recovery:** incidents can revoke sessions, isolate a tenant/connector/device, determine affected records and preserve evidence.

## 3. Assets, actors and trust boundaries

### 3.1 High-value assets

- sensitive narratives, clinical observations and counselling notes;
- medication and allergy facts that affect immediate safety;
- identities of reporters, alleged persons, witnesses, external agencies and case members;
- safeguarding existence metadata, case status and legal/mandatory-reporting evidence;
- diagnoses, learning needs and accommodations that can cause stigma or discrimination;
- guardian restrictions, consent/legal-basis evidence and publication decisions;
- file objects, signed URLs, exports, printouts and cached/offline copies;
- access, disclosure, approval, legal-hold and break-glass evidence;
- encryption-key references, integration credentials and device/session tokens.

### 3.2 Actor classes

- student and verified guardian;
- teacher, tutor, homeroom/advisor and activity staff;
- nurse/clinic staff and medication administrator;
- behavior/pastoral lead;
- counselor/wellbeing practitioner;
- learning-support/SEN staff;
- designated safeguarding lead and explicit safeguarding case member;
- principal/tenant administrator, privacy officer and security reviewer;
- platform support operator;
- connector/service account and report/export worker;
- unauthorized insider, compromised account, malicious connector and attacker controlling a lost device.

### 3.3 Trust boundaries

- browser/PWA or managed device to Cloudflare application boundary;
- application service to policy engine and tenant context;
- application service to Neon PostgreSQL under normal `app_runtime` role;
- application service to object storage and signed URL issuance;
- queue/background worker boundary where tenant and purpose context must be reconstructed safely;
- CARE-owned schemas to SIS/INT/foundation public contracts;
- notification providers, export destinations and external professional/agency disclosures;
- offline encrypted emergency bundle on an approved device.

## 4. Data classification and handling

Every CARE field, document, event, search index, report column and notification variable must declare one of these classes. Classification is explicit metadata; absence defaults to the most restrictive applicable class.

| Class | CARE examples | Default handling |
|---|---|---|
| `CARE-C1 operational` | clinic queue state, non-sensitive task status, plan review due date without diagnosis or narrative | tenant-scoped; role and relationship checks; ordinary audit for changes |
| `CARE-C2 confidential` | routine behavior incident facts, approved learning accommodations, published care instructions | named capability plus student/campus scope; bounded search; audited export; guardian/student publication separately decided |
| `CARE-C3 highly-restricted` | conditions, allergies, medications, clinic narratives, counselling notes, diagnoses, wellbeing risk, unpublished learning-support detail | explicit purpose and role/case assignment; field/document masking; read logging; no general report builder; export denied by default; selected field encryption |
| `CARE-C4 safeguarding-restricted` | concern/case existence, reporter/witness identity, allegations, safeguarding actions, external reports, legal advice, disclosure history | explicit active case membership or approved emergency access; AAL2 for sensitive actions; every read logged; no broad admin inheritance; no routine portal/integration/export visibility |
| `CARE-E emergency-minimum` | verified allergy, medication, emergency action and contact instructions required to prevent immediate harm | separately generated minimum view; tightly scoped emergency roles; short cache lifetime; no source narrative; read and break-glass logging |

### 4.1 Record-specific rules

- Medication orders, authorizations, dosage, route, schedule, administration and omissions are `CARE-C3`; administration requires positive student identification and accountable actor evidence.
- Allergy and emergency-action facts may be projected into `CARE-E`; the source condition, clinical note and document remain `CARE-C3`.
- Behavior records are not automatically routine discipline data. Allegations involving abuse, sexual conduct, self-harm, serious violence, protected characteristics or confidential reporters are escalated to `CARE-C3`/`CARE-C4` and cannot remain in broad behavior views.
- Counselling session content is `CARE-C3`; appointment logistics may be `CARE-C1` only when wording does not reveal a diagnosis, concern or case type.
- Safeguarding case existence is itself `CARE-C4`. Unauthorized users receive a normal not-found/denied response that does not confirm existence.
- Learning accommodations released to assigned teachers are a minimized `CARE-C2` projection. Diagnosis, source assessment and professional documents remain `CARE-C3`.
- Restricted documents inherit the highest classification of their content and cannot be downgraded merely by renaming, copying or generating a derivative.

## 5. Authorization model: least privilege and need to know

CARE authorization is RBAC plus contextual ABAC. A successful decision requires all relevant dimensions:

- authenticated, active, non-suspended tenant membership;
- tenant and, where applicable, campus scope;
- named permission with no wildcard super-user fallback;
- resource relationship: assigned student, assigned plan, active case membership or approved emergency grant;
- approved purpose code appropriate to the action;
- record classification and field-level release rule;
- required assurance level;
- current effective/expiry dates and no revocation;
- successful audit-evidence creation when read logging is mandatory.

A role grants eligibility to be considered; it does not alone grant access. Tenant administrator, principal, database support, finance, HR, admissions, report-builder and integration roles receive no implicit CARE-C3/CARE-C4 access.

### 5.1 Purpose codes

CARE-01 must use a controlled, versioned purpose catalog rather than free text for ordinary access. Examples include `direct-care`, `medication-administration`, `emergency-response`, `student-support-plan`, `behavior-management`, `safeguarding-assessment`, `mandatory-reporting`, `case-supervision`, `legal-rights-response`, `security-investigation` and `approved-data-transfer`. Free-text justification may supplement, not replace, the code.

Purpose must be retained in the access/disclosure event. A request cannot reuse one purpose to perform an incompatible action.

### 5.2 Case membership

Restricted case membership must include tenant, case, principal/person, role in case, purpose, effective start, optional expiry, grantor, approval evidence, status and revocation reason. Membership:

- is explicit and never inferred from broad school administration;
- is scoped to one case or approved caseload, not the entire tenant;
- expires or is reviewed at case closure, staff reassignment, suspension and employment end;
- cannot be self-granted or self-approved for privileged access;
- is evaluated on every request, including search, count, attachment and export operations;
- does not automatically permit disclosure, export, deletion, legal hold or membership administration.

## 6. Role/action matrix

Legend: `A1` allowed with AAL1 and contextual scope; `A2` allowed with AAL2; `M` only a minimized/masked projection; `BG` approved break-glass only; `D` denied by default. All allowed `CARE-C3`/`CARE-C4` reads are logged. Tenant policy may narrow access but cannot broaden beyond this baseline without a reviewed exception.

| Persona | Emergency minimum | Routine health/clinic | Medication administer | Behavior | Counselling/wellbeing narrative | Safeguarding case | Learning plan/accommodation | Bulk export/disclosure | Policy/membership/retention |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Student | M/A1 after publication | M/A1 after publication | D | M/A1 after publication | M/A1 after practitioner release | D unless lawful explicit release | M/A1 after publication | D | D |
| Verified guardian | M/A1 if authority permits | M/A1 after CARE release | D | M/A1 after release | M/A1 or D by rights/risk decision | D unless lawful explicit disclosure | M/A1 after release | D; rights workflow only | D |
| Assigned teacher/advisor | M/A1 | M/A1 need-to-know | D | A1 for assigned students | M only actionable support instruction | D | M/A1 approved accommodations | D | D |
| Nurse/clinic practitioner | A1 | A1; A2 for high-risk corrections | A2 | M | M where direct-care purpose requires | D/BG | M | A2 approved clinical disclosure only | D |
| Authorized medication administrator | A1 | M/A1 | A2 | D | D | D/BG | D | D | D |
| Behavior/pastoral lead | M | M | D | A1/A2 for serious action approval | M or A1 for assigned referral | D/BG | M | A2 approved case output only | D |
| Counselor/wellbeing practitioner | M | M where direct care requires | D | M | A1; A2 for restricted disclosure | D/BG unless explicit case member | M/A1 | A2 with independent approval | D |
| Learning-support practitioner | M | M where plan requires | D | M | M | D/BG | A1; A2 for diagnosis/source disclosure | A2 with independent approval | D |
| Safeguarding lead | A1 | M/A1 where case requires | D | M/A1 where case requires | M/A1 where case requires | A2 | M/A1 where case requires | A2 with independent approval and recipient evidence | A2 |
| Explicit safeguarding case member | M/A1 | M/A1 for case purpose | D unless separately qualified | M/A1 | M/A1 | A2 limited to assigned case | M/A1 | D unless separately approved | D |
| Principal/tenant administrator | M/A1 | D/BG | D | M/A1 operational outcome only | D/BG | D/BG | M/A1 operational plan status | D unless separately approved rights/legal workflow | A2 for policy assignment; no content access inheritance |
| Privacy/security reviewer | D except incident need | D/BG | D | D/BG | D/BG | D/BG | D/BG | A2 evidence/metadata; content only when approved | A2 review/hold/incident actions |
| Platform support operator | D | D/BG approved support session | D | D/BG | D/BG | D/BG | D/BG | D | D; support grant approval remains tenant-controlled |
| General report builder / connector | M from approved aggregate projection | D | D | M approved aggregate only | D | D | M approved non-diagnostic projection only | D unless exact manifest and separate high-risk approval | D |

### 6.1 AAL2 actions

At minimum, AAL2 is required for:

- adding/removing safeguarding case members or privileged caseload access;
- granting, approving, using or reviewing break-glass access;
- medication administration, high-risk medication correction and authorization changes;
- viewing or changing `CARE-C4` case content;
- disclosing `CARE-C3`/`CARE-C4` content outside the direct care/support team;
- generating a high-risk export, print package or external professional document set;
- changing retention policy, applying/releasing legal hold or approving destruction;
- revealing reporter/witness identity or unmasking specially restricted fields;
- approving guardian/student release where risk or statutory restriction applies.

## 7. Guardian and student visibility

Guardian/student access is a distinct publication/disclosure decision, not the inverse of staff access.

1. CARE consumes SIS `GuardianAuthoritySnapshot`; it must verify tenant, student, current effective period, `verificationStatus = verified`, relevant authority, `portalAccess = true` and any `restrictionReference`.
2. A valid guardian relationship does not automatically expose health, counselling, safeguarding or learning-support content.
3. A student's own access depends on age/capacity policy, jurisdiction, school policy, practitioner decision, safeguarding risk and record type.
4. Guardian and student views use minimized, versioned publication records. They never query unrestricted source narratives directly.
5. Publication is revocable prospectively while prior access/disclosure evidence remains immutable.
6. Withholding or masking decisions record legal/policy basis, reviewer and review date without exposing the hidden content in ordinary portal metadata.
7. The UI/API must not reveal that a safeguarding/counselling case exists through counts, badges, route names, error differences, search suggestions or notification copy.
8. Emergency and direct-care exceptions must not be repurposed into portal publication.

## 8. Consent and legal basis

- Every processing purpose records a legal-basis category, jurisdiction/tenant policy version, notice version, accountable decision maker and effective period.
- Consent is used only where it is the approved basis. It records grantor identity, verified authority/capacity, specific purpose/data scope, version, time, withdrawal and consequences.
- Consent cannot override a court/custody restriction, safeguarding need-to-know rule, professional confidentiality duty, mandatory-reporting requirement, legal hold or tenant boundary.
- Absence or withdrawal of consent must not erase records subject to legal obligation, vital interests, public task, contract, legitimate approved school purpose or safeguarding duties. The system records the actual basis rather than fabricating consent.
- CARE may consume SIS consent/guardian evidence through public contracts, but CARE owns purpose-specific processing and disclosure decisions.
- Legal-basis metadata is configuration/evidence, not automated legal advice. Launch-country review is required before policy activation.

## 9. Break-glass and emergency access

Break-glass is exceptional access for immediate safety or an approved urgent investigation. It is not a substitute for staffing, case assignment or support access.

Required controls:

1. AAL2 authentication and an active tenant membership.
2. A selected emergency purpose plus meaningful reason; blank/generic reasons are rejected.
3. The requested resource scope and data classes are explicit.
4. Time limit is the shortest operationally practical period and never becomes standing access.
5. The requester cannot approve their own privileged grant. Where immediate self-service emergency activation is permitted by tenant policy, independent post-event review and alerting are mandatory and the grant remains narrower than ordinary case membership.
6. Every read/action records the grant ID, purpose, reason and correlation ID.
7. Tenant safeguarding/privacy/security contacts receive a safe alert without sensitive narrative.
8. Review occurs within the configured incident window and records justified/misuse outcome and corrective action.
9. Expiry, revocation, account suspension and session revocation terminate access immediately.
10. Break-glass does not permit bulk export, unrestricted search, membership administration, deletion, legal-hold release or connector enablement. Those require separate approval.
11. Emergency minimum data is preferred over full source records.

The foundation privileged-access primitive supplies reason, approval, expiry and revocation, but CARE-01 must additionally enforce independent approval, resource/classification scope, AAL2, notification and review. If the shared contract cannot carry required evidence, CARE-01 must file a contract-change request or add a CARE-owned compatible evidence record; it must not silently weaken the requirement.

## 10. Read-access, change and disclosure audit

### 10.1 Mandatory events

CARE must record immutable evidence for:

- successful `CARE-C3`, `CARE-C4` and `CARE-E` reads, including list/search result access;
- document preview/download, signed URL issuance, print and offline bundle creation;
- create/update/amend/close/reopen decisions and classification changes;
- case membership grant/revoke/review;
- guardian/student publication, masking, withholding and release;
- break-glass request/approval/use/expiry/review;
- export generation, recipient delivery and external disclosure;
- connector access and integration transfer;
- retention, legal hold, anonymization and destruction;
- denied high-risk attempts, audit-write failures and anomaly detections as security events.

### 10.2 Minimum evidence

Actor account and linked person where applicable; effective role/case role; tenant/campus; action; subject/resource reference; data class and fields/category; purpose; assurance; policy decision; case membership or privileged grant reference; correlation/request ID; time; channel/device/session; recipient/destination for disclosure; row/document count; outcome/error code.

Audit metadata must not duplicate the sensitive narrative. Normal application roles cannot update/delete audit records. Audit retention is independent of source-record deletion. For mandatory read logging, failure to persist or durably enqueue the evidence causes the sensitive read to fail closed. Reads and evidence must be transactionally or otherwise provably coupled so a successful response cannot silently bypass logging.

## 11. Export, reporting, files and integration restrictions

### 11.1 Exports and reports

- General report builders, ad hoc SQL, cross-module dashboards and ordinary CSV export cannot access `CARE-C3`/`CARE-C4` source records.
- Aggregate reporting uses reviewed projections with minimum cell-size/suppression rules where re-identification is plausible.
- High-risk export is denied by default and requires named scope, purpose, AAL2, exact field allowlist, bounded population, recipient/destination, retention/expiry and independent approval for bulk or external disclosure.
- Export jobs re-evaluate authorization before generation and again before download; approval expiration invalidates pending output.
- Output is encrypted where supported, watermarked or labeled with tenant/classification/recipient, protected by a short-lived one-time download and deleted on schedule.
- Spreadsheet formula injection is neutralized. Exports contain no hidden columns, unrestricted identifiers, audit narratives or unrelated case data.
- Every generation/download/recipient transfer creates access and disclosure evidence.

### 11.2 Files

- Restricted files use tenant- and classification-scoped object keys, malware scanning, checksums and managed key references.
- Signed URLs are issued only after application authorization, are short lived and cannot be reused outside intended context where provider capability permits.
- File metadata, thumbnails, OCR/search text and generated previews inherit source classification.
- Direct public object URLs and client-generated unrestricted signed URLs are prohibited.

### 11.3 Integrations and events

- No CARE-C3/CARE-C4 category is included in a connector, webhook, OneRoster/LTI payload or migration export unless the exact immutable connector manifest declares it and an independent high-risk tenant approval records purpose, categories, recipient, region/subprocessor, retention and deletion behavior.
- Machine credentials are tenant/connection/scope/category bound, expiring/revocable and never imply human case membership.
- CARE domain events contain minimum identifiers and workflow facts; they exclude clinical/counselling/safeguarding narrative, reporter identity, diagnosis and document contents.
- Disclosure events store category/count/reference evidence rather than full transferred payloads.
- Connector disablement/revocation stops future transfer and supports reconciliation/deletion obligations.

## 12. Notification safety

Notifications are a common disclosure boundary. Email, SMS, push, messaging, lock-screen previews and group channels must contain no diagnosis, medication name/dose, allergy detail, counselling status, behavior allegation, safeguarding case type, reporter identity or sensitive student narrative.

Safe notifications:

- use generic wording such as “A secure student-support action requires review”;
- reveal no sensitive subject in title, sender name, URL path or provider metadata;
- link to an authenticated route that re-evaluates tenant, membership, purpose and AAL;
- verify recipient relationship and permission at send time, not only job creation time;
- suppress delivery to revoked guardians, suspended staff, expired case members and stale device tokens;
- avoid class/group broadcasts for individual CARE matters;
- record minimized delivery evidence and provider status without message content;
- provide an incident path for wrong-recipient delivery and allow tenant notification isolation.

## 13. Cross-tenant and object isolation

1. Every CARE authoritative row has `tenant_id NOT NULL`; primary/unique/foreign-key designs preserve tenant identity.
2. All CARE tenant tables enable and force RLS. The normal application role cannot own tables or hold `BYPASSRLS`.
3. RLS uses transaction-local tenant context and denies when context is missing or malformed. Application authorization adds case/relationship/purpose checks; tenant RLS alone is insufficient.
4. Requests reject opaque IDs from another tenant without querying or leaking existence.
5. Background jobs, queues, exports and notifications carry signed/validated tenant and purpose context; workers do not infer tenant from mutable payload text.
6. Pooled HTTP/WebSocket database connections are tested for tenant-context cleanup and reuse leakage.
7. Cache keys, search indexes, analytics projections, object keys, signed URLs, idempotency keys and external identifiers are tenant namespaced.
8. No global admin query or service-role bypass is exposed to product code. Maintenance access is separate and audited.
9. Cross-tenant batch operations are prohibited in CARE application services; platform incident tooling operates through separately approved, read-minimized procedures.

## 14. Offline and device risk

CARE-C3/CARE-C4 records are online-only by default and must not enter generic PWA caches, browser storage, service-worker response caches, analytics replay, crash reports or local search indexes.

A tenant may enable a `CARE-E` offline emergency bundle only when all conditions hold:

- approved managed device/user role and AAL2 enrollment;
- device-bound encryption and key material unavailable to ordinary application storage;
- minimum fields only, no source narrative or unrestricted attachments;
- explicit student/campus scope, generation time, short expiry and version/checksum;
- remote revoke/wipe capability or documented compensating control;
- no shared-device profile, backup synchronization, unencrypted export or copy-to-personal-app flow;
- access and refresh evidence synchronized when connectivity returns;
- stale/expired bundle visibly blocked and safely deleted;
- lost/stolen device runbook revokes sessions/keys, isolates the device and determines exposed bundle scope.

Offline changes such as clinic observations or medication administration require device identity, local accountable actor, idempotent sync, conflict policy and no silent overwrite. Safeguarding/counselling narrative capture offline is prohibited unless a later separately reviewed design demonstrates equivalent protection and incident controls.

## 15. Retention, legal hold, correction and deletion

Retention is category- and jurisdiction-specific. Each rule records record/document type, tenant/jurisdiction policy version, trigger, duration, archive access, destruction/anonymization action, approval and evidence.

- Typical triggers include student withdrawal/graduation, clinic event, medication expiry, case closure, consent withdrawal, plan supersession and contract end.
- Legal hold and safeguarding/mandatory-reporting duties override routine deletion until authorized release.
- Source correction uses amendment/versioning where historical accountability or safety matters. Material clinical, medication, safeguarding, disclosure and approval history is not overwritten.
- Deletion jobs re-evaluate hold, dependencies and policy; are bounded, idempotent, observable and produce an immutable destruction report.
- Attachments, previews, search indexes, caches, export objects, offline bundles and provider copies are included in deletion scope or recorded as lawful exceptions.
- Audit/disclosure evidence is retained under its own schedule and minimized rather than deleted merely because the source record is removed.
- Guardian/student rights requests use an approved workflow for access, correction, restriction or deletion and may result in masked/withheld output where law or child safety requires.
- No UI/API grants a broad hard-delete capability to practitioners or tenant administrators.

## 16. Abuse cases and required mitigations

| Abuse case | Required prevention/detection |
|---|---|
| A general administrator browses health or safeguarding “because admin sees everything” | no inherited permission; case/purpose check; existence-safe denial; security event for repeated attempts |
| A teacher searches students outside current assignment | current SIS assignment/approved accommodation projection; bounded query; negative tests |
| An expired or restricted guardian opens an old portal link | re-evaluate current SIS authority and CARE publication; revoke signed links/cache; no case-existence leak |
| A case member bulk-searches unrelated cases | case-bound query policy; no global C4 search; per-read logging and anomaly thresholds |
| A counselor exports session narratives to personal storage | export denied by default; AAL2/approval/recipient controls; DLP/watermark; disclosure audit |
| A support engineer uses platform access to inspect tenant records | no standing data access; tenant-approved expiring grant; narrow resource scope; alert and review |
| An approver approves their own break-glass/export request | database/application separation-of-duty constraint and negative test |
| A stolen session or device accesses emergency/clinic data | short sessions, AAL2, device/session revoke, encrypted minimum bundle, incident scope query |
| An attacker guesses a record or document ID | tenant-scoped opaque ID lookup, authorization before metadata, uniform denial |
| A worker runs without tenant context or reuses pooled context | fail-closed RLS, signed job context, pool-leak tests, security alert |
| A report builder or analytics pipeline joins CARE source tables | architecture boundary, database grants/views, approved projections only |
| A connector requests broader health/safeguarding categories after approval | immutable manifest version, independent reapproval, scope/category enforcement, disclosure audit |
| Push/email/SMS leaks case type or medication | generic template allowlist, safe variables, provider-payload tests, wrong-recipient incident runbook |
| Application suppresses or tampers with read logs | append-only audit role/triggers, fail-closed read coupling, reconciliation and alerting |
| Break-glass becomes a routine shortcut | narrow duration/scope, no export, alerts, mandatory review, usage metrics and access-review revocation |
| A practitioner deletes a record before a complaint/investigation | legal hold, no ordinary hard delete, destruction approval and immutable evidence |
| Sensitive custom fields appear in search/export automatically | classification required at definition; default no index/report/export; explicit reviewed release |
| AI summarizes or makes adverse decisions from counselling/safeguarding content | AI processing disabled for initial CARE scope; no model training; separate future privacy/threat review and human decision |

## 17. Concrete security invariants

CARE-01 implementation and tests must reference these invariant IDs.

### Identity, scope and authorization

- **SS-TM-001:** Missing/invalid tenant context always denies access.
- **SS-TM-002:** No CARE row can be read or written across tenants under `app_runtime`.
- **SS-TM-003:** Broad admin, principal, teacher, finance, HR, admissions, report-builder and support roles do not inherit CARE-C3/C4 access.
- **SS-TM-004:** CARE-C3/C4 access requires a permitted purpose and explicit relationship/case scope in addition to permission.
- **SS-TM-005:** Suspended/revoked membership, expired assignment or revoked case membership denies immediately.
- **SS-TM-006:** Safeguarding case existence and metadata are protected at the same level as case content.
- **SS-TM-007:** Guardian access requires current verified SIS authority, portal permission and a CARE release decision.
- **SS-TM-008:** Student access requires an explicit age/capacity/policy-aware CARE release decision.
- **SS-TM-009:** Consent never bypasses tenant, custody/restriction, need-to-know, legal hold or safeguarding controls.
- **SS-TM-010:** Machine credentials never inherit human case membership.

### Assurance, approvals and emergency access

- **SS-TM-011:** Every listed high-risk action requires AAL2 and returns step-up-required at AAL1.
- **SS-TM-012:** Requester and approver are different for break-glass, high-risk export and external disclosure approval.
- **SS-TM-013:** Break-glass is resource/classification scoped, expiring, revocable, alerted and reviewed.
- **SS-TM-014:** Break-glass cannot perform bulk export, unrestricted search, deletion, membership administration or hold release.
- **SS-TM-015:** Emergency views expose only the minimum approved projection, never unrestricted source narratives.

### Audit and history

- **SS-TM-016:** Every successful CARE-C3/C4/E read produces immutable access evidence.
- **SS-TM-017:** Audit failure causes mandatory sensitive reads to fail closed.
- **SS-TM-018:** Download, print, signed URL, offline bundle, export and disclosure each produce distinct evidence.
- **SS-TM-019:** Normal application roles cannot update/delete CARE audit, access or disclosure records.
- **SS-TM-020:** Audit records omit sensitive narrative while preserving accountable scope/purpose/outcome.
- **SS-TM-021:** Material medication, clinical, counselling, safeguarding, disclosure and approval corrections preserve prior history.

### Data minimization and disclosure

- **SS-TM-022:** CARE-C3/C4 fields are excluded from general search, report, export and analytics by default.
- **SS-TM-023:** Events and notifications contain no sensitive narrative, diagnosis, medication detail, reporter identity or case type.
- **SS-TM-024:** High-risk exports use exact field/subject/recipient/expiry controls and reauthorize before download.
- **SS-TM-025:** Connector transfer is impossible unless the exact manifest and tenant approval include the data category and purpose.
- **SS-TM-026:** Guardian/student publication uses minimized versioned projections, not direct source queries.
- **SS-TM-027:** File previews, OCR/search text, derivatives and signed URLs retain source classification.

### Storage, tenancy and devices

- **SS-TM-028:** All tenant CARE tables force RLS and normal app roles cannot bypass it.
- **SS-TM-029:** Tenant identity is preserved in keys, constraints, references, caches, jobs, objects and indexes.
- **SS-TM-030:** Database pool reuse cannot leak tenant or privileged context.
- **SS-TM-031:** CARE-C3/C4 content is excluded from generic browser/PWA offline caches and telemetry.
- **SS-TM-032:** Any approved offline emergency bundle is minimum, encrypted, device-bound, expiring and remotely revocable or protected by reviewed compensating controls.
- **SS-TM-033:** Lost-device response can identify the device, bundle scope, student set and access window.

### Retention and operations

- **SS-TM-034:** Retention/destruction is policy-versioned, legal-hold aware, idempotent and evidenced.
- **SS-TM-035:** Ordinary practitioners/admins cannot hard-delete restricted records.
- **SS-TM-036:** Legal-hold release and destruction approval require AAL2 and separation of duties.
- **SS-TM-037:** Incident response can revoke sessions/grants/credentials, isolate tenant/connector/device and query affected disclosure scope.
- **SS-TM-038:** Production, preview and test artifacts contain no real student-support data.
- **SS-TM-039:** CARE-01 never directly updates SIS, INT, OPS or foundation-owned tables.
- **SS-TM-040:** Any required frozen-contract change is documented and approved before implementation continues across that boundary.

## 18. Migration and RLS requirements

CARE migrations must meet all of these requirements:

1. Create only CARE-owned objects in `health`, `behavior`, `wellbeing`, `safeguarding` and `learning_support`, plus CARE-owned module migration metadata where approved.
2. Use sortable migration IDs containing `CARE-01`; do not alter another module's tables, enums, triggers or policies.
3. Add `tenant_id NOT NULL` to every authoritative tenant record and use tenant-preserving composite keys/references where cross-row identity matters.
4. Enable and force RLS on every tenant-owned table before granting `app_runtime` access. Verify the runtime role is non-owner and non-`BYPASSRLS`.
5. Deny on missing tenant setting. Do not use a permissive fallback or an unscoped maintenance policy for application traffic.
6. Add application-level policy for case membership, purpose, relationship and field masking; where database policies/views enforce restricted membership, helper functions must have fixed `search_path`, minimal privileges and tenant-safe inputs.
7. Create effective/expiry/revocation constraints for case membership, publication, consent/basis evidence, break-glass scope and approvals.
8. Enforce separation of duties for approval records where database constraints can express it; application tests remain mandatory.
9. Make access/disclosure/decision evidence append-only against update/delete by normal roles. Use foundation audit primitives compatibly or a CARE-owned extension when required fields are unavailable.
10. Protect documents/exports through metadata references; no raw file bytes, reusable URLs, credentials or encryption keys in CARE tables.
11. Add indexes supporting tenant + student/case + effective/status queries without enabling unbounded global search.
12. Backfills are bounded, resumable, idempotent and classification-aware; they cannot default existing data to a less restrictive class.
13. Replay migrations from an empty database and from exact reviewed Wave 1 integration state on the CARE Neon branch, then independently replay on a fresh branch before integration.
14. Validate all CARE tenant tables for forced RLS, expected runtime policies, no-context denial, tenant A/B isolation, case member/non-member behavior, expired membership and pooled-context reuse.
15. Use synthetic adversarial fixtures only. Migration/error output must not print sensitive payloads.

## 19. Mandatory negative tests

CARE-01 cannot pass its security or completion gates without executable negative tests for at least:

### Tenant and context

- tenant A token/request/job against tenant B student, case, file, export and audit IDs;
- missing tenant context, malformed tenant context and tenant-context leakage after pooled connection reuse;
- background export/notification worker with missing or mismatched tenant/purpose context;
- cross-tenant signed URL/object key and external identifier lookup.

### Roles, relationships and case scope

- general admin/principal/finance/HR/admissions/report-builder requesting restricted health or safeguarding data;
- teacher outside current assignment and teacher requesting counselling/safeguarding narrative;
- guardian with pending/expired/rejected authority, `portalAccess = false`, wrong child or restriction reference;
- student requesting unreleased/withheld records;
- counselor, nurse, behavior lead or learning-support worker requesting an unassigned case/student;
- case member after expiry/revocation/closure and suspended staff account;
- support operator without approved active tenant support grant.

### AAL2 and approvals

- AAL1 attempts for medication administration, safeguarding read, external disclosure, membership change, break-glass, export, legal hold or destruction;
- self-approval of break-glass/export/disclosure and approval after expiry;
- expired/revoked grant, scope/class mismatch and break-glass bulk export/search attempt;
- ordinary tenant admin attempting to grant themselves CARE-C4 content access.

### Audit and disclosure

- simulated audit persistence failure proving sensitive read fails closed;
- successful list/search/document/print/export/offline access with missing evidence must fail the test;
- attempts to update/delete access/disclosure evidence under `app_runtime`;
- audit metadata test proving no sensitive narrative/token/file URL is copied;
- export requested with extra column, excess row count, stale approval, changed recipient or reused link;
- connector using excessive category/scope or a different manifest version;
- event/webhook/notification serialization containing prohibited sensitive fields.

### Retention, files and offline

- delete while legal hold is active, hard delete by practitioner, destruction without AAL2/approval;
- file preview/OCR/thumbnail with weaker authorization than source;
- signed URL after authority revocation or expiry;
- CARE-C3/C4 response entering service-worker/browser cache or telemetry fixture;
- stale/revoked offline bundle and duplicate/conflicting offline medication sync;
- lost-device revocation preventing further bundle refresh/access.

### Enumeration and inference

- unauthorized case ID returns no existence detail;
- counts, badges, search suggestions, timing-sensitive routes and error codes do not reveal safeguarding/counselling existence;
- aggregate reports suppress or reject groups that permit likely re-identification.

## 20. Incident response requirements

CARE-01 must publish and test runbooks for:

- compromised staff/guardian account;
- lost/stolen managed or unmanaged device;
- cross-tenant access or pooled-context leak;
- unauthorized case membership, support session or break-glass misuse;
- wrong-recipient notification or external disclosure;
- exposed export, signed URL or document object;
- malicious/over-scoped connector or provider compromise;
- audit logging outage/tampering;
- premature deletion or legal-hold failure;
- database/object-store corruption and restore.

Runbooks require immediate session/grant/credential revocation, tenant/connector/device isolation switches, evidence preservation, affected student/record/recipient/time-window queries, child-safety escalation, tenant communication, jurisdictional clock tracking, restore/reconciliation and corrective-action review. Incident tooling must remain tenant-scoped and avoid exporting full narratives merely to establish scope.

## 21. CARE-01 implementation guardrails

1. Start CARE-01 from exact reviewed Wave 1 SHA `8cc8ee1562ade672b14c1c44af935fe7e2307976` on declared branch/worktree/Neon branch.
2. Implement the security contract and its executable test catalog before broad domain/UI work.
3. Consume SIS `PersonReference`, `EnrollmentReference`, `GuardianAuthoritySnapshot` and approved consent evidence through public contracts; do not join or write SIS internals.
4. Consume INT connector/export governance; do not bypass manifests, approvals, scopes, categories or disclosure events.
5. Do not modify active OPS-01 paths or use OPS medical/allergen references as authoritative CARE data. OPS consumes only minimized approved CARE references.
6. Public CARE APIs require request context with tenant, principal, assurance, correlation, purpose and device/session evidence as applicable.
7. Queries are bounded and deny by default; application services and UI cannot access the database directly.
8. No `care.*`, `student-support.admin-all` or equivalent broad permission is allowed to unlock restricted content.
9. UI must implement unauthorized, restricted, masked, withheld, step-up-required and break-glass states without revealing hidden case existence.
10. Domain events, logs, metrics, traces, errors, fixtures and screenshots contain no restricted narrative or real data.
11. Notifications use reviewed safe templates and reauthorize at destination.
12. General exports/reports/analytics and integrations remain denied until an explicit minimized contract is implemented and tested.
13. AI inference, summarization, risk scoring, diagnosis or automated adverse action is outside the approved initial CARE scope.
14. Any frozen foundation/SIS/INT contract gap triggers the documented contract-change process; CARE does not silently edit shared packages.
15. No production deployment, production data mutation or destructive migration is authorized by this gate.

## 22. Gate acceptance evidence

`GATE-STUDENT-SUPPORT-THREAT-MODEL` is passed because the reviewed architecture and current integrated contracts can support a CARE implementation that is:

- classified and deny-by-default;
- case-, relationship-, purpose- and assurance-scoped;
- read/disclosure logged with immutable evidence;
- guardian/student visibility controlled separately;
- break-glass constrained and reviewable;
- tenant-isolated across database, jobs, files, caches and integrations;
- export/notification/offline safe by default;
- retention/legal-hold and incident-response aware;
- backed by explicit invariant IDs, database requirements and mandatory negative tests.

The gate authorizes CARE-01 to begin milestone `security-contract`. It does not pass `GATE-CARE-COMPLETE`. CARE-01 must implement and prove these controls, create its declared Neon branch with synthetic data, and satisfy module completion evidence before integration.

## 23. Residual decisions for launch review

These are implementation/configuration decisions, not blockers to begin CARE-01, and must be resolved before real-data pilot:

- launch-country legal basis, mandatory-reporting and guardian/student access rules;
- category-specific retention/destruction periods and legal-hold authorities;
- exact emergency/break-glass duration and independent review SLA;
- roles legally permitted to administer medication and approve clinical corrections;
- field-level encryption/key-rotation profile and managed-device/offline policy;
- aggregate reporting suppression thresholds;
- approved external professional/agency exchange profiles, subprocessors and regions;
- operational ownership for access review, incident escalation and audit reconciliation;
- restoration of repository `PRODUCT.md`/`DESIGN.md` authority before CARE UI completion evidence.
