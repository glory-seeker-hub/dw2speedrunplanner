# Phase 2K-I4 — TAS Favorable RNG Policy

Implemented on `phase-2k-i4-tas-favorable-rng`, from committed I3 merge `94027cb` (implementation `79838af`), including the Fastest Potential correction. No commit or push.

## Policy and defaults

`BattleRngPolicy` lives in `src/utils/battle/battleRngPolicy.ts`: `natural | tas-favorable`. `BattleSimulationRules` accepts optional `rngPolicy`; its resolver validates and snapshots both settings. API omission and fresh Simulator UI both select **Natural**. Natural serialized result metadata continues using the backward-compatible omission convention; Results explicitly renders it as Natural. TAS results carry explicit `tas-favorable` provenance even when no override occurred.

Search Method, Accuracy Mode, RNG Policy and Optimization Objective remain independent. Both Random Monte Carlo and Optimized Action Search support Strategy/Game-accurate with either policy. Changing policy never changes accuracy or objective. Team import/reset retains session settings, including RNG Policy.

## Authoritative I4 matrix

| Existing probabilistic opportunity | Enemy affected | Player affected | Natural behavior |
| --- | --- | --- | --- |
| Direct Poison/Paralysis/Confusion application | Gate succeeds, subject to immunity | Gate fails | Existing 1/3 or 2/3 draw |
| Natural Paralysis recovery | Fails; status remains | Succeeds; status removed | Existing 1/4 recovery |
| Natural Confusion recovery | Fails; status remains | Succeeds; status removed | Existing 1/4 recovery |
| Paralysis action-failure gate | Action fails: Paralysis Miss | Passes to subsequent gates | Existing 1/2 failure |

Direct applications depend on **target side**, including unusual same-side targeting. No species, E-Stun, or fixture-specific branch exists in policy code. Existing classification and chance data determine eligible effects. Boss Confusion immunity, Motivation Down immunity and other authoritative restrictions remain. A successful probabilistic gate cannot bypass immunity; application audit still reports immunity separately.

The resolver does not consume and discard rolls. Overridden direct-status, recovery and Paralysis gates consume **zero draws**. Natural mode retains actual rolls and category order. Downstream Natural and TAS random sequences may differ intentionally because TAS skips supported draws.

Guaranteed Status Powers and activated reaction effects remain deterministic mechanics, not TAS overrides. Poison retains its existing +10 damage behavior and has no natural recovery. Reapplication follows existing state updates without stacking or invented duration. Paralyzed Enemies can continue missing across rounds until an explicit cure, KO, battle end or another existing rule changes the state.

Recovery occurs only at existing opportunities. Interrupt executors, interrupted restarts and chain contexts keep their existing recovery suppression. Player Paralysis/Confusion is not deleted early: recovery occurs at the normal step. If Player recovery is suppressed, Paralysis passes its later gate; existing Confusion restrictions remain. In particular, Interrupt Confusion behavior remains the established nonreplacement behavior. Enemy Confusion recovery fails, but its subsequent skill/target RNG remains Natural.

Explicit Enemy cure Assists remain functional and can end the Paralysis pattern. Random cure/revive target selection is untouched. TAS only overrides **natural** recovery.

## Accuracy, timing and unaffected mechanics

Strategy still bypasses only ordinary standard Hit Rate. Game-accurate still calculates and draws ordinary Hit Rate under TAS. The favorable policy does not implement any generic accuracy override. Players passing Paralysis continue through all other existing gates.

Normal Paralysis Miss remains **194f / 0 MP**; Interrupt Paralysis Miss remains **270f / 0 MP**. Interrupt Hit remains **761f**. Eventual Player MP payment follows the existing result. No damage, timing, cost, Counter activation/target, Interrupt opportunity or Assist policy was changed. Shadow Scythe retains its existing scheduling, recovery suppression and resource behavior.

The following remain Natural: initiative, Enemy decisions/targeting, random Player Interrupt targets, Confusion skill/target selection, Tail Blade evasion, Interrupt forced-Miss 2/3, action deletion 7/8, random cure/revive and other targeting, temporary Power recovery, Elemental Power, Poison Body, Invincibility and Invisibility recovery, and every category outside the matrix. Invisibility Miss, unactivated Counter Miss, forced Interrupt Miss, Assist target loss and skips remain authoritative. Party Time and other unresolved WAZADATA effects remain deferred; no descriptor was promoted.

## Audit, requirements and bounded memory

`RngResolution` records policy, category, affected side, chosen outcome, the natural probability of that gate outcome, and `rollSkipped: true`. It never invents a roll. Direct-status and recovery audits use `roll: null` for skipped rolls; Paralysis omits `paralysisRoll`. Immunity is separate from the probabilistic gate probability. Guaranteed effects receive no override audit.

Action history shows applied/not-applied status or recovered/remains with **TAS Favorable RNG**, and describes forced Enemy Paralysis failure or prevented Player failure. Natural history keeps its existing roll wording.

`battleRngAudit.ts` derives `TasRngRequirement` entries from the retained action audit. Each has round, action/actor/target identity and names, skill, status, initial-versus-execution phase, and the required outcome. Identical copies of one event deduplicate deterministically; different actions, rounds and restart gates remain distinct. Initial interrupted accuracy audit remains distinct from final execution audit.

The fastest route retains its existing exact intended Player trace, including random tail, separately from **TAS RNG requirements**. Requirements describe necessary outcomes, not game memory addresses, manipulation inputs or real game seeds. The displayed rollout seed is the existing simulator reproducibility identity.

Only the selected fastest route retains a requirement list, bounded by that battle's existing round/action limits. Per-rollout collection is transient. Aggregate diagnostics store five scalar counts: direct probabilistic status gates overridden, Enemy recoveries prevented, Player recoveries forced, Enemy Paralysis misses forced, and Player Paralysis failures prevented. Counts include completed valid rollout observations, not representative boundary replays. No all-rollout trace or override history is stored. Existing candidate/sample/beam bounds remain.

## Search, Worker and Results

The existing structured-clone-safe START `simulationRules` object now carries `rngPolicy` through its shared type; no parallel protocol field or Worker system was introduced. Search creation resolves a detached rules object synchronously before the first task yield. Tests mutate the original request after START and verify the running job remains TAS. Both search paths use the captured rules, and results use job provenance rather than current React state.

Optimized root screening, 4 → 16 → 64 refinement, deeper evaluation, representative reconstruction and random tails use the same policy. Common random numbers, budgets, exact 2,197-plan enumeration, bounded fastest elite, fair-stage checkpoints and pruning remain unchanged. Unsupported RNG is still sampled, so repeated rollouts remain useful.

Fastest Potential remains the fastest complete eligible Player-victory observation across the search. Trace/source/sample/seed ties are unchanged. Average Victory still ranks the lowest arithmetic mean fair candidate; Success Rate still ranks the highest-success fair candidate. Neither ranking algorithm changed. Under TAS their statistics are explicitly conditional on the policy, not natural expected time or real-world probability.

Results show policy for completed and cancelled jobs of both search methods. Fastest TAS output says **Fastest TAS route found under supported favorable RNG assumptions**, with intended orders and RNG requirements separately. The fair prefix remains secondary. Average/Success labels explain their policy dependence. A visible selection warning states that TAS assumptions do not represent normal real-time speedrun probability, and helper text explains that ordinary accuracy remains separate.

Cancellation retains only completed observations; a completed TAS fastest route is eligible even before a full fair stage. Screened ranking remains the last completed equal-stage checkpoint. There is no partial-action/rollout accumulation.

Planner-derived simulations remain read-only. Policy changes, completion and cancellation do not mutate RunPlan, historical events or imported presets. Local Current HP/MP behavior remains. Schema is **v7**. No ATK/DEF/SPD/Max HP/Max MP editor, growth rule, stored-stat override or persistence change was implemented.

Typical optional TAS configuration: Optimized Action Search / Fastest Potential / Strategy / TAS Favorable. Controls never force this combination.

## Characterization and verification

The representative fixture uses D-Tyrannomon Fire Blast → All and two Nanimon E-Stun orders targeting Birdramon and Candlemon separately. Both valid E-Stun hits apply Paralysis under TAS. Across four tested rounds, both Enemies fail recovery and miss each eligible action with zero direct-status/recovery/Paralysis draws. Natural draws produce both application success and failure. Optimized search enumerates and evaluates the plan without relying on rare supported-status outcomes. No claim is made that this plan must always be fastest.

Added 121 tests covering the policy matrix at both direct-status probabilities, all natural roll outcomes, actor sides, action kinds and accuracy modes; immunity; no fake/skipped draws; timing/MP; repeated status; explicit cure; KO; recovery suppression; guaranteed effects; preserved unsupported RNG; double E-Stun; exact Natural fixtures; deterministic candidate reversal/batching; frozen Worker rules; cancellation; UI selection and warning; conditional Results; intended tails/requirements; and Planner safety. Existing I3 and prior phase tests remain unchanged.

| Check | Final result |
| --- | --- |
| Full test suite | 2,182 / 2,182 passed (2,061 baseline + 121 new) |
| Data self-checks | 57 / 57 |
| Battle-skill checks | 11 / 11 |
| Exhaustive effect coverage | 598 occurrences / 100 groups / 5 unused dictionary rows; unchanged |
| Workbook source check | Passed at original `C:\Users\rafae\Downloads\DW2 Modding Info.xlsx` path |
| TypeScript | App and Node projects passed |
| Production build | Passed; existing chunk-size warning remains |
| Lint | Existing 3 errors / 7 warnings, no new finding |
| Diff and new-file whitespace/conflict checks | Passed |

Natural compatibility uses the existing Monte Carlo frozen fixtures and a new full optimized I3 output fixture captured before I4 edits, in both accuracy modes. All existing timing, resource, status, Counter, Interrupt, Assist, temporary-state, accuracy, Planner, historical import, optimized and cancellation tests ran. UI validation is component interaction and rendered markup testing; no browser visual validation is claimed.

## Performance

Reproduce with `node scripts/benchmarkTasRngPolicy.cjs`. Raw results: [performance.json](performance.json). Node v24.20.0; seed 42; Strategy; Fastest Potential; 1,000-rollout maximum; beam 2; maximum depth 3. These are single descriptive Worker-host measurements with real task yields and structured-cloned final results. They include warm-up/order effects and are not controlled speed comparisons or browser end-to-end measurements.

| Fixture | Policy | Root plans | Evaluations | Depth | Wall ms | Evaluations/s | Fastest f | Route overrides | Result bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Simple | Natural | 1 | 64 | 1 | 72.2 | 886 | 685 | 0 | 11,363 |
| Simple | TAS | 1 | 64 | 1 | 18.0 | 3,565 | 685 | 0 | 11,432 |
| Paralysis | Natural | 1 | 192 | 3 | 344.7 | 557 | 15,058 | 0 | 138,794 |
| Paralysis | TAS | 1 | 192 | 3 | 187.4 | 1,025 | 12,112 | 40 | 171,148 |
| Double E-Stun | Natural | 4 | 440 | 3 | 1,166.8 | 377 | 66,586 | 0 | 559,077 |
| Double E-Stun | TAS | 4 | 440 | 3 | 1,119.1 | 393 | 56,124 | 126 | 660,393 |

Paralysis TAS aggregate counts: 2,688 direct gates, 2,496 Enemy recoveries prevented, 2,496 Enemy misses forced. Double E-Stun TAS: 19,086 direct gates, 17,861 recoveries prevented, 17,861 misses forced. Player counts are zero in these fixtures. Natural has no overrides; absence of the optional count object means zero. Faster frames follow manipulated assumptions, not a discovered improvement in natural probability. No speed advantage is required.

## Files

Created:

- `src/utils/battle/battleRngPolicy.ts`
- `src/utils/battle/battleRngAudit.ts`
- `tests/helpers/tasFixtures.cjs`
- `tests/fixtures/tasNaturalOptimizedBaseline.json`
- `tests/tasRngPolicy.test.cjs`
- `tests/tasSearchIntegration.test.cjs`
- `scripts/benchmarkTasRngPolicy.cjs`
- `docs/phase-2k-i4/IMPLEMENTATION.md`
- `docs/phase-2k-i4/performance.json`

Modified:

- `src/utils/battle/battleSimulationRules.ts`
- `src/utils/battle/battleStatuses.ts`
- `src/utils/battle/battleAccuracy.ts`
- `src/utils/battle/battleSimulation.ts`
- `src/utils/battle/battleSimulationSearch.ts`
- `src/utils/battle/battleOptimizedSearch.ts`
- `src/utils/battle/battleCompatibility.ts`
- `src/utils/battle/battleFastestRoute.ts`
- `src/types/digimon.ts`
- `src/components/BattleSimulation.tsx`
- `src/components/BattleResults.tsx`
- `src/components/OptimizedSearchResults.tsx`

The existing Worker protocol imports the extended simulation rules type, so no separate protocol/host implementation change is needed.

## Limits and final confirmations

“TAS Favorable” in I4 does not mean every random event in Digimon World 2 is globally optimized. Only the supported matrix is resolved in the Player's favor. Initiative, targeting, reaction RNG and other unsupported categories remain Natural. Beam pruning, unresolved effects and path-based later-round search remain; this is not proof of the fastest possible battle. A future reviewed phase may expand the matrix.

Confirmed: Natural defaults and exact compatibility; independent Accuracy Mode; Strategy only bypasses standard Hit Rate; TAS never overrides ordinary Hit Rate; eligible Enemy E-Stun application succeeds after a valid Hit; Enemy Paralysis recovery fails and its action misses; Player ordinary Paralysis/Confusion recovery succeeds; immunity remains authoritative; explicit Enemy cures remain possible; no fabricated rolls; Interrupt 761f/270f unchanged; no unresolved effect promotion; Planner read-only and schema v7; no stat overrides; no commit or push.
