# Course-correction audit (before revised edits)

Branch: phase-2k-l4-search-thoroughness, HEAD f705977. No commits/pushes. No reset performed.

Existing modified files: src/components/BattleSimulation.tsx, OptimizedSearchResults.tsx, SimulationSearchProgress.tsx; src/pages/Index.tsx; src/utils/battle/battleOptimizedSearch.ts, battlePresentation.ts, battleSimulationReport.ts, battleSimulationReportSerialization.ts; src/workers/battleSimulationHost.ts, battleSimulationProtocol.ts; tests/optimizedSearchIntegration.test.cjs, tasSearchIntegration.test.cjs.

Existing new files: src/utils/battle/battleSearchPasses.ts; tests/searchThoroughness.test.cjs; tests/fixtures/searchThoroughnessBaseline.json; scripts/characterizeSearchThoroughness.cjs; docs/phase-2k-l4/IMPLEMENTATION.md, performance.json, browser-fixture.json, browser-smoke.html. Local ignored check logs also exist.

The partial implementation wrapped the unchanged first-pass algorithm with independent restarts. Later passes varied continuation sample selection and parent expansion order while retaining paired fair seeds. It added global accounting, bounded strategy deduplication, strongest completed-stage selection, fastest observation/provenance, pass metadata, stop reasons, Worker wiring, ephemeral controls, stale-result invalidation, progress and optional Report v1 fields. The first pass retained 4/16/64, beam, depth and comparator; later-pass exploration did change continuation selection/order. There were 38 new tests, including six full semantic hashes generated from committed L3. Existing snapshot tests exclude additive metadata, and reversed enumeration tests exclude order-dependent discovery counts only. The complete old-design suite just passed 3012/3012. Build, TypeScript, workbook, 63 data checks, 12 skill checks and baseline lint were checked. Browser smoke had reached the production-component fixture; it was not complete.

A - Reuse unchanged: global hard-budget accounting; deterministic domain-separated exploration identity; concrete fastest observation; no mixed strategy sample counts; bounded top-K; Worker cancellation ownership and observational result snapshots; stale-result invalidation callback; baseline semantic hash fixtures; data/mechanics boundaries.

B - Adapt: pass orchestration as optional Maximum fallback only; fair-stage eligibility for configurable larger schedules; cumulative progress with screening/beam metadata; settings and Report v1 fields; labels/helper text; focused tests; benchmarks; documentation/browser fixture.

C - Rework: Single Pass/Use Full Budget public names, equality of high thoroughness with restarts, fixed 4/16/64 for enhanced modes, restart-only acceptance/performance claims. Old benchmark retained as historical evidence only, not final policy justification.

Next: add boundary-only stage instrumentation and experimental schedule/beam controls; run a bounded multi-fixture matrix before selecting final policies. Standard remains a strict committed-baseline comparison throughout.
