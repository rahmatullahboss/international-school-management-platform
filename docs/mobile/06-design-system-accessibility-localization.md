# 06 — Design System, Accessibility and Localization

## 1. Design authority

`PRODUCT.md`, `DESIGN.md` and the repository design governance remain authoritative. Mobile translates the same operational principles into native adaptive components; it does not invent an unrelated visual brand.

The mobile experience preserves:

- exception-first task hierarchy;
- traceable values and statuses;
- explicit permission, publication, lock, assurance, offline and recovery states;
- restrained action colour;
- flat, bordered information structure;
- written labels in addition to colour/icon status;
- age-appropriate student language;
- low-bandwidth and weak-network usability.

## 2. Token mapping

Create semantic Flutter tokens rather than copying web CSS values directly into screens.

Required token groups:

- colour: surface, canvas, text, muted, action, focus and semantic status;
- typography: display, title, body, label, numeric/tabular and child-facing variants;
- spacing and density;
- shape and border;
- elevation for functional overlays only;
- focus, pressed, selected, disabled and loading states;
- motion duration/easing with reduced-motion alternatives;
- touch target and adaptive navigation breakpoints.

Feature code consumes named semantic tokens. Literal colours, typography and spacing require design-system review.

## 3. Application shells

Both apps show, where safe and relevant:

- school/tenant identity;
- active persona;
- campus/class/child context;
- network and sync state;
- active destination;
- notification state;
- session/assurance warning;
- clear account/persona switching.

Family and Staff may share primitives but have separate shells and navigation registries.

## 4. Adaptive layouts

Layouts respond to available space, text scale, input method and orientation—not device-name assumptions.

- compact phones use bottom navigation or focused task routes;
- larger phones/tablets may use navigation rail, split view or master-detail;
- landscape and split-screen remain usable;
- large text can replace side-by-side layouts with a single reading order;
- foldable/hinge areas are treated as unavailable layout regions when platform support exists;
- critical actions remain reachable without precision gestures.

Large complex widgets are decomposed into small testable widgets. Performance-sensitive lists use lazy rendering and stable keys.

## 5. Accessibility baseline

Target functional equivalence with WCAG 2.2 AA intent plus Android and Apple platform accessibility guidance.

Every feature verifies:

- TalkBack and VoiceOver reading order;
- meaningful labels, hints, roles, values and live announcements;
- logical focus traversal and external-keyboard operation;
- visible focus for keyboard/switch users;
- minimum touch targets;
- text scaling/reflow at the supported maximum policy;
- sufficient contrast and non-colour status cues;
- reduced motion;
- accessible validation and error summaries;
- accessible authentication and biometric fallback;
- chart/table text alternatives;
- no timeout that cannot be extended where the workflow allows.

Semantics are part of component APIs and widget tests, not post-release patches.

## 6. Localization

Use Flutter localization generation with stable translation keys and structured placeholders.

Required support:

- user locale with tenant fallback;
- Bangla and English launch readiness, with architecture supporting additional locales;
- RTL layout and mirrored navigation;
- plural/select rules;
- native-script, preferred and legal names;
- locale-aware date, time, number and currency formatting;
- IANA time-zone context supplied by platform contracts;
- long translation and pseudolocalization tests;
- localized notification keys and safe fallback;
- localized server error keys rather than concatenated English strings.

Do not use flags as language selectors or assume Western name/address structures.

## 7. Content rules

- Use actual school terminology, not vague product language.
- Define every metric/status and its timestamp/scope.
- State whether data is draft, published, cached, stale or pending sync.
- Explain why an action is disabled when permission, assurance, lock or prerequisite is responsible.
- Avoid exposing denied record existence.
- Student content is shorter, direct, age-appropriate and privacy-preserving.
- Guardian content makes the active child explicit before sensitive actions.
- Staff content makes active class/session/campus explicit.

## 8. Component set

Foundation components include:

- app shell and adaptive navigation;
- context/persona/child switchers;
- primary/secondary/destructive buttons;
- text, selection, date and search fields;
- status label and evidence banner;
- offline/stale/sync/conflict panels;
- loading/empty/restricted/masked/error states;
- lists, definition groups and mobile data rows;
- notification/message rows;
- document tile with classification/download state;
- confirmation and step-up dialogs;
- retry/reconciliation controls;
- form progress and validation summary.

Business-specific components remain in feature packages.

## 9. Platform conventions

Respect Android and iOS conventions for back behavior, sheets/dialogs, share/file pickers, permission prompts and system settings. Shared product identity does not justify fighting platform accessibility or navigation expectations.

The app must correctly handle:

- Android system back/predictive back according to supported SDK policy;
- iOS interactive back where safe;
- safe areas and system bars;
- light/dark system appearance if/when approved;
- keyboard avoidance and input actions;
- permission denial and settings return;
- app lifecycle state restoration only for non-sensitive safe state.

## 10. Offline UX

Offline state is visible but not alarming when expected. Every cached surface shows freshness. Pending writes remain attached to their records and can be reviewed.

Conflict UX states:

- what changed;
- which data was preserved;
- whether the server accepted anything;
- who can resolve it;
- exact next action;
- correlation/reference ID for support where appropriate.

Do not silently discard, auto-merge high-risk data or rely on toast-only errors.

## 11. Design delivery evidence

Each UI checkpoint records:

- approved `PRODUCT.md` and `DESIGN.md` SHAs;
- surface brief and persona/job;
- component/token usage;
- critique and audit results;
- responsive phone/tablet evidence;
- long-content, Bangla and RTL evidence;
- TalkBack/VoiceOver and keyboard checks;
- text scaling and reduced-motion checks;
- offline/error/restricted states;
- performance trace where relevant;
- final polish result.

## 12. Design change control

A new global token, navigation model, shell pattern or cross-app component requires foundation ownership review. Feature streams may extend through documented slots but cannot silently fork the design system.
