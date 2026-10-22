# Phase 2P-A empirical damage update

## Scope and starting state

Branch: `phase-2p-a-damage-formula-validation`. Starting HEAD and original baseline:
`7300cf9583ad3b34a673065e2086fd7071f59a0f`.
The six existing local Phase 2P-A files were preserved. They already removed
the premature offensive/AP floor, introduced the 128/180/256/362/512 stage
table, and added arithmetic regressions. The starting suite passed 3,420 tests.
No commit, push, merge, deployment, schema, UI, canonical data or search-policy
change is part of this update.

## Audit and corrected calculation

`battleState.ts:effectiveParameter/applyParameterStage` previously applied
362/256 at +1 to every parameter. ATK and DEF now use 384/256 (3/2) at +1;
+2 remains 512/256. SPD retains the prior Phase 2P-A table. ATK negative
stages also retain that prior model. Every nonzero stage floors directly from
the base, and zero preserves the base value (including Planner fractions).
Suppression selects stage zero without erasing the stored stage. Independent
legacy modifiers and halfDefense remain after canonical stage resolution.

`battleDamage.ts:calculateLegacyDamage` previously kept type inside the full
offensive numerator, with no ATK/type truncation. It now performs:

1. Resolve canonical ATK from the base and stage, then existing compatibility modifiers.
2. Floor effective ATK; multiply by type numerator 4, 5 or 6, divide by 5, and floor again.
3. Multiply that integer by AP (fractional values retained), specialty, existing offensive tile, and existing pre-formula AP ratio.
4. Resolve DEF stages and compatibility modifiers; apply existing defender tile and floor before division.
5. Divide the full offensive product by adjusted DEF and floor final base damage.
6. Leave the existing Counter/output, retained Interrupt, Poison and Invincibility boundaries in place.

In notation, with S = specialty, O = offensive tile, T = type, R = AP ratio:

```
Previous local Phase 2P-A:
floor(AP * effectiveATK * T * S * O * R / floor(effectiveDEF * defenderTile))

Corrected:
typeATK = floor(floor(effectiveATK) * typeNumerator / 5)
adjustedDEF = floor(effectiveDEF * defenderTileNumerator / 5)
damage = floor(AP * typeATK * S * O * R / adjustedDEF)
```

Specialty and offensive tile use integer fifth-based numerators in the product.
The original pre-Phase-2P-A formula additionally floored the AP/offensive product;
that obsolete floor remains removed. Runtime numbers still use JavaScript Number,
not arbitrary-precision arithmetic for arbitrary oversized inputs.

`battleSupportEffects.ts` already applies canonical DEF Down before damage and
other stage changes at their established phase; no timing edit was needed.
`battleSimulation.ts` calls that pre-damage resolver before the shared damage
function and the after-damage resolver afterward. `battleLegacyEffects.ts`
continues to handle unidentified compatibility debuffs independently.
The decoder reads parameter descriptors from byte 22 and normalizes AP in
half-point units. `battleSkillCompatibility.ts`, `battleSkills.ts`, and
`wazaSource.ts` require no modification.

Scissor Claw ID 70 and Duo Scissor Claw ID 81 retain raw AP 40 / displayed AP 20.
Fire Blast ID 111 retains raw AP 35 / displayed AP 17.5. No name-based arithmetic
or technique workaround was introduced; renamed canonical claw tests pass.

## Empirical results

All following supplied observations pass in `battleDamageEmpirical.test.cjs`.
Expected values are hardcoded from the supplied BizHawk 2.11.1 observations.

Armor followed by type, Party Time AP 20, DEF 20:

| Base ATK | One Armor, type advantage | Result |
|---:|---:|---|
| 124 | 223 | PASS |
| 125 | 224 | PASS |

Party Time ATK 132, AP 20 (columns are Armor stacks 0 / 1 / 2):

| DEF | Type advantage | Damage | Result |
|---:|---|---|---|
| 24 | No | 110 / 165 / 220 | PASS |
| 24 | Yes | 131 / 197 / 263 | PASS |
| 55 | Yes | 57 / 86 / 114 | PASS |
| 60 | Yes | 52 / 79 / 105 | PASS |

Fire Blast ATK 120, AP 17.5, DEF 56, one advantage, Armor 0 / 1 / 2:
**45 / 67 / 90 — PASS**, checked for type-only and specialty-only advantage.

DEF Down (columns are original DEF / one down / two downs):

| Original | One | Two | Result |
|---:|---:|---:|---|
| 100 | 70 | 50 | PASS |
| 101 | 71 | 50 | PASS |
| 102 | 71 | 51 | PASS |
| 103 | 72 | 51 | PASS |
| 104 | 73 | 52 | PASS |
| 105 | 73 | 52 | PASS |
| 106 | 74 | 53 | PASS |
| 107 | 75 | 53 | PASS |
| 108 | 75 | 54 | PASS |
| 109 | 76 | 54 | PASS |
| 110 | 77 | 55 | PASS |
| 111 | 78 | 55 | PASS |
| 112 | 78 | 56 | PASS |
| 128 | 90 | 64 | PASS |
| 132 | 92 | 66 | PASS |
| 150 | 105 | 75 | PASS |
| 155 | 108 | 77 | PASS |

Defensive Ray:

| Original DEF | One Ray | Two Rays | Result |
|---:|---:|---:|---|
| 60 | 90 | 120 | PASS |
| 52 | 78 | 104 | PASS |
| 55 | 82 | 110 | PASS |

Both Scissor Claw and Duo Scissor Claw, ATK 120:

| Original DEF | Prior down | Damage | DEF after hit | Result |
|---:|---:|---:|---:|---|
| 132 | 0 | 26 | 92 | PASS both |
| 132 | 1 | 36 | 66 | PASS both |
| 132 | 2 | 36 | 66 | PASS both |
| 100 | 0 | 34 | 70 | PASS both |
| 100 | 1 | 48 | 50 | PASS both |
| 100 | 2 | 48 | 50 | PASS both |

Fire Blast ATK 120 / AP 17.5:

| Matchup | DEF | Prior down | Damage | Result |
|---|---:|---:|---:|---|
| Neutral | 100 | 0 | 21 | PASS |
| Neutral | 103 | 0 | 20 | PASS |
| Neutral | 132 | 0 | 15 | PASS |
| Neutral | 56 | 0 | 37 | PASS |
| Neutral | 132 | 1 | 22 | PASS |
| Neutral | 132 | 2 | 31 | PASS |
| Specialty only | 100 | 0 | 25 | PASS |
| Specialty only | 100 | 1 | 36 | PASS |
| Specialty only | 100 | 2 | 50 | PASS |
| Type + specialty | 55 | 0 | 54 | PASS |
| Type + specialty | 56 | 0 | 54 | PASS |
| Type + specialty | 57 | 0 | 53 | PASS |

Additional integration regressions pass: six-round Armor/Party sequence gives
197/263/263; a three-enemy Duo sequence gives 26/48/36 then 36/48/36, with
independent persistent stages, followed by Fire Blast 31/42/31. A synthetic
disadvantage compatibility case gives 129 with type disadvantage and 103 with
both disadvantages; these are model regressions, not new experimental evidence.

## Existing tests and consumer impact

No characterization snapshot file was regenerated or changed. This update
changes +1 ATK/DEF test expectations from 28 to 30 at base 20, from 186 to 198
at base 132, from 94 to 100 at base 67, and from 95 to 101 at base 67.5.
SPD expectations and ATK negative expectations remain unchanged.

Earlier local Phase 2P-A test edits are retained: fractional-AP MP-damage output
44 became 45 (MP loss still floors half damage), and Counter ID 134 target
expectations retain AP 32.5 rather than flooring it to 32 (observed differences
included 23 to 24 untriggered and 57 to 58 activated). Those were already present
at the start of this update. No new Counter or status resolution rule was added.

Simulation/search entry points continue through `simulateBattleCore` and
`calculateActionDamage`: compatibility batches, randomized and TAS sampling,
optimized action-plan replay, and retained fastest-route records share the
same engine. Reports/export consumers retain those computed histories. Damage,
KO timing and consequently selected routes can change; search strategies,
RNG policy, timing constants, storage formats and ranking code are untouched.

## Evidence limits

- Validated by supplied observations: positive ATK and DEF 1.5x/2x, the ordered
  ATK/type floors, fractional AP, listed neutral-terrain damage results, and
  same-hit canonical DEF Down.
- DEF -1 = 180/256 is an empirical fit consistent with the supplied data, not
  an assembly-level finding. DEF -2 uses half base with a floor.
- ATK debuffs and SPD stages retain the preceding local Phase 2P-A model;
  this experiment set does not validate them.
- Terrain placement is preserved, not newly established. Its interaction with
  the ATK/type boundaries needs dedicated experiments.
- Stage-zero fractional Planner stats remain stored/effective fractions;
  damage now floors effective ATK before type even at stage zero. This is the
  implementation extension of the integer game model, not an observed PS1
  fractional-stat behavior. Legacy modifier composition is also compatibility.
- No claim is made that the game's exact assembly arithmetic is established.

## Validation and working tree

- Starting local baseline: `node --test tests/*.test.cjs` — 3,420 passed, zero failed.
- Battle suites after update: `node --test tests/battle*.test.cjs` — 1,126 passed, zero failed (including 64 new dedicated tests).
- Final complete suite: `node --test --test-concurrency=2 tests/*.test.cjs` — 3,484 passed, zero failed, cancelled or skipped.
- `npx tsc -p tsconfig.app.json --noEmit` and `npx tsc -p tsconfig.node.json --noEmit` — both exit 0.
- `npm run build` — passed; existing Browserslist-age and chunk-size warnings remain.
- `npm run lint` — same baseline 3 errors and 7 warnings in unchanged UI/config files, no new findings.
- `git diff --check` — passed.

Verification was not uniformly clean on the first attempt: the first complete
post-update run reported a TAS cancellation assertion and failure of the
simulation-techniques test file; a serial retry reported failure of the TAS
search-integration file. The capture suite (45 tests) and TAS integration suite
(29 tests) passed in isolated retries. The final complete run at concurrency 2
passed all 3,484 tests without code or test changes to those suites. The cause
of the intermittent execution failures was not established; it is not claimed
to be a proven arithmetic regression or a diagnosed environment fault.

Files changed relative to HEAD (existing local work included):

- `src/utils/battle/battleDamage.ts` — shared arithmetic.
- `src/utils/battle/battleState.ts` — stat-aware stages.
- `tests/battleAssistsSupport.test.cjs` — stage expectations and helper signature.
- `tests/battleDamageArithmetic.test.cjs` — prior local suite, +1 ATK/DEF expectations updated.
- `tests/battleDamageEmpirical.test.cjs` — 64 dedicated empirical/integration tests.
- `tests/battleEffectCompletion.test.cjs` — earlier local fractional-AP expectation, preserved.
- `tests/phase2nbTargeting.test.cjs` — earlier local fractional-AP Counter expectation, preserved.
- `docs/phase-2p-a-empirical-damage.md` — this report.

Git status: five tracked files modified, three new files untracked (the two
damage test suites and this report). No changes are staged; HEAD remains the
starting commit on the existing branch. Canonical WAZADATA and all other data
files have no diff.
