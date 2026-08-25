# Component scorecard

Figma plugin. Spec: `_docs/spec.md`. Design: `_docs/design.md`.

## Commands

- `pnpm run watch` — rebuild on save, then re-run the plugin in Figma desktop
- `pnpm run build` — production `manifest.json` + `build/` at the repo root
- `pnpm run build:pack` — same build into `publish/plugin/` for the Community helper

Load the **packed** plugin from `publish/plugin/manifest.json`. Do not edit generated `manifest.json` by hand.

Plugin id `1494664241767135067` must stay stable for Community.
