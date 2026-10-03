# Phase 2M-B — Pre-release audit

Audit sessions: 2026-09-28, 2026-09-29, 2026-10-02 and 2026-10-03 (America/Sao_Paulo). The baseline commit remained unchanged between sessions; Stage 2 changes are uncommitted. This document distinguishes automated tests, actual production-preview observations, source review and unavailable checks.

## Release decision

**READY WITH NON-BLOCKING KNOWN ISSUES** for the requested public release. The local candidate passed the core functional gates, and the external public-access follow-up resolved the only release blocker, R1. The reviewed dependency follow-up, historical lint baseline, bundle/Browserslist warnings, one-browser-engine limitation and all other documented LOW/MEDIUM findings remain unchanged.

**R1 — RESOLVED (originally HIGH, release-blocking):** both `https://github.com/glory-seeker-hub/dw2speedrunplanner` and `/issues` displayed GitHub's 404 page to a signed-out browser on October 2. That observation did not establish the cause. After the owner reported changing visibility from private to public, the October 3 anonymous browser recheck passed for both destinations. No repository settings were changed by the audit agent.

### R1 external/public-access follow-up — 2026-10-03, approximately 08:59 (America/Sao_Paulo)

| Check | Result | Anonymous browser evidence |
|---|---|---|
| Repository visibility and access | PASS — Public | `https://github.com/glory-seeker-hub/dw2speedrunplanner` loaded the repository, its **Public** badge, main branch, folders/files and README. Header showed **Sign in** and **Sign up**. |
| Issues access | PASS | `https://github.com/glory-seeker-hub/dw2speedrunplanner/issues` loaded the Issues heading, search/filter controls, **Open (0)** and empty-results state. Header showed **Sign in** and **Sign up**; no 404 or forced login for reading. New issue correctly points to login. |
| Candidate Source/Issues destinations | PASS | Source review of `src/components/InfoDialog.tsx` lines 69–70 confirmed that **Source on GitHub** and **Report an issue** use exactly the two successfully checked URLs. Existing `target=_blank` / `rel=noopener noreferrer` remain unchanged. |

Checks used the signed-out integrated browser without logging in. No new blocker appeared in this limited follow-up. Only `docs/phase-2m-b/PRE_RELEASE_AUDIT.md` and `docs/phase-2m-b/verification.json` were updated; no application code changed in this follow-up, and prior uncommitted Stage 2 edits were preserved. The previously passing 3,151-test suite and other application gates were not rerun for this external settings fix. No commit, push, tag or deploy was performed.

The currently published Lovable application is an older version (Team Builder default, no Run Planner). Its behavior is **not** used to fail the local candidate. Publication and post-publication smoke remain separate authorized release steps.

## Baseline (final-report items 1–6)

| Item | Evidence |
|---|---|
| Repository root | `C:/Users/rafae/Saved Games/DW2 Speedrun Planner` |
| Branch | `phase-2m-b-pre-release-audit` |
| HEAD | `8b737be04078eb1014b191a7229ce690aa75871e` |
| Subject | Merge pull request #46 from glory-seeker-hub/phase-2m-a-run-backup-import |
| Origin, fetch and push | `https://github.com/glory-seeker-hub/dw2speedrunplanner.git` |
| Starting status | Clean; `git status --short` empty |
| Main baseline | Local main, origin/main and HEAD pointed to the same merged 2M-A commit |
| Branch handling | Requested branch already existed at main; reused it. Did not create another branch or switch to main. |
| Starting tests | 3,151 passed, 0 failed/skipped/cancelled; 92.5 s |

`git branch -vv`, `git remote -v` and `git config --get remote.origin.url` were inspected. Old names in historical branch commit subjects are excluded from current-file hygiene. Remote refs were inspected locally; no claim of a fresh remote fetch is made. No AGENTS.md was found in the project.

## Stage 1: classification before edits

All source/configuration/documentation remained unedited until the repository, build, security, dependency, persistence, production UI and public-deployment audit had been performed. Generated `dist/`, ignored logs and temporary browser test data were the only outputs. Findings were classified in chat before Stage 2.

| ID | Severity | Finding | Release-blocking | Treatment |
|---|---|---|---|---|
| R1 | HIGH (original) | Canonical repository and Issues returned 404 anonymously on October 2 | Resolved; no longer blocking | Owner changed visibility; both anonymous browser checks passed October 3 |
| R2 | MEDIUM | Dependency audit: 52 affected package records, including 29 npm-high | No demonstrated reachable exploit | Individual review in DEPENDENCIES.md; separate update phase |
| R3 | LOW | README described the original prototype and omitted current Planner/backups | No | Rewritten for current users |
| R4 | LOW | Lovable placeholder description, author/social account and generic social image | No | Product metadata corrected; no invented social image |
| R5 | LOW | Credits lacked a fan disclaimer and source/support links | No | Concise disclaimer and canonical links added; R1 resolution documented above |
| R6 | LOW | Team save logged the complete team and retained a placeholder comment | No | Removed accidental debug output/comment |
| R7 | LOW | Existing HP/MP depletion policy easy to miss in help | No; intentional established model | Copy clarifies omitted recovery; no mechanics change |
| R8 | LOW | Private env files and user backup filenames lacked specific ignore rules | No secret found | Narrow ignore patterns added; fixtures remain visible |
| R9 | LOW | Historical lint: 3 errors, 7 warnings | No | Preserved; each finding classified below |
| R10 | LOW | Large main chunk and old Browserslist data warning | No | Documented; no optimization/upgrade scope expansion |
| R11 | LOW | Template package name/version, no UI release version | No | Left unchanged; version/tag recommendation below |
| R12 | LOW | Historical local paths, stale .lovable plan, unused placeholder asset, two lockfiles | No | Retained as historical/development artifacts; npm lock is verification source |
| R13 | LOW | Published app does not reflect the candidate | No candidate defect | Separate release deployment, not performed |

No substantive mechanics/search/schema/Worker fix was identified or attempted. Dependency remediation is **REQUIRES FOLLOW-UP PHASE** (MEDIUM; affected package tree and reproducible `npm audit --json` findings in the companion files). R1 was resolved by the owner's external visibility change and the anonymous recheck above.

## Release checklist

| Gate | Status | Result |
|---|---|---|
| Repository | PASS | Correct clean baseline and branch; anonymous repository and Issues access passed in the October 3 follow-up |
| Build | PASS WITH NOTE | Production build succeeds; existing chunk/Browserslist warnings |
| Tests | PASS | Full baseline suite; final rerun recorded in verification.json |
| Data | PASS | 63 self-checks, 12 skill checks, 598 occurrences / 101 groups, 370 authoritative, 0 used deferred, 5 unused rows |
| Security | PASS WITH NOTE | No exposed credential found; contextual scan, not a penetration test |
| Persistence | PASS | Schema 7 survives actual reload; quota/read failures covered by existing tests |
| Backup | PASS | Actual Current/All download JSONs inspected; downloaded Current restored append-only |
| Fresh User | PASS | Empty origin → starter → battle → progression → Analyze → Worker → Results |
| Existing User | PASS | Existing schema-7 state and imported rich route load, retain active selection and analyze |
| Simulator | PASS | Random, Optimized, three objectives/thoroughness levels, Natural/TAS, progress/cancel |
| Production Preview | PASS | Actual dist served on isolated loopback port 5198 |
| Responsive | PASS WITH NOTE | 390×844 core surfaces and long backup list; bounded smoke only |
| Accessibility | PASS WITH NOTE | Keyboard/labels/dialog/focus/selected-state smoke, not WCAG certification |
| Metadata | PASS WITH NOTE | Correct title/description, existing valid icon; no bespoke social card |
| README | PASS | Current features, local data, exports, limits, development, feedback |
| Deployment | PASS WITH NOTE | Static output has no required backend/env; Lovable project settings unavailable |
| Public URL | PASS WITH NOTE | Loads an older published app; not the release candidate |
| Known Issues | PASS | Classified explicitly, including all lint and dependency records |
| Release Decision | PASS WITH NOTE | READY WITH NON-BLOCKING KNOWN ISSUES; R1 resolved, existing non-blocking findings preserved |
| Additional browser engine | NOT AVAILABLE | Only integrated Chromium-equivalent browser available |
| Full network capture/offline toggle | NOT AVAILABLE | Browser API exposes logs, not network recording or offline emulation |
| Native print/PDF output | NOT AVAILABLE | Readable route preview and print handler verified; OS print output not inspected |

## Repository hygiene (7–11)

Tracked-file scan covered 478 baseline files. No current tracked references to either legacy GitHub username were found. No old namespace is used in runtime/README/package links. Localhost/loopback/ports occur in historical QA documentation and Vite's development port; numeric 5173/5186 in canonical data are data values. Absolute personal workbook paths occur in historical phase reports, not runtime dependencies. This document records the requested local root once for baseline provenance. No historical files were broadly rewritten.

The runtime TODO/debug scan found the removed `Team saved` console log/comment. DEV-gated validators/Worker diagnostics and the explicit NotFound console error are intentional. No debugger statement or accidental alert/mock-data flow was found. Technical Details is a deliberate diagnostic disclosure. The build contains no fixture run names, phase report paths or local machine strings from the scan.

Tracked screenshots and JSON reports belong to phase validation. `docs/phase-2m-a/smoke-rich-backup.json` is a generated test fixture, not a discovered personal export. No tracked logs, env files, user backups, IDE user state or >1 MB files were found. `.lovable/plan.md` is a stale historical artifact-delivery plan with `/tmp` and `/mnt` paths, not app/deployment configuration. `public/placeholder.svg` is unused and harmless. `bun.lockb` coexists with `package-lock.json`; npm is the audited workflow. Preserve legitimate history/assets.

## Security, privacy and dependencies (12–17)

Tracked text and production output were searched for API_KEY, SECRET, TOKEN, PASSWORD, PRIVATE_KEY/private-key headers, Supabase/Firebase, Authorization/Bearer, GitHub token patterns, legacy names and machine paths. Matches were ordinary CSS/validation/request tokens and package names; no private credential was identified. Binary lock/icon/image files are not claimed to have had a full secret-content analysis. No `.env` file is tracked or required; production uses no configurable credential. `.env`/`.env.*` are now ignored except `.env.example`.

Backups are explicitly generated as local Blob downloads and imported through `File.text()`. Planner persistence uses localStorage. No application fetch, XHR, beacon, WebSocket, analytics, backend or upload endpoint was found in the runtime source. Logs during the primary preview flows contained no failed-request or Worker error messages. This is source review plus console observation, **not a full HTTP traffic capture**. No unexpected upload was observed; no network-capture capability was available. Backup download files remain outside the repository; narrow exported-name patterns prevent accidental addition without hiding JSON fixtures.

The [dependency review](DEPENDENCIES.md) and [machine-readable audit](dependency-audit.json) classify every affected package, installed versions, dev/shared tree, advisory and production relevance. Snapshot: 52 affected package records (29 high, 18 moderate, 5 low, 0 critical), including transitive propagation. React Router is bundled, but current code uses fixed BrowserRouter routes and no untrusted redirect, data router or SSR hydration entry. Recharts/lodash are installed but the chart module is unreachable from the application entry. Build/lint/CSS/glob tooling does not execute on a static production host. These observations lower current release exposure, not the advisory severity or need for updates. Prioritize a separate router/toolchain security update. No `npm audit fix`, install, lock rewrite or dependency upgrade was performed.

## Package, metadata, documentation (18–31)

Package remains `vite_react_shadcn_ts`, version `0.0.0`, private `true`, ESM. Scripts remain dev, build, build:dev, lint and preview. Repository/homepage/bugs fields are absent in package.json and were not made mandatory. No manifest/service worker or offline installation feature exists. The package and npm lock metadata remain consistent.

HTML title now identifies **Digimon World 2 — Run Planner & Battle Simulator**. Description/OG/Twitter describe route planning, browser-local backups and bounded search. Canonical/OG URL points to the specified Lovable root; theme color matches the dark presentation. Removed template author/Twitter account and generic remote social image; a custom social image is optional and no art was generated. The existing favicon file is retained and explicitly referenced; local production resolution was checked. No unverified exact/guaranteed/fully-accurate claim was introduced.

Credits keeps the existing creator/Twitch attribution, adds the concise unofficial disclaimer once, and provides accessible canonical Source/Issues anchors with `target=_blank` and `rel=noopener noreferrer`. Both exact destinations passed the October 3 anonymous browser follow-up, resolving R1. Twitch HTTP verification was limited by the network tool's TLS/fetch errors; the existing link was preserved.

No UI version label was added and no duplicate hard-coded version source introduced. Eventual recommendation: set the approved package release to `1.0.0`, derive any UI version from package/build metadata through one helper, then tag `v1.0.0` in the separately authorized release step. No current claim of v1.0 is made.

README now explains the live/source distinction, Planner/manual flows, local storage, explicit restorable backups, route versus simulation exports, bounded search, resource policy, no cloud sync, Issues and npm development/build commands. How to Use, Battle Mechanics and Results agree on quality versus thoroughness, budget as a ceiling, optional unused budget, Player-decision round depth, fair versus fastest observations and narrow TAS scope. A copy-only clarification makes the established non-blocking player HP/MP depletion model explicit. Prior HP0 continuation observed in replay is intentional (Phase 2K-D), not a newly introduced mechanics defect. False-certainty searches found limitations/negations, not promises of a global optimum.

## Build and production preview (32–44)

Both app and node TypeScript checks pass. Normal `npm run build` produces `dist/`; no machine-specific path or missing backend is required. Existing installed dependencies/lockfile were used; a clean `npm ci` installation was not independently reproduced. No lockfile deletion or install workaround occurred.

Final build: 1,890 modules. Main JS approximately 1.16 MB / 283 KB gzip; Worker approximately 316 KB; CSS 69 KB / 12.65 KB gzip; creator JPEG 37.9 KB; HTML 1.51 KB / 0.54 KB gzip. Large-chunk and stale Browserslist warnings persist; no accidental large fixture/media payload was found. Worker filename/hash remains `battleSimulation.worker-f6ebZAaS.js` across the presentation edits. No source maps were emitted. Dist contains HTML/assets/favicon/robots/unused placeholder SVG; no test/report tree.

`npm run preview -- --host 127.0.0.1 --port 5198 --strictPort` serves the actual production build. Initial fresh origin had no active run; Results was disabled and Planner selected. Worker loaded and executed both methods, returned results and cancelled promptly. Normal root reload restored persisted runs; tabs do not create separate router paths. Roster/battle anchors are local hashes. The app has root and NotFound routes; a static host should retain its SPA fallback. No persistent uncaught exception, React warning, missing asset or Worker error was observed in captured primary-flow console logs. No full network waterfall was available.

## Browser workflows and data safety (45–77)

1. Fresh origin: created **Release audit temporary**, Gold Hawk / Agumon. Initial 1,030 Bits, EL1, empty history, one roster/Digiline member. Boot Domain Floor 1 encounter 154 recorded +39 XP and +280 Bits, EL2 and 1,310 Bits. History contains exactly one action.
2. Analyze Battle opened the historical EL1 copy (HP31/MP32/ATK28/DEF30/SPD9), not the live EL2 state. Random/Natural 64 samples completed via production Worker and Results displayed sample/replay output; optimized thoroughness controls were absent in Random.
3. Optimized Standard/Fastest budget 256 completed, with screening 4→16→64, maximum depth 6 and complete fastest observed route. Thorough/Average completed and displayed Selected Average Victory Strategy and 128 fair samples. Returning to setup remounts defaults, so that smoke used the default 100,000 ceiling; it finished early. This was observed rather than claimed as preserved custom state.
4. Maximum/Success/TAS used default 100,000 ceiling; progress showed ~42,096 evaluations, 751 evaluations/s, conditional TAS statistics and remained interactive. Cancel returned partial Results immediately, with 256 fair samples. A separate explicitly bounded Maximum/Fastest/Natural 512 run completed. No million-evaluation job or global-optimum claim. Timing is a sanity observation, not an L4 benchmark comparison.
5. Results maintained main result, intended Player orders, relevant conditional TAS note, fair strategy statistics, Top Screened Strategies, Search Details, concrete replay and Technical Details. Keyboard expanded Search Details; no invented winning route or changed semantics was introduced by this phase.
6. Imported the production rich fixture through the real file chooser. Preview identified v1/schema7 and 18 actions. Cancel removed preview without import; choosing again and confirming appended TAS, preserving original active run. Reload retained both. TAS showed 69,180 Bits, 15 battles, 18 actions, Greymon/Patamon roster and correct DNA/trade/history content.
7. Analyze on imported Coliseum Rank 2-A used historical Patamon HP33/MP29/ATK41/DEF42/SPD26 and the canonical Patamon/ToyAgumon/Gizamon enemies. Optimized 128 completed on this imported historical state.
8. Repeat fixture import produced TAS (Imported). Real Current and All export buttons created actual JSON files in Downloads despite download-event waits timing out. Current: **58,155 bytes**, one TAS run/18 actions/69,180 Bits. All: **119,582 bytes**, original + TAS + TAS (Imported). Both parse through the production validator and round-trip through serialization without semantic change.
9. Imported the **actual downloaded Current JSON**. Preview named the new copy TAS (Imported 2); confirmation succeeded. Reload then showed all four runs, with original TAS still active and original run preserved. This directly closes the earlier Phase 2M-A actual-download evidence gap. Filenames use UTC date 2026-10-03; the local observation was October 2 in America/Sao_Paulo. Download files were not added to the repo.
10. Malformed JSON produced the friendly `The backup file is not valid JSON.` alert without mutation. An earlier file-picker/read attempt failed with a friendly read error, then succeeded using a normalized file path/session. No data loss was observed. A 25-run long-name preview was measured and cancelled; those runs were not imported.
11. Export Route opened the rich readable route with all 18 ordered events, final roster/Digiline and Print / Save as PDF control. Native OS printing/PDF output was not inspected. Existing route/print tests cover the handler; it remains separate from restorable backup JSON.
12. Initial Simulation Markdown download event waits did not provide a filesystem path. On October 3 the final production build exported an actual **59,348-byte Markdown file** to Downloads for Coliseum Rank 2-A. Inspected Report version 1, historical TAS/action18/69,180 Bits provenance, battle context and bounded-search explanations. The final Optimized budget64 run completed and console errors/warnings remained empty. Simulation Report JSON remains programmatic serialization, not an invented UI download button; Markdown/JSON freeze/provenance tests passed in the full suite. Other unrelated existing downloads were not treated as audit evidence.

Storage and import tests cover corrupt JSON, unsupported versions, quota/unavailable writes, late file reads, double confirmation, duplicate IDs/names, active-run preservation, no-overwrite append, chronological invariants and reload. Browser schema-7 loading was directly exercised, including across session restarts. Failure injection for quota/corrupt existing storage is automated evidence, not a claimed browser storage injection. Schemas and backup semantics are unchanged.

## Responsive/accessibility (78–84)

Desktop and 390×844 were inspected. Narrow Planner, Simulator, Results and Team Builder document width was 380 with a 390 viewport (scrollbar allocation), with no horizontal page overflow. Backup dialog: page390, dialog client/scroll378, long-list client/scroll318, list height190 versus content5216. Confirm/cancel remained reachable by vertical scrolling and keyboard; long uninterrupted names wrapped. About/guide dialog also fit the viewport.

Top tabs expose selected state, controls use pressed/checked semantics, form labels and dialog names are present, history filters expose state, and errors/status messages use alert/status roles. Yellow selection is supplemented by aria-selected. Keyboard activated new-run/starter/record/analyze/simulator controls and disclosure headings; tab focus stayed inside About/Backup, Escape closed About and restored its trigger. Backup forward Tab wrapped Close→Export Current. Focus-visible styles remain in shared controls. Delete confirmation, complex Team Builder editing and every possible tab-order path were source/test reviewed, not exhaustively keyboard-certified. No WCAG certification claimed. Only one Chromium-equivalent integrated engine was available.

## Deployment/offline/public state (85–88)

Lovable public URL loaded an older app with Team Builder default, no Run Planner and older data presentation. It is not the tested release candidate. Local configuration supports static hosting: production tagger disabled, Worker emitted with resolved asset URL, no secrets/env/backend prerequisite. Authenticated Lovable project settings were not available; the stale `.lovable/plan.md` is not proof of deployment configuration.

Planner/backup logic and already loaded data operate locally by design. No service worker or asset pre-cache exists; a new Worker creation, reload or uncached asset can require network. Browser offline emulation was unavailable, so disconnected behavior was characterized from architecture rather than falsely marked as experimentally verified. No PWA/offline guarantee.

## Quality and lint (89–97)

Full baseline and post-source-change results are recorded in verification.json: **3,151/3,151 passed**, zero failures/skips/cancellations; final suite 123.5 seconds. The full suite includes backup/import, multiple runs, route history, analysis, story/Coliseum, Team Builder, Random/Optimized, all objectives and thoroughness, Natural/TAS, progress/cancel, Results, reports/Markdown/JSON, route export, guide/navigation/accessibility, L2 Poison and L3 corrections. No expectations were weakened or mechanics rewritten. Data/skill/effect/workbook checks passed before presentation-only edits; unchanged data/engine do not require a new mechanics benchmark. TypeScript/build/lint were rerun after all application edits. Final browser verification confirmed the revised Credits and resource-limit guide, persistent rich route, Worker/Results and actual Markdown export. Final dist scan found no searched local/legacy/fixture/credential markers, no maps; favicon returned HTTP200. Only audit documents changed after these checks; final JSON consistency and diff whitespace checks were then run.

| Lint location | Rule | Classification and future handling |
|---|---|---|
| ui/badge.tsx:30 | react-refresh/only-export-components | LOW, harmless HMR export debt; optional component/constants split |
| ui/button.tsx:47 | same | LOW, harmless HMR export debt; optional split |
| ui/command.tsx:24 | no-empty-object-type | LOW, empty interface equivalent to parent type; safe future type alias |
| ui/form.tsx:129 | react-refresh/only-export-components | LOW, harmless HMR export debt; optional split |
| ui/navigation-menu.tsx:111 | same | LOW, harmless HMR export debt; optional split |
| ui/sidebar.tsx:636 | same | LOW, harmless HMR export debt; optional split |
| ui/sonner.tsx:27 | same | LOW, harmless HMR export debt; optional split |
| ui/textarea.tsx:5 | no-empty-object-type | LOW, empty interface equivalent to parent; future type alias |
| ui/toggle.tsx:37 | react-refresh/only-export-components | LOW, harmless HMR export debt; optional split |
| tailwind.config.ts:130 | no-require-imports | LOW, working build plugin import style; future ESM import cleanup |

All ten are non-blocking historical debt, with no newly introduced finding. `npm run lint` remains nonzero by design, not presented as clean. Dependency audit is nonzero and explicitly reviewed. Final `git diff --check` is recorded after report completion.

## Stage 2 changes (98–100)

| File | Reason |
|---|---|
| README.md | Replace obsolete prototype/template instructions with current product/development/limits/privacy guide |
| index.html | Coherent metadata, canonical URL, icon reference, remove generic social attribution/image |
| src/components/InfoDialog.tsx | Fan disclaimer and canonical source/support links |
| src/components/help/userGuideContent.ts | Explain existing resource-depletion policy without changing it |
| src/pages/Index.tsx | Remove accidental saved-team console output and placeholder comment |
| .gitignore | Ignore private env and actual exported backup filenames; retain fixtures |
| docs/phase-2m-b/* | Audit, evidence, dependency review and final verification |

No feature, mechanics, RNG, search, progression, storage migration, schema, backup format or Worker architecture changes. No dependency or release-version bump.

## Known issues, versions and next actions (101–117)

- No remaining release blocker: R1 (originally HIGH) anonymous Source/Issues 404 resolved by the owner's visibility change; successful anonymous rechecks and historical evidence above.
- MEDIUM: separately prioritize reviewed router/toolchain dependency updates; no currently reachable advisory exploit demonstrated.
- LOW: ten historical lint findings; large main bundle; old Browserslist data; placeholder package name/0.0.0 version; unused template SVG/stale plan; one-engine coverage and native print/full network/offline test limitations. No app crash or data-loss blocker was found in tested paths.
- Planner schema **7**, Simulation Report **1**, Backup Format **1** unchanged. Eventual app version/tag recommendation: **1.0.0 / v1.0.0**, only after acceptance.
- Next: review this diff and dependency follow-up; explicitly approve version/tag/release/deployment separately. After authorized deployment, smoke the newly published root, Worker, imports and exports on the public origin. Keep browser-local backups before changing origins.
- Unavailable checks are identified above rather than marked PASS: additional engine, full HTTP trace/offline toggle, authenticated Lovable settings, native print output, clean-room dependency installation. Existing browser/source/unit evidence is scoped explicitly.
- **No commit. No push. No merge. No tag. No GitHub Release. No production publish/deploy.**
