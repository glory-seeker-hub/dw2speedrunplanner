# Phase 2M-A — Run Backup & Import

## Baseline and scope

Work is on `phase-2m-a-run-backup-import`. Before edits, `git status --short` was empty. This branch already existed at `a2bd718`, the same commit as `main`, `origin/main` and `origin/HEAD`: merge PR #45, Phase 2L-C, whose implementation commit is `2624b8c`. It was reused without creating or moving branches. Origin fetch/push both point to `https://github.com/glory-seeker-hub/dw2speedrunplanner.git`. No commit or push was made.

Planner remains schema 7; Simulation Report remains version 1; the new backup container is version 1. No battle mechanics, search behavior, progression calculation, route-document format or Simulation Report format changed. No backend, account, auth, sync, upload, sharing, overwrite, replacement or event-merge feature was added.

## Files (report items 1–2)

Created:

- `src/utils/runPlannerShape.ts`: strict external wire structure, using the existing Zod dependency.
- `src/utils/runPlannerBackup.ts`: envelope, size checks, file read/parse, validation orchestration, serialization, names, filenames and append preparation.
- `src/components/run-planner/RunBackupDialog.tsx`: local export, file chooser, validated preview and confirmation.
- `tests/helpers/backupFixture.cjs`: production-generated rich fixture.
- `tests/runPlannerBackup.test.cjs`, `tests/runBackupDialog.test.cjs`: pure, security, UI, storage and integration regressions.
- `scripts/characterizeRunBackup.cjs`: reproducible large-file characterization and smoke fixture generation.
- This report, `backup-format-v1.md`, `verification.json`, `size-characterization.json`, `smoke-rich-backup.json`, and browser screenshot evidence in this directory.

Modified:

- `src/hooks/useRunPlanner.ts`: import via the existing write-before-memory transaction; protect unreadable existing storage.
- `src/components/run-planner/RunPlanner.tsx`: Backup / Import action beside New Run and Delete Run, including empty Planner access.
- `src/components/help/userGuideContent.ts`: two focused backup/import paragraphs in the exports section.
- `src/utils/runInstanceLifecycle.ts`: additional external-file reference validator; existing local lifecycle behavior is unchanged.

## Persistence audit (3–8)

Canonical types live in `src/types/runPlanner.ts`. There is one Planner localStorage key: `dw2-run-planner`. Its envelope is `{schemaVersion:7,runs:RunPlan[],activeRunId:string|null}`. `useRunPlanner` owns this envelope above the tab contents; `currentData` prevents stale updates. `saveRunPlannerDataResult` validates, serializes with JSON.stringify and calls localStorage.setItem before any React state change. Load uses JSON.parse followed by `isValidPersistedRunPlannerData`; invalid storage is retained with a warning. Reset is a separate existing explicit API. There is no currently active migration: non-v7 envelopes are rejected rather than guessed or silently rewritten.

Persistent RunPlan fields: `id`, `name`, `starterInstanceId`, `starterDefinitionId`, `roster`, `digiline`, `history`, `totalBits`, `createdAt`, `updatedAt`. The complete canonical object is serialized; export does not curate a subset.

Every roster member contains `instanceId`, `speciesId`, `name`, `source`, `level`, `totalXp`, `dp`, `levelCap:{min,max,resolved}`, `stats:{hp,mp,atk,def,spd}`, `techs`, and `techniquePool`. Pool entries contain `key`, `name`, `rank`, `unlock` and `sources`; unlock contains status and a level when applicable. Provenance covers starter, own species, capture encounter/slot, trade definition/given individual, DNA parents and inherited-technique parents.

All events persist `id`, `order` and `preActionCheckpoint:{roster,digiline,totalBits}`. Battle persists technique choices/optional misses, Domain/phase/floor/encounter, participant IDs, capture slot/individual/cap, XP and Bits reward snapshots. Digivolve persists individual, old/new names/species/ranks, level/DP/cap and HP/MP bonuses. DNA persists both parent IDs/species/names, child identity/species/name, matrix selection and actual rank/type, mutation flag, child starting level/DP/max level and kept/discarded techniques. Trade persists definition ID, given/received identities/species/names and received level/DP/max level. Optional fields and array ordering survive round trip.

Derived rather than persisted: activeRun lookup, summary counts, story and Coliseum progression summaries, growth estimates, milestone/technique planning, encounter previews, reconstructed historical teams, analysis provenance and route document models. UI drafts, dialogs, tab selection, manual teams, current Simulator settings, exact-stat edits, search/Worker state, Results and Reports are outside the backup boundary.

`newInstanceId` uses crypto.randomUUID with an existing timestamp/random fallback. Creation uses it for run/individual identities; recording uses it for event identities and created individuals. Runtime lookup scope, however, is run-local for instances and events. Run ordering is insertion order. Selection persists activeRunId; deletion selects the next survivor, then previous, then null. Existing null-active nonempty envelopes remain valid.

Nested topology: current Digiline and starterInstanceId point to member instances; checkpoint Digilines and battle participants point to their historical roster; captures introduce individuals; Digivolve retains one individual; Trade consumes/introduces individuals; DNA consumes two and introduces one; inherited techniques and source metadata reference historical parents. Analyze uses `{runId,battleEventId}`. No persistent cross-run references exist. Index invalidates only Planner-derived analysis/results when the source run/event ceases to match; inactive appended runs do not trigger that condition. Manual Results remain unrelated.

## Backup and export (9–21)

See `backup-format-v1.md` for all seven envelope fields and compatibility policy. Current Run exports the active canonical object only; All Runs preserves every run and its order, plus activeRunId. Export validates the source and clones it without changing selection or timestamps. With zero runs both exports are disabled and the UI explains why; Import remains available.

Filenames are `dw2-speedrunplanner-backup-YYYY-MM-DD.json` and `dw2-speedrunplanner-run-NAME-YYYY-MM-DD.json`. NAME uses Unicode decomposition, strips combining accents, replaces filesystem-unsafe/non-ASCII sequences (including emoji) with hyphens, trims and bounds at 64 characters, falling back to `run`. Embedded names remain exact. Blob MIME is `application/json;charset=utf-8`; output is pretty JSON. The object URL is revoked after the browser activation.

Actual browser-download inspection: pending. The integrated browser did not return a completed download/path for Export Current or Export All, including a retry using its accessibility click API. No browser-generated file was found in Downloads. The generated `smoke-rich-backup.json` is a fixture, not evidence of a browser download. Do not infer successful download inspection from the button actions or pure tests.

## Validation and safety (22–28)

Read errors and file size are checked before parsing; UTF-8 text size is checked again. JSON.parse is the only parser. Envelope format/version/schema checks precede strict nested structure and shared semantic validation. Unknown envelope and canonical fields are rejected without coercion. Zod describes wire structure only, not a second gameplay/migration rules engine. Authoritative rules remain in the existing storage, checkpoint, event, technique and lifecycle modules.

The external reference pass rejects nonexistent capture encounter slots and dangling/self inherited parents. It is opt-in at the file boundary: strengthening ordinary local loading initially broke synthetic compatibility fixtures, so the final implementation preserves the preexisting local-v7 validation policy. No migration or ordinary progression rule was changed.

Prototype keys are rejected throughout the tree before copying. Non-plain objects and excessive nesting are rejected. Run names and filenames are ordinary React text, including HTML-like strings. There is no eval, Function, HTML insertion or network request in production backup/import code. Unknown future backup formats and Planner schemas give explicit unsupported-version errors and commit nothing.

Cap: 32 MiB. `size-characterization.json` records a legitimate 2,018-action route, including 2,000 repeated zero-reward Coliseum events and complete checkpoints: 11,129,979 UTF-8 bytes (~10.6 MiB), versus a 33,554,432-byte limit. Initial measured parse/validation was ~1.18 s and preparation ~0.84 s; timings are descriptive, not fragile assertions. Large files can visibly block the main thread. No Worker architecture was introduced. The import cap does not guarantee browser storage quota. Export serialization also rejects output exceeding the same cap.

## Preview and merge (29–39)

The preview shows filename, export timestamp, backup/schema versions, scope, run count, each name/starter/action count, the backed-up active run and resulting collision names. It does not render event histories. Runs scroll inside a bounded list. Confirmation says `Import N run(s)`; cancelling or closing invalidates pending reads and changes no Planner state. The input resets so the same file can be chosen again. Older asynchronous file reads cannot replace a newer preview; a confirmation guard prevents double submission.

Import is append-only. All source run IDs map to freshly generated IDs; a collision retries and ultimately fails safely. Nested IDs are deliberately retained in the new run namespace, preserving all references and deterministic DNA ordering. Canonical IDs are retained. Existing objects are unchanged; incoming objects are detached clones. Repeated imports create independent selectable runs. Exact name collisions receive Imported/Imported 2 suffixes; names without conflicts are preserved. Existing order precedes incoming order. Existing activeRunId is retained; an empty Planner selects the mapped backup active ID or first imported run for null.

## Transaction and round trip (40–49)

Parsing, complete validation, names, ID mapping and the full next envelope precede persistence. Any invalid run aborts the whole import. The hook reuses a single validated localStorage.setItem; only success updates currentData/React state. Quota or unavailable storage retains both memory and prior stored payload. The dialog does not show success and keeps the preview for retry. Unreadable preexisting storage blocks import rather than treating it as empty. Reload reconstructs the complete imported envelope.

The rich fixture is generated through actual production recording APIs: Gold Hawk starter, ten training battles, Agumon→Greymon, learned Nova Blast, Crabmon capture, Wizardmon trade, second Greymon capture, Wizardmon+Greymon DNA→Patamon, Digiline changes, inherited pending techniques, another normal battle and Coliseum Rank 2-A. It has 18 actions, 15 battles, two roster members and 69,180 Bits; XP, levels, DP, caps, fractional expected-growth stats and all checkpoints are retained.

Semantic equality compares the whole RunPlan after normalizing only its fresh run ID (and collision name when present). No nested fields are ignored. Tests verify subsequent battle recording, party edits, Undo, route-document creation, hook selection/deletion, sibling isolation and reload. Every historical battle's analysis compares pre-battle teams, stats, techniques, enemy team and summary, with the new run ID in provenance.

## UI/help/browser evidence (50–58, 85)

Backup / Import is a visible, keyboard-accessible Planner action, with the existing Radix/shadcn modal title, description, close behavior and focus management. Errors use role=alert; reading/success use role=status. The input has a visible associated label and JSON accept filter. Buttons wrap, long names break, the run list scrolls internally and the dialog has a viewport height bound.

The guide retains browser-local/no-account wording and explicitly describes manual Current/All backups, local validation, preview, append-only confirmation, collisions and active-run policy. Route printing remains a readable document/PDF, distinct from backup. No guide rewrite or cloud-sync implication was introduced.

Verified in the integrated browser at isolated local origin `127.0.0.1:5186`: created temporary Backup Smoke A/B; imported the rich fixture through the real file chooser; inspected preview; cancelled and selected the same file again; confirmed import; observed original active B retained and original A/B plus TAS present; selected TAS; reloaded and saw all 18 actions/69,180 Bits/roster; Analyze Battle on the imported Coliseum event opened the correct historical Patamon (HP33/MP29/ATK41/DEF42/SPD26) and canonical opponents. A second import showed `TAS (Imported)` in preview and success with collision feedback. At 390×844, document width was 390 and dialog client/scroll widths were both 388; confirm/cancel were reachable and the mobile screenshot was visually inspected. `backup-mobile.png` records that preview.

After recovering the browser connection, malformed JSON displayed `The backup file is not valid JSON.` A 25-run preview with long unbroken names wrapped without horizontal overflow: dialog width/scroll width 378, list width/scroll width 318, list height 190 and scroll height 5,216. Confirm/cancel remained keyboard reachable. Forward Tab from Close returned to Export Current Run; reverse Tab returned to Close, proving the modal focus trap. Escape closed the dialog and restored focus to Backup / Import (verified in the resulting accessibility tree). Closing the many-run preview left exactly the four intended smoke runs in the selector. `backup-many-mobile.png` records this case; the viewport override was reset.

Browser automation also experienced command timeouts/resets and a closed-target error. Actual downloaded-file inspection remains unverified. Late reads, double confirmation, quota failure and Simulator/Results preservation are covered by component/hook tests. Do not label those as completed real-browser checks without additional evidence. Temporary smoke data used a fresh origin and did not touch valuable existing runs.

## Regression and verification (59–94)

Final machine-readable results are in `verification.json`. The full Node suite passed 3,151/3,151 tests, with zero failures/skips/cancellations: the 3,078 baseline plus 73 new backup/import tests. It covers existing Planner creation/roster/Digiline/battle/capture/XP/Bits/levels/Digivolve/DNA/Trade, multiple runs, story, Coliseum, history/Analyze, deletion and route export. It also covers Team Builder, manual and Planner-derived simulation, Random, Optimized, Fastest/Average/Success, all thoroughness modes, Natural/TAS, cancellation/progress, Reports/Markdown/JSON, navigation and Help. New integration tests show inactive imports preserve manual and Planner-derived analysis/Results, and first-run import preserves manual Results. Both TypeScript configurations, production build and git diff --check pass.

L1a narrow TAS, L2 Poison first-hit timing, L3 P-Sukamon Machine/Wing Blade Interrupt+Nature and L4 thoroughness policies are untouched. The Worker build remains `battleSimulation.worker-f6ebZAaS.js`. Data self-checks: 63/63; battle-skill checks: 12/12; coverage: 598 occurrences, 101 groups, 370 authoritative, zero used deferred and five unused rows. Workbook --check passes using the supplied workbook and bundled Python. Existing lint debt remains 3 errors/7 warnings; unrelated lint files were not edited. Build retains its existing large-chunk warning.

No commit, push, schema bump, battle/search/progression changes or cloud/backend work. Full Phase 2M-A acceptance must not be claimed until the outstanding actual browser-download inspection is completed.
