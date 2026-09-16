# Phase 2K-K — implementation and verification

## Status

Work is on `phase-2k-k-battle-effect-completion`, from committed Phase J merge `816976f`. No commit or push.

Both source questions were resolved by the user: **Motivation Down applies at 100% on Hit**, and **Trick Or Treat uses DEF=1**. The latter explicitly overrides the preserved byte17/0x40 half-DEF source description. Raw source data remains unchanged.

All remaining used deferred occurrences and unused dictionary rows are listed in [RESIDUAL_UNRESOLVED.md](RESIDUAL_UNRESOLVED.md). Missing source information is not represented as implemented behavior.

## Source audit, completed before mechanics edits

`source-audit-before.json` contains every current WAZADATA record, full 16-bit identity, name, category, target descriptor, all 68 raw bytes, every effect's byte/mask/source label, baseline coverage classification and handler. It was generated directly from current canonical modules by `scripts/auditPhaseK.cjs`, before runtime behavior changed. The script refuses to overwrite the frozen pre-implementation artifact.

This includes all named techniques, every Can't Miss occurrence, every byte33 random target and every Act Last occurrence. Name discrepancies are retained: source calls the MP-damage techniques **Demi Dart (0x003C)** and **Evil Touch (0x0041)**, not Evil Claw.

### Byte21 audit

| Group | Used occurrences | Techniques |
| --- | ---: | --- |
| 50% current HP, 0x02 | 1 | HP Zapper, 0x00E1 |
| Conditional execute, 0x08 | 1 | Critical Blow, 0x00E2 |
| Three-hit death, 0x10 | 0 | Unused dictionary row |
| MP damage, 0x20 / 0x40 | 2 | Demi Dart 0x003C; Evil Touch 0x0041 |

The first two groups are used and now execute the final user-confirmed rules: floor(current HP / 2), and <=10% pre-impact HP execute. Three-hit death remains unused with no speculative implementation.

### Unknown raw bits

Exactly three raw unknown occurrences were present. No other used unknown bits were found:

| Technique | Full ID | Raw flag | Reviewed mapping |
| --- | --- | --- | --- |
| Black Pearl Shot | 0x003D | byte31/0x04 | Exact post-use DEF=1 for the current round |
| Pummel Whack | 0x0089 | byte22/0x01 | Activated Counter cost paid by causal attacker |
| Necro Magic | 0x00D2 | byte33/0x08 | Random all-field KO+MP target |

Raw source and decoder evidence remain lossless. Runtime predicates explicitly bind the reviewed identities to audited descriptors; coverage identifies their new handlers. Crimson Claw is separately mapped by **byte22/0x02**, “Pass on your status to target,” at **0x0070**. Pummel is not Status Transfer.

## Implemented rules and lifecycle

| Area | Implementation and boundary |
| --- | --- |
| Party Time | User Poison activates AP ×3/2, target Poison is irrelevant, Poison is not consumed. History records the active AP bonus. |
| Exact AP arithmetic | Reusable numerator/denominator modifier is applied before the existing AP-stage floor. Factors remain integers, including the denominator 2; no intermediate AP floor is added. Existing damage, matchup and DEF floors remain in their original order. |
| V-Nova / Transcend | The same AP mechanism checks the authoritative target Counter state for `waiting`; used/promoted/resolved Counters do not qualify. |
| Motivation Down | Two highest-cost canonical technique slots blocked. A tied cutoff samples slots without replacement using battle RNG. Slots remain stable until cure/recovery; a later application initializes a new selection. |
| Motivation immunity | All Enemy combatants are immune, irrespective of boss/Coliseum metadata. |
| Motivation recovery | 1/4 at the normal recovery opportunity; clears status and slot selection. TAS Player recovery succeeds without a draw. Explicit cures also clear slots. |
| Motivation application | User-confirmed 100% on Hit, with no application RNG draw. Enemy immunity remains absolute. TAS cannot prevent this guaranteed application; recovery is still favorable. Typed probabilistic descriptors retain the existing TAS prevention path. |
| Guard | Only when Motivation blocks every technique: singleton legal choice, 194f, zero MP, no target, no damage, no accuracy resolution, explicit `guard` outcome and history label. No global selectable Guard or Basic Attack is added. |
| Command lock | Restrictions are checked at planning. An order valid when locked is not retroactively replaced if status arrives later in the round. Existing Confusion replacement remains independent. |
| Initial search state | Initial tied blocked slots use the first paired rollout seed to form a representative root state. They are not enumerated as Player plans. Existing stochastic prefix-divergence behavior is retained. |
| MP Magic / Destroyer | Descriptor-driven eligibility requires full canonical own cost. Successful Interrupt pays own cost, gains original target technique cost up to Max MP; original action retains its own one-time restart/payment handling. Miss gains nothing, costs zero and remains 270f. |
| Protect Grenade | Canonical 0x0066 bypasses ordinary accuracy; no roll is generated or discarded. Mechanical Miss gates remain. |
| Can't Miss | All valid occurrences bypass ordinary accuracy only. Existing Assist accuracy semantics remain. |
| Random Digimon | Execution-time single draw within canonical target domain. Explicit target locks are rejected; optimizer contributes one choice. Intended trace says Random / engine policy, actual history records the selected target. Empty pool produces an executed Miss. |
| MP damage | Final post-reduction/post-Invincibility HP damage drains floor(damage / 2) MP, clamped at zero, with no extra time or RNG. |
| Crimson Claw | Deterministically copies Poison, Paralysis, Confusion, Motivation Down and the two recovery-block states. Original statuses remain. Hard immunities apply; no application-chance RNG. Powers, stages, Elemental Power, Poison Body and beneficial states are excluded. Motivation tie selection can still require its own RNG. |
| Cannot Recover HP | Blocks only fixed healing components for the remaining round; full healing and revives retain their existing eligibility and effects. Payment/timing and independent components remain. |
| Cannot Recover Status | Blocks natural recovery and explicit cure for the remaining round, including TAS recovery. New status application remains possible. |
| Zen / Re-Format / Re-Initialize | Effective ATK/DEF/SPD stages become neutral for the remaining round; stored stages are preserved and return next round. All actual recipients are handled. |
| Poison Wave | Existing Poison Power and Poison Body implementations are reused and recover independently. The redundant direct-Poison source descriptor is explicitly ignored under the supplied two-power rule. |
| Double SPD | Doubles effective SPD only during initial queue formation, before initiative RNG. Hit Rate and stored SPD are unchanged. |
| Act Last | Queue property places the selected action after ordinary actions and waiting Counters. Interrupt absolute send-last remains a separate operation. |
| Assist Interrupt | Removes the blanket exclusion; the existing Interrupt scheduler handles deletion, forced Miss, send-last and status. Damage reduction does not touch healing. Guard is excluded. |
| Fantasmic Ray | Canonical 0x00F4 selects one of Water/Fire/Nature/Machine/Darkness on a successful execution when damage needs the element. One selected element is shared by all impacts, matchup and floor arithmetic, then discarded with the action. Neutral is impossible. |
| Alias Fake | 0x00EA ignored/unused; removed from encounter lists and runtime skills. Canonical encounter projection also handles valid techniques missing from the legacy catalog, allowing its encounter to construct. |
| Black Pearl Shot | Exact effective DEF=1 begins after an executed Hit or Miss. Skipped actions do not apply it. Round cleanup restores ordinary DEF/stages. |
| Trick Or Treat | User-confirmed DEF=1 override of the half-DEF source description; shares Black Pearl Shot’s post-use handler and round cleanup. |
| Necro Magic | Single execution-time random target among both sides with HP=0 and MP>0, independent of strategic Player HP0 action eligibility. Transfer is min(100,target MP,user free capacity after payment). Target loses only what user receives. Empty pool Misses. |
| Pummel Whack | Activated Counter costs its user zero; causal attacker pays the canonical Counter cost once in addition to its own payment, clamped at zero. No additional charge is attached to nonactivation. |
| Light Gun | Canonical 0x00F3 is eligible for boss Enemy AI only while another Enemy ally has HP0. Player use is unchanged. Eligibility is recomputed each selection. |
| Shadow Scythe | Enemy execution and repeats choose the lowest positive current Player HP, with seeded RNG for equal minima. Reaching HP0 triggers a repeat while other positive-HP Players remain; strategic Player action eligibility remains unchanged. Player use keeps explicit targeting and existing free-repeat timing/payment. |

### Source evidence versus conventions

The current data/runtime contains no authoritative reroll evidence for Motivation's status lifetime, no lowest-HP tie order for Shadow Scythe, and originally no odd-MP-damage rounding evidence (now resolved by the final user rule). The request's lifetime/tie conventions are therefore used, not represented as independently proven game facts. The existing preparation/restart architecture locks orders; no contrary immediate Motivation reselection evidence was found. Existing capped HP resource behavior and Current MP validation establish the resource convention; no MP-overcap mechanism was found. Necro uses the request's conservative transfer convention.

The user confirmed the earlier Tusk Crusher reference was a naming mistake. Tusk Crusher **0x0034 has no Double SPD flag** in the canonical source. Slamming Tusk **0x006E does carry Double SPD**; tests characterize both. No priority flag was invented for Tusk Crusher. Confusion replacements respect blocked slots, Guard uses an explicit internal action marker, and unchanged ineligible Assist ordering retains its seeded baseline.

### RNG categories

Added typed categories: `motivation-blocked-choice`, `status-apply-motivation-down`, `status-recovery-motivation-down`, `random-digimon-target`, `necro-ko-target`, `shadow-scythe-hp-tie`, `fantasmic-element`. No new Math.random boundary. TAS overrides extend only the supported Motivation probability/recovery gates; all new target/element/tie draws remain Natural.

## Coverage

| Metric | Before | After |
| --- | ---: | ---: |
| Decoded occurrences | 598 | 598 |
| Descriptor groups | 100 | 101 |
| Authoritative occurrences | 326 | 370 |
| Deferred occurrences | 45 | 0 |
| Compatibility-only | 2 | 1 |
| Ignored by project | 1 | 6 |
| Not applicable | 63 | 60 |
| Data-only | 161 | 161 |
| Unused dictionary rows | 5 | 5 |

`coverage-changes.json` lists every changed occurrence with exact identity and source mapping. `docs/phase-2k-h/effect-coverage.{json,md}` remains the project's exhaustive regenerated coverage artifact. Warnings were removed only for implemented behavior or explicit ignored/unused classifications. All used deferred effects are now resolved. The broken Banana Slip Interrupt interpretation is explicitly ignored, not hidden.

## Regression and validation

Final check results are recorded in `verification.json`: **2,580/2,580 tests**, **57/57 data self-checks**, **11/11 battle-skill checks**, workbook provenance check, both TypeScript projects, production build and whitespace diff check pass. Lint remains at the baseline **3 errors / 7 warnings**, all in unchanged UI/config files. Production build retains its existing large-chunk warning. The full suite includes Planner/multiple-run/history, exact overrides, both search methods/objectives, 2,197-plan canonical enumeration, fair screening/common random numbers/elite selection, accuracy/TAS, Worker independence/cancellation, battle mechanics, and UI audit regressions. Phase K adds `tests/battleEffectCompletion.test.cjs` and `tests/phaseKBattleIntegration.test.cjs` plus `tests/phaseKFinalClosure.test.cjs` (214 cases combined). Existing expectations changed only where Phase K deliberately changes behavior: Can't Miss consumes no standard accuracy draw, Assists accept Interrupts, priority/random-target flags execute, Alias Fake is ignored, and resolved coverage no longer emits old warnings.

Frozen unaffected damage and seeded characterization tests remain in the full suite. No base damage formula, standard Hit Rate formula, optimization objective, cancellation architecture, Planner stat calculation or persistence format was redesigned. Counter/Interrupt/Assist changes are confined to the reviewed additions above. Stat overrides flow through existing local runtime fields; no special override branches or persisted stats were added. Run Planner remains schema v7. No general UI redesign, simulation export, How to Use rewrite, commit or push.

## Performance

`performance.json`: six cases, 200 seeded Random Monte Carlo engine rollouts each, Strategy/Natural, max five rounds. Reports wall time, evaluations/sec and final rollout result bytes. These are local short-run measurements, not worker/optimizer throughput claims. Baseline, Party Time, Motivation/Paralysis, MP Interrupt, Fantasmic/random Counter and Enemy Shadow Scythe are included. No unrelated optimization was introduced.

## File inventory

`files-changed.txt` records created and modified files. Key additions are the frozen audit, residual/coverage/performance/verification reports, repeatable audit/report/verification scripts, shared `battleEffectCompletion.ts` mechanics and the characterization suite. Modified runtime files cover shared action legality, damage, accuracy, resources, target/order, statuses/support, Interrupts/Counter cost, repeats, traces, search root initialization and narrow Results audit text. Existing coverage and regression fixtures are updated for the reviewed rules.

## Requested final-report cross-reference

| Requested items | Report section or artifact |
| --- | --- |
| 1–2 branch and files | Status; files-changed.txt |
| 3–6 source and mapping audits | Source audit; source-audit-before.json |
| 7–15 Party Time and Motivation | Implemented rules and lifecycle; confirmed 100% application above |
| 16–24 MP Interrupts, bypass and targeting | Implemented rules and lifecycle |
| 25–38 MP damage, copy, recovery and suppression | Implemented rules and lifecycle; residual report |
| 39–49 Counter AP, initiative, Assists, Fantasmic and Alias | Implemented rules and lifecycle; Tusk source discrepancy |
| 50–62 DEF1, Necro, Pummel, Light Gun and Shadow | Implemented rules and lifecycle |
| 63–69 RNG, coverage and all residual/data-only rows | RNG categories; coverage-changes.json; RESIDUAL_UNRESOLVED.md |
| 70–78 checks and performance | verification.json; performance.json |
| 79–95 invariants and scope confirmations | Regression and validation; confirmation below |

Fastest Potential, Average Victory and Success Rate objectives retain their existing definitions and ranking logic. Existing TAS favorable gates are preserved; the newly confirmed guaranteed Motivation application is not a probability gate. Exact-stat overrides remain local, multiple-run behavior is unchanged, and schema remains v7. Counter, Interrupt and Assist core behavior changes only for the reviewed additions listed above. No warning was removed without implementing its effect or explicitly classifying it under the supplied project rules. No commit or push was performed.

The final correction benchmark was rerun after the full test suite completed: ordinary 1399 evaluations/sec, party-time 3403 evaluations/sec, motivation 3030 evaluations/sec, mp-interrupt 2339 evaluations/sec, fantasmic-random 1668 evaluations/sec, shadow-scythe 1821 evaluations/sec. Each uses 200 seeded evaluations and five-round maximum. See performance.json for wall time and result sizes; these are short local engine measurements, not a controlled before/after comparison.

## Final correction pass

See [FINAL_CORRECTION.md](FINAL_CORRECTION.md) for the final HP-result rules, Counter prevention, lifesteal source audit, coverage delta, and requested final-report confirmations. This supersedes the earlier residual source questions; used deferred occurrences are now zero.
