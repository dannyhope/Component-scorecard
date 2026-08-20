# Component scorecard

Living document. Update whenever behaviour changes. Last updated: 2026-08-20.

**This file is the source of truth for how Component scorecard should work.**

## Purpose

A Figma plugin for design-system maintainers. It lists standalone components in the open file and scores each one against a checklist the team edits in Markdown.

## Surfaces

- Plugin iframe (400×640)
- Figma canvas selection (clicking a row selects and frames the component)

No website, no network, no account.

## Behaviour

- Lists **standalone** `COMPONENT` nodes on every page. Skips variants that live inside a component set.
- Checklist is Markdown: a heading line, then `- [ ]` items. Stored per user in `clientStorage` (`customRules`).
- Tick state is stored per component, category, and label (`checkboxStates`). Existing ticks survive the rewrite.
- Clicking a component name selects it in Figma (including on another page) and expands its criteria.
- The chevron toggles criteria without changing Figma selection. That preference is stored (`viewStates`).
- Selecting frames, sections, or several components in Figma filters the list to those components. Deselecting shows the full list again; expanded rows stay open.
- **Hide completed** hides fully ticked components (and ticked criteria inside an open row).
- Right-click a criterion → **Apply to all components**.
- **Refresh** re-scans the file. Document changes also refresh, debounced.
- **Feedback** opens `https://dannyhope.co.uk/feedback`. Footer: **A Danny Hope plugin** → `https://dannyhope.co.uk`.
- No debug panel, no in-plugin tests, no GitHub links in the product UI.

## Out of scope for this version

- Scoring variants inside a set as their own rows
- CSV export
- Auto-running contrast or lint (those remain checklist items the human ticks)

## Success

A maintainer can open a library file, tick through the default checklist on a Button, hide completed work, and publish the plugin to Figma Community without granting network access.
