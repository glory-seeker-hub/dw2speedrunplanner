import { RunPlan, RosterDigimon } from '@/types/runPlanner';
import { getStarterById } from '@/data/starters';
import { proposeDnaChild, replaceDnaParents } from '@/utils/dnaProposal';
import { normalizeTechniqueName } from '@/data/techniqueMetadata';

export const getHistoricalInstanceIds = (run: RunPlan): Set<string> => new Set([
  ...run.roster.map(p => p.instanceId),
  ...run.history.flatMap(e => [...e.preActionCheckpoint.roster.map(p => p.instanceId),
    ...(e.type === 'dna' ? [e.childInstanceId] : e.type === 'battle' && e.capturedInstanceId ? [e.capturedInstanceId] : [])]),
]);

const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.prototype.hasOwnProperty.call(y, k) && equal(x[k], y[k]));
};

/** Membership and immediate post-action audits, not XP/stat replay of the entire run. */
export const validateInstanceLifecycle = (run: RunPlan) => {
  const errors: { code: string; message: string }[] = [];
  const fail = (code: string, message: string) => errors.push({ code, message });
  const initial = run.history[0]?.preActionCheckpoint.roster ?? run.roster;
  const starter = initial.find(p => p.instanceId === run.starterInstanceId);
  if (!getStarterById(run.starterDefinitionId) || !starter || starter.source?.type !== 'starter') {
    fail('unknown-starter-instance', 'Original starter definition and historical individual must be present in the initial state.');
  }
  const live = new Set(initial.map(p => p.instanceId));
  const seen = new Set(live);
  const sources = new Map(initial.map(p => [p.instanceId, p.source]));
  if (initial.some(p => p.source?.type === 'dna')) fail('dna-source-without-event', 'DNA source requires a chronological creation event.');
  const matches = (roster: RosterDigimon[]) => roster.length === live.size && roster.every(p => live.has(p.instanceId));
  const checkSources = (roster: RosterDigimon[]) => {
    if (roster.some(p => !equal(p.source, sources.get(p.instanceId)))) fail('instance-source-mismatch', 'Individual provenance must match its introduction.');
  };
  run.history.forEach((event, index) => {
    const before = event.preActionCheckpoint;
    const after = run.history[index + 1]?.preActionCheckpoint ?? run;
    if (!matches(before.roster)) fail('checkpoint-unknown-instance', 'Checkpoint membership does not match the chronological lifecycle.');
    checkSources(before.roster);
    const introduce = (id: string) => {
      if (seen.has(id)) fail('instance-id-reused', 'Introduced IDs must never reuse an earlier individual.');
      seen.add(id); live.add(id);
    };
    if (event.type === 'battle' && event.capturedInstanceId !== null) {
      introduce(event.capturedInstanceId);
      const expectedSource = { type: 'capture', encounterId: event.encounterId, enemySlot: event.capturedEnemySlot };
      sources.set(event.capturedInstanceId, expectedSource as RosterDigimon['source']);
      const captured = after.roster.find(p => p.instanceId === event.capturedInstanceId);
      if (!captured || !equal(captured.source, expectedSource) || !equal(captured.levelCap, event.capturedLevelCap)) {
        fail('capture-audit-mismatch', 'Capture must match the immediate post-action individual and exact cap.');
      }
    } else if (event.type === 'digivolve') {
      if (!live.has(event.instanceId) || after.roster.find(p => p.instanceId === event.instanceId)?.speciesId !== event.toSpeciesId) {
        fail('digivolve-unknown-instance', 'Evolution subject must persist with its evolved species immediately after the action.');
      }
    } else if (event.type === 'dna') {
      const parents = [event.parentAInstanceId, event.parentBInstanceId];
      if (!parents.every(id => live.has(id))) fail('dna-missing-parent', 'DNA parents must exist at consumption time.');
      parents.forEach(id => live.delete(id));
      introduce(event.childInstanceId);
      sources.set(event.childInstanceId, { type: 'dna', parentInstanceIds: parents as [string, string] });
      const a = before.roster.find(p => p.instanceId === parents[0])!, b = before.roster.find(p => p.instanceId === parents[1])!;
      const proposal = proposeDnaChild(a, b, event.techniqueChoice.kept.map(normalizeTechniqueName));
      const child = after.roster.find(p => p.instanceId === event.childInstanceId);
      if (proposal.status !== 'ready' || !equal(child, { instanceId: event.childInstanceId, ...proposal.child })) {
        fail('dna-child-audit-mismatch', 'DNA child state must match the recomputed creation state.');
      }
      const expectedOrder = replaceDnaParents(before.roster.map(p => p.instanceId), id => id, parents, event.childInstanceId);
      if (!equal(after.roster.map(p => p.instanceId), expectedOrder)) fail('dna-roster-order', 'DNA roster placement must preserve unaffected order.');
      if (after.totalBits !== before.totalBits) fail('dna-bits-changed', 'DNA does not change Bits.');
      // Digiline can be edited between actions; its local membership remains strict in each snapshot.
    }
    if (!matches(after.roster)) fail('lifecycle-roster-mismatch', 'Post-action roster membership does not match the lifecycle.');
    checkSources(after.roster);
  });
  if (!matches(run.roster)) fail('lifecycle-roster-mismatch', 'Current roster must match the final lifecycle.');
  return errors;
};
