import type { PlannerBattleMember } from '@/utils/runPlanner/runBattleAnalysis';
import type { DigimonStats } from '@/types/digimon';

export const EXACT_STAT_FIELDS = ['hp', 'mp', 'atk', 'def', 'spd'] as const;
export const SIMULATION_FIELDS = [...EXACT_STAT_FIELDS, 'currentHp', 'currentMp'] as const;
export type SimulationField = typeof SIMULATION_FIELDS[number];
export const STAT_LABELS: Record<SimulationField, string> = { hp: 'Max HP', mp: 'Max MP', atk: 'ATK', def: 'DEF', spd: 'SPD', currentHp: 'Current HP', currentMp: 'Current MP' };
export type PlayerStatDrafts = Record<string, Record<SimulationField, string>>;
export interface PlayerStatProvenance {
  source: 'planner-baseline' | 'custom-simulation-stats';
  players: { instanceId: string; slot: number; name: string; changes: { stat: keyof DigimonStats; planner: number; simulation: number }[];
    currentHp: number; maxHp: number; currentMp: number; maxMp: number }[];
}
export function createPlayerStatDrafts(team: readonly PlannerBattleMember[]): PlayerStatDrafts {
  return Object.fromEntries(team.map(m => [m.plannerDigimonInstanceId, {
    hp: String(m.customStats.hp), mp: String(m.customStats.mp), atk: String(m.customStats.atk), def: String(m.customStats.def), spd: String(m.customStats.spd),
    currentHp: String(m.currentHp ?? m.customStats.hp), currentMp: String(m.currentMp ?? m.customStats.mp),
  }]));
}
/** Text stays in drafts; only valid integers enter the detached numeric model. */
export function resolvePlayerStatDrafts(baseline: readonly PlannerBattleMember[], drafts: PlayerStatDrafts) {
  const errors: Record<string, Partial<Record<SimulationField, string>>> = {};
  const team = structuredClone(baseline) as PlannerBattleMember[];
  for (const m of team) {
    const id = m.plannerDigimonInstanceId, row = drafts[id];
    const fieldErrors: Partial<Record<SimulationField, string>> = {};
    for (const field of SIMULATION_FIELDS) {
      const text = row?.[field] ?? '', value = Number(text);
      const minimum = field === 'def' || field === 'spd' ? 1 : 0;
      if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < minimum) {
        fieldErrors[field] = `${STAT_LABELS[field]} must be a ${minimum ? 'positive' : 'nonnegative'} safe whole number.`;
        continue;
      }
      if (field === 'currentHp' || field === 'currentMp') {
        const max = field === 'currentHp' ? m.customStats.hp : m.customStats.mp;
        if (m[field] === undefined && value === max) delete m[field]; else m[field] = value;
      }
      else m.customStats[field] = value;
    }
    if (!fieldErrors.currentHp && !fieldErrors.hp && m.currentHp! > m.customStats.hp) fieldErrors.currentHp = 'Current HP cannot exceed Max HP.';
    if (!fieldErrors.currentMp && !fieldErrors.mp && m.currentMp! > m.customStats.mp) fieldErrors.currentMp = 'Current MP cannot exceed Max MP.';
    if (Object.keys(fieldErrors).length) errors[id] = fieldErrors;
  }
  return { team, errors, valid: !Object.keys(errors).length };
}
export function resetPlayerStatDrafts(baseline: readonly PlannerBattleMember[], drafts: PlayerStatDrafts): PlayerStatDrafts {
  const restored = createPlayerStatDrafts(baseline);
  for (const m of baseline) {
    const id = m.plannerDigimonInstanceId;
    restored[id].currentHp = drafts[id].currentHp; restored[id].currentMp = drafts[id].currentMp;
  }
  return restored;
}
export function playerStatProvenance(baseline: readonly PlannerBattleMember[], effective: readonly PlannerBattleMember[]): PlayerStatProvenance {
  const players = baseline.map((m, index) => {
    const e = effective.find(e => e.plannerDigimonInstanceId === m.plannerDigimonInstanceId)!;
    return { instanceId: m.plannerDigimonInstanceId, slot: index + 1, name: m.digimon.name,
      changes: EXACT_STAT_FIELDS.filter(stat => m.customStats[stat] !== e.customStats[stat]).map(stat => ({ stat, planner: m.customStats[stat], simulation: e.customStats[stat] })),
      currentHp: e.currentHp ?? e.customStats.hp, maxHp: e.customStats.hp, currentMp: e.currentMp ?? e.customStats.mp, maxMp: e.customStats.mp };
  });
  return { source: players.some(p => p.changes.length) ? 'custom-simulation-stats' : 'planner-baseline', players };
}
