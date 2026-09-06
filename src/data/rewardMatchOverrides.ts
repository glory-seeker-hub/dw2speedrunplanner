/**
 * Phase 1.6a evidence from DW2_Phase1_6_Reward_Matching_Patch.json v1.
 * These source-row mappings were verified against the authoritative Data worksheet
 * using stats and techs absent from encounterRewardSource.ts. They are not guesses.
 * XP/Bits below are audit expectations only; rewards still come from the source table.
 */
export const VERIFIED_REWARD_MATCH_OVERRIDES: Readonly<Record<number, {
  encounterId: number;
  xp: number;
  bits: number;
  reason: string;
}>> = {
  18: {"encounterId":12,"xp":145,"bits":660,"reason":"Full Data-sheet stats match encounter 12 after Centaurmon→Centarumon normalization."},
  19: {"encounterId":13,"xp":189,"bits":1260,"reason":"Full Data-sheet stats match encounter 13 after Centaurmon→Centarumon normalization."},
  33: {"encounterId":154,"xp":39,"bits":280,"reason":"Gazimon/Gizamon full stats match encounter 154 after removing the non-enemy 'Boot Domain' cell."},
  52: {"encounterId":201,"xp":54,"bits":630,"reason":"Data row has MetalGreymon Lv21 stats 154/160/52/54/31 and techs Giga Blaster + Horn Buster, exactly matching encounter 201 and not encounter 189."},
  65: {"encounterId":90,"xp":1530,"bits":3060,"reason":"Full stats match encounter 90 after Piedmon→Pierrotmon and VenomMyotismon→V-Myotismon normalization."},
  105: {"encounterId":94,"xp":102,"bits":1050,"reason":"Full Data-sheet stats match encounter 94 after Centaurmon→Centarumon normalization."},
  128: {"encounterId":156,"xp":722,"bits":3280,"reason":"Full Data-sheet stats match encounter 156 after Centaurmon→Centarumon normalization."},
  138: {"encounterId":137,"xp":601,"bits":2641,"reason":"Full Data-sheet stats and techs match encounter 137 after Piedmon→Pierrotmon normalization."},
  149: {"encounterId":129,"xp":1572,"bits":4680,"reason":"Full Data-sheet stats match encounter 129 after VenomMyotismon→V-Myotismon normalization."},
  164: {"encounterId":165,"xp":0,"bits":0,"reason":"Full stats 110/110/55/55/40 and techs distinguish this Coliseum record from row 171 / encounter 172."},
  168: {"encounterId":169,"xp":0,"bits":0,"reason":"Full Data-sheet stats match encounter 169 after Centaurmon→Centarumon normalization."},
  171: {"encounterId":172,"xp":0,"bits":0,"reason":"Full stats 190/190/70/70/55 and techs distinguish this Coliseum record from row 164 / encounter 165."},
  185: {"encounterId":183,"xp":0,"bits":0,"reason":"Agumon starter stats 31/32/28/30/9 and Pepper Breath exactly match encounter 183, not encounter 200."},
};

/** Project-only records with no authoritative source reward; never invent rewards. */
export const PROJECT_ONLY_ENCOUNTERS_WITHOUT_SOURCE_REWARD: readonly number[] =
  [145,147,149,153,188,189,190,200];
