# Phase 2K-J — Multiple Saved Run Planner Routes

Implemented on `phase-2k-j-multiple-saved-runs` from the committed Phase I5 baseline (`51957e9`, incorporating `76c7fc6`). No commit or push performed.

## User behavior

- **New Run:** creates another saved route.
- **Switch Run:** changes which saved route is currently being edited.
- **Delete Run:** permanently removes only the selected route.

New Run preserves every existing saved route. Switching does not mutate either route. Multiple runs and the selected active ID survive reload.

## Storage audit and schema decision

The existing `PersistedRunPlannerData` already represented multiple runs as `{ schemaVersion: 7, runs: RunPlan[], activeRunId: string | null }`. The localStorage key is `dw2-run-planner`. Run IDs are strings; array order is insertion order. Phase J unlocks application/UI behavior around this existing model. **Schema remains v7; no migration was needed or added.**

`createRunPlan` constructs fresh starter state through the existing identity mechanism (`newInstanceId`: `crypto.randomUUID`, with the existing timestamp/random fallback). Each new route gets independent roster, Digiline, history and member identities, plus the authoritative starter and 1,030 starting Bits. The envelope validator rejects duplicate run IDs.

Existing names are trimmed; blank names use the starter-label default. Duplicate display names remain permitted. The existing UI length limit is 100 characters; this phase adds no name uniqueness restriction or new storage name rule. Invalid starters and invalid runtime name types are rejected by creation.

The loader deeply validates every route, roster, Digiline, history, event checkpoint and cross-event invariant. A non-null active ID must identify a contained run. Existing null-active envelopes, including ones with saved routes, remain valid. Invalid envelopes are rejected as a whole; raw storage is preserved with the existing warning that an explicit later save may replace it. No partial salvage, migration or silent deletion was introduced.

The existing save function validates the full candidate envelope, serializes it, then performs one `localStorage.setItem`. The hook publishes the new in-memory envelope only after successful persistence. No storage implementation or event payload was changed.

## Material assumptions found and corrected

| Before Phase J | Correction |
| --- | --- |
| New Run opened the destructive discard confirmation | It opens the existing starter/name creation form while preserving the active workspace |
| Creation returned false whenever an active ID existed | Fresh current callbacks can append and activate a new route while another is active |
| Creation UI existed only with no active run | Explicit transient creation mode also works with an active route |
| `resetRun` removed the active route and always cleared selection | Explicit `deleteRun(expectedRunId)` selects a deterministic survivor |
| Deleting the last route removed the storage key through a reset helper | It uses the same validated save transaction as every other route change |
| Selector showed only potentially duplicate names | It shows name, starter and insertion-order route number, retaining stable IDs for values/keys |
| Historical analysis checked source existence but not active selection | Analysis and its Results now require the source route to remain active |
| Results had no independent Planner-source tracking | Transient source tracking prevents stale Planner Results from surviving a route change |

The active-run lookup already used `runs.find(run => run.id === activeRunId)`. No application `runs[0]` assumption required replacement. Existing mutation paths already locate and immutably replace only the active route. Battle selector, history and route action controls already use route/member keys that reset their drafts when switching. The low-level `resetRunPlannerData` utility remains for compatibility with existing utility tests; the Planner UI no longer calls it. No delete-all UI was added.

## Creation, cancellation and failures

Creation appends the new route and changes activeRunId in one persisted envelope. It never deletes or clears the previous route first. Successful creation clears the name/starter draft and closes creation. A stale callback is rejected if the saved envelope changed after that callback was rendered, preventing duplicate submission against stale state.

Opening creation hides the active workspace without unmounting it. Cancel closes creation with no storage write, preserving active roster/action drafts and previews. Invalid creation, serialization errors, quota exceptions and other storage failures preserve the previous disk envelope, in-memory routes and active selection. The creation form and its draft remain available for correction or retry.

## Selection and deletion

The selector lists all validated saved runs in persisted insertion order. It uses the route's stable ID, not its display name. Selection saves activeRunId without reconstructing or mutating any RunPlan; failed selection keeps the old active route. Selecting the already-active ID does not write. Route numbers distinguish even identical names and starters; they reflect current order and can change after deletion.

The separate destructive Delete Run button captures the active route's ID and name. Its confirmation names that route and explains that only it will be removed. Cancel closes the dialog without a storage write. Confirmation passes the captured ID to the hook, which rejects stale or non-active targets. This phase exposes deletion only for the active route.

Deletion filters only that route and saves once. The survivor rule is **next route in selector order, otherwise previous, otherwise null**. Thus deleting B from A/B/C selects C; deleting C selects B. Deleting the last route persists `{ schemaVersion: 7, runs: [], activeRunId: null }` and shows the existing empty creation state. No deleted route is automatically recreated and no dangling active ID is allowed.

Failed deletion leaves memory, disk and active selection intact, retains the confirmation/error and allows retry. Quota errors use the existing persistence error message. No route eviction, history truncation, compression or partial save occurs. The transaction relies on the normal single-key localStorage write behavior; it is not a cross-tab transaction protocol.

## Route and Simulator isolation

Roster, Digiline membership/order, Bits, battle events, captures, XP/progression, undo checkpoints, evolution, DNA and trades remain scoped to the selected route. Tests compare complete sibling routes before/after mutations, including reviewed evolution/trade/DNA fixture checkpoints and undo. New runs never inherit a previous run's progress.

Historical Analyze Battle resolves the requested active run and event ID and reconstructs that route's pre-battle state. Equal event indexes in different routes are independent. A concise run name (or ID fallback) appears in the imported analysis header; it is transient preset metadata, not a persistence/schema change.

Switching routes, activating a newly created route, deleting the source route or removing its source event clears Planner-derived analysis and Results. Clearing is permanent for that local analysis: switching back cannot resurrect it. Late completion callbacks retain their source identity and are rejected from display once that source is stale. Results provenance stays tracked even when switching to manual setup, so old Planner Results cannot be relabeled as independent manual Results. Results produced from an independent manual simulation remain independent of Planner selection.

The existing keyed Simulator remounts clear local imported setups and I5 exact-stat overrides. Reopening Analyze Battle starts from the selected Planner baseline. No local exact-stat override is persisted into any run. No per-combat-action route metadata was added.

## UI states

- Empty: existing starter/name form, no delete control, no dangling selection.
- One run: active workspace, saved selector, New Run and separate Delete Run.
- Multiple runs: all routes selectable with distinct labels and persistent active selection.
- Creating: active route stays saved and workspace stays mounted but hidden; Cancel restores it.
- Deleting: named destructive confirmation; failed save retains it with an error.

The old “Discard this run and start again?” modal is absent from the New Run flow.

## Serialization characterization

Run `node scripts/characterizeMultipleRuns.cjs`. The script constructs independent routes through the production battle recorder with 20 synthetic battles per route, cycling Gold Hawk, Blue Falcon and Black Sword. Progression, rewards and undo checkpoints are retained. All three measured envelopes pass deep validation. Full output is in `storage-characterization.json`.

| Saved runs | Events per route | Total events | Serialized UTF-8 bytes |
| --- | --- | --- | --- |
| 1 | 20 | 20 | 18,767 |
| 3 | 20 | 60 | 56,145 |
| 5 | 20 | 100 | 93,457 |

These are JSON serialization sizes, **not browser localStorage quota measurements**. They do not measure browser encoding/accounting overhead, latency or maximum safe route count. Larger rosters and histories will differ. No checkpoint compression or payload redesign was attempted.

## Verification

| Check | Result |
| --- | --- |
| Full Node suite (`node --test --test-reporter=tap tests/*.test.cjs`) | **2,363 / 2,363 passed**, zero skipped; baseline 2,304 plus 59 new tests |
| Data self-checks | **57 / 57** |
| Battle-skill checks | **11 / 11** |
| Effect coverage | Passed: **598 occurrences, 100 groups, 5 unused dictionary rows** |
| Workbook source `--check` | Passed: all 68 bytes, labels, effect dictionary and provenance; original Downloads workbook |
| TypeScript app config | Passed |
| TypeScript Node config | Passed |
| Production build | Passed; existing outdated Browserslist and large-chunk warnings remain |
| Lint | **3 errors / 7 warnings**, unchanged baseline, no new findings |
| `git diff --check` plus untracked whitespace check | Passed |

The new tests cover 1/2/3/5-route creation and reload, distinct IDs/state, duplicate names, selection, every deletion position, last deletion, stale callbacks, cancellation, validation, quota/security/general storage failures, serialization failure, retry, corrupt envelopes, route mutation isolation, historical analysis/Results invalidation and I5 override isolation. The full suite includes all existing Planner, capture/progression, battle selector/recording, undo, evolution/DNA/trade, Simulator, exact-stat override, RNG policy and optimized-search regressions.

Lint debt remains limited to existing empty-interface errors in `command.tsx` and `textarea.tsx`, the existing require import in `tailwind.config.ts`, and seven existing Fast Refresh warnings. It was not changed.

### Real browser smoke

Performed through the in-app browser at isolated `http://127.0.0.1:5197/`, initially showing no active run. Created disposable Smoke A (Agumon), then used New Run to create Smoke B (Patamon) without a discard warning. Verified both selector entries, B activation and switching back to A with unchanged stats, 1,030 Bits and zero recorded actions. Returned to B and removed Patamon from its Digiline, retaining it in the roster, to create distinct saved state.

After a real reload, B remained selected with zero active Digiline members; both routes remained in the selector. Confirmed deletion of B selected intact A, with its one active Agumon and 1,030 Bits. Confirmed deletion of the final disposable A returned to the no-active-run starter form. Closed the test tab and stopped the test server. No battle was recorded in this browser smoke; event/history isolation and failure cases were verified in automated tests.

## Files created

- `tests/helpers/multipleRunFixtures.cjs` — isolated storage/hook/component fixtures.
- `tests/multipleSavedRuns.test.cjs` — 43 storage, transaction and UI tests.
- `tests/multipleRunAnalysis.test.cjs` — 16 analysis, override and route-action isolation tests.
- `scripts/characterizeMultipleRuns.cjs` — repeatable non-browser serialization characterization.
- `docs/phase-2k-j/storage-characterization.json` — measured results.
- `docs/phase-2k-j/IMPLEMENTATION.md` — this report.

## Files modified

- `src/hooks/useRunPlanner.ts` — non-destructive creation, persisted selection, explicit single-route deletion.
- `src/components/run-planner/RunPlanner.tsx` — creation/cancel, selector labels, separate named deletion.
- `src/pages/Index.tsx` — source-aware analysis and Results invalidation.
- `src/utils/runPlanner/runBattleAnalysis.ts` — optional transient source run name.
- `src/components/BattleSimulation.tsx` — imported analysis run label.
- `tests/plannerBattleNavigation.test.cjs` — navigation fixtures now carry active selection.
- `tests/runPlannerHardening.test.cjs` — existing reset-action coverage uses explicit deleteRun API.
- `tests/theme.test.cjs` — destructive control assertions use Delete Run wording.

## Scope and limitations

No battle mechanic, Planner progression rule or Simulator algorithm changed. WAZADATA, timing, damage, accuracy/status, RNG policy, optimized search, growth, XP, Bits, evolution, DNA, trade and exact-stat override behavior remain unchanged. Schema stays v7. No local override is saved into runs.

Persistence remains local and synchronous. No cloud, cross-tab synchronization, new import/export, rename/clone, delete-all, automatic recovery of corrupt routes or storage quota discovery was added. The existing Export Route feature remains. Deletion is permanent within the product and only targets the reviewed active route. No commit or push was performed.
