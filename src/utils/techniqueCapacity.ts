import { normalizeTechniqueName } from '@/data/techniqueMetadata';
import { TechniqueState } from '@/types/techniqueInheritance';
import { MAX_TECHNIQUES, TechniqueChoice, BattleTechniqueChoice } from '@/types/techniqueCapacity';
import { isValidTechniqueState } from '@/utils/techniqueInheritance';

/** Accepts calculated unlock state or a pure DNA result, never silently truncates. */
export const buildTechniqueChoice = (state: TechniqueState, newlyUnlocked: readonly string[] = state.techs): TechniqueChoice => {
  if (!isValidTechniqueState(state)) throw new Error('Invalid technique candidate state');
  const snapshot = structuredClone(state);
  const candidates = snapshot.techniquePool.filter(p => p.unlock.status === 'available');
  const keys = new Set(candidates.map(p => p.key));
  const newlyUnlockedKeys = [...new Set(newlyUnlocked.map(normalizeTechniqueName))];
  if (newlyUnlockedKeys.some(key => !keys.has(key))) throw new Error('New technique is not an available candidate');
  return { state: snapshot, candidates, newlyUnlockedKeys, selectionRequired: candidates.length > MAX_TECHNIQUES };
};

export const resolveTechniqueChoice = (choice: TechniqueChoice, keptKeys?: readonly string[]) => {
  // Rebuild rather than trusting caller-supplied candidate/required flags.
  const checked = buildTechniqueChoice(choice.state, choice.newlyUnlockedKeys);
  if (keptKeys === undefined && checked.selectionRequired) return { status: 'selection-required' as const, choice: checked };
  if (keptKeys !== undefined && checked.newlyUnlockedKeys.length === 0) throw new Error('Technique selection requires a learning opportunity');
  const selected = keptKeys ?? checked.candidates.map(p => p.key);
  const keep = new Set(selected);
  if (keep.size !== selected.length || keep.size > MAX_TECHNIQUES ||
      selected.some(key => !checked.candidates.some(p => p.key === key))) throw new Error('Choose unique candidate techniques within capacity');
  const state = structuredClone(checked.state);
  const discarded = checked.candidates.filter(p => !keep.has(p.key));
  for (const potential of state.techniquePool) {
    if (potential.unlock.status === 'available' && !keep.has(potential.key)) potential.unlock = { status: 'discarded' };
  }
  state.techs = state.techs.filter(name => keep.has(normalizeTechniqueName(name)));
  return { status: 'resolved' as const, ...state, selectionRequired: checked.selectionRequired,
    keptKeys: checked.candidates.filter(p => keep.has(p.key)).map(p => p.key),
    discardedKeys: discarded.map(p => p.key), discarded: discarded.map(p => p.name),
    learned: checked.candidates.filter(p => keep.has(p.key) && checked.newlyUnlockedKeys.includes(p.key)).map(p => p.name) };
};

/** Carries only preflight choices; no partially progressed roster or rewards. */
export class BattleTechniqueSelectionRequired extends Error {
  constructor(public readonly choices: BattleTechniqueChoice[]) {
    super('Review techniques before recording this battle.');
  }
}
