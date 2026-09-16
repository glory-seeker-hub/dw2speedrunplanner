# Phase 2K-K final correction report

Branch: `phase-2k-k-battle-effect-completion`. No branch created, commit, or push.

## Gameplay corrections

- **Slamming Tusk 0x006E** is the confirmed Double SPD technique. The earlier Tusk Crusher name was a user naming mistake, now resolved. **Tusk Crusher 0x0034** has no such flag or identity exception. Existing queue-only SPD tests remain; stored/effective SPD and the Hit Rate formula remain unchanged.
- **HP Zapper 0x00E1, byte21/0x02:** on Hit, replaces ordinary damage with `floor(pre-impact current HP / 2)`. AP, ATK, DEF, type, floor, tiles and Poison +10 do not modify it. It bypasses ordinary Interrupt damage scaling because the rule defines an exact HP amount. It still passes through the existing universal Invincibility prevention and shared HP commit boundary. Independent on-Hit statuses remain source-driven. Miss has no impact. Ordinary targeting, accuracy, cost and timing remain.
- **Critical Blow 0x00E2, byte21/0x08:** tests `currentHp * 10 <= maxHp` before its own impact. At/below the threshold its HP amount is current HP; above it the ordinary damage path runs. No same-hit post-damage execute, floating percentage, or new boss immunity. Exact execute bypasses ordinary damage scaling/Poison, retaining universal Invincibility prevention. Player strategic HP0 behavior remains.
- **Musical Fist 0x0050, byte18/0x02:** uses exported `getTypeBonus` from the existing central damage matrix. Advantage directions Vaccine→Virus, Virus→Data and Data→Vaccine deal ordinary damage; disadvantage directions Vaccine→Data, Virus→Vaccine and Data→Virus heal. Same-type relations damage. The existing full damage pipeline computes the would-be amount once, including its existing reduction/prevention gates; disadvantage adds it to target HP capped at Max HP. Hit is required. It remains an Attack with unchanged canonical random targeting, timing, payment, interruption and legal-plan enumeration. History records healing explicitly, with zero damaging impact so healing cannot activate a Counter.
- **Demi Dart 0x003C / Evil Touch 0x0041, byte21/0x20 and 0x40:** MP loss is `floor(finalHpDamage / 2)`, clamped at zero MP, independently per impact. The established final damage field is retained (post-reduction/prevention, not clamped for target HP overkill). No additional time or RNG; old odd-rounding diagnostics are removed through authoritative coverage.
- **Banana Slip 0x00BB, byte31/0x20:** each actual recipient's current-round Counter moves from `waiting` to `prevented` only while its action is waiting and unactivated. The scheduler cannot promote it, and execution records a skipped Counter with reason `counter-prevented-by-banana-slip`, no payment or invented duration. Activated, shared-trigger-promoted, resolved and ordinary actions are unchanged. New rounds create fresh actions, so no prevention state carries over. The turn-wide Interrupt interpretation is explicitly ignored as broken. Its separate byte17/0x02 skill-scoped Can't Be Interrupted flag is preserved. Later Interrupt opportunities, Hit 761f and Miss 270f remain unchanged.
- **Twig Tap 0x0047, byte19/0x08:** a canonical-data audit found exactly **one used occurrence: Twig Tap**. The shared HP commit calculates `actualHpDamage = max(0, hpBefore - hpAfter)`. Canonical HP drain heals that amount, capped at user Max HP. Overkill 35 against HP20 heals20; HP1 heals at most1; Miss, Invincibility and already-HP0 Player targets heal0. No new timing or RNG. The projected legacy healOnDamage effect no longer double-applies for canonical skills.

## Source and compatibility boundaries

Raw workbook labels, all 68-byte records and source identities are unchanged. Critical Blow's old fixed-60 description and Demi/Evil's random-range descriptions remain preserved as source provenance while confirmed project rules drive simulation.

The original pre-implementation source audit remains intact. `coverage-changes.json` records changes from that original baseline; the table below isolates this correction's baseline.

| Metric | Before correction | After correction |
| --- | ---: | ---: |
| Decoded occurrences | 598 | 598 |
| Descriptor groups | 101 | 101 |
| Authoritative occurrences | 363 | 370 |
| Used deferred occurrences | 7 | 0 |
| Ignored occurrences | 5 | 6 |
| Compatibility occurrences | 2 | 1 |
| Data-only occurrences | 161 | 161 |
| Not applicable | 60 | 60 |
| Unused dictionary rows | 5 | 5 |

The seven deferred occurrences close as six authoritative occurrences and one ignored broken Interrupt occurrence. Twig Tap separately moves from compatibility to authoritative. Unused dictionary entries remain data-only. `RESIDUAL_UNRESOLVED.md` starts with zero used deferred occurrences and retains all unused, deprecated, data-only and ignored provenance.

Consecutive-use AP/cap behavior is unchanged and remains compatibility-only. The distinct unidentified custom-technique path (`canonicalSkillId=null` with `healOnDamage`) retains calculated-damage compatibility semantics; it is not the canonical Twig Tap mechanic.

## Files in this correction

Modified runtime: `battleActions.ts`, `battleDamage.ts`, `battleEffectCoverage.ts`, `battleLegacyEffects.ts`, `battleSimulation.ts`, `battleSupportEffects.ts`, `battleTypes.ts` in `src/utils/battle/`.

Modified tests: `tests/battleEffectCompletion.test.cjs`, `tests/battleAssistsSupport.test.cjs` replace the obsolete unresolved expectations. Created: `tests/phaseKFinalClosure.test.cjs` (72 focused tests).

Modified reporting: `scripts/reportPhaseK.cjs`; regenerated `docs/phase-2k-h/effect-coverage.json` and `.md`; updated Phase K implementation, residual, coverage, verification, performance and file-inventory artifacts. Created this `FINAL_CORRECTION.md` report. `files-changed.txt` inventories all uncommitted Phase K files, including the earlier implementation.

## Verification and invariants

Final exact results are in `verification.json`. The complete suite covers Random Monte Carlo and Optimized Search, frozen seeded fixtures, all three objectives, Worker/cancellation, Counter/Interrupt/Assist, Planner/history/multiple runs, exact-stat overrides and Phase K behavior. New deterministic cases demonstrate HP Zapper execution-time HP, Critical Blow earlier KO/skip, Musical Fist healing, Banana Slip suppression versus an activated baseline, and actual-loss lifesteal. All nine species-type relations, threshold boundaries, no extra RNG, next-round Counter renewal, and canonical source coverage are characterized.

No objective, search enumeration rule, Worker protocol, React-specific mechanic or ordinary damage formula was changed. Both search methods consume the shared battle simulation and existing frozen BattleInput. Fastest Potential, Average Victory and Success Rate semantics remain unchanged. Existing TAS rules and the reviewed Motivation 100% application are preserved. Party Time, Motivation Down, Trick Or Treat and Slamming Tusk regressions remain in the full suite, as do Tail Blade, Pummel, V-Nova/Transcend and the other completed Phase K rules.

Run Planner, multiple saved runs and schema v7 remain unchanged. No general UI redesign, simulation export or How to Use rewrite. No commit or push.

## Requested final-report index

Items 1–2: file inventory above. Items 3–32: gameplay corrections and source boundaries. Items 33–39: coverage table and residual report. Items 40–47: verification.json. Items 48–55: full regression suite and focused characterization. Items 56–66: invariant confirmations above. Benchmark configuration and measured values are in performance.json; no unrelated optimization was introduced.
