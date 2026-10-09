# Phase 2O-B implementation report

Local acceptance: 2026-10-09. No commit, push, merge, tag, release or deployment performed.

## Baseline and versions

- Branch: `phase-2o-b-no-target-miss-round-overhead` (existing clean branch reused).
- Starting and final HEAD: `36e6b4a532da564814c1b3c8b413dca944e84604`; baseline matched `main` and fetched `origin/main`.
- Application: **1.2.0**; Planner schema: **7**; backup: **1**; report: **1**. No dependency or lockfile changes.
- Engine: `2k-h-authoritative-support-v1` -> `2o-b-authoritative-timing-v1`. Results now have different authoritative timing and target-loss semantics, so engine provenance must distinguish them. Report fields are additive and optional for older retained results, requiring no persisted Planner/backup migration.

## Mechanics and audit

The two `no-living-targets` execution exits were reviewed: initial target resolution and prepared-action resumption. A Single attack/counter whose valid locked target is defeated before execution now completes as `resolved`, outcome `miss`, accuracy cause `no-effective-target`, null reference target, empty effective targets and no impacts. The canonical miss path charges exactly **194 frames**, **0 MP** (`none-on-miss`), counts the executed attempt and preserves intended target IDs. It bypasses ordinary accuracy and on-hit processing/RNG. A lock already invalid at planning remains a skip. Activated counters may use their causal trigger target; their reaction audit remains available.

Battle-ended pending actions, genuine cancellation, incapacitation and other real skips remain skips. Random-at-execution targeting still selects a living target. AOE partial-target behavior, Shadow Scythe repeats, Assist handling, counter/interrupt mechanics and status rules retain their existing paths. A deferred prepared action that loses its target uses the same miss accounting; restart bookkeeping remains intact.

`battleTiming.ts` owns the transition profile: **1 living Player = 319**, **2 = 385**, **3 = 452**. Living means `side === 'player' && currentHp > 0` at the actual next-round boundary. Enemy count is irrelevant. The global offensive-model `isAlive` behavior was not changed. Zero living Players produces a null transition duration and explicit incomplete-timing diagnostic, not an invented zero or measured duration.

The simulator records transitions only when a next round actually begins, before that round's clearing/planning. There is none before Round 1, after a victory round, or after a terminal max-round limit. Transitions are separate records, never fake battle actions. The summary carries `actionFrames`, `roundTransitionFrames`, `roundTransitions`, `knownFrames`, nullable `totalFrames`, completeness and diagnostics. Subtotals are known contributions; any unknown action or transition keeps total timing incomplete.

## Arithmetic and search

| Scenario | Action frames | Transition frames | Total |
| --- | ---: | ---: | ---: |
| Production Worker, one round | 685 | 0 | 685 |
| Production Worker, target lost, two rounds | 2443 | 452 | 2895 |
| Production Worker, one Player loses HP, two rounds | 2443 | 385 | 2828 |
| Controlled route A, one round | 3000 | 0 | 3000 |
| Controlled route B, two rounds | 2700 | 452 | 3152 |

The deterministic A/B witness proves a formerly faster action-only route loses after transition costs. It exercises production comparators, route tracking, aggregation, capture qualification and TAS complete-path selection with controlled results; it is not claimed as a naturally discovered optimizer plan fixture. Separate engine/Worker tests run actual multi-round Random and Optimized battles. Average for A/B is 3076; success/capture qualification does not acquire a new timing penalty or heuristic.

Canonical totals flow through Random, Optimized, TAS Luck and capture-qualified selection. Search layers do not add overhead again. Retained fastest and best-turn histories now carry the matching timing summary through aggregation, deterministic tie selection and pass merging. TAS continuation snapshots include the transition records. An incomplete total cannot become a timed fastest result merely because its known subtotal is low.

## Results, exports and documentation

Results labels the action **Miss — No effective target**, shows intended target, actual targets **None**, and retains MP/accuracy audit. An expandable timing breakdown shows known action/transition totals and each round boundary. JSON report v1 and Markdown carry the same selected history's summary; Markdown exposes cause, intended/effective targets and transition details. Tests cover normal and capture-qualified reports.

About / Battle Mechanics documents both changes, 194/zero MP, 319/385/452, HP-based counting, no final-round overhead and the potential advantage of fewer rounds. README, help and report scope now include measured inter-round processing/order-entry while excluding other external menu/setup/recovery/item time. Historical release documents were not rewritten.

## Expected-fixture audit

- `battleCounters`: waiting Single counter with a now-defeated locked enemy changes from skip to resolved miss, 194 frames.
- `battleTimingResources` KO fixture: 2740 action frames + 385 transition = **3125**. Its assertion also checks two living Players.
- The old Counter fixture and two seeded Single wins continue after Player HP reaches zero under the existing offensive model. Their full timing is now incomplete; the two wins remain wins but have no complete timed minimum. Action timing assertions remain intact.
- Natural game-accurate small Optimized fixture has one extra 319-frame transition across 64 samples: sum **44719 -> 45038**, average **698.734375 -> 703.71875**, maximum **1564 -> 1883**. The strategy one-round winner remains 685. The test asserts the old values before applying these exact arithmetic changes.
- Six full search-result semantic hashes are recorded with previous hashes and selected route timing in [search-hash-audit.json](search-hash-audit.json). These full objects include additive retained timing metadata and canonical aggregate changes; a changed hash does not by itself mean the winning route changed. Evaluation budgets/configuration remain explicitly checked. Original frozen fixture JSON files were not regenerated.
- Historical accuracy/RNG, Monte Carlo and pruning-witness compatibility checks explicitly use the test-only `actionOnlyCompatibility.cjs` wrapper. It temporarily summarizes without transitions, removes additive timing metadata, and restores the implementation in `finally`. These checks preserve their original action-only purpose; they do **not** validate new canonical totals. The separate 28-test Phase 2O-B suite validates those totals and mechanics directly. Engine-version normalization in the old accuracy fixture is preceded by an assertion of the new engine version.
- The independent continuous aggregation reference now carries matching timing summaries and diagnostics. A synthetic legacy aggregate test explicitly marks its controlled input complete.

## Validation

| Check | Result |
| --- | --- |
| `node --test tests/*.test.cjs` final | **3398 passed, 0 failed, 0 skipped/cancelled/todo**, 114233.5061 ms |
| Focused `roundTransitionTiming.test.cjs` | **28 passed**, including 9 Player/Enemy count combinations, exact 1/2/3-round endings, invalid initial lock, unknown timing, dynamic HP, RNG, capture, TAS, UI/report and Worker host |
| TypeScript app and node, `--noEmit` | Both exit 0 |
| Production build | Pass; 1893 modules, real Worker asset `battleSimulation.worker-DSEQb1s9.js` |
| Data checks | **63/63 passed** |
| Battle skill checks | **12 passed** |
| Effect coverage | **598 occurrences, 101 groups, 5 unused dictionary rows** |
| Source workbook check | Pass: all 68 bytes, labels, effect dictionary and provenance |
| `git diff --check` | Pass |
| Lint baseline vs final | Identical **3 errors, 7 warnings**, no new findings |

Lint is not clean: existing empty-interface errors in `command.tsx` and `textarea.tsx`, existing require-import error in `tailwind.config.ts`, and seven existing React fast-refresh warnings. Build reports the existing old Browserslist database and >500 kB chunk warnings; dependencies were not updated to suppress them.

Some sandbox attempts encountered EPERM/ENOENT/module-read/npm-wrapper failures. Authorized reruns completed successfully; no source change was made to work around those infrastructure failures. The repository has no `npm test` script; final validation used the documented Node test command. The default Windows Python alias was unavailable, so workbook checking used the bundled Python runtime against `C:\Users\rafae\Downloads\DW2 Modding Info.xlsx`.

## Browser and production Worker smoke

Local preview at `http://127.0.0.1:4173/phase-2ob-smoke.html`, generated by `node scripts/smokePhase2ob.cjs` after the production build. The harness uses the real built Worker and actual Results/About React components; it is a local verification surface, not a deployment.

- One-round Random: 685, zero transitions.
- Target-loss Random: two rounds, 2443 + 452 = 2895; two resolved misses with 194 frames, 0 MP, preserved `enemy-0` intent and empty effective targets. Repeated successfully against the final rebuilt Worker.
- Dynamic HP: two living Players at the boundary, 385-frame transition, 2828 total.
- Optimized, 64 evaluations: retained fastest 2895, matching action and transition summary, progress delivered.
- Long Random cancellation: `CANCELLED`, 3 progress events, 2091 completed samples retained. An initial long multi-round fixture reached the configured operational round limit; cancellation was then tested with the one-round fixture to isolate cancellation behavior.
- About / Battle Mechanics verified in the browser, including all four timing numbers and final-round exclusion. Screenshot: [about-smoke.png](about-smoke.png).
- Browser console: no errors or warnings in the completed smoke.

## Changed files and final Git state

Production/docs: `README.md`; `src/components/BattleResults.tsx`; `src/components/InfoDialog.tsx`; `src/components/help/userGuideContent.ts`; `src/types/digimon.ts`; and under `src/utils/battle/`: `battleCompatibility.ts`, `battleFastestRoute.ts`, `battleOptimizedSearch.ts`, `battlePresentation.ts`, `battleSearchPasses.ts`, `battleSimulation.ts`, `battleSimulationReport.ts`, `battleSimulationReportSerialization.ts`, `battleSimulationSearch.ts`, `battleTiming.ts`, `battleTypes.ts`.

Tests: `accuracyMode.test.cjs`, `battleCounters.test.cjs`, `battleTimingResources.test.cjs`, `optimizedActionSearch.test.cjs`, `searchThoroughness.test.cjs`, `simulationReport.test.cjs`, `simulationSearch.test.cjs`, `tasSearchIntegration.test.cjs`, `userGuide.test.cjs`, `fixtures/battleContinuousReference.ts`; new `roundTransitionTiming.test.cjs` and `helpers/actionOnlyCompatibility.cjs`.

New verification artifacts: `scripts/smokePhase2ob.cjs`; this report, `search-hash-audit.json`, `about-smoke.png`, and `results-smoke.png` under `docs/phase-2o-b/`. Local ignored logs and generated `dist/` are not source changes.

Git status intentionally contains the implementation and verification artifacts as uncommitted modified/new files. HEAD is unchanged. No commit, push, merge, tag, release or deployment was performed.
