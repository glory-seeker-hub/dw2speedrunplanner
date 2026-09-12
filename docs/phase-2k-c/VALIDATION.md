# Phase 2K-C — Battle engine core architecture and determinism

Branch: `phase-2k-c-battle-engine-core`. No commit or push.

The existing public simulator API now delegates to a deterministic action/impact core. Authoritative WAZADATA, its decoder, skill definitions, aliases and coverage data are unchanged. No Planner schema, UI flow, frame timing, hit/miss, status, MP-consumption, Guard, authoritative Counter, Interrupt or Assist mechanics were implemented.

## Files and responsibilities

Created under `src/utils/battle/`:

| Module | Responsibility |
|---|---|
| `battleRng.ts` | Validated RNG primitives, production adapter, programmed sequences and versioned seeded generator |
| `battleTypes.ts` | Runtime state, selections, planned actions, impacts, records, policies, options and outcomes |
| `battleInput.ts` | Snapshot legacy team/encounter inputs, link canonical skill IDs, validate input and explicitly mark synthetic fallback |
| `battleState.ts` | Numeric validation, effective parameters, stable-ID combatant lookup and completion checks |
| `battleActions.ts` | Random compatibility selection policy, deterministic action IDs, planning and execution revalidation |
| `battleOrder.ts` | Effective-SPD plus inclusive 0–10 initiative, with isolated old Counter-last ordering |
| `battleTargets.ts` | Target intent vs execution-time live target IDs |
| `battleDamage.ts` | Extracted legacy damage formula and rounding, with explicit arithmetic rejection |
| `battleLegacyEffects.ts` | Single executed compatibility path for existing effects, consecutive-use state and generic chain behavior |
| `battleReactions.ts` | Named `legacyCounterPolicy`, reaction IDs and causal links |
| `battleSimulation.ts` | Explicit round/queue process, action/impact history, operational termination and outcomes |
| `battleCompatibility.ts` | Existing `SimulationResult`/`BattleTurn` projection, aggregate conventions and isolated legacy timing estimates |
| `battleSupport.ts` | Pure selected-skill/scenario support diagnostics |

Other new files:

- `tests/battleCharacterization.test.cjs`
- `tests/battleEngineCore.test.cjs`
- `tests/helpers/battleFixtures.cjs`
- `tests/fixtures/battle-legacy-characterization.json`
- `scripts/benchmarkBattleCore.cjs`
- `docs/phase-2k-c/performance-before.json`
- `docs/phase-2k-c/performance-after.json`
- `docs/phase-2k-c/VALIDATION.md`

Modified:

- `src/utils/battleEngine.ts`: five-line public facade, preserving `runBattleSimulation` and exposing the canonical core, diagnostics and types.
- `scripts/checkBattleSkills.cjs`: normalize CRLF before comparing the generated report. This fixes a Phase 2K-B verification-script bug after Windows checkout; parsed reports and source bytes were identical. No data was regenerated or altered.

No existing test expectations, Team Builder, BattleSimulation, BattleResults, Planner code, skill mechanics or schema were changed. `tech_data.csv` was not reintroduced.

## RNG and determinism

`BattleRng` provides `nextFloat`, `nextIntExclusive(max)` and `nextIntInclusive(min,max)`. Floats must be finite in `[0,1)`; integer bounds must be safe and valid. `createProductionBattleRng` is the only `Math.random()` boundary. Core resolution never accesses it directly.

`createSequenceBattleRng` snapshots the supplied sequence, records draw category/value and exposes the consumed count. Exhaustion throws `BattleRngError` with the number of consumed draws. Invalid values also throw. There is no looping, fallback or swallowed RNG failure: the core catches only input/arithmetic errors, not RNG exhaustion or programming errors.

Seeded algorithm: **mulberry32-v1**, unsigned 32-bit numeric seed, defined by the explicit integer operations in `battleRng.ts` and a golden-vector test. It is a reproducibility algorithm, not a DW2 RNG claim. Core version: **2k-c-core-v1**. Equal input, fresh equal-seed RNG, engine version and options produce identical outcomes, records, action IDs and final state.

Draw categories include action choice, target choice, initiative, hit/miss, status application/recovery, Interrupt, Counter and Assist. Only action choice, target choice and initiative currently consume draws. No placeholder draws are consumed. Synthetic fallback preserves the old absence of an action-choice draw. A one-hit battle test asserts the exact five-draw budget and category order.

Canonical IDs use `s{simulationIndex}-r{round}-a{monotonicCounter}`. Planning and reactions each allocate IDs without RNG. The batch facade uses the simulation index and one continuous injected RNG stream. No seed UI was added.

## Runtime state, planning and selection

`BattleCombatantState` contains stable combatant ID, optional source instance ID, display name, side, position, species ID/type/specialty, base stats, max/current HP and MP, current parameter multipliers, alive state, skill selections, planned-action ID, reaction state and legacy consecutive/damage-taken state. Separate empty status and temporary-power maps plus `guarding: false` prepare future state without resolving it. Current MP starts at max MP and is never consumed or recovered in this phase.

Default IDs remain player/enemy plus slot. An optional caller `instanceId` is preserved in `sourceInstanceId` and namespaced into runtime identity. Duplicate instance IDs on a side are rejected. Identical species/names remain distinguishable by IDs. Inputs, stats, techniques and special-effect objects are copied; simulations do not mutate caller teams. No Planner integration is performed.

`PlannedAction` distinguishes skill actions from Guard. It contains deterministic ID, round, actor ID, canonical WAZADATA ID through its skill selection, action kind, target intent, lifecycle state, initiative, priority and optional reaction context. Lifecycle states are planned, waiting, resolving, resolved, cancelled and skipped. Actor and target identity are IDs, not mutable combatant references.

`ActionPolicy.chooseAction` separates selection from resolution. The default `legacyActionPolicy` selects randomly among positive-AP legacy techniques, preserving prior draw order and filtering. Future policies can choose skill keys and explicit target IDs; Guard can be represented and planned but returns `unsupported` rather than applying speculative effects. A policy-selected Assist likewise retains its canonical kind and returns unsupported. Existing damaging Interrupt techniques retain `kind: interrupt` while using only their prior legacy offensive path; no interruption scheduling is inferred.

Target intent is either an opposing side with random-at-execution/all selection, or explicit combatant IDs. Execution resolves current living targets from state. Dead explicit targets are not hit; an intent with no living targets is skipped. Keeping the default random target draw at execution preserves current behavior and draw order. Confusion, invisibility and canonical random-target flags are not newly resolved.

## Initiative and queue

The round process snapshots living actors, obtains choices, creates planned actions, calculates initiative and enqueues stable action IDs. It then pops one ID, revalidates the actor/action, resolves live targets, records one action and its impacts, schedules any legacy reactions, and continues until the queue empties or an explicit outcome ends the run.

Initiative is now **effective SPD + an integer from 0 through 10 inclusive**. Effective SPD uses the existing runtime multiplier. This fixes the old 0–9 range and ignored SPD-debuff state. The multiplier and stack semantics themselves are unchanged. Tests cover both endpoints, a faster actor losing within a 10-SPD gap, an 11-effective-SPD advantage, and a real SPD debuff reversing the next round's order.

The compatibility Counter-last grouping and stable tie ordering remain. Therefore the 11-SPD guarantee applies within base initiative ordering, not across the separately preserved Counter group. Double-own-SPD, WAZADATA act-last flags and other priorities remain deferred.

Killed actors are skipped; cancelled actions cannot execute. At victory, remaining intentions are marked skipped/cancelled and the queue is drained. No stale target object is used. Cancellation and replacement preserve inspectable planned actions.

Future hook locations are explicit, without a generic event framework: `calculateActionOrder` / before-order boundary, `revalidateAction`, the before-hit/after-hit boundary in the impact loop, `applyLegacyImpactEffects`, `afterLegacyAction`, `legacyCounterPolicy`, and the round-cleanup boundary. Those locations currently add no future RNG draws or mechanics.

## Actions, impacts and reactions

One execution produces one `BattleActionRecord`, including AOE. Records contain action ID, round, deterministic record sequence, actor ID/name, skill key/name/canonical ID, kind/source, selected target intent, effective target IDs, impacts, reaction context, final state and optional skip/cancel reason. `actionCount` counts executed actions, never impact rows. Skipped/cancelled intentions remain distinguishable from executions.

Each `BattleImpact` contains target ID/name, HP before/after, damage/healing slots, outcome, applied legacy-effect results and KO state. AOE against three opponents produces one action with three independent impacts, including targets with different DEF and HP. A KO does not erase other impacts. Outcome types reserve miss/blocked/invincible, but those results are not newly resolved.

Every record has **`durationFrames: null`**. `legacyTimingTargetCount` is explicitly only an input to the old output adapter, not an authoritative duration. No frame value was invented or derived from seconds.

`legacyCounterPolicy` preserves immediate insertion after a causing attack, one action per actor, no Counter-to-Counter triggering, Counter-last normal intentions, random legacy opponent selection and existing damage/target effects. The original waiting intention is cancelled and a separate reaction action is allocated. Its context contains `reactionToActionId`, `triggeredByActorId` and `counterActorId`. Repeated immediate insertion preserves the old reversal of simultaneous AOE Counter triggers. A non-triggered Counter still performs its old offensive action with null reaction context; this is explicitly not authoritative Counter scheduling.

Canonical skill identity is linked using reviewed legacy IDs, an explicitly supplied canonical ID when present, or conservative name resolution. Unknown explicit WAZADATA IDs are invalid. Custom positive-AP legacy techniques remain identifiable as custom compatibility inputs, not authoritative records. No second mechanics database was created.

## Compatibility limits and diagnostic support

There is one executed special-effect path, in the named legacy modules. Canonical `effects[]` inform diagnostics but are not executed alongside `specialEffect`. The following remain unvalidated compatibility approximations:

- Counter selection, grouping, immediate triggering, random target choice and non-trigger offense.
- Existing parameter-stack calculation and cap, including its logarithmic stack counting.
- Consecutive-use increment before damage and the existing +25 AP bonus cap.
- Drain equal to damage dealt, capped at the attacker's max HP.
- Generic chain-on-kill, only when explicitly supplied as an old `specialEffect`. The canonical Shadow Scythe definition has no chain descriptor; no new name special case was added.
- Existing damage formula, specialty/attribute matrices, tile handling and rounding order.
- Non-authoritative 10/12/14-second timing, including old per-impact charging in the compatibility projection.
- Existing aggregate minima/averages including defeats; the victory-only Results correction is deferred.

`assessBattleSkill` distinguishes unknown identity, canonical data incomplete, known future mechanics unsupported, and legacy compatibility. The supported classification is reserved; no legacy execution is promoted to a claim of full authoritative support. `assessBattleScenario` snapshots/validates input and reports per-selection assessments without consuming RNG or mutating input. These diagnostics do not broadly block the current UI for every deferred canonical effect.

Synthetic Basic Attack is preserved only for manual teams with no usable damaging technique and no unresolved custom identity requiring a substitute. Its selection/action source is **`synthetic-legacy-fallback`**, canonical ID null. It is never created for unresolved encounters, empty encounter technique lists or unknown explicit WAZADATA IDs. Canonical Assist intentions can still be selected explicitly by a policy instead of that default fallback and are then unsupported.

Encounter 149's **Alias Fake remains unresolved**. Encounter adaptation audits all canonical identities first so an earlier unsupported known technique cannot hide it. It is never mapped to tentative EA, and neither core nor public API returns fake attack results for it.

## Outcomes, safety and deliberate differences

`BattleRunResult` distinguishes player-win, enemy-win, limit-reached, invalid and unsupported, with nullable winner, engine version, rounds, action count, canonical records, state and diagnostics. Limit/invalid/unsupported outcomes have no winner.

`BattleEngineOptions.maxRounds` defaults to **1,000 rounds**. This is an operational simulator guard, not a DW2 rule. A zero-damage battle reaches the bound with explicit `limit-reached`. The old public facade rejects an incomplete batch with the diagnostic rather than emitting a misleading completed `SimulationResult`; the existing UI's error handler already handles that path. Normal completed batches preserve the old result shape.

Runtime checks reject non-finite or missing numeric stats, negative stats/HP/MP/AP, invalid multipliers, invalid explicit canonical IDs, invalid stack-limit input, nonpositive DEF, effective DEF that floors to zero, damage arithmetic overflow, invalid RNG values/bounds, and invalid operational limits/counts. No undocumented numeric clamps were added. Existing HP/drain bounds and normal damage rounding remain unchanged.

Intended gameplay-visible corrections are restricted to inclusive 0–10 initiative, effective-SPD ordering, explicit invalid-arithmetic failure and operational termination. Necessary compatibility-boundary differences are explicit unsupported results for newly represented Guard/Assist policy intentions, distinct reaction IDs/cause records, skipped/cancelled intention records, and rejection of incomplete batch results. Initial zero-HP combatants are represented as dead rather than executing with zero HP. No existing characterization snapshot or regression expectation was changed.

## Characterization and verification

Before extraction, RNG injection was added to the old engine without correcting initiative. Eleven deterministic snapshots were captured and tested: Single attack, random-choice fixture, AOE, KO skip, triggered Counter, non-triggered Counter, Counter-all targeting, debuff, consecutive AP, drain and explicitly supplied generic chain. All eleven remain byte-for-byte equal through the legacy result projection with their programmed draws. The intentional initiative changes have separate tests.

| Check | Result |
|---|---|
| All tests | **859 / 859 passed**; no failures, skips or cancellations |
| Existing baseline tests | **796 / 796**, unchanged expectations |
| Pre-refactor characterization | **11 / 11** |
| New core tests | **52 / 52** |
| Data self-checks | **57 / 57** |
| Battle-skill coverage check | Passed after the CRLF-only script correction |
| Workbook source `--check` | Passed; all raw bytes, labels, dictionary and provenance unchanged |
| App TypeScript | `npx tsc --noEmit -p tsconfig.app.json` passed |
| Node TypeScript | `npx tsc --noEmit -p tsconfig.node.json` passed |
| Production build | Passed; 1,838 modules transformed |
| Lint | **3 errors / 7 warnings**, improved from **7 / 7**; the four old engine `any` errors disappeared through typed extraction |
| Diff / whitespace | Checked before delivery, including new files |

The remaining lint errors are the existing empty interfaces in UI command/textarea and `require()` in Tailwind config. The seven existing component-export warnings remain. Build retains the Browserslist-data and large-chunk warnings. It used the filesystem access already required by esbuild in Phase 2K-B; no build or dependency configuration was changed.

Tests additionally verify seeded golden vectors, exact draw budgets/exhaustion, duplicate species IDs, input immutability, real SPD-debuff order, stale/dead-target exclusion, separate Counter causes, empty queues, normal/limit outcomes, numeric edge cases, canonical Interrupt/Assist kind preservation, no new status resolution, synthetic-source marking, Alias Fake rejection, and a supported simulation through the existing UI callback.

Commands:

```text
node --test tests/battleCharacterization.test.cjs tests/battleEngineCore.test.cjs tests/battleSkillData.test.cjs tests/runPlanner.test.cjs tests/runPlannerHardening.test.cjs tests/rankLearning.test.cjs tests/routeExport.test.cjs tests/theme.test.cjs
node scripts/checkBattleSkills.cjs
python scripts/importBattleSkills.py "C:\Users\rafae\Downloads\DW2 Modding Info.xlsx" --check
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.node.json
npm run build
npm run lint
git diff --check
```

The workbook check used the bundled Python executable because this shell has no bare `python` command. Ignored local logs use the `phase-2kc-` prefix.

## Performance

Same representative Single-player vs three-enemy AOE fixture, seed 42, public batch API, counts measured in order after module load:

| Simulations | Before extraction, ms | After extraction, ms |
|---:|---:|---:|
| 1 | 0.638 | 3.479 |
| 100 | 11.543 | 15.725 |
| 1,000 | 14.442 | 246.530 |

These are individual local wall-clock samples, not a controlled benchmark or identical draw trajectory: initiative changed, and JIT/GC/system load affect results. The detailed action/impact/state records introduce measurable overhead; the 1,000-run sample remains below a quarter second on this host. No premature optimization was applied. The facade retains aggregate winners/minima histories rather than all canonical histories across the batch; callers of the core can inspect each complete canonical run. Longer bounded battles retain more planned/recorded actions and use linear ID lookups, which should be profiled if future workloads need optimization.

Raw measurements: [performance-before.json](performance-before.json), [performance-after.json](performance-after.json). Reproduce the after measurement with `node scripts/benchmarkBattleCore.cjs`; the before sample was captured before replacing the engine and is retained as evidence.

No frame values were invented. No Hit/Miss, status, status recovery, authoritative Counter, Interrupt or Assist mechanics were newly approximated. All future gameplay layers remain deferred.
