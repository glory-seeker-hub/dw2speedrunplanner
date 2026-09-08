import { RunEvent } from '@/types/runPlanner';
import { DOMAIN_PHASES, DomainPhase } from '@/types/encounter';
import { isValidRunActionCheckpoint } from '@/utils/runActionCheckpoint';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { previewNormalDigivolution } from '@/utils/normalDigivolution';
import { isValidLevelCap } from '@/utils/levelCap';

const nonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const integer = (v: unknown, min: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min;
const reward = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Validate the discriminant before accessing variant fields. Never replay history. */
export const isValidRunEvent = (value: unknown): value is RunEvent => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (!nonEmptyString(v.id) || !integer(v.order, 0) || !isValidRunActionCheckpoint(v.preActionCheckpoint)) return false;
  const checkpoint = v.preActionCheckpoint;
  if (v.type === 'battle') {
    return nonEmptyString(v.domainId) && DOMAIN_PHASES.includes(v.phase as DomainPhase) &&
      integer(v.floor, 1) && integer(v.encounterId, 0) &&
      Array.isArray(v.digilineInstanceIds) && v.digilineInstanceIds.length > 0 &&
      v.digilineInstanceIds.length === checkpoint.digiline.length &&
      v.digilineInstanceIds.every((id, index) => id === checkpoint.digiline[index]) &&
      (v.capturedEnemySlot === undefined || v.capturedEnemySlot === null || integer(v.capturedEnemySlot, 1)) &&
      reward(v.xpReward) && reward(v.bitsReward);
  }
  if (v.type !== 'digivolve' || !nonEmptyString(v.instanceId) ||
      !nonEmptyString(v.fromSpeciesId) || !nonEmptyString(v.toSpeciesId) ||
      !nonEmptyString(v.fromRank) || !nonEmptyString(v.toRank) ||
      !integer(v.level, 1) || !integer(v.dp, 0) || !isValidLevelCap(v.levelCap) ||
      v.hpBonus !== 30 || v.mpBonus !== 30) return false;
  const before = checkpoint.roster.find(member => member.instanceId === v.instanceId);
  if (!before || before.speciesId !== v.fromSpeciesId || before.level !== v.level || before.dp !== v.dp ||
      before.levelCap.min !== v.levelCap.min || before.levelCap.max !== v.levelCap.max ||
      before.levelCap.resolved !== v.levelCap.resolved ||
      getSpeciesProgression(before.speciesId)?.rank !== v.fromRank ||
      getSpeciesProgression(v.toSpeciesId)?.rank !== v.toRank) return false;
  const preview = previewNormalDigivolution(before);
  return preview.canDigivolve && preview.targetSpeciesId === v.toSpeciesId;
};
