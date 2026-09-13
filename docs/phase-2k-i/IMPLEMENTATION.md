# Phase 2K-I — Historical pre-battle integration

Implemented on phase-2k-i-planner-to-battle-simulator, based on the committed Phase 2K-H baseline. No commit or push. Run Planner schema remains v7.

## Files

Created:
- src/utils/runPlanner/runPlannerReplay.ts — pure forward reconstruction and typed diagnostics.
- src/utils/runPlanner/runBattleAnalysis.ts — strict historical Player/Enemy adapters and detached preset.
- src/utils/battle/battleEncounter.ts — shared encounter conversion.
- tests/helpers/plannerAnalysisFixtures.cjs — real Planner recording fixtures.
- tests/plannerBattleAnalysis.test.cjs — 101 replay/adapter/engine integration checks.
- tests/plannerBattleNavigation.test.cjs — 13 production component-handler checks.
- scripts/benchmarkPlannerBattleAnalysis.cjs — reproducible replay benchmark.
- docs/phase-2k-i/performance.json and this report.

Modified:
- src/components/run-planner/RunHistory.tsx — Battle-only Analyze action.
- src/components/run-planner/RunPlanner.tsx — analysis callback and error display.
- src/pages/Index.tsx — in-memory handoff, tab navigation, fresh analysis revisions, source invalidation.
- src/components/BattleSimulation.tsx — imported teams, provenance banner, resource disclosure/edit/reset, manual setup.
- src/utils/battle/battleInput.ts — shared encounter adapter and validated optional current MP input.
- src/utils/battle/battleTypes.ts — optional runtime currentMp (no persisted schema change).
- tests/battleEngineCore.test.cjs and tests/battleSkillData.test.cjs — adjust existing React state fixtures for the new preset state; assertions retained.

## Reconstruction and exactness

reconstructRunStateBeforeEvent(run, eventIdOrIndex) is the canonical path. The first persisted pre-action checkpoint anchors initial state and is checked against the recorded starter. It forwards actions through the existing deriveActionPostState reducer, after validating recorded event data. Battle, Digivolve, DNA and Trade use the same progression helpers as normal Planner validation. No combat simulation, randomness, generated IDs, clocks or storage are involved.

For selected full-history index N, only actions 0 through N-1 are resolved. At N, the reconstructed roster and Bits are cross-checked with N's checkpoint, recorded party order is loaded, and replay stops before the selected action's reducer or reward processing. Later action payloads and current/final roster, Digiline, Bits and timestamps never supply historical progression. Event ID uniqueness is checked to reject ambiguous selection.

Schema v7 has an important limitation: manual Digiline additions/removals/reordering are not action events. Their historical record is the next action's preActionCheckpoint.digiline. Consequently checkpoints have two explicit roles: initial-state/party-selection evidence, and validation of replayed roster/Bits. They never silently replace conflicting replayed progression. Invalid checkpoints or disagreement block analysis. Historical accuracy means the recorded Planner expected-growth model; it does not claim to recover actual console stat rolls.

The Player team is exactly the ordered historical active Digiline (1–3 unique instances), excluding reserves. Both instanceId and plannerDigimonInstanceId survive. Species is resolved by historical speciesId; level, DP, resolved/ranged levelCap, source and accumulated stats come from replay. Stats use the existing floor-at-simulator-boundary conversion. Already learned techniques retain their recorded order and receive explicit numeric canonicalSkillId values; pending/discarded future techniques are excluded.

Enemy identity comes exclusively from the selected Battle's domainId, phase, floor and encounterId. The shared adapter preserves encounter slot order, level, stat values and technique order; species lookup uses reviewed aliases. Boss flags use explicit DOMAIN_GROUPS metadata, never XP/Bits. No M-Tyrannomon/MetalTyrannomon alias was added.

## Handoff and interface

PlannerBattleAnalysisPreset carries source run/event/full-history index/encounter identity, selected location, a compact historical summary, detached Player/Enemy teams and diagnostics. It contains no RunPlan, history, storage handle or callback into progression.

Analyze Battle is shown only on Battle rows and selects the existing Battle Simulation tab. Both imported teams are selected automatically. The banner says “Analyzing pre-battle state” and shows domain, phase, floor, encounter and action position. Repeated Analyze reconstructs a fresh preset and remounts Simulator state. Missing source runs/events invalidate the preset. Selection is scoped by both run ID and event ID.

The simulator owns a cloned copy. Current HP/MP can be edited locally without changing historical maximum stats. Reset imported team restores the original imported copy. Use manual setup clears provenance and restores ordinary saved-team/encounter selection. Simulation results use the existing Results tab and never record rewards, learning, capture or progression. Existing tab unmounting means returning from Results recreates the imported setup from its original preset.

Planner does not persist current battle HP/MP, statuses, stages or temporary Powers. The initial simulation therefore uses full historical maximum HP/MP, no statuses, neutral stages and no temporary Powers. The resource limitation is a visible informational warning. Floor specialty remains an explicitly local simulation setting. There is no inferred cross-battle attrition.

## Diagnostics and mechanics boundary

Blocking diagnostics: historical-event-replay-failed, checkpoint-mismatch, selected-event-not-battle, empty-historical-digiline, missing-historical-instance, unresolved-player-species, unresolved-player-technique, unresolved-encounter, unresolved-enemy-species, unresolved-enemy-skill. Messages identify the offending event/location/species/technique where applicable.

Informational diagnostics: planner-resource-history-unavailable and canonical-effect-unresolved. Canonical skills with deferred effects remain canonical and retain Phase H diagnostics; they are not replaced. Missing required core data still blocks: Fantasmic Ray has no authoritative element or existing compatibility mapping and is an explicit example. Such a route can be reconstructed historically even when its selected encounter cannot be opened for simulation.

The strict Player adapter rejects mappings that would invoke synthetic Basic Attack. The existing manual simulator fallback remains available. Attack, Counter, Interrupt, Assist, accuracy, statuses, damage and timing resolvers were not changed. The only battle-input extension is an optional validated currentMp override, matching the existing currentHp facility. Interrupt Hit remains 761 frames and Miss remains 270 frames. No new mechanic was guessed.

## Worked historical example

In tests/fixtures/route-long.json, action index 35 (human action 36, event route-fixture-000053) is Battle A. Its active instance route-fixture-000030 is Vademon, level 21, DP 1, cap 28, with Alien Ray only. Its pre-battle HP/MP/ATK/DEF/SPD are 204/200/73/80/61, and Bits are 138010.

Battle A grants 4468 XP and 5600 Bits. Before Battle B at index 36, the same instance is level 22 and has Alien Ray, Blaze Blast, Pit Pelter and Zen Recovery. Planner stats are 207.5/204/77.25/83.75/62; the Player adapter supplies 207/204/77/83/62. The earlier analysis keeps level 21 and does not receive any of A's learning or growth. This is a replay/Player-mapping example; that fixture's encounter can independently be blocked by unresolved Enemy core data.

Capture tests separately prove that a capture is absent before its own Battle, exists in later roster state, and becomes a later Player member only after a recorded historical party addition. Real mixed-route boundaries verify normal evolution, DNA and Trade produce their recorded later identities/caps without leaking backward.

## Verification

- Full existing and new suite: 1725/1725 passed. Two additional checks were then added; the updated 101-test analysis suite passed in full, giving 1727 distinct passing tests overall (1613 baseline + 114 new). No skipped tests.
- Coverage includes storage/migration, recording, undo/checkpoints, Digivolve, DNA, Trade, growth, rank learning, exports, all battle phases, identity isolation, mutation/RNG guards, production navigation handlers, local resource edits/reset and simulation handoff.
- Data self-checks: 57/57.
- Battle-skill checks: 11/11.
- Phase H effect coverage: 598 occurrences, 100 groups, 5 unused dictionary rows; exhaustive and unchanged.
- Workbook source --check: passed at C:/Users/rafae/Downloads/DW2 Modding Info.xlsx, including all 68 bytes, labels, effect dictionary and provenance.
- Both TypeScript projects: passed.
- Production build: passed; existing large-chunk warning remains.
- Lint: existing 3 errors / 7 warnings, no new finding. Unrelated baseline debt untouched.
- git diff --check: passed; new files checked for trailing whitespace separately.
- No browser screenshot acceptance run; UI evidence is production component-handler tests plus the production build.

## Performance

Node v24.20.0; five warm measurements, median, real recorded Boot Domain battles. Fixture generation is outside timed work. Each request performs fresh replay; no cache. The final measurement was made after regression processes completed. Total preset construction and component timings are independent samples, so their medians need not sum.

| Events | Replayed | Replay ms | Player mapping ms | Enemy mapping ms | Complete preset ms | Preset bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | 9 | 1.733 | 0.1 | 0.059 | 2.284 | 2130 |
| 100 | 99 | 6.222 | 0.093 | 0.135 | 8.209 | 2134 |
| 500 | 499 | 18.255 | 0.085 | 0.084 | 16.63 | 2137 |

These benchmark routes have one starter; large roster sizes and more complicated mixed events can cost more. A 220-event mixed route is additionally cross-validated by tests. The current measurements do not justify a cache or more complex invalidation machinery. Reproduce with node scripts/benchmarkPlannerBattleAnalysis.cjs.

## Requested boundary confirmations

Selected Battle progression is excluded; all prior progression is included; later progression is excluded. Battle A uses its old level, while Battle B uses A's completed progression. Selected captures are absent, prior captures join analysis only when historically active. Later evolution/DNA/Trade cannot leak backward. Historical analysis never uses the final Digiline or current BattleSelector. Opening, running and resetting Simulator cannot mutate Planner. Preset generation consumes no combat RNG. Manual setup remains available. Canonical unresolved effects are diagnostic and unchanged. Schema v7 and persistence remain unchanged. No new Attack/Counter/Interrupt/Assist mechanics, no guessed timing, no commit and no push.
