# Deliver the MetalKid domain-group mapping as a downloadable artifact

## Context
In a previous turn I computed the complete MetalKid → project encounter-ID mapping
(473 domain groups, 453 unique matches, 0 ambiguous, 20 unmatched). The attempt to
save it to `/mnt/documents/metalkid_domain_group_mapping.csv` was **blocked by plan
mode**, so that file does not exist today. The only surviving copy is the ephemeral
`/tmp/mk_result.txt` (verified intact: 1 header + 473 rows + summary lines, ~54 KB),
which will not persist across sessions.

## What this plan does (no project source changes)
1. Read `/tmp/mk_result.txt`, strip the trailing `SUMMARY ...` / count lines, and keep
   the clean header + 473 data rows.
2. Write the result to a persistent, cloud-backed artifact:
   `/mnt/documents/metalkid_domain_group_mapping.csv`.
3. Present it as a chat attachment via a `<presentation-artifact>` tag
   (`mime_type="text/csv"`).
4. No project files are read or modified; this is a pure artifact delivery.

## File details
- Header: `domain_name,phase,floors,is_boss,metalkid_group_id,enemy_signature,site_xp,site_bits,matched_encounter_id,match_status,candidate_encounter_ids,notes`
- 473 data rows, one per MetalKid domain group.
- Summary (for reference, not in the CSV):
  - total groups: 473
  - unique matches: 453
  - ambiguous: 0
  - unmatched: 20
  - distinct project encounter IDs uniquely matched: 137
  - 55 project encounter IDs never matched by any MetalKid group.

## Non-goals
- No edits to any file under the project (src/, etc.).
- No re-running of the MetalKid fetch/match; the existing computed result is reused.
- No inline reprint of the 473 rows.
