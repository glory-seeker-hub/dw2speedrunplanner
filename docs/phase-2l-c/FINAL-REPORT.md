# Phase 2L-C — Complete How to Use / User Guide

Implemented on `phase-2l-c-how-to-use`, starting from clean committed L4 baseline `0edbb51` (merge of `93b49e6`). No branch replacement, commit or push.

## Files and initial audit

Created:

- `src/components/help/UserGuide.tsx`: semantic guide presentation and topic navigation.
- `src/components/help/userGuideContent.ts`: operational English content and glossary.
- `tests/userGuide.test.cjs`: 53 focused content, descriptor consistency and accessibility/navigation tests.
- `docs/phase-2l-c/AUDIT.md`, this report, `guide-desktop.png`, `guide-mobile.png`: audit and browser evidence.

Modified:

- `src/components/InfoDialog.tsx`: replaces the three-step guide inside the existing dialog, wraps help tabs on mobile, updates stale adjacent mechanics copy; Credits retained.
- `src/utils/battle/battlePresentation.ts`: pure display descriptors for quality presets and thoroughness schedules/beam multipliers.
- `src/components/BattleSimulation.tsx`: consumes the identical budget preset tuples from the shared display constant. No handler or search behavior changes.

The previous guide lived in InfoDialog, accessed through the header's About this application icon. How to Use was the default dialog tab, alongside Battle Mechanics and Credits. It contained Build Your Team, Run Battle Simulations and Analyze Results. The existing modal used vertical scrolling but lacked progressive disclosure and explicit narrow-tab wrapping.

Retained useful manual-team, editable-stat/technique, enemy selection, floor specialty and results concepts. Removed the implication that manual Team Builder is the mandatory first step, unqualified complete-history wording, and stale mechanics statements that Interrupts were normal attacks and status/Assist were unimplemented. No engine discrepancy was repaired in this phase; those were obsolete help statements. See AUDIT.md for the pre-edit inventory.

## Structure and access

One guide remains in the existing entry point; no router or competing help system was added. It contains these 15 topics:

1. Getting Started / Choose Your Workflow — open.
2. Run Planner / Route and History — open.
3. Analyze Battle / Historical Team.
4. Team Builder / Manual Alternative — open.
5. Battle Simulation / Start and Cancel — open.
6. Search Method and Objectives.
7. Search Quality and Thoroughness.
8. Accuracy and RNG.
9. Reading Results / Observation vs Strategy — open.
10. TAS Luck / Supported Status Outcomes.
11. Advanced Search Concepts / Samples, Beam, Depth.
12. Exact Stats / Advanced.
13. Exports / Simulation and Route.
14. Important Limitations.
15. Quick Reference / Glossary.

Five beginner sections open by default; advanced theory, stats, limits and glossary are collapsed. The compact “Jump to a topic” disclosure is also collapsed initially, keeping the first screen actionable. Its buttons open the requested section, focus its summary and scroll it into view. State is ephemeral. No wide tables, router, hash mutation or persisted help state were introduced.

## Workflows and Planner coverage

Run Planner is the default and primary route workflow: choose/create run, record progression, Analyze Battle from Route History, simulate, read Results. Team Builder is an independent manual alternative; it is not required after Analyze Battle. The documented top-level order matches production, selected-tab meaning is explained briefly, and Results stays unavailable until a result exists. Completion opens Results automatically.

Planner content covers starter creation, multiple Saved runs, active run, browser-local persistence, roster versus Current Digiline, levels/caps/stored XP, accumulated Bits, route history and event previews/validation. Battle, Digivolve, DNA and Trade each describe the user's action and resulting roster/progression updates without formulas. Story phase/Domain/Floor selection covers 33 normal Domain variants in four groups, with 24 Coliseum battles separately. Coliseum explicitly gives 0 XP, 0 Bits, no capture and no level-up opportunity; stored XP remains stored.

Analyze Battle reconstructs the state BEFORE the selected historical battle, shows source/run/battle provenance and opens Simulator directly. Analysis does not automatically write victories or stat changes back into route history. Manual teams use Select Digimon, Customize Stats, Select Techs and Save Team; their current-session lifetime is explicitly stated.

## Simulator and search coverage

Random Monte Carlo is described as repeated configured-battle simulation using current randomized actions/continuations, not optimized search or a user-authored fixed script. Optimized Action Search explains legal round plans, candidate evaluation/retention and future decisions without claiming a full-tree enumeration.

Fastest Potential concerns one complete winning observation. Average Victory concerns the selected fair-screened prefix and winning-sample mean, not expected real-game time. Success Rate concerns observed sample success without an implied confidence interval. Common/fair worlds, candidate checkpoints, beam and prefix continuation are explained separately.

Quality presets display the unchanged 10,000 / 100,000 / 1,000,000 budgets, plus Custom. Quality is available total work; thoroughness is how aggressively that work screens and retains candidates. Standard uses 4→16→64 and existing beam/depth; Thorough prefers 8→32→128 and up to 2× beam; Maximum prefers 16→64→256 and up to 4× beam. Depth is unchanged, schedules/retention are subject to affordability, and only Maximum may use a useful, affordable fallback restart after enhanced search. Maximum does not raise the budget or guarantee an exact/global optimum or convergence.

Budget is prominently a hard ceiling, not mandatory consumption. Unused budget can mean exhausted useful work or inability to complete another valid stage. Stop reasons are explained in user language, without enum identifiers. Cancellation retains only available observations and is clearly partial.

Round Depth explicitly counts future rounds of Player decisions expanded in a prefix. The depth-4 example allows the battle to continue through rounds 5, 6, 7 and beyond. It is not battle duration, sample count, attack count or simulation round limit.

Strategy disables ordinary Hit Rate misses while retaining other modeled miss causes. Game-accurate uses ordinary Hit Rate RNG; both are separate from RNG Policy. Natural uses implemented RNG and can evaluate many seeded worlds. TAS has supported favorable direct status/recovery/Paralysis outcomes, with the only explicit branch search at an eligible Enemy normal action while BOTH Confused and Paralyzed: block with Paralysis versus allow existing Confusion behavior. Unsupported RNG stays Natural/current. TAS statistics are conditional, not natural game probabilities.

Exact stats are correctly located in the imported Planner setup after Analyze Battle. Manual teams instead use Team Builder's Customize Stats. Current resources differ from Max capacities; Planner does not track historical Current HP/MP. Simulation overrides and reset controls do not rewrite Planner progression.

## Results and exports

The guide follows Main Result → Recommended Player Actions → applicable TAS Requirements → Strategy/Search Statistics → Top Screened Strategies → Executed Battle Replay → Search Details → Technical Details.

Fastest recommendations follow the concrete retained winning trace; Average/Success recommendations follow their selected screened prefix, which may end before battle completion. Replay and TAS Requirements may belong to the retained fastest observation instead of that selected strategy. Intended Random targeting remains distinct from the observed concrete target. Top Screened Strategies are alternatives from screening, not individual fastest battles, TAS branches or every candidate.

Replay cards explain actor/technique/target, Hit/Miss/Guard, damage/healing/status and frames; expanded Action details covers MP, accuracy, recovery, reactions, support, resource alerts and effect diagnostics. Search Details explains configuration, effort, budget and stop reason; restart details matter only when fallback occurs. Timing is modeled battle-action time, excluding external menu/order-entry overhead.

Export Simulation is frozen-result Markdown with configuration/provenance, reading guidance, selected strategy, fastest observation, TAS requirements, replay and technical data. Export Route is a separate Planner route preview and Print / Save as PDF flow, with roster/Digiline/technique/reward options. Programmatic JSON is not described as a UI download; route printing is not presented as backup/import.

The 15-term glossary covers Rollout/Evaluation, Candidate, Player Round Plan, Strategy/Prefix, Screened Strategy, Fair Sample, Common RNG World, Beam, Round Depth, Fastest Route Found, Executed Battle Replay, TAS Requirement, Rollout Budget, Search Thoroughness and Pass/Restart. Evaluation means one complete candidate fair sample; TAS internal branches are not extra evaluations.

## Consistency, accessibility and browser evidence

The guide directly reuses RESULT_HELP definitions already used by Results/Markdown, plus thoroughness labels/descriptions. Budget tuples are shared with Simulator. Schedule/beam descriptors are presentation-only to avoid importing the search graph into help; tests compare them with the actual production resolver. No damage, Hit Rate, progression, ranking or budget policy is calculated by help. Existing control helper paragraphs were not expanded into duplicate guides. No obsolete Single Pass / Use Full Budget labels or generalized all-RNG TAS claims remain in the guide.

Native details/summary controls provide keyboard disclosures. Topic controls have visible text, unique controlled IDs and focus outlines. Dialog title is h2; guide topics are h3. Radix retains modal focus management; tab selection is semantic as well as colored. Mobile layouts wrap prose, flows and help tabs; topic buttons have a 40px minimum height, summaries 44px. No anchor IDs are duplicated.

Real-browser verification used the actual application at localhost:5185 and the header entry point, not a server-rendered substitute. Confirmed fresh Run Planner default, disabled Results, guide default tab, beginner content and all advanced topic destinations. Read Quality/Thoroughness, methods/objectives, Accuracy, Round Depth, narrow TAS, exact stats, exports, limits and glossary in the browser. Enter and Space closed/reopened Advanced Search Concepts, TAS and Exports. Topic navigation moved focus to its summary. Escape closed the dialog and restored focus to About this application. An unsaved Planner run-name draft survived unchanged; no run was recorded.

At 390×844 with sections expanded: document width 390, dialog client/scroll widths both 362; no horizontal overflow. At desktop 1280px: document width 1280, dialog client/scroll widths both 756. Visual review led to collapsing the topic index initially so both beginner workflows are visible sooner. Viewport override was reset. Evidence: guide-mobile.png and guide-desktop.png. These browser checks validate help interaction/content, not a new end-to-end battle/route execution; existing production-flow regression tests cover those paths.

## Verification and scope

| Check | Result |
| --- | --- |
| Full Node suite | 3,078 passed, zero failed/cancelled/skipped; baseline 3,025 + 53 guide tests |
| Final guide suite after visual/copy refinement | 53/53 passed |
| Data self-checks | 63/63 |
| Battle-skill checks | 12/12 |
| Effect coverage | 598 occurrences, 101 groups, five unused dictionary rows; existing 370 authoritative / zero used deferred baseline retained |
| Workbook --check | Passed |
| TypeScript app and node | Passed |
| Final production build | Passed; existing large-chunk warning remains |
| Lint | Same three errors / seven warnings, no new findings |
| git diff --check | Passed |

Full regression coverage includes navigation/accessibility, Planner/multiple runs/history/Analyze, manual and Planner-derived simulation, Random/Optimized and all objectives/thoroughness modes, Natural/TAS, cancellation/progress, reports/Markdown/JSON, L1a, L2 Poison and L3 data. The full suite ran before the last disclosure/copy refinements; the guide tests and final build/types were rerun afterward. Lint debt remains in ui/command.tsx, ui/textarea.tsx and tailwind.config.ts; unrelated files were not fixed.

Diff audit confirms no battle mechanics, search algorithm, policy tuning, common RNG/seeds, cancellation, Planner progression, storage or schema changes. Planner stays schema v7; Simulation Report stays v1. The Worker build artifact retains its previous hash (`battleSimulation.worker-f6ebZAaS.js`). No commit or push was performed.
