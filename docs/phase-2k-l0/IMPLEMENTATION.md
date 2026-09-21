# Phase 2K-L0 — correctness hotfix

Work is on `phase-2k-l0-correctness-hotfix`. No commit or push. Three paths were characterized before runtime edits; see [audit-before.json](audit-before.json), [audit-after.json](audit-after.json) and `scripts/auditPhaseL0.cjs`. Raw workbook data is unchanged.

## Growth: actual defect and correction

The failing path is `resolveBattle` → `applyExpectedLevelUpGrowth(entry.speciesId, previousLevel, entry.stats)` → `estimateAllStatGrowth` → `getGrowthProfile(speciesId)` → SPD row lookup. Species/profile lookup was already canonical. No member ID, roster position, Digiline position, nickname, acquisition or evolution identity was used as the profile key. Source-name normalization and the `spdGrowth` field were correct; no shared profile mutation was found.

The defect was passing fractional expected SPD directly into integer source brackets. Kunemon's canonical profile has high SPD growth. At EL8 → EL9, SPD 20 resolved `1-20` and gained 3.25, but SPD 20.75 matched neither `1-20` nor `21-50` and falsely reported unavailable data. The same hole existed between 50 and 51. This is a reproduced cause of one-instance-only unavailability, not an inference that the instances share absolute stats. No user save containing the original symptom was supplied.

The SPD lookup now uses `Math.floor(currentSpeed)` as the integer source-table key. The stored expected SPD is not rounded: 20 → 23.25 and 20.75 → 24 both gain 3.25 from the same source row. Lookup normalization also consistently assigns 100.75 to the integer-100 row, with the final row beginning at integer 101. Finite-number validation excludes invalid lookup values. Missing profile/row remains unavailable, without zero/fallback growth; a missing-row diagnostic includes species, EL transition, stat, rate and SPD.

This does not change four-outcome means, addition of expected growth, simulator-boundary flooring, HP/MP new-EL lookup, ATK/DEF rank offsets, XP, one-level-per-battle limits, acquisition levels, DP, evolution, DNA or caps. Fractions such as HP 98.5 and fractional DEF increments remain intact. SPD growth remains dependent on pre-level SPD, as it was before the hotfix: same species and EL alone do not imply identical deltas across *different valid SPD brackets*. The duplicate regression deliberately uses different absolute SPD values in the same canonical bracket and verifies equal deltas, not equal final stats.

Tests exercise two independent canonical Kunemon at EL8, SPD 20 and 20.75, reversed roster/Digiline order, JSON reload, immutable profiles, independent member/sibling state and genuine missing data. A separate real recorded route captures two Kunemon in Web Domain encounter 66, progresses both through EL8 → EL9, records another battle, serializes/reloads, validates the route and reconstructs the historical pre-battle Simulator inputs. It uses production recording/replay/import with no growth test double. Both receive the same 2.5 growth at their higher SPD bracket. The Simulator continues to consume Planner progression and does not calculate growth itself.

Existing persisted checkpoints are not rewritten or migrated. Historical replay retains its strict consistency checks; a save whose recorded outcomes depended on the old missing-row behavior may require separate repair rather than silently accepting contradictory history.

## Concert Crush: source audit disproved a decoder defect

| Field | Audited value |
| --- | --- |
| Canonical identity | `0x0049` / 73, Concert Crush |
| WAZADATA source | Row 148, Etemon - Concert Crush |
| Category / target | Attack / one Enemy-relative target |
| Byte 3 | `0x51` |
| Relevant status flag | Byte 26, `0x10` |
| Skill Effects source | Row 58, Motivation Down |
| Canonical effect before and after | status-application, motivation-down, condition always |
| Other target descriptor | Byte 33, `0x01`, normal targeting |

The canonical engine already applied Motivation Down, not Confusion. The actual incorrect mapping was in `BattleResults.tsx`: its three-way display expression labeled Poison, Paralysis, and **everything else as Confusion**. It also unconditionally formatted non-TAS unconditioned applications as `roll <value>/2`, including deterministic `null` rolls. The fix uses the existing generic status label formatter, shows deterministic applications as `guaranteed on Hit`, and distinguishes universal Enemy immunity from Boss immunity. No technique-name special case, decoder override, global bit remapping or status resolver change was needed.

All related descriptor occurrences are recorded in the audit. Byte26/0x10 is Ocean Love, Concert Crush and Pretty Attack. Genuine Confusion remains Stun Bubble (byte26/0x01), Evil Charm and Sonic Crusher (0x02), and Buffalo Breath's activated Counter (0x04). No source occurrence is hidden or relabeled.

Production engine tests confirm valid Hit applies Motivation Down with `roll: null` and `successesOutOf3: null`, consuming no application RNG. Accuracy and mechanical Miss apply no status. Native guaranteed application survives TAS Favorable; existing favorable recovery remains unchanged. All Enemy-side targets, including normal/boss/boss-ally/Coliseum-role opponents, use the same universal Enemy immunity; no new encounter or boss-specific rule is added. The existing two-highest-MP blocked identities, tie RNG, lifetime, 25% natural recovery, explicit cures, Guard, legality and search behavior are reused. Pre-existing unrelated Confusion is not cleared, and genuine Confusion still draws its existing application RNG.

Results now renders `Motivation Down applied · guaranteed on Hit`, or `Motivation Down immune (Enemy) · guaranteed on Hit`. No fake/null Confusion roll is shown. Canonical history already contained the correct status and continues to do so. Report v1, Markdown and JSON retain `motivation-down` without serializer-specific technique logic. False-valued generic Confusion snapshots may still appear as audit data; they do not represent a Confusion application. Component rendering and engine-to-serializer tests cover this distinction.

## Black Pearl Shot / Trick Or Treat

| Technique | Source | Reviewed descriptors |
| --- | --- | --- |
| Black Pearl Shot `0x003D` | WAZADATA row 124, Syakomon | Byte17/0x40: user DEF ×0.5 this turn; additional byte31/0x04 remains raw unknown-bit provenance associated with the reviewed post-use rule |
| Trick Or Treat `0x0015` | WAZADATA row 44, Pumpkinmon | Byte17/0x40: user DEF ×0.5 this turn |

The shared byte17/0x40 descriptor is already generic: parameter modifier, DEF down, user, multiplier 0.5, this-turn duration. Only these two techniques use it. Both share `postUseHalfDefense`; Black Pearl's previously reviewed byte31/0x04 association remains explicitly classified without inventing a workbook label. Raw bytes and source labels are preserved. The previous project DEF=1 override is superseded; there is no backward compatibility for it.

The round-scoped boolean `halfDefense` replaces `defenseOne`. It is set at the existing post-execution boundary, after impacts and before later queued actions. Hit, ordinary accuracy Miss and executed mechanical Miss all set it. Skipped/nonexecuted actions never reach that boundary. Reapplying sets the same boolean, so it cannot compound to quarter/eighth DEF. Cleanup deletes only this temporary state; base DEF and stored persistent stage survive.

Arithmetic ordering is:

1. Exact input/base DEF (including local exact-stat overrides).
2. Existing persistent-stage multiplier, or stage zero while parameters are suppressed.
3. Existing parameter multiplier.
4. Temporary exact multiplier 0.5 when halfDefense is active.
5. Existing damage calculation: floor(effective DEF × defender specialty bonus), then floor(damage numerator / adjusted DEF).

There is no new early integer floor. For example, base DEF 67 at stage zero becomes effective DEF 33.5; with neutral defender bonus the existing denominator floor yields 33. Stages -2 through +2 and stage suppression are tested with odd base DEF. Suppression affects the persistent stage, not the independent half-DEF condition. Cleanup restores ordinary stage behavior. Base damage/AP/type/specialty arithmetic is untouched, as are its existing invalid-denominator guards.

Deterministic two-round engine fixtures place equal incoming attacks before and after the user's action. Damage before use and before use next round matches ordinary production damage; after use matches production damage with half DEF. Existing Hit/Miss/mechanical-Miss/skipped tests were updated from DEF=1 to half DEF. No RNG call or timing step was added; the effect is a post-use boolean and an effective-stat multiplier. History's existing effectAudit now says `Post-use half DEF for the remainder of this round`, automatically carried into Markdown and JSON.

## Coverage, tests and verification

The exhaustive effect report was regenerated at its existing paths `docs/phase-2k-h/effect-coverage.json` and `.md`. Before and after: **598 occurrences, 101 groups, 370 authoritative occurrences, zero used deferred occurrences, five unused dictionary rows**. Only the half-DEF handler/boundary description changes. Concert Crush and both half-DEF techniques remain authoritative.

The new `phaseL0Correctness.test.cjs` adds 45 tests. Existing `battleEffectCompletion.test.cjs` and `phaseKBattleIntegration.test.cjs` retain their lifecycle coverage with obsolete DEF=1 assertions corrected. The full suite also covers genuine Confusion, Motivation recovery/cures/Guard, Party Time poisoned-user AP ×1.5, Slamming Tusk Double SPD versus Tusk Crusher, Counter, Interrupt, Assist, exact stats, independent runs, historical reconstruction, Worker/progress/cancellation and all search modes/objectives. Search sensitivity is verified through changed incoming damage, Motivation-restricted legal orders and corrected imported SPD, without pinning a production speedrun route.

The final full suite passes **2,709/2,709**, with zero failures (49.93 seconds). See [verification.json](verification.json) for all check results. Data self-checks remain 57/57, battle-skill checks 11/11, workbook source check passes, both TypeScript projects pass, build passes with the existing chunk-size warning, `git diff --check` passes, and lint remains the baseline three errors/seven warnings with no new finding. No browser smoke was performed in L0; the rendered-component test is automated server rendering, not a claim of real-browser verification.

## Files

Created:

- `scripts/auditPhaseL0.cjs`
- `tests/phaseL0Correctness.test.cjs`
- `docs/phase-2k-l0/IMPLEMENTATION.md`, `verification.json`, `audit-before.json`, `audit-after.json`

Modified:

- `src/utils/statGrowth.ts` — fractional SPD lookup key and missing-row diagnostic.
- `src/components/BattleResults.tsx` — canonical status labels, deterministic application text and Enemy immunity label.
- `src/utils/battle/battleEffectCompletion.ts` — shared post-use half-DEF detection and cleanup.
- `src/utils/battle/battleState.ts` — temporary exact half multiplier in effective DEF.
- `src/utils/battle/battleSimulation.ts` — post-use state and audit wording.
- `src/utils/battle/battleTypes.ts` — runtime temporary-state name.
- `src/utils/battle/battleEffectCoverage.ts` — corrected authoritative description.
- `tests/battleEffectCompletion.test.cjs`, `tests/phaseKBattleIntegration.test.cjs` — obsolete DEF=1 expectations updated.
- `docs/phase-2k-h/effect-coverage.json`, `effect-coverage.md` — regenerated exhaustive report.

The decoder, raw WAZADATA, growth tables/profiles, status mechanics and Simulation Report serializers have no changes.

## Scope and future boundaries

Expected-growth mechanics were not redesigned; only the SPD row key is normalized. Damage formula is unchanged except for receiving corrected effective DEF. Random Monte Carlo architecture, canonical 2,197-plan optimized fixture, 4 → 16 → 64 fair stages, common random numbers, beam pruning, fastest elite/global fastest, Average/Success rankings and cancellation are unchanged. Results can differ for the corrected SPD inputs and half-DEF mechanics. TAS Favorable behavior is unchanged; TAS Luck outcome search is not implemented.

No story selector/grouping/Domain metadata, Coliseum encounters/rewards, general UI redesign or How to Use rewrite is included. Multiple runs stay independent. Planner schema remains v7 with no migration or persisted flags. Simulation Report stays v1: the temporary combatant field is internal engine state, not a report schema change; reports already serialize generic effectAudit/history. No report-specific mechanic code or architecture change was added. No commit or push.

## Requested final-report cross-reference

| Items | Location |
| --- | --- |
| 1–2 | Files |
| 3–11 | Growth: defect, correction, duplicate and replay fixtures |
| 12–23 | Concert Crush source audit, actual display root cause, engine/history/export tests |
| 24–36 | Half-DEF source, arithmetic, lifecycle and tests |
| 37–45 | Coverage, tests and verification |
| 46–53 | Coverage/tests; scope; report v1 and serializer regression |
| 54–63 | verification.json; explicit browser-smoke status |
| 64–74 | Scope and future boundaries |
