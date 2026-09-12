# Phase 2K-D — implementation and validation report

Implemented on `phase-2k-d-frame-timing-resources`, based on committed Phase 2K-C merge `9d1a888`. No commit or push was made. Engine version is now `2k-d-frames-resources-v1`; seeded RNG remains `mulberry32-v1`.

## Files created

| File | Responsibility |
|---|---|
| `src/utils/battle/battleTiming.ts` | Independent measured frame profile, outcome-aware resolver, canonical timing classification and completeness totals |
| `src/utils/battle/battleResources.ts` | Canonical MP costs, special-payer limitations, typed depletion transitions and display text |
| `src/utils/battle/battleChains.ts` | Reviewed numeric-ID Shadow Scythe exception and immediate repeat scheduling |
| `tests/battleTimingResources.test.cjs` | 93 tests covering the timing table, resource policies, chains, totals, aggregates and UI |
| `scripts/benchmarkBattleTiming.cjs` | Repeatable representative batch and three-KO Shadow Scythe benchmark |
| `docs/phase-2k-d/performance-before.json` | Baseline measured before Phase 2K-D edits |
| `docs/phase-2k-d/performance-after.json` | Measurements after implementation, including record counts |
| `docs/phase-2k-d/PHASE-2K-E-DECISIONS.md` | All ten confirmed future status decisions, explicitly unimplemented |
| `docs/phase-2k-d/VALIDATION.md` | This report |

## Files modified

- `src/utils/battleEngine.ts`: exposes timing helpers and the streaming batch aggregator through the existing facade.
- `src/utils/battle/battleTypes.ts`: action outcome, frame coverage, MP trace, typed alerts and dedicated chain cause; removes Guard selection/action/runtime slots.
- `src/utils/battle/battleActions.ts`: rejects non-skill choices before creating a planned action; initializes chain context.
- `src/utils/battle/battleInput.ts`: players start active even at zero HP; rejects empty player teams after validating encounter identities; requires reviewed identity for the Shadow Scythe exception.
- `src/utils/battle/battleState.ts`: only enemy KO completion ends a supported battle; player HP cannot cause defeat.
- `src/utils/battle/battleSimulation.ts`: resource accounting, player/enemy HP distinction, action-level frame assignment, repeat execution and timing totals.
- `src/utils/battle/battleReactions.ts`: explicitly keeps Counter reaction context separate from chain context.
- `src/utils/battle/battleLegacyEffects.ts`: updates the cleanup comment; legacy damage/effect execution is unchanged.
- `src/utils/battle/battleSupport.ts`: updates the diagnostic wording for partially measured timing coverage.
- `src/utils/battle/battleCompatibility.ts`: removes fake seconds and per-impact time projection; streams completed runs into victory-only frame/action aggregates.
- `src/types/digimon.ts`: migrates public `SimulationResult` to nullable frame aggregates and canonical action histories; removes the obsolete `BattleTurn.timeSeconds` field.
- `src/components/BattleResults.tsx`: action-level frame history, impacts, MP traces, depletion notices, coverage diagnostics and completed-success statistics.
- `src/components/__fixtures__/ThemePreview.tsx`: uses an actual seeded measured simulation instead of fake second-based display values.
- `tests/battleCharacterization.test.cjs`: preserves original snapshot data and compares its complete damage/target/round prefix across intentional resource/timing changes.
- `tests/battleEngineCore.test.cjs`: updates only the intentionally superseded null-timing, no-MP-accounting and planned-Guard expectations.

Authoritative `battleSkills.ts`, `wazaSource.ts`, canonical effect descriptors and raw records were not modified. No second skill database, Planner integration or schema change was introduced; Run Planner remains v7. Alias Fake remains unresolved and rejected. The extracted damage formula is unchanged.

## Authoritative timing profile and provenance

The following values come directly from the user's Phase 2K-D project-authoritative measurements. They live outside WAZADATA and are never converted from the old 10/12/14-second estimates.

| Execution | Effective targets | Frames |
|---|---:|---:|
| Explicit full-action Miss | Any measured class | 194 |
| Single-target normal/Hit | 1 | 685 |
| AOE normal/Hit | 1 | 703 |
| AOE normal/Hit | 2 | 873 |
| AOE normal/Hit | 3 | 990 |
| FIELD_ALL normal/Hit | 2 | 758 |
| FIELD_ALL normal/Hit | 3 | 838 |
| FIELD_ALL normal/Hit | 4 | 915 |
| FIELD_ALL normal/Hit | 5 | 995 |
| FIELD_ALL normal/Hit | 6 | 1071 |

`resolveActionTiming` takes action kind, timing class, effective target count and explicit action outcome. The profile and its nested tables are frozen. Successful durations require supported integer target counts. Unsupported counts return `null` and a diagnostic; there is no extrapolation, interpolation or zero-duration substitution.

An explicitly classified full-action Miss receives 194f exactly once, overriding successful target-count timing. Miss is not encoded as zero targets and is not inferred from any individual impact. Cancelled, skipped, invalid and unsupported actions receive no invented timing. Guard is rejected even if an untyped timing caller labels it Miss.

**Knowing Miss timing does not implement Miss resolution.** Normal simulation still produces the previous successful/non-Miss execution path and consumes no hit/miss RNG. A synthetic action-record test validates a Shadow Scythe Hit+KO (685f) followed by an explicitly classified Miss (194f), totaling 879f and stopping the chain. There is no production forced-Miss option or seed UI.

## Timing classification, execution targets and completeness

The current resolver proves measured Single/AOE coverage only for a canonical Attack with ordinary one-enemy/all-enemies targeting matching the executed legacy target mode. Single vs AOE is determined by semantics, not impact count: one Single impact costs 685f, while one AOE impact costs 703f. Random-target modifiers, incompatible target projections, custom/synthetic techniques and actions explicitly redirected to allies retain unknown timing.

Execution revalidates live targets. Enemy KOs before an AOE remove those enemies from its effective count; zero-HP players remain valid targets. One AOE execution owns one `durationFrames`, irrespective of the number of impacts. Individual impacts carry no duration. Skipped/cancelled intentions remain inspectable as non-executions.

FIELD_ALL's exact measured table is implemented and tested independently. **No currently executed legacy skill is promoted to FIELD_ALL**, because the current core does not establish full-field execution semantics. Merely having four or more Digimon on the battlefield is not sufficient. Canonical field-target records remain unresolved for execution timing. No Counter, Interrupt or Assist successful duration is guessed; their canonical kinds remain intact.

`BattleRunResult` exposes `totalFrames`, `knownFrames`, `timingCompleteness` and `timingDiagnostics`. `totalFrames` is the sum of executed durations only when every executed duration is known. Otherwise it is `null`; `knownFrames` is explicitly just the known subtotal. Unknown actions are identified in diagnostics by deterministic action ID. With zero executed actions, the sum is zero; this does not assign a duration to Guard/skipped/unsupported intentions and cannot make an incomplete outcome a timed victory.

## Public results and UI

The public input/callback API remains `runBattleSimulation(player, enemy, floorSpecialty, count, options)`, but its output model deliberately changes:

- Removed `minTime`, `avgTime`, `maxTime`, `fastestBattleByTime` and impact-level fake seconds.
- Added nullable `minFrames`, `avgFrames`, `maxFrames` and canonical `fastestBattleByFrames` action history.
- Existing `minTurns`, `avgTurns`, `maxTurns` now count actions from completed successes only and are nullable when unavailable.
- Added completed/timed/incomplete-timing success counts, outcome counts, timing/resource diagnostics and runs-with-resource-alerts count.
- `fastestBattleHistory` contains canonical action records for the completed victory with the fewest actions.

The streaming aggregator excludes enemy wins, limits, invalid and unsupported outcomes from all victory statistics. Frame aggregates additionally exclude successful runs with incomplete timing. The frame-selected history is the actual minimum-frame successful run, not the fewest-impact or fewest-action history. If no timed success exists, frame aggregates remain `null` and the frame history is empty.

The existing facade still throws an explicit diagnostic for invalid/unsupported/limited batches, preserving the current UI error-handling boundary. The exported pure aggregator also supports inspecting mixed core outcomes and is tested independently. It does not retain every history in a batch.

BattleResults shows comma-formatted frames prominently, with one decimal where useful for averages. Each action groups its impacts under one duration; MP before/cost/after and resource alerts appear alongside it. Skipped entries display “Not executed.” Unknown timing displays “Unavailable” plus coverage messages. Timing statistics state how many complete timed victories participate. Old arbitrary 200/50-second recommendations and second-based spread logic are removed; no guessed frame thresholds replace them. Success-rate coaching was removed because continued offensive execution at zero player HP makes it misleading as an in-game survival judgment.

The local browser preview was inspected at `tests/theme-preview.html#results`: summary cards displayed 685f, the one-hit action had one 685f label, the enemy intention was skipped, and the MP-depletion notice appeared near the action. Server-render tests additionally cover HP alerts, incomplete Counter timing and unavailable aggregates.

## HP, MP and typed resource alerts

Players remain active for selection, execution and targeting even when HP reaches zero. Runtime HP is clamped at zero. The retained `isAlive` property means scheduling/target eligibility for players; it is not an in-game revival claim. Player depletion cannot produce enemy victory. Empty player input is explicitly invalid; encounter identity validation remains first so Alias Fake/empty technique errors are not masked.

Enemies retain real KO handling: zero HP clears eligibility, prevents later actions, removes targets and reduces subsequent AOE counts. Once all enemies are KO'd, the run completes successfully even if player resource alerts occurred. The max-round operational limit still applies.

Every actual known-skill execution charges its WAZADATA MP cost to its actor, clamped at zero. Both sides continue with insufficient/zero MP; selection never substitutes another skill or filters on available MP. Each action exposes `mpAccounting` with before, `costCharged`, after and completeness. Skipped, cancelled, Guard and unsupported Assist intentions do not pay costs.

**Special payer limitation:** Pummel Whack, canonical **0x89**, is the sole decoded `counter-payment` skill. Its table MP cost is 20, but the effect names the enemy as payer. This phase preserves the prior no-payment compatibility path and emits an explicit resource diagnostic, with `costCharged: null` and incomplete accounting. It does not debit an invented payer or claim generic own-payment correctness. Authoritative Counter semantics remain deferred.

Unknown custom/synthetic skill costs are likewise not invented: the no-payment compatibility path is explicit, traced and diagnosed. Initial canonical Shadow Scythe pays 20 MP; its reviewed repeats pay exactly zero additional MP.

`BattleResourceAlert` is typed as `player-hp-depleted` or `player-mp-depleted` and includes stable combatant ID and display name. HP alerts are attached to the action containing the causing impact; MP alerts attach to the paying action. MP accounting precedes impact processing, providing deterministic alert order. Only positive-to-zero transitions alert. Continued damage/cost at zero does not repeat alerts, while a later restoration above zero permits a new transition alert. The existing compatible HP drain demonstrates that behavior. Enemy MP depletion does not produce a player alert.

Alert text explains that omitted in-game recovery/revival or Guard/items are required. Alerts never insert actions, pay recovery costs, change stats or add frames. All resource accounting operates on snapshots and leaves input teams unchanged.

## Guard exclusion

Guard was removed from production `ActionChoice`, `PlannedAction`, action-kind and runtime Guard state. Non-skill runtime policy requests are rejected as unsupported before a Guard intention is created. Guard receives no frame duration, MP recovery or DEF bonus and is absent from Team Builder and Battle Simulation selection paths. Its only UI mentions explain omitted recovery in depletion messages.

## Shadow Scythe reviewed exception

`battleChains.ts` isolates the confirmed rule by canonical numeric **0x4D**. It is not a new WAZADATA flag or display-name special case. A reviewed legacy key or explicit numeric identity survives a renamed display string. An unrelated custom skill merely named Shadow Scythe does not acquire 0x4D through name fallback, and a different explicit canonical ID cannot gain the rule.

A resolved 0x4D Attack with one KO impact on an enemy can immediately schedule a repeat if another eligible enemy exists. The repeat is placed at the front of the explicit queue, stays in the same round and gets its own deterministic action ID, impact and timing. It selects randomly among remaining live enemies at execution using the existing categorized target RNG. It consumes no new action-choice or initiative draw. The KO'd enemy is never selected again, including duplicate-species cases.

Each repeat points to the immediately preceding execution through `chainFromActionId`. This is separate from `reactionToActionId`/triggering actor/counter actor fields. Repeats have null Counter reaction context. A surviving target can still trigger the preserved legacy Counter policy with the repeat action as cause; a KO'd target cannot react. The chain-specific scheduling exception does not grant unrelated actors additional turns.

Each successful Shadow Scythe execution costs 685f; three cost 2055f. Only the initial selection pays normal 20 MP; any number of repeats pay zero additional MP. The latest execution must KO to continue. A non-KO, no remaining target, unavailable actor/action or future action-level Miss stops further execution. The explicit Miss helper/test does not add production accuracy behavior.

A truly custom, noncanonical legacy `chainOnKill` input can retain its previous multi-impact compatibility behavior. It remains marked custom, with unknown timing/cost diagnostics. No other canonical identity gets a generic chain rule from that legacy descriptor.

## Intentional changes and deferred mechanics

Intentional changes are measured action-level frame timing, outcome-aware 194f Miss timing support, continued player execution at zero HP, non-blocking MP accounting, typed depletion alerts, complete Guard exclusion and the reviewed 0x4D repeat exception. Empty player scenarios now report invalid rather than a fabricated defeat. The numeric-ID requirement for the exception deliberately prevents borrowed display names from acquiring it.

Unrelated damage arithmetic, rounding, attribute/specialty/tile modifiers, debuff stack approximations, consecutive-power cap and legacy drain behavior remain unchanged. Existing characterization snapshots were not rewritten: all original damage/target/round prefixes still match, and baseline victories retain their full impact count. Four core expectation areas changed only because Phase 2K-D explicitly supersedes null timing, no MP charge, Guard representation and phase-specific timing assertions. One full-suite failure exposed validation ordering; the production ordering was fixed without changing its existing data test.

Authoritative Counter scheduling/targeting/payment, Interrupt scheduling/modification, Assist execution, Hit Rate, accuracy/evasion modifiers, Can't Miss, forced Miss and mixed AOE accuracy remain deferred. No Poison, Paralysis, Confusion, natural recovery, cure or +10 Poison damage was implemented. All ten confirmed Phase 2K-E status decisions are preserved in [PHASE-2K-E-DECISIONS.md](PHASE-2K-E-DECISIONS.md). RNG still consumes only choice, initiative and target-selection draws.

## Verification

| Check | Result |
|---|---|
| All tests | **952/952 passed**, zero failures/skips/cancellations |
| New timing/resource tests | **93/93 passed** |
| Core and characterization tests | **63/63 passed** |
| Existing data/Planner/hardening/rank/export/theme tests | **796/796 passed** |
| Data self-checks | **57/57 passed** |
| Battle-skill coverage check | Passed, authoritative coverage unchanged |
| Workbook source `--check` | **Passed** against `C:\Users\rafae\Downloads\DW2 Modding Info.xlsx`; all 68 bytes, labels, effect dictionary and provenance match |
| App TypeScript | Passed |
| Node TypeScript | Passed |
| Production build | Passed; 1,839 modules, built in 8.78s |
| Lint | **3 errors / 7 warnings**, unchanged baseline, no new finding |
| Browser verification | Frame summary/action timing/MP alert preview inspected successfully |
| Diff/whitespace | Checked before delivery, including new files |

The build initially failed under sandbox directory restrictions. Expanded-access approval was temporarily unavailable due to an approval-review usage limit; after the user resumed, a new approved build succeeded. No build/dependency configuration workaround was introduced. Existing build warnings remain for old Browserslist data and the large bundle. Remaining lint findings are existing UI empty interfaces/Tailwind require and seven component export warnings.

The workbook was temporarily unavailable during initial verification. After the user confirmed it was restored at the original Downloads path, the fresh workbook source `--check` passed for all 68 bytes, labels, effect dictionary and provenance. Canonical source fingerprints and all raw-data self-checks also pass; no authoritative source file changed.

Reproduction commands:

```text
node --test tests/battleCharacterization.test.cjs tests/battleEngineCore.test.cjs tests/battleTimingResources.test.cjs tests/battleSkillData.test.cjs tests/runPlanner.test.cjs tests/runPlannerHardening.test.cjs tests/rankLearning.test.cjs tests/routeExport.test.cjs tests/theme.test.cjs
node scripts/checkBattleSkills.cjs
python scripts/importBattleSkills.py "C:\Users\rafae\Downloads\DW2 Modding Info.xlsx" --check
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.node.json
npm run build
npm run lint
node scripts/benchmarkBattleTiming.cjs
git diff --check
```

The environment uses bundled Python rather than a bare `python` command. `runDataSelfChecks()` was invoked through the existing TypeScript test loader; all 57 results were true. Local verification logs use the ignored `phase-2kd-` prefix.

## Performance and record counts

Same Phase 2K-C AOE fixture, seed 42 and public batch API, counts measured in order after loading modules:

| Simulations | Before, ms | After, ms |
|---:|---:|---:|
| 1 | 4.283 | 5.168 |
| 100 | 12.568 | 18.356 |
| 1,000 | 103.364 | 115.244 |

The representative seeded run changed from **6 executed actions / 8 records / 10 impacts** to **21 executed actions / 24 records / 33 impacts**. This is expected because player HP depletion no longer ends the offensive simulation. These are comparable fixtures, not identical battle trajectories or controlled performance measurements; JIT/GC and host load also influence single samples.

A separate 1,000-run three-KO Shadow Scythe sample took **27.868 ms**. Each run produced **3 executions / 6 records / 3 impacts / 2055f**, with three remaining enemy intentions recorded as skipped. Batches stream runs and retain only selected histories; no broad optimization was necessary. Long zero-damage battles remain bounded by the existing 1,000-round operational guard.

## Final confirmations

- No action timing value outside the supplied table was invented. Totals are sums; alerts add none.
- No normal hit/miss RNG, Poison/Paralysis/Confusion, natural recovery or cure was implemented.
- Authoritative Counter, Interrupt and Assist mechanics remain deferred and diagnosed where relevant.
- Guard cannot be selected or executed as a production simulation action.
- Player HP/MP depletion alerts add no actions, frames, Guard, items or recovery effects.
- Authoritative skill records and Planner schema remain unchanged.
- No commit or push was made.
