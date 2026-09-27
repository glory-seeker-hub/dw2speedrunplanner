# Final navigation-order correction

Completed on the existing `phase-2l-b-ui-navigation-results` branch. No new branch, commit or push.

## Files (final-report items 1–2)

This correction modifies `src/pages/Index.tsx`, `tests/theme.test.cjs`, and `tests/plannerBattleNavigation.test.cjs`. It creates `tests/navigationOrder.test.cjs` (12 regressions) and this report. Other working-tree changes belong to the previously completed Phase 2L-B implementation.

## Navigation and active state (3–14)

Old order: Team Builder → Battle Simulation → Results → Run Planner. New DOM and visual order: Run Planner → Team Builder → Battle Simulation → Results.

The initial state source is `useState<string>('run-planner')` in Index, previously `team-builder`. State remains ephemeral. No effect, initial flicker, storage field, router or migration was added.

Production navigation already used stable semantic IDs; no numeric-index navigation needed correction. An existing theme test assumed Results at position 2: it now finds tabs by label. The existing failed-Analyze test now expects the new initial Planner tab. The new order regression explicitly checks all four positions.

The shared Tabs component and CSS are unchanged. Yellow border/text/background remains controlled by `data-state="active"`; Run Planner is active only initially or when selected. Browser computed styles confirmed the yellow text moves to Team Builder, Battle Simulation and Results, with the other top-level tabs inactive. Radix `aria-selected`, focus and disabled semantics remain intact. Results stays disabled until a result exists.

## Introductory copy (15–18)

Old heading: “Plan the route. Build the team. Test the battle.”

Old explanation: “Run Planner tracks your roster and route. Team Builder prepares simulation teams; Battle Simulation tests them and Results shows the outcome.”

New heading: “Plan the route. Analyze the battle. Optimize the result.”

New explanation: “Use Run Planner to build and track your route, or Team Builder for a manual battle setup. Battle Simulation tests the selected team and Results shows the recommended strategy.”

The primary route workflow and independent manual alternative are explicit. The subtitle, labels and existing icons are unchanged.

## Transitions (19–24)

- Analyze directly selects `battle-simulation` with the exact historical preset and readable provenance; no Team Builder intermediate step.
- Back to Run Planner selects `run-planner`. Back to Simulator setup selects `battle-simulation`.
- Go to Battle is an existing in-Planner `#run-battle` anchor, not a top-level tab command; its target and behavior are preserved and browser-verified.
- Manual flow remains Team Builder → Save Team → select Battle Simulation → select the saved team → simulate. Saving a team does not automatically change tabs, matching existing behavior.
- Completion selects `results`, now the fourth tab. Initial availability and stale-result clearing are unchanged.
- Use manual setup clears the imported preset and historical banner while remaining in Battle Simulation. Source/run/event invalidation and manual report source retain their existing semantics.

## Accessibility and responsive results (25–29)

DOM order matches visual order. The existing four-column desktop/two-column narrow grid is unchanged. Keyboard ArrowRight from Run Planner selected and focused Team Builder in the real browser. Selection remains represented through `aria-selected`, `data-state`, font weight and underline as well as color.

At a 390×844 viewport, effective document clientWidth and scrollWidth both measured 380px. Run Planner/Team Builder occupied the first row, Battle Simulation/Results the second. Screenshot and computed state confirmed the active Planner treatment; switching to Team Builder moved that treatment. The viewport override was reset afterward. A separate narrow Results run was not repeated for this correction; Results selection was verified in the normal viewport and existing responsive presentation tests passed.

## Regression and verification (30–47)

| Check | Result |
| --- | --- |
| Full Node suite | 2,890 passed, 0 failed/cancelled/skipped; 73.69 seconds |
| New navigation regressions | 12 passed |
| Data self-checks | 61/61, included in full suite |
| Battle-skill checks | 11/11 |
| Effect coverage | 598 occurrences, 101 groups, 370 authoritative, 0 used deferred, 5 unused dictionary rows; unchanged |
| Workbook --check | Passed: all 68 bytes, labels, effect dictionary and provenance |
| TypeScript app | Passed |
| TypeScript node | Passed |
| Production build | Passed, 9.98 seconds; existing Browserslist/chunk warnings |
| Lint | Unchanged 3 errors / 7 warnings; no new findings |
| git diff --check | Passed |

The full suite covers Planner, multiple saved runs, history, story/Coliseum, Analyze, Team Builder, manual/historical Simulator, Results, Random/Optimized, Natural/TAS, cancellation/progress, Markdown/JSON/export and presentation. No mechanics assertions were removed. Lint failures remain the preexisting empty interfaces in command.tsx/textarea.tsx and require import in tailwind.config.ts.

Browser smoke used the existing local `Phase 2L-B smoke` run without recording or modifying any Planner action:

1. Fresh page selected Run Planner and displayed the saved run and its two recorded battles. Results was disabled.
2. ArrowRight and click selected Team Builder. A manual Agumon with Terra Force was saved into ephemeral team state, selected in Battle Simulation and run against encounter 154 with Random/Natural/Strategy and 10 samples.
3. Completion selected the fourth Results tab: 10 samples, 100% success, 2,142.9 average frames and 2,055 fastest frames. Source read “Manual Simulator setup”. Only Results had the active yellow treatment.
4. Returning to Planner showed the unchanged saved route. After resuming the session, Go to Battle updated the fragment to `#run-battle`; Analyze on action 1 opened Battle Simulation directly with `Run Planner › Boot Domain · Floor 1 · Before Blood Knights`, encounter 154 and historical source.
5. Back to Run Planner selected the first tab. Narrow viewport order, overflow and dynamic selection were checked as described above.
6. Use manual setup removed the historical banner and return action while keeping Battle Simulation selected.

No-run initial landing is covered by real-component server rendering: existing starter/create controls are visible, no run is automatically created, and input data is unchanged. No separate empty-storage browser session or second Planner-derived simulation was claimed for this correction. The prior Phase 2L-B report documents historical simulations.

## Scope (48–56)

No Results hierarchy redesign, report Markdown/JSON change, mechanics change, search change, TAS Luck change, Planner progression change, persistence change, story/Coliseum change or How to Use rewrite. Planner schema remains v7; Simulation Report remains v1. No commit or push.
