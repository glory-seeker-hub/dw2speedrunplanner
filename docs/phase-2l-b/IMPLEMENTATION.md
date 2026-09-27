# Phase 2L-B — UI, Navigation, Results UX and Simulation Reporting

## Baseline and scope

Work is on `phase-2l-b-ui-navigation-results`, starting from clean HEAD `5f76b49`, which contains committed L1a `62161c9` (Implement Phase 2K-L1a narrow TAS Luck). Baseline verified before editing. No commit or push was performed.

This phase changes presentation, component state and Markdown serialization only. No battle mechanics, TAS resolution, Player-plan enumeration, beam pruning, common RNG worlds, objective ranking, global fastest tracking, sample collapse, Worker cancellation or Planner progression code changed. Run Planner remains schema v7; immutable Simulation Report remains v1. JSON serialization and the canonical report builder are unchanged. How to Use was not rewritten.

## Pre-change UI inventory and audit

| Area | Existing structure / issues | Decision |
| --- | --- | --- |
| Navigation | One Index page with Team Builder, Battle Simulation, Results and Run Planner tabs; Analyze selects Simulator. Context was repeated in a banner, with no explicit return action. | Preserve tabs, historical preset and invalidation; add contextual return buttons and workflow text. |
| Planner | Saved-run selector, summary, roster actions, five-section battle selector and filtered history already work well. | Preserve layout and selector state rules; label Active run and explicitly show Coliseum no-level-up in history. |
| Battle add / Analyze | Normal Domain/floor encounters and 24 Coliseum rank entries, reward preview, Record Battle and Analyze on historical entries. | Preserve all actions and progression; keep Analyze on each eligible event. |
| Setup | Single shadcn Card, sequential controls; exact-stat tables took substantial initial space, RNG group nested inside Accuracy group, numeric budget always visible. | Collapse advanced stats, separate accessible Accuracy/RNG groups, emphasize presets and show numeric editor for Custom. |
| Progress | Worker-owned phase, samples, depth, plans, beam, timing, rate and Cancel; initial absence of statistics was ambiguous. | Keep counters and cancellation; explicitly distinguish processing from absence of a completed screening result. |
| Optimized Results | Technical counters and diagnostics first; ambiguous prefix/candidate names; Fastest intent mixed with fair recommendations; stale generalized TAS prose. | Objective-aware primary card, prominent correct orders, narrow L1a wording, then statistics and disclosures. |
| Random Results | Aggregate cards, search metadata, coverage and two full histories at equal weight. | Compact Simulation Summary, one selected replay, secondary technical statistics. |
| Action history | Long cards with raw IDs, status rolls, effect audit and resource fields all expanded. | Compact actor/technique/actual target/outcome/frames/damage/healing, expandable complete audit. |
| Export | Export Simulation already downloads the frozen Markdown report; Export Route is independent. | Preserve download contracts and placement; centralize definitions and add contextual reading guide. |
| Design system | Existing shadcn Cards, Badges, Buttons, Radix controls, theme tokens and responsive utilities. | Reuse them and native keyboard-accessible details/summary. No new color palette or router. |

## Navigation, setup and progress (requested final-report items 7–16)

Planner → historical Analyze Battle → Simulator setup → active Worker progress → Results → Export Simulation remains the workflow. Simulator shows `Run Planner › <readable location>` and the historical pre-battle origin, run name and action number. Normal locations use existing Domain/floor/story labels; Coliseum uses rank labels. Raw run UUIDs are not fallback breadcrumbs. Manual setup remains independently available through Team Builder and the Use manual setup action.

Method and objective remain separate: Random Monte Carlo hides optimization objectives; Optimized exposes Fastest Potential, Average Victory and Success Rate. Accuracy controls ordinary Hit Rate; the independent RNG Policy controls implemented status RNG. The shared L1a helper says favorable supported outcomes resolve directly and only an Enemy acting with both Confusion and Paralysis compares Paralysis Miss against allowing Confusion to proceed. Unsupported RNG stays Natural.

Quick 10,000, Standard 100,000, Deep 1,000,000 and Custom retain their actual budgets. Presets display the active budget; Custom opens the numeric editor. All controls still lock during simulation, and Cancel remains outside the disabled fieldset. Exact stats remain locally editable and validation errors open their advanced disclosure. Reset/imported-team actions retain their original behavior.

Progress retains phase, evaluations, depth, root plans, candidates evaluated/current candidates, beam, best screened metric, elapsed time, speed and existing ETA behavior. Initial processing and absent completed fair statistics have explicit text. The unchanged progress contract does not expose live TAS conflict counters; none are synthesized. Retained conflict counters appear in Results Technical Details only when opportunities > 0, separate from fair sample counts. Optimized pruning and stochastic/fair-rollout limitations remain concise contextual help.

## Result semantics and hierarchy (items 17–33)

`battlePresentation.ts` centralizes definitions used by UI and Markdown:

- **Fastest Route Found:** one fastest complete winning execution observed anywhere in the search, including retained intended orders; no global-optimum proof.
- **Best Screened Strategy:** a Player strategy/prefix repeatedly evaluated in completed fair screening. Its sample statistics are distinct from a single fastest execution. Common sampled RNG worlds and path-specific/random continuation beyond the prefix are explained.
- **Selected Average Victory Strategy:** selected by the existing average-winning-frame objective. It is an average of winning samples, not expected real-game time.
- **Selected Success Rate Strategy:** highest observed success under current sampling/ranking rules. No uncomputed confidence interval is claimed.
- **Top Screened Strategies:** bounded fair-screened candidate summaries, in engine order, not fastest individual replays and never TAS branches.
- **Executed Battle Replay:** the actual retained observation. It identifies fastest timed/global fastest or the fewest-actions fallback without inventing a representative Average/Success replay.

Fastest prioritizes frames, rounds and complete Player victory, then its exact intended orders and TAS requirements. Average prioritizes average winning frames, observed success and fair samples; Success leads with observed success and omits unavailable average timing. Both recommend the selected fair prefix and show the fastest observation separately. The secondary fastest sample number is explicitly a fair sample, not substituted for the global observation.

The main result and recommendations precede the secondary strategy/observation, expandable Top Screened Strategies, Search Details, Executed Battle Replay and Technical Details. Export Simulation remains at the top. Random has a Simulation Summary with observed success, average/fastest timing and sample count, without optimized terminology. Random TAS also displays its retained intended route when present.

Replay provenance uses retained source-prefix identity, not similar first-round text. Average/Success gets the explicit may-not-use-selected-strategy notice when provenance differs; an exact source-prefix match suppresses the warning. JSON remains untouched, including original diagnostics; the Markdown presentation omits the stale generic diagnostic when the precise provenance check establishes a match. No re-simulation or added histories exist. If fewest-actions and fastest histories differ, a labelled replay selector shows one history at a time.

TAS requirements immediately follow the recommended actions when retained. For Average/Success, they explicitly belong to the fastest observation and do not establish requirements for the selected fair strategy. Conditional statistics are described as TAS-policy/unsupported-RNG samples, not natural probabilities. Implicit Natural results (policy omitted by the engine) do not display a TAS warning. Timing scope is stated near the summary: modeled battle actions exclude external menu/order-entry overhead.

## Labels and action history (items 34–43)

Known report identities render as `Name · Player N` / `Name · Enemy N` for stable duplicate-species disambiguation. Raw UUIDs are confined to technical identity/provenance disclosures and machine JSON. Explicit intended targets use the same labels. Random intent remains Random target; executed cards use actual retained effective targets. Planned orders without a resolved action remain labelled unexecuted rather than silently removed.

Compact action cards prioritize round, actor, technique, textual Hit/Miss/Guard or skipped outcome, actual targets and frames. Damage and HP transitions, applied canonical status labels (including Motivation Down), healing, Counter/Interrupt/Assist and TAS-conflict pass requirements are visible. Expanded details preserve timing, MP accounting, accuracy rolls, status recovery, confusion, Counter causal actors, Interrupt restart/cancellation/reduction, support events, resource alerts, Banana Slip/effect audit and unresolved diagnostics. No damage, probability, healing or frame calculation is reimplemented.

## Markdown and machine report (items 44–55)

How to Read This Report is contextual: optimized reports explain Fastest, Screened, fair samples and the current Average/Success objective; Random omits beam/screened-candidate definitions. Narrow L1a semantics, conditional-statistics wording and TAS requirements appear when relevant. Fastest and selected strategy have distinct sections. Top Candidates is renamed Top Screened Strategies. Executed Battle Replay states retained provenance and the conditional replay limitation. Source/prefix/seed identities move to Technical Details; detailed action audits use Markdown HTML disclosures. Primary combatant labels omit IDs. Escaping and download filename/MIME behavior remain covered by existing tests.

Headings and prose do not change the canonical schema. Report version stays 1; no extra explanatory fields are inserted into JSON; JSON round-trip, immutability, frozen input/settings and detached result tests pass.

## Planner, responsive behavior and accessibility (items 56–64)

Planner adds Active run and `0 XP · 0 Bits · No level-up (Coliseum)` history wording. Story selection, 33 normal Domain variants, 24 Coliseum entries, reset behavior, historical reconstruction, pending-XP suppression, multiple saved routes and route export remain covered by the full suite. Existing filtered history and route management were retained because the audit found them useful.

Results use wrapping cards instead of a wide primary candidate table. Responsive grids reduce to one column; long identifiers occur only in secondary breakable/scrollable areas. Native disclosures support keyboard activation; buttons retain visible text, pressed/disabled semantics, focus styles and Cancel access. Warnings and Hit/Miss states use words as well as theme colors. Associated team/floor labels were repaired. The Custom budget editor needed an explicit hidden utility because the Input component's display class overrides the native hidden attribute; this was found during browser smoke.

A retained 250-action fixture rendered one action list, with technical audits closed, in approximately 175 ms server-side (333,154 bytes markup) on this machine. This is UI rendering characterization, not a search benchmark or browser performance guarantee. Normal browser interaction with the 32-action retained route, candidate disclosure and action audit remained usable. No virtualization or duplicate full-history mount was added.

No-result/zero-victory views do not claim a winning route; missing metrics stay unavailable. Cancelled results explicitly say Partial and export only the report the existing builder makes available. Zero-observation export remains unavailable unless already supported by the L1a retained-route contract.

## Real-browser verification (items 65–71)

Performed against local Vite in the Codex in-app browser. A dedicated `Phase 2L-B smoke` saved run was created; it remains as a local smoke fixture with two recorded battles. No other run was edited.

- Normal Analyze: Agumon starter, Boot Domain Floor 1, encounter 154 (Gazimon/Gizamon). Verified historical EL1 stats, human-readable location, advanced stats disclosure and independent controls.
- Natural Fastest / Strategy / Quick: completed early, 21,920f, 13 rounds. Correct exact orders, screened secondary result, replay and no TAS statistics warning after the implicit-Natural regression fix.
- Natural Average / Strategy / Quick: selected mean 28,874.1f, observed success 100%, 64 fair samples; four-round selected prefix distinct from 13-round fastest observation. This fixture's retained source prefix matched, so no incorrect mismatch warning was shown. Automated tests cover a differing source prefix and the warning in both UI/Markdown.
- TAS Luck Success / Strategy / Quick: observed success 100%, mean 23,332.8f, 64 samples; conditional warning and direct favorable requirements immediately after the selected prefix. No Confusion source; no branch table.
- TAS Luck Fastest / Strategy / Quick: 21,920f / 13 rounds, requirements included preventing Gazimon's Paralysis application on Agumon. Active optimized progress showed rollout/depth/candidate/beam/speed counters and accessible Cancel.
- Random Natural / Strategy / Quick: completed 10,000 samples, 100% success, mean 30,059.2f, fastest 21,920f. No optimized-only primary terminology.
- Export Simulation clicked for Natural Fastest. Browser download-event wait timed out, but the actual Markdown file was present in Downloads and read back: version 1, How to Read This Report, Fastest/Screened definitions and historical source were verified. The timeout was not treated as proof of download failure or success; filesystem verification established completion.
- Coliseum Rank 2-A / encounter 158 recorded: confirmed zero XP/Bits/no level-up history; Analyze showed `Run Planner › Coliseum · Rank 2-A` and reconstructed pre-battle stats.
- Cancellation: started Random Deep on the Coliseum fixture, cancelled, and verified Cancelled / Partial summary (8,909 completed samples in that run) with retained replay and Export Simulation available.
- Responsive: 390×844 override, effective document width 380px; scrollWidth also 380px for setup and Results, including expanded candidates and keyboard-opened action detail. Restored the viewport override afterward.

True Confusion+Paralysis conflict presentation, mismatch replay warnings, duplicate species, zero-victory/export-unavailable, long-history and Game-accurate behavior are covered by automated tests; no separate browser run for every combination is claimed. A prior browser session was interrupted by the approval service's usage limit before running; the resumed session completed the checks above.

## Verification (items 72–81)

Final results are recorded in `verification.json` and local ignored `phase-2lb-final-*.log` files. Baseline was 2,828 tests; this phase adds 50 focused presentation regressions and updates existing copy expectations without removing mechanics assertions.

- Full Node test suite: 2,878 passed; 0 failed, cancelled or skipped (133.12 seconds), including 50 new presentation regressions.
- Data self-checks: 61/61.
- Battle-skill checks: 11/11.
- Effect coverage: 598 classified occurrences / 101 groups / 370 authoritative / 0 used deferred / 5 unused dictionary rows, unchanged.
- Workbook: all 68 bytes, labels, effect dictionary and provenance passed against Downloads/DW2 Modding Info.xlsx with bundled Python.
- Both TypeScript app/node checks: passed on final source.
- Production build: passed on final source (50.03 seconds). Existing stale Browserslist/large-chunk warnings remain.
- Lint: unchanged baseline of 3 errors / 7 warnings on final source, with no new findings. Errors are existing empty interfaces in command.tsx and textarea.tsx, and require-import in tailwind.config.ts; warnings concern React Fast Refresh exports.
- Diff whitespace check: passed; CRLF conversion notices are informational.

Full suite includes Planner/history/multiple runs, story/Coliseum, route export, Analyze, all search objectives, both accuracy modes, Natural/TAS L1a, Worker progress/cancellation, report build/Markdown/JSON, L0 regressions and unchanged canonical 2,197 / 4→16→64 search fixtures.

## File inventory (items 1–2)

Created: `src/utils/battle/battlePresentation.ts`, `tests/phase2lbPresentation.test.cjs`, this implementation report, and `verification.json`.

Modified UI: `BattleSimulation.tsx`, `BattleResults.tsx`, `OptimizedSearchResults.tsx`, `SimulationSearchProgress.tsx`, `pages/Index.tsx`, `run-planner/RunPlanner.tsx`, `run-planner/RunHistory.tsx`.

Modified export: `utils/battle/battleSimulationReportSerialization.ts`.

Updated existing presentation expectations: `battleTimingResources.test.cjs`, `optimizedFastestRoute.test.cjs`, `optimizedSearchIntegration.test.cjs`, `simulationReport.test.cjs`, `tasLuck.test.cjs`, `tasSearchIntegration.test.cjs`.

Temporary editing scripts are removed; ignored test/build/server logs are local verification output. No source fixture, mechanic, search implementation, progression, storage migration or dependency was modified.

## Scope confirmations (items 82–89)

Battle mechanics unchanged. Player-search semantics unchanged. Narrow TAS Luck L1a unchanged. Planner progression unchanged. Planner schema v7. Simulation Report v1. No full How to Use rewrite. No commit or push.
