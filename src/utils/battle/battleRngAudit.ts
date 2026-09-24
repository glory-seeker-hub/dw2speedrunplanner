import type { BattleActionRecord } from './battleTypes';
import type { RngResolution } from './battleRngPolicy';

export interface TasRngRequirement {
  opportunityKey?: string;
  actionId: string; round: number; actorId: string; actorName: string; skillName: string | null;
  targetId: string; targetName: string; status?: string; phase: 'initial' | 'execution';
  resolution: RngResolution; immunityBlocked?: true;
}
export interface RngOverrideCounts {
  directStatus: number; enemyRecoveryPrevented: number; playerRecoveryForced: number;
  enemyParalysisMiss: number; playerParalysisPass: number;
}
export const emptyRngOverrideCounts = (): RngOverrideCounts => ({ directStatus: 0, enemyRecoveryPrevented: 0, playerRecoveryForced: 0, enemyParalysisMiss: 0, playerParalysisPass: 0 });
/** Details live only on retained histories/routes; this transient traversal never stores all rollouts. */
export function collectRngRequirements(actions: readonly BattleActionRecord[]): TasRngRequirement[] {
  const entries = new Map<string, TasRngRequirement>();
  for (const a of actions) {
    const add = (resolution: RngResolution | undefined, status?: string, targetId = a.actorId, targetName = a.actorName,
      phase: TasRngRequirement['phase'] = 'execution', immunityBlocked = false) => {
      if (!resolution) return;
      const entry: TasRngRequirement = { ...(resolution.opportunityKey ? {opportunityKey:resolution.opportunityKey} : {}), actionId: a.id, round: a.round, actorId: a.actorId, actorName: a.actorName,
        skillName: a.skillName, targetId, targetName, phase, resolution, ...(status ? { status } : {}), ...(immunityBlocked ? { immunityBlocked: true } : {}) };
      // Collapse duplicate copies of the same event, preserving distinct actions/rounds and restart gates.
      const key = JSON.stringify([a.id, phase, targetId, status, resolution.category, resolution.outcome]);
      entries.set(key, entry);
    };
    a.statusRecoveries.forEach(r => add(r.rngResolution, r.status));
    add(a.accuracy?.rngResolution, 'paralysis');
    add(a.restart?.initialAccuracyResolution.rngResolution, 'paralysis', a.actorId, a.actorName, 'initial');
    a.impacts.forEach(i => i.statusApplications.forEach(r => add(r.rngResolution, r.status, i.targetId, i.targetName, 'execution', !!r.immunityReason)));
  }
  return [...entries.values()];
}
export function addRngOverrideCounts(counts: RngOverrideCounts, requirements: readonly TasRngRequirement[]) {
  for (const { resolution: r } of requirements) {
    if (r.category === 'direct-status-application') counts.directStatus++;
    else if (r.category === 'natural-status-recovery') { if(r.affectedSide==='enemy'&&r.outcome==='remain')counts.enemyRecoveryPrevented++;if(r.affectedSide==='player'&&r.outcome==='recover')counts.playerRecoveryForced++; }
    else {if(r.affectedSide==='enemy'&&r.outcome==='miss')counts.enemyParalysisMiss++;if(r.affectedSide==='player'&&r.outcome==='pass')counts.playerParalysisPass++;}
  }
}
export function rngRequirementText(r: TasRngRequirement): string {
  const gate = r.resolution;
  return `${r.targetName}: ${r.status ?? 'Paralysis'} ${gate.category === 'direct-status-application'
    ? (gate.outcome === 'apply' ? 'application must succeed' : 'application must fail')
    : gate.category === 'natural-status-recovery' ? (gate.outcome === 'recover' ? 'natural recovery must succeed' : 'natural recovery must fail')
      : (gate.outcome === 'miss' ? 'action must fail' : (r.opportunityKey ? 'action must proceed so Confusion can execute' : 'action must proceed'))} — ${gate.policy === 'tas-luck' ? 'TAS Luck' : 'TAS Favorable'} RNG${r.immunityBlocked ? ' (immunity still blocks application)' : ''}`;
}
