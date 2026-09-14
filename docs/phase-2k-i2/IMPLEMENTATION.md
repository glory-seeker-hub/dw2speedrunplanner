# Phase 2K-I2 — Strategy Accuracy Mode

Implemented on `phase-2k-i2-strategy-accuracy-mode`, starting from the committed Phase 2K-I1 baseline (`bb11848`). No commit or push. Run Planner schema remains v7.

## Defaults and contract (report items 3–10, 42–44, 57–59, 66–67, 70–72)

`src/utils/battle/battleSimulationRules.ts` defines `AccuracyMode = 'strategy' | 'game-accurate'` and `BattleSimulationRules { accuracyMode }`. `BattleEngineOptions.simulationRules` is optional. Omitted engine, synchronous facade, search, and worker options retain **Game-accurate** behavior. Invalid mode values fail validation. Every fresh Simulator UI session explicitly selects **Strategy**, including historical Planner analysis and manual setup.

Strategy bypasses only the standard Hit Rate stage: it returns a Hit at that stage without computing a threshold, drawing accuracy RNG, or consuming a discarded/fabricated perfect roll. It does not turn a preceding mechanical Miss into a Hit. The existing finite/nonnegative target-SPD and positive attacker-SPD validation remains before the bypass; zero attacker SPD still produces an invalid result, without computing a threshold. Both initial action preparation and interrupted action restart call the same resolver with the captured mode.

Game-accurate retains the existing exact rational/integer threshold calculation, effective SPD handling, floor behavior, and uniform `accuracy` roll in 0..127. The Hit comparison is unchanged (`roll < threshold`). Single targets use their effective SPD; AOE uses the arithmetic mean of prepared targets' effective SPD before the established penalty flooring. There is still one ordinary accuracy roll per action, not one per AOE impact. Committed core output and the committed 1,000-run aggregate are compared exactly against the pre-edit fixture, for both omitted and explicit Game-accurate options.

No targeting, damage, status, support, Counter, Interrupt scheduling, resource, timing, aggregation, or convergence algorithm was changed. Naturally, different Hit/Miss outcomes and skipped RNG draws can change later actions, damage, payments, and battle length. That is the intended consequence of the selected accuracy mode.

Mode is runtime/session-local. Nothing is added to RunPlan, RunEvent, historical battles, checkpoints, or persisted settings; no migration is introduced. Historical Player teams, Enemy encounters, and Planner objects remain detached and unchanged. Increased Accuracy and general Cannot Miss descriptors retain their existing deferred classifications. The existing Assist guarantee and other reviewed exceptions remain as before. Strategy does not establish unresolved arithmetic or promote effect coverage.

## Action and mechanical behavior (items 11–26, 60–65, 68–69)

| Case | Strategy behavior; existing mechanical rules retained |
| --- | --- |
| Player and Enemy | Symmetric use of the same ordinary-accuracy bypass. |
| Attack and Counter | Hit through the standard stage; existing activation, target validity, and forced-Miss gates still apply. |
| Interrupt | Standard stage bypassed; Hit remains 761f and Miss remains 270f. |
| AOE | All eligible prepared impacts use the action outcome; zero standard accuracy draws. Invisibility's existing multi-target behavior is preserved. |
| Confusion | Existing eligibility, replacement, and target choice remain; the replacement Attack uses the selected mode, including replacement of an Assist or Counter. |
| Shadow Scythe | Initial execution and each causal repeat use the mode. KO eligibility, repeat payment, recovery suppression, and mechanical chain stopping remain unchanged. |
| Paralysis | Existing 50% failure remains a Miss; passing proceeds to the bypass. Ordinary failure is 194f/0 MP; Interrupt failure is 270f. Recovery and failure RNG remain. |
| Invisibility | Protected Single/sole-target Miss remains, including a previously selected target that becomes invisible. No standard roll follows that Miss. Player selection restrictions remain. |
| Tail Blade | Existing eligible 1/3 evasion still causes Miss. Failed evasion proceeds to the Strategy bypass or the Game-accurate roll. |
| Interrupt forced Miss | The existing 2/3 effect still forces the restarted target to Miss at 194f/0 MP, without restart accuracy RNG. Failure of the effect resumes the normal mechanical gates before bypass. |
| GAIA Gear / unactivated Counter | Existing forced Miss remains, with its actual cause and no fake accuracy roll. |
| Pre-Interrupt qualification | Strategy initial Hit can qualify without an ordinary accuracy draw. Initial Paralysis, Invisibility, or Tail Blade Miss cannot consume the waiting Interrupt. |
| Interrupted restart | Uses the same selected mode; forced Miss still short-circuits. Recovery suppression and all existing restart effects remain. |
| Normal Assist | Existing guaranteed Hit with no standard Hit Rate stage in either mode. Confused replacement Attack uses the selected mode. |
| Lost-target Assist | Existing target-lost Miss remains 194f/0 MP; Strategy does not revive or invent a valid target. |
| Invalid/dead targets | Existing preparation, legality, unsupported-state handling, and skip gates remain; accuracy mode does not change target selection or resurrect an action. |

## Audit, UI, and provenance (items 27–29, 36–41)

Strategy actions that reach the standard stage carry `cause: 'strategy-accuracy-bypass'`, `mode: 'strategy'`, and `standardRollSkipped: true`. They have no `roll128` or `hitThreshold128`. History renders “Standard accuracy bypassed — Strategy mode.” Mechanical failures retain their real cause; history continues to distinguish Paralysis, Invisibility, Tail Blade, forced Interrupt Miss, Assist target KO, and unactivated Counter. Only an ordinary Game-accurate Miss is labeled “Miss — Accuracy.” Game-accurate history retains the real roll, threshold, and AOE mean-SPD audit.

The accessible Accuracy Mode group exposes Strategy and Game-accurate buttons, a visible selected style, and `aria-pressed`. Strategy help reads: “Standard Hit Rate misses are disabled. Misses caused by Paralysis, Invisibility and other battle mechanics still occur.” Game-accurate help reads: “Uses Digimon World 2's normal Hit Rate RNG.” The selection remains visible and is disabled during an active search, alongside existing configuration locking.

Reset imported team retains the current session mode. Opening a new or unrelated Simulator session uses Strategy. Mode changes do not reconstruct Planner history. Both completed and cancelled/partial Results display the mode captured by the search; they do not infer it from the currently selected UI mode. Legacy synchronous results with explicit rules expose additive `accuracyMode`; omitted rules preserve the old result object exactly and display as Game-accurate. Worker results use `search.accuracyMode`.

## Worker, determinism, and aggregation (items 30–35)

START carries an optional structured-clone-safe `simulationRules` object. The UI always supplies it. The controller retains its existing detached clone; the search resolves and copies rules once before any worker yield. Every step and final/partial metadata use that copy, so caller mutation cannot alter the mode mid-search. No functions or Planner storage handles enter the request.

Both modes retain one continuing seeded RNG stream across simulations. Strategy skips standard accuracy draws entirely, so later RNG draws are intentionally not aligned with Game-accurate. All other RNG categories retain their existing uses, including action/target choices, initiative, status application/recovery, Confusion, Paralysis, Tail Blade, and Interrupt effects. Repeated same-mode seeded runs are deterministic. Batch sizes 1, 7, 100, and 1,000 produce the same aggregate and retained histories as the continuous reference in each mode.

The I1 worker architecture is unchanged: one lazy worker, 50 ms or 1,000 completed battles per batch, real task yields, and 150 ms progress throttling with initial/final updates. Cancellation includes completed work only. Stale-job protection, retry, disposal, count presets (10k/100k/1M/Custom), streaming sums, first-fastest tie retention, success/timing eligibility, and convergence counters are unchanged. Progress and cancellation do not consume RNG or change mode.

## Deterministic mode difference

`cases.single`, seed 50, identical BattleInput and engine options except mode: the first action `s0-r1-a1` is Player Pepper Breath against `enemy-0`.

| Field | Game-accurate | Strategy |
| --- | --- | --- |
| Standard stage | Threshold 125; real roll 125; Miss | Bypass; Hit; no threshold or roll |
| Action frames | 194 | 685 |
| MP charged | 0 | 8 |
| Damage | 0 | 17 |

The test changes only accuracy mode and checks the corresponding first action. Later draws need not align because Strategy did not consume that accuracy draw. The independent seed-42 pre-edit baseline fixture protects exact Game-accurate compatibility.

## Validation (items 45–53)

| Check | Result |
| --- | --- |
| Full Node test suite | 1,923 / 1,923 passed; 128 added checks beyond I1's 1,795 |
| Data self-checks | 57 / 57 |
| Battle-skill checks | 11 / 11 |
| Effect coverage | 598 occurrences, 100 groups, 5 unused dictionary rows; exact existing artifacts unchanged |
| Workbook source check | Passed against `C:\Users\rafae\Downloads\DW2 Modding Info.xlsx`; all 68 bytes, labels, effect dictionary, and provenance |
| TypeScript app and node projects | Both passed |
| Production build | Passed; existing large-chunk warning remains |
| Lint | Existing baseline unchanged: 3 errors / 7 warnings; no new findings |
| Git diff whitespace check | Passed |

The tests cover defaults, both sides and action kinds, formula compatibility, AOE, mechanical gates, Interrupt qualification/restart/timing, Shadow Scythe, recovery and status RNG, deterministic mode difference, batch equivalence, worker snapshots/cancellation, UI locking/help/reset, result audit/provenance, Planner immutability, and unchanged deferred-effect coverage. UI validation uses component interaction tests and rendered Results markup; it is not a claim of a browser visual test.

Lint's pre-existing errors remain in `src/components/ui/command.tsx`, `src/components/ui/textarea.tsx`, and `tailwind.config.ts`. The build retains its existing bundle-size warning. No unrelated cleanup or mechanics optimization was included.

## Files (items 1–2)

Created:

- `src/utils/battle/battleSimulationRules.ts`
- `tests/accuracyMode.test.cjs`
- `tests/accuracyModeIntegration.test.cjs`
- `tests/fixtures/accuracyModeBaseline.json`
- `scripts/benchmarkAccuracyModes.cjs`
- `docs/phase-2k-i2/IMPLEMENTATION.md`
- `docs/phase-2k-i2/performance.json`

Modified:

- `src/utils/battle/battleTypes.ts`
- `src/utils/battle/battleAccuracy.ts`
- `src/utils/battle/battleSimulation.ts`
- `src/utils/battle/battleCompatibility.ts`
- `src/utils/battle/battleSimulationSearch.ts`
- `src/workers/battleSimulationProtocol.ts`
- `src/workers/battleSimulationHost.ts`
- `src/types/digimon.ts`
- `src/components/BattleSimulation.tsx`
- `src/components/BattleResults.tsx`

## Benchmarks (items 54–56)

Final-version measurements from `node scripts/benchmarkAccuracyModes.cjs`, Node v24.20.0, `cases.single`, seed 42. Each mode uses its own search and continuous RNG. These exercise the production worker host with actual task yields and cloned messages in Node, not a browser end-to-end UI benchmark. The final measurement pass ran after full validation; a brief UI test rerun occurred during the last sample. Single samples are descriptive, not a controlled statistical speed comparison. No unrelated optimization was made.

| Mode | Simulations | Wall seconds | Simulations/s | Fastest frames | Successes | Best occurrences |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| strategy | 10,000 | 1.530 | 6,536 | 6165 | 10,000 | 10,000 |
| game-accurate | 10,000 | 1.214 | 8,239 | 4201 | 10,000 | 2 |
| strategy | 100,000 | 11.046 | 9,053 | 6165 | 100,000 | 100,000 |
| game-accurate | 100,000 | 17.053 | 5,864 | 4201 | 100,000 | 5 |
| strategy | 1,000,000 | 129.242 | 7,737 | 6165 | 1,000,000 | 1,000,000 |
| game-accurate | 1,000,000 | 136.574 | 7,322 | 4201 | 1,000,000 | 76 |

The separate instrumented 1,000-run RNG sample records Strategy: 10,000 action-choice, 10,000 initiative, 9,000 target-choice, and **zero accuracy** draws (29,000 total). Game-accurate: 10,228 action-choice, 10,228 initiative, 9,228 target-choice, and **9,228 accuracy** draws (38,912 total). These are measured sample counts, not extrapolated million-run draw totals. Other draw categories are absent from this simple fixture.

Strategy’s best is 6,165f for this fixture; Game-accurate can find 4,201f histories that include ordinary accuracy luck. Neither result establishes a global optimum or implies that the two modes represent the same battle rules. The existing best-found and occurrence semantics remain local to each mode/search. Raw wall time, throughput, progress counts, result sizes, successes, and best occurrences are in [performance.json](performance.json).
