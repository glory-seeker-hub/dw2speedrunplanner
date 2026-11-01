# Phase 2P-C — MasterTyrannomon specialty

The supplied empirical BizHawk damage measurements validate canonical
**MasterTyrannomon as Vaccine / None**, correcting Vaccine / Machine.
This finding comes from in-game testing, independently of external reference data.

Power Domain F2 encounter 157 (`Master Tyrannomon`) resolves through
`getDigimonByName()` to `mastertyrannomon`. Its stats remain HP 520, MP 520,
ATK 70, DEF 60, SPD 63. In each measurement, DEF stage -2 gives effective
DEF 30. Damage comparisons use neutral terrain (`None`).

| Attacker (Virus) | ATK | Technique | AP | Specialty | Observed | Expected with None |
| --- | ---: | --- | ---: | --- | ---: | ---: |
| Okuwamon | 115 | Thunder Ray | 25 | Nature | 76 | 76 |
| Okuwamon | 115 | Pummel Peck | 25 | Machine | 76 | 76 |
| Myotismon | 117 | Evil Charm | 20 | Dark (canonical skill: Darkness) | 62 | 62 |
| Myotismon | 117 | Fire Blast | 17.5 | Fire | 54 | 54 |

Virus against Vaccine truncates ATK to 92 for Okuwamon and 93 for Myotismon.
With no specialty modifier, the existing formula gives respectively
`floor(25 × 92 / 30) = 76`, `floor(25 × 92 / 30) = 76`,
`floor(20 × 93 / 30) = 62`, and `floor(17.5 × 93 / 30) = 54`.

Thunder Ray excludes Machine (Nature receives 1.2×); Pummel Peck excludes
Dark and Water; Evil Charm excludes Fire. Fire Blast excludes the remaining
Nature possibility (1.2×, producing 65) and also contradicts Machine
(0.8×, producing 43). Together these observations empirically establish None.

The regressions use canonical techniques, the encounter adapter, and the shared
`calculateActionDamage()` implementation. Negative controls retain the old
Machine specialty for Thunder Ray and Fire Blast. A reviewed runtime self-check
explicitly enforces “MasterTyrannomon specialty is None”. No damage formula,
Phase 2P-A stage arithmetic, technique, encounter stat, or contextual mapping
changes are part of this correction.
