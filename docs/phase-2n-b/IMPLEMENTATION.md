# Phase 2N-B — Player targeting and resolved order targets

## Starting state and scope

Starting main, origin/main, and working HEAD: `3a845701a9f5059235a5805adf0eb6755b1bd31c` (the merged Phase 2N-A work). The requested branch, `phase-2n-b-targeting-and-resolved-orders`, already existed at that commit; it was reused, not recreated. The initial worktree was clean. Main ancestry and remote state were checked before editing.

Measured baseline: 3,243 tests passed; production build passed; lint had 3 errors and 7 warnings; whitespace diff check passed. No baseline results were inferred from the previous phase.

No commit, push, PR, deployment, app version change, Planner schema change, Backup Format change, or Simulation Report version change. Report version remains 1. No canonical data, damage formula, accuracy formula, status RNG, Counter activation, Interrupt effects, MP payment, progression, search ranking, thoroughness, or TAS policy was redesigned.

## Target-control audit

| Area | Finding and implementation |
| --- | --- |
| Ordinary Attack | Optimized orders already enumerate legal single targets. Random mode retains its prior execution-time Attack targeting and RNG. Random-Digimon effects remain engine policy. |
| Enemy Interrupt | Already claimed the first qualifying action encountered by the execution queue, after initial accuracy. No correction to the first-eligible algorithm was needed. It skips Misses and protected/noninterruptible/invalid actions, allowing a later qualifying Hit. |
| Player Interrupt | Previously used random action reservations and could replace a failed reservation. Now planning stores one explicit enemy ID; only that enemy can supply an opportunity. |
| Player base-single Counter | Previously one policy order, with a target-choice RNG draw even for explicit intent. Now each legal enemy is a distinct original order; explicit targets resolve without that draw. |
| Activated Counter | Existing causal-attacker and all-on-counter overrides were correct and remain unchanged. They change effective recipients, never historical Player order identity. |
| Player Assist | Existing category-specific policies retained. Project evidence does not establish a general manual one-ally selection rule. Concrete executions now display their retained recipients. |
| Enemy Assist / Counter | AI selection policy unchanged. |

The audit covered `battleActionPlans`, `battleActions`, `battleInterrupts`, `battleTargets`, `battleSupport`, `battleSupportEffects`, `battleReactions`, `battlePlayerDecisionTrace`, `battleOptimizedSearch`, `battleSimulation`, `battleTypes`, `battleFastestRoute`, `battlePresentation`, `battleSimulationReport`, `battleSimulationReportSerialization`, `OptimizedSearchResults`, and `BattleResults`, plus the damage resolver and canonical descriptors.

## Interrupt execution

`initialAccuracy.outcome === 'hit'` remains mandatory. **Misses cannot be interrupted.** No changes were made to accuracy calculation or restart accuracy. Current queue-time state determines whether an action is still interruptible: activated/shared-promoted Counters, Interrupts, Shadow Scythe, canonical protection, cancelled/skipped/consumed actions, KO actors, and actors revived this round are excluded. Waiting executors must also remain valid and able to pay required MP.

Player Interrupt orders enumerate selectable living enemies without inspecting their future techniques, accuracy, or Counter activation. An enemy that later uses a protected technique was still a valid planning choice. The explicit target participates in the canonical order key and flows through search enumeration, prefixes, replay, trace, fastest-route retention, and report JSON.

The random reservation scheduler was removed. At the selected enemy's valid Hit opportunity, `claimInterrupt` matches only waiting Player users whose original target ID equals that actor ID. The existing executor-choice RNG remains when multiple matching users compete for one opportunity. No `interrupt-target-choice` draw remains. The resolution records `player-selected`; the old `player-random` type value remains readable for compatibility with old records.

The queue prepends `[interrupt action, selected enemy action]`. Thus the Interrupt executes immediately before that opportunity, independent of its own SPD. Existing cancellation, force-Miss, damage reduction, send-last, and restart behavior remains authoritative after the reaction. A selected Miss, protected action, activated Counter, KO, cancellation, or missing opportunity never retargets to another enemy. The unused action retains `interrupt-no-eligible-target` / `skipped-no-opportunity`.

Enemy Interrupts retain first-eligible queue behavior and consume no target-selection RNG. Existing tests exercise initiative order, an earlier Miss, several executors, protection, Shadow Scythe, waiting/activated Counters, and restart semantics. New tests cover Player fixed selection and invalid opportunities.

## Player Counter intent and Random simulation

`battlePlayerTargets.ts` supplies shared planning choices to enumeration and the Random policy, without importing the simulator/search and without creating an action-plan dependency cycle. Base one-enemy Counters and Interrupts respect current visibility and living-opponent selection rules. An entirely unavailable reaction target set produces no legal reaction order. Invalid explicit IDs, own-side IDs, empty sets, and multiple selected IDs are rejected.

Random mode expands the newly controlled reaction choices into complete legal skill/target orders, then samples using `action-choice`. It does not sample a Counter/Interrupt target during execution. Ordinary Attack and policy Assist choices retain their established behavior; their frozen regression fixtures were not regenerated. Enemy policy remains separate. For older injected test/custom policies that omit a reaction target, planning assigns the first legal target deterministically, so the action still has a stable original intention. Production Random and optimized policies supply their chosen targets explicitly.

An untriggered Counter keeps its original target at the existing end-of-turn position. If that target becomes invalid, the ordinary explicit-lock rule yields no targets and a skipped action; it does not choose another enemy. Activated single Counters use the causal attacker; all-on-counter skills use all living opponents. Shared-trigger promotion and activation conditions were not changed.

The Player trace clones planning intent. Explicit intentions are not overwritten by selected/effective targets. Reaction targets remain in execution records. The existing fastest-route tracker and report builder already retain the necessary trace plus actions and required no schema extension.

## Assist evidence and remaining uncertainty

The reviewed project evidence is the canonical WAZADATA/effect descriptors, `battleSupportEffects.ts`, and the prior Phase 2K-H/K implementation records. Canonical target groups establish eligibility/scope; they do not by themselves establish whether a player manually chooses a recipient.

| Category | Retained mechanic | Concrete display |
| --- | --- | --- |
| Single healing | Lowest positive absolute HP; party-position tie-break. Player healing remains allowed at full HP. | Actual locked recipient |
| Revive | Eligible zero-HP ally; multiple eligible recipients use existing revive-target RNG. | Actual revived/attempted recipient |
| Status cure | Eligible living ally with a required status; existing cure-target RNG when multiple qualify. | Actual locked recipient |
| One-ally buffs/effects | Existing eligible living-ally candidate policy and target RNG. | Actual recipient |
| Self | Canonical self target. | Actor name and Player slot |
| All-allies / field / all-enemies | Existing current recipient set at execution. | Actual recipient list |
| Necro Magic, 0xD2 | Separate KO target with positive MP, either side, existing `necro-ko-target` policy. | Actual retained KO recipient |

No Assist was newly claimed to be manually targeted. The lowest-HP tie-break and other existing simulator policies remain policies, not new ROM assertions. Stronger owner/game evidence would be needed before expanding manual one-ally orders. No Enemy Assist AI was changed for presentation.

## Concrete versus screened presentation

The pure `resolvedOrderTarget` helper matches the actor and round to a resolved, non-chain action. A battle has one original order per actor per round; Confusion may replace its execution skill, so matching by executed skill would lose that evidence. The action's `effectiveTargetIds` supply the concrete label, including random-target Attacks, Interrupt recipients, Counter causal/AoE overrides, and Assist recipients. Stable side/slot labels disambiguate repeated species.

Fastest Route cards, retained TAS Random route orders, and concrete Markdown report orders use this helper. Unexecuted orders retain their known intended target and show “Planned — not executed in retained execution.” Other rounds and chain executions cannot fabricate a resolved target for them.

Average Victory, Success Rate, Best Screened Strategy, and Top Screened Strategies continue to use `intendedTarget`. They show explicit reaction decisions, but retain Engine policy / Random target where appropriate. No arbitrary rollout recipient is promoted to a strategy-wide claim. JSON continues to preserve original intent separately from effective execution targets. No redundant target schema was added.

## Canonical Counter audit and exact arithmetic

Workbook validation confirms all source bytes, labels, effect dictionary, and provenance.

| Skill | ID / WAZADATA row | Byte 33 / 0x04 | Byte 18 / 0x20 | Result |
| --- | --- | --- | --- | --- |
| Meteor Stream | 0x83 / row 236 | Set | Clear | Base single, activated AoE; no 1.5x bonus |
| Energetic Bomb | 0x87 / row 244 | Set | Clear | Base single, activated AoE; no 1.5x bonus |
| Smiley Warhead | 0x88 / row 246 | Set | Set | Base single, activated AoE; activated 1.5x output bonus |
| Smiley Bomb control | 0x86 / row 242 | Clear | Set | Remains single; activated 1.5x output bonus |

Skill Effects row 91 describes hitting all targets on Counter. Row 15 describes **1.5x Damage output when Countering**. Accordingly, the existing output-based interpretation is preserved. There is no stronger reviewed evidence for AP-level multiplication. Deprecated byte-21 metadata does not imply additional damage.

Exact neutral-multiplier test fixture: ATK 23; recipient DEF values 19, 27, and 31; no poison, defensive state, or Interrupt reduction. Each recipient is calculated independently.

| Skill | AP | Base damage for DEF 19 / 27 / 31 | Activated damage |
| --- | ---: | --- | --- |
| Meteor Stream | 20 | 24 / 17 / 14 | 24 / 17 / 14 |
| Energetic Bomb | 30 | 36 / 25 / 22 | 36 / 25 / 22 |
| Smiley Warhead | 40 | 48 / 34 / 29 | 72 / 51 / 43 |
| Smiley Bomb | 32.5 | 38 / 27 / 23 | 57 / 40 / 34 for the causal recipient |

For Smiley Warhead against DEF 31, base `floor(40 * 23 / 31) = 29`, followed by `floor(29 * 1.5) = 43`. Multiplying AP first would instead yield 44. Tests assert 43, proving the output stage and preventing AP substitution or a double multiplier. Integrated battle tests verify actual recipient IDs, base damage, final damage, HP loss, untriggered single form, activated AoE form, and unchanged original intent. No damage implementation change was necessary.

## Search-space and regression evidence

One eligible Interrupt or base-single Counter against 1/2/3 selectable enemies now yields 1/2/3 distinct target orders, formerly one policy order. Minimum root budget remains the computed plan count times four. Three players, each with one Interrupt and one base-single Counter against three enemies, produce **216** plans (`6^3`), formerly eight policy combinations. The ordinary canonical Attack fixture remains **2,197** plans. Counts are computed, not hardcoded in production.

`phase2nbTargeting.test.cjs` contains 93 tests, including target identity/counts, planning without future knowledge, visibility/KO restrictions, direct queue claims, initial Miss/no-retarget behavior, Enemy queue behavior, complete Random reaction choices, seed-independent replay intentions, exact damage, invalid explicit selections, integrated Counter impacts, Assist categories, unexecuted display, and optimized fastest-route retention.

The first focused group passed 355 tests. The final focused Counter/target group passed 218 tests. Full final suite: **3,325 / 3,325 passed**, zero failed/skipped/cancelled. Existing tests that described random reservations were rewritten for explicit selection; eleven old one-policy-order assertions were replaced by the new per-target matrix. The old chain/Counter test now correctly expects a skipped untriggered Counter after its original target was KO'd. Unrelated golden fixtures were not changed.

| Check | Final result |
| --- | --- |
| `node --test tests/*.test.cjs` | 3,325 pass; 97.943 seconds |
| App TypeScript | Pass |
| Node TypeScript | Pass |
| Production build | Pass; existing large-chunk advisory |
| Lint | 3 errors, 7 warnings — identical to baseline |
| Data self-checks | 63/63 |
| Battle skill checks | 12/12 |
| Effect coverage | 598 occurrences, 101 groups; 5 unused dictionary rows |
| Workbook provenance | Pass, all 68 bytes plus labels/dictionary/provenance |
| `git diff --check` | Pass |

Lint debt remains in unchanged UI/config files; it was not cleaned as part of this phase.

## Real browser verification

`browser-smoke.html` loads the production optimized-search engine and `OptimizedSearchResults` component, using the committed `browser-fixtures.json`. The button runs four actual searches in the browser (128 rollout budget, Strategy accuracy, seed 42); it does not display invented result records. This fixture is local development evidence and is not linked into the app's product flow.

Desktop results:

- Explicit Interrupt: 2,207 frames, two rounds; Wing Blade targets Centarumon · Enemy 1, then Gabumon · Enemy 2.
- Untriggered Counter: 3,425 frames, two rounds; Smiley Warhead shows each original single target.
- Activated Counter: 1,558 frames; Smiley Warhead displays Centarumon · Enemy 1 and Gabumon · Enemy 2 together.
- Assist and Attack: 2,055 frames; Small HP Cure → Agumon · Player 2; Rock Fist → Gabumon · Enemy 1.
- The expanded screened Assist comparison shows Small HP Cure → Engine policy, while the concrete route above names Agumon.

Desktop viewport was 1101×828 with document client/scroll width both 1091. Mobile viewport was exactly 390×844; document client/scroll width both 380, and all nine rendered target cards had client/scroll width both 314. The activated multi-recipient label visibly wraps. No horizontal overflow, runtime errors, console warnings, or React key warnings were observed. The viewport override was reset afterward. Evidence: `desktop.jpg`, `mobile-390x844.jpg`.

The existing development server on port 5199 was reused after a duplicate-start attempt reported the port occupied. Browser searches were rerun after HMR changes. No server was deployed or exposed publicly.

## Exact changed files

Production:

- `src/components/BattleResults.tsx`
- `src/components/OptimizedSearchResults.tsx`
- `src/utils/battle/battleActionPlans.ts`
- `src/utils/battle/battleActions.ts`
- `src/utils/battle/battleInterrupts.ts`
- `src/utils/battle/battlePlayerDecisionTrace.ts`
- `src/utils/battle/battlePlayerTargets.ts` (new)
- `src/utils/battle/battlePresentation.ts`
- `src/utils/battle/battleSimulation.ts`
- `src/utils/battle/battleSimulationReportSerialization.ts`
- `src/utils/battle/battleTargets.ts`
- `src/utils/battle/battleTypes.ts`

Tests:

- `tests/battleCounters.test.cjs`
- `tests/battleEngineCore.test.cjs`
- `tests/battleInterrupts.test.cjs`
- `tests/optimizedActionSearch.test.cjs`
- `tests/phaseKBattleIntegration.test.cjs`
- `tests/simulationReport.test.cjs`
- `tests/phase2nbTargeting.test.cjs` (new)

Evidence:

- `docs/phase-2n-b/IMPLEMENTATION.md`
- `docs/phase-2n-b/verification.json`
- `docs/phase-2n-b/browser-fixtures.json`
- `docs/phase-2n-b/browser-smoke.html`
- `docs/phase-2n-b/desktop.jpg`
- `docs/phase-2n-b/mobile-390x844.jpg`

Remaining uncertainty is limited to the existing Assist control/policy evidence and pre-existing unresolved data semantics. No new mechanic was guessed to close those gaps. The final worktree contains the uncommitted implementation and evidence on the requested branch.
