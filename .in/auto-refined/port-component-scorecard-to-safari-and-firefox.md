# Port Component scorecard to Safari and Firefox

**Readiness:** auto-refined
**Roadmap:** later
**Type:** development

Component scorecard is a Figma plugin, not a browser extension. Reassess this task if the product gains a browser-extension version.

- [ ] Investigate whether a browser-based companion is needed.
- [ ] If so, assess Safari Web Extension and Firefox WebExtension compatibility.
- [ ] Port the extension and document browser-specific permissions, packaging, and testing.

## Auto-investigation
**Investigated:** 2026-09-03

### Findings
- The repository is exclusively a Figma plugin: `package.json` uses `build-figma-plugin`, the manifest declares `editorType: ["figma"]`, and the runtime depends on `figma`, `figma.clientStorage`, and Figma document/selection events.
- The UI is a 400×640 Preact plugin iframe. `src/main.ts` owns Figma document scanning, selection, persistence, and event handlers; `src/ui.tsx` renders the checklist and communicates through Figma plugin messaging.
- There is no browser-extension manifest, browser-facing host integration, content script, background service, or external persistence layer to port. The current “no network” model and Figma-specific data source cannot be carried directly into Safari or Firefox.
- Safari Web Extensions and Firefox WebExtensions are distinct packaging/runtime targets. A future companion would need a newly defined browser job and data source before compatibility work could be estimated meaningfully.

### Scope
- This task is conditional and should remain deferred until a browser-extension version or companion is an explicit product direction.
- A future implementation would likely be a new browser-facing application/extension architecture, plus separate Safari and Firefox manifests/build targets, permissions, storage/sync decisions, packaging, and automated browser testing; the existing Figma plugin code would provide only reusable checklist/domain logic after extraction.
- Estimated complexity: large.
- Docs impact: update `_docs/spec.md`, `_docs/design.md`, and README/install documentation only when the browser companion’s purpose, surfaces, permissions, and rollout are decided.

### Proposed implementation
1. Define the browser companion’s user goal, supported host(s), source of component data, and whether it is a companion to Figma or an independent browser workflow.
2. Extract genuinely platform-neutral checklist parsing/scoring/state logic from the Figma plugin, with tests, while keeping Figma document and selection code adapter-specific.
3. Design the browser extension architecture and permission boundary, then implement a Chromium-independent WebExtension core with Safari-specific packaging and Firefox-specific manifest/testing configuration.
4. Add browser integration tests for the chosen workflow and document permissions, local storage/sync, signing/distribution, and support limitations in the product docs.

### Questions for refinement
1. **What browser product should exist?** A companion to a Figma workflow, a page/component inspection tool, or another explicitly defined browser job; the current task does not specify an outcome.

   **Answer:**

2. **What data source should the browser version use?** Figma API, a local/exported scorecard, DOM inspection, or another source; this determines permissions, authentication, privacy, and architecture.

   **Answer:**

3. **Which browser targets and distribution model are required?** Safari only, Firefox only, both; App Store/TestFlight, Mozilla Add-ons, private sideloading, or another route.

   **Answer:**

### Documentation impact
- Update `_docs/spec.md` and `_docs/design.md` after the browser companion is product-defined; currently they correctly describe only the Figma plugin.
- Update README/install and publishing documentation for browser-specific permissions, packaging, signing, and testing once implementation is authorised.

### Related items
- [Publish Component scorecard to Figma Community](../refined/publish-component-scorecard-to-figma-community.md) — complementary: publishing the existing Figma plugin is the current distribution path; browser portability remains conditional and deferred.
