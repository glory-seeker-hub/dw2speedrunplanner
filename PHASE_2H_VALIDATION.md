# Phase 2H validation and hardening

Schema remains **v7**. Gameplay data, formulas, event types, trade repetition,
technique inheritance and learning milestones are unchanged.

## Chronological validation

`validateInstanceLifecycle` makes one chronological pass. Each event is replayed
once by `deriveActionPostState`, using existing progression, capture, normal
Digivolution, DNA and Trade helpers. Recording APIs are never called from replay.
Capture and starter reconstruction receive injected historical IDs, so validation
does not allocate identities, write storage or mutate input.

The complete ordered roster and exact total Bits are compared with the next
event's checkpoint, or the current run for the final event. Roster equality
includes instance ID, species ID/name, source, EL, XP, DP, cap, fractional stats,
possessed techniques and the entire technique pool, including provenance and
pending/missed/discarded state. Object property order does not matter; array order
does. Every unaffected survivor is included.

Digiline is intentionally excluded from adjacent-state equality: supported
Digiline edits are unlogged. Each checkpoint/current Digiline still independently
requires unique current roster IDs and at most three members. Undo restores the
checkpoint's Digiline, including discarding later unlogged edits.

Battle location, authoritative rewards, learning decisions, participant
progression and exact capture initialization are replayed. Normal evolution
reuses its complete pure transformation; DNA and Trade reuse their pure proposals
and ordered replacement rules. All non-battle events preserve Bits.

Original starter state is checked against its authoritative starter definition in
the first checkpoint, or the current roster when history is empty. Consumed
starters remain valid through their historical state. Canonical name/ID agreement
and minimum cumulative XP for a known current EL are validated in current roster
and checkpoints. All recordable capture identities pass without new exemptions;
unknown special-entity fallback identities are not assigned invented mappings.

## UI and persistence

Create, select and reset read the current envelope ref when invoked. Old select
callbacks cannot restore old runs. Reset confirmation retains its expected run
ID. Ordinary battles retain the render's run identity and complete serialized
run-state snapshot; changed participants, Digiline or committed state require a
fresh review. Harmless rerenders with identical content remain accepted.
Technique selections additionally require their frozen expected-state token.
Existing individual snapshots continue guarding evolution, DNA and Trade.

Invalid stored data produces a warning and remains untouched until an explicit
new save replaces it. Empty storage has no warning. Quota failures receive
specific feedback and preserve both visible and persisted committed state.
Other storage failures remain non-destructive. The UTF-8 size helper measures
serialization only and does not predict browser quota accounting.

## Reproducible checks

```powershell
node --test tests/runPlanner.test.cjs tests/runPlannerHardening.test.cjs
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.node.json --noEmit
npm run build
npm run lint
```

The test suite includes the 46 data self-checks. Verification on 2026-09-10:
569/569 tests, 46/46 self-checks, both TypeScript checks and production build pass.
Lint remains at the historical 7 errors / 7 warnings, all in unchanged files.
Build retains the existing large-chunk and old Browserslist-data warnings.

### Test boundaries

The 508 legacy tests contain synthetic progressed-starter fixtures. Their module
loader explicitly doubles only `validateStarterBinding`; all chronological
transition validation remains real. These cases are isolated mechanics/component
tests, not evidence that synthetic initial origins are acceptable in production.

The separate 61-test hardening suite uses an independent production module graph
without gameplay/validation doubles. Its React hook host and in-memory storage
simulate browser interfaces; quota failures are intentionally injected.

Six long scenarios pass:

1. Fresh authoritative starter, battles, evolution, learning/discard, reload and
   complete Undo.
2. Real Crabmon capture, Wizardmon trade, DNA, inherited learning, reload and Undo
   through Trade and Capture.
3. Three DNA generations with actual captures, normal evolution, a Trade, learning
   choices and midway reload; complete Undo restores the original run.
4. Pending/kept/discarded branches from one saved state, with Undo between paths.
5. A real five-generation lineage reaches 13 candidates at EL32. Zero/13 retained
   choices reject; one/12 succeed. Quota failure is atomic and Undo is exact.
6. Real Cherrymon/MasterTyrannomon Vademon mutation, actual Ultimate EL21 birth,
   EL22 learning, subsequent progression, reload and Undo.

The suite also includes 24 independent corruption regressions, stale callbacks,
starter consumption, all nine real capture/Trade paths, deterministic replay,
local Digiline validation and representative event adjacency pairs. Existing
Yanmamon/SandYanmamon and technique-learning regressions remain passing.

## Representative performance

Measured with six members acquired through real capture actions, three active
participants and repeated real battles. Median of five standalone validation
calls; timings are machine-dependent and exclude rendering/storage I/O.

| Actions | Serialized UTF-8 bytes | Median validation |
|---|---:|---:|
| 100 | 345,276 | 4.98 ms |
| 300 | 1,045,594 | 10.95 ms |

Validation is a single linear history pass, with work proportional to each
checkpoint's roster/pool size. An earlier run under parallel build load measured
6.10 ms and 22.22 ms respectively. Building a route by repeatedly appending actions
still revalidates its growing history on each commit. No compression, truncation
or storage-backend change was introduced.

## Browser QA actually performed

Smoke-tested the production build on isolated localhost port 4178: fresh Gold
Hawk run, ordinary SCSI Floor 1 battle, exact-slot Biyomon capture, add/reorder
Digiline, another battle after that unlogged reorder, chronological history,
reload, and confirmed Undo after reload. Bits, XP and ordered participants
restored correctly. Evolution, DNA, learning/discard, active/reserve Trade,
starter consumption, mutation, overflow and stale run switching were verified
automatically rather than manually repeated in this browser session.

## Remaining limitations

- Authoritative XP ends at EL50 even when individual caps are higher. Existing
  progression behavior is retained and the cap display now explains the limit.
- Independent tabs can overwrite one another; cross-tab conflict/revision
  synchronization is deferred.
- Larger rosters and richer provenance increase checkpoint storage substantially.
  Quota failures are reported but storage is not compressed or migrated.
- Replay uses the currently bundled authoritative data. There is no historical
  data-version migration or recovery editor; invalid saves are retained with a
  warning.
- Roster/history layout redesign and expanded pending-technique presentation are
  deferred.
