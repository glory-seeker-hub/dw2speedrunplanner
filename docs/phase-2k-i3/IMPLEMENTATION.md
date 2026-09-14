# Phase 2K-I3 — Optimized Player Action Search

Implemented on `phase-2k-i3-optimized-action-search` from committed I2 baseline `311bd0a`. No commit or push. Run Planner schema remains v7.

## Defaults and compatibility

`BattleSearchMethod` in `battleSearchObjectives.ts` distinguishes `random-monte-carlo` and `optimized-action-search`. Fresh manual and Planner-derived Simulator sessions select **Optimized Action Search / Strategy / Fastest Potential / Standard**. Standard means a maximum 100,000 rollout evaluations, beam width 16, and six optimized rounds.

Search Method and Accuracy Mode are independent. All four combinations are supported. Omitted worker search method still dispatches to the existing Monte Carlo runner. Low-level engine accuracy omission remains Game-accurate. Random Monte Carlo retains its existing continuous RNG, accumulator, count presets, progress, convergence, cancellation, and retained-history semantics. Frozen pre-edit I2 fixtures compare the entire seeded Strategy and Game-accurate Monte Carlo outputs, including search metadata, exactly.

The only existing UI test adapted to the new default explicitly selects Random Monte Carlo when testing that path's asynchronous invalid-data rejection. Optimized mode instead validates the root action space before Start. Existing combat expectations were not rewritten.

## Player decision enumeration

`battleActionPlans.ts` defines `PlayerOrder` and `PlayerRoundPlan`. Orders contain stable actor identity, actual skill-slot key and canonical skill identity, display names, optional explicit target intent, target label, and a canonical decision key. Round plans contain one order per actionable Player, in party-slot order. A prefix key preserves round order.

Keys sort object properties recursively and include actual resource/effect semantics and stable target identity. Duplicate aliases of the same decision deduplicate through a Map; distinct canonical skills or different AP/effect semantics remain distinct. Equivalent aliases choose a stable skill key. Target display names do not establish identity. Enumeration and keys do not use RNG, clock time, memory identity, or incidental object-property order.

The existing selection filter is extracted into `selectableSkills`, shared by random policy and enumeration. `selectableSingleOpponents` shares the existing Player Invisibility selection restriction with execution targeting. No new eligibility, MP-affordability, healing, or targeting rule is invented.

| Player choice | Enumeration |
| --- | --- |
| Ordinary Single offensive skill | One explicit, locked order for each currently selectable Enemy |
| AOE | One order; the engine resolves the target set |
| Counter | One order per eligible technique; causal target and activation stay in combat mechanics |
| Interrupt | One order per eligible technique; existing random Player Interrupt target policy stays in combat mechanics |
| Assist | One order per eligible technique; lowest-HP heal, matching-status cure RNG, and revive RNG remain engine policy |
| Self / random-Digimon descriptor | One policy-controlled choice; no invented target branches |
| Invisibility | Nonselectable Singles omitted; visible alternatives and established sole-target/AOE behavior retained |
| Player HP/MP zero | Existing strategic participation retained; no new resource rejection |
| Revived this round | No new selectable action opportunity |
| Already-ended battle / no legal complete plan | No optimized search; exact diagnostic rather than random fallback |

The team enumerator lazily forms the complete Cartesian product. Each actor with four Singles and one AOE has `4 × EnemyCount + 1` options. Three actors produce:

| Living selectable Enemies | Options per Player | Complete Player plans |
| ---: | ---: | ---: |
| 1 | 5 | 125 |
| 2 | 9 | 729 |
| 3 | 13 | **2,197** |

The exact fixture verifies uniqueness, slot order, input immutability, and all counts. Enemy skill and target possibilities do not multiply these counts; three Enemies do not turn 2,197 into 59,319 plans. Root counting multiplies option counts without generating the Cartesian product or running a battle. The worker generates plans incrementally, yielding between bounded work units.

## Scripted replay and unchanged mechanics

`BattleEngineOptions.playerDecisions` is a focused, optional planning provider with `beforeRound` and `chooseAction`. The engine invokes it at a round boundary and for Player intended orders only. It has no dependency on search ranking, React, or Worker transport. Enemy planning still uses the existing random action policy. Confusion's execution-time substitution also retains that policy; it does not ask the scripted provider for a replacement.

Each rollout starts from the same detached original BattleInput and a fresh deterministic rollout RNG. Covered rounds force the intended Player skill and explicit target. After the prefix ends, Player selection returns to the existing random policy. No mutated state is reused between sibling rollouts. Explicit Single targets are not opportunistically retargeted after selection; existing execution-time loss/skipping rules remain.

At each covered round boundary, replay validates the complete intended plan against the shared enumerator, including actual skill key and target intent. If that round exists and its intended order is illegal, the rollout is marked `scripted-plan-diverged`; no random substitute is used. If the battle already ended before a later planned round, the unused order is harmless. Divergence is a candidate outcome, not a worker failure or combat rule. Invalid battle input and unrelated unsupported engine failures still surface as errors.

Attack, Counter, Interrupt, Assist, support/temporary states, damage, resources, timing, and deferred WAZADATA effects retain their existing implementations. Interrupt Hit remains **761f**, Interrupt Miss **270f**. Strategy still skips only ordinary Hit Rate; Paralysis, Invisibility, Tail Blade, forced Interrupt Miss, unactivated Counter Miss, Assist target loss, and other authoritative gates remain. Game-accurate's formula and RNG remain compatible. No Enemy choice, initiative, status, recovery, Confusion, or reaction chance branch is exhaustively enumerated.

## Stochastic beam search and fair budgets

`battleOptimizedSearch.ts` owns orchestration. A node contains a Player order prefix and aggregate rollout statistics. At the root, every legal plan receives four rollouts. Sibling candidates use common starting seeds for each sample index. `rolloutSeed` mixes root seed, depth, canonical parent-prefix key, and sample index with deterministic integer operations. Candidate identity/iteration position is excluded. Seeds are cached per sibling group; different candidate actions may then consume different RNG categories/counts normally. The default optimized root seed is 0 when omitted; an explicit unsigned 32-bit seed can be supplied through START. Neither clock time nor UI render order supplies rollout seeds.

The cumulative stages are **4 → 16 → 64**, retaining the top 25% after screening stages, with at least the configured beam width where available. Candidates enter ranking only after an entire comparison stage completes. Finalists can refine to 16/64 when a larger survivor-stage cannot fit. They do not receive a single lucky rollout as their final score. The fixed 64-sample ceiling bounds sample metadata; remaining budget is used for deeper fair expansions, not unbounded samples or fake work.

| Quality | Maximum rollout budget | Beam width | Maximum optimized rounds |
| --- | ---: | ---: | ---: |
| Quick | 10,000 | 8 | 4 |
| Standard | 100,000 | 16 | 6 |
| Deep | 1,000,000 | 32 | 10 |
| Custom budget | User positive safe integer | Standard, except exact Quick/Deep budgets use those profiles | Same profile rule |

The suggested preset values and stages were retained. These are maximum optimized depths, not the engine's operational `maxRounds`. A budget below `rootPlans × 4` is rejected before execution. The canonical minimum is **8,788**. At deeper states, the search first counts all children and reserves enough budget for their complete four-sample stage. It skips an unaffordable parent or stops depth expansion; it never samples an arbitrary subset of a generated state's legal plans.

Only the selected beam's representative states expand. Finished winning paths remain eligible while other paths expand, and are not expanded themselves. Cached 4/16/64 statistics permit equal-sample comparisons with retained terminal paths. Ranking after cancellation uses the last complete fair checkpoint; incomplete stage samples may contribute to the separate best observed battle but cannot bias the recommended candidate ranking. If cancellation precedes the first full stage, Results explicitly has no ranked recommendation. Used budget counts every completed evaluation, including divergence. Reaching a terminal beam, maximum depth, or insufficient budget for another full expansion can finish below the maximum.

Candidate-order reversal and batch sizes 1, 7, 100, and 1,000 preserve semantic output. Best observed histories also use deterministic prefix-key/sample-index ties, so the accumulator's first arrival is not an accidental optimized tie-break. The Monte Carlo path retains its original first-arrival behavior.

## Objectives and representative states

`OptimizationObjective` has three values. Candidate statistics track evaluations, valid executions, victories, complete-timing victories, divergence, frame sum, minimum, mean, success rate, and divergence rate. Frame means use ordered integer sums divided by eligible counts, not means of batch means. Divergence counts against success and is excluded from victory-frame statistics. Unknown/incomplete timing never becomes zero frames.

| Objective | Fair-stage search guidance ranking, in order |
| --- | --- |
| Fastest Potential | Lowest eligible minimum frames; higher success rate; lower eligible mean; lower divergence; canonical prefix key |
| Average Victory | Lowest eligible arithmetic mean; higher success rate; lower minimum; lower divergence; canonical prefix key |
| Success Rate | Highest valid victories / all evaluated rollouts; lower eligible mean; lower minimum; lower divergence; canonical prefix key |

For frame objectives, a candidate with an eligible victory outranks one without one. If none are frame-eligible, Results says so and does not change the objective. Success Rate remains meaningful with incomplete timing. Fastest Potential intentionally values favorable remaining RNG and does not claim expected optimality.

Fastest Potential selects its fastest valid complete-timing representative. Average Victory and Success Rate select the successful complete-timing sample closest to the median successful frame count; sample index breaks distance ties. Without those samples, fallback prefers a valid victory, then lower remaining Enemy HP, then earliest sample. This fallback does not change the ranking objective.

Representatives store seed/frame/round metadata. Already-terminal representatives require no replay. Other selected seeds reconstruct only through the next Player decision boundary; these partial prefix reconstructions are not additional full statistical rollout evaluations and do not add observations. The original input is replayed, rather than resuming shared mutable battle state. Prior action queues/history are omitted from the retained next-round decision state.

**Later-round recommendations are a searched path, not an adaptive policy tree.** They assume the representative stochastic state. If the real battle differs materially, a later order can be illegal or unsuitable. Results displays this limitation. A future policy-tree/MCTS phase could address adaptive decisions; this phase does not implement it or claim global optimality.

## Memory, Worker, progress, and Results

Memory retains current candidate aggregates, at most 64 small successful-sample descriptors per candidate, three bounded fair-stage snapshots, a bounded beam/terminal set, and a few selected histories. It does not retain a BattleRunResult or full trajectory for every rollout. Only selected prefixes reconstruct representative states. Top Results contain at most five candidates. Root plan generation uses a Map/product traversal rather than quadratic deduplication. Diagnostics are deduplicated and sorted for deterministic optimized output.

START adds optional `searchMethod`, `optimizationObjective`, and `optimizedConfig`; `requestedSimulations` is the rollout budget for optimized requests. Existing accuracy rules, seed, input, and count remain structured-clone-safe. One existing worker host dispatches to either runner; there is no second worker system. The controller's detached request, stale-job protection, cancellation, retry, and unmount termination are unchanged. Rules, objective, and config are captured for the job. No functions cross postMessage.

The 50 ms / 1,000-step batching and real task yields remain. Optimized steps also yield during plan generation and representative processing. No full screening stage blocks cancellation. As before, a single unusually expensive battle can exceed the batch time budget; cancellation is observed at a safe boundary rather than interrupting combat halfway through an action.

Optimized progress carries phase (enumerating/screening/refining/expanding/finalizing), current/root candidate counts, candidates evaluated, depth/max depth, beam size, evaluations/budget, fair best statistics, elapsed time, and throughput. ETA is unavailable because pruning and early finish make a full-budget prediction misleading. Progress has no full plans, states, or action histories. Early completion does not pretend to use 100% of the budget.

The UI exposes Search Method, Accuracy Mode, objective, quality/budget, live root count, minimum budget, and a nonblocking large-space warning. Optimized-only controls disappear in Random mode. Active work locks configuration. Reset imported team restores the original local Player/Enemy preset while retaining current session search settings. Local HP/MP edits affect root state and rollouts; no Planner history is reconstructed or modified.

Results uses **Fastest route found** as the Fastest Potential primary output, with **Best screened prefix** as secondary statistical information. Average Victory uses **Best average strategy**; Success Rate uses **Highest-success strategy**. Exact intended orders, source candidate, sample index/seed, actual budget/depth, fair-stage metrics, and observed mechanical events are shown. Top candidates are explicitly fair-stage statistics, not a list of fastest individual rollouts. Existing full observed histories and deferred-effect diagnostics remain available.

All configuration, seeds, candidates, states, and results are runtime-only. No localStorage schema, RunPlan, event, checkpoint, or migration change was made. Planner-derived completion and cancellation are read-only, just like manual analysis.

## Verification

The final checks and measured performance are recorded below. Tests cover the exact 2,197 Cartesian product, each candidate receiving the same four initial seeds, target locking, automatic support targets, Enemy non-enumeration, scripted Confusion/reactions, divergence, objectives, median/ties, stage fairness, terminal retention, budgets, depth, candidate reversal, batch independence, worker cancellation, UI controls/provenance, and Planner immutability. All existing battle, Planner, Monte Carlo, and accuracy suites remain included.

## Files

Created:

- `src/utils/battle/battleActionPlans.ts`
- `src/utils/battle/battleSearchObjectives.ts`
- `src/utils/battle/battleOptimizedSearch.ts`
- `src/components/OptimizedSearchResults.tsx`
- `tests/helpers/optimizedFixtures.cjs`
- `tests/fixtures/optimizedMonteCarloBaseline.json`
- `tests/optimizedActionSearch.test.cjs`
- `tests/optimizedSearchIntegration.test.cjs`
- `scripts/benchmarkOptimizedSearch.cjs`
- `docs/phase-2k-i3/IMPLEMENTATION.md`
- `docs/phase-2k-i3/performance.json`

Modified:

- `src/utils/battle/battleActions.ts`
- `src/utils/battle/battleTargets.ts`
- `src/utils/battle/battleTypes.ts`
- `src/utils/battle/battleSimulation.ts`
- `src/utils/battle/battleSimulationSearch.ts`
- `src/workers/battleSimulationHost.ts`
- `src/workers/battleSimulationProtocol.ts`
- `src/types/digimon.ts`
- `src/components/BattleSimulation.tsx`
- `src/components/SimulationSearchProgress.tsx`
- `src/components/BattleResults.tsx`
- `tests/battleSkillData.test.cjs` (explicit Random selection for its existing Random-path test)

## Final verification results

| Check | Result |
| --- | --- |
| Full test suite | **2,061 / 2,061 passed**; 138 added tests beyond I2, including 25 objective-correction tests |
| Data self-checks | 57 / 57 |
| Battle-skill checks | 11 / 11 |
| Effect coverage | 598 occurrences / 100 groups / 5 unused dictionary rows; existing artifacts unchanged |
| Workbook source check | Passed against `C:\Users\rafae\Downloads\DW2 Modding Info.xlsx`; all 68 bytes, labels, dictionary and provenance |
| TypeScript | App and Node projects passed |
| Production build | Passed; existing large-chunk warning remains |
| Lint | Unchanged baseline: 3 errors / 7 warnings; no new finding |
| Diff and new-file whitespace/conflict checks | Passed |

UI validation uses component interaction tests and rendered Results/progress markup; no browser visual test is claimed. Lint errors remain in the existing command/textarea UI interfaces and tailwind.config.ts. No unrelated lint cleanup was performed. Single Hit remains 685f and ordinary Miss 194f; Interrupt Hit/Miss remain 761f/270f.

## Performance measurements

Run with `node --expose-gc scripts/benchmarkOptimizedSearch.cjs` on Node v24.20.0. These pre-objective-correction samples exercise the production Worker host in Node with real task yields and structured-cloned messages. They are descriptive single measurements, not browser end-to-end or statistically controlled speed claims. Raw data: [performance.json](performance.json).

All canonical benchmark configurations enumerate and evaluate **2,197 root plans**. The fixture uses low current Enemy HP so its best retained representatives finish in Round 1. Early completion therefore uses less than the configured maximum; no work is fabricated to fill the budget. Final candidate scores use 64 evaluations each.

| Quality | Accuracy | Budget | Used | Depth | Beam | Wall s | Evaluations/s | Fastest f | Mean victory f | Success | Result bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Quick | strategy | 10,000 | 9,268 | 1 | 8 | 3.285 | 2,821 | 990 | 990.00 | 100.0% | 25,732 |
| Standard | strategy | 100,000 | 22,012 | 1 | 16 | 6.933 | 3,175 | 990 | 990.00 | 100.0% | 25,746 |
| Deep | strategy | 1,000,000 | 22,012 | 1 | 32 | 7.692 | 2,862 | 990 | 990.00 | 100.0% | 25,751 |
| Standard | game-accurate | 100,000 | 22,012 | 1 | 16 | 7.113 | 3,095 | 990 | 993.03 | 100.0% | 25,890 |

Generating/canonicalizing the 2,197 root plans took **6.242 ms**; separately ranking 2,197 synthetic equal-score keys took **0.968 ms**. Enumeration/ranking is small relative to complete rollout execution in this fixture.

A longer two-Player / two-Enemy fixture (three skills per Player, Enemy current HP 500) starts with **25 plans**, reaches **4 optimized rounds**, evaluates **325 candidates / 3484 rollouts**, and retains beam 4. It took **1.346 s**; result size 71,540 bytes. The recommended path has fastest/mean 10221 / 10221.00f, success 100.0%, divergence 0.0%. This exercises deeper expansion separately from the terminal canonical root fixture.

Cancellation latency was **13.480 ms** from scheduling cancellation after meaningful progress to receipt of the partial result, with 605 completed evaluations. Its last fair-stage checkpoint was 0 evaluations; cancellation before full root screening returns no fair ranked prefix. After the objective correction, an eligible completed observation can still supply Fastest route found. This is a sample, not a hard real-time guarantee.

Maximum progress message size across canonical measurements was 827 bytes. Post-GC retained heap deltas ranged from 88,904 to 920,984 bytes; these noisy deltas are not peak-memory measurements. The structural bound is candidate aggregates plus fixed 4/16/64 snapshots, beam/terminal states, and selected histories, rather than one full result per rollout. The 1M-budget Deep search retains the same bounded per-candidate sample ceiling and stops at 22012 evaluations in the terminal fixture.

At a comparable 22,012-rollout budget, Random Monte Carlo and Optimized both observed **990f**. Both found the one-action AOE victory; this is a same-best architectural comparison, not a claim that optimization must beat Monte Carlo in every fixture. Random Monte Carlo took 1.175 s. Optimized also pays for explicit plan validation, repeated candidate evaluation, ranking, and path reconstruction; no unrelated battle optimization was introduced.

Every legal Player plan is evaluated at each completed expanded-state screening stage. Cancelled incomplete stages are explicitly unfinished. The complete stochastic multi-round battle tree is not exhaustive, Enemy decisions are never enumerated, and recommendations after Round 1 remain path-specific. Strategy still disables only ordinary Hit Rate; Game-accurate, deferred-effect diagnostics, and schema v7 remain compatible. **No commit or push.**


## Objective correction — final implementation

Fastest Potential primary output is the fastest complete valid route actually observed by the search. Average Victory primary output is the lowest-mean fair strategy candidate. Success Rate primary output is the highest-success fair strategy candidate. No global optimum or replay probability is claimed.

`battleFastestRoute.ts` retains one global eligible observation across every completed rollout, independent of pruning and fair checkpoints. Eligibility requires a nondivergent Player victory, complete measured timing, and non-null frames. Invalid, unsupported, losing, and incomplete outcomes cannot enter it. Ties compare total frames, canonical Player trace key, source prefix key, sample index, then seed. Selection is independent of candidate evaluation order and Worker batching. `primaryRecommendation` explicitly identifies the result kind; `fastestRoute` holds the observation. The existing `recommendedPrefix` and `recommendedStats` fields remain fair-stage data for compatibility, and are labeled accordingly in Results.

`battlePlayerDecisionTrace.ts` observes original Player planning and target selection directly. Each round contains actor identity/name, canonical skill identity/name, skill-slot key, and explicit target identity/label or All/Self/engine-policy intent. It records every random-tail round as well as the scripted prefix. The observer copies the intended order before Confusion can replace execution. Ordinary random-tail Single targets are captured at the existing target-selection point without drawing RNG or moving selection earlier. If an order is skipped or replaced before its original target is selected, the actual intention remains engine policy; no unmade target choice is invented. Replay uses the retained seed and source prefix to preserve that timing. Executed history stays separate.

Fastest-only elite retention uses at most **one additional slot** beyond the ordinary beam (and at most one extra successive-halving survivor). After every candidate finishes an equal 4/16/64 stage, the current global-fastest source is retained when present in that stage, unless already selected normally. No extra promotion occurs during an unfinished stage. The statistical ranking remains the normal beam; the extra slot affects search continuation only. Terminal paths remain bounded by the existing terminal retention policy. Average and Success do not use this rule; frozen pre-correction fixtures verify identical ranking, sampling allocation, and outputs for those objectives.

Cancellation can return any fully completed global-fastest observation, even before root screening finishes. Screened-prefix statistics still come exclusively from the last completed equal-stage checkpoint. With no completed fair stage, Results explicitly reports no fair screened-prefix ranking. Partial rollout execution is never included.

Only one global trace/history is retained, plus the existing bounded representative/accumulator histories. Other traces are transient per-rollout data and are discarded after evaluation. Candidate sample metadata still has a 64-sample ceiling and three fixed fair snapshots; no all-rollout trace collection is added. Progress carries no full traces or histories.

The UI shows intended orders by round, observed frames, seed/sample and expandable source key, alongside depth/budget context. It summarizes recorded Miss causes, Confusion replacements, applied statuses and natural recovery where present, and retains the favorable-RNG warning. Average highlights arithmetic mean; Success highlights victory rate; both also show minimum frames, divergence and rollout count.

The 25 new tests cover excluded outcomes, 13,900 versus 14,000 partial-stage selection, pruned source retention, random-tail capture and mechanics equivalence, Confusion intentions, canonical/source/sample/seed ties, cancellation, elite bounds/fairness, explicit UI concepts and frozen Average/Success behavior. Existing candidate-reversal, Worker batch-size, Monte Carlo frozen outputs, 2,197-plan enumeration, mechanics, timing and Planner/schema tests also passed.

Final correction verification: 2,061 tests passed; 57 data self-checks passed; 11 battle-skill checks passed; exhaustive effect coverage passed (598 occurrences / 100 groups / 5 unused dictionary rows); workbook source check passed at the original Downloads path; both TypeScript projects and production build passed. Lint remains 3 existing errors / 7 warnings, with no new finding. Diff/new-file whitespace checks passed. Benchmark timings above are explicitly historical measurements before the correction, not refreshed performance claims. No commit or push.
