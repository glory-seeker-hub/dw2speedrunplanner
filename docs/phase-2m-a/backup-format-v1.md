# Run backup format v1

This local portable JSON format restores editable Run Planner state. It is separate from the printable Route document and from Simulation Report v1. Nothing is uploaded.

| Field | Contract |
| --- | --- |
| `format` | Exact string `dw2-speedrun-planner-backup` |
| `backupVersion` | Integer `1`, the container version |
| `plannerSchemaVersion` | Integer `7`, the independent payload schema |
| `exportedAt` | UTC ISO timestamp with milliseconds, emitted by `Date.toISOString()`; informational only |
| `scope` | `active-run` or `all-runs` |
| `activeRunId` | A contained run ID or null; active-run scope requires the sole contained run's ID |
| `runs` | Nonempty array of complete canonical schema-v7 `RunPlan` values, in saved order |

The writer uses readable two-space JSON and UTF-8. Current-run export includes exactly one run. All-run export includes every saved run in array order. Empty exports are unavailable. Run names inside JSON are unmodified. File names use a bounded ASCII-safe name component, with accent decomposition and an empty-name fallback.

Unknown fields are rejected, including in nested payload structures. Required values are not coerced. Dangerous object keys (`__proto__`, `constructor`, `prototype`) anywhere in the tree are rejected before copying. The input depth is bounded at 32; the canonical format is shallower. Only JSON is parsed; strings are rendered as React text.

The import cap is 32 MiB (33,554,432 bytes), checked on file size before reading and again on UTF-8 input before parsing. Export serialization also refuses an oversized file rather than emitting a backup the importer cannot read. The limit is not a promise that localStorage has enough quota. A storage failure commits nothing.

All runs are validated before preview and revalidated before import. Structural validation is followed by the existing storage, event, roster, starter, technique, lifecycle and chronological-transition validators. External-file checks additionally require capture provenance to name an existing canonical encounter slot and inherited-technique parents to name another historical individual in the run.

Imports append; they never overwrite or merge events. Every run gets a fresh ID, checked against existing and incoming run IDs. Nested instance/event IDs are run-local and are retained. Their namespace is the new run ID; historical analysis explicitly identifies both run and event. Retaining nested IDs also preserves sorted DNA-parent ordering, inherited-technique references, checkpoints and event audits. Species, starter-definition, technique, encounter, Domain and trade-definition IDs are canonical and never regenerated.

Existing runs remain first; imports retain file order. Names only change on exact collision, using ` (Imported)`, ` (Imported 2)`, etc., accounting for earlier incoming runs too. An existing activeRunId remains unchanged, including supported null-active envelopes. In an empty Planner the mapped backed-up active run is selected, or the first imported run when the backup activeRunId is null. A dangling or missing activeRunId is invalid.

The application currently has no legacy persistence migration pipeline: only schema 7 is accepted. This phase does not invent one. Future backup versions and unsupported Planner schemas fail without mutation. A future application can add an explicit schema-7 migration after validating this stable v1 container, without reinterpreting either version number.

Excluded: tabs, open dialogs, help disclosures, Team Builder session teams, Simulator setup, exact-stat overrides, Workers/search state, Results, Simulation Reports, downloaded documents, viewport and other browser state.
