import { captureTargetForSlot, type BattleCaptureTarget } from '@/utils/battle/battleCaptureObjective';
import type { RosterDigimon, RunPlan, RunBattleEvent } from '@/types/runPlanner';
import type { Tech } from '@/types/digimon';
import type { BattleTeamMember } from '@/utils/battle/battleTypes';
import { getBattleSkillByName, getBattleSkillById } from '@/data/battleSkills';
import { getTechByName } from '@/utils/techLookup';
import { getDigimonById, getDigimonByName } from '@/utils/digimonLookup';
import { toSimulatorStats } from '@/utils/runPlannerBattleAdapter';
import { getRecordingEncounter } from '@/utils/runBattleRecording';
import { encounterToBattleTeam } from '@/utils/battle/battleEncounter';
import { classifyEffect } from '@/utils/battle/battleEffectCoverage';
import { reconstructRunStateBeforeEvent, BattleAnalysisError, type AnalysisDiagnostic, type HistoricalRunState } from './runPlannerReplay';

export interface PlannerBattleMember extends BattleTeamMember {
  plannerDigimonInstanceId: string; level: number; dp: number;
  levelCap: RosterDigimon['levelCap']; acquisition: RosterDigimon['source'];
}
export interface PlannerBattleAnalysisPreset {
  captureObjective?: BattleCaptureTarget;
  source: { kind: 'run-planner-pre-battle'; runId: string; runName?: string; battleEventId: string; battleEventIndex: number; encounterId: number };
  selectedBattle: Pick<RunBattleEvent, 'domainId' | 'phase' | 'floor' | 'encounterId'>;
  historicalStateSummary: { bits: number; rosterInstanceIds: string[]; orderedDigilineIds: string[]; replayedEvents: number; stats: 'planner-expected-growth-floored'; resources: 'planner-resource-history-unavailable' };
  playerTeam: PlannerBattleMember[];
  enemyTeam: (BattleTeamMember & { level: number; encounterSlot: number })[];
  diagnostics: AnalysisDiagnostic[];
}
/** Identity comes from the canonical lookup; legacy AP/effect compatibility stays
 * available when already mapped. Deferred descriptors do not substitute skills. */
export function analysisTechnique(name: string, side: 'player' | 'enemy'): Tech & { canonicalSkillId: number } {
  const skill = getBattleSkillByName(name), legacy = getTechByName(name);
  const code = side === 'player' ? 'unresolved-player-technique' : 'unresolved-enemy-skill';
  if (!skill || skill.recordKind !== 'technique' || !skill.actionKind || !skill.targetGroup || (!legacy && skill.actionKind !== 'assist' && (skill.attackPower === null || skill.element === null && skill.id !== 0xf4))) throw new BattleAnalysisError(code, 'Unresolved ' + side + ' canonical technique: ' + name);
  return { ...(legacy ?? { id: 'waza-' + skill.id, name: skill.name!, ap: skill.attackPower ?? 0,
    element: skill.element === 'Darkness' ? 'Dark' : skill.element === 'Neutral' || !skill.element ? 'None' : skill.element,
    target: ['all-allies', 'all-enemies', 'field'].includes(skill.targetGroup) ? 'All' : 'Single', isCounter: skill.actionKind === 'counter' }), canonicalSkillId: skill.id };
}
export function plannerDigimonToBattleTeamMember(member: RosterDigimon): PlannerBattleMember {
  const species = getDigimonById(member.speciesId);
  if (!species) throw new BattleAnalysisError('unresolved-player-species', 'Unresolved historical Player species: ' + member.speciesId + ' (' + member.instanceId + ')');
  if (!member.techs.length) throw new BattleAnalysisError('unresolved-player-technique', 'Historical individual has no recorded technique: ' + member.instanceId);
  const mapped = { instanceId: member.instanceId, plannerDigimonInstanceId: member.instanceId,
    digimon: species, customStats: toSimulatorStats(member.stats), techs: member.techs.map(name => analysisTechnique(name, 'player')),
    level: member.level, dp: member.dp, levelCap: member.levelCap, acquisition: member.source };
  if (!mapped.techs.some(t => t.ap > 0 || getBattleSkillById(t.canonicalSkillId)?.actionKind === 'assist' || getBattleSkillByName(t.name)?.actionKind === 'interrupt')) throw new BattleAnalysisError('unresolved-player-technique', 'Historical techniques cannot initialize this individual without synthetic fallback: ' + member.instanceId);
  return structuredClone(mapped);
}
export function historicalPlayerTeam(state: HistoricalRunState): PlannerBattleMember[] {
  if (!state.digiline.length) throw new BattleAnalysisError('empty-historical-digiline', 'The historical Digiline is empty.');
  if (state.digiline.length > 3 || new Set(state.digiline).size !== state.digiline.length) throw new BattleAnalysisError('missing-historical-instance', 'Historical Digiline must contain 1–3 distinct individuals.');
  return state.digiline.map(id => {
    const member = state.roster.find(m => m.instanceId === id);
    if (!member) throw new BattleAnalysisError('missing-historical-instance', 'Historical Digiline references missing individual: ' + id);
    return plannerDigimonToBattleTeamMember(member);
  });
}
export function historicalEnemyTeam(event: RunBattleEvent): PlannerBattleAnalysisPreset['enemyTeam'] {
  const option = getRecordingEncounter(event);
  if (!option?.preview) throw new BattleAnalysisError('unresolved-encounter', 'Unresolved recorded encounter: ' + event.domainId + ' / ' + event.phase + ' / Floor ' + event.floor + ' / Encounter ' + event.encounterId, event.id);
  const encounter = option.preview.encounter;
  for (const enemy of encounter.digimons) {
    if (!getDigimonByName(enemy.name)) throw new BattleAnalysisError('unresolved-enemy-species', 'Unresolved Enemy species: ' + enemy.name);
    enemy.techs.filter(name => name !== 'Alias Fake').forEach(name => analysisTechnique(name, 'enemy'));
  }
  // Shared encounter adapter owns stats, slot order and reviewed boss metadata.
  return encounterToBattleTeam(encounter, names => names.filter(name => name !== 'Alias Fake').map(name => analysisTechnique(name, 'enemy')));
}
export function buildPlannerBattleAnalysisPreset(run: RunPlan, eventId: string): PlannerBattleAnalysisPreset {
  const event = run.history.find(e => e.id === eventId);
  if (!event) throw new BattleAnalysisError('historical-event-replay-failed', 'Selected event no longer exists in run ' + run.id + '.');
  if (event.type !== 'battle') throw new BattleAnalysisError('selected-event-not-battle', 'Only recorded Battle events can be analyzed.', event.id);
  const historical = reconstructRunStateBeforeEvent(run, eventId);
  const playerTeam = historicalPlayerTeam(historical), enemyTeam = historicalEnemyTeam(event);
  const diagnostics: AnalysisDiagnostic[] = [{ code: 'planner-resource-history-unavailable', severity: 'info', message: 'Run Planner does not track historical current HP/MP. Simulation starts at full resources; adjust the local team if needed.' }];
  for (const member of [...playerTeam, ...enemyTeam]) for (const tech of member.techs) {
    const skill = getBattleSkillById((tech as Tech & { canonicalSkillId: number }).canonicalSkillId)!;
    for (const effect of skill.effects) { const coverage = classifyEffect(effect, skill);
      if (coverage.status === 'deferred-unresolved') diagnostics.push({ code: 'canonical-effect-unresolved', severity: 'info', message: skill.name + ': ' + coverage.boundary });
    }
  }
  return structuredClone({ source: { kind: 'run-planner-pre-battle', runId: run.id, runName: run.name, battleEventId: eventId, battleEventIndex: historical.eventIndex, encounterId: event.encounterId },
    selectedBattle: { domainId: event.domainId, phase: event.phase, floor: event.floor, encounterId: event.encounterId },
    historicalStateSummary: { bits: historical.totalBits, rosterInstanceIds: historical.roster.map(m => m.instanceId), orderedDigilineIds: historical.digiline, replayedEvents: historical.replayedEvents, stats: 'planner-expected-growth-floored', resources: 'planner-resource-history-unavailable' },
    ...(event.capturedEnemySlot === null ? {} : { captureObjective: captureTargetForSlot(enemyTeam, event.capturedEnemySlot) }),
    playerTeam, enemyTeam, diagnostics });
}
