import { createOptimizedSearch } from '@/utils/battle/battleOptimizedSearch';
import type { SearchRequest, SearchResponse } from './battleSimulationProtocol';
import { createSimulationSearch } from '@/utils/battle/battleSimulationSearch';
import { createSeededBattleRng } from '@/utils/battle/battleRng';
/** Task yields allow CANCEL messages to run. No full histories in progress. */
export function createSimulationWorkerHost(post: (message: SearchResponse) => void, scheduling = {
  now: () => performance.now(), yieldTask: () => new Promise<void>(resolve => setTimeout(resolve, 0)),
  batchBudgetMs: 50, maxBatchSize: 1000, progressIntervalMs: 150,
}) {
  let active: { jobId: string; cancelled: boolean } | null = null;
  async function start(message: Extract<SearchRequest, { type: 'START' }>) {
    if (active) return;
    const job = active = { jobId: message.jobId, cancelled: false };
    const started = scheduling.now(); let lastProgress = started, emitted = false;
    try {
      if (message.searchMethod && !['random-monte-carlo', 'optimized-action-search'].includes(message.searchMethod)) throw new Error('Unknown search method.');
      const search = message.searchMethod === 'optimized-action-search' ? createOptimizedSearch(message.input, message.requestedSimulations, {
        seed: message.seed, objective: message.optimizationObjective, config: message.optimizedConfig, simulationRules: message.simulationRules, maxRounds: message.maxRounds,
      }) : createSimulationSearch(message.input, message.requestedSimulations, {
        simulationRules: message.simulationRules,
        ...(message.seed === undefined ? {} : { rng: createSeededBattleRng(message.seed) }),
        ...(message.maxRounds === undefined ? {} : { maxRounds: message.maxRounds }),
      });
      // Give a queued immediate cancellation a chance before doing any work.
      await scheduling.yieldTask();
      while (!search.done && !job.cancelled) {
        const batchStart = scheduling.now(); let count = 0;
        do { search.step(); count++; } while (!search.done && count < scheduling.maxBatchSize && scheduling.now() - batchStart < scheduling.batchBudgetMs);
        const now = scheduling.now();
        if (!emitted || now - lastProgress >= scheduling.progressIntervalMs) {
          post({ type: 'PROGRESS', jobId: job.jobId, progress: search.progress(now - started) });
          emitted = true; lastProgress = now;
        }
        if (!search.done) await scheduling.yieldTask();
      }
      const elapsed = scheduling.now() - started;
      const status = search.done ? 'completed' : 'cancelled';
      post({ type: 'PROGRESS', jobId: job.jobId, progress: search.progress(elapsed) });
      post({ type: status === 'completed' ? 'COMPLETE' : 'CANCELLED', jobId: job.jobId, result: search.result(status, elapsed) });
    } catch (cause) {
      post({ type: 'ERROR', jobId: job.jobId, message: cause instanceof Error ? cause.message : 'Battle simulation failed.' });
    } finally { if (active === job) active = null; }
  }
  return { receive(message: SearchRequest) {
    if (message.type === 'CANCEL') { if (active?.jobId === message.jobId) active.cancelled = true; return Promise.resolve(); }
    return start(message);
  } };
}
