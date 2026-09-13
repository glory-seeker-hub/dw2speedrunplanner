# Phase 2K-G — Authoritative Interrupt Resolution

Implemented on `phase-2k-g-authoritative-interrupts`, starting from committed Phase 2K-F. No commit or push. Run Planner remains schema v7.

## Files (report items 1–2)

Created:

- `src/utils/battle/battleInterrupts.ts`
- `src/utils/battle/battleImmunity.ts`
- `tests/battleInterrupts.test.cjs`
- `scripts/benchmarkBattleInterrupts.cjs`
- `docs/phase-2k-g/performance.json`
- `docs/phase-2k-g/IMPLEMENTATION.md`

Modified:

- `src/components/BattleResults.tsx`
- `src/utils/battle/battleAccuracy.ts`
- `src/utils/battle/battleActions.ts`
- `src/utils/battle/battleChains.ts`
- `src/utils/battle/battleConfusion.ts`
- `src/utils/battle/battleDamage.ts`
- `src/utils/battle/battleInput.ts`
- `src/utils/battle/battleLegacyEffects.ts`
- `src/utils/battle/battleOrder.ts`
- `src/utils/battle/battleRng.ts`
- `src/utils/battle/battleSimulation.ts`
- `src/utils/battle/battleStatuses.ts`
- `src/utils/battle/battleSupport.ts`
- `src/utils/battle/battleTiming.ts`
- `src/utils/battle/battleTypes.ts`
- `src/utils/battleEngine.ts`
- `tests/battleEngineCore.test.cjs`

## Intention and scheduler architecture (3–12, 56–61)

One selected Interrupt creates one typed `InterruptRuntimeState` on its original PlannedAction. Its states are waiting, executing, resolved and skipped-no-opportunity. It stores the selected canonical skill ID, target action ID and interrupted actor ID. It never enters ordinary SPD ordering and consumes no initiative draw. Zero-AP canonical Interrupts are usable; they do not become synthetic Basic Attacks.

The sole Interrupt scheduler lives in `battleInterrupts.ts`. Player reservations are a separate set of action IDs, not assignments to specific users. Before each queue opportunity it removes invalid reservations and selects without replacement among remaining potentially eligible enemy actions using `interrupt-target-choice`. Unknown initial accuracy can be reserved provisionally; a subsequent initial Miss releases the reservation without consuming a user. KO, skip, Counter promotion and static protection likewise invalidate a reservation. Already interrupted/resolved/cancelled targets are excluded.

Enemy-side Interrupts do not reserve random targets. They claim the first eligible Player action that reaches an initial Hit in actual scheduler execution order. Earlier Misses leave the waiting pool intact.

When either side claims an opportunity, one executor is chosen with `interrupt-user-choice` if two or more users remain. A lone executor consumes no selection draw. Other users stay waiting. The target's `interruptConsumed` flag is set before the Interrupt is queued, so a Miss, restart or send-last cannot permit a second Interrupt against that same action.

Every Interrupt targets exactly the actor of the selected action, regardless of legacy All targeting hints. It is inserted immediately before that action; it never runs between AOE impacts. Unused intentions receive explicit `interrupt-no-eligible-target` skip records at round/battle end. They are not Misses, cost no MP, have no 194-frame charge and execute no fallback Attack.

## Preparation and restart (5, 10–12, 16–19, 61–62)

`PreparedActionContext` stores finalized target IDs, preparation status snapshots, recovery results, Confusion result, initial accuracy, one-Interrupt-consumed state and causal resolution metadata. Preparation runs once: natural recovery → Confusion/skill finalization → target finalization → initial Hit/Miss. Initial Miss is final and cannot be interrupted. Initial Hit without an available Interrupt is used directly; there is no second roll.

When an Interrupt actually executes, the target retains its original action ID and prepared skill/target set. Both Interrupt Hit and Miss cause a new Hit/Miss stage unless deletion or enemy actor KO cancels the target. No target action MP is charged for the initial Hit. Restart reevaluates current Paralysis, current eligible Tail Blade evasion and normal accuracy, without recovery, skill choice, target choice or Confusion reselection. Prepared target IDs are only filtered for current eligibility; no replacement targets are drawn.

Only actual final executions increment action count. History has one record per target opportunity with initial accuracy in `restart.initialAccuracyResolution` and final accuracy in `accuracy`; no duplicate target action is created. The Interrupt itself is a separate execution with its original intention ID. Cancelled actions have no execution duration or payment. Cancellation metadata distinguishes action deletion from actor KO.

## Interrupt statuses and immunity (13–15, 20–24, 63–67)

The Interrupt user gets no natural recovery. Its Confusion status remains active but does not filter, redirect, replace or skip its Interrupt. Active Paralysis immediately performs the existing independent binary failure check. Failure short-circuits normal accuracy and effects, costs zero MP and takes 194 frames.

Interrupt Hits resolve direct status descriptors with existing 33/66 rules, then guaranteed interrupt-triggered descriptors. Conditional audits use `condition: interrupt-hit`, null probability roll and applied/immunity results. There is no fabricated 1/3 or 2/3 draw for guaranteed conditional Paralysis.

Poison and Paralysis are effective immediately. Newly applied Paralysis can fail the target restart with no recovery opportunity. Interrupt-applied Confusion also becomes an active status immediately; `confusionSuppressedForActionId` explicitly scopes behavior suppression to the interrupted action. Its locked skill and target remain unchanged, including Physical and AOE actions. The marker expires on completion/cancellation/skip. Confusion then behaves normally next turn. Ordinary Attack/Counter-applied Confusion retains existing same-turn behavior for later preparations.

The current imported 0xA0–0xA8 Interrupt records contain no direct or conditional ailment flags. The workbook effect dictionary supplies the conditional definition. Tests exercise Interrupt status combinations through isolated synthetic descriptor combinations, restoring the canonical lookup afterward; no workbook record or skill-to-ailment association was invented.

## Effects and arithmetic (25–29, 44–45, 68)

| Canonical descriptor | Implemented behavior |
|---|---|
| byte31 mask80, Venom Infusion 0xA4 | On Interrupt Hit against non-boss: `nextIntExclusive(8, interrupt-delete-action)`; 0–6 delete, 7 fails. Successful deletion cancels the original action with no restart RNG, MP or impacts. Boss immunity is audited and consumes no deletion roll. |
| byte32 mask08, Giga Scissor Claw 0xA3 | On Hit: `nextIntExclusive(3, interrupt-force-miss)`; 0–1 force Miss, 2 fails. A forced restart Miss skips Paralysis, Tail Blade and accuracy, costs zero MP and takes 194 frames. |
| byte32 mask02 | Retained damage 38/128 (19/64), used by Horn Buster/MP Destroyer. |
| byte32 mask04 | Retained damage 77/128, used by Electro Shocker/Life Shield. |
| byte32 mask20, Chrono Breaker 0xA5 | Moves the same prepared action to the absolute queue end, after ordinary actions and all Counter zones. Preserves ID, targets, skill, consumed flag and modifiers. Restart is deferred until it actually executes. Queue movement adds no frames. |

Reduction is applied once to each outgoing impact after the existing base formula/output multipliers and Poison bonus, before HP loss and Counter activation. It uses integer BigInt multiplication/division, flooring positive damage exactly; percentages are not converted through floating approximations. The same stored fraction applies to every AOE impact, with no per-impact modifier/accuracy rerolls. `damageBeforeInterruptReduction` preserves the input amount for audit. Missed Interrupts apply no reductions or modifiers.

Clear output modifiers now use explicit runtime conditions: byte18 mask80 checks a target with a waiting/executing Interrupt intention; byte19 mask02 checks a waiting Counter or waiting/executing Interrupt intention; byte19 mask04 checks that the current prepared action was interrupted. Resolved intentions do not qualify. Each applies `floor(existing integer output * 1.5)`, matching Phase F output rounding. Spinning Needle, V-Wing Blade, Tusk Crusher and Transcend Sword use these conditions. This is separate from the retained ordinary base damage formula.

MP Magic 0xA6 and MP Destroyer 0xA8 byte19 mask40 remain unresolved: the interrupted prepared canonical skill identifies a potential causal MP cost, but exact payer/transfer semantics are not established. No MP transfer is guessed. Their normal execution cost still applies on Hit, and MP Destroyer's decoded damage reduction works. Uncertain cannot-miss flags, Increased Accuracy, remaining special states and the independent damage-vs-Countering ordering limitation retain diagnostics. Full Assist and Assist-vs-Interrupt behavior remain deferred.

## Boss metadata (30–35, 70–72)

The existing reviewed `DOMAIN_GROUPS` supplies explicit encounter-level isBoss values, derived from the domain mapping CSV and contextual corrections. Its encounter IDs have no mixed true/false classifications in the current data. Encounter input propagates that classification to the encounter's combatants. Manual/core `BattleTeamMember.isBoss` is typed and validated. Unmapped/manual unspecified combatants default to non-boss; no new boss list was created.

XP, Bits, reward suppression, encounter order and no-reward classification are never used for boss detection. Coliseum has no boss classification merely from reward behavior and remains non-boss absent separate explicit evidence. Tests cover zero-reward non-boss input, explicit Coliseum fixtures and reviewed domain metadata.

`getStatusImmunity` centralizes boss Confusion immunity for every source, while preserving boss susceptibility to Poison/Paralysis. Application records carry result=immune and immunityReason=boss. Existing direct application draws are retained; no later Confusion behavior is created. The same helper makes all Enemy-side combatants Motivation Down immune, including bosses, without automatically immunizing Players. Full Motivation Down execution remains deferred.

## Counter, Shadow Scythe, resources and timing (36–43, 69, 73–75)

Waiting Counters can be interrupted only as their untriggered end-of-turn opportunity reaches initial Hit. They restart their same non-activated form and gain no activated Counter effects or causal Counter targeting. Activated and shared-trigger-promoted Counters are excluded. Interrupt damage never activates a Counter. Final reduced ordinary Attack damage still drives the Phase F positive-damage activation rule.

Shadow Scythe 0x4D initial and repeated executions are statically excluded from reservations and enemy opportunity claims. Canonical Can't be Interrupted protection (including combined flags) also gates eligibility. Shadow repeats clear the parent's prepared context so their own separate Attack targeting/accuracy remains intact.

Interrupt Hit pays canonical MP; accuracy/Paralysis Miss and unused skip pay none. Target restart Hit pays once, final Miss/cancellation pays none. Insufficient MP never blocks execution; normal depletion alerts apply. Enemy actors KO'd by an Interrupt cannot restart; Players reaching zero HP retain their strategic eligibility and HP alert.

Interrupt Hit timing is explicitly null with “Measured Interrupt Hit duration unavailable.” All Interrupts are Single, but 685 frames is not borrowed for them. Interrupt Miss is 194. The target uses its final ordinary/Counter timing, with no pre-resolution, cancellation or queue-movement surcharge. A successful Interrupt makes totalFrames incomplete/null while knownFrames preserves the measured subtotal. No successful Interrupt duration was invented.

## Results (46)

BattleResults shows Interrupt Hit/Miss/Paralysis/unused skip, target actor/action ID, initial Hit → restarted final result, recovery suppression, locked preparation, deletion vs actor KO, forced Miss, retained damage fraction, send-last after Counters, boss deletion immunity, status immunity and deferred-current-action Confusion. Existing summary cards remain compact. Server-rendering tests verify these details.

## Verification (47–54)

- Full regression: 1,304/1,304 passed on the final implementation, including 125 new Interrupt tests.
- Focused battle regression: 508/508 passed before the final audit addition; Interrupt suite subsequently passed 125/125.
- Data self-checks: 57/57.
- Battle-skill coverage: all 11 checks passed.
- Workbook --check: passed all 68 bytes, labels, dictionary and provenance at `C:\Users\rafae\Downloads\DW2 Modding Info.xlsx`.
- TypeScript app and node: passed, including the final typed cancellation reason.
- Production build: passed on the final implementation (19.55 seconds; JS 1,018.34 kB, gzip 243.79 kB). Existing Browserslist and bundle-size advisories remain.
- Lint: final baseline unchanged, 3 errors / 7 warnings. Unrelated lint debt was not modified.
- Whitespace/diff: passed for tracked changes and all six new files.
- Planner schema untouched; no commit/push.

The old core test describing Interrupt as ordinary legacy offense now verifies authoritative scheduling and the unknown successful timing boundary. All unrelated Phase F tests remain in the complete regression run.

## Performance (55)

Seed 42, mulberry32-v1, production action policy, synchronous wall-clock measurements. Status-heavy uses existing starting statuses and canonical ordinary status skills; it does not attach fabricated ailments to Interrupt skills. Counts include skipped records separately from actual executions. All benchmark outcomes are recorded in performance.json.

| Scenario | Runs | Wall clock ms | Executed actions avg | Records avg | RNG draws total |
|---|---:|---:|---:|---:|---:|
| single | 1 | 14.781 | 16 | 16 | 56 |
| single | 100 | 46.520 | 16.62 | 16.86 | 5853 |
| single | 1000 | 196.515 | 16.578 | 16.776 | 58320 |
| multiple | 1 | 2.033 | 39 | 47 | 155 |
| multiple | 100 | 71.816 | 46.9 | 58.15 | 18680 |
| multiple | 1000 | 712.218 | 46.641 | 57.829 | 185896 |
| statusHeavy | 1 | 1.580 | 17 | 20 | 78 |
| statusHeavy | 100 | 23.223 | 17.8 | 19.6 | 8227 |
| statusHeavy | 1000 | 167.076 | 17.541 | 19.19 | 81017 |
| sendLast | 1 | 1.094 | 12 | 12 | 42 |
| sendLast | 100 | 20.066 | 12.4 | 12.92 | 4439 |
| sendLast | 1000 | 139.793 | 12.438 | 12.904 | 44433 |

| First-run history | Bytes | Without interrupt/restart audit | Audit bytes added |
|---|---:|---:|---:|
| single | 31151 | 23740 | 7411 |
| multiple | 87083 | 68238 | 18845 |
| statusHeavy | 32952 | 26457 | 6495 |
| sendLast | 21173 | 18398 | 2775 |

The size comparison isolates new audit payload in the same history; it is not a claim about an old engine running different behavior. Preparation is additionally retained on runtime PlannedActions for deterministic restarts. No premature optimization was performed. Reproduce with `node scripts/benchmarkBattleInterrupts.cjs`.

## Requested semantic coverage

The 197 requested assertions are grouped across 125 new tests plus existing Phase E/F suites, rather than requiring one test per numbered assertion. Coverage includes all intention/skip states; initial accuracy/Paralysis/Tail Blade/AOE Miss gates; Hit/Miss restarts; exact programmed RNG and no second recovery; player reservation and enemy first-attacker policies; two/three-user executor choices; no duplicate targets; target/skill locks; immediate Paralysis and next-turn Confusion; exact 7/8 and 2/3 endpoints; boss immunity; exact fractions and AOE reductions; send-last after Counters; Shadow Scythe initial/repeat exclusion; waiting/promoted Counter boundaries; metadata and Motivation Down immunity; KO resource policy; MP payment; output-state modifiers; deterministic replay; and Results UI.

All explicit confirmations in report items 56–75 are described in the corresponding sections above. Full Assist mechanics were not implemented, no successful Interrupt timing was invented, and no ambiguous MP transfer was executed.
