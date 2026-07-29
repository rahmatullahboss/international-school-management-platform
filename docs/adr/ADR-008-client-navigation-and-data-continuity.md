# ADR-008: Persistent client navigation and data continuity

- **Status:** Accepted for UX continuity v1
- **Date:** 2026-07-30
- **Decision owners:** Platform experience and integration
- **Related gate:** `GATE-UX-CONTINUITY-V1`

## Context

The pilot portal is built with React and Vite, but same-origin links currently perform document navigation. The application then reloads its entry bundle, resolves a role from `window.location.pathname`, downloads a lazy role bundle and renders a full-screen Suspense fallback. This causes a visible blank-context transition for actions that should feel like movement inside one application.

The platform also needs a durable rule for future Worker API loading: users must not lose usable content merely because a background refresh, permission check or route prefetch is running.

## Decision

### Routing

Keep React 19 and Vite. Introduce an application-owned client navigation controller that:

- intercepts only eligible same-origin application links;
- preserves native browser behaviour for external links, downloads, hashes, modifier clicks, new tabs and the standalone offline page;
- uses the History API and handles `popstate`;
- preloads role bundles on pointer intent, focus and suitable idle time;
- commits route state only when the target role bundle is ready;
- keeps the current screen mounted while preparation runs;
- reports progress through a non-blocking visual line and polite status region;
- uses the View Transition API when available and motion is permitted;
- moves focus to the new task heading after route completion.

### Loading states

- In-app navigation must not replace the whole interface with a loading page.
- Initial direct navigation to an unloaded role may use a skeleton that occupies the final shell layout.
- Same-role navigation is synchronous after the role bundle is loaded.
- Background refresh never removes last successful authorized data.
- Localized skeletons are allowed only when a task region has no safe cached or previous data.

### Data layer

The current synthetic pilot remains dependency-light. A query library is not added solely to mask static data.

When permission-aware Worker APIs are connected, the implementation should use a governed stale-while-revalidate cache contract. TanStack Query is the preferred candidate because it explicitly distinguishes initial pending from background fetching, supports cached/previous data, prefetch, cancellation and optimistic updates. Adoption requires a separate review of query-key tenant isolation, bundle budget, offline replay and mutation safety.

## Alternatives considered

### Replace the application with another frontend framework

Rejected. The defect is caused by navigation and loading architecture, not by React or Vite. A framework rewrite would add risk without improving the domain model, permissions or accessibility.

### Add React Router immediately

Deferred. React Router provides excellent active/pending links, prefetch, data routes, fetchers and view transitions. The current route graph is small and already described by shared role shells, so a focused navigation controller solves the immediate defect with less dependency and migration cost. React Router remains a valid later option if route loaders, nested actions or framework-level prefetch become necessary.

### Eagerly bundle every role

Rejected. It removes chunk-loading delay but increases the initial payload for users who need only one role, including guardians and students on constrained devices. Intent and idle prefetch preserve smoothness without making every first visit pay the full cost.

### Keep full-screen Suspense fallback

Rejected for in-app transitions because it destroys context, produces a perceived page reload and conflicts with the Operational Ledger rule that loading and error states occupy the same task location as eventual content.

## Consequences

### Positive

- Same-origin navigation feels continuous.
- Role bundles remain code-split.
- Browser history and deep links remain valid.
- No new runtime dependency is required for v1.
- The design and accessibility contract for future API loading is explicit.

### Trade-offs

- The navigation controller must be covered by browser tests because it is application infrastructure.
- Link interception must remain conservative to avoid breaking native browser affordances.
- Cross-role transitions may retain the previous role screen briefly while the new bundle prepares; the pending status must clearly identify that navigation is underway.
- Future production APIs still require a reviewed cache/query implementation.

## Verification

- Browser tests cover no-reload navigation, active route changes, back/forward, intent prefetch and native-link exemptions.
- Accessibility checks cover focus restoration, status announcements and reduced motion.
- Build budgets verify that route continuity does not regress constrained-device delivery.
- Cloudflare smoke tests verify deep links and the live SPA fallback.
