# Phase 2J-A — Story Segments and Coliseum Battles

Implemented on phase-2j-a-story-segments-coliseum, starting at committed merge 2f8ed77 (Phase 2K-L1 commit 448a101). The requested branch already existed at that exact baseline and was clean. No branch switch, commit or push was performed.

## Selector and progression audit (final-report items 3–5)

The old selector uses DOMAIN_PHASES/DomainPhase from src/types/encounter.ts (two values), with English labels hard-coded in BattleSelector.tsx. getDomainsForPhase in runBattleSelection.ts filters DOMAINS by variant.phase. DOMAINS is built from the generated DOMAIN_GROUPS in src/data/domainGroups.ts, retaining first-seen order. It groups by stable domainId and phase, never by parsing display names. There are 26 domain IDs and 33 domain/phase variants: the seven revisited Domains share IDs with their original versions. File Island labels in this source are Power, Port, etc. DVD is tagged before-blood-knights in the legacy source, despite belonging to the new After Blood Knights presentation section.

Domain/floor lookup filters DOMAIN_GROUPS and deduplicates encounter IDs. Canonical enemy stats/techniques come from encounters.ts. RewardMatching supplies verified XP/Bits separately. BattleRecordControls calls recordRunBattle, which rechecks location, capture and reward eligibility, stores a checkpoint and creates a single battle event. Boss location metadata suppresses normal capture. resolveBattle awards each eligible participant full XP, resolves at most one level, applies expected growth and learning, adds Bits and optionally recruits a reserve Digimon. Zero XP alone does not prevent a pending stored-XP level.

RunBattleEvent stores stable encounter/location fields, reward snapshots, participant IDs, technique audits and a pre-action checkpoint. isValidRunEvent validates event shape and audits; deriveActionPostState replays authoritative transitions for validation and historical reconstruction. reconstructRunStateBeforeEvent forward-replays preceding events and validates checkpoint continuity. historicalEnemyTeam calls the shared recording lookup then encounterToBattleTeam, while Player data comes from the exact historical roster and expected stats. Undo restores the checkpoint. Storage remains multiple isolated v7 runs.

## Central story metadata and allocation (items 6–12)

src/data/storySegments.ts defines the typed StorySegment, the five ordered labels and the normal Domain assignments. The UI consumes this single list. The presentation segment is separate from the legacy domainId/phase identity; selecting DVD therefore still records its original canonical identity. Switching sections clears dependent selections. No alphabetical sorting is used.

| Section | Ordered Domains | Count |
| --- | --- | --- |
| Before Blood Knights | Boot Domain; SCSI Domain; Disk Domain; Video Domain; BIOS Domain; Web Domain; Drive Domain; Modem Domain | 8 |
| After Blood Knights | SCSI Domain 2; Disk Domain 2; Video Domain 2; BIOS Domain 2; Web Domain 2; Drive Domain 2; Modem Domain 2; DVD Domain; Code Domain; Laser Domain | 10 |
| File Island | Power Domain; Port Domain; Giga Domain; Scan Domain; Diode Domain; Patch Domain; Mega Domain; Data Domain; Soft Domain | 9 |
| After File Island | Bug Domain; RAM Domain; ROM Domain; Core Tower; Chaos Tower; Tera Domain | 6 |

Total: 33 playable variants, zero duplicates, zero unassigned, zero unknown assignments. File Island retains the existing shorter display labels (Power, Port, etc.). story-segments.json contains all canonical IDs and legacy phases. EXCLUDED_PLANNER_DOMAINS is explicitly empty: the runtime canonical DOMAIN_GROUPS has no developer/test Modem dungeon or other extra playable entry. A future extra canonical domain produces a failed completeness self-check rather than silently being assigned.

## Coliseum metadata, mapping and canonical content (items 13–18)

src/data/coliseumBattles.ts owns the typed category/rank/round/label metadata. Runtime callers look up entries in that metadata; no scattered numeric range or name-prefix tests implement policy. Canonical enemy definitions are reused, not duplicated. The selector offers 24 individual choices directly, without a Domain or floor step. Normal encounter browsing excludes these classified encounters; the canonical source currently has no overlap.

| Rank | A | B | C |
| --- | --- | --- | --- |
| 2 | 158 | 159 | 160 |
| 3 | 161 | 162 | 163 |
| 4 | 164 | 165 | 166 |
| 5 | 167 | 168 | 169 |
| 6 | 170 | 171 | 172 |
| 7 | 173 | 174 | 175 |
| 8 | 176 | 177 | 178 |
| 9 | 179 | 180 | 181 |

Every label is Rank N-A/B/C. Validation checks exactly 24 entries, consecutive IDs 158–181, ranks 2–9, A/B/C order, unique labels/IDs and one canonical encounter per ID. coliseum-audit.json includes all lineups and techniques as an audit export, not runtime enemy definitions.

Representative exact lineups verified:

- 158 / Rank 2-A: Patamon, ToyAgumon, Gizamon.
- 163 / Rank 3-C: Gabumon, Raremon, Penguinmon.
- 168 / Rank 5-B: Woodmon, Bakemon, Soulmon.
- 169 / Rank 5-C: Centarumon, Tyrannomon, Monochromon.
- 174 / Rank 7-B: Lillymon, Angewomon, Etemon.
- 175 / Rank 7-C: Myotismon, Phantomon, Megadramon.
- 177 / Rank 8-B: Deramon, Blossomon, Pumpkinmon.
- 181 / Rank 9-C: Magnadramon, Jijimon, MarineAngemon.

All 24 analyzed teams are tested against canonical species, exact enemy stats and canonical technique IDs. This includes Twig Tap, Necro Magic, Evil Touch, Concert Crush, Shadow Scythe, Trick Or Treat, MP Destroyer and Black Pearl Shot. Existing skill-name normalization is respected (e.g. Rain Of Pollen / Rain of Pollen).

## Explicit no-progression policy (items 19–30)

battleProgressionPolicy.ts provides normal versus coliseum policy with resolveLevelUp and allowCapture. getPlannerBattleReward returns authoritative zero XP/zero Bits for Coliseum without modifying canonical enemy/reward data. resolveBattle consumes the policy before any call to getBattleTechniqueChoices or getBattleTechniqueProgression. The Coliseum branch returns the exact cloned roster, unchanged Bits, zero numeric rewards, empty technique audits/misses, unchanged participant outcomes and null growth. It never enters XP application, level resolution, cap resolution or technique learning. It rejects capture requests at both recording and resolution boundaries.

Zero rewards alone are insufficient: ordinary progression checks accumulated XP even after adding zero. The early policy branch instead suppresses the entire level opportunity. No XP is spent, deleted, clamped or marked consumed. Three consecutive Coliseum events preserve the same XP, level, stats, cap, roster, DP, DNA, acquisition, trade state and techniques. A later normal encounter resumes the unchanged one-level-per-battle logic, retaining excess XP. No synthetic level-up event is emitted.

The focused tests cover pending XP earned from a real normal reward; three A/B/C events; a later normal reward; a three-member party with pending and non-pending XP; a level-10 technique milestone; and a capped participant. The roster equality assertion includes every stat, technique and cap field. Unresolved cap resolution is not needed for Coliseum because no advancement occurs; normal cap rules are unchanged. Learning warnings and technique-review controls are suppressed for Coliseum.

## Events, persistence, history and exports (items 31–43)

Each A/B/C selection creates exactly one normal battle event. It does not auto-insert other rounds. Event identity, checkpoints, participants and encounter ID remain separate for every battle. Undo, saved-run isolation, JSON round trips, forward replay and middle-event Analyze Battle are covered by the new route fixture and existing suites.

Planner schema remains v7. No field or discriminant was added to persisted events; no migration is needed. Existing mandatory location fields encode Coliseum as domainId=coliseum, legacy phase=after-blood-knights and floor=0. This is a compatibility sentinel only, centrally declared in COLISEUM_LOCATION; it is never registered as a dungeon in DOMAINS and never requires a Domain/floor selection. Validation requires both this encoding and a canonical Coliseum encounter. It rejects forged normal locations, rewards, captures or technique audits for Coliseum. Old ordinary events retain their canonical identity and progression, including DVD. Pre-feature clients are not expected to understand newly recorded Coliseum events.

getPlannerBattleLabel derives section/Domain or Coliseum/rank labels from stable identity. Run History, route export, Analyze Battle and the immutable Simulation Report use it. The route shows individual Coliseum ranks, canonical enemies, participants and explicit 0 XP / 0 Bits / No level-up; no fake growth or reward text is emitted. Report v1 uses its existing battle.label and frozen selectedBattle fields; Markdown avoids displaying the compatibility Domain/floor for Coliseum. Report version remains 1.

Analyze Battle uses the unchanged canonical enemy adapter and historical Player conversion. Natural and TAS Luck run normally. Only report/analysis labels changed in Simulator files; no combat rule, RNG branching, status immunity, motivation semantics, search objective, damage or performance behavior changed.

## Tests and verification (items 44–60)

39 new tests in storyColiseum.test.cjs cover metadata, representative lineups, all 24 recording/analysis paths, no capture, no rewards, pending XP, A/B/C independence, later normal advancement, multi-party/cap/technique preservation, undo, isolation, v7 serialization, replay, route export, selector resets and Natural/TAS Luck Report v1 integration. Existing selector/Planner/normal capture/growth/learning/one-level/old storage/analysis/override/Simulator/Monte Carlo/optimized objective/report/Markdown/JSON/L0/L1 suites are included in the full run. Two existing assertions were updated for the four added self-checks and the new human-readable Analyze label.

See verification.json for final counts and commands. Lint debt is unchanged and is not fixed in this phase. Workbook --check compares the supplied DW2 Modding Info.xlsx with the complete canonical generated source.

### Real browser smoke

Performed in the Codex in-app browser at http://127.0.0.1:5173. Created a dedicated Phase 2J-A Smoke run without altering the existing Phase 2L-A Smoke route. All requested steps 1–18 were performed: opened battle selection; verified all five segments; inspected each complete ordered normal Domain list; inspected all 24 Coliseum entries; selected and recorded individual ranks; confirmed no capture control; checked readable event labels, zero rewards and stored-XP level suppression; analyzed a middle battle and its correct enemies; completed a short simulation; switched runs and back; confirmed isolation.

Concrete UI fixture: a normal Chaos Tower floor-20 encounter 152 awarded 4,468 XP and 5,600 Bits, advancing Agumon from EL1 to EL2 only. Before Coliseum: 4,468 total XP, 6,630 Bits, HP41 / MP41.5 / ATK32 / DEF34.25 / SPD12, Pepper Breath. Recorded Rank 2-A, 2-B and 2-C separately; each kept the same level, XP and Bits. Rank 2-B Analyze loaded historical Agumon EL2 with floored expected stats and Crabmon/Tapirmon/Kunemon (60 HP/MP, 40 ATK/DEF, 35 SPD). Natural Random Monte Carlo completed 10/10 simulations. TAS Luck Optimized Action Search completed early after 5,204 of its 100,000 default budget at depth 6. No custom combat mechanics were used. Switching to the prior run showed its original one event and 1,310 Bits; switching back restored the four-event Coliseum fixture and 6,630 Bits. Reload also retained the fixture.

Browser scope limits: individual browser simulations were not run for all 24 ranks; that full mapping is tested programmatically. Route export, Undo and later normal progression were verified by automated tests, not browser clicks. No claim of browser export-download testing is made. An earlier browser attempt was interrupted by usage-limit approval review; it was completed after the user resumed the task.

## Scope and file inventory (items 1–2, 61–67)

Planner v7 and Simulation Report v1 retained. Battle mechanics and TAS Luck semantics unchanged. No broad UI redesign; How to Use unchanged. No commit or push.

Created:

- src/data/storySegments.ts
- src/data/coliseumBattles.ts
- src/utils/battleProgressionPolicy.ts
- src/utils/plannerBattleLabel.ts
- tests/storyColiseum.test.cjs
- docs/phase-2j-a/IMPLEMENTATION.md
- docs/phase-2j-a/story-segments.json
- docs/phase-2j-a/coliseum-audit.json
- docs/phase-2j-a/verification.json

Modified:

- src/components/run-planner/BattleSelector.tsx
- src/components/run-planner/BattleRecordControls.tsx
- src/components/run-planner/RunHistory.tsx
- src/components/BattleSimulation.tsx (source label only)
- src/utils/runBattleSelection.ts
- src/utils/runBattleRecording.ts
- src/utils/runProgression.ts
- src/utils/runEventValidation.ts
- src/utils/runTransitionValidation.ts
- src/utils/battleLearningWarnings.ts
- src/utils/dataSelfChecks.ts
- src/utils/routeDocument.ts
- src/utils/battle/battleSimulationReport.ts (source label only)
- src/utils/battle/battleSimulationReportSerialization.ts (Coliseum provenance presentation only)
- tests/runPlanner.test.cjs (self-check count)
- tests/plannerBattleNavigation.test.cjs (human-readable source label)

Local ignored verification logs use the phase-2ja prefix and are not source deliverables. The pre-existing VALIDATION.md records an older unrelated use of this phase name and was left unchanged.
