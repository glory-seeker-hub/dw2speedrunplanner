# Phase 2K-F — Authoritative Counter Resolution

Implemented on `phase-2k-f-authoritative-counters`. No commit or push. Run Planner remains schema v7.

The pasted Phase 2K-F request supplies project mechanics; the workbook supplies canonical skill identities and descriptors. The workbook at `C:\Users\rafae\Downloads\DW2 Modding Info.xlsx` passed the complete source check. Earlier phase documents remain historical; their paid-Miss and legacy Counter statements are superseded here.

## Files (report items 1–2)

Created:

- `tests/battleCounters.test.cjs`
- `scripts/benchmarkBattleCounters.cjs`
- `docs/phase-2k-f/performance.json`
- `docs/phase-2k-f/IMPLEMENTATION.md` (this report)

Modified:

- `src/components/BattleResults.tsx`
- `src/utils/battle/battleAccuracy.ts`
- `src/utils/battle/battleActions.ts`
- `src/utils/battle/battleDamage.ts`
- `src/utils/battle/battleInput.ts`
- `src/utils/battle/battleLegacyEffects.ts`
- `src/utils/battle/battleOrder.ts`
- `src/utils/battle/battleReactions.ts`
- `src/utils/battle/battleResources.ts`
- `src/utils/battle/battleRng.ts`
- `src/utils/battle/battleSimulation.ts`
- `src/utils/battle/battleStatuses.ts`
- `src/utils/battle/battleSupport.ts`
- `src/utils/battle/battleTargets.ts`
- `src/utils/battle/battleTiming.ts`
- `src/utils/battle/battleTypes.ts`
- `src/utils/battleEngine.ts`
- `tests/battleAccuracyStatus.test.cjs`
- `tests/battleEngineCore.test.cjs`
- `tests/battleTimingResources.test.cjs`

## State, selection and ordering (3–8, 14–20)

`PlannedAction.counter` holds the selected intention's typed runtime state. `BattleActionRecord.counter` takes a value snapshot so later resolution cannot erase the executed mode. Engine version is `2k-f-authoritative-counters-v1`.

| Execution mode | Promoted | Activated effects | Single target |
|---|---|---|---|
| waiting | No | No | Not resolved yet |
| activated | Yes | Yes, unless Confusion replaces/skips it | Causal attacker |
| shared-trigger-promoted | Yes | No | Same causal attacker |
| untriggered-end-of-turn | No | No | Base skill target selection |
| resolved | Opportunity consumed | Historical record preserves actual mode | Already resolved |

Selection creates exactly one intention, identified by its original action ID. Counter intentions enter the end-of-turn queue; they consume no initiative RNG. Untriggered Counters execute left to right by party position. The deterministic cross-party convention is player party before enemy party, then slot and stable ID; it is a simulator tie convention, not a claimed ROM discovery.

The single authoritative `promoteCounters` resolver runs after all impacts, Poison bonuses, ailments, legacy ordinary on-hit effects and HP eligibility updates. A normal Attack must Hit and deliver final damage greater than zero to the waiting Counter user. A zero base hit with Poison +10 qualifies. An effect-only zero-damage hit does not. Enemy KOs are excluded; players at zero HP remain eligible. Canonical Counter protection is respected.

The eligible group is sorted left to right. Only its first member is activated; all remaining members are shared-trigger-promoted. Each preserves the same trigger action ID and actual actor ID/name, plus its own impact target ID and causal damage. The queue removes the original IDs and inserts those same intentions as one ordered group. No replacement action or cancelled duplicate is created. Promotion has no RNG and no frame charge.

## Targeting and non-activated forms (9–13, 17–20)

Every promoted Single form resolves exclusively against its causal actor, even on the same side after friendly fire and even when the planned target was unrelated. It consumes no target-choice RNG. If that actor is no longer eligible, execution skips instead of choosing somebody else.

Activated `all-on-counter` expands to current valid opponents. Shared promotion and untriggered execution retain base targeting and do not gain this expansion. Canonical base AOE is retained separately. An activated AOE includes zero-HP players and excludes KO enemies.

GAIA Gear 0xF2's byte18 mask04 forces Miss whenever activated mechanics are absent, including shared-trigger-promoted. This follows the descriptor's “counter not triggered” meaning; shared queue promotion is not activation. It charges 194 frames, zero MP and performs no normal accuracy or on-hit draws. Recovery/Confusion handling still occurs first, so a Confusion replacement uses its own ordinary Attack rules.

## Damage, ailments and unresolved descriptors (21–24)

Canonical Counter AP replaces compatibility AP. Activated byte18 mask20 is a damage-output multiplier, not an AP multiplier: preserve the existing base formula's integer floors, then floor the final damage multiplied by 1.5. Ninja Knife Throw with base 22 returns 33, rather than multiplying its 22.5 AP before the base formula. Tests distinguish these arithmetic orders with fractional values.

Beast King Fist 0x8B instead returns `floor(damageReceivedFromTrigger * 1.5)`. A causal 13 returns 19 even if the obsolete last-damage field contains 999. It does not use accumulated, previous or unrelated damage. Poison +10 is added afterward by the shared status resolver. These are explicit deterministic integer operations; no new probability or frame value is introduced.

On an activated Hit, Needle Spray's Poison, Thunder Ball/Stun Punch's Paralysis and Buffalo Breath's Confusion apply their canonical guaranteed conditional descriptors. Audits store `condition: counter-activated`, null probability roll, applied=true and reapplication state. There is no 1/3 or 2/3 draw. Ordinary direct status descriptors resolve first with their existing probabilities, then activated descriptors apply; boolean statuses do not stack and Poison adds only ten. A synthetic combined-descriptor test covers this ordering without modifying imported source data.

Explicitly unresolved:

| Descriptor | Current boundary |
|---|---|
| Thunder Ball 0x84, byte33 mask02 random-digimon | Base all-enemies compatibility remains; exact random targeting is not claimed. Successful timing remains unknown and support remains future-mechanic-unsupported. Conditional activated Paralysis is implemented. |
| Pummel Whack 0x89, byte22 mask01 unknown bit | MP payment is implemented; the independent unknown bit remains canonical-data-incomplete. |
| V-Nova Blast 0x25 and Transcend Sword 0xE4, byte19 mask01, 1.5x vs Countering target | Arithmetic ordering and interaction with the other modifiers are not established. This modifier remains deferred; no waiting/resolved-target multiplier is guessed. |
| Other Increased Accuracy/cannot-miss/evasion flags, temporary powers and special states | Retain their existing diagnostic boundaries. Tail Blade alone receives the confirmed evasion exception. |

Authoritative Interrupt scheduling/resolution and full Assist resolution remain deferred. The public legacy Tech adapter, ordinary base damage formula, ordinary compatibility debuffs/drain/consecutive effects and unidentified synthetic/custom inputs remain compatibility layers. The old Counter scheduler, AP/returned-damage branches and counterUsed/isCountering booleans have been removed. Canonical Counter impact effects do not execute a second legacy effects path.

## Accuracy, recovery and Confusion (25–28)

Counter accuracy uses the Phase 2K-E exact base-128 threshold. Single forms use causal target effective SPD; AOE uses one action-level roll against the arithmetic mean of effective target SPDs. No promotion or selection recovery draw occurs. At the actual opportunity, Paralysis and Confusion each recover on zero out of four; remaining Paralysis fails on one out of two before accuracy. Poison has no natural recovery.

New statuses from the triggering action are immediately visible. Persistent Confusion uses the existing eligible canonical offensive-skill filter and own-side targeting. A replacement is an ordinary Attack and explicitly loses activated mechanics. A no-eligible-skill skip consumes the opportunity without MP or execution frames. Records retain the original Counter cause/mode and explain the replacement/skip.

## Source suppression and Interrupt readiness (29–31, 57–59, 63)

Counter and Interrupt kinds cannot activate a waiting Counter, regardless of Single/AOE, execution mode or target side. Assist is also ineligible. A Confusion replacement is an actual normal Attack and uses normal source eligibility.

The public pure `canInterruptCounter` helper returns true only for the waiting mode. Activated, shared-trigger-promoted, executing untriggered and resolved states return false. It is a future scheduling hook only; no Interrupt queue or resolver was added.

## MP accounting (32–34, 62)

Global action order is recovery → Confusion → remaining Paralysis → eligible Tail Blade evasion → accuracy → outcome → MP → impacts. The explicit unactivated forced-Miss gate skips accuracy. Every Miss records cost zero and paymentRule=none-on-miss, with no payer and no MP depletion alert. Normal, confused, AOE, Counter, evasion, Paralysis and Shadow Scythe misses share this path.

Hits pay canonical cost, clamp MP at zero, and remain executable with insufficient MP. Activated Pummel Whack charges its actual causal attacker; its user is not charged. Shared and untriggered forms pay their own MP. MP audit includes payer ID, name, side, before/after values, cost, completeness and payment rule. Shadow Scythe repeat remains free whether it Hits or Misses; its initial Miss is now free too.

## Tail Blade (35–39, 60–61)

Numeric ID 0x85 is the exception identity; reviewed adapter identity is accepted, arbitrary borrowed names are not. While its intention is waiting and not promoted, a normal Attack with exactly one effective target rolls `nextIntExclusive(3, tail-blade-evasion)`. Zero forces a full-action Miss; one/two proceed to normal accuracy. This draw follows Paralysis and short-circuits accuracy, effects and payment on Miss.

The same check applies to AOE with Tail Blade as its sole effective target. AOE with any additional effective target omits the evasion draw completely and uses ordinary one-roll mean-SPD accuracy. Activation and shared promotion both end the defensive window immediately; a later attack receives no extra evasion even though shared mechanics remain non-activated.

## Chains, timing and results (40–42, 52–56, 64)

Shadow Scythe repeats preserve chainFromActionId; Counter records independently preserve triggerActionId/reaction metadata. A repeat Attack can activate a surviving waiting Counter, and that response cannot start a Counter chain. Enemy KOs cannot react. Counter promotion happens after the entire causing action and ahead of queued repeat work; it never interleaves with AOE impacts.

Known Counter Single Hits use 685 frames. Known AOE Hits use 703/873/990 for one/two/three effective targets. Every Miss uses 194. Unknown target classes remain incomplete. No reaction surcharge or unverified timing/probability was invented.

BattleResults now displays Counter — Activated, Counter — Shared AOE follow-up, Counter — Untriggered, actual causal actor, non-activated effects, Confusion replacement, Miss — Tail Blade, activated conditional ailments and special payer details. Summary cards stay unchanged. Server-rendered UI tests cover these strings and existing resource alerts.

Confirmed: all AOE impacts finish first; only the leftmost eligible Counter is genuinely activated; every later promoted Single Counter preserves and targets the same causal attacker without random unrelated selection. This holds for confused friendly AOE too.

## Verification (43–50)

- Complete regression suite: 1,179/1,179 passed, including 125 Counter tests. Final focused battle suites also passed 383/383.
- Self-checks: 57/57.
- Battle-skill coverage: all 11 checks passed.
- Workbook source --check: passed all 68 bytes, labels, effect dictionary and provenance.
- TypeScript app and node: passed.
- Production build: passed (33.86 seconds, JS 1,009.86 kB / gzip 241.39 kB); existing Browserslist/chunk-size advisories remain.
- Lint: unchanged baseline, 3 errors / 7 warnings, no new findings. Existing empty-interface errors in command.tsx/textarea.tsx and require-style error in tailwind.config.ts remain outside scope.
- Diff whitespace check: passed for tracked changes and all four new files.
- No Planner schema changes. No commits or pushes.

The former “unknown Counter timing” aggregate fixtures now use unidentified custom skills, preserving the unknown-timing tests without asserting obsolete Counter behavior. Paid-Miss expectations and duplicate-counter characterization were replaced; unrelated damage characterization remains intact.

## Performance (51)

Seed 42, mulberry32-v1, production default action policy, synchronous wall-clock observations on this machine; no optimization was needed. RNG counts are totals for the batch; action/record columns are per-run averages. JSON includes categories and outcomes. All runs completed player victories.

| Scenario | Runs | Wall clock ms | Executed actions avg | Records avg | RNG draws total |
|---|---:|---:|---:|---:|---:|
| singleCounter | 1 | 10.933 | 7 | 8 | 23 |
| singleCounter | 100 | 36.751 | 7.18 | 8.18 | 2363 |
| singleCounter | 1000 | 189.246 | 7.204 | 8.204 | 23714 |
| multiCounterAoe | 1 | 3.183 | 37 | 40 | 87 |
| multiCounterAoe | 100 | 97.903 | 38.44 | 41.44 | 9132 |
| multiCounterAoe | 1000 | 618.520 | 38.304 | 41.304 | 90912 |
| tailBlade | 1 | 1.780 | 25 | 26 | 90 |
| tailBlade | 100 | 40.322 | 24.1 | 25.1 | 8703 |
| tailBlade | 1000 | 329.363 | 23.458 | 24.458 | 84792 |

First history serialized sizes: Single Counter 12,445 bytes; multi-Counter AOE 73,061; Tail Blade 40,848. Removing only the new counter audit from those same histories yields 11,530 / 65,225 / 38,090 bytes, respectively: counter audit payload increments 915 / 7,836 / 2,758 bytes (7.94% / 12.01% / 7.24%). This isolates audit cost, not a before/after engine benchmark; promotion also eliminates the old cancelled duplicate Counter records. Reproduce with `node scripts/benchmarkBattleCounters.cjs`.

## Requested semantic-test coverage

The numbered requirements are covered by assertion families, not one test per bullet. Existing accuracy/status, timing/resources and core suites remain in the complete run.

| Request test IDs | Coverage |
|---|---|
| 1–6 | Initial intention, reversed insertion/contrasting SPD ordering, one preserved ID, no duplicate execution |
| 7–15 | Source-kind × outcome × damage matrix; zero-base Poison bonus; zero-damage debuff; evasion and Paralysis misses |
| 16–35 | Canonical skill × mode matrix; causal explicit-target override; AOE expansion; all GAIA modes; MP/accuracy/timing |
| 36–62 | One/two/three Counter AOE group; shared IDs; first-only modifiers; conditional ailments; Pummel payer; base AOE boundary |
| 63–77 | Same-action statuses; all-mode recovery; Confusion replacement/recovery; guaranteed descriptor and direct/conditional coexistence |
| 78–93 | All-mode accuracy matrices; activated AOE mean and measured timing; kind suppression; pure Interrupt readiness helper |
| 94–116 | Existing global accuracy/resource suites plus Counter hit/miss matrices, payer clamp and identity audits |
| 117–122 | Canonical AP vs contradictory legacy hints; output multiplier integer-order distinction; unrelated 999 vs causal 13 return |
| 123–140 | Exact three outcomes; Single/sole AOE; multi-target omission; numeric rename/name-borrow; activation/shared defensive-window consumption |
| 141–151 | Friendly Single/AOE causal group, same-side return targets, KO exclusion before activation, zero-HP player eligibility/alert |
| 152–158 | Existing Shadow Scythe tests plus causal repeat activation, initial free Miss, suppression within chain |
| 159–167 | BattleResults server rendering of Counter modes, trigger actor, conditional ailments, Tail Blade cause and payer |
