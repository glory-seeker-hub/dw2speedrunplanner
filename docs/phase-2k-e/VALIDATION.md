# Phase 2K-E — Accuracy, Miss and status core

Implemented on `phase-2k-e-accuracy-status-core`, from the committed Phase 2K-D baseline. Engine version: `2k-e-accuracy-status-v1`. Seeded algorithm: unchanged `mulberry32-v1`. No commit or push.

## Source decision: AOE accuracy reference

The existing target model did not have a canonical primary/reference target for all-target actions. The supplied workbook was inspected read-only through the existing extractor across its sheets; the targeted accuracy/reference search found the existing Increased Accuracy descriptor (`Skill Effects!C13`), not a primary AOE target rule. The earlier battle-mechanics Markdown file was not present at its old Downloads path.

The user then explicitly clarified in this task: **“Use the average of the targets.”** This supersedes the original request's prohibition on inventing an average without confirmation.

The implemented project rule is therefore:

**AOE uses the arithmetic average of the effective SPD of its effective valid targets at execution time.**

The average includes own-side/self targets after Confusion and zero-HP players under the strategic policy. KO enemies are excluded. A single remaining target uses that target's effective SPD. No reference is chosen from array position, fastest/slowest target or another guessed rule. There is no remaining AOE accuracy-data blocker after the user's clarification.

## Files created

| File | Responsibility |
|---|---|
| `src/utils/battle/battleAccuracy.ts` | Exact integer threshold calculation, action-level normal/Paralysis accuracy, guaranteed Assist accuracy and auditable reference metadata |
| `src/utils/battle/battleStatuses.ts` | Typed snapshots, ordered natural recovery, direct descriptor-driven application and separate Poison damage bonus |
| `src/utils/battle/battleConfusion.ts` | Canonical animation eligibility, execution-time policy filtering/reselection and own-side redirect audit |
| `tests/battleAccuracyStatus.test.cjs` | 103 accuracy/status tests, including strict programmed draw budgets, same-round effects, chains and Results rendering |
| `scripts/benchmarkBattleAccuracy.cjs` | Seeded AOE/status-heavy benchmarks and generated deferred-effect identity inventory |
| `docs/phase-2k-e/performance.json` | Wall-clock, action/record/RNG counts and serialized-history measurements |
| `docs/phase-2k-e/deferred-effects.json` | Exact canonical IDs, names and descriptors for deferred accuracy modifiers and conditional ailments |
| `docs/phase-2k-e/VALIDATION.md` | This report |

## Files modified

- `src/utils/battle/battleTypes.ts`: adds typed recovery/application/accuracy/Confusion metadata, before/after status snapshots, separate base/Poison damage and optional core-input initial statuses.
- `src/utils/battle/battleInput.ts`: validates and snapshots optional `initialStatuses` for poison/paralysis/confusion; retains future status slots and resource/identity handling.
- `src/utils/battle/battleRng.ts`: adds distinct draw categories; production adapter, seeded algorithm and loud sequence exhaustion are unchanged.
- `src/utils/battle/battleTargets.ts`: categorized confused targeting, own-side selection and prevention of the old Counter-all override undoing a Confusion redirect.
- `src/utils/battle/battleSimulation.ts`: explicit action-time recovery/finalization, one accuracy decision, Miss short circuit, on-hit statuses before final damage, and no repeat recovery inside Shadow Scythe chains.
- `src/utils/battle/battleSupport.ts`: implemented direct 33/66% ailments no longer classified as future mechanics; all other existing limitations remain.
- `src/components/BattleResults.tsx`: detailed Miss causes, recovery, Confusion redirect/skip, application results and Poison +10, preserving action-level timing and uncluttered summaries.
- `tests/battleEngineCore.test.cjs`: changes only superseded no-accuracy/no-direct-status expectations and exact draw budget.
- `tests/battleTimingResources.test.cjs`: deterministic successful-roll fixtures preserve Phase 2K-D damage/resource assertions; zero-attacker-SPD fixtures use positive SPD; Shadow Scythe draw script now includes per-execution accuracy.

No authoritative WAZADATA bytes, effect descriptors, skill identities, damage formula, frame profile, resource formulas, Counter payment rules, Planner implementation or schema were changed. Run Planner remains v7. Alias Fake remains unresolved/rejected. Existing characterization snapshots and damage expectations were not rewritten.

## Status state and action-time architecture

Runtime statuses remain independent typed flags, not one mutually exclusive ailment. Poison, Paralysis and Confusion can all coexist. Missing flags are inactive; compact record snapshots expose explicit booleans for all three. Future Poison Body, Motivation Down, Zombie, Invisibility, Invincibility and temporary-power slots remain inert.

Optional `BattleTeamMember.initialStatuses` enables deterministic core scenarios without modifying Planner or adding a status UI. Input accepts only the three supported canonical names with boolean values, copies them, and rejects unknown names/invalid values. Source Stun/Freeze/Paralysis terminology resolves through canonical WAZADATA descriptors to `paralysis`; it does not create separate ailments.

At an eligible actor's action opportunity the core:

1. Captures active statuses before recovery.
2. Rolls Paralysis recovery, then Confusion recovery, independently when active.
3. Captures the remaining statuses.
4. Finalizes Confusion candidate filtering/reselection and targeting.
5. Skips with no execution if no Confusion-eligible skill exists.
6. Resolves current target IDs and charges attempted skill MP.
7. Resolves remaining Paralysis failure, then normal accuracy if applicable.
8. On Hit only, resolves each target's direct statuses and damage/effects.
9. Finalizes the action's outcome and existing frame timing, then schedules any permitted legacy reaction or reviewed chain.

This stage runs when the actor acts, never globally at round start/end. A faster attacker can apply an ailment and the slower actor observes it during that same round. Already executed action records cannot be retroactively changed. Skipped/cancelled KO intentions do not run recovery. Automatic Shadow Scythe repeats skip the additional natural-recovery stage but use current applicable status state for their own accuracy checks.

## Exact normal accuracy

The strategic base-128 calculation is:

```text
threshold = max(128 - floor((128 * targetEffectiveSPD) / (20 * attackerEffectiveSPD)), 0)
roll = nextIntExclusive(128, 'accuracy')
Hit iff roll < threshold
```

The valid range is 0..128. Equal SPD gives **122**, 2x target SPD **116**, 5x **96**, 10x **64**, 20x **0**; zero target SPD gives **128**. Boundary tests cover roll 0, threshold-1, threshold and 127. Nonpositive/nonfinite attacker effective SPD and negative/nonfinite target effective SPD are rejected when normal accuracy is required.

Existing SPD multipliers are included for both sides using the same effective-parameter helper as initiative. Effective stats can be fractional. Their runtime decimal representations are converted into exact rational integers using BigInt, and the division floors once. For AOE, the rational target sum is divided by target count inside that calculation; it is not rounded into a displayed average before the threshold is computed. The record's numeric average is only audit/display metadata. This prevents overflow from arbitrary intermediate floating multiplication and avoids an average-rounding boundary error. It is a strategic formula implementation, not a claim to reproduce PSX RNG or fixed-point internals.

Accuracy belongs to the action. Single uses its execution target; AOE computes one average-reference threshold and draws **one** accuracy roll. All effective targets share the Hit/Miss result. A full Miss retains the effective target IDs and has **empty impacts**, with no successful/zero-damage Hit rows. Mixed normal AOE Hit/Miss outcomes are not produced.

## Paralysis and Assist readiness

Each active Paralysis/Confusion natural-recovery check is an exact `nextIntExclusive(4)`: **0 recovers; 1, 2, 3 remain**. Poison has no recovery roll, no automatic cure and no round cleanup clearing.

If Paralysis remains on a non-Assist offensive action, `nextIntExclusive(2, 'paralysis-failure')` is independent of normal accuracy: **0 passes; 1 fails**. A failed pre-check produces an executed Miss caused by Paralysis, costs 194f, pays normal attempted MP and consumes no normal accuracy or on-hit application draw. A passed pre-check proceeds to a separate base-128 roll; if that roll fails, the cause is `normal-accuracy`, with the passed Paralysis roll retained in the audit.

The accuracy helper guarantees Assist Hit without either Paralysis-failure or accuracy draws. Natural recovery still precedes it; failed recovery leaves Paralysis active. Actual Assist execution remains unsupported, with no speculative cure/heal/buff/power effects, MP payment or success duration. The production core can record the structural guaranteed-accuracy result before returning the existing unsupported-Assist outcome.

## Poison and direct ailment application

The resolver consumes canonical decoded `status-application` descriptors with `condition: always`, status poison/paralysis/confusion, and chance 33 or 66. It does not re-read scattered raw-byte masks or compare technique names.

Source 33 means exactly **1/3**, implemented as roll 0 on `nextIntExclusive(3)`. Source 66 means exactly **2/3**, implemented as roll 0 or 1. On a successful impact the stable status order is **Poison, Paralysis, Confusion**, with separate rolls for each applicable descriptor. An already active status still consumes its application roll and records whether the application succeeded redundantly; it remains a boolean and cannot stack.

Direct offensive identities currently include Poison Ivy (0x01), Brown Stinger (0x6B), Stun Flame Shot (0x0F), E-Stun Blast (0x69), Transcend Sword (0xE4), Stun Bubble (0x3E), Evil Charm (0x42) and Sonic Crusher (0x45). Full Assist execution remains deferred even where an Assist contains direct descriptors, such as Poison Wave.

The existing compatible damage formula remains `baseDamage`. Before HP loss is committed, application results determine whether the target was Poisoned before the impact or successfully becomes Poisoned now. Either condition gives exactly **10** bonus damage on this successful offensive damage path. It never becomes +20 for existing plus reapplied Poison. The flat bonus is added after base rounding, including when the base formula rounds to zero. `baseDamage`, `poisonBonusDamage` and final `damage` are separately recorded.

Poison bonus participates in KO/depletion normally. Enemy KO removes eligibility; Player zero HP remains active and receives the existing transition alert. Poison has no end-of-turn tick. Misses bypass the entire impact stage, so they receive no base damage, no +10, no status applications, no legacy on-hit effects and no damaging-hit Counter trigger.

Conditional Counter/Interrupt ailments, temporary status powers, Poison Body and cure effects are not mistaken for direct application and consume no application rolls here. The generated [deferred-effects.json](deferred-effects.json) lists their exact identities/descriptors.

## Confusion selection and targeting

The pure eligibility helper reads canonical `animationKind` and `actionKind`: normal offensive **Attack + Projectile/Magic** is eligible, **Physical** is not. Unknown/custom identities are not guessed to be non-melee. Counter/Interrupt/Assist eligibility is not broadly invented.

Twig Tap is explicitly verified as **0x47, byte3 0x52, Attack/Physical** and is excluded under persistent Confusion. Shadow Scythe is likewise Physical. Renaming their display strings does not change eligibility. Rock Fist is canonically Projectile despite its name and remains eligible; tests deliberately confirm that behavior rather than inferring melee from its name.

Round intentions and initiative are still planned normally. At action time, persistent Confusion filters the actor's candidates to eligible normal offensive techniques, then invokes the configured/default selection policy over that set with a separate categorized RNG wrapper. Ineligible techniques receive no probability in this execution-time selection. A custom policy that returns an ineligible candidate is explicitly unsupported, not silently allowed.

If the eligible set is empty, the action is recorded `skipped` with reason `confusion-no-eligible-skill`, no targets, no damage/status effects, no MP charge, no Miss accuracy, no 194f and no new synthetic Basic Attack. This preserves the existing non-executed-intention timing convention: duration stays null and no invented skip time is added to totals.

Persistent Confusion always redirects normal offensive execution to the actor's own side. Single selects one eligible own-side target randomly, **including self**. AOE includes all eligible own-side targets, **including self**, preserving multiplicity. Zero-HP players remain included, while KO enemy allies are excluded. The existing Counter-all target override cannot undo that redirect. Recovery restores normal planned behavior and enemy-side targets.

Redirected attacks retain normal accuracy, damage and on-hit effects. Self targeting uses self effective SPD. Poison/Paralysis/Confusion applications and compatible parameter changes can affect the actor. Already supported legacy effects are not replaced by a stripped-down confusion damage path. The DEF-down self-hit regression uses an explicitly supplied legacy effect on an eligible canonical projectile because the current natural DEF-down legacy example is Physical and must itself be excluded.

Executed confused attacks, including self hits and AOE, pay MP once under Phase 2K-D rules. They can create ordinary MP/HP depletion notices. Confusion does not remove recovery costs from the audit or insert omitted Guard/items. Confusion changes side/selection, not the measured successful animation class: Single Hit 685f, AOE Hit by effective count, Miss 194f. Existing genuinely unmeasured classifications remain unknown.

## RNG order, records and short circuits

Round choice/initiative draws retain their order. At each action opportunity:

1. `status-recovery-paralysis`, if active and not an automatic repeat.
2. `status-recovery-confusion`, if active and not an automatic repeat.
3. `confusion-action-choice`, if persistent Confusion finalizes an eligible choice.
4. `confusion-target` for redirected Single, otherwise existing `target-choice` where needed. AOE selection itself draws nothing.
5. `paralysis-failure`, if Paralysis remains and action is offensive.
6. `accuracy`, unless guaranteed Assist or failed Paralysis.
7. For each successful effective impact, `status-apply-poison`, `status-apply-paralysis`, `status-apply-confusion` as descriptors require.

No placeholder future RNG draws occur. Poison recovery never draws. Misses never draw applications. Confusion skips never draw targeting, failure, accuracy or applications. Programmed RNG exhaustion remains a propagated error; strict tests prove exact one-hit and chain draw budgets.

Typed `AccuracyResolution` stores outcome/cause, threshold, roll, optional Paralysis roll and reference rule/SPD/identity. `StatusRecoveryResult` and `StatusApplicationResult` preserve discrete rolls and results. `ConfusionResolution` stores whether active/redirected/skipped, planned and selected skill keys, eligible keys and original target intent. Action records store three-boolean before/after-recovery snapshots rather than duplicating a combatant object. Impact records store application audit and Poison bonus separately.

## Shadow Scythe and legacy reaction boundaries

The reviewed 0x4D chain remains numeric-ID based, immediate, within the same round, with a separate deterministic action record and `chainFromActionId` for every execution. Normal Hit+KO can continue. A normal-accuracy or Paralysis Miss costs 194f, has no KO and stops. Initial MP remains 20; automatic repeats cost no additional MP.

Natural recovery occurs once before the initial opportunity. Repeats inherit the resulting runtime status state, do not rerun recovery or consume a new action-choice draw, but perform their own applicable Paralysis/normal accuracy checks. Tests show an initial 685f Hit+KO followed by a 194f Miss totals 879f, and prove no additional recovery draw. Persistent Confusion excludes Physical Shadow Scythe; recovered Confusion permits the normal chain.

Authoritative Counter scheduling, damage, targeting, payment and evasion were not rewritten. The existing offensive compatibility path now receives generic action-time recovery, applicable Confusion handling, Paralysis pre-check and normal accuracy, plus Poisoned-target bonus and any unconditional direct descriptors that qualify. Conditional Counter/Interrupt ailments remain excluded. A missed incoming attack does not schedule the old damaging-hit reaction. Confused Counter/Interrupt opportunities can select a known eligible normal Attack if available; otherwise they skip rather than inventing special confusion eligibility. All this is explicitly compatibility behavior, not authoritative Counter/Interrupt correctness. Existing causal reaction fields remain separate from chain links.

Custom noncanonical `chainOnKill` compatibility remains a legacy multi-impact path with unknown measured timing; it is not promoted into the canonical Shadow Scythe exception or a new general engine rule.

## Results and intentionally deferred behavior

BattleResults details now show **Hit**, **Miss — Accuracy**, **Miss — Paralysis**, recovery/remains results, Confusion redirect/reselection or skip, and per-impact application audit plus **Poison +10**. MP/depletion information and authoritative frames remain at action level. Summary cards are unchanged. Server-render tests exercise real core records for all these labels without relying on arbitrary internal display strings as mechanics.

Still deferred: authoritative Counter rewrite, conditional Counter ailments and evasion, Interrupt scheduling/cancellation/damage reduction/forced Miss/act-last/conditional Paralysis, full Assists and cure Assists, temporary status powers, Motivation Down, Poison Body, Zombie, Invisibility, Invincibility, and unresolved accuracy modifiers. No guessed Increased Accuracy multiplier, Can't Miss behavior or Counter evasion chance was applied. Exact affected identities are listed below and in the generated JSON.

Player HP/MP policy, enemy KO, free chain MP, frame table and Guard exclusion remain intact. No seed UI or Planner integration was added. Intended trajectory changes are normal Misses, direct ailments/recovery, Poison bonus, Confusion friendly fire/skip and resulting timing distributions. Existing base damage arithmetic/rounding remains unchanged. All original characterization damage prefixes still pass using controlled successful rolls.

## Verification

| Check | Result |
|---|---|
| Complete test suite | **1,055 / 1,055 passed**, no failures/skips/cancellations |
| New accuracy/status tests | **103 / 103 passed** |
| Characterization/core/timing-resource regressions | **156 / 156 passed** |
| Data/Planner/hardening/rank/export/theme regressions | **796 / 796 passed** |
| Data self-checks | **57 / 57 passed** |
| Battle-skill coverage check | Passed; source/identity coverage unchanged |
| Workbook source `--check` | Passed at original Downloads path; all 68 bytes, labels, effect dictionary and provenance match |
| App TypeScript | Passed |
| Node TypeScript | Passed |
| Production build | Passed, 1,842 modules, 10.27 seconds |
| Lint | **3 errors / 7 warnings**, unchanged baseline; no new findings |
| Diff/whitespace | Checked before delivery, including new files |

Build retains existing old-Browserslist and large-chunk warnings. Existing lint errors remain the unrelated UI empty interfaces and Tailwind require, with seven existing component-export warnings. No build/dependency configuration changes were made. Build used the same approved parent-directory read access esbuild required in earlier phases.

Commands:

```text
node --test tests/battleCharacterization.test.cjs tests/battleEngineCore.test.cjs tests/battleTimingResources.test.cjs tests/battleAccuracyStatus.test.cjs tests/battleSkillData.test.cjs tests/runPlanner.test.cjs tests/runPlannerHardening.test.cjs tests/rankLearning.test.cjs tests/routeExport.test.cjs tests/theme.test.cjs
node scripts/checkBattleSkills.cjs
python scripts/importBattleSkills.py "C:\Users\rafae\Downloads\DW2 Modding Info.xlsx" --check
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.node.json
npm run build
npm run lint
node scripts/benchmarkBattleAccuracy.cjs
git diff --check
```

The source check used the bundled Python executable. All 57 self-checks were invoked through the existing TypeScript test loader. Local verification logs use the ignored `phase-2ke-` prefix.

## Performance

Seed 42, counts run in order after module load, core runs with categorized RNG observation. These are single host samples, not controlled microbenchmarks. Each batch completed successfully; no optimization was introduced.

| Fixture | Runs | Wall-clock ms | Avg executed actions | Avg records | Total RNG draws |
|---|---:|---:|---:|---:|---:|
| Existing AOE | 1 | 9.843 | 21 | 24 | 84 |
| Existing AOE | 100 | 60.701 | 21.600 | 24.600 | 8,625 |
| Existing AOE | 1,000 | 323.899 | 21.556 | 24.556 | 86,085 |
| Status-heavy | 1 | 1.339 | 6 | 6 | 39 |
| Status-heavy | 100 | 36.463 | 17.140 | 17.800 | 10,536 |
| Status-heavy | 1,000 | 268.741 | 18.012 | 18.740 | 110,939 |

The status-heavy fixture combines Poison/Paralysis initial state, Confusion, and direct Poison/Paralysis/Confusion techniques. Its 1,000 runs consumed 15,230 accuracy draws for 18,012 executions because failed Paralysis checks correctly short-circuit normal accuracy. Complete per-category counts are in [performance.json](performance.json).

The representative first serialized action history is 34,130 bytes for the AOE fixture and 9,314 bytes for the status-heavy fixture. The added compact status/accuracy audit increases history size without copying entire combatants. Phase 2K-D's earlier 1,000-run AOE public-batch sample was 115.244ms; this phase's observed core sample is 323.899ms with additional accuracy/record work and changed trajectories. Harness, JIT/GC and host load differ, so that comparison is indicative rather than a controlled regression ratio. Same seeds reproduce histories/outcomes within this engine version; different seeds yield different choices, misses, applications, recoveries and timing distributions.

## Final confirmations

- AOE performs one normal accuracy resolution, never independent rolls per impact.
- AOE target SPD is the user-confirmed average of effective valid target SPDs.
- Persistent Confusion never executes a normal enemy-side offensive Attack; selection/redirect or explicit skip occurs at action time.
- Physical filtering uses canonical animation kind, not name/element/species/AP guesses.
- Poison receives no natural-recovery roll, ordinary cure or periodic tick.
- Same-hit and subsequent-hit Poison bonus are separately auditable and never stack above +10 per successful offensive impact.
- Assists were not broadly implemented; their guaranteed accuracy and Paralysis immunity are structural readiness only.
- No unresolved accuracy modifier, Counter evasion probability or new frame value was guessed.
- No Planner schema change, Guard action, commit or push.

## Exact deferred accuracy/status identities

The following tables are generated from the unchanged canonical descriptors, not handwritten mechanics overrides.

### Can't Miss (unimplemented; potentially defunct)

| ID | Technique | Kind |
|---|---|---|
| 0x34 | Tusk Crusher | attack |
| 0xA4 | Venom Infusion | interrupt |
| 0xA6 | MP Magic | interrupt |
| 0xA7 | Life Shield | interrupt |
| 0xA8 | MP Destroyer | interrupt |
| 0xB4 | Hyper Flashing | assist |
| 0xB5 | HP Recovery | assist |
| 0xB6 | Virus Attack | assist |
| 0xB7 | Crimson Flame | assist |
| 0xB8 | Full HP Cure | assist |
| 0xB9 | Fungus Cruncher | assist |
| 0xBA | Rotten Rainballs | assist |
| 0xBB | Banana Slip | assist |
| 0xBC | Small HP Cure | assist |
| 0xBD | Defensive Ray | assist |
| 0xBE | Parameter Patch | assist |
| 0xBF | Zip Boom | assist |
| 0xC0 | Stun Ray | assist |
| 0xC1 | Armor Coating | assist |
| 0xC2 | Mech Ray | assist |
| 0xC3 | Blaze Blaster | assist |
| 0xC4 | Nature Hit Ray | assist |
| 0xC5 | Invincibility | assist |
| 0xC6 | Re-Format | assist |
| 0xC7 | Recovery Power | assist |
| 0xC8 | AntiDote | assist |
| 0xC9 | AntiFreeze | assist |
| 0xCA | AntiConfusion | assist |
| 0xCB | Mega Heal | assist |
| 0xCC | Zen Recovery | assist |
| 0xCD | Full Recovery | assist |
| 0xCE | Hung on Death | assist |
| 0xD0 | Invisibility | assist |
| 0xD1 | Water Ray | assist |
| 0xD2 | Necro Magic | assist |
| 0xD3 | Darkness Ray | assist |
| 0xD4 | Re-Initialize | assist |
| 0xD5 | Panic Wave | assist |
| 0xD6 | Heart Break Hit | assist |
| 0xD7 | Poison Wave | assist |
| 0xDE | Kongou | assist |
| 0xE3 | Reset Status | assist |
| 0xE6 | abc? Unused? | assist |
| 0xE7 | Safety Sphere | assist |
| 0xEA | Alias Fake (?) | assist |
| 0xEF | Armor Aid | assist |
| 0xF7 | Reduction Ray | assist |
| 0xF9 | Destablizer Ray | assist |

### Increased Accuracy (magnitude unresolved)

| ID | Technique | Kind |
|---|---|---|
| 0x66 | Protect Grenade | attack |

### Counter evasion (magnitude unresolved)

| ID | Technique | Kind |
|---|---|---|
| 0x85 | Tail Blade | counter |

### Conditional ailments (Counter/Interrupt activation deferred)

| ID | Technique | Kind |
|---|---|---|
| 0x82 | Needle Spray | counter |
| 0x84 | Thunder Ball | counter |
| 0x8C | Buffalo Breath | counter |
| 0xED | Stun Punch | counter |
