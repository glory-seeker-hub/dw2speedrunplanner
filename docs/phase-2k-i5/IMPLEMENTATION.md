# Phase 2K-I5 — Exact Player Stat Overrides

Implemented on `phase-2k-i5-exact-stat-overrides`, based on committed I4 merge `f244488` / implementation `f461e86`. No commit or push.

## Audited import path and insertion point

The historical flow is unchanged:

1. `Index.handleAnalyze` calls `buildPlannerBattleAnalysisPreset` with the selected RunPlan and battle event.
2. `reconstructRunStateBeforeEvent` replays the state before that battle. The historical roster's `stats` contain the Planner's expected progression values.
3. `historicalPlayerTeam` preserves Digiline order and stable instance identity. `plannerDigimonToBattleTeamMember` calls `toSimulatorStats(member.stats)`, which floors the expected HP, MP, ATK, DEF and SPD values at the existing adapter boundary.
4. The detached preset holds those five values in each Player's existing `customStats`. Enemy values come through the authoritative encounter adapter. Historical Current HP/MP are unavailable, so omitted current values initially mean full resources.
5. `BattleSimulation` stores a deep copy of the preset in `imported`. This copy remains the read-only **Planner baseline**. Text drafts are keyed by `plannerDigimonInstanceId`. `resolvePlayerStatDrafts` derives a separate numeric Player team using the same `customStats` model and existing `currentHp`/`currentMp` fields.
6. Start uses that effective team in the ordinary `BattleInput`. The search controller deep-clones the request, sends the effective input to the Worker, and retains a separate small provenance snapshot for the job's terminal result.
7. The existing engine's `createMember` copies `customStats` into `baseStats`, `maxHp` and `maxMp`, then applies explicit Current resource values. All mechanics consume those values normally.

The insertion point is therefore the detached Simulator input boundary, after historical reconstruction and before Worker submission. No parallel combat-stat model or override-aware engine branch was added. No Planner growth or replay code changed.

Manual Team Builder already edits `TeamDigimon.customStats` using the shared `Input` component. I5 reuses that data shape and input primitive; it does not add Planner concepts to manual teams. Its older parse-and-clamp event handler is unsuitable for the explicit draft/no-clamp requirements, so the imported editor uses a focused strict parser. No manual Team Builder behavior was changed.

## Editor, identity and validation

Each imported Player displays a compact comparison table: **Stat / Planner baseline / Simulation value**. Editable fields are Max HP, Max MP, ATK, DEF, SPD, Current HP and Current MP. Baseline current resources say **Not tracked**. The explanatory note states that Planner stats use expected growth and that users can supply known in-game values for this simulation.

The table uses stable Planner instance IDs for drafts and row identity. Accessible input labels include slot, actor and stat, so Slot 2 Nanimon and Slot 3 Nanimon are independent. Changed fields show their baseline and draft values inline. A valid differing exact stat switches **Using Planner stats** to **Custom simulation stats**. No Enemy editor, Level/DP/species/technique editor, growth-range input or inference feature was added.

Text drafts allow intermediate invalid input to remain visible. Only decimal whole-number text that produces a JavaScript safe integer enters the detached numeric model. Empty, malformed, fractional, NaN/Infinity, negative and unsafe-integer inputs fail locally. HP, MP, ATK and Current resources may be zero; DEF and SPD must be positive, matching the existing positive-defense and acting-accuracy requirements. No arbitrary gameplay cap such as 999 was introduced. The existing engine validation remains authoritative; its rules and formulas were not changed.

Current resources remain independent:

- `0 <= currentHp <= maxHp`
- `0 <= currentMp <= maxMp`

Lowering Max below Current shows **Current HP cannot exceed Max HP** or the MP equivalent, without clamping. Start is disabled in both search methods until corrected, and the handler also guards against starting with invalid drafts. Errors appear beside the affected field with `aria-invalid` and linked descriptions. Editing and reset controls lock during an active search.

Current zero preserves strategic Player participation and technique use. The default full-resource representation remains compatible with the prior omitted-current contract. Increasing Max does not automatically fill Current; the original Current draft stays unchanged.

## Reset and session lifetime

**Reset stats to Planner values** restores only Max HP, Max MP, ATK, DEF and SPD for all imported slots. It preserves Current HP/MP, Search Method, Objective, Accuracy Mode, RNG Policy, Floor Specialty and budget. If restored maxima invalidate the retained Current values, validation remains visible; nothing is silently clamped.

**Reset imported team** restores the entire original detached Player/Enemy preset and original Current defaults, clears drafts/overrides, and retains ordinary Simulator configuration, as before.

`Index` already increments the analysis revision used as the Simulator's React key on every Analyze action. Reopening the same battle or analyzing another battle creates a new component and fresh baseline/drafts. **Use manual setup** clears analysis and remounts with the manual key. Overrides cannot leak between analyses or into manual teams. No storage or persistence layer was added.

## Mechanics and search integration

No damage, accuracy, initiative, stage, healing, resource, status, Counter, Interrupt, Assist or Shadow Scythe formula changed.

- ATK is the base value for existing outgoing damage.
- DEF is the base value for existing incoming damage.
- SPD affects initiative in both accuracy modes and standard Hit Rate in Game-accurate, including the existing multi-target mean-SPD calculation.
- Persistent ATK/DEF/SPD stages multiply the custom base values normally; custom values are not pre-adjusted.
- Max HP feeds the existing healing caps, full-HP effects, ratios and eligibility calculations.
- Max MP becomes the engine maximum; Current MP is checked against it. No new restoration or payment mechanic exists.

All combinations of Strategy/Game-accurate and Natural/TAS Favorable remain supported. Strategy still bypasses only standard Hit Rate, and stat editing adds no RNG draws. TAS Favorable keeps its reviewed status-only matrix. Objective selection does not alter stats or its ranking algorithm.

Both Random Monte Carlo and Optimized Action Search receive the same effective input representation. Optimized root evaluations, 4/16/64 refinement, deeper prefixes, representative boundary reconstruction, random tails and fastest-route replay use the original job input snapshot. Common random numbers, fair stages, fastest elite, exact 2,197-plan enumeration and search budgets are unchanged.

## Frozen Results provenance

`PlayerStatProvenance` in `battleStatOverrides.ts` records:

- source: Planner baseline or Custom simulation stats;
- slot, stable instance ID and actor name;
- only changed exact stats, each with Planner and simulation values;
- simulation-start Current/Max HP and MP for each Player.

The controller accepts this as local request metadata, deep-clones it with the effective input, removes it before Worker submission, and attaches it to COMPLETE or CANCELLED results. The Worker needs no override protocol and sees only ordinary effective combatant stats. This also preserves existing low-level search output fixtures when no provenance is supplied.

Results render **Player stat source**, changed values and a compact start-resource summary. Unchanged exact-stat rows are omitted. Slot and instance identity distinguish duplicate species. Fastest Potential displays this provenance before the route, so a custom-stat route cannot appear to have used baseline stats. Cancelled results use the same captured metadata. Editing or resetting the current UI later cannot rewrite an existing result's source.

Provenance is bounded by at most three imported Players and five changed stats per Player. Draft resolution happens at the input boundary; the search adds no per-rollout override processing.

## Characterization results

These are controlled fixtures using the real engine, not duplicated UI arithmetic or assertions about a production battle:

| Input change | Observed result |
| --- | --- |
| ATK 40 → 45 | Outgoing damage 40 → 45 |
| Same change against 41 current Enemy HP | Baseline requires 2 rounds / 2,055f; custom stats KO before the Enemy acts, 1 round / 685f, with a dead skip |
| DEF 40 → 80 | Incoming damage 10 → 5 |
| SPD 100 → 20 against SPD 40 | Player moves from before the Enemy to after it, including under Strategy |
| Same SPD change in Game-accurate | Hit threshold changes from 126/128 to 116/128 |
| Custom base stat 57 at stage +2 | Existing effective value 114 for ATK, DEF and SPD |
| Max HP 30, Current HP 1, fixed heal 50 | Healing caps at 30 HP, applying 29 healing |
| Max MP 5, Current MP 0 | Maximum is 5; existing strategic technique execution still works |

The optimized replay test records evaluated source prefixes, then replays the selected fastest source seed with the custom input and checks exact frames and intended Player trace. All baseline engine, healing, TAS double-E-Stun, reaction and optimizer regression tests remain included.

## Verification

Added **122 tests** for initialization, all fields, strict draft rejection, safe numeric state, duplicate Nanimon instances, resources, resets, setting independence, accessibility/locks, mechanics sensitivity, mode combinations, search/replay input consistency, frozen controller provenance, Results deltas, and Planner immutability. The existing Current HP navigation test now locates its input by stable field ID instead of the old number-input/max attribute; its behavior and reset expectations are unchanged.

| Check | Result |
| --- | --- |
| Full test suite | **2,304 / 2,304 passed** (2,182 baseline + 122 new) |
| Data self-checks | 57 / 57 |
| Battle-skill checks | 11 / 11 |
| Exhaustive effect coverage | 598 occurrences / 100 groups / 5 unused dictionary rows; unchanged |
| Workbook source check | Passed against original `C:\Users\rafae\Downloads\DW2 Modding Info.xlsx` |
| TypeScript | App and Node projects passed |
| Production build | Passed; existing chunk warning remains |
| Lint | Existing **3 errors / 7 warnings**, no new finding |
| Diff/new-file whitespace and conflict checks | Passed |

After the full run, the fastest-source replay assertion was strengthened to require the recorded source even if it is absent from the final top-candidate list; the integration suite passed again. No production code changed after full-suite/build validation.

UI smoke coverage used component handlers and rendered markup, including duplicate-slot editing, invalid Max/Current blocking, correction, reset and Results provenance. **No manual/browser smoke was run or claimed.** Existing navigation tests verify fresh Analyze remounts and switching to manual mode. All Planner tests run against unchanged schema **v7**.

## Performance

Run `node scripts/benchmarkExactStatOverrides.cjs`. Raw results: [performance.json](performance.json).

The fixture reconstructs a historical Planner battle. Its detached instance ID is fixed for repeatable search keys. Both runs use Optimized Action Search, Strategy, Natural, Fastest Potential, seed 42, budget 1,000, beam 2 and maximum depth 3. Measurement includes draft/provenance construction, the real controller snapshot path, Worker-host task yields, cloned response and final provenance attachment.

| Input | Root plans | Evaluations | Depth | Wall ms | Evaluations/s | Fastest f | Result bytes | Provenance bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Planner baseline | 2 | 400 | 3 | 599.9 | 667 | 21,920 | 174,188 | 165 |
| ATK 28 → 30; SPD 9 → 10 | 2 | 400 | 3 | 456.0 | 877 | 19,865 | 158,769 | 258 |

These are single descriptive Node v24.20.0 measurements, subject to warm-up/order effects. They are not browser end-to-end or statistically controlled overhead claims. Input/provenance work is bounded and outside the rollout loop; the measured run shows no substantial added orchestration cost. Different frames and result sizes are expected because the effective stats change battle execution.

## Files

Created:

- `src/utils/battle/battleStatOverrides.ts`
- `tests/helpers/statOverrideFixtures.cjs`
- `tests/exactStatOverrides.test.cjs`
- `tests/exactStatIntegration.test.cjs`
- `scripts/benchmarkExactStatOverrides.cjs`
- `docs/phase-2k-i5/IMPLEMENTATION.md`
- `docs/phase-2k-i5/performance.json`

Modified:

- `src/components/BattleSimulation.tsx`
- `src/components/BattleResults.tsx`
- `src/types/digimon.ts`
- `src/workers/battleSimulationController.ts`
- `tests/plannerBattleNavigation.test.cjs`

## Limits and final confirmations

The Simulator does not know historical growth rolls unless the user supplies the values. Planner baseline remains expected/reconstructed progression; custom stats are user-provided inputs, not verified facts.

Confirmed: no Planner growth/level/DP/technique recalculation, roster/checkpoint/history mutation, persistence, schema migration, stat-range sampling, automatic stat inference, Enemy stat editing or save-back action. The historical baseline and source RunPlan remain unchanged. Current HP/MP remain local. Schema stays v7.

Confirmed: no combat formula changed; Party Time and other deferred WAZADATA effects remain unresolved; TAS Favorable semantics and draw policy remain unchanged; Fastest Potential still chooses the fastest eligible observed route; Average Victory and Success Rate still use fair ranking; exact 2,197-plan enumeration, screening, common random numbers and elite retention remain unchanged; Interrupt Hit/Miss remain **761f / 270f**.

No commit or push.
