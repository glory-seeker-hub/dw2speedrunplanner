# Phase 2K-H implementation report

Completed on branch **phase-2k-h-assists-support-effects**, based on **e49c465** (merged Phase 2K-G1). No commit or push. Run Planner schema remains **v7**. Source workbook and canonical extracted bytes are unchanged.

**Verification: 1,613/1,613 tests; 57/57 data self-checks; 11/11 battle-skill checks; exhaustive effect coverage; workbook source check; both TypeScript checks; production build; whitespace checks.** Lint retains exactly the pre-existing 3 errors and 7 warnings.

## Files (report items 1–2)

Created:

- docs/phase-2k-h/effect-coverage.json
- docs/phase-2k-h/effect-coverage.md
- docs/phase-2k-h/performance.json
- scripts/benchmarkBattleSupport.cjs
- scripts/checkBattleEffectCoverage.cjs
- src/utils/battle/battleEffectCoverage.ts
- src/utils/battle/battleSupportEffects.ts
- tests/battleAssistsSupport.test.cjs
- tests/helpers/battleSupportFixtures.cjs
- docs/phase-2k-h/IMPLEMENTATION.md

Modified:

- src/components/BattleResults.tsx
- src/utils/battle/battleAccuracy.ts
- src/utils/battle/battleActions.ts
- src/utils/battle/battleConfusion.ts
- src/utils/battle/battleDamage.ts
- src/utils/battle/battleInput.ts
- src/utils/battle/battleInterrupts.ts
- src/utils/battle/battleLegacyEffects.ts
- src/utils/battle/battleReactions.ts
- src/utils/battle/battleRng.ts
- src/utils/battle/battleSimulation.ts
- src/utils/battle/battleState.ts
- src/utils/battle/battleStatuses.ts
- src/utils/battle/battleSupport.ts
- src/utils/battle/battleTargets.ts
- src/utils/battle/battleTiming.ts
- src/utils/battle/battleTypes.ts
- src/utils/encounterBattleSkills.ts
- tests/battleAccuracyStatus.test.cjs
- tests/battleCharacterization.test.cjs
- tests/battleCounters.test.cjs
- tests/battleEngineCore.test.cjs
- tests/battleSkillData.test.cjs
- tests/battleTimingResources.test.cjs

Ignored phase-2kh-*.log files hold local verification output. Source/importer, raw WAZADATA, persistence schema, and historical reports were not rewritten.

## Runtime and authoritative rules (items 3–50)

3. **Assist architecture:** canonical Assist joins ordinary initiative. Planning records eligibility and candidate identities. Single support targets lock before ordinary execution; AOE resolves current living recipients. Support handling is isolated in battleSupportEffects; it never invokes the damage resolver for Assist impacts. Encounter-only canonical Assists now adapt to numeric skill identities without fabricated AP10.
4. **Accuracy:** actual Assist returns guaranteed Hit without accuracy RNG. Target loss is a separate typed Miss.
5. **Paralysis:** ordinary recovery occurs first. Persistent Paralysis does not perform the failure check for a real Assist.
6. **Confusion:** recovery occurs first; surviving Confusion replaces Assist only with canonical Projectile/Magic Attack. Counter, Interrupt, physical Attack, and Assist are excluded. No eligible Attack means confusion-no-eligible-skill. Replacement uses its own targets, accuracy, Paralysis failure, effects, and MP. Original Assist pays nothing. Candidate IDs can be captured without RNG while Confusion is active; random support selection is deferred until recovery succeeds, so persistent Confusion consumes no Assist targeting draw. If the originally selected cure status recovers, the cure still executes as a paid no-op against its valid candidate.
7. **Target loss:** a dead locked Single target remains in the audit and produces assist-target-lost, no impacts, 194f, and zero MP. It is never replaced. Living already-cured/full-HP targets execute successful no-ops. AOE excludes zero-HP recipients and uses remaining living targets.
8. **Measured Assist timing:** Single 685f; AOE 1/2/3 recipients = 703/873/990f; FIELD_ALL 2/3/4/5/6 = 758/838/915/995/1071f; Miss 194f. Unsupported counts retain null timing with diagnostics. Canonical target groups determine class, including self as Single. There is no Assist prelude.
9. **Healing:** typed healing events include target, mode, requested amount, before/after HP, applied amount, and whether revival occurred. Ordinary healing requires positive current HP and clamps to maxHP.
10. **Fixed values:** Small HP Cure **0xBC +50**; HP Recovery **0xB5 +150 AOE**; Mega Heal **0xCB +150**. Full Recovery **0xCD** and Full HP Cure **0xB8 AOE** restore maxHP through explicit full-heal descriptors. No heal AP/stat formula is inferred from unresolved encoded AP.
11. **Player heal eligibility:** unrestricted by missing/low HP; full-HP heals are allowed. An empty recipient set cannot revive or invent a target.
12. **Enemy heal eligibility:** at selection, at least one same-side member must have currentHP/maxHP strictly below 0.10; KO counts as ratio zero. Exactly 10% is excluded. A previously ineligible intention cannot become selected retroactively after damage. If the policy has no eligible technique, its unavailable Assist opportunity is explicitly skipped, without a synthetic Attack.
13. **Single heal target:** lowest absolute positive current HP, then left-to-right party position. The tie-break is simulator policy, not a claimed ROM ordering. No targeting RNG.
14. **Revive:** only **0xB7 Crimson Flame** and **0xCE Hung on Death** revive to full HP. Independent descriptors still apply: Hung on Death grants Invincibility; Zombie is ignored. Existing ailments remain unless explicitly cured. A second revive whose locked target is already alive is an executed paid no-op, including secondary states.
15. **KO targeting:** only zero-HP allies with positive maxHP; one candidate consumes no RNG; multiple use revive-target-choice. Chosen identity stays locked.
16. **Revived opportunity:** revivedRound excludes the combatant's remaining ordinary, Counter, and Interrupt opportunities in that round. No queue insertion occurs. Next round resumes normal planning. Player HP0 strategic actionability remains intact outside this explicit revive rule; enemy HP0 remains KO.
17. **Cure eligibility:** both sides require an ally with a matching canonical cure status. Byte29 Poison, Paralysis, Confusion, and Motivation Down cures execute independently of parameter effects.
18. **Cure selection:** one affected living candidate consumes no RNG; multiple use assist-status-cure-target. AOE has no target-choice RNG.
19. **Cure locks:** target death produces the specific Miss; status disappearance on a living locked target produces a paid no-op. All-allies execution retains living allies as the canonical target set, with explicit no-op cure entries for unaffected recipients.
20. **Stage storage:** independent atkStage, defStage, spdStage integers; input validates range and integrality. Base stats remain unchanged. parameterModifiers is retained only for unidentified custom legacy compatibility.
21. **Multipliers:** -2 = 0.5; -1 = 1/sqrt(2); 0 = 1; +1 = sqrt(2); +2 = 2. Effective stats derive directly from underlying stat and current stage, avoiding cumulative multiplication drift.
22. **Clamp/opposition:** up/down changes the same variable by +1/-1, clamped at -2/+2. Opposite changes cancel naturally. Stages have no natural recovery.
23. **Integration:** effective ATK/DEF feed damage; effective SPD feeds accuracy/evasion and future initiative. Changing SPD does not reorder the already-built ordinary queue.
24. **Same-hit DEF Down:** persistent stage changes before this impact's damage, including +1 → 0 and clamped -2. A Miss applies no stage. Suppression keeps effective DEF at stage zero even when persistent DEF changes underneath.
25. **Parameter suppression:** reviewed numeric **0xBE Parameter Patch** and **0xE3 Reset Status** set parametersSuppressed until the next round starts. Persistent stages are preserved and may change during suppression. Suppression itself never cures ailments. **Reset Status separately has explicit byte29 cure descriptors in the workbook, so those independent cures execute and its cure eligibility applies.** The shared uncertain reset bits on Zen Recovery, Re-Format, and Re-Initialize were not extrapolated from these two named rules.
26. **Poison Power:** independent temporary state; surviving Power guarantees Poison on offensive Hit and contributes the same-hit +10 once.
27. **Paralysis Power:** independent temporary state; guaranteed application on offensive Hit, including immediate restart behavior when sourced by Interrupt.
28. **Confusion Power:** independent temporary state; guaranteed application respects boss immunity. Interrupt application is active immediately but behaviorally suppressed for the current locked restart.
29. **Power recovery:** each active Power gets exactly one nextIntExclusive(4) draw at an ordinary opportunity; 0 removes it, 1/2/3 retain it. No draw for inactive state.
30. **Power application:** no status-application probability draw; typed poison-power/paralysis-power/confusion-power source. All three coexist, remain boolean, and are not consumed by Hit or Miss. Direct/conditional status rolls remain distinct. Direct Poison plus Poison Power still yields only +10.
31. **Elemental Power:** one elementalPower value or null; offensive Attack/Counter/Interrupt damage uses it as the effective attack element without mutating canonical skill data.
32. **Overwrite:** applying a new element replaces the previous one; audit records before/after element and canonical source ID.
33. **Matchup:** the existing advantage cycle is retained: Water → Fire → Nature → Machine → Darkness → Water. Existing 0.8 disadvantage cells are also retained, not replaced with an assumed inverse-cycle table. Dark is the legacy adapter spelling for Darkness.
34. **Floor bonus:** effective element replaces native technique element for both matchup and 1.2 matching-floor bonus. Defender floor treatment is unchanged. Base damage multiplies integer fifths (4/5, 5/5, 6/5) before its existing floor; it does not duplicate a multiplier or preserve a native floor bonus after override.
35. **Poison Body:** canonical descriptor sets a distinct temporary state (Fungus Cruncher 0xB9; also present on Poison Wave). It is not Poison.
36. **Hit requirement:** opposing Attack/Counter/Interrupt Hit poisons the attacker automatically even with zero final HP damage. Miss, skip, Assist, and same-side Confusion do not trigger it.
37. **AOE/nonstacking:** one reaction event per action, regardless of how many Poison Body holders are hit. Poison remains boolean. No application RNG; ordinary exact-quarter recovery for the holder.
38. **Invincibility:** temporary boolean state with exact-quarter recovery.
39. **Damage gate:** final HP damage becomes zero after ordinary damage, Poison +10, and any Interrupt retention fraction. Audit retains the prevented damage amount.
40. **Passthrough:** Hit remains Hit. Statuses, Powers, same-hit DEF Down, and other implemented non-damage effects still apply.
41. **Counter interaction:** final zero damage cannot activate a Counter. Poison Body still reacts to that Hit.
42. **Invisibility:** canonical temporary state with exact-quarter recovery. Selection exclusion and execution forced-Miss checks are separate.
43. **Asymmetry:** Player normal Single excludes invisible enemies while another living enemy exists. If multiple enemies are all invisible, no Single candidate is available. Enemy selection may retain invisible Player targets. Ordinary Single targets are prelocked in visibility-sensitive rounds, so a later Invisibility Assist cannot silently redirect them; unrelated baseline random-at-execution targeting is retained in rounds without visibility state/source.
44. **Single:** opposing Single into an active invisible target forces action-level invisibility Miss; causal Counter/Interrupt targets stay locked. Same-side Confusion is outside the supplied opposing-side protection rule.
45. **AOE:** multi-target AOE with another living recipient ignores Invisibility, including an all-invisible enemy group. It retains one action accuracy roll and no per-impact Miss split.
46. **Sole target:** a sole invisible living target may be selected but forces the entire opposing action to Miss, including AOE. Positive current HP defines the additional living ally for this protection; a strategic HP0 Player does not disable a living ally's protection. With only strategic HP0 targets remaining, their effective target set remains available under the existing Player policy.
47. **Recovery framework:** battleStatuses owns a single ordered framework for active recoverable ailments and temporary states. Snapshots and typed recovery events expose state and exact rolls. Poison and persistent stages are excluded.
48. **Stable simulator order:** Paralysis, Confusion, Poison Body, Poison Power, Paralysis Power, Confusion Power, Elemental Power, Invincibility, Invisibility. This order is explicitly simulator policy where ROM ordering is undocumented.
49. **Interrupt executor:** no recovery of any supported temporary state; existing states immediately affect applicable execution mechanics.
50. **Interrupted restart:** initial opportunity recovers once. Restart reuses it and consumes no further recovery draw, including newly applied supported temporary states. Shadow Scythe's already-established repeat suppression is also preserved.

## Coverage, compatibility, and UI (items 51–60)

51. Zombie has **no simulator mechanics** and is ignored-by-project, not an unresolved blocker.
52. Enemy Motivation Down immunity remains in battleImmunity for both bosses and non-bosses. Exact Player-side application/behavior remains deferred. Explicit Motivation Down cure removes the boolean if present.
53. Canonical stat changes no longer execute the approximate legacy debuff handler. All promoted support effects execute through canonical handlers exactly once. Canonical skills do not acquire extra unencoded debuffs from a supplied legacy specialEffect.
54. Retained compatibility: legacy HP drain, consecutive AP/cap behavior, unidentified custom debuffs/chains, and the established base damage/legacy technique adapter. No speculative rewrite of these paths.
55. Deferred effects remain explicit: MP transfers; Increased Accuracy/general Cannot Miss; random-Digimon targeting; Motivation Down Player behavior; special death/execute/MP damage rules; status transfer; recovery restrictions; raw temporary stat multipliers; double-speed/act-last flags; unrevised isolated reset IDs; turn-wide protection; and source unknown bits. Poison Wave's direct probabilistic ailment on an Assist remains deferred while its supported Power/Poison Body descriptors execute. Assist-vs-Interrupt stays excluded by the existing scheduler; no new eligibility was inferred.
56. Machine-readable inventory: **effect-coverage.json**. Every occurrence has byte, mask, source label, decoded descriptor, canonical IDs/names, handler, status, and execution boundary. Context-dependent classifications split into distinct groups without duplicate occurrences.
57. Human-readable inventory: **effect-coverage.md**. Generator/check: node scripts/checkBattleEffectCoverage.cjs; intentional regeneration: add --write-report. New effect kinds require an exhaustive classifier decision; drift, omission, and duplicate/conflicting classification fail the check.
58. Classification totals:

| Status | Groups | Decoded occurrences |
| --- | ---: | ---: |
| authoritative | 55 | 326 |
| deferred-unresolved | 27 | 45 |
| not-applicable | 8 | 63 |
| compatibility-only | 2 | 2 |
| data-only | 7 | 161 |
| ignored-by-project | 1 | 1 |

Five additional source-dictionary rows with no decoded occurrence are explicitly listed as data-only; they are not counted among the 598 occurrences.

59. **All 598 decoded canonical occurrences are classified**, in 100 groups. No unknown descriptor is silently dropped or guessed. Fixed healing and unique reset behavior remain reviewed numeric rules; source uncertainty/raw bytes are preserved. Numeric exceptions and protected identity linking include BC/B5/CB/CD/B8 heals, B7/CE revive, BE/E3 reset, B9 Poison Body source, and D0/EA Invisibility sources; existing 4D/85 exceptions remain intact. Generic descriptor handlers cover ordinary state applications without name matching.
60. Detailed BattleResults shows heals/full heals/revives, Assist target KO, cure/no-op, stat changes, suppression, temporary state recovery/application, element overwrite/effective element, Poison Body, Invincibility prevention, and Invisibility Miss. Typed unresolved-effect diagnostics are shown. Summary cards remain compact; the prior text claiming all healing/revival was omitted is corrected. Server-rendered UI assertions cover all 12 requested support detail categories.

## Verification and measurements (items 61–70)

61. **1,613/1,613 tests pass**, including **294 new support tests** and the complete requested regression suites. Superseded Assist/debuff expectations now assert authoritative behavior; unrelated G1 behavior remains covered. The original damage snapshot file is retained, with only the explicit Scissor Claw same-hit expectation replaced in its test.
62. **57/57** data self-checks pass.
63. **11/11** battle-skill coverage checks pass.
64. Effect coverage check passes: **598 occurrences / 100 groups / 5 unused dictionary rows**.
65. Workbook --check passes at C:/Users/rafae/Downloads/DW2 Modding Info.xlsx: every 68-byte record, label, effect dictionary entry, and provenance matches. No source edit or network inference.
66. App and node TypeScript checks pass with --noEmit.
67. Production build passes: **15.42s**, JS **1,034.25 kB**, gzip **249.38 kB**. Existing Browserslist-age and large-chunk notices remain.
68. Lint is exactly the baseline: **3 errors / 7 warnings**, no new finding. Existing errors remain in ui/command.tsx, ui/textarea.tsx (empty interfaces), and tailwind.config.ts (require-style import). Existing React-refresh warnings are unchanged.
69. git diff --check and separate untracked-file whitespace checks pass. No commit/push; branch and schema remain as requested.
70. Benchmarks follow below. Commands and results are reproducible through scripts/benchmarkBattleSupport.cjs and performance.json. Seeds are mulberry32-v1, 42 + run index. Workloads are bounded to 20 rounds and intentionally remain limit-reached support stress cases; these are not victory statistics. Wall time includes history serialization. Support audit bytes compare the same history with support-specific metadata omitted; this is not a claim of measured speed or memory regression against another revision.

| Scenario | Runs | Wall ms | Mean actions | Mean records | Mean RNG draws | Mean history bytes | Support audit bytes/run |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| heal-heavy | 1 | 11.02 | 60.000 | 60.000 | 150.000 | 95060.0 | 5357.0 |
| heal-heavy | 100 | 263.32 | 60.000 | 60.000 | 150.000 | 94665.8 | 5358.7 |
| heal-heavy | 1000 | 1897.22 | 60.000 | 60.000 | 150.000 | 94652.5 | 5358.9 |
| buff-debuff | 1 | 7.25 | 60.000 | 60.000 | 133.000 | 97861.0 | 8683.0 |
| buff-debuff | 100 | 329.37 | 60.000 | 60.000 | 133.000 | 97870.6 | 8655.2 |
| buff-debuff | 1000 | 2618.35 | 60.000 | 60.000 | 133.000 | 97850.5 | 8649.6 |
| status-powers | 1 | 9.24 | 60.000 | 60.000 | 234.000 | 100035.0 | 4333.0 |
| status-powers | 100 | 834.11 | 60.000 | 60.000 | 237.200 | 99854.7 | 4332.5 |
| status-powers | 1000 | 3236.49 | 60.000 | 60.000 | 233.549 | 99505.2 | 4332.8 |
| visibility-invincibility | 1 | 5.93 | 60.000 | 60.000 | 162.000 | 90358.0 | 6048.0 |
| visibility-invincibility | 100 | 308.01 | 60.000 | 60.000 | 169.550 | 91149.9 | 6078.7 |
| visibility-invincibility | 1000 | 2820.45 | 60.000 | 60.000 | 170.415 | 91239.4 | 6077.8 |
| support-interrupt | 1 | 16.48 | 60.000 | 60.000 | 168.000 | 120460.0 | 7159.0 |
| support-interrupt | 100 | 315.24 | 59.340 | 60.000 | 161.490 | 117912.6 | 6736.3 |
| support-interrupt | 1000 | 2506.05 | 59.292 | 60.000 | 161.652 | 117913.5 | 6756.9 |

## Explicit acceptance confirmations (items 71–92)

71. Real Assist uses no normal Hit Rate RNG.
72. Persistent Paralysis does not make a real Assist Miss.
73. Persistent Confusion replaces Assist only with an eligible Attack.
74. Dead locked Single Assist target: 194f Miss, zero MP, no retarget.
75. Ordinary healing cannot revive zero HP.
76. Only Hung on Death / Crimson Flame perform reviewed full-HP revive.
77. Revived combatants receive no ordinary or reaction opportunity until next round.
78. Enemy healing requires an ally strictly below 10%; KO counts for policy only.
79. Cures are not selected without a matching status at planning.
80. Authoritative stages range exactly -2..+2 and do not drift or expire naturally.
81. Same-hit DEF Down affects that impact's damage unless effective stages are suppressed.
82. Parameter Patch / Reset Status preserve persistent stages underneath round suppression.
83. Surviving status Powers guarantee ailment after Hit without probability rolls, subject to immunity.
84. Only one Elemental Power is active; replacement is immediate.
85. Poison Body requires an opposing offensive Hit, including zero-damage Hit.
86. Invincibility blocks all final HP damage while allowing status/non-damage effects.
87. Multi-target AOE ignores Invisibility when another living effective recipient exists.
88. A sole invisible target forces the opposing action to Miss.
89. All supported temporary states suppress recovery during Interrupt execution and restart.
90. Interrupt **Hit = 76 + 685 = 761f**, **Miss = 76 + 194 = 270f**, prelude exactly once. Initial Invisibility Miss is not Interruptible; a legitimately begun Interrupt that Misses retains 270f.
91. Zombie has no execution path.
92. Every unknown/unresolved WAZADATA descriptor is explicitly classified; no mechanics were guessed for it.

## Final resolution order

Ordinary recovery → Confusion replacement/finalization → target locks/effective targets → forced counter/action restrictions → Paralysis failure → Invisibility → Tail Blade → normal one-roll accuracy (real Assist bypasses these accuracy gates). A qualifying initial Hit can enter the established Interrupt/restart path; restart performs its final restrictions/accuracy without recovery or target reselection.

After final Hit: pre-damage DEF Down → staged/effective-element base damage and existing output modifiers → direct/conditional/Power ailments → one Poison +10 → Interrupt retained-damage fraction → Invincibility final gate → HP loss → other supported on-hit stages/cures/temporary effects plus retained compatibility effects → Poison Body reaction → Counter promotion from final positive HP damage. Assist runs supported non-damage effects directly and never generates offensive Power or Poison Body reactions. Canonical MP is charged once from the final outcome.
