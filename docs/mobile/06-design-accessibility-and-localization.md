# 06 — Mobile Design, Accessibility and Localization

## 1. Design authority

`DESIGN.md` remains the product-wide visual and semantic authority. Mobile does not create a separate visual brand. It maps the existing operational design language into native Flutter components while respecting platform conventions and touch-first use.

The mobile design objective is not to compress web screens. Each workflow is reshaped around portable, time-sensitive and small-window use while preserving evidence, definitions, permission state and recovery.

## 2. Semantic token mapping

Create a generated or reviewed Flutter token package containing:

- institutional ink, action teal, focus blue, paper, canvas and structural rule;
- information, success, warning and error surface/text pairs;
- system typography intent and locale-aware fallbacks;
- spacing scale `8/12/16/24/32/48`;
- control radius `8` and major surface radius `16`;
- borders, focus treatment, touch targets and motion durations;
- light/dark/high-contrast adaptations only after explicit review.

Feature code references semantic tokens such as `actionPrimary` or `statusWarningSurface`, never raw hex values.

## 3. Mobile component baseline

Shared components include:

- app shell and scoped masthead;
- compact/expanded navigation;
- tenant/persona/child/class switchers;
- sync/network status region;
- primary, secondary, destructive and text actions;
- labelled fields and validation summaries;
- record/list rows with definition and metadata;
- publication/finalization/assurance status;
- loading, empty, stale, offline, denied, masked, read-only, partial-success and conflict states;
- evidence/source/timestamp disclosure;
- attachment/document upload/download state;
- confirmation and step-up flows;
- accessible data-table alternative for compact screens.

Pills are limited to true status/filter/tag semantics. Decorative nested cards, gradients, glows and excessive shadows remain prohibited.

## 4. Adaptive layout

Layout decisions use available window size and capabilities, not device labels or orientation assumptions.

Guidance:

- compact: bottom navigation or small destination set, single-column task flow;
- medium: navigation rail/drawer and optional master-detail;
- expanded: persistent navigation, list-detail or supporting pane when useful;
- foldable/multi-window: respond to actual display features/window bounds;
- avoid locking orientation;
- preserve task state across resize, rotate, fold/unfold and process restoration;
- constrain readable line length and form width on large screens;
- design touch first, then add keyboard/mouse accelerators.

Not every feature belongs on every form factor. Dense configuration/report building remains web-first.

## 5. Navigation and context visibility

Every authenticated shell exposes, without leaking unauthorized information:

- school/tenant identity;
- active persona;
- active child, campus or class context when relevant;
- current destination;
- network/sync state;
- profile/session/device access route.

Context switching requires explicit labels and confirmation when unsent work exists. A screen must never silently continue showing a previous child's or tenant's data after a switch.

## 6. Accessibility baseline

Mobile targets equivalent functional accessibility to WCAG 2.2 AA using Android/iOS accessibility APIs and Flutter semantics.

Required:

- meaningful semantic labels, roles, values, states and actions;
- logical screen-reader reading/focus order;
- no status conveyed by color/icon alone;
- touch targets meeting platform accessibility guidance;
- text scaling to at least 200% without lost content/action;
- keyboard and switch-access support for critical flows;
- visible focus on large-screen/keyboard use;
- reduced-motion handling;
- screen-reader announcements for validation, sync, conflict and completion;
- alternatives for gestures requiring fine motor control;
- no forced orientation;
- accessible authentication and MFA;
- charts supplemented by text/table definitions;
- age-appropriate, direct child-facing language.

Automated semantics checks do not replace TalkBack and VoiceOver testing.

## 7. Text and content rules

- Use actual school terminology, not vague marketing language.
- Every total/status explains scope, source and timestamp where material.
- Restricted or masked states do not reveal record existence.
- Errors explain what failed, what input was preserved and the recovery action.
- Offline state distinguishes local save from server acceptance.
- Critical destructive/financial/published actions are explicit and do not rely on swipe-only gestures.
- Student language is shorter, direct and privacy-preserving.
- Guardian multi-child context is visible on every child-scoped task.

## 8. Localization

Use Flutter localization generation with structured ARB/resource files and repository validation.

Requirements:

- no user-visible source-language strings embedded in feature code;
- plural/select/interpolation support;
- user language with tenant fallback;
- locale-aware date, time, number and currency formatting;
- IANA time-zone/campus context from backend contracts;
- native-script, preferred and legal names supported without Western name assumptions;
- long-content and pseudo-localization tests;
- RTL mirroring and logical layout;
- avoid flags as language selectors;
- translated push content uses approved localization keys or safe generic fallbacks;
- server-generated documents/messages retain their own reviewed language/version evidence.

Initial test locales must include English, Bangla and one RTL locale using synthetic content. Launch locales require human review.

## 9. Forms and input

- persistent explicit labels; placeholders are not labels;
- correct keyboard/input type and autofill only where privacy-safe;
- validation summary plus field-level message;
- preserve user input on server/offline errors;
- show version conflict and changed form fields;
- avoid auto-submission or duplicate taps;
- camera/document permissions requested just in time;
- date/time input respects locale and academic/campus context;
- sensitive data is masked with accessible reveal controls when allowed;
- drafts show storage/sync status and expiry.

## 10. Tables and dense records

Mobile must not remove meaning to appear sparse.

For dense data:

- provide labelled row/detail views preserving column labels;
- use horizontal table scroll only when task-appropriate and accessible;
- keep definitions, totals and source evidence available;
- provide search/filter/sort through bounded server contracts;
- avoid turning every field into a decorative card;
- maintain stable reading and focus order.

## 11. Motion and feedback

- Motion communicates navigation, progress or state—not decoration.
- Respect reduced-motion settings.
- Avoid long blocking animations during attendance or urgent workflows.
- Haptic feedback is supplemental and never the only status signal.
- Loading controls preserve labels and prevent duplicate submission.
- Background sync progress is persistent in the task context, not toast-only.

## 12. Design delivery evidence

Each UI-bearing mobile checkpoint records:

- `PRODUCT.md` and `DESIGN.md` SHAs;
- mobile documentation/ADR SHA;
- surface brief and persona/job;
- capability, data classification and offline policy;
- shape and alternative considered;
- critique and audit results;
- design detector/static token checks;
- compact/medium/expanded evidence;
- TalkBack/VoiceOver, keyboard, text-scale and reduced-motion evidence;
- RTL, Bangla, long-content and pseudo-localization evidence;
- loading/offline/conflict/denied/masked states;
- final hardening and polish result.

A visually polished happy path without these states is incomplete.

## 13. Acceptance scenarios

At minimum verify:

- guardian with one, multiple and no linked children;
- user who is both guardian and teacher;
- student with unpublished versus published results;
- teacher with large names/roster and intermittent network;
- permission removed while a screen is open;
- large text and TalkBack/VoiceOver during attendance submission;
- Bangla and RTL navigation/context switching;
- foldable/tablet split-screen;
- denied sensitive record with no information leakage;
- partial sync success and conflict reconciliation;
- shared/low-cost device performance.
