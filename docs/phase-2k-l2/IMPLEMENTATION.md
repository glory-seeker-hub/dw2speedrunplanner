# Phase 2K-L2 — Poison Power same-hit timing

## Baseline and files

Verified clean `phase-2k-l2-poison-power-timing` at `dea02e2`, containing committed `41d7c61` (final Phase 2L-B, including navigation correction). The requested branch already existed; no branch was created or switched. No commit or push performed.

Modified production file: `src/utils/battle/battleStatuses.ts`. Modified existing expectations: `tests/battleAssistsSupport.test.cjs`. Created: `tests/poisonPowerTiming.test.cjs`, this report, `poison-source-audit.json`, `verification.json`.

## Audit and root cause

The impact path in `battleSimulation.ts` first establishes action accuracy. A full Miss never enters the target-impact loop. Non-damaging Assist and Necro transfer paths bypass the damage/status helper. For each living damaging target, pre-damage support effects run, base damage is calculated, then `resolveImpactStatuses` captures existing Poison and resolves direct, activated conditional, and Power effects.

Previously the final qualification was `wasPoisoned || statusApplications.some(s => s.status === 'poison' && s.applied)`. Direct applications and the appended `condition: 'poison-power'` entry were indistinguishable to that predicate. Any newly successful Power application therefore incorrectly granted +10 on its own application hit. This was not a base damage formula or UI error.

The existing application records already carry sufficient provenance. The correction excludes `condition === 'poison-power'` from successful current-technique Poison qualification. Direct effects with no condition, activated Counter effects, and conditional Interrupt effects remain eligible. No technique-name lookup or new report field is needed.

## Canonical source audit

The accompanying JSON was generated from all decoded `BATTLE_SKILLS`, retaining raw descriptors, source bytes/masks/labels, action kind, target mode and coverage classification.

| ID | Technique | Runtime source / probability | Target | Same-hit result on previously unpoisoned target |
| --- | --- | --- | --- | --- |
| 0x01 | Poison Ivy | Direct; 1/3 Natural | One enemy | +10 only on successful direct application |
| 0x6B | Brown Stinger | Direct; 2/3 Natural | One enemy | +10 only on successful direct application |
| 0x82 | Needle Spray | Technique Poison; guaranteed when Counter activated | One enemy | +10 on activated conditional application; no native application when untriggered |
| 0xB9 | Fungus Cruncher | Poison Body Assist | Self | No damaging impact; later Body reaction poisons attacker |
| 0xBA | Rotten Rainballs | Poison Power Assist | One ally | No damaging impact; recipient's later Power application hit gets no +10 |
| 0xD7 | Poison Wave | Poison Power + Poison Body Assist | One ally | Same Power timing as Rotten Rainballs |

Poison Wave also has raw byte25/mask2 direct 66% Poison, explicitly `ignored-by-project` in existing coverage. The Assist execution path calls support effects and does not call `resolveImpactStatuses`; it does not apply that redundant direct ailment or roll its gate. Its runtime Poison comes from the granted Power on later attacks or Body reacting to opposing hits, not a direct damaging Poison Wave impact. Both descriptors and classification remain unchanged. There is no active additional direct application discrepancy.

Power is stored in `combatant.temporaryPowers.poison`; each eligible damaging Hit queries the attacker and appends a guaranteed application with `condition: 'poison-power'`, respecting existing immunity. Neither Natural nor TAS introduces a Power application draw. Power's existing recovery/lifetime is untouched.

Poison Body is stored separately in `statuses['poison-body']`. After a qualifying opposing Hit, including prevented damage, it poisons the attacker and emits the existing support event (once per action). This can make that attacker an already-poisoned target of a later impact. It does not retroactively alter the just-resolved damage. Body recovery, eligibility and reaction behavior remain unchanged; Poison itself still has no natural recovery.

## Final rule and ordering

`bonus = poisonedBeforeImpact || successfulDirectTechniquePoison ? 10 : 0`.

Existing ordering is preserved:

1. Resolve Hit/eligibility and ordinary pre-damage effects; calculate base damage once.
2. Capture the target's pre-application Poison boolean.
3. Resolve direct status gates in existing status order, updating status and recording the outcome once.
4. Resolve eligible activated Counter/Interrupt direct effects.
5. Apply active attacker Powers with the existing immediate status mutation and provenance records.
6. Qualify +10 using the captured boolean or successful non-Power Poison application. Add at the existing final bonus location.
7. Preserve special exact-HP overrides, Interrupt reduction, Invincibility, Musical Fist conversion, HP commit, MP damage, drain, post-damage support/Body, and history recording.

Thus Power status is active on the first hit and history says Poison applied, while that hit receives ordinary damage. Any later independent impact sees pre-existing Poison, regardless of applier identity or whether Power has since expired. Failed direct application gives no bonus; if Power also succeeds, target becomes Poisoned for subsequent hits. Successful direct application plus Power still gives exactly one +10. The existing two provenance records remain when both mechanisms run; the second records `alreadyActive: true`, and the boolean status never stacks.

AOE invokes the helper independently per target: the tested mixed first action has bonuses `[10, 0]`, the second `[10, 10]`. There is no canonical direct-Poison AOE in this source set. Ordinary canonical actions have one impact per resolved target; Shadow Scythe repeats are distinct queued action records after a KO and target another living opponent. The compatibility-only generic chain appends independent target impacts. Every such impact calls the same helper with that target's current state; no action-global Poison snapshot or bonus is cached.

## RNG and special mechanics

No RNG call, category or ordering changed. Controlled seeded direct tests verify exactly one existing gate and the identical next unrelated draw; Power adds zero draws. Direct TAS Enemy Poison succeeds and Player Poison is prevented according to L1a. Power remains its existing guaranteed eligible application on either side. Zero conflict opportunities/branches are verified in integration; no TAS category or search branch was added.

HP Zapper remains exact `floor(currentHP/2)` with no +10, and Critical Blow execute remains exact current HP. Musical Fist still converts the final eligible amount to healing on disadvantage. Twig Tap drains actual HP loss; MP damage still derives from final damage. Party Time's poisoned-user AP multiplier is unchanged. Invincibility and Interrupt reduction retain their existing ordering. Counter and Interrupt use the shared source-sensitive helper; activated Needle Spray still gets direct +10. Existing 761f Hit/270f Miss, restart and cancellation tests pass. A synthetic canonical-descriptor fixture covers conditional Interrupt Poison because current data has no native conditional Poison Interrupt.

## History, search and report evidence

Engine-backed smoke (no real-browser smoke claimed for this hotfix):

- Controlled helper: base 25 → first Power hit 25 with applied Poison → next hit 35.
- Real engine/search fixture: base 20 against 45 HP → first hit 20, HP45→25, Power applied → second hit 30, HP25→0, Poison bonus10.
- At 25 initial HP, the corrected first hit leaves 5 HP and requires a subsequent impact; the former erroneous 30 would have killed immediately.
- Direct Poison success on an unpoisoned target: base25→35 immediately; failure:25. Successful direct plus Power:35; failed direct plus Power:25 and Poison active afterward.

Random Monte Carlo and all three Optimized objectives retain the corrected `[20, 30]` history under Natural and TAS Luck. Search consumes the shared engine without changes to enumeration, beam, ranking, common RNG or conflict search. Canonical 2,197-plan and 4→16→64 fixtures, L1a conflict behavior and unrelated Natural seeded snapshots pass unchanged.

Immutable Simulation Report retains the corrected damage and immediate application. Existing Markdown consumes those records, JSON round-trips identically, and server-rendered ActionHistory shows 20/30 damage and Poison. No report builder, serializer or UI arithmetic changed. Report version remains 1.

## Verification

| Check | Result |
| --- | --- |
| Full Node suite | 2,952 passed, 0 failed/cancelled/skipped; 62.84 seconds |
| New focused regressions | 62 |
| Data self-checks | 61/61 |
| Battle-skill checks | 11/11 |
| Effect coverage | 598 classified / 101 groups / 370 authoritative / 0 used deferred / 5 unused rows, unchanged |
| Workbook --check | All 68 bytes, labels, effect dictionary and provenance passed |
| TypeScript app / node | Both passed |
| Production build | Passed, 7.60 seconds; existing Browserslist/large-chunk warnings |
| Lint | Existing 3 errors / 7 warnings, no new findings |
| git diff --check | Passed |

Existing Power application tests now expect zero first-impact bonus. The Invincibility/Poison-ten test explicitly starts the target Poisoned so its original prevention assertion remains meaningful. No unrelated failing assertion was deleted. The full suite includes Poison/Body/Wave, status/damage, Counter/Interrupt/Assist, special HP/MP effects, Natural/TAS, Random/Optimized objectives, Worker/progress/cancellation, reports/exports, navigation, Planner/history/multiple runs and story/Coliseum pending-XP regressions.

Lint debt remains empty interfaces in command.tsx and textarea.tsx, require import in tailwind.config.ts and existing Fast Refresh export warnings. No unrelated lint fixes were made.

## Scope confirmations

Only Poison Power's same-hit damage qualification changes. Natural direct-Poison attacks retain same-hit +10 on success. No additional mechanics, base damage formula, search, TAS conflict semantics, UI/navigation, Planner progression/persistence, story sections or Coliseum rules changed. Run Planner stays first/default, Planner schema stays v7, Report stays v1, and How to Use is untouched. No commit or push.
