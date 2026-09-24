# Phase 2K-L1a — narrow TAS Luck to Enemy Confusion + Paralysis

Implemented on `phase-2k-l1a-confusion-paralysis-tas`. The branch was already active and clean at `ebbeaa4`, the committed merge of Phase 2J-A (`2b3f277`). No commit or push was made. Planner v7 and Simulation Report v1 remain unchanged.

## Audit and root cause (final-report items 3–6)

L1 sent every supported probabilistic application, recovery and Paralysis failure through `TasLuckControl.choose`. An unassigned opportunity threw `TasLuckBranch`, restarted the engine from the same sample seed and explored a bounded prefix frontier. Consequently even repeated Paralysis without any Confusion generated hundreds of full-prefix replays per fair sample. The user's reported browser slowdown (Natural approximately 450–520 evaluations/s, TAS potentially minutes per rollout) was the motivating observation, not a measurement made by this implementation.

The before-change characterization is preserved in `performance-before.json`: three double-E-Stun samples required 2,148 internal executions, 1,188 opportunities and 231 prunes, at approximately 0.424 fair samples/s. Repeated Paralysis required 1,787 internal executions across three samples. The old `docs/phase-2k-l1` artifacts are untouched.

Audited `battleTasLuck`, replay, RNG policy/stream, statuses, accuracy, simulation execution, both search methods, objectives, fastest-route tracking, requirement collection, reports and Worker scheduling. Natural uses the same RNG category sequence and draw boundaries. Confusion finalization and target selection already precede the accuracy gate; L1a preserves that order and the shared seed/prefix. No extra technique/target outcome is searched. Interrupt execution suppresses recovery and Confusion replacement, so its Paralysis check remains direct. Its 270f miss / 761f hit semantics remain unchanged. Normal Paralysis failure remains 194f / zero MP.

Generalized branching required eagerly initializing a frontier and checkpoint/deduplication work even for ordinary gates. L1a initializes the frontier and seen-state map only after the first real conflict exception. A no-conflict sample executes once and returns directly. It retains a lightweight replay controller to discover an actual conflict dynamically; it does not scan skill lists or infer conflict from setup.

## Before/after gate matrix and authoritative policy (items 4–20)

| Gate | L1 | Legacy TAS Favorable and L1a direct outcome | L1a search |
| --- | --- | --- | --- |
| Poison application | apply/prevent | Enemy apply, Player prevent | None |
| Paralysis application | apply/prevent | Enemy apply, Player prevent | None |
| Confusion application | apply/prevent | Enemy apply, Player prevent | None |
| Genuinely probabilistic Motivation application | apply/prevent | Enemy apply if legal, Player prevent; immunity wins | None |
| Paralysis recovery | recover/remain | Enemy remain, Player recover | None |
| Confusion recovery | recover/remain | Enemy remain, Player recover | None |
| Motivation recovery | recover/remain | Enemy remain, Player recover | None |
| Player Paralysis action, with or without Confusion | miss/pass | Pass | None |
| Enemy Paralysis without executing Confusion | miss/pass | Miss | None |
| Enemy with both statuses at its eligible action gate | miss/pass | Legacy: Miss | Exactly Miss versus Pass |

TAS Luck means favorable supported status outcomes, except that an Enemy's actual Confusion + Paralysis action gate compares complete downstream routes. `resolveActionAccuracy` supplies the current active Confusion state, excluding Interrupt and action-specific Confusion suppression; `resolveParalysisFailure` additionally requires Enemy side. The gate is reachable only while Paralysis is active. Dead, cured, skipped/ineligible and absent-status cases produce no conflict. Player recovery is still forced when recovery is allowed; an Enemy retains both statuses unless another existing mechanic cures them. No synthetic status removal occurs.

Miss blocks the action under existing timing/MP rules. Pass executes the already-prepared Confusion behavior, preserving replacement skill, ally target, both statuses, attack accuracy and subsequent engine handling. Unsupported RNG—including Confusion choices, initiative, targets, accuracy, Interrupt effects and unsupported recovery—remains governed by existing Natural/current engine behavior. The TAS choice itself consumes no Natural draw. Guaranteed Concert Crush still has no application RNG; Enemy Motivation immunity still suppresses illegal requirements. Poison has no natural recovery. Recovery suppression generates neither recovery requirements nor branches.

`tas-favorable` remains the frozen old internal/regression policy (including always blocking Enemy Paralysis); it is not offered in fresh UI. Fresh controls remain Natural and TAS Luck.

## Search, fairness, replay and requirements (items 21–34, 49–50)

Both Monte Carlo and Optimized Search continue to call the same per-sample TAS wrapper. That wrapper now discovers only conflicts and otherwise completes in one execution. It compares completed non-divergent Player wins, then frames, then stable TAS/Player trace keys. A one-sample collapse therefore gives Fastest a fastest eligible path, Average one successful frame observation, and Success one success/failure observation. The outer objective ranking is untouched. A no-conflict sample has zero opportunities, zero explored branches, zero prunes and zero max frontier. One conflict has one opportunity and two explored alternatives; the initial discovery execution is not counted as a branch. For repeated conflicts, opportunities count encountered expansion nodes across alternative prefixes, not unique chronological turns.

Typed opportunity identity, strict deterministic replay, divergence detection, same unsupported seed, source Player prefix, intended Player trace, deterministic tie-breaking, bounded retained histories and exact-checkpoint deduplication remain. Direct favorable outcomes are regenerated deterministically and recorded in action history as `RngResolution` requirements. Only conflict decisions occupy `tasLuckTrace`. Fastest-route collection now collects all action requirements and retains the exact opportunity key carried by each conflict resolution. Pass is worded “Paralysis action must proceed so Confusion can execute.” Thus ordinary applications/recoveries/misses remain visible and exported despite requiring no search.

Replay rejects wrong/unused conflict identities rather than consuming a decision at an ordinary Paralysis gate. Old generalized L1 traces are not silently reinterpreted as L1a traces; historical exported reports remain static artifacts. Version 1 is retained because existing fields remain compatible; conflict resolutions gain an optional opportunityKey to distinguish repeated/restarted gates without guessing from action IDs. This is an additive audit field and semantic correction, not a new Planner storage shape.

Caps remain Quick 8 / Standard 16 / Deep 32 and work thresholds 2,048 / 4,096 / 8,192. Pruning applies to repeated conflicts and is not proof of optimality. The existing terminal-first bounded traversal and exact-state checks are retained. No arbitrary constant tuning was needed. Worker yields remain between conflict replays. Incomplete fair samples do not count on cancellation. Without conflicts there are no nested replays to delay normal progress; rollout evaluations, candidates, depth, beam and speed remain fair-work counters.

Player-plan enumeration, root counts (including 2,197), 4 → 16 → 64 screening, beam pruning, fastest elite, global fastest route, common seeds and scripted-prefix divergence remain unchanged. Internal TAS paths never become Top Candidates. Natural seeded Strategy and Game-accurate snapshots remain exact.

## Results and export (items 53–58)

The setup helper now describes favorable status outcomes and only the two Enemy conflict paths, while retaining unsupported-Natural and separate Accuracy Mode wording. Results display a short no-conflict sentence when opportunities are zero. Otherwise they show Confusion + Paralysis opportunities, explored/pruned branches and frontier size. Report diagnostics and Markdown describe the narrowed semantics. JSON retains policy, summary, selected conflict trace and complete requirements. Tests verify JSON round-trip and frozen result semantics after settings are edited. Report v1 retains the existing generic summary field names for compatibility; they now describe conflict work only.

## Tests and regressions (items 28–29, 59–74)

22 new tests in `tasLuckNarrow.test.cjs`, plus adapted L1 tests, exercise direct policy, both sides, real Miss-best and Confusion-best routes, exactly two alternatives, no synthetic removal, no-conflict execution count, 64 repeated no-conflict samples, death before acting, explicit cure, Player recovery, Poison non-recovery, Interrupt suppression, all three objectives, Monte Carlo, Optimized, fair 64-sample denominators, Worker progress, partial cancellation, trace identity and report requirements. The adapted L1 matrix no longer expects illegal ordinary branches; the obsolete fixture favoring failed Confusion application was removed because application is now authoritative/direct. This changes 67 old L1 tests to 58; the new 22 yield a net increase of 13, not 22, in the full suite.

Real-engine Miss-best fixture: low-ATK Enemy with both statuses, 25 HP; selected Miss produces a 1,564f complete victory. Confusion-best fixture: Enemy self-KO through normal Confusion execution; selected Pass produces a 1,370f victory. Both statuses stay active at the gate. Reversed conflict enumeration, reversed Player candidate enumeration and different Worker batches retain the same selected results. Wrong identity, unused conflict and removed Confusion replay diverge. All three objectives count 64 conflicting samples as 64 observations, despite exploring 128 alternatives.

The full suite includes Poison, Paralysis, genuine Confusion, Motivation Down, Concert Crush, Counter, Interrupt, Assist, Party Time, half DEF and fractional SPD growth, L0, old Natural snapshots, Planner/history/multiple runs and 2J-A pending-XP tests. No story, domain, Coliseum, Planner or progression source was changed. The existing five sections, 33 normal Domain variants and 24 Coliseum encounters still pass, including zero XP/Bits, no capture, no level-up, preserved accumulated XP and historical Analyze Battle.

## Performance (items 35–48)

See `performance.json` for all six fixtures, Natural/legacy favorable/TAS throughput, opportunity/branch/prune/frontier counters, result bytes and ratios. `performance-before.json` records the same fixtures before editing. Engine measurements use seeded Strategy simulations, one warmup and 30 final samples (three before). One-conflict is limited to one round; repeated conflicts to five; double E-Stun to sixty. Short runs are noisy and are characterization, not machine-specific unit-test thresholds. The Natural code path is unchanged; these small pre/post runs do not establish a precise Natural speed change.

| Fixture | Natural samples/s | TAS samples/s | Conflicts | Branches | Pruned | Max frontier | TAS result bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| no-status | 3138.5 | 4707.1 | 0 | 0 | 0 | 0 | 5745 |
| repeated-paralysis | 759.2 | 1482.8 | 0 | 0 | 0 | 0 | 31992 |
| confusion-only | 2333.1 | 2765.7 | 0 | 0 | 0 | 0 | 7581 |
| one-conflict | 7461.8 | 1421.9 | 30 | 60 | 0 | 2 | 8959 |
| repeated-conflicts | 2786.2 | 39.5 | 930 | 1860 | 0 | 6 | 35518 |
| double-e-stun | 355.1 | 316.1 | 0 | 0 | 0 | 0 | 321037 |

Counters aggregate 30 samples; result size is the last retained sample.

All no-conflict fixtures have zero nested replays. The largest measured no-conflict slowdown relative to Natural is approximately 1.12x (double-e-stun), below the requested 10x investigation threshold. Repeated genuine conflicts remain slower, as expected, and bounded. No claim is made that generalized search is now cheap: it has been removed from ordinary gates.

## Browser smoke (items 51–52, 85)

Performed through the actual in-app browser at localhost, using a temporary in-memory Team 1: Agumon with E-Stun Blast only, HP1000 / MP200 / ATK150 / DEF120 / SPD100. Enemy canonical encounter 95: Birdramon (Meteor Wing), Flarerizamon (Blaze Blaster, Blaze Blast), Candlemon (Flame Bomber). There is no Confusion source. Used identical Optimized Action Search, Fastest Potential, Strategy and Deep budget 1,000,000 for both policies. Runs finish early at depth 10; the full budget was not consumed.

Natural progress increased from 13 evaluations / 3 candidates to 8,128 / 266, with 1,298.2 evaluations/s at about 6.3s; completed with 17,484 evaluations / 426 candidates. TAS progress increased from 12 / 3 to 5,286 / 207, with 526.9 evaluations/s at about 10s; completed runs showed 17,664 / 471. Results explicitly showed no Confusion + Paralysis conflicts and retained direct status requirements. Both start progressing within the first second, with no multi-minute first rollout. These are approximate live observations on separate runs, not a controlled browser benchmark. Additional Natural Standard runs completed; early attempts to sample progress targeted the initial placeholder region after it had switched to the Optimized region, so those attempts yielded no speed measurement.

No true-conflict browser fixture, export download or browser cancellation was performed. Real-engine automated tests cover the conflict, export and cancellation paths. No Planner route was edited, and the smoke team is session-only.

## Verification and scope (items 75–93)

- Full `node --test tests/*.test.cjs`: **2,828 passed / 0 failed / 0 skipped**.
- Data self-checks: **61/61**.
- `node scripts/checkBattleSkills.cjs`: **11/11**.
- Effect coverage: **598 classified occurrences / 101 groups / 370 authoritative / zero used deferred / five unused dictionary rows**, unchanged.
- Workbook `importBattleSkills.py <DW2 Modding Info.xlsx> --check`: all 68 bytes, labels, effect dictionary and provenance passed using bundled Python.
- `npx tsc -p tsconfig.app.json --noEmit` and `tsconfig.node.json`: passed.
- `npm run build`: passed; existing stale Browserslist and large-chunk warnings remain. Esbuild required an approved sandbox escalation to read ancestor directories.
- `npm run lint`: unchanged **3 errors / 7 warnings**, no new findings. Existing errors are in UI command/textarea and tailwind.config; unrelated debt was not changed.
- `git diff --check`: passed (Git's LF/CRLF conversion notices are informational).
- No battle mechanics or Player search semantics changed; only TAS resolution/search policy and its reporting changed.
- Run Planner and story/Coliseum unchanged; Planner schema v7; Report v1.
- No broad UI redesign; How to Use unchanged; no commit or push.

## File inventory (items 1–2)

Created:

- scripts/characterizeTasLuckNarrow.cjs
- tests/tasLuckNarrow.test.cjs
- docs/phase-2k-l1a/IMPLEMENTATION.md
- docs/phase-2k-l1a/performance.json
- docs/phase-2k-l1a/performance-before.json
- docs/phase-2k-l1a/tas-policy-before-after.json

Modified:

- src/utils/battle/battleRngPolicy.ts — ordinary favorable resolution; conflict-only controller call.
- src/utils/battle/battleAccuracy.ts — current Enemy Confusion/action eligibility supplied to the Paralysis gate.
- src/utils/battle/battleTasLuck.ts — lazy frontier and conflict-only work counters.
- src/utils/battle/battleFastestRoute.ts — ordinary and conflict requirements retained together.
- src/utils/battle/battleRngAudit.ts — precise selected-conflict wording.
- src/components/BattleSimulation.tsx — helper wording.
- src/components/BattleResults.tsx — narrowed policy and compact conflict diagnostics.
- src/utils/battle/battleSimulationReport.ts — report semantics.
- src/utils/battle/battleSimulationReportSerialization.ts — Markdown conflict wording.
- tests/tasLuck.test.cjs — reviewed narrowed L1 expectations.

Ignored phase-2kl1a logs are local verification output, not source deliverables.
