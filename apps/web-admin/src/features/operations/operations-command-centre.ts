export type OperationsDirection = 'ltr' | 'rtl';
export type OperationsSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface OperationsMetricInput {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly context: string;
  readonly sourceLabel: string;
  readonly href: string;
  readonly trend?: string | null;
}

export interface OperationsExceptionInput {
  readonly id: string;
  readonly severity: OperationsSeverity;
  readonly domain: string;
  readonly title: string;
  readonly detail: string;
  readonly ownerLabel: string;
  readonly ageLabel: string;
  readonly href: string;
  readonly requiredPermission: string;
}

export interface OperationsQueueInput {
  readonly id: string;
  readonly domain: string;
  readonly label: string;
  readonly count: number;
  readonly oldestAgeLabel: string;
  readonly href: string;
  readonly requiredPermission: string;
}

export interface OperationsModuleInput {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly statusLabel: string;
  readonly exceptionCount: number;
  readonly requiredPermission: string;
}

export interface OperationsQuickActionInput {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly requiredPermission: string;
  readonly stepUpRequired?: boolean;
}

export interface OperationsCommandCentreInput {
  readonly locale: string;
  readonly direction: OperationsDirection;
  readonly title: string;
  readonly subtitle: string;
  readonly asOfLabel: string;
  readonly generatedAtLabel: string;
  readonly permissions: readonly string[];
  readonly metrics: readonly OperationsMetricInput[];
  readonly exceptions: readonly OperationsExceptionInput[];
  readonly queues: readonly OperationsQueueInput[];
  readonly modules: readonly OperationsModuleInput[];
  readonly quickActions: readonly OperationsQuickActionInput[];
}

export interface OperationsCommandCentreModel extends Omit<
  OperationsCommandCentreInput,
  'metrics' | 'exceptions' | 'queues' | 'modules' | 'quickActions'
> {
  readonly metrics: readonly OperationsMetricInput[];
  readonly exceptions: readonly OperationsExceptionInput[];
  readonly queues: readonly OperationsQueueInput[];
  readonly modules: readonly OperationsModuleInput[];
  readonly quickActions: readonly OperationsQuickActionInput[];
  readonly exceptionSummary: string;
  readonly emptyState: boolean;
}

const severityOrder: Readonly<Record<OperationsSeverity, number>> = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
});

function hasPermission(permissions: readonly string[], required: string): boolean {
  if (permissions.includes(required) || permissions.includes('operations.*')) return true;
  const segments = required.split('.');
  for (let index = segments.length - 1; index > 0; index -= 1) {
    if (permissions.includes(`${segments.slice(0, index).join('.')}.*`)) return true;
  }
  return false;
}

function uniqueById<T extends { readonly id: string }>(items: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  return Object.freeze(
    items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
  );
}

export function buildOperationsCommandCentre(
  input: OperationsCommandCentreInput,
): OperationsCommandCentreModel {
  const metrics = uniqueById(input.metrics).slice(0, 8);
  const exceptions = uniqueById(input.exceptions)
    .filter((item) => hasPermission(input.permissions, item.requiredPermission))
    .sort(
      (left, right) =>
        severityOrder[left.severity] - severityOrder[right.severity] ||
        left.domain.localeCompare(right.domain) ||
        left.title.localeCompare(right.title),
    );
  const queues = uniqueById(input.queues)
    .filter((item) => item.count > 0 && hasPermission(input.permissions, item.requiredPermission))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const modules = uniqueById(input.modules)
    .filter((item) => hasPermission(input.permissions, item.requiredPermission))
    .sort(
      (left, right) =>
        right.exceptionCount - left.exceptionCount || left.label.localeCompare(right.label),
    );
  const quickActions = uniqueById(input.quickActions).filter((item) =>
    hasPermission(input.permissions, item.requiredPermission),
  );
  const critical = exceptions.filter((item) => item.severity === 'critical').length;
  const high = exceptions.filter((item) => item.severity === 'high').length;

  return Object.freeze({
    ...input,
    permissions: Object.freeze([...input.permissions]),
    metrics,
    exceptions: Object.freeze(exceptions),
    queues: Object.freeze(queues),
    modules: Object.freeze(modules),
    quickActions: Object.freeze(quickActions),
    exceptionSummary:
      exceptions.length === 0
        ? 'No open operational exceptions'
        : `${exceptions.length} open exceptions, ${critical} critical and ${high} high priority`,
    emptyState: metrics.length === 0 && exceptions.length === 0 && queues.length === 0,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeHref(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return escapeHtml(trimmed);
  return '#';
}

function severityLabel(value: OperationsSeverity): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function renderOperationsCommandCentre(model: OperationsCommandCentreModel): string {
  const exceptionRows = model.exceptions
    .map(
      (item) => `<tr>
        <td data-label="Priority"><span class="ops-badge" data-severity="${item.severity}">${severityLabel(item.severity)}</span></td>
        <td data-label="Area">${escapeHtml(item.domain)}</td>
        <td data-label="Exception"><a href="${safeHref(item.href)}">${escapeHtml(item.title)}</a><span class="ops-detail">${escapeHtml(item.detail)}</span></td>
        <td data-label="Owner">${escapeHtml(item.ownerLabel)}</td>
        <td data-label="Age">${escapeHtml(item.ageLabel)}</td>
      </tr>`,
    )
    .join('');

  const metricCards = model.metrics
    .map(
      (metric) => `<li class="ops-metric">
        <a href="${safeHref(metric.href)}" aria-label="${escapeHtml(`${metric.label}: ${metric.value}. ${metric.context}`)}">
          <span class="ops-metric__label">${escapeHtml(metric.label)}</span>
          <strong class="ops-metric__value">${escapeHtml(metric.value)}</strong>
          <span class="ops-metric__context">${escapeHtml(metric.context)}</span>
          ${metric.trend ? `<span class="ops-metric__trend">${escapeHtml(metric.trend)}</span>` : ''}
          <span class="ops-metric__source">${escapeHtml(metric.sourceLabel)}</span>
        </a>
      </li>`,
    )
    .join('');

  const queueItems = model.queues
    .map(
      (queue) => `<li>
        <a href="${safeHref(queue.href)}">
          <span><strong>${escapeHtml(queue.label)}</strong><small>${escapeHtml(queue.domain)} · oldest ${escapeHtml(queue.oldestAgeLabel)}</small></span>
          <span class="ops-count" aria-label="${queue.count} items">${queue.count}</span>
        </a>
      </li>`,
    )
    .join('');

  const moduleItems = model.modules
    .map(
      (module) => `<li>
        <a href="${safeHref(module.href)}">
          <span class="ops-module__heading"><strong>${escapeHtml(module.label)}</strong><span class="ops-status">${escapeHtml(module.statusLabel)}</span></span>
          <span>${escapeHtml(module.description)}</span>
          <small>${module.exceptionCount} open exceptions</small>
        </a>
      </li>`,
    )
    .join('');

  const actionItems = model.quickActions
    .map(
      (action) => `<li>
        <a href="${safeHref(action.href)}"${action.stepUpRequired ? ' data-step-up="aal2"' : ''}>
          <strong>${escapeHtml(action.label)}</strong>
          <span>${escapeHtml(action.description)}</span>
          ${action.stepUpRequired ? '<small>Additional verification required</small>' : ''}
        </a>
      </li>`,
    )
    .join('');

  return `<a class="ops-skip-link" href="#operations-main">Skip to operations content</a>
<main id="operations-main" class="ops-command-centre" lang="${escapeHtml(model.locale)}" dir="${model.direction}" tabindex="-1">
  <header class="ops-hero">
    <div>
      <p class="ops-eyebrow">School operations ERP</p>
      <h1>${escapeHtml(model.title)}</h1>
      <p>${escapeHtml(model.subtitle)}</p>
    </div>
    <div class="ops-as-of" aria-label="Report time">
      <span>${escapeHtml(model.asOfLabel)}</span>
      <small>${escapeHtml(model.generatedAtLabel)}</small>
    </div>
  </header>
  <p class="ops-live-summary" role="status" aria-live="polite">${escapeHtml(model.exceptionSummary)}</p>
  ${
    model.emptyState
      ? `<section class="ops-empty" aria-labelledby="ops-empty-title"><h2 id="ops-empty-title">No operational data available</h2><p>Check the selected campus, date and permissions.</p></section>`
      : `<section aria-labelledby="ops-exceptions-title" class="ops-panel ops-panel--exceptions">
    <div class="ops-section-heading"><div><p class="ops-eyebrow">Act first</p><h2 id="ops-exceptions-title">Exceptions requiring attention</h2></div><a href="/operations/exceptions">View all exceptions</a></div>
    ${
      model.exceptions.length === 0
        ? '<p class="ops-positive-state">No open exceptions for the selected scope.</p>'
        : `<div class="ops-table-wrap" tabindex="0" aria-label="Scrollable operational exceptions"><table><caption class="ops-visually-hidden">Operational exceptions ordered by severity</caption><thead><tr><th scope="col">Priority</th><th scope="col">Area</th><th scope="col">Exception</th><th scope="col">Owner</th><th scope="col">Age</th></tr></thead><tbody>${exceptionRows}</tbody></table></div>`
    }
  </section>
  <section aria-labelledby="ops-metrics-title" class="ops-panel">
    <div class="ops-section-heading"><div><p class="ops-eyebrow">Understand</p><h2 id="ops-metrics-title">Operational position</h2></div></div>
    <ul class="ops-metrics" role="list">${metricCards}</ul>
  </section>
  <div class="ops-grid">
    <section aria-labelledby="ops-queues-title" class="ops-panel"><div class="ops-section-heading"><div><p class="ops-eyebrow">Work next</p><h2 id="ops-queues-title">Approval and work queues</h2></div></div>${model.queues.length === 0 ? '<p class="ops-positive-state">No queued work.</p>' : `<ul class="ops-queues" role="list">${queueItems}</ul>`}</section>
    <section aria-labelledby="ops-actions-title" class="ops-panel"><div class="ops-section-heading"><div><p class="ops-eyebrow">Do</p><h2 id="ops-actions-title">Quick actions</h2></div></div>${model.quickActions.length === 0 ? '<p>No actions are available for this role.</p>' : `<ul class="ops-actions" role="list">${actionItems}</ul>`}</section>
  </div>
  <nav aria-labelledby="ops-modules-title" class="ops-panel"><div class="ops-section-heading"><div><p class="ops-eyebrow">Explore</p><h2 id="ops-modules-title">Operations modules</h2></div></div><ul class="ops-modules" role="list">${moduleItems}</ul></nav>`
  }
</main>`;
}

export const operationsCommandCentreCss = `
:root {
  --ops-surface: Canvas;
  --ops-surface-raised: color-mix(in srgb, Canvas 94%, CanvasText 6%);
  --ops-text: CanvasText;
  --ops-muted: color-mix(in srgb, CanvasText 68%, Canvas 32%);
  --ops-border: color-mix(in srgb, CanvasText 18%, Canvas 82%);
  --ops-accent: LinkText;
  --ops-critical: #a40019;
  --ops-high: #a34d00;
  --ops-medium: #776500;
  --ops-low: #245c46;
  --ops-radius: 0.75rem;
  --ops-space: clamp(1rem, 2vw, 1.5rem);
}
.ops-skip-link { position: fixed; inset-block-start: .5rem; inset-inline-start: .5rem; z-index: 100; transform: translateY(-200%); padding: .75rem 1rem; background: var(--ops-text); color: var(--ops-surface); }
.ops-skip-link:focus { transform: translateY(0); }
.ops-command-centre { max-inline-size: 90rem; margin-inline: auto; padding: var(--ops-space); color: var(--ops-text); background: var(--ops-surface); font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.5; }
.ops-command-centre :focus-visible { outline: .2rem solid var(--ops-accent); outline-offset: .2rem; }
.ops-hero, .ops-section-heading, .ops-module__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.ops-hero { padding-block: clamp(1rem, 3vw, 2.5rem); border-block-end: 1px solid var(--ops-border); }
.ops-hero h1 { margin-block: .25rem; font-size: clamp(1.8rem, 4vw, 3.5rem); line-height: 1.05; letter-spacing: -.035em; }
.ops-eyebrow { margin: 0; color: var(--ops-muted); font-size: .75rem; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.ops-as-of { min-inline-size: 12rem; text-align: end; }
.ops-as-of span, .ops-as-of small { display: block; }
.ops-live-summary { margin-block: 1rem; padding: .75rem 1rem; border-inline-start: .25rem solid var(--ops-accent); background: var(--ops-surface-raised); }
.ops-panel { margin-block: var(--ops-space); padding: var(--ops-space); border: 1px solid var(--ops-border); border-radius: var(--ops-radius); background: var(--ops-surface); }
.ops-panel--exceptions { border-block-start-width: .25rem; }
.ops-section-heading h2 { margin-block: .2rem 0; font-size: clamp(1.2rem, 2vw, 1.6rem); }
.ops-section-heading a { white-space: nowrap; }
.ops-table-wrap { max-inline-size: 100%; margin-block-start: 1rem; overflow: auto; }
table { inline-size: 100%; border-collapse: collapse; }
th, td { padding: .8rem; border-block-end: 1px solid var(--ops-border); text-align: start; vertical-align: top; }
th { color: var(--ops-muted); font-size: .8rem; }
.ops-detail, .ops-metric span, .ops-queues small, .ops-actions span, .ops-actions small, .ops-modules span, .ops-modules small { display: block; }
.ops-detail, .ops-metric__context, .ops-metric__source, .ops-queues small, .ops-actions span, .ops-actions small, .ops-modules span, .ops-modules small { color: var(--ops-muted); }
.ops-badge { display: inline-block; padding: .15rem .5rem; border: 1px solid currentColor; border-radius: 999px; font-size: .75rem; font-weight: 700; }
.ops-badge[data-severity="critical"] { color: var(--ops-critical); }
.ops-badge[data-severity="high"] { color: var(--ops-high); }
.ops-badge[data-severity="medium"] { color: var(--ops-medium); }
.ops-badge[data-severity="low"] { color: var(--ops-low); }
.ops-metrics, .ops-queues, .ops-actions, .ops-modules { margin: 1rem 0 0; padding: 0; list-style: none; }
.ops-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: .75rem; }
.ops-metric a, .ops-queues a, .ops-actions a, .ops-modules a { display: block; block-size: 100%; padding: 1rem; border: 1px solid var(--ops-border); border-radius: calc(var(--ops-radius) * .75); color: inherit; text-decoration: none; }
.ops-metric a:hover, .ops-queues a:hover, .ops-actions a:hover, .ops-modules a:hover { border-color: var(--ops-accent); }
.ops-metric__value { display: block; margin-block: .25rem; font-size: clamp(1.5rem, 3vw, 2.25rem); font-variant-numeric: tabular-nums; }
.ops-metric__label, .ops-queues strong, .ops-actions strong, .ops-modules strong { font-weight: 720; }
.ops-metric__trend { margin-block-start: .4rem; font-size: .85rem; }
.ops-metric__source { margin-block-start: .65rem; font-size: .7rem; }
.ops-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(16rem, .8fr); gap: var(--ops-space); }
.ops-grid > .ops-panel { margin-block: 0; }
.ops-queues, .ops-actions { display: grid; gap: .6rem; }
.ops-queues a { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.ops-count { min-inline-size: 2.2rem; padding: .25rem .5rem; border-radius: 999px; background: var(--ops-surface-raised); text-align: center; font-variant-numeric: tabular-nums; }
.ops-actions a[data-step-up="aal2"] { border-style: dashed; }
.ops-modules { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: .75rem; }
.ops-status { color: var(--ops-muted); font-size: .75rem; }
.ops-positive-state, .ops-empty { padding: 1rem; border-radius: calc(var(--ops-radius) * .75); background: var(--ops-surface-raised); }
.ops-visually-hidden { position: absolute; inline-size: 1px; block-size: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
@media (max-width: 50rem) {
  .ops-hero, .ops-section-heading { align-items: stretch; flex-direction: column; }
  .ops-as-of { min-inline-size: 0; text-align: start; }
  .ops-grid { grid-template-columns: 1fr; }
  .ops-table-wrap { overflow: visible; }
  table, thead, tbody, tr, th, td { display: block; }
  thead { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); }
  tr { padding-block: .75rem; border-block-end: 1px solid var(--ops-border); }
  td { display: grid; grid-template-columns: minmax(7rem, .4fr) minmax(0, 1fr); gap: .75rem; padding: .35rem 0; border: 0; }
  td::before { content: attr(data-label); color: var(--ops-muted); font-size: .75rem; font-weight: 700; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
}
@media (forced-colors: active) {
  .ops-panel, .ops-metric a, .ops-queues a, .ops-actions a, .ops-modules a { border-color: CanvasText; }
  .ops-badge { forced-color-adjust: none; }
}
`;
