# Phase 2N-A implementation and verification

Completed 2026-10-04 (America/Sao_Paulo). Implementation and initial browser checks began October 3; the final manual browser check resumed October 4.

## Starting state and scope

- Canonical remote: https://github.com/glory-seeker-hub/dw2speedrunplanner.git.
- Initial checkout was already `phase-2n-a-simulator-techniques-necro-tutorial`, clean, at `790ebb33f6b3b5aebb8b03576286b0225ddaa152`.
- Fetched origin successfully; local `main`, `origin/main`, and the existing target branch all resolved to that commit. Switched through clean `main` and back to the requested branch before editing.
- No commit, push, PR, or deployment. Planner schema 7, backup format 1, report version 1, app version and dependency files unchanged.

## Necro audit and correction

`necroTarget` identifies the canonical `dead-target-remaining-mp` drain effect. `resolvePolicyTarget` already filters **all combatants**, irrespective of side, using `currentHp === 0 && currentMp > 0`, then makes the existing `necro-ko-target` draw. `assistTargetsAtExecution` delegates Necro directly to that policy. Ordinary Assist candidate lists and preselected targets are bypassed for Necro during execution.

The defect was in `assistEligible`: after revive/heal/cure checks, Necro reached the unconditional `true`. `selectableSkills`, root order enumeration, optimized search and Random selection therefore admitted it without a target. Execution subsequently missed when the pool was empty.

The new early Necro eligibility condition is exactly:

```ts
combatants.some(a => a.currentHp === 0 && a.currentMp > 0)
```

The restriction is also recognized by `restrictedByReviewedRule`. This is necessary because `legacyActionPolicy` deliberately preserves a historical fallback for other ineligible Assists: when no skill is selectable it can still plan the first Assist. A Necro-only actor with no eligible target now takes the existing skip path instead. Other Assists retain their previous behavior. A caller explicitly choosing ineligible Necro is skipped by the existing `assistEligibleAtPlanning` execution gate.

`battleActionPlans` and optimized passes use `selectableSkills`; Random and Confusion replacement use the existing action policy. No separate search or execution mechanics change was needed. No changes to MP formula, payment, drain cap, timing, target randomness, RNG label, or animation. A target that becomes depleted **after legal planning** still produces the existing 194-frame Miss, verified by a two-Necro regression.

Regression cases cover no KO, ally KO with MP, enemy KO with MP, both sides, zero-MP KO, living MP, unrelated healing Assist, root plans, Random fallback, enemy drain execution and both target draws. An old direct-execution test now expects skipped/no timing/no MP accounting for an empty initial pool. One older optimized diagnostic fixture now supplies a KO enemy with MP so it remains a legal Necro fixture. No golden files were regenerated.

## Technique filter architecture

`battleTechniqueOverrides.ts` creates all-enabled selections, resolves a detached effective team, reports changes and validates filtered selections. Reset is a fresh selection from the exact source list. Skills use `Tech.id`, which is the battle engine's skill key, not display names. Filtering intersects selected IDs with source skills, preserving order and preventing injection of unowned skills, even through stale or malformed selection values.

Combatant keys prefer Planner instance identity, then battle instance identity. Manual members without identity use slot/species keys scoped to the exact source-team object. The component never applies drafts whose source object differs from the selected source. Manual team changes clear drafts. Parent `Index.tsx` already keys Planner analysis by revision and manual setup by `manual`, so a different analyzed battle or switching to manual remounts the form. That existing lifecycle was retained.

The source is `imported.playerTeam` for Planner, with historical pre-battle techniques already supplied by the preset. No global species/progression lookup occurs. Manual teams use the exact selected saved team's skills. `structuredClone` detaches every resolved member, stat object, skill and nested effect. The only setters update local drafts and the already-local imported copy. No Planner/Team Builder persistence or mutation callback was added.

### Defaults and validation

All source techniques are enabled by default. The detached default input is deeply equal to its source. Existing characterization/golden tests all pass unchanged.

The input audit found an existing synthetic fallback in `createMember`, and Motivation Down has a separate forced Guard rule. Neither was changed. Unmodified legacy inputs (including empty-skill inputs) retain their existing behavior. If a user removes techniques and leaves no usable selected technique, the form shows a per-Digimon error and disables both optimized and Random dispatch. This prevents customization from creating a generic fallback attack. The usable-skill check matches `createMember`: exclude Alias Fake (`0xea`); retain positive-AP skills, Interrupts, or Assists. Contextual legality (e.g. Necro's target requirement) is still the engine's responsibility; optimized zero-root diagnostics remain intact.

The UI uses native labeled checkboxes inside per-slot fieldsets/legends, identifies slot and Digimon in every accessible label, supports Space/Tab, and associates validation errors with controls. All controls and resets are disabled while running; handlers also guard against changes during a run. Mobile labels wrap and fieldsets use `min-w-0`.

### Composition, reset and search

The effective pipeline is historical/manual source → exact stat resolution when imported → technique filtering → one effective Player team. That same team feeds `rootPlanInfo`, worker dispatch and selected-Player preview. The existing worker/controller/search pipeline consequently uses it in root screening, beam/depth/restart passes, all objectives and thoroughness levels, Natural/TAS policies, both accuracy modes, Random Monte Carlo, representative samples and fastest-route replay.

- Reset techniques restores the source skill list and preserves current stat drafts.
- Reset stats preserves skill selections and existing current-resource reset semantics.
- Reset imported team restores both stat and technique customizations from the original preset.
- Changing manual teams or loading another Planner analysis starts all-enabled.
- Existing tab/form unmount behavior is unchanged: returning from Results remounts setup from source rather than persisting simulation drafts. No new persistence was introduced.

Motivation Down initializes against the filtered effective skills. A regression confirms that it can still generate forced Guard and that blocked skills/status mutations never reach the source.

The root count and minimum budget update immediately. Browser examples: historical Greymon with Pepper Breath + Nova Blast against three enemies changed **6 → 3 plans / 24 → 12 minimum evaluations** after disabling Nova Blast. Manual Greymon with Air Attack + Blue Blaster against two enemies changed **4 → 2 plans / 16 → 8 evaluations**. Counts are calculated, never hardcoded.

## Reports and tutorial

Report v1 already freezes a dispatch-time `effectiveInput`, plus canonical combatant `skills`; Markdown already lists `Available techniques`. Passing the filtered team at dispatch makes all those records correct without adding redundant provenance or changing schemas. Tests inspect effective input, skill lists, Player orders, selected prefixes, fastest-route traces/replays and both serializers. Report output is independent of subsequent form resets. No report module changes were needed.

The pure `GuideSection` content model gained a small optional typed video descriptor. The `Video Tutorial` topic follows Getting Started, is initially open, and participates in existing jump navigation. `UserGuide.tsx` renders a lazy 16:9 iframe from `youtube-nocookie.com` with a meaningful title, media/fullscreen permissions, and a `Watch on YouTube` fallback using `target=_blank` and `rel=noopener noreferrer`. No dependency was added. Copy does not claim coverage of unreviewed features. Playback was not attempted; thumbnail/player presence and fallback URL were verified.

## Automated verification

| Check | Baseline | Final |
| --- | --- | --- |
| `node --test tests/*.test.cjs` | 3,151 pass, 0 fail | **3,196 pass, 0 fail**, 0 skipped/cancelled; 66,811 ms |
| `npm run lint` | 3 errors, 7 warnings | Same 3 errors, 7 warnings; no new findings |
| `npx tsc -p tsconfig.app.json --noEmit` | — | Pass (includes `src/workers`) |
| `npx tsc -p tsconfig.node.json --noEmit` | — | Pass |
| `npm run build` | Pass | Pass; existing >500 kB chunk warning |
| Data self-checks | — | 63/63 |
| `node scripts/checkBattleSkills.cjs` | — | 12/12 |
| `node scripts/checkBattleEffectCoverage.cjs` | — | 598 occurrences / 101 groups; 5 unused dictionary rows; no used deferred effects |
| Workbook import `--check` | — | Pass: all 68 bytes, labels, effects, provenance |
| `git diff --check` | Clean | Pass |

Existing lint errors: `ui/command.tsx:24` and `ui/textarea.tsx:5` empty interfaces; `tailwind.config.ts:130` require import. Existing refresh warnings: badge, button, form, navigation-menu, sidebar, sonner, toggle. No historical debt was changed.

The initial sandboxed baseline had one test-file process failure (3,138 pass + one failed file) and Vite `realpath` EPERM. Both checks were rerun outside the filesystem sandbox before editing: 3,151/3,151 and a successful build. The ordinary Python alias was unavailable; workbook validation passed with the bundled Python executable against `C:/Users/rafae/Downloads/DW2 Modding Info.xlsx`.

New coverage includes actual historical pre-learning versus post-learning presets, deep-frozen sources, duplicate display names, rejection of injected keys, all action kinds, invalid empty selections, each reset, running locks, manual source replacement/team switching, immediate root counts, stats composition, all objectives/thoroughness levels, both accuracy modes and Natural/TAS Favorable/TAS Luck in both search methods. Existing beam/restart/worker/report tests also remain green.

Reproduction logs remain as ignored local files: `phase-2na-baseline-tests.log`, `phase-2na-final-tests.log`, `phase-2na-final-lint.log`, `phase-2na-final-build.log`, `phase-2na-focused.log`. Machine-readable summary is `verification.json`.

## Browser evidence

Real integrated browser at `http://127.0.0.1:5199/`, Vite dev server. No injected browser state: synthetic historical route was generated through existing progression/backup APIs and loaded through normal Backup / Import UI. It had 14 actions and a historical Greymon with two techniques. The temporary backup file was removed after use; no user run was deleted.

- Desktop 1280×900: tutorial rendered, correct external fallback, historical techniques, root counts/budgets, custom ATK/DEF/SPD with Nova Blast disabled, running controls disabled, 64-evaluation optimized victory, three Pepper Breath Player orders and replay, reset and Planner source unchanged (ATK 55, DEF 61.5, SPD 37, both original techniques).
- Manual: built and saved Greymon with Air Attack + Blue Blaster, disabled Blue Blaster, verified root count change, ran 64 Random samples against encounter 154. Completed with 100% observed success, fastest 3,425 frames; all Player replay actions were Air Attack. Reopening source and Reset techniques restored both skills.
- Mobile 390×844: technique labels/readability, Space-key checkbox operation, last-technique validation, reset and no horizontal overflow. Technique page document width 380 with 390 viewport; guide width 390, dialog client/scroll width 362/362. Iframe approximately 299.375×168.391 on the final mobile check; desktop 682×383.625, both 16:9. Native vertical dialog/page scrolling remains usable.
- Screenshots: `techniques-desktop.jpg`, `techniques-mobile.jpg`, `tutorial-desktop.jpg`, `tutorial-mobile.jpg`.
- Console: two error entries occurred on resume while the dev server from the interrupted turn was no longer running (`Worker error`, `Simulation worker failed`). Restarting the server on the same port and rerunning the unchanged form succeeded. No further runtime errors, React key warnings or embed errors were observed. This is recorded as a recovered tooling incident, not silently reported as a clean zero-error session.

Limitations: one integrated browser engine only; no playback verification or cross-browser certification. Real downloads were not inspected in this phase; Markdown/JSON effective skills are verified through the production serializers in integration tests. No outstanding implementation blocker.

## Changed files

Application:

- `src/components/BattleSimulation.tsx`
- `src/components/help/UserGuide.tsx`
- `src/components/help/userGuideContent.ts`
- `src/utils/battle/battleActions.ts`
- `src/utils/battle/battleSupportEffects.ts`
- `src/utils/battle/battleTechniqueOverrides.ts` (new)

Tests:

- `tests/battleEffectCompletion.test.cjs`
- `tests/optimizedSearchIntegration.test.cjs`
- `tests/userGuide.test.cjs`
- `tests/simulationTechniques.test.cjs` (new)

Evidence: this document, `verification.json`, and the four screenshots listed above. All changes remain uncommitted on the requested branch.

## Follow-up — attribute-restricted Assist eligibility (2026-10-04)

Continued on the same uncommitted branch and HEAD; no new branch. This follow-up changes only `battleSupportEffects.ts`, `battleActions.ts`, new `tests/attributeAssistEligibility.test.cjs`, and these two evidence documents relative to the preceding Phase 2N-A report.

The decoded-skill audit found exactly three target-subject, attribute-qualified parameter modifiers, all field-targeted Assists:

| Canonical skill | Required opposing attribute | Decoded byte 23 mask |
| --- | --- | --- |
| Hyper Flashing — 0xB4 / 180 | Vaccine | 0x10 |
| Virus Attack — 0xB6 / 182 | Virus | 0x20 |
| Heart Break Hit — 0xD6 / 214 | Data | 0x40 |

`isAttributeRestrictedAssist` explicitly gates the three reviewed canonical IDs. Within that gate, `assistEligible` derives the required attribute from the decoded `parameter-modifier` effect with `subject === 'target'` and a defined attribute. It requires an opponent satisfying `target.side !== actor.side && target.currentHp > 0 && target.type === effect.attribute`. Thus Player actors inspect Enemy combatants and Enemy actors inspect Player combatants using the same expression; own-side matches and KO opponents cannot qualify. The ID gate deliberately avoids imposing a new global rule on future attribute-qualified effects. No attribute-name lookup table, decoder override or new alias was introduced.

`restrictedByReviewedRule` now classifies these Assists with Necro when `assistEligible` is false. `selectableSkills` and root enumeration exclude them, optimized search cannot include them, and Random policy takes the existing skip path if no legal skill remains. This prevents the historical first-Assist fallback from selecting an unusable reviewed Assist while retaining that fallback for unrelated ineligible Assists (verified with a revive skill).

Execution was not modified. Once eligible, these field Assists still apply their existing attribute check to every living field target, including matching allies. Both ATK and DEF lose one stage for matching recipients; nonmatching recipients remain unchanged. Tests verify the existing 36 MP payment and 915-frame timing for the four-combatant field fixture. Target execution, RNG, effect magnitude, stage limits and all Necro mechanics remain unchanged.

The new file adds 47 regressions: decoded inventory/mapping; each of the three skills on both actor sides with matching, nonmatching, own-side-only, KO-matching and mixed opposition; legal field execution; Random choice with an alternative attack; root and optimized strategy exclusions; zero-root behavior for Assist-only input; availability restored by a matching opponent; and unrelated fallback preservation. The focused four-file suite passes 475/475, including existing support, Necro and technique-filter tests. Final full-suite results are recorded below and in `verification.json`.

App/worker and Node TypeScript checks both returned exit 0; production build passed with only the existing large-chunk warning. Lint remains 3 errors / 7 warnings, with no new finding. Data self-checks 63/63, skill checks 12/12 and exhaustive effect coverage (598 occurrences, 101 groups, 5 unused rows) passed. No browser rerun was needed for this engine-only change; the original browser evidence and recovered server/worker incident above remain unchanged.

Final follow-up full suite: **3,243/3,243 passed**, zero failures/skips/cancellations, 76,009.7687 ms (previous Phase 2N-A: 3,196). `git diff --check` passes. The follow-up lint log is identical to the prior Phase 2N-A log. Evidence logs: `phase-2na-followup-focused.log`, `phase-2na-followup-full.log`, `phase-2na-followup-build.log`, `phase-2na-followup-lint.log` (ignored local files). No existing test expectations or golden fixtures required changes for this follow-up. No commit, push, deployment or schema/version bump.
