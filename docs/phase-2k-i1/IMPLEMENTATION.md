# Phase 2K-I1 — Responsive simulation worker and search progress

Implemented on phase-2k-i1-simulation-progress-worker from the committed Phase 2K-I baseline. No commit or push. Run Planner schema remains v7; search state is never persisted.

## Architecture and unchanged combat semantics

Previously BattleSimulation scheduled a timeout on the browser main thread and then ran the entire synchronous repeated-simulation loop. The timeout delayed the blocking work but did not move it off the main thread.

The UI now uses useBattleSimulationWorker and a focused controller. Start creates exactly one lazy Vite module Worker, posts a structured-clone-safe detached request, and leaves React responsible only for compact progress and controls. Manual setups and Planner presets use the same path. No worker is created during module import or server rendering. Worker construction failure is a visible retryable error; there is no blocking fallback or server dependency.

The worker host calls createSimulationSearch, which steps the existing simulateBattleCore and feeds a shared streaming accumulator. The old synchronous public facade remains for compatibility/reference callers and uses that same accumulator. There is no second combat engine. Attack, Counter, Interrupt, Assist, temporary states, targeting, accuracy, damage, resource rules and timing modules are unchanged.

The audited RNG strategy is one continuing RNG stream across every simulation in a request. Production still wraps Math.random; deterministic requests can carry an unsigned 32-bit seed for the existing mulberry32-v1 generator. Neither batch boundaries nor progress, clocks, cancellation checks or job IDs draw random values or reseed. A worker's unseeded Math.random stream is naturally not reproducible across browser realms; seeded equivalence is tested explicitly. Simulation indices inside the engine remain zero-based, preserving action IDs; user-facing best-found indices are one-based.

The accumulator preserves the old eligibility and ordering exactly: completed Player victories count as successes; all such victories contribute to action statistics; only victories with complete measured timing and non-null totalFrames contribute to frame statistics. It retains the first strictly fastest history and never replaces it on ties. Averages use original ordered sums and eligible counts, not means of batch means. Slowest frames/actions remain maxima; the previous API did not retain a separate slowest history. Resource-alert run counts and deduplicated timing/resource diagnostics are carried forward unchanged. Invalid, unsupported and limit-reached results retain the previous error behavior rather than being silently counted as defeats.

## Worker protocol and lifecycle

| Message | Contents and behavior |
| --- | --- |
| START | Runtime jobId, detached BattleInput, positive safe-integer requested count, optional seed/maxRounds. No functions, callbacks, transfers, Planner objects or storage handles. |
| PROGRESS | jobId plus compact numeric/null metrics. No action histories, whole battle results or Player/Enemy snapshots. |
| CANCEL | jobId only; observed after a real worker task yield. Foreign jobs are ignored. |
| COMPLETE | Final existing SimulationResult with additive search metadata and retained best histories. |
| CANCELLED | The same aggregate shape for completed work only, with status cancelled and original requested count. |
| ERROR | jobId and an actionable message. UI exits busy state and retains configuration for retry; development builds log failure detail. |

The controller prevents duplicate Start and Cancel submissions, rejects stale job IDs, and invalidates ownership before processing any terminal callback. COMPLETE/CANCELLED/ERROR are mutually terminal; later messages cannot update the old job or a new one. Terminal handling clears handlers and terminates the worker. Hook cleanup does the same on navigation, preset replacement or unmount, preventing hidden background computation. Generation IDs, active jobs, progress and cancellation state are runtime-only.

## Batching, progress and cancellation

Final policy: up to 50 ms of computation or 1,000 completed battles per batch, whichever comes first. The budget is checked after each complete battle. Between non-final batches the worker awaits setTimeout(0), a task yield that lets CANCEL messages run. It also yields once before starting, allowing cancellation at zero. This is not a microtask-only loop and does not rely on a main-thread interval.

The initial 25 ms budget was benchmarked and then increased after measurement showed timer waits dominated transport costs. The original measurements are preserved in performance-25ms.json. A pathological single battle may exceed the budget: battles are intentionally indivisible, so cancellation is not a strict real-time deadline. Navigation/unmount explicitly terminates work rather than returning partial findings.

Normal progress is throttled to at most one message per 150 ms (about 6.7 updates/second), with first meaningful and final/cancelled progress forced. A new best is included in the next scheduled update. Completion always emits completed == requested. UI percentages are clamped to 0–100 from completed/requested; the native progress element exposes min 0, max requested, current completed and an accessible label.

Cancel preserves completed work and sends it to the existing Results tab with “Partial results — simulation cancelled” and completed/requested counts. Average/slowest/coverage use only completed eligible runs, while fastest details remain available. Zero completed runs produce an empty partial result with null frame aggregates and no fake victory; returning to Simulator permits retry. If the final battle has already completed, normal completion wins; otherwise cancellation stops at the safe boundary. Exactly one terminal outcome is processed.

## Search metrics and UI

Live progress shows completed/requested, percentage, successful victories, best complete-timing frames, first discovery index, occurrences of that best, simulations since improvement, speed, elapsed seconds, ETA and Cancel. Until a best exists it displays an em dash. Successful victories and complete-timing victories are separate protocol counters.

- bestFoundAtSimulation is the one-based index where the current minimum frame value first appeared. A strict improvement replaces it; an equal-best recurrence does not.
- bestOccurrenceCount starts at 1 for each newly improved value and increments only for equal eligible values.
- simulationsSinceLastImprovement = completedSimulations - bestFoundAtSimulation; it is null without a best.
- elapsedMs uses performance.now() from job start, including yields and setup.
- simulationsPerSecond = completed / elapsedMs * 1000, null before meaningful progress.
- etaMs = (requested - completed) / speed * 1000, null when speed is unavailable. These clocks never affect gameplay or RNG ordering.

Quick sets 10,000; Standard sets 100,000; Deep sets 1,000,000. Custom focuses the retained direct numeric input, and becomes selected for non-preset values. Counts remain numeric, positive safe integers; no new small maximum is imposed. Guidance describes fast iteration, a first/development search and deeper searches for important battles. No finite count or recurrence is assigned a probability of being globally optimal.

During an active request, a disabled fieldset and disabled Radix selection controls prevent team/enemy/floor/resource/count/preset/reset changes. Start is disabled; Cancel remains outside the fieldset. A detached job snapshot is posted without transfer lists, so it cannot detach or alter React or Planner data. Imported HP/MP edits, original imported reset and historical Player/Enemy mapping remain intact when idle.

Results adds completed/cancelled status, counts and convergence information while retaining Fastest Victory, Average Victory, Slowest Victory, Completed Successes, timing/resource coverage and detailed histories. Incomplete timing remains explicitly excluded from frame comparisons, including in the live best display.

## Memory

The search retains one input, one RNG, scalar sums/counts/extrema, bounded diagnostic sets and at most two selected action histories (fewest actions and fastest complete frames). It never stores one BattleRunResult per simulation. The current battle is released after aggregation unless its history becomes a selected best. The final result is sent only on completion/cancellation; progress contains no histories. Heap deltas after explicit GC are noisy measurements, not allocation totals.

## Verification and benchmarks

- Full test suite: **1,795 / 1,795 passed**, 0 skipped (1,727 baseline + 68 new checks).
- Data self-checks: **57 / 57**.
- Battle-skill checks: **11 / 11**.
- Effect coverage: **598 occurrences, 100 groups, 5 unused dictionary rows**, exhaustive and unchanged.
- Workbook source --check: passed at C:/Users/rafae/Downloads/DW2 Modding Info.xlsx (all 68 bytes, labels, effect dictionary and provenance).
- Both TypeScript projects: passed.
- Production build: passed; a separate battleSimulation.worker asset is emitted (272.79 KB). No Node-only dependency is imported by the worker source graph. Existing application chunk-size warning remains.
- Lint: **3 errors / 7 warnings**, identical to baseline; no unrelated debt changed.
- git diff --check and new-file trailing-whitespace/conflict-marker checks: passed.
- No commit or push.

Browser smoke test: in the local Vite app, a manual Agumon team against encounter 154 started a 1,000,000 request in a real Web Worker. Progress visibly advanced to 36,422 with configuration controls disabled. Cancel returned the existing Results view with 66,332 / 1,000,000 and the prominent partial label. That team's existing synthetic fallback had incomplete timing; the live and final fastest frame values correctly stayed unavailable. Browser tool latency is not used as a precise cancellation measurement.

Deterministic tests compare a frozen copy of the committed Phase 2K-I continuous runner against the incremental runner at 1/10/100/1,000 simulations and batch sizes 1/7/100/1,000. All deterministic aggregate fields and retained histories match; best discovery/occurrence metadata is independently checked against the ordered core results. Controlled convergence sequence 10000, 9500, 9500, 9400, 9600, 9400 yields best 9400 at run 4, two occurrences, and two runs since improvement.

Tests also cover weighted partial aggregation, zero/no eligible results, count validation, compact monotone progress, cancel before work/after batches, retry, worker errors, stale terminal races, source immutability, presets/custom counts, progress accessibility/text, disabled controls, Results labels, SSR, and real hook ownership/cleanup. Legacy component tests were adapted from direct synchronous invocation to the hook request boundary; a frozen reference retains the prior aggregation implementation for independent equivalence checks.

Final 50 ms policy, Node v24.20.0:

| Simulations | Wall seconds | Simulations/s | Progress messages | Batches | Result bytes |
| --- | --- | --- | --- | --- | --- |
| 10,000 | 1.213 | 8241 | 9 | 22 | 29481 |
| 100,000 | 11.996 | 8336 | 74 | 218 | 29494 |
| 1,000,000 | 125.733 | 7953 | 753 | 2256 | 29508 |

All three searches completed with all requested simulations successful and eligible. Best = 4,201f, first found at simulation 2,231. Best occurrences = 2 / 5 / 76 respectively. Average frames = 6,074.0446 / 6,080.49544 / 6,080.448179; slowest = 8,802 / 9,681 / 9,681. Resource-alert run counts = 6,942 / 70,393 / 702,795. Full semantic samples are in performance.json.

Both retained histories had 10 action records at every request size. Result size increased only from 29,481 to 29,508 bytes, mainly numeric metadata. Progress payloads stayed at or below 384 JSON bytes. Post-GC heap deltas were -213,848 / +70,416 / +171,584 bytes; negative values reflect GC/noise and do not imply negative allocation.

Boundary-triggered host cancellation: 11.6 ms. More representative cross-thread tests posted Cancel 10 ms after first progress, while the worker could be computing another batch: **52.2, 51.6, 41.3 ms**, including IPC and final result cloning. Those jobs stopped after 256 / 362 / 420 completed runs out of 1,000,000. These are measured samples, not a hard bound on unusually long single battles.

Warmed 10k comparison (one warmup per mode, three interleaved samples) had median continuous 1026.0 ms, yield-only 1033.7 ms, and progress-enabled 1273.2 ms. Observed total wall overhead was 24.1%; the progress-enabled versus yield-only median difference was 23.2%. These small-sample differences include substantial scheduling/JIT variability, not just message work: directly measured structured cloning of all progress and final messages took only 0.45–1.14 ms per progress-enabled 10k search. Yield waits were 153–194 ms in those samples. The timing policy deliberately trades some throughput for responsiveness; no battle mechanics were optimized.

The initial 25 ms trial is retained separately for transparency. Host activity differed across trials, so the 284.9s-to-125.7s million-run difference must not be attributed solely to changing the batch budget.

Performance samples exercise the actual worker host under Node with real core battles and task yields. Message structured cloning is measured as a transport proxy; browser rendering and cross-thread IPC scheduling are not included. Node/OS scheduling and concurrent host activity affect wall time. These are representative single-target battles, not universal throughput or latency guarantees. Reproduce with node --expose-gc scripts/benchmarkSimulationSearch.cjs, followed by node scripts/benchmarkSimulationOverhead.cjs for the warmed comparison. No brittle performance threshold is asserted.

## Files

Created:
- src/utils/battle/battleSimulationSearch.ts
- src/workers/battleSimulationProtocol.ts
- src/workers/battleSimulationHost.ts
- src/workers/battleSimulation.worker.ts
- src/workers/createBattleSimulationWorker.ts
- src/workers/battleSimulationController.ts
- src/hooks/useBattleSimulationWorker.ts
- src/components/SimulationSearchProgress.tsx
- tests/simulationSearch.test.cjs
- tests/simulationProgressUI.test.cjs
- tests/helpers/componentHost.cjs
- tests/fixtures/battleContinuousReference.ts
- scripts/benchmarkSimulationSearch.cjs
- scripts/benchmarkSimulationOverhead.cjs
- docs/phase-2k-i1/IMPLEMENTATION.md
- docs/phase-2k-i1/performance.json
- docs/phase-2k-i1/performance-25ms.json

Modified:
- src/utils/battle/battleCompatibility.ts — extract the incremental accumulator without changing eligibility, sums, tie rules or diagnostics.
- src/types/digimon.ts — optional additive result search metadata, not RunPlan schema.
- src/components/BattleSimulation.tsx — worker hook, presets, locked configuration, real progress/cancel.
- src/components/BattleResults.tsx — completed/partial search and convergence display.
- tests/helpers/loadTs.cjs and tests/theme.test.cjs — support parsing lazy import.meta.url in Node fixtures, without constructing a Worker.
- tests/plannerBattleNavigation.test.cjs — shared component host and worker handoff test boundary.
- tests/battleEngineCore.test.cjs and tests/battleSkillData.test.cjs — update existing UI integration fixtures for the asynchronous controller boundary.

## Confirmed boundaries

Run Planner schema is still v7. No persisted analysis/search fields or new localStorage contract. Planner histories, checkpoints, roster, Digiline and Bits remain read-only to simulation. Both manual and historical setups work. Attack, Counter, Interrupt, Assist and support effects are unchanged. Interrupt Hit = 761f, Interrupt Miss = 270f, Single Hit = 685f, ordinary Miss = 194f. Phase H coverage remains exhaustive; deferred WAZADATA effects remain diagnostic and were not guessed. No global-optimum claim, new server, multi-worker search, commit or push.
