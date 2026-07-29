# UX-01 — Smooth operational experience

## Purpose

Make the composed school platform feel like one continuous application: users keep their context while moving between tasks, navigation uses familiar school language, and background preparation never replaces a usable screen with a detached loading page.

## Reviewed base

- Repository: `rahmatullahboss/international-school-management-platform`
- Main base: `4c0564642081bad534d73d96fd7d80c0052dca16`
- Working branch: `ux/smooth-operational-experience-v1`
- Deployment target: existing non-production Cloudflare staging Workers
- Product authority: `PRODUCT.md`
- Visual authority: `DESIGN.md`
- Research: `../design/04-operational-ux-continuity-research.md`
- Architecture decision: `../adr/ADR-008-client-navigation-and-data-continuity.md`

## User problems

1. Internal links cause a browser document navigation and rebuild the React application.
2. A top-level Suspense fallback replaces the whole screen while a role bundle loads.
3. Flat module lists use internal or broad labels that require users to remember where tasks live.
4. Generic action text such as “Open” does not explain what will happen next.
5. Role switching competes visually with the current role’s primary work.
6. Future API loading needs a clear background-refresh contract before real read models are connected.

## Scope

### Navigation continuity

- same-origin application links use History API navigation;
- browser back and forward remain functional;
- external, download, hash, new-tab, modifier-click and offline links keep native behaviour;
- role bundles preload on hover, focus and suitable idle time;
- the current screen remains mounted until the destination bundle is ready;
- navigation uses a thin progress indicator and polite live status rather than a full-screen loading page;
- supported browsers use a short View Transition; reduced-motion users receive an immediate transition.

### Information architecture

- navigation is grouped by school task rather than package/module ownership;
- labels use familiar terms such as Students & admissions, Take attendance, Fees & payments and Requests & forms;
- a task finder filters long role menus by labels, descriptions and common synonyms;
- active location, role, connection status and signed-in user remain visible;
- role switching is secondary and placed in the shell footer;
- meaningful action labels identify the next step.

### Loading contract

- initial direct deep links may show a skeleton in the final shell layout;
- same-role navigation must never show the boot skeleton;
- background refresh retains the last successful authorised content;
- localized skeletons are allowed only when a task region has no safe cached data;
- progress and refresh status are available to assistive technology without moving focus prematurely.

### Visual refinement

- preserve the Operational Ledger visual world;
- reduce decorative type variation and use the approved system UI hierarchy;
- keep flat, bordered operational surfaces;
- increase scanability through compact grouped navigation, consistent icons and clearer primary actions;
- preserve responsive, RTL, keyboard, 200% zoom and low-bandwidth behaviour.

## Out of scope

- production authentication or real role sessions;
- real student/customer data;
- production-domain promotion;
- permission-aware Worker API read models;
- payment, publication, restricted-data or final-approval mutations;
- a public brand redesign;
- replacing React/Vite without a separately reviewed architecture need.

## Milestones

1. research and UX continuity contract;
2. routing and bundle-prefetch controller;
3. grouped role navigation and task finder;
4. local loading/progress surfaces and motion rules;
5. browser acceptance and native-link preservation;
6. Cloudflare staging verification;
7. documentation, exact evidence and reviewed merge.

## Gate

`GATE-UX-CONTINUITY-V1` requires:

1. format, lint, boundaries and typecheck pass;
2. all repository tests and canonical migration verification pass;
3. production builds and initial/total asset budgets pass;
4. all browser journeys pass, including no-document-reload navigation, back/forward and task search;
5. execution-artifact validation passes;
6. Cloudflare API/web deployment and live route smoke tests pass;
7. machine board, tracker, design research, ADR and release evidence are synchronized;
8. exact reviewed head is merged with expected-head protection.

## Production boundary

Passing this gate improves the synthetic pilot experience only. Production promotion still requires reviewed identity and tenant context, permission-aware Worker APIs, cache-isolation tests, approved staging seed/reset tooling, safe mutation acceptance, monitoring, backup and rollback rehearsal, owner-led UAT and explicit production authorization.
