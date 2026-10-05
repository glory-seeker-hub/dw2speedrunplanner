# Phase 2O-A — Capture target objective and last-defeated tracking

Implementation date: October 5, 2026. All changes are local and uncommitted.

## Baseline

- Starting branch: `phase-2o-a-capture-target-objective`. It already existed with a clean working tree and the exact same HEAD as `main`; it was reused without resetting or recreating it.
- Baseline `main`, starting HEAD and verified remote `main`: `2a4c8e1e2b653ef3e49451f6b03c082feaa8b1ef`.
- Origin: `https://github.com/glory-seeker-hub/dw2speedrunplanner.git`.
- Application package: **1.1.0**. Planner schema: **7**. Simulation Report: **1**. Backup Format: **1**.
- Actual lint baseline: **3 errors, 7 warnings**. Errors are existing empty interfaces in `command.tsx` and `textarea.tsx`, and the existing require import in `tailwind.config.ts`. Seven existing React Refresh warnings occur in UI primitives.

## Architecture and identity

`src/utils/battle/battleCaptureObjective.ts` owns target validation, encounter-slot mapping, last-defeated resolution and the capture-qualified victory predicate. Engine positions are zero-based; display positions are E1, E2, E3. A target stores `position`, optional authoritative `encounterSlot`, and a display-only `name`. Impact `targetId` resolves against Enemy combatants, never against species names.

Only canonical resolved action records and their `impact.ko` flags contribute. Across records, the later sequence wins. Within a record, the explicit maximum defeated Enemy position wins; impact iteration order cannot decide the result. The evaluation includes target, last defeated combatant, action ID, sequence, simultaneous KO positions and `satisfied`. No KO evidence produces `null`, never a fabricated Enemy.

Success requires both mechanical `player-win` and the correct last defeated Enemy. No edits were made to `battleSimulation.ts`, `completedOutcome`, damage resolution or KO mechanics. Evaluation is linear in action/impact history, uses small positional metadata, and does not retain all rollout histories.

## Planner and manual setup

`buildPlannerBattleAnalysisPreset` derives ephemeral `captureObjective` data from the existing `capturedEnemySlot`. It maps the slot to the exact array position in the shared encounter adapter. Duplicate species remain distinct. A null slot omits the objective; invalid or ambiguous slots raise an explicit error.

Analyze Battle displays the recorded target and sends it automatically. The imported target has no editable selector. Switching to manual setup is explicit. Manual Encounter setup offers only that encounter's real slots, resets the choice when the encounter or Enemy source changes, and hides the selector for arbitrary saved Enemy teams. No Planner or backup fields were added.

## Random and aggregate search

Existing raw outcome counts, `completedSuccesses`, `winRate` and raw timing totals remain mechanical battle statistics. Optional `capture` data adds qualified successes, success percentage, timed successes, minimum/average/maximum frames and the retained route evaluation. The denominator remains completed observed simulations.

Capture-mode fastest-frame and fewest-action histories contain only qualified victories. Progress and convergence use qualified results. Aggregation remains streaming, with a bounded number of retained histories. Technical raw totals are explicitly distinguished from capture-qualified summaries in Results and Markdown.

## Optimized search

- Fastest Potential's independent tracker accepts only capture-qualified, complete-timing victories.
- Average Victory excludes wrong-capture victories from frame samples and representative samples.
- Success Rate counts qualified wins over the existing evaluation denominator. Divergence handling is unchanged. Optional `rawVictories` preserves mechanical wins for fair-stage presentation.
- Candidate ranking, samples, best-action history, completed paths, finalists and outer pass recommendations consume these qualified statistics.
- A terminal wrong-capture victory cannot be extended or retained as a successful completed path. Its fallback score ranks below unfinished prefixes; unfinished prefixes keep the existing remaining-Enemy-HP heuristic.
- If no candidate has a qualified victory, the outer result does not recommend that candidate's orders as a successful route. Qualified fastest observations remain independent of fair-prefix ranking.
- Search schedules, paired seeds, beam and depth policies, budgets, Thoroughness settings and tie-break order were not redesigned.

## TAS Luck and replay

The inner TAS selector receives the optional normalized target and calls the central success predicate. For one fixed Player plan, a slower correct-capture branch outranks a faster wrong-capture branch. Among qualified wins, the old frame and lexical tie-breaks remain. Omission of the target follows the previous behavior.

The deterministic regression explores both branches in both insertion orders: 10,000 frames with the wrong last KO and 10,500 frames with the correct last KO. Capture mode selects 10,500; ordinary mode selects 10,000. Replay validation also checks the retained capture goal. A separate real-engine test covers cancellation after a valid TAS branch is retained but before its fair sample completes: the route remains satisfied while unfinished-sample success counts remain zero.

## Results and Simulation Report

Results displays target position/slot/name, last defeated Enemy, Satisfied/Failed, separate Battle Win Rate and Capture Success Rate, qualified timings, and the explicit same-action rightmost rule. Fair-prefix metrics distinguish qualified success from raw battle wins. No qualifying route produces bounded-search wording, never an impossibility claim.

Report JSON and Markdown contain an additive Capture Objective section with the same rule, tie-break, target, retained execution evaluation, rates and diagnostic. Dispatch configuration freezes the target. Report v1 remains compatible; no-objective reports omit the extension. Existing Average/Success reports still identify their executed replay as a separate global fastest observation rather than claiming it is a representative replay of the selected fair strategy.

If no qualified history is retained, Results reports no retained qualifying execution instead of presenting a wrong-capture execution as a recommendation. The central evaluator can still describe wrong-capture executions independently.

## About and documentation

The existing `src/components/InfoDialog.tsx` Battle Mechanics tab now explains capture-aware search, automatic Planner propagation, optional manual targets, E3 > E2 > E1 for one action, capture-qualified objectives, raw victory versus capture success, and bounded-search limitations. The existing How to Use content and README received narrow matching explanations. No duplicate About page was created.

## Version and scope audit

Application 1.1.0, Planner schema 7, Report 1 and Backup 1 are unchanged. Capture configuration is ephemeral; report/result extensions are optional. No release metadata or dependencies changed.

No changes were made to damage, accuracy, action order, targeting mechanics, status behavior, Poison/Paralysis/Confusion, Counter or Interrupt mechanics, timing measurements, MP accounting, progression, XP, Bits, capture creation, DNA, Digivolution, trading or encounter data. Search-success filtering changed as requested; search budgets and Thoroughness semantics did not.

Edge-case audit: AoE and AoE Counter impacts share one action boundary; chained/repeated executions use separate records; revived Enemies can contribute a later KO; Confusion and unusual attackers do not change Enemy identity; duplicate species use IDs/positions; one-enemy battles use E1; Counter/Interrupt completions are ordinary resolved records; zero-damage/invincible impacts without KO contribute nothing; HP text or zero HP alone is not evidence; skipped/cancelled records are ignored. Existing mechanics tests remain in the complete suite.

## Tests and validation

New file: `tests/battleCaptureObjective.test.cjs`, **45 tests**. It covers sequential/reversed KOs; all required simultaneous position combinations; shuffled real AoE impacts; duplicate species; missing evidence; non-winning outcomes; target mapping and rejection; raw 3/4 versus qualified 2/4 accounting; fastest/average filtering; inner TAS branch selection; all three real optimized objectives; Random and Optimized Worker request/response and cancellation; report agreement; historical Planner propagation; UI dispatch/selection/reset/results/About; Thoroughness compatibility; TAS partial cancellation; and legacy API validation.

The existing deterministic Random, Optimized, TAS, Worker and report regression tests are retained. The initial targeted regression run passed **198/198**. The first complete successful run passed **3,368/3,368** before the final two regression tests were added.

Validation commands:

```text
node --test tests/*.test.cjs
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
node scripts/checkBattleSkills.cjs
node scripts/checkBattleEffectCoverage.cjs
runDataSelfChecks() via the established tests/helpers/loadTs.cjs loader
python scripts/importBattleSkills.py "C:\Users\rafae\Downloads\DW2 Modding Info.xlsx" --check
npm run build
npm run lint
git diff --check
```

Data checks passed **63/63**; skill checks passed **12/12**; effect coverage passed **598 occurrences / 101 groups / 5 unused dictionary rows**; workbook verification passed all 68 bytes, labels, effect dictionary and provenance. Both TypeScript checks and production build passed. Existing build warnings concern stale Browserslist data and large chunks; dependencies were not updated to address them.

An initial sandboxed full-suite/build attempt encountered intermittent `EPERM` filesystem reads and downstream false missing-module errors. Repeating outside the sandbox passed; those infrastructure failures were not hidden or treated as successful validation. Final counts and lint comparison are recorded in the completion note below.

Final completion note: **3,370/3,370 tests passed**, including **45/45 new focused tests**; zero failed, cancelled or skipped. Both final TypeScript checks returned exit 0. The final production build passed (1,893 modules). Final lint remains **3 errors / 7 warnings**, and a line-for-line comparison with the captured baseline returned no differences: **zero new lint findings**. `git diff --check` returned exit 0; Git only emitted its usual LF-to-CRLF working-copy notices. Logs: `phase-2oa-final-tests.log`, `phase-2oa-focused.log`, `phase-2oa-final-ts-app.log`, `phase-2oa-final-ts-node.log`, `phase-2oa-final-build.log`, `phase-2oa-baseline-lint.log`, and `phase-2oa-final-lint.log` (ignored local files).

## Production-preview smoke

Local preview: `http://127.0.0.1:4173/`, with the production bundle and real Worker. The browser initially timed out, then became available through the Codex panel.

- Created a local test run named `Phase 2O-A local smoke` and recorded Encounter 154 with capture slot 2, Gizamon.
- Analyze Battle displayed the recorded target automatically. With local ATK/SPD overrides of 999 and a 64-evaluation Optimized budget, Results showed E2/Gizamon last, Satisfied, 100% raw Battle Win Rate and 50% observed Capture Success Rate. The selected fair strategy showed 100% capture success. The 2,055-frame replay defeated Gazimon first and Gizamon last.
- Recorded a second battle with no capture and ran 8 Random samples. Results showed the ordinary Simulation Summary, 100% success and no Capture Objective section.
- Manual Encounter 154 offered only Gazimon and Gizamon. Selecting slot 2, then changing to Encounter 155, reset to No capture objective and offered only Leomon, Veedramon and ToyAgumon.
- About's Battle Mechanics tab displayed the new capture explanation and bounded-search disclaimer. Console inspection returned no errors or warnings.
- A real engine AoE fixture verifies simultaneous E1/E2/E3 KOs and shuffled impacts in automated tests; no separate browser AoE fixture was added.

Screenshot evidence is stored outside the repository at `C:\Users\rafae\.codex\visualizations\2026\10\05\01a10bfe-728d-7e50-8ee2-440e3a34e918\capture-results.png`.

## Changed files

| File | Purpose |
| --- | --- |
| `README.md` | Describe capture-aware simulation and separate success metrics. |
| `src/components/BattleResults.tsx` | Present capture evaluation/rates and distinguish raw technical totals. |
| `src/components/BattleSimulation.tsx` | Display locked Planner targets, select manual Encounter targets, reset and dispatch. |
| `src/components/InfoDialog.tsx` | Document capture behavior in the existing About dialog. |
| `src/components/OptimizedSearchResults.tsx` | Label fair qualified statistics and raw battle win rate. |
| `src/components/help/userGuideContent.ts` | Add capture semantics to the existing guide. |
| `src/types/digimon.ts` | Add optional capture summary to SimulationResult. |
| `src/utils/battle/battleCaptureObjective.ts` | Centralize positional target validation, KO resolution and qualification. |
| `src/utils/battle/battleCompatibility.ts` | Preserve raw streaming counts and add qualified aggregates/histories. |
| `src/utils/battle/battleFastestRoute.ts` | Filter the independent tracker and retain route evaluation. |
| `src/utils/battle/battleOptimizedSearch.ts` | Qualify candidates, inner TAS, samples, histories and terminal/fallback paths. |
| `src/utils/battle/battleSearchObjectives.ts` | Count qualified successes with optional raw victory statistics. |
| `src/utils/battle/battleSearchPasses.ts` | Merge capture totals and prevent failed-prefix recommendations. |
| `src/utils/battle/battleSimulationReport.ts` | Freeze objective configuration and extend report v1 compatibly. |
| `src/utils/battle/battleSimulationReportSerialization.ts` | Serialize capture rules, rates, status and diagnostics to Markdown. |
| `src/utils/battle/battleSimulationSearch.ts` | Propagate objective into Random/TAS search, progress and partial results. |
| `src/utils/battle/battleTasLuck.ts` | Make internal RNG-path selection capture-aware. |
| `src/utils/battle/battleTasLuckReplay.ts` | Verify capture qualification during retained TAS replay. |
| `src/utils/battle/battleTypes.ts` | Add optional search capture configuration. |
| `src/utils/runPlanner/runBattleAnalysis.ts` | Derive the objective from the already persisted capture slot. |
| `src/workers/battleSimulationHost.ts` | Forward objective into both Worker search methods. |
| `src/workers/battleSimulationProtocol.ts` | Extend the serializable START contract. |
| `tests/battleCaptureObjective.test.cjs` | Add 45 focused domain, search, Worker, report and UI regressions. |
| `docs/phase-2o-a/implementation-report.md` | Record implementation, validation, scope and smoke evidence. |

## Git and publication

Branch remains `phase-2o-a-capture-target-objective`; HEAD remains the baseline. There are 21 modified tracked files and three new files listed above. Local validation logs and build output are ignored artifacts. No commit, push, merge, tag, publishing or deployment was performed.
