import { RosterDigimon } from '@/types/runPlanner';
import { getNormalDigivolutionRule, previewNormalDigivolution } from '@/utils/normalDigivolution';
import { getRequiredTotalXpForLevel } from '@/utils/experience';
import { PLANNER_SCOPE_MAX_EL } from '@/data/statGrowthTables';

/** Read-only presentation. Eligibility is delegated to the existing engine; no XP or stats are projected. */
export const getPlanningSummary = (member: RosterDigimon) => {
  const pending = member.techniquePool.flatMap(p => p.unlock.status === 'pending'
    ? [{ key: p.key, name: p.name, level: p.unlock.level,
      origin: p.sources.some(source => source.type === 'inherited') ? 'inherited' : 'own' }] : [])
    .sort((a, b) => a.level - b.level || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const cap = member.levelCap.resolved;
  const limit = Math.min(cap ?? member.levelCap.min, PLANNER_SCOPE_MAX_EL);
  const milestones: { level: number; label: string }[] = [];
  const reachable = (level: number) => level > member.level && level <= limit && getRequiredTotalXpForLevel(level) !== null;
  for (const level of [...new Set(pending.map(p => p.level))]) {
    if (reachable(level)) milestones.push({ level, label: `Technique learning · ${pending.filter(p => p.level === level).length} pending` });
  }
  const rule = getNormalDigivolutionRule(member.speciesId);
  if (rule && reachable(rule.level) && previewNormalDigivolution({ ...member, level: rule.level }).canDigivolve) {
    milestones.push({ level: rule.level, label: 'Digivolution available' });
  }
  if (cap !== null && reachable(cap)) milestones.push({ level: cap, label: 'MAX' });
  if (cap === null && reachable(member.levelCap.min)) milestones.push({ level: member.levelCap.min, label: 'Cap resolution required' });
  milestones.sort((a, b) => a.level - b.level);
  const nextLevel = milestones[0]?.level;
  const next = nextLevel !== undefined ? `EL${nextLevel} — ${milestones.filter(m => m.level === nextLevel).map(m => m.label).join(' · ')}`
    : cap !== null && member.level >= cap ? 'MAX reached'
    : cap === null && member.level >= member.levelCap.min ? 'Cap resolution required'
    : member.level >= PLANNER_SCOPE_MAX_EL ? `Verified XP progression ends at EL${PLANNER_SCOPE_MAX_EL}`
    : 'No upcoming milestone in verified progression';
  return { pending, next, availableNow: previewNormalDigivolution(member).canDigivolve };
};

