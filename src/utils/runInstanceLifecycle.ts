import { validateStarterBinding } from '@/utils/runStarterValidation';
import { equalRunState as equal, validateActionContinuity } from '@/utils/runTransitionValidation';
import { RunPlan, RosterDigimon } from '@/types/runPlanner';
import { getStarterById } from '@/data/starters';

export const getHistoricalInstanceIds = (run: RunPlan): Set<string> => new Set([
  ...run.roster.map(p => p.instanceId),
  ...run.history.flatMap(e => [...e.preActionCheckpoint.roster.map(p => p.instanceId),
    ...(e.type === 'trade' ? [e.receivedInstanceId] : e.type === 'dna' ? [e.childInstanceId] : e.type === 'battle' && e.capturedInstanceId ? [e.capturedInstanceId] : [])]),
]);

/** One chronological pass checks identity and exact action-controlled state. */
export const validateInstanceLifecycle = (run: RunPlan) => {
  const errors: { code: string; message: string }[] = [];
  const fail = (code: string, message: string) => errors.push({ code, message });
  const initial = run.history[0]?.preActionCheckpoint.roster ?? run.roster;
  const starter = initial.find(p => p.instanceId === run.starterInstanceId);
  if (!getStarterById(run.starterDefinitionId) || !starter || starter.source?.type !== 'starter') {
    fail('unknown-starter-instance', 'Original starter definition and historical individual must be present in the initial state.');
  }
  errors.push(...validateStarterBinding(run));
  const live = new Set(initial.map(p => p.instanceId));
  const seen = new Set(live);
  const sources = new Map(initial.map(p => [p.instanceId, p.source]));
  if (initial.some(p => p.source?.type === 'dna')) fail('dna-source-without-event', 'DNA source requires a chronological creation event.');
  if (initial.some(p => p.source?.type === 'trade')) fail('trade-source-without-event', 'Trade source requires a chronological creation event.');
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
    } else if (event.type === 'trade') {
      if (!live.has(event.givenInstanceId)) fail('trade-missing-given', 'Given individual must exist at trade time.');
      live.delete(event.givenInstanceId);
      introduce(event.receivedInstanceId);
      sources.set(event.receivedInstanceId, { type: 'trade', tradeId: event.tradeId, givenInstanceId: event.givenInstanceId });
    } else if (event.type === 'dna') {
      const parents = [event.parentAInstanceId, event.parentBInstanceId];
      if (!parents.every(id => live.has(id))) fail('dna-missing-parent', 'DNA parents must exist at consumption time.');
      parents.forEach(id => live.delete(id));
      introduce(event.childInstanceId);
      sources.set(event.childInstanceId, { type: 'dna', parentInstanceIds: parents as [string, string] });
    }
    errors.push(...validateActionContinuity(event, after));
    if (!matches(after.roster)) fail('lifecycle-roster-mismatch', 'Post-action roster membership does not match the lifecycle.');
    checkSources(after.roster);
  });
  if (!matches(run.roster)) fail('lifecycle-roster-mismatch', 'Current roster must match the final lifecycle.');
  return errors;
};
