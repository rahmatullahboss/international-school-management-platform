# EXP-01 Milestone 6 — Governed Communications Experience

## Scope

This milestone delivers announcements, secure messaging, email/SMS/push adapter contracts, notification preferences, multilingual templates, forms, surveys, consent, acknowledgements and delivery status across the administration, teacher, guardian and student experiences. It consumes tenant-, principal- and capability-scoped communication read models and links to approved actions; it does not read private domain tables or expose restricted support context.

## Product and design authority

- Starting checkpoint: EXP-01 Milestone 5 merge `20b33ec6c1bb9a5725a3950455970baab10194af`.
- Reviewed product authority: `PRODUCT.md` blob `5e769c75f28c0c5cc426f5b85eaf46f032a3367f`.
- Reviewed design authority: `DESIGN.md` blob `4be926a77d501dd8f16934ad4c50672ba754d66f`.
- Impeccable version: `4.0.2`.
- Mode: Operate; recipient-scoped, evidence-led, multilingual, non-disclosing and recoverable.

## Surface brief

- **Audience:** school communication operators, teachers, guardians and students working across desktops, tablets, phones, shared devices and intermittent networks.
- **Job:** read authorised announcements, acknowledge urgent notices, continue secure conversations, complete required forms or consent, manage permitted notification preferences and understand delivery state.
- **Primary action:** complete the highest-priority acknowledgement, response or unread secure conversation available to the current principal.
- **Constraints:** exact tenant/principal/capability filtering, masked destinations, no restricted-case leakage, locked mandatory channels, multilingual fallback, adapter failure recovery, mobile/RTL layout, keyboard access, reduced motion and long translated content.
- **Memorable moment:** an urgent translated notice, its required acknowledgement and its delivery evidence remain connected without revealing another household, tenant or restricted record.

## Contract

`CommunicationsWorkspace` accepts announcements, secure threads, required actions, delivery records, preferences and adapter-health evidence. `selectScopedCommunications` checks tenant, principal visibility and capability before sorting, counting or rendering. `resolveLocalizedCopy` applies exact locale, language and default-locale fallback. `NotificationDispatcher` plans in-app/email/SMS/push delivery, honours editable opt-outs, preserves locked mandatory channels, converts missing or failed adapters into traceable failures and never exposes provider credentials.

## Implementation checkpoint

- Priority-sorted multilingual announcements with acknowledgement state and expiry.
- Secure threads with explicit participants, unread counts, reply capability and read-only lock state.
- Forms, surveys, consent and acknowledgements with subject, due date and lifecycle state.
- Masked delivery ledger for in-app, email, SMS and push outcomes.
- Editable and locked notification preferences with written reasons.
- Email/SMS/push adapter contracts plus authorised provider-health evidence.
- Shared persona wrappers for admin, teacher, guardian and student applications.
- Capability-aware administration navigation for the communications workspace.
- Loading, recoverable error and non-disclosing empty states.

## Design critique, audit and polish

- Preserves the Operational Ledger visual authority: institutional ink, paper, structural rules and restrained action teal.
- Leads with urgent notices, unread communication and responses due instead of disconnected metric cards.
- Uses written priority, action, delivery and adapter-health labels; colour never carries meaning alone.
- Keeps delivery evidence in a labelled keyboard-focusable overflow region with masked destinations.
- Uses logical CSS properties and responsive single-column collapse for RTL and narrow screens.
- Avoids decorative shadows, gradients, nested cards, excessive pills and motion.
- Browser evidence covers mobile RTL layout, contained table overflow and keyboard focus; reduced-motion rules remain explicit.

## Verification

Canonical formatter and localization assertion checkpoint `4b9629fee735c7f6dbcd9561ed14a4207e8ba3ff` passed local format, lint, architecture boundaries, typecheck, full build, focused communications tests `7/7`, full repository tests `487/487` with one credential-gated local skip, and EXP browser tests `4/4`.

GitHub CI run `30460170124` passed format, lint, architecture boundaries, repository typecheck, all tests, fresh 40-migration PostgreSQL replay, live Neon driver, build, dependency audit, licences, provenance, every Chromium suite and execution-artifact validation. No production deployment or production database mutation was performed.

## Next milestone

Milestone 7 — authorised document generation/download, evidence-defined dashboards, standard report catalog, asynchronous report jobs, drill-down and permission-aware exports.
