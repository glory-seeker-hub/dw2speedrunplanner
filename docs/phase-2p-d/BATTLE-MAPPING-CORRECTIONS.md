# Planner battle mapping corrections

These are Planner location/mapping corrections, not canonical combat-stat corrections.
The correction evidence is the task's confirmed rank lineups, Floor 24 location,
and same-type starter rule; the existing canonical encounters supply combat data.

## Coliseum

The sequential mapping previously assigned 8-B to 177 and 8-C to 178.
Public ordering remains A/B/C:

| Rank | Encounter | Canonical lineup |
| --- | --- | --- |
| 8-A | 176 | AeroVeedramon / Garudamon / Mammothmon |
| 8-B | 178 | WaruMonzaemon / Megadramon / Tekkamon |
| 8-C | 177 | Deramon / Blossomon / Pumpkinmon |

History labels resolve from the recorded ID; persisted events are not rewritten.

## Core Tower

Group 438 previously placed a VirusGuardian-only boss on Floor 17. It now anchors
one boss location on Floor 24, after Blood Knights. Normal Floor 17 mappings are
unchanged; no Floor 23 battle is added. The source signature remains for audit,
while the group is classified as a contextual correction (455 strict matches,
18 corrections, 473 total groups).

| Initial starter | Canonical species type | Encounter | Guardian |
| --- | --- | --- | --- |
| Gold Hawk / Agumon | Vaccine | 148 | VaccineGuardian |
| Blue Falcon / Patamon | Data | 146 | DataGuardian |
| Black Sword / DemiDevimon | Virus | 150 | VirusGuardian |

Resolution reads `RunPlan.starterDefinitionId`, then canonical starter/species
metadata; it never reads the current roster or evolved form. Selection shows one
variant per known starter, and recording rejects other variants. Boss capture
remains unavailable.

Context-free inspection returns all three variants in canonical ID order
(146, 148, 150). An unrecognized starter ID returns no option. The UI requires
a Run before recording this location, and recording validates its starter.
Historical analysis uses the recorded encounter ID from the available variants.

Canonical encounters 146, 148, 150, 177 and 178 remain unchanged, including
Guardian Level 31, HP 897, MP 804, ATK 144, DEF 141, SPD 76 and techniques.
