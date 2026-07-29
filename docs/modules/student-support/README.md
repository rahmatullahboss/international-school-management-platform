# CARE-01 — Health, Wellbeing and Safeguarding

CARE-01 owns the restricted student-support domains and the controls that prevent ordinary school
administration roles from inheriting sensitive access.

## Implemented domains

- [Security contract](./security.md) — 40 mandatory threat-model invariants, need-to-know access,
  AAL2, break-glass, immutable read evidence, safe notification, offline emergency access,
  retention, legal hold, export and connector approval.
- [Health and clinic](./health.md) — health profiles, allergy and medication safety, clinic
  encounters, care plans, emergency projections and aggregate reporting.
- [Behavior and restorative support](./behavior.md) — incidents, controlled workflow, actions,
  restorative plans, follow-up, corrections and independently approved publication.
- [Wellbeing and counselling](./wellbeing.md) — pastoral referral, assigned-counselor sessions,
  risk, support plans, safeguarding escalation and minimized publication.
- [Safeguarding](./safeguarding.md) — write-only concern intake, existence-masked cases,
  purpose-bound membership, chronology, assessment, mandatory reporting and exact disclosure.
- [Learning support](./learning-support.md) — referrals, assessments, accommodations, plans,
  classroom-safe academic projections and independently approved portal publication.

## Operational contracts

- [Permissions and role restrictions](./permissions.md)
- [Versioned API contract](./api-v1.md)
- [Events and notification contract](./events.md)
- [Restricted interface evidence](./interface-evidence.md)
- [Retention, legal hold, export and disclosure](./retention-and-disclosure.md)
- [Security incident response](./incident-response.md)
- [Recovery and migration evidence](./recovery.md)

## Integration boundaries

CARE consumes canonical SIS person, campus, guardian-authority, consent and relationship identifiers.
It consumes INT document identifiers and the reviewed integration disclosure boundary. It does not
mutate SIS, FIN or INT schemas. It does not import ACAD-01 or OPS-01 unmerged code. The only academic
integration is a public, minimized accommodation projection containing an accommodation code,
category and classroom instruction.

## Classification summary

| Class | Typical CARE data | Default handling |
| --- | --- | --- |
| `CARE-C1` | protected aggregate counts | tenant scoped; small cohorts suppressed |
| `CARE-C2` | referral metadata and approved projections | relationship or publication scoped |
| `CARE-C3` | health, counselling, learning findings and restricted follow-up | named permission, purpose, current relationship and immutable read evidence |
| `CARE-C4` | safeguarding case records | AAL2, active principal/case/purpose membership, existence masking |
| `CARE-E` | minimum emergency projection | AAL2 or approved device-bound offline bundle; short expiry |

Every sensitive read fails closed when immutable access evidence cannot be persisted. Events,
notifications, reports and broad-role interfaces never receive source narrative by default.
