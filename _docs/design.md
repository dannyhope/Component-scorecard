# Component scorecard look

Living document. Update whenever visual design changes. Last updated: 2026-08-20.

**This file is the source of truth for how Component scorecard should look.**

## Intent

A compact inspector that looks at home in Figma. Create Figma Plugin’s Preact kit supplies native controls. Colour is muted except scores and the nested-instance badge.

British English. Sentence case. No Light/Dark switch — follow `prefers-color-scheme`.

## Window

400×640, not resizable for v2. Vertical stack: list (scrolls) → checklist editor → footer.

## List rows

- Chevron, purple ❖, name, `checked/total`, “edited {date}”
- Nested-instance count is a small purple pill when greater than zero
- Selected row uses a light purple wash
- Score colour: red ≤40%, amber ≤70%, green above — brand red `#E4003D`, orange `#FF7209`, green `#008C00`

## Footer

Hide completed on the left. Refresh, Feedback, and “A Danny Hope plugin” on the right, muted, hover to full contrast.

## Community icon

Simple checklist mark, mid-grey `#7B858A` on a light `#F0F2F2` tile, 128×128. Not a scene, not photoreal.
