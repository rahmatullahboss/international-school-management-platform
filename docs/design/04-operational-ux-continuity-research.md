# Operational UX continuity research

**Date:** 2026-07-30  
**Scope:** Admin, teacher, guardian and student portal navigation, information architecture, loading behaviour and interaction clarity.

## Problem observed

The pilot runtime is technically a Vite single-page application, but the interaction model behaves like a collection of separate pages:

- shared shells render ordinary same-origin `<a>` elements;
- `PilotApplication` reads `window.location.pathname` only during render and does not own browser history state;
- same-origin clicks therefore trigger a document navigation and rebuild the application;
- role bundles use a top-level `Suspense` fallback that replaces the entire screen with a dedicated loading surface;
- navigation labels and descriptions are presented as one long flat list, so new users must scan and remember too many options before they understand the product.

The result is avoidable context loss, repeated loading screens and high cognitive load even though the underlying module surfaces are already available in the same web application.

## External design-skill review

The repository-local **Impeccable 4.0.2** skill remains the primary design authority because it covers Operate-mode applications, information architecture, cognitive load, UX writing, accessibility, performance, responsive behaviour and design-system governance.

The following external skills were reviewed for complementary ideas:

1. **Anthropic frontend-design** — useful for production-grade craft and avoiding generic dashboard aesthetics. Its visual guidance is secondary to this product's approved Operational Ledger design system.
2. **Microsoft frontend-design-review** — useful as a review checklist because it evaluates frictionless insight-to-action, quality craft and trustworthy behaviour. Its emphasis on obvious primary actions, progressive disclosure and clear entry/exit points is adopted.
3. **UI/UX Pro Max** — useful as a broad pattern catalogue covering accessibility, interaction states, responsive layouts and stack-specific checks. It is not adopted as a source of visual truth because the repository already has a governed design system.
4. **Figma design-system rules** — useful later when an approved Figma library exists. It is not a current dependency because no Figma source of truth is approved for this project.

No external skill is copied into the proprietary repository. Research outcomes are translated into project-specific requirements and the existing Impeccable workflow remains authoritative.

## Authoritative interaction research

### Navigation continuity

React Router documents client-side links, active and pending navigation states, route prefetch and view transitions as standard mechanisms for responsive navigation. Its guidance also recommends immediate local pending or optimistic feedback rather than replacing the whole interface.

This project does not need a framework migration to obtain those behaviours. React 19, the History API, dynamic imports and the View Transition API are sufficient for the current pilot while avoiding a new routing dependency and preserving the existing JavaScript budget. A later API-heavy phase may adopt React Router data routes if nested loaders, actions and fetchers become materially useful.

### Background data continuity

TanStack Query documents cache-first reads, background refetching, placeholder/previous data and stale-data revalidation. The production data layer should therefore keep last successful content visible while a refresh runs, distinguish initial pending from background fetching, and avoid a full-page loading state after usable data exists.

The current pilot uses synthetic in-memory read models, so this work establishes the interaction contract and routing continuity now. Permission-aware Worker API integration will implement the same stale-while-revalidate contract rather than introducing another blocking screen.

### Recognition over recall

Nielsen Norman Group's recognition-over-recall heuristic supports visible choices, meaningful labels and reduced memory burden. Its writing guidance also favours information-bearing link text and concise, scannable headings. The portal navigation will therefore use task groups, familiar school-language labels, visible active location and meaningful action text instead of a flat module catalogue or generic “Open” links.

### Accessibility of dynamic updates

WCAG status-message guidance requires dynamic waiting, success and progress updates to be programmatically determinable without stealing focus. Navigation progress will use a small polite live region while the current screen remains available. Focus moves to the new main heading only after navigation completes, and reduced-motion preferences disable animated view transitions.

## Adopted UX principles

1. **Preserve the user's place.** The application shell and current content remain visible while a target role bundle or background request prepares.
2. **Never use a full-screen loader for in-app navigation.** Initial deep-link boot may use an in-layout skeleton, but link clicks use a thin progress indicator and retain the previous view.
3. **Prefetch on intent.** Role bundles preload on pointer hover, keyboard focus and idle time when the connection is suitable.
4. **Cache before network.** Once real APIs are connected, render cached or previous data immediately and revalidate in the background.
5. **Group by user task, not internal module.** Navigation sections use plain school language such as Start, Students, Teaching, Money, School services and Support.
6. **One clear next step.** Each page identifies primary actions and uses meaningful action labels such as Review, Take attendance or View statement.
7. **Show location and state.** Active navigation, page title, connection state and pending updates remain visible.
8. **Progressive disclosure.** Primary destinations are always visible; descriptions and lower-frequency details appear contextually rather than competing equally.
9. **Motion explains continuity.** Transitions are short, subtle and disabled under `prefers-reduced-motion`.
10. **No unauthorized disclosure.** Prefetching and pending indicators never expose restricted route names, record counts or sensitive narratives beyond the user's capabilities.

## Technical decision

The first implementation keeps **React 19 + Vite** and adds a small application-owned navigation controller:

- intercept eligible same-origin application links;
- use `history.pushState`, `replaceState` and `popstate`;
- preload dynamic role modules before committing a route;
- keep the current screen rendered during preparation;
- expose a non-blocking progress line and accessible status message;
- use `document.startViewTransition` when supported and motion is allowed;
- preserve modifier-click, new-tab, download, external URL, hash-link and offline-page behaviour;
- restore focus to the new task heading after the transition.

This solves the observed UX defect without changing the domain framework, introducing route-loader coupling or increasing the production dependency surface.

## Information-architecture changes

- Add task groups to shared navigation items.
- Add a lightweight task finder for long role menus.
- Show short labels by default and the active destination's explanation in context.
- Add consistent visual symbols as secondary recognition cues; text remains authoritative.
- Rename vague labels where a familiar school term is available.
- Replace generic “Open” queue links with meaningful review/continue language.
- Keep role switching available but visually secondary to the current job.

## Acceptance criteria

`GATE-UX-CONTINUITY-V1` passes only when:

1. internal navigation does not trigger a document reload;
2. same-role route changes do not display a full-screen loading surface;
3. role bundles preload on intent and current content remains visible if preparation is still required;
4. browser back/forward navigation works;
5. active destination and navigation progress are exposed accessibly;
6. modifier-click, new-tab, external, hash, download and offline links retain native behaviour;
7. navigation is grouped and searchable using user-facing school terms;
8. reduced-motion, keyboard, mobile, RTL and 200% zoom behaviours remain valid;
9. repository tests, browser journeys, build budgets and Cloudflare staging smoke tests pass;
10. documentation and machine-readable program state record the exact reviewed result.

## Later production-data milestone

When permission-aware Worker APIs replace synthetic read models, add a governed query/cache layer with:

- tenant, campus, persona and permission scope in every query key;
- cached data visible during background revalidation;
- route-intent prefetch for authorized destinations only;
- localized inline skeletons only when no safe cached data exists;
- optimistic updates only for approved low-risk mutations;
- cancellation, duplicate protection, offline replay and explicit reconciliation;
- accessible background refresh and save-status messages;
- negative tests proving cache isolation across tenant, role and relationship changes.
