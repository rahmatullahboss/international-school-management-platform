# SIS Admissions

The admissions bounded context supports enquiries, applicants, cycles, immutable published form versions, versioned application responses, program choices, document requirements, checklists, reviews, interviews, confidential references, decisions, offers, contracts, external billing references and applicant conversion.

Submitted response versions are immutable in both the domain workflow and PostgreSQL. Corrections append a superseding response version. Offer acceptance requires an unexpired admit offer, completed required checklist and a signed contract when a contract exists.

Applicant conversion is replay-safe through tenant-scoped idempotency keys and a unique application conversion. One accepted application can produce only one student profile/enrollment mapping. Payment and deposit values remain external billing references; SIS does not own balances or ledger postings.

Guardian status queries expose only the submitting guardian's application and omit confidential reviews/references. Migration `202607280103_SIS-01_admissions` creates 18 forced-RLS tables. Neon verification confirmed tenant isolation and rejected mutation of a submitted response.
