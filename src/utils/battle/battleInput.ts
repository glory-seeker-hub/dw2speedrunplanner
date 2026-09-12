import { getBattleSkillById, getBattleSkillByName } from '@/data/battleSkills';
import { LEGACY_TECH_IDENTITIES } from '@/data/legacyTechIdentities';
import { DIGIMONS } from '@/data/digimons';
import { requireEncounterTechs } from '@/utils/encounterBattleSkills';
import type { Tech } from '@/types/digimon';
import type { Encounter } from '@/types/encounter';
import type { BattleCombatantState, BattleInput, BattleSide, BattleSkillSelection, BattleState, BattleTeamMember } from './battleTypes';
import { BattleInputError } from './battleTypes';
import { validateCombatant } from './battleState';

const canonicalIds = new Map(LEGACY_TECH_IDENTITIES.map(([id, legacyId]) => [legacyId, id]));
export function linkLegacySkill(tech: Tech & { canonicalSkillId?: number }): BattleSkillSelection {
  const explicit = tech.canonicalSkillId;
  const byName = getBattleSkillByName(tech.name);
  // The reviewed 0x4D exception requires a numeric or reviewed legacy identity.
  // A custom technique borrowing the display name cannot acquire the rule.
  const canonical = explicit !== undefined ? getBattleSkillById(explicit) : getBattleSkillById(canonicalIds.get(tech.id) ?? -1) ?? (byName?.id === 0x4d ? undefined : byName);
  if (explicit !== undefined && !canonical) throw new BattleInputError(`Unknown WAZADATA identity ${explicit}.`);
  return { key: tech.id, canonicalSkillId: canonical?.id ?? null, kind: canonical?.actionKind ?? (tech.isCounter ? 'counter' : 'attack'), source: canonical ? 'legacy-known-technique' : 'legacy-custom-technique', legacyTech: { ...tech, ...(tech.specialEffect ? { specialEffect: { ...tech.specialEffect } } : {}) } };
}
function createMember(member: BattleTeamMember, side: BattleSide, position: number, allowSynthetic: boolean): BattleCombatantState {
  const skills = member.techs.map(linkLegacySkill);
  const actor: BattleCombatantState = {
    id: member.instanceId ? `${side}-instance-${member.instanceId}` : `${side}-${position}`,
    sourceInstanceId: member.instanceId ?? null, name: member.digimon.name, side, position,
    speciesId: member.digimon.id, type: member.digimon.type, specialty: member.digimon.specialty,
    baseStats: { ...member.customStats }, maxHp: member.customStats.hp, currentHp: member.customStats.hp,
    maxMp: member.customStats.mp, currentMp: member.customStats.mp, isAlive: side === 'player' || member.customStats.hp > 0,
    parameterModifiers: {}, skills, plannedActionId: null,
    reaction: { counterUsed: false, isCountering: false }, legacy: { consecutiveTechCount: 0, damageTakenThisTurn: 0 },
    statuses: {}, temporaryPowers: {},
  };
  validateCombatant(actor);
  if (!skills.some(s => s.legacyTech.ap > 0)) {
    if (!allowSynthetic || skills.some(s => s.source === 'legacy-custom-technique')) throw new BattleInputError(`No usable known technique for ${actor.name}.`, 'unsupported');
    skills.push({ key: 'synthetic-basic-attack', canonicalSkillId: null, kind: 'attack', source: 'synthetic-legacy-fallback', legacyTech: { id: 'basic-attack', name: 'Basic Attack', ap: 10, element: 'None', target: 'Single', isCounter: false } });
  }
  if (new Set(skills.map(s => s.key)).size !== skills.length) throw new BattleInputError(`Duplicate technique keys for ${actor.id}.`);
  return actor;
}
export function createBattleState(input: BattleInput, simulationIndex = 0): BattleState {
  let enemy: readonly BattleTeamMember[];
  const encounterInput = !Array.isArray(input.enemy);
  if (encounterInput) {
    try {
      // Audit all identities first: an earlier unsupported known skill must not
      // conceal an unresolved label such as encounter 149's Alias Fake.
      const labels = (input.enemy as Encounter).digimons.flatMap(d => d.techs);
      const unknown = labels.filter(label => !getBattleSkillByName(label));
      if (unknown.length) throw new BattleInputError(`Unresolved authoritative encounter technique: ${unknown.join(', ')}.`);
      enemy = (input.enemy as Encounter).digimons.map(d => {
        const species = DIGIMONS.find(s => s.name === d.name);
        const stats = { hp: d.hp, mp: d.mp, atk: d.atk, def: d.def, spd: d.spd };
        return { digimon: species ?? { id: d.name, name: d.name, type: 'Data', specialty: 'None', baseStats: stats }, customStats: stats, techs: requireEncounterTechs(d.techs) };
      });
    } catch (error) { throw new BattleInputError(error instanceof Error ? error.message : 'Invalid encounter.'); }
  } else enemy = input.enemy as readonly BattleTeamMember[];
  if (!input.player.length) throw new BattleInputError('At least one player combatant is required.');
  const combatants = [...input.player.map((m, i) => createMember(m, 'player', i, true)), ...enemy.map((m, i) => createMember(m, 'enemy', i, !encounterInput))];
  if (new Set(combatants.map(a => a.id)).size !== combatants.length) throw new BattleInputError('Duplicate combatant instance IDs.');
  return { combatants, plannedActions: [], queue: [], round: 0, nextActionNumber: 1, simulationIndex };
}
