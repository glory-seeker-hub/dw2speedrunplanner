# Phase 2K-L1 — TAS Luck Outcome Search

Implemented on `phase-2k-l1-tas-luck-outcome-search`, starting from committed L0 merge `6b00c0f`. No commit or push. Fresh controls expose **Natural** and **TAS Luck**, independently of Strategy/Game-accurate accuracy. `BattleRngPolicy` is `'natural' | 'tas-favorable' | 'tas-luck'`; the old value remains accepted for existing callers and regression fixtures, but is not selectable in the UI.

## Audit and supported scope

The pre-change matrix is in `tas-luck-matrix.json`. Old forced choices live in `battleRngPolicy.ts`: direct status succeeds against Enemy and fails against Player; Player recovers and Enemy remains; Enemy fails its paralysis gate while Player proceeds. The callers are `battleStatuses.ts` and `battleAccuracy.ts`. These skipped Natural draws. L1 introduces a search controller at those gates instead of replacing one fixed favorable rule with another.

`status-source-audit.json` lists every decoded status-application skill and its source descriptors. Statuses occupy independent keyed state, so Paralysis and Confusion coexist; there is no implemented mutually exclusive status chooser. Multiple applicable effects retain their separate existing gates and order. There is no new synthetic choice among statuses.

Both outcomes branch, for either side, at probabilistic direct Poison, Paralysis and Confusion application, and probabilistic Motivation Down application when an effect actually uses that gate. Success probability is the existing 1/3 or 2/3. Native Motivation Down application is guaranteed, including Concert Crush, so it creates no application branch. Supported recovery gates are Paralysis, Confusion and Motivation Down (recover/remain, 1/4 versus 3/4). Paralysis action failure branches fail/proceed (1/2 each). Poison itself has no natural recovery gate.

Guaranteed effects, activated Counter/Interrupt guarantees, status Powers, explicit cures, immunity and blocked recovery are deterministic exclusions. TAS Luck checks immunity before offering an application choice; Enemy/Boss immunity cannot be overridden. The Natural/legacy paths retain their existing behavior and draw sequence. This changes no source bytes or canonical mechanics.

The following remain Natural: initiative, ordinary accuracy, Enemy decisions, ordinary random targets, Random Digimon targets, Player Interrupt targets, Fantasmic element, Necro target, Shadow Scythe ties, Motivation blocked-skill ties, Confusion replacement skill/target, Tail Blade evasion, Interrupt forced miss/deletion, cure/revive target choices, temporary status-Power recovery, Poison Body recovery, Elemental Power recovery, Invincibility/Invisibility recovery, and every unreviewed category. Strategy still skips only its established ordinary accuracy roll; Game-accurate still uses it. Luck never selects unsupported outcomes.

## Search and fairness

`battleTasLuck.ts` represents each decision with an opportunity key, round, action/actor identity, skill, target, status, gate phase/category, legal alternatives, individual Natural probabilities, and selected outcome. Player plans and TAS traces are separate. The canonical root enumeration remains 2,197 Player plans, not 2,197 multiplied by manipulation combinations.

For one candidate and one unsupported-RNG seed, the controller replays bounded TAS prefixes through the real engine. An unassigned gate pauses that replay and creates both alternatives. Each sibling starts with the same seed and recorded prefix; manipulated gates consume no Natural draw. Downstream unsupported draws follow the actual path, so different paths may consume the stream differently. No draw is selectively resampled to force a favorable unsupported outcome.

Each completed nested search contributes exactly one fair observation: its fastest non-divergent victory, with null timing behind timed victories, or a deterministic non-victory when no victory was found. Equal-frame ties use canonical TAS trace then Player trace; the seed/sample identity is fixed within that nested search. Existing timing-completeness checks still exclude ineligible victories from timed statistics and global fastest routes. All three objectives collapse identically before their existing ranking: Fastest Potential ranks fastest samples; Average Victory uses collapsed victory frames; Success Rate counts a sample once when a searched variant wins. A candidate with more TAS branches gets no extra statistical weight.

Optimized search retains common seeds, 4 → 16 → 64 fair stages, beam ranking, screened-prefix statistics, bounded representative samples, fastest elite, and global fastest observation. Top Candidates remain fair-stage Player candidates. Monte Carlo retains random Player decisions and samples a replay seed once per fair sample. Its selected route now retains that seed and intended Player trace. Natural's existing continuous stream is unchanged.

Every nested replay is a Worker step, permitting cancellation inside a sample. Incomplete nested samples do not enter denominators or fair-stage rankings. A terminal eligible route already observed inside such a sample can remain the global fastest observation. Internal opportunity/branch counts include work done before cancellation. Worker batch sizes 1/7, candidate reversal, and TAS alternative reversal produce identical selected results. Existing legacy batching regressions also remain.

## Bounds, pruning and replay

| Preset | Requested fair budget | Frontier cap | Replay work threshold per sample |
| --- | ---: | ---: | ---: |
| Quick | 10,000 | 8 | 2,048 |
| Standard | 100,000 | 16 | 4,096 |
| Deep | 1,000,000 | 32 | 8,192 |

Frontier ordering is deterministic: deeper TAS prefixes first, then canonical trace key. Excess prefixes are pruned. The work threshold takes effect after at least one terminal observation exists; before that, the engine's round limit bounds the first depth-first path. It is therefore a terminal-aware threshold, not an unconditional maximum replay count. The heuristic does not assume application, failed recovery or Enemy paralysis is always better. It can discard a better route and makes no optimality claim.

Duplicate frontier prefixes are removed. Checkpoint deduplication compares full engine state, current opportunity identity, action history/timing, execution count, acted actors, reservations and Natural RNG position. The checkpoint cache is itself capped; it is deliberately conservative, not HP-only merging. Histories in that key prevent many mechanically equivalent states from merging, trading speed for safety. Only a bounded frontier, bounded cache, selected sample and existing bounded representative records are retained; all branch histories are not accumulated.

Results/report expose opportunities, branches explored, deduplicated/pruned counts, max frontier, cap and work threshold. A branch count measures replay work (including partial replays), not fair rollouts or distinct complete battles. Pruned counts include unexpanded prefixes discarded at the work threshold.

`replayTasLuckRoute` uses the saved source Player prefix, unsupported seed and TAS trace, then verifies the complete intended Player trace. Preserving the source prefix is essential: turning a formerly random tail into scripted orders would change Natural RNG consumption. Wrong gate identity, illegal selected outcome, an unrecorded gate or unused recorded decisions raises `TasLuckDivergence`. Opportunity identity also distinguishes repeated/restarted gates. Replay requires the original input and rules; the report retains them. Seeds are simulator seeds, not game RNG inputs.

## Counterexamples and integration

The real-engine Confusion fixture selects Enemy Paralysis recovery and remaining Confusion, enabling a 1,370-frame self-KO; old TAS Favorable fails to win within the fixture limit. A separate fixture still selects Paralysis Miss when it saves time. With Giga Byte Wing blocking recovery, the paralyzed Enemy must proceed to execute its Confusion self-KO. With blocked recovery and GAIA Gear, failed Confusion application allows an Enemy attack to activate the winning Counter. These demonstrate that locally favorable status rules are insufficient.

The original practical D-Tyrannomon/two Nanimon versus Birdramon/Candlemon fixture wins in 74,782 frames at seed 42 with both opening E-Stun applications. It explores 716 replays, prunes 77 prefixes and respects cap 8. This is a bounded route characterization, not a best-possible route. Concert Crush still produces deterministic Motivation Down on Hit; only a later supported recovery can branch. Immunity, blocked recovery, unsupported temporary recovery and both choices for all supported gate categories have focused tests.

Both search methods and both accuracy modes are exercised with Natural/TAS Luck. All three optimized objectives have 64-sample fairness and replay tests. Many-gate and no-gate candidates each receive 64 observations. Rendered component tests verify Natural/TAS Luck controls, independent accuracy, locked active controls, conditional-statistic warnings and outcome-based TAS Luck history wording.

## Reports and results

The UI explains that averages and success rates are conditional on the best searched manipulation per sampled unsupported-RNG seed, not natural probabilities. Requirements include application failure, recovery success, continued status, action failure and action proceeding, with individual Natural probabilities in structured records. They do not multiply these into a route probability. History uses the actual selected outcome rather than a fixed Enemy-favorable label.

Report version remains **1**, with optional additive TAS summary, selected trace, route replay provenance and frontier configuration. Existing Natural report fields and serialization remain compatible. Markdown includes TAS Luck Search and TAS Luck Requirements; JSON includes the complete structured trace. The immutable dispatch snapshot and report freeze preserve policy, objective, input, caps, counts and requirements after controls change. Cancelled reports distinguish completed observations from unfinished fair work and can retain a completed global route even with zero completed fair samples. Export logic reads the canonical report; it does not rerun mechanics.

## Performance

Reproduce with `node scripts/characterizeTasLuck.cjs`. `performance.json` records Natural/TAS measurements for six fixtures, three seeds each: no gates, one application, repeated Paralysis, Confusion/Paralysis, the original practical double E-Stun battle, and a status-heavy battle capped at ten rounds. It includes fair rollouts, opportunities, replay branches, pruning, frontier, wall time, both throughput measures and result bytes.

On this local run, repeated Paralysis was about 1,151 Natural versus 3.8 TAS fair rollouts/s; practical double E-Stun about 188 versus 0.5/s. Its TAS result was 353,681 bytes, with 2,148 internal replays across three fair samples. These small measurements include warmup and are not stable speed claims. The replay implementation prioritizes correctness and bounded memory over speed.

Quick and Standard use their default preset configuration on a one-root battle that ends in round one, completing the 64-sample stage early: about 33.5/29.9 ms, 192 replays each, frontier maximum 2, roughly 14 KB results. Deep uses the same controlled fixture: about 29.4 ms. Maximum measured step was 1.1 ms or less on these small preset fixtures. These are explicitly early-completion characterizations, not full-budget or worst-case responsiveness benchmarks. Status-heavy production jobs may be much slower; the Worker can yield between replays, not midway through one synchronous engine replay.

## Verification and unchanged scope

See `verification.json`. **2,776/2,776 tests pass**, including 67 new L1 tests (72.22 seconds for the final full run); Natural Strategy and Game-accurate full-result snapshots remain exact. Coverage includes Motivation Down, Confusion, Paralysis timing, Counter, 761f/270f Interrupt behavior, Assist, Party Time, Concert Crush, fractional SPD growth and L0 half DEF. Data checks stay 57/57; skill checks 11/11; coverage stays 598 occurrences, 101 groups, 370 authoritative occurrences, zero used deferred occurrences and five unused dictionary rows. Workbook source, both TypeScript projects and production build pass. Lint remains three errors/seven warnings; no new finding. Automated component rendering is not a real-browser smoke test; none was performed.

Run Planner and historical analysis storage are unchanged; schema remains v7. No story/Coliseum work, broad UI redesign, How to Use change, new persisted flags or source-workbook changes. No commit or push.

## Files

Created: `src/utils/battle/battleTasLuck.ts`, `battleTasLuckReplay.ts`; `tests/tasLuck.test.cjs`, `tests/helpers/tasLuckFixtures.cjs`; `scripts/characterizeTasLuck.cjs`; this document and `verification.json`, `tas-luck-matrix.json`, `status-source-audit.json`, `performance.json` in this directory.

Modified in `src/utils/battle/`: `battleRngPolicy.ts`, `battleRng.ts`, `battleTypes.ts`, `battleSimulationRules.ts`, `battleSimulation.ts`, `battleStatuses.ts`, `battleAccuracy.ts` (gate plumbing); `battleFastestRoute.ts`, `battleSearchObjectives.ts`, `battleOptimizedSearch.ts`, `battleSimulationSearch.ts`, `battleCompatibility.ts` (bounded sample integration/replay provenance); `battleRngAudit.ts`, `battleSimulationReport.ts`, `battleSimulationReportSerialization.ts` (requirements and exports). Also `src/types/digimon.ts`; `src/components/BattleSimulation.tsx`, `BattleResults.tsx`, `OptimizedSearchResults.tsx`; and control expectations in `tests/exactStatOverrides.test.cjs`, `tests/tasSearchIntegration.test.cjs`.

## Requested final-report cross-reference

| Items | Location |
| --- | --- |
| 1–2 | Files |
| 3–6 | Audit; matrix and source-audit JSON |
| 7–9 | Opening policy/compatibility decision |
| 10–22 | Audit and supported scope |
| 23–31 | Search and fairness |
| 32–46 | Bounds, pruning and replay; deterministic tests |
| 47–58 | Counterexamples and integration; search/fairness |
| 59–69 | Reports and results |
| 70–75 | Performance; performance.json |
| 76–97 | Verification and unchanged scope; verification.json |
| 98–103 | Unchanged scope; branch/no commit/no push |
