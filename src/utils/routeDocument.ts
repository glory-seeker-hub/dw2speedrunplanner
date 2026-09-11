import { RunPlan, RosterDigimon } from '@/types/runPlanner';
import { isValidPersistedRunPlannerData } from '@/utils/runPlannerStorage';
import { getStarterById } from '@/data/starters';
import { getDomainById } from '@/data/domains';
import { getBattlePreview } from '@/utils/runBattleSelection';
import { getPlanningSummary } from '@/utils/runPlanningDisplay';
import { getSpeciesProgression } from '@/data/speciesProgression';

export interface RouteDecision { name: string; learned?: string[]; kept?: string[]; discarded: string[] }
export interface RouteAction { number: number; kind: 'battle' | 'digivolve' | 'dna' | 'trade'; title: string; lines: string[]; rewards?: string; decisions: RouteDecision[] }
export interface RouteMember {
  name: string; status: string; rank: string; level: number; maxLevel: string; dp: number;
  stats: { label: string; value: number }[]; techniques: string[];
  pending: { level: number; names: string[] }[]; next: string; availableNow: boolean;
}
export interface RouteDocumentModel {
  name: string; starter: string; generated: string; battles: number; actions: RouteAction[];
  bits: number; roster: RouteMember[]; digiline: (RouteMember | null)[];
}
export interface RouteOptions { roster: boolean; digiline: boolean; techniques: boolean; rewards: boolean }
export const DEFAULT_ROUTE_OPTIONS: RouteOptions = { roster: true, digiline: true, techniques: true, rewards: true };
export const safeRouteTitle = (name: string) => {
  const clean = Array.from(name, char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char).join('');
  return `DW2 Route - ${clean.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Untitled'}`;
};

const describeMember = (member: RosterDigimon, active: boolean): RouteMember => {
  const planning = getPlanningSummary(member);
  const pending: RouteMember['pending'] = [];
  for (const item of planning.pending) {
    let group = pending.find(g => g.level === item.level);
    if (!group) { group = { level: item.level, names: [] }; pending.push(group); }
    group.names.push(item.name);
  }
  return { name: member.name, status: active ? 'Active Digiline' : 'Reserve', rank: getSpeciesProgression(member.speciesId)!.rank,
    level: member.level, maxLevel: member.levelCap.resolved !== null ? String(member.levelCap.resolved)
      : `${member.levelCap.min}–${member.levelCap.max} (unresolved)`, dp: member.dp,
    stats: (['hp', 'mp', 'atk', 'def', 'spd'] as const).map(key => ({ label: key.toUpperCase(), value: member.stats[key] })),
    techniques: [...member.techs], pending, next: planning.next, availableNow: planning.availableNow };
};

/** Projection only: authoritative validation, historical snapshots and current stored stats.
 * No progression replay, storage access, generated IDs or implicit clock reads.
 */
export const buildRouteDocument = (run: RunPlan, generatedAt: Date): RouteDocumentModel => {
  if (!isValidPersistedRunPlannerData({ schemaVersion: 7, runs: [run], activeRunId: run.id })) {
    throw new Error('This run must validate before export. Return to the Planner to review it.');
  }
  if (!Number.isFinite(generatedAt.getTime())) throw new Error('The export date is unavailable. Please try again.');
  const starter = getStarterById(run.starterDefinitionId)!;
  const actions = run.history.map((event, index): RouteAction => {
    const base = { number: index + 1, kind: event.type, decisions: [] };
    if (event.type === 'digivolve') return { ...base, title: 'Digivolution', lines: [
      `${event.fromName} → ${event.toName}`, `EL${event.level} · DP${event.dp}`, `HP +${event.hpBonus} · MP +${event.mpBonus}`] };
    if (event.type === 'trade') return { ...base, title: 'Trade', lines: [
      `${event.givenName} → ${event.receivedName}`, `Received: EL${event.receivedLevel} · DP${event.receivedDp} · Max EL${event.receivedMaxLevel}`] };
    if (event.type === 'dna') return { ...base, title: `DNA Digivolution${event.isMutation ? ' · Mutation' : ''}`, lines: [
      `${event.parentAName} + ${event.parentBName} → ${event.childName}`,
      `Actual: ${event.actualResultRank} / ${event.actualResultType}`,
      `Starting: EL${event.childStartingLevel} · DP${event.childDp} · Max EL${event.childMaxLevel}`,
      ...(event.isMutation ? [`Matrix: ${event.matrixSelectionRank} / ${event.matrixSelectionType}`] : [])],
      decisions: [{ name: event.childName, kept: [...event.techniqueChoice.kept], discarded: [...event.techniqueChoice.discarded] }] };
    // Encounter definitions are authoritative static data; participant identities come from this event's checkpoint.
    const encounter = getBattlePreview(event.encounterId)!.encounter;
    const captured = encounter.digimons.find(enemy => enemy.slot === event.capturedEnemySlot);
    const nameAtBattle = (id: string) => event.preActionCheckpoint.roster.find(p => p.instanceId === id)!.name;
    return { ...base, title: 'Battle', lines: [
      `${getDomainById(event.domainId)!.name} · Floor ${event.floor} · ${event.phase === 'before-blood-knights' ? 'Before Blood Knights' : 'After Blood Knights'}`,
      `Enemies: ${encounter.digimons.map(p => `${p.name} EL${p.level}`).join(', ')}`,
      `Participants: ${event.digilineInstanceIds.map(nameAtBattle).join(', ')}`,
      `Capture: ${captured ? `Slot ${captured.slot} — ${captured.name} EL${captured.level}` : 'None'}`],
      rewards: `+${event.xpReward} XP · +${event.bitsReward} Bits`,
      // The audit stores learned/discarded, not a complete offered/kept list. Do not invent one.
      decisions: event.techniqueChoices.map(choice => ({ name: nameAtBattle(choice.instanceId),
        learned: [...choice.learned], discarded: [...choice.discarded] })) };
  });
  return { name: run.name, starter: `${starter.label} / ${starter.name}`, generated: generatedAt.toLocaleString(),
    battles: run.history.filter(e => e.type === 'battle').length, bits: run.totalBits, actions,
    roster: run.roster.map(member => describeMember(member, run.digiline.includes(member.instanceId))),
    digiline: Array.from({ length: 3 }, (_, i) => {
      const member = run.roster.find(p => p.instanceId === run.digiline[i]);
      return member ? describeMember(member, true) : null;
    }) };
};
