# Phase 2K-L4: Search Thoroughness

Final implementation on existing branch `phase-2k-l4-search-thoroughness`, based on committed L3 `f705977`. No commit or push. The architectural course correction supersedes the original restart-first proposal.

## Audit and reuse

[COURSE-CORRECTION-AUDIT.md](COURSE-CORRECTION-AUDIT.md) records the partial state before revised edits. The old implementation already had independent passes, accounting, fastest provenance, cancellation, Worker wiring, UI, reports and 38 new tests (3,012 passing total).

Reused: global budget accounting, exploration identity, bounded top candidates, exact observed fastest, Worker cancellation ownership, observational result snapshots, stale-result invalidation and committed-baseline fixtures. Adapted: pass orchestration, progress, reports and tests. Reworked: Single Pass / Use Full Budget labels and the assumption that extra computation primarily means repeated unchanged passes. `old-design-performance.json` is historical evidence only.

No battle formulas, skills, targeting legality, objective comparator, Random Monte Carlo algorithm, preset budgets, Planner storage/schema 7, Report version 1, navigation or How to Use content changed. L1a TAS, L2 Poison and L3 canonical corrections remain covered by the full suite.

## Final policy

| Mode | Preferred common sample checkpoints | Beam target | Depth | Restarts |
| --- | --- | --- | --- | --- |
| Standard (default) | 4 → 16 → 64 | Existing beam | Existing depth | None |
| Thorough | 8 → 32 → 128 | Up to 2 × existing beam | Unchanged | None |
| Maximum | 16 → 64 → 256 | Up to 4 × existing beam | Unchanged | Conditional fallback after enhanced pass |

Missing settings mean Standard. Six complete semantic hashes from committed L3 cover small and canonical 2,197-plan fixtures across all objectives. Only additive diagnostics are excluded. Standard retains old evaluations, results, samples, histories, common worlds, ranking, beam and depth.

Screening samples control statistical precision; beam controls retained strategies; depth is Player decision-prefix length; a restart selects another observed continuation and expansion order. Higher modes change the first two; evidence did not justify increasing depth.

The schedule steps down as a whole until initial common screening fits every legal root candidate. The unchanged minimum is root plans × 4. Beam growth is capped by `floor((budget - rootCount * initialSamples) / (finalSamples - initialSamples))`, never below the existing beam. This is an affordability estimate, not a promise that every later state reaches the last checkpoint. Each stage still reserves its complete fair batch. The existing protected-candidate rule can make observed peak beam one greater than configured width; both are reported.

Budget remains a global hard maximum. One evaluation keeps its existing meaning: a complete candidate fair sample; TAS internal branches are not separately counted. Incomplete screening cannot promote a partial candidate over a valid completed stage. Any complete winning execution observed can improve Fastest Route Found, including during subsequently cancelled work.

## Early completion and fallback

Deep is a budget ceiling. A finite beam can reach terminal outcomes or no remaining parents; configured depth can end exploration; remaining budget can be too small for a full decision-state stage. Raising budget alone does not expand a fixed schedule or beam. Repeating identical terminal roots consumes budget without another decision state.

Thorough finishes after its enhanced configured search. Maximum restarts only after an enhanced pass, when an observed continuation exists, the highest configured checkpoint completed, termination was not insufficient stage budget, and remaining budget covers at least the first pass's actual cost or root minimum, whichever is larger. No progress, insufficient remainder, exhausted useful frontier and cancellation stop it.

Each pass resets generator, frontier, samples, paths, seed cache and local accumulators. Global state retains immutable configuration, hard budget, counts, bounded winners and fastest provenance. Later passes use domain-separated exploration identities to select alternate observed continuations and reorder parents. Fair seeds still use the original master seed, depth, parent prefix and sample index. First-pass representative selection is unchanged. Identical inputs and seed remain deterministic; rerunning does not silently add entropy.

Cross-pass strategies are deduplicated by exact prefix, ranked only at the strongest completed common sample stage using the original comparator, and bounded to five candidates. Different strategies' statistics are never pooled into a selected mean or success rate. Aggregate observations are separate. Fastest provenance belongs to the concrete winning execution; a later worse pass cannot replace it. Result snapshots are observational; the Worker owns cancellation.

## Experimental evidence

`experiment-matrix.json`: 162 runs, three shapes (125-root terminal, 16-root branching, four-root stochastic), all objectives, seeds 42/137, nine variants, budget 12,000, Natural/game-accurate rules, round cap 12. Rows preserve inputs, per-stage retention/elimination, evaluations, beam, depth, termination, selected statistics, fastest, elapsed and throughput. `experiment-summary.json` summarizes them.

| Variant | Schedule / beam / depth | Mean evaluations | Mean eval/s | Better fastest than A / 18 |
| --- | --- | ---: | ---: | ---: |
| A: baseline | 4/16/64, 4, 4 | 1,139 | 4,582 | — |
| B: initial samples | 16/64, 4, 4 | 2,473 | 5,062 | 2 |
| C: beam only | 4/16/64, 8, 4 | 1,843 | 4,693 | 4 |
| D: samples + beam | 8/32/128, 8, 4 | 3,429 | 4,666 | 2 |
| D2: stronger | 16/64/256, 16, 4 | 9,973 | 4,389 | 3 |
| E: D + depth | 8/32/128, 8, 6 | 3,429 | 4,548 | 2 |
| E2: D2 + depth | 16/64/256, 16, 6 | 10,002 | 4,482 | 3 |
| F: repeated baseline | A + experimental restarts | 11,977 | 4,525 | 2 |
| G: repeated enhanced | D2 + experimental restarts | 11,392 | 4,638 | 3 |

No variant had worse fastest observations than A in these runs. These counts include observations while optimizing Average/Success; they do not prove selected-strategy superiority. C was more efficient for some fastest discoveries than D. Thorough balances retention with stronger screening across objectives; this bounded matrix does not establish universal optimality. F nearly consumed the budget for only two improvements, supporting removal of restart-first behavior. G permits experimental terminal-root repetition; shipping Maximum does not.

Initial screening and beam are meaningful, non-universal limitations. `pruning-characterization.json` contains a real-battle witness (seed 3): Standard with beam 1 discards the winner of an all-candidate 128-world comparison; Thorough with beam 2 retains it. The test compares candidates at the same 128 worlds. Reported selected means are 3,916.703125 at 64 samples versus 3,884.78125 at 128; those different sample sizes alone cannot establish quality. The witness demonstrates combined screening/retention benefit, not a population failure rate attributable solely to initial samples.

Depth was not a useful measured limiter: E matched D exactly in work and outcomes. E2 added 256 evaluations in two stochastic seed-137 Average/Success runs without changing fastest, selected mean or success. Reaching a depth boundary alone does not justify raising it. Depth stays unchanged.

Two seeds are bounded characterization, not a confidence study. Selected means/success and strategy keys remain in the rows. More worlds improve sample coverage but do not guarantee a better result. No confidence intervals or global-optimum claim were introduced.

## Stage accounting and utilization

Terminal125, seed 42, Fastest, budget 12,000, base beam/depth 4:

| Policy | Incremental stage evaluations | Retained after each stage | Total / unused | Utilization | Depth |
| --- | --- | --- | --- | ---: | ---: |
| Standard | 500 / 396 / 480 | 33 / 10 / 5 | 1,376 / 10,624 | 11.47% | 1 |
| Thorough | 1,000 / 792 / 960 | 33 / 10 / 9 | 2,752 / 9,248 | 22.93% | 1 |
| Maximum schedule | 2,000 / 1,584 / 3,264 | 33 / 17 / 17 | 6,848 / 5,152 | 57.07% | 1 |

All start with 125 root plans and end with frontier exhausted. Eliminations are 92/23/5, 92/23/1 and 92/16/0. Peak beams are 5/9/17. All observe 685 frames: extra precision/retention does not necessarily improve the result, and restarting these terminal roots is pointless.

Branching16, same seed/objective: A uses 1,248/12,000 (10.4%), D 4,864 (40.53%), D2 11,968 (99.73%). D2 finds 5,183 frames versus A's 5,674. Stochastic4 uses 864 (7.2%), 2,816 (23.47%) and 11,264 (93.87%); all observe 2,443 frames. Multi-depth stage counts are retained in the matrix.

`restart-experiment.json` measures shipping fallback separately at budget 40,000. Enhanced single passes use 19,200 evaluations; Maximum uses 39,456–39,792 over two passes. Seed-42 Average/Success improves the observed fastest from 5,674 to 5,183 while selected mean stays 7,070.9375. Seed 137 gains no fastest improvement. Restarts can help, but are neither guaranteed to improve results nor required in every Maximum search.

## Isolated performance

`performance.json` was regenerated without a concurrent test suite. Node production path, canonical one enemy, 125 root plans, Strategy/Natural, seed 42, budget 20,000, base beam/depth 4; warmup then four alternating measurement orders:

| Mode | Evaluations | Median elapsed | Median eval/s |
| --- | ---: | ---: | ---: |
| Raw Standard pass | 1,376 | 323 ms | 4,381 |
| Standard wrapper | 1,376 | 262 ms | 5,257 |
| Thorough | 2,752 | 534 ms | 5,182 |
| Maximum | 6,848 | 1,429 ms | 4,811 |

Thorough does twice the work at about 1.4% less throughput. Maximum does 4.98 times the work, takes about 5.46 times as long, with about 8.5% less throughput. The short benchmark is noisy (raw pass being slower than its wrapper illustrates this); it proves neither wrapper speedup nor a universal bound. No dramatic per-evaluation collapse appeared. Instrumentation updates at stage boundaries/progress snapshots. The hot loop adds constant-time fastest comparison, without result cloning or report serialization per evaluation; larger retained sets/samples increase allocation. Timing is evidence, not a brittle test assertion.

## UI, reports and browser smoke

Thoroughness is ephemeral, optimized-only, default Standard. Controls lock during execution, Cancel remains available, and mode changes invalidate stale results. Progress shows cumulative evaluations, screening target, beam/depth and mode. Pass details become prominent when a second pass actually starts. Search Details and Markdown/JSON include effort, budget usage, stop reason and fastest provenance. Report v1 optional fields remain compatible; Planner schema stays 7. Help text warns of longer runtime and explicitly disclaims a global optimum.

Browser smoke used real app navigation and the local `browser-smoke.html` fixture importing production React components and the real Worker without Planner-state changes. Budget 20,000, UI seed 0, base beam 16/depth 6: Standard completed 1,712 evaluations, Thorough 4,960, Maximum 17,600. Schedules were 4/16/64, 8/32/128 and 16/64/256; beams 16/32/64, peaks 17/33/65, observed depth 1. Maximum correctly avoided terminal-root restarts. Random hid the setting; running locked it; mode changes cleared old Search Details. Cancel produced a partial cancelled result (preceding progress was 105/20,000; final cancellation count was not recorded). At 390×844 buttons wrapped and results were readable; document width 380, no horizontal overflow. Browser restart and million-evaluation runs were not exercised; Node/Worker tests cover actual restart/cancellation paths.

## Verification

- Full Node suite: **3,025 passed**, zero failures/cancelled/skipped, 81.58 s; 51 new L4 tests. Focused revised suite: 118 passed.
- Both TypeScript projects passed. Revised production build passed in 15.11 s; existing large-chunk warning remains.
- Data checks 63/63; battle-skill checks 12 passed; effect coverage 598 occurrences, 101 groups, 370 authoritative occurrences, zero used deferred, five unused groups. Workbook `--check` passed.
- Lint retains three existing errors and seven warnings. Errors: `ui/command.tsx`, `ui/textarea.tsx`, `tailwind.config.ts`. Unrelated debt untouched.
- Git diff whitespace check passed. No commit/push; requested branch and HEAD `f705977` retained.

Changed search files: `battleOptimizedSearch.ts`, new `battleSearchPasses.ts`. UI: `BattleSimulation.tsx`, `SimulationSearchProgress.tsx`, `OptimizedSearchResults.tsx`, `Index.tsx`, `battlePresentation.ts`. Transport/reporting: Worker host/protocol and both simulation report modules. Tests: new thoroughness suite and two fixtures; additive-metadata exclusions in existing optimized/TAS tests. Four characterization scripts and this evidence directory document the decision.

Reproduce with `node --test tests/*.test.cjs`, both `npx tsc -p tsconfig.{app,node}.json --noEmit` commands separately, and `npm run build`. Run characterization scripts directly with Node. The matrix script resumes saved rows; archive its existing JSON before full regeneration. F/G retained measurements describe the superseded experimental restart control; the separate enhanced-restart script measures final fallback behavior. No downloaded dependency was needed.
