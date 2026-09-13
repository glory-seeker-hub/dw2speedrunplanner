# Phase 2K-G1 — Authoritative Interrupt Timing Correction

Completed on `phase-2k-g1-interrupt-timing`, from committed Phase 2K-G. No commit or push.

## Timing correction

The exported `INTERRUPT_PRELUDE_FRAMES` constant is **76**. These frames belong to the interrupted Digimon beginning its original action, not to the Interrupt technique animation.

| Actual canonical Interrupt outcome | Interrupted-action prelude | Interrupt execution | Recorded total |
|---|---:|---:|---:|
| Hit | 76 | 685 | **761f** |
| Accuracy Miss | 76 | 194 | **270f** |
| Paralysis Miss | 76 | 194 | **270f** |

A canonical Interrupt timing class is established from numeric canonical skill identity. `BattleActionRecord.interruptTiming` records `preludeFrames`, `executionFrames` and `totalFrames`. Its `durationFrames` includes the prelude exactly once. Detailed Results display this decomposition; summary cards are unchanged.

A candidate initial Miss with no actual Interrupt stays **194f**, with no prelude. Unused Interrupt skips and cancelled target actions acquire neither a prelude nor an execution duration. The initial Hit eligibility roll contributes no full 685-frame action. The restarted target contributes only its own ordinary final duration.

| Causal sequence | Total |
|---|---:|
| Interrupt Hit + restarted Single Hit | 761 + 685 = **1446f** |
| Interrupt Miss + restarted Single Hit | 270 + 685 = **955f** |
| Interrupt Hit + target forced Miss | 761 + 194 = **955f** |
| Interrupt Hit + target action deleted | **761f** |
| Interrupt Hit + Enemy actor KO | **761f** |
| Interrupt Hit + restarted AOE | 761 + existing 703/873/990 by target count |

Send-last records the Interrupt's 761f when the Interrupt executes. The same target action adds its ordinary duration later, after Counters, without another prelude. Different Interrupt events each receive their own 76f.

The old successful-Interrupt-unknown diagnostic is removed for canonical execution. A battle whose only timing gap was a successful Interrupt now has complete `totalFrames`, equal to `knownFrames`. Unrelated unknown timing remains unknown. Generic unclassified Interrupt inputs do not receive a fabricated successful timing classification.

## Files and tests

Modified:

- `src/utils/battle/battleTiming.ts`: constant, canonical timing classification and decomposition.
- `src/utils/battle/battleTypes.ts`: optional typed Interrupt timing audit.
- `src/utils/battle/battleSimulation.ts`: copy timing decomposition to the execution record; no scheduler changes.
- `src/utils/battle/battleSupport.ts`: remove obsolete canonical Interrupt timing limitation while retaining other unresolved descriptors.
- `src/utils/battleEngine.ts`: export the prelude constant.
- `src/components/BattleResults.tsx`: detail-only prelude/execution display.
- `tests/battleEngineCore.test.cjs`: update authoritative timing/support expectation.
- `tests/battleInterrupts.test.cjs`: update old Hit/Miss totals and add 15 timing regression cases covering the requested 20 semantic assertions.

Created: this report, `docs/phase-2k-g1/IMPLEMENTATION.md`.

Tests verify all supplied examples, both Interrupt Miss causes, initial-Miss exclusion, cancellation and Enemy KO, restarted AOE with one/two/three targets, send-last, multiple events, decomposition display, canonical identity and preservation of unrelated timing gaps. Existing resource tests still verify normal Hit payment and zero MP on Miss. No timing adjustment changes MP accounting or consumes RNG.

## Verification

- Complete current suite: **1,319 / 1,319 passed** (baseline 1,304 plus 15).
- Data self-checks: **57 / 57 passed**.
- Battle-skill coverage: all 11 checks passed.
- Workbook source check: passed all 68 bytes, labels, effect dictionary and provenance, using `C:\Users\rafae\Downloads\DW2 Modding Info.xlsx`.
- Both TypeScript checks: passed.
- Production build: passed, 12.20 seconds. Existing Browserslist/chunk-size advisories remain.
- Lint: unchanged baseline, **3 errors / 7 warnings**; no new finding.
- Diff whitespace checks: passed for tracked changes and this new report.

No unrelated Interrupt mechanics changed: reservation policies, executor RNG, eligibility, one-Interrupt allowance, restart locking, recovery, Confusion/Paralysis behavior, effects, boss immunities, Shadow Scythe, Counter handling and resource rules retain Phase 2K-G behavior. Run Planner schema remains v7. Earlier phase reports remain historical and are superseded by this timing correction.
