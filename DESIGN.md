---
name: International School Management Platform
description: Evidence-led operational interfaces for international K–12 schools
colors:
  institutional-ink: "#12263a"
  operational-muted: "#4c6275"
  paper: "#ffffff"
  canvas: "#f3f6f8"
  structural-rule: "#cbd6de"
  action-teal: "#006d77"
  action-teal-strong: "#004f57"
  focus-blue: "#0b63ce"
  information-surface: "#e7f2f8"
  information-text: "#16445f"
  success-surface: "#e5f4ec"
  success-text: "#145c36"
  warning-surface: "#fff1cf"
  warning-text: "#714900"
  error-surface: "#fde8e7"
  error-text: "#8a1c17"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 650
    lineHeight: 1.3
rounded:
  control: "8px"
  surface: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.action-teal}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.action-teal-strong}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.institutional-ink}"
    rounded: "{rounded.surface}"
    padding: "24px"
---

# Design System: International School Management Platform

## Overview

**Creative North Star: “The Operational Ledger”**

The incumbent product UI behaves like a well-kept institutional ledger: bright paper surfaces, dark structural ink, clear rules, restrained action colour and visible evidence. It is an Operate-mode system for completing school work, not a marketing theme. Dense records remain readable because hierarchy, tables, definitions and exception queues carry the visual story.

This document records the implemented Wave 2 baseline rather than declaring a final public brand identity. Future brand work may replace marketing expression, but operational screens preserve task familiarity, evidence traceability, accessibility and the semantic state vocabulary unless an approved contract change says otherwise.

**Key Characteristics:**

- Exception-first hierarchy with source-aware metrics and direct drill-down.
- Institutional paper-and-ink structure with one restrained action accent.
- Flat, bordered surfaces; depth is created primarily through tonal layering and rules.
- Square data rhythm with modest corner radius, not indiscriminate pills or nested cards.
- Responsive, RTL-aware tables and workflows designed for keyboard, touch and weak networks.
- Permission, publication, lock, assurance, offline and recovery states are explicit in text and semantics.

## Colors

The palette is calm and operational: dark blue ink anchors structure, neutral paper/canvas separates layers, teal marks actions and status surfaces carry their own text colours.

### Primary

- **Institutional Ink** (`#12263a`): mastheads, high-emphasis structure and primary text.
- **Action Teal** (`#006d77`): primary actions, active navigation and controlled emphasis.
- **Action Teal Strong** (`#004f57`): hover/pressed action treatment and accessible links on light surfaces.
- **Focus Blue** (`#0b63ce`): the exclusive visible keyboard-focus outline; do not substitute the action accent.

### Neutral

- **Paper** (`#ffffff`): primary working surfaces.
- **Canvas** (`#f3f6f8`): page background and low-emphasis grouping.
- **Operational Muted** (`#4c6275`): explanatory text and secondary labels.
- **Structural Rule** (`#cbd6de`): borders, dividers and table structure.

### Semantic Status

- Information uses `#e7f2f8` with `#16445f` text.
- Success uses `#e5f4ec` with `#145c36` text.
- Warning uses `#fff1cf` with `#714900` text.
- Error uses `#fde8e7` with `#8a1c17` text.

**The Evidence Rule.** Colour never carries status alone. Every status includes a label, definition or accessible text equivalent.

**The Restraint Rule.** Action teal is reserved for actions, active navigation and links; it does not become a decorative page wash or a collection of competing highlights.

## Typography

**Display Font:** system UI sans-serif stack.  
**Body Font:** system UI sans-serif stack.  
**Character:** direct, familiar and highly legible across operating systems, scripts and low-bandwidth delivery. No custom font dependency is part of the approved baseline.

### Hierarchy

- **Display** (700, `clamp(2rem, 4vw, 3.5rem)`, 1.05): one task-defining page heading or institutional masthead.
- **Title** (700, `1.5rem`, 1.2): section and queue headings.
- **Body** (400, `1rem`, 1.5): records, explanations and workflow instructions; prose normally remains within 70 characters per line.
- **Label** (650, `0.875rem`, 1.3): controls, metadata and compact status labels.

**The School-Term Rule.** Labels name the actual school task or record. Avoid vague product language such as “insights”, “magic” or “smart actions” when a concrete operational term exists.

## Layout

- Working content uses logical properties and a maximum inline size around `90rem` for dense administration surfaces.
- Page padding scales from `1rem` on small screens to approximately `2.5–3rem` on wide screens.
- Major headings and status summaries may use two-column composition on wide screens; they collapse to a single reading order on narrow screens.
- Tables live in labelled, keyboard-focusable overflow regions. Mobile alternatives may use labelled row layouts, but data meaning and column labels remain available.
- Navigation may become horizontally scrollable or drawer-based on small screens; the active destination remains explicit with `aria-current`.
- Logical `inline`/`block` properties are preferred so LTR and RTL use the same source structure.
- Empty, loading, restricted, read-only, offline, partial-success and error states occupy the same task location as the eventual content rather than appearing as detached toast-only feedback.

## Elevation & Depth

The system is flat by default. Canvas, paper, borders and dark mastheads establish depth; persistent decorative shadows are not part of the baseline. Temporary overlays may use a restrained shadow when required for separation, but status and hierarchy must remain understandable without it.

**The Flat-By-Default Rule.** A new shadow requires a functional layering reason such as a modal, menu or drag surface. Do not use shadows to make ordinary cards appear important.

## Shapes

- Controls and compact navigation use an `8px` radius.
- Major page containers may use a `16px` radius at the outer edge.
- Tables, ledgers and stacked operational sections rely on borders and shared edges rather than every row becoming a card.
- Pills are reserved for true compact statuses, filters or immutable tags; ordinary buttons, tabs and metrics are not pills.
- Focus outlines are `3px` and offset from the control so they remain visible at 200% zoom.

## Components

### Buttons

- **Shape:** familiar rectangular control with `8px` radius and touch-safe padding.
- **Primary:** action teal with paper text; one dominant action per task region.
- **Hover / active:** action-teal-strong; pressed state remains visibly distinct.
- **Focus:** `3px` focus-blue outline with offset; never remove it.
- **Disabled:** native disabled semantics plus visible explanation when the reason is permission, assurance, finalized state or missing prerequisite.
- **Loading:** preserve the button label or announce the action; prevent duplicate submission without losing recovery context.

### Statuses and Alerts

- Use the documented semantic surface/text pairs and a written label.
- Restricted and masked states disclose no sensitive detail; “not found” may intentionally represent denied access.
- Critical actions requiring AAL2 or approval identify that requirement before the user attempts the action.

### Cards / Containers

- Use a container only when it groups a distinct task, record or queue.
- Do not nest cards for visual decoration.
- Metrics include definition/context, source and timestamp or scope; a number without drill-down is incomplete.
- Related records should prefer tables, lists or definition groups over grids of interchangeable cards.

### Inputs / Fields

- Use familiar HTML controls and explicit labels.
- Validation identifies the field, what failed, what input was preserved and how to recover.
- Long names, translations, identifiers and special characters wrap without obscuring controls.
- Offline and concurrent-update behavior preserves entered data and provides a safe retry or reconciliation path.

### Navigation

- Navigation is capability-aware; unavailable destinations are omitted or presented as read-only only when that distinction is useful and safe.
- Persona shells show school/campus scope, current persona, network/sync state and the active destination without exposing unauthorized module names or counts.
- A skip link targets the main task region on every shell.

## Do's and Don'ts

### Do:

- **Do** lead with the primary job, current state and highest-risk exceptions.
- **Do** define every metric and provide a traceable source or drill-down.
- **Do** make permission, assurance, publication, lock and offline states explicit.
- **Do** test keyboard, touch, RTL, long content, 200% zoom, reduced motion and slow/offline recovery.
- **Do** reuse the semantic palette, system typography, spacing rhythm and status vocabulary.
- **Do** keep child-facing language shorter, age-appropriate and privacy-preserving.

### Don’t:

- **Don’t** build pages from disconnected statistic cards or cards nested inside cards.
- **Don’t** add decorative gradients, glows, glass effects or motion without task meaning.
- **Don’t** over-round controls or use pills as a default shape.
- **Don’t** hide tables, definitions or source evidence merely to make a dashboard look sparse.
- **Don’t** communicate status only by colour or icon.
- **Don’t** reveal restricted record existence, sensitive narratives or unauthorized counts through navigation, errors or loading states.
- **Don’t** invent customers, benchmarks, regulatory claims, public brand assets or production data.
