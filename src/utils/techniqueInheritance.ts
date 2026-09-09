import { getSpeciesProgression } from '@/data/speciesProgression';
import { getTechniqueIdentity, normalizeTechniqueName, TECHNIQUE_UNLOCK_LEVELS } from '@/data/techniqueMetadata';
import { DigimonRank, TechniquePotential, TechniqueSource, TechniqueState } from '@/types/techniqueInheritance';

const identity = (name: string) => {
  const value = getTechniqueIdentity(name);
  if (!value) throw new Error(`Unknown technique rank: ${name}`);
  return value;
};

export const createAvailableTechniqueState = (techs: readonly string[], source: TechniqueSource): TechniqueState => {
  const pool = new Map<string, TechniquePotential>();
  for (const name of techs) {
    const meta = identity(name);
    pool.set(meta.key, { ...meta, unlock: { status: 'available' }, sources: [{ ...source }] });
  }
  return { techs: techs.filter((name, index) => techs.findIndex(other => normalizeTechniqueName(other) === normalizeTechniqueName(name)) === index),
    techniquePool: [...pool.values()] };
};

/** Register only the actual new form, preserving all earlier potentials and their rules. */
export const registerOwnTechnique = (state: TechniqueState, speciesId: string, level: number): TechniqueState => {
  if (!isValidTechniqueState(state)) throw new Error('Invalid technique state');
  const next = structuredClone(state);
  const own = getSpeciesProgression(speciesId)?.ownTechnique;
  if (!own) return next;
  const meta = identity(own);
  // Existing normal learning has no Rookie milestone. DNA own Rookie is initialized separately.
  if (meta.rank === 'Rookie') return next;
  if (next.techniquePool.some(p => p.key === meta.key)) return next;
  const threshold = TECHNIQUE_UNLOCK_LEVELS[meta.rank];
  next.techniquePool.push({ ...meta, unlock: { status: level >= threshold ? 'missed' : 'pending', level: threshold },
    sources: [{ type: 'own-species', speciesId }] });
  return next;
};

/** Valid +1 transitions only: missed and discarded entries never unlock. */
export const advanceTechniqueState = (state: TechniqueState, previousLevel: number, newLevel: number) => {
  if (!isValidTechniqueState(state)) throw new Error('Invalid technique state');
  const next = structuredClone(state);
  const learnedTechniques: string[] = [];
  if (newLevel === previousLevel + 1) {
    for (const potential of next.techniquePool) {
      if (potential.unlock.status !== 'pending' || potential.unlock.level !== newLevel) continue;
      potential.unlock = { status: 'available' };
      next.techs.push(potential.name);
      learnedTechniques.push(potential.name);
    }
  }
  return { ...next, learnedTechniques };
};

/** Pure foundation only: no roster creation, history, parent consumption, or capacity limit. */
export const calculateDnaTechniqueState = (
  result: { speciesId: string; actualRank: DigimonRank; startingLevel: number },
  parentA: TechniqueState & { instanceId: string },
  parentB: TechniqueState & { instanceId: string },
): TechniqueState => {
  const species = getSpeciesProgression(result.speciesId);
  if (!species || species.rank !== result.actualRank || !Number.isInteger(result.startingLevel) || result.startingLevel < 1) {
    throw new Error('Invalid actual DNA result species, rank or starting level');
  }
  if (!text(parentA.instanceId) || !text(parentB.instanceId) || !isValidTechniqueState(parentA) || !isValidTechniqueState(parentB)) throw new Error('Invalid parent technique state');
  const pool = new Map<string, TechniquePotential>();
  for (const parent of [parentA, parentB].sort((a, b) => a.instanceId.localeCompare(b.instanceId))) {
    // Current possession is authoritative; the validated pool supplies intrinsic metadata only.
    const parentMetadata = new Map(parent.techniquePool.map(p => [p.key, p]));
    for (const name of parent.techs) {
      const potential = parentMetadata.get(normalizeTechniqueName(name))!;
      const meta = { key: potential.key, name: potential.name, rank: potential.rank };
      const level = TECHNIQUE_UNLOCK_LEVELS[meta.rank];
      let child = pool.get(meta.key);
      if (!child) {
        child = { ...meta, unlock: result.startingLevel >= level ? { status: 'available' } : { status: 'pending', level }, sources: [] };
        pool.set(meta.key, child);
      }
      if (!child.sources.some(s => s.type === 'inherited' && s.parentInstanceId === parent.instanceId)) {
        child.sources.push({ type: 'inherited', parentInstanceId: parent.instanceId });
      }
    }
  }
  if (species.ownTechnique) {
    const meta = identity(species.ownTechnique);
    const level = TECHNIQUE_UNLOCK_LEVELS[meta.rank];
    const own = pool.get(meta.key) ?? { ...meta, unlock: { status: 'pending' as const, level }, sources: [] };
    if (result.actualRank === 'Rookie') own.unlock = { status: 'available' };
    own.sources.push({ type: 'own-species', speciesId: result.speciesId });
    pool.set(meta.key, own);
  }
  const techniquePool = [...pool.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { techs: techniquePool.filter(p => p.unlock.status === 'available').map(p => p.name), techniquePool };
};

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const validSource = (v: unknown): boolean => {
  if (!object(v)) return false;
  if (v.type === 'starter' || v.type === 'own-species') return Object.keys(v).length === 2 && text(v.speciesId);
  if (v.type === 'inherited') return Object.keys(v).length === 2 && text(v.parentInstanceId);
  return v.type === 'capture' && Object.keys(v).length === 3 && Number.isInteger(v.encounterId) && Number.isInteger(v.enemySlot);
};

/** Shared roster/checkpoint/storage invariant: exactly one available entry per usable identity. */
export const isValidTechniqueState = (v: unknown): v is TechniqueState => {
  if (!object(v) || !Array.isArray(v.techs) || !v.techs.every(text) || !Array.isArray(v.techniquePool)) return false;
  const available = new Set(v.techs.map(normalizeTechniqueName));
  if (available.size !== v.techs.length) return false;
  const keys = new Set<string>();
  for (const p of v.techniquePool) {
    if (!object(p) || !text(p.name) || !object(p.unlock) || !Array.isArray(p.sources) || !p.sources.length || !p.sources.every(validSource)) return false;
    const meta = getTechniqueIdentity(p.name);
    if (!meta || p.key !== meta.key || p.name !== meta.name || p.rank !== meta.rank || keys.has(meta.key)) return false;
    keys.add(meta.key);
    if (p.unlock.status === 'available') {
      if (!available.delete(meta.key) || 'level' in p.unlock) return false;
    } else if (p.unlock.status === 'discarded') {
      if (available.has(meta.key) || 'level' in p.unlock) return false;
    } else if ((p.unlock.status !== 'pending' && p.unlock.status !== 'missed') ||
      p.unlock.level !== TECHNIQUE_UNLOCK_LEVELS[meta.rank] || available.has(meta.key)) return false;
  }
  return available.size === 0;
};
