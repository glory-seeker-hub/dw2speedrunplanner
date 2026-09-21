# Phase 2L-A — Canonical Simulation Report and Export

Implemented on `phase-2l-a-simulation-report-export`, from committed Phase 2K-K baseline `7945fac`. No commit or push. Final verification completed September 21, 2026.

## Existing export audit

Run Planner's `RunRouteExport.tsx` and `RouteDocument.tsx` render a detached route document built by `buildRouteDocument` in `src/utils/routeDocument.ts`. `src/utils/routePrint.ts` manages the print lifecycle. Export Route opens a portal preview and calls `window.print`; the browser handles printing or Save as PDF. It has no application-generated download MIME, Blob, or generic download helper. Its document title is `DW2 Route - <sanitized run name>`; browser print behavior controls any final PDF filename.

The route document uses structured headings, tables and human-readable route text. `safeRouteTitle` removes control characters and filesystem-unsafe punctuation, normalizes whitespace and limits the title to 100 characters. Simulation filenames reuse this sanitizer. A small shared `downloadTextFile` helper was added because the print flow has no suitable file downloader. Planner's print format, title behavior, contents and multiple-run behavior are unchanged. Existing `tests/routeExport.test.cjs` and multiple-run/navigation regressions pass in the full suite.

## Result audit and snapshot boundary

`SimulationResult` already retains aggregate outcomes, action/frame statistics, timing/resource diagnostics, a fewest-actions victory and a fastest-timed victory. Search metadata retains completed counts, elapsed time and completed/cancelled status. Optional `OptimizedSearchResult` adds objective/configuration/root seed, candidate/depth/fair-stage progress, the recommended fair prefix and statistics, at most five top candidates, and a separately tracked global fastest complete route with seed, sample index, prefix identity, intended decision trace, history and RNG requirements. Optional exact-stat provenance was already attached outside the Worker.

Before this change the result did not own all input/configuration/Planner context; that information was available in live UI state or the dispatch request. The controller now clones the request and creates a frozen `SimulationReportJob` before posting to the Worker. `createBattleState` resolves combatant IDs, effective stats, skills and initial conditions once at dispatch; this initializes data and does not simulate or draw RNG. Source and stat provenance remain outside the Worker protocol. At COMPLETE or CANCELLED, the pure builder combines the frozen job with the retained terminal result, detaches the plain data and recursively freezes it. Results owns this report. Clicking export only serializes this report, never current controls or current Planner state.

Completed and cancelled variants share the retained-result shape. Cancellation reports explicitly say Cancelled / Partial and only describe completed observations. No incomplete stage is promoted to fair statistics. Zero completed observations produces no report or export control. Editing controls after a result cannot rewrite its configuration. Existing source-run switching/deletion invalidation clears Results and its report; no new invalidation or persistence architecture was added.

## Canonical model and source data

`BattleSimulationReport` is a React-independent recursively readonly plain-data tree, frozen at runtime. `reportVersion: 1` versions this export only; Planner stays v7. It contains result status, discriminated manual/Planner source, battle identity, effective input, Player/Enemy snapshots, optional stat provenance, simulation configuration, aggregate search summary, a method-discriminated selected result, intended Player strategy, RNG requirements, one executed history and diagnostics.

Manual setup omits Planner-only fields. Planner source retains the detached run ID/name, battle event/index, selected Domain/phase/floor/encounter and historical reconstruction summary/diagnostics. Missing optional fields are omitted in Markdown. No identity is invented or newly saved into RunPlan.

Both teams retain stable IDs, side and slot, species/name, type/specialty, exact Max/Current HP/MP, ATK/DEF/SPD, available techniques and initial status/power/stage data. Player level, DP and level-cap provenance are retained where present. Duplicate species are labeled with side, slot and battle ID. The original effective BattleInput is also retained in JSON.

Planner baseline versus custom simulation stats is explicit. Only changed exact stat fields receive Planner → Simulation delta lines. Current HP/MP are separate simulation-start resources, not historically tracked Planner resources. Local custom values are not labeled verified in-game measurements. No stats are reconstructed at export time.

Configuration includes Search Method, objective where applicable, Strategy/Game-accurate, Natural/TAS Favorable, Floor Specialty, requested evaluation budget, optimized beam/depth settings, simulator seed where available and max-rounds safety limit. Preset names are not retained by the current request; their effective numeric budgets are exported. Engine defaults are resolved at dispatch.

## Method and objective mapping

| Result | Report interpretation |
| --- | --- |
| Random Monte Carlo | Existing success/action/frame aggregates and one retained victory observation; no fabricated beam, prefix, objective or intended trace. |
| Fastest Potential | Global fastest complete route (frames, rounds, seed, sample, prefix identity and exact intent) and best screened fair prefix remain separate. Recommended orders use the observed fastest route. |
| Average Victory | Selected fair prefix with existing arithmetic mean victory frames, success/divergence rates, fastest fair sample and evaluations. |
| Success Rate | Selected highest-success fair prefix and its existing statistics, without changing ranking. |
| Cancelled / Partial | Retained completed observations and last completed fair checkpoint only; no exhaustive or complete-search claim. |

The global fastest route is independently reported for every optimized objective. Average/Success do not currently retain a representative replay of their selected fair strategy. Their Executed Battle is explicitly the global fastest observation and may belong to another prefix. The report preserves this limitation rather than replaying or manufacturing a representative result. A regression changes fair stats/prefix independently and confirms the global fastest route remains unchanged.

Intended orders retain round plans, explicit targets and engine-controlled random/policy target labels. Actual resolved targets belong only to executed history. Planned orders that did not execute because the battle ended remain in the intended trace with an explanatory label. Later-round plans are path-specific, not a complete adaptive policy.

TAS requirements are collected using the existing canonical RNG-audit helper over the retained executed history. Their round/action, actor/target/technique, phase/category and required outcome are preserved. The dedicated Markdown section appears only when requirements exist. TAS statistics carry the existing conditional-policy warning: they are not natural probabilities; simulator seeds are not game RNG seeds or manipulation inputs. Natural reports do not receive that warning.

## History, timing and diagnostics

Exactly one action-history list is retained in the report: global fastest if available, otherwise fastest timed victory, otherwise fewest-actions victory. Full canonical records survive JSON serialization without export-specific battle calculations. Markdown renders action outcome/state/reason, actual targets, damage/healing/HP, base and special damage fields, MP accounting, accuracy, status application/recovery, Counter, Interrupt, Assist/support/reaction, effect audit and resource/timing diagnostics.

Tests serialize retained engine events for Hit, Miss, healing, statuses, Motivation Down Guard, Counter, Banana Slip prevention, Interrupt, Assist, Musical Fist, HP Zapper, Critical Blow, Twig Tap, Party Time, Fantasmic Ray, Shadow Scythe, Light Gun and MP-related effects. No mechanic is reimplemented by the exporter.

Frame totals and per-action timing are modeled battle-action costs. Reports explicitly say external real-game UI and order-menu overhead is not modeled. Diagnostics combine existing result/search/action warnings, resource-alert explanations, Planner uncertainty and report-specific scope limitations, deduplicated by text. Compatibility warnings are included only when actually emitted by retained data.

## Serializers and export UI

The pure Markdown serializer uses stable sections: Source, Battle, Player Team, Enemy Team, optional Player Stat Provenance, Simulation Configuration, Search Summary, Result, Recommended Player Orders, optional TAS RNG Requirements, Executed Battle, Diagnostics. It escapes Markdown table/link syntax and HTML characters, flattens controls/newlines in values and preserves UTF-8 names. Missing optional values are omitted rather than printed as undefined/null/object coercions.

The JSON serializer emits the canonical versioned tree with indentation and a trailing newline. Tests parse it back and compare all canonical values. The builder produces only serializable data: no functions, cycles or BigInt values. JSON retains machine identities and event structures, without a separate interpretation layer.

Results has one minimal **Export Simulation** button when a report exists. It downloads Markdown immediately using `text/markdown;charset=utf-8`. JSON serialization and `.json` filename generation are available programmatically; there is no second prominent format control in this phase. A future JSON download should use `application/json;charset=utf-8`; no JSON browser download is claimed here.

Filenames are `dw2-battle-simulation-<sanitized enemy group>-<objective-or-random-monte-carlo>.md` (or `.json` for the serializer consumer). No wall-clock timestamp affects deterministic output. The shared client-only helper creates a UTF-8 Blob/object URL, clicks a temporary download anchor, removes it and revokes the URL after a short delay. Tests cover contents, MIME, extension, sanitization, cleanup, absent reports and cancelled reports. No network upload or server is involved.

## Boundedness, generated examples and measurements

The builder copies aggregates, at most five compact candidate summaries, selected order traces and one retained history. It does not consume or store discarded rollout histories. A 10,000-versus-100,000 evaluation regression confirms identical history/candidate counts and less than ten bytes of JSON counter growth. Size scales with the retained battle length, not all evaluated rollouts; exceptionally long retained battles still produce longer files.

Run `node scripts/characterizeSimulationReports.cjs` to regenerate [Fastest](example-fastest-report.md), [Average](example-average-report.md), [TAS](example-tas-report.md) and [characterization.json](characterization.json) from deterministic engine fixtures and the actual serializer.

| Fixture | Markdown UTF-8 bytes | JSON UTF-8 bytes | Action events | TAS requirements | Candidate summaries |
| --- | ---: | ---: | ---: | ---: | ---: |
| Random | 4,023 | 8,865 | 2 | 0 | 0 |
| Fastest | 5,300 | 13,314 | 2 | 0 | 1 |
| Average | 5,666 | 13,668 | 2 | 0 | 1 |
| TAS | 15,794 | 33,004 | 6 | 7 | 1 |
| Long | 337,762 | 627,296 | 250 | 0 | 0 |
| Cancelled | 5,467 | 13,470 | 2 | 0 | 1 |

The final local benchmark uses the 250-action fixture, ten warmups and 100 measured iterations: construction 4.11 ms, Markdown 62.22 ms, JSON 2.01 ms per call. These are local measurements, not browser quotas or a controlled search-speed comparison. Construction happens once at the terminal boundary; serialization happens on explicit export. No per-rollout report work is added.

## Verification and browser evidence

| Check | Result |
| --- | --- |
| Full `node --test tests/*.test.cjs` | 2,664/2,664 passed; 84 new tests over baseline; final-code run 37.69 s |
| Final focused report/history/progress suite | 112/112 passed |
| Data self-checks | 57/57 |
| Battle-skill checks | 11/11 |
| Effect coverage | 598 decoded occurrences, 101 groups, 370 authoritative occurrences, zero used deferred, five unused dictionary rows |
| Workbook `--check` | Pass: all 68 bytes, labels, effect dictionary and provenance |
| TypeScript app and node projects | Both pass |
| Production build | Pass; existing large-chunk warning remains |
| Lint | Baseline unchanged: three errors, seven warnings; no new findings |
| `git diff --check` | Pass |

Full-suite coverage includes Planner/multiple-run/export/historical reconstruction/stat overrides, both search methods, all objectives, both accuracy modes and RNG policies, cancellation/progress/Worker independence, action histories and Phase 2K-K effects. The existing progress test fixture now supplies a complete aggregate result and compares forwarding separately from the newly attached report.

Real in-app browser smoke was performed during implementation on localhost. A disposable smoke run named Phase 2L-A Smoke analyzed Boot Domain floor 1 encounter 154 (Gazimon + Gizamon) from Agumon's historical Lv1 state. Strategy/Natural optimized budget 64 completed and downloaded Markdown; the file was inspected for provenance/settings/orders. A second run with ATK 28 → 65 exported that exact delta. Editing live controls to ATK 70, Game-accurate, TAS Favorable and Success Rate without rerunning still exported the previous Strategy/Natural/Fastest result with ATK 65. These checks confirmed the snapshot boundary in a real browser.

A TAS Favorable Fastest run completed and displayed six requirements; Export Simulation was clicked. The TAS downloaded file was not independently inspected before interruption; serializer tests and the generated TAS example verify its contents instead. A million-evaluation Random Monte Carlo run reached retained victories, but automatic approval review failed on Cancel Simulation because the review account hit a usage limit. Browser cancellation/export and subsequent route-switch smoke therefore remain uncompleted, not passed. Automated tests cover both cancellation download and source-run switch/deletion invalidation. The practical browser limitation does not block the implementation or automated checks; no browser-policy workaround was used.

## Files

Created runtime files:

- `src/utils/battle/battleSimulationReport.ts`
- `src/utils/battle/battleSimulationReportSerialization.ts`
- `src/utils/downloadTextFile.ts`
- `src/components/SimulationReportExport.tsx`

Created tests/tooling: `tests/helpers/simulationReportFixtures.cjs`, `tests/simulationReport.test.cjs`, `tests/simulationReportHistory.test.cjs`, `scripts/characterizeSimulationReports.cjs`.

Created documentation: this file, `verification.json`, `characterization.json`, and three generated example reports in this directory.

Modified: `src/types/digimon.ts` (optional report), `src/workers/battleSimulationController.ts` (dispatch snapshot/terminal builder), `src/components/BattleSimulation.tsx` (detached Planner provenance), `src/components/BattleResults.tsx` (export control), `tests/simulationProgressUI.test.cjs` (complete terminal-result fixture/assertions).

## Scope confirmations and Phase 2L-B integration

Battle mechanics are unchanged, including damage, HP Zapper, Critical Blow, Musical Fist, Twig Tap, Party Time, statuses/Motivation Down, Counter/Banana Slip, Interrupt, Assist, Fantasmic Ray, Shadow Scythe, Light Gun, MP damage, RNG policy and accuracy. Used deferred occurrences remain zero.

Search code is unchanged: canonical 2,197-plan enumeration, 4 → 16 → 64 fair screening, common random numbers, beam semantics, fastest elite/global fastest selection, Average/Success ranking and cancellation semantics remain intact. The report observes completed results and cannot influence search.

Run Planner and multiple saved runs are unchanged. Schema remains v7; no reports enter RunPlan, events, checkpoints, localStorage or activeRunId. No automatic report persistence, saved report history, import, PDF/CSV/image export, clipboard feature, broad UI redesign or How to Use rewrite was added. No commit or push was performed.

Phase 2L-B can render existing `results.report` sections, reuse the method/source discriminants and pure serializers, and keep the dispatch snapshot as the provenance boundary. If a fair-strategy representative replay or Random Monte Carlo intended trace/per-route seed is desired later, it must first be retained by the search result contract. Unseeded Random Monte Carlo cannot promise exact stream reproduction. Those gaps are explicitly described rather than filled with new search behavior in 2L-A.

## Requested final-report index

| Requested items | Coverage |
| --- | --- |
| 1–2 | Files |
| 3–4 | Existing export audit |
| 5–9 | Result audit and snapshot boundary; Canonical model |
| 10–23 | Canonical model and source data |
| 24–34 | Method and objective mapping |
| 35–39 | History, timing and diagnostics |
| 40–51 | Serializers and export UI; generated examples |
| 52–56 | Result audit; verification and browser evidence |
| 57–62 | Boundedness and measurements |
| 63–73 | Verification and browser evidence; existing export audit |
| 74–90 | Scope confirmations, limitations and Phase 2L-B integration |
