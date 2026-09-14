import type { SearchRequest, SearchResponse } from './battleSimulationProtocol';
import type { SearchProgress } from '@/utils/battle/battleSimulationSearch';
import type { SimulationResult } from '@/types/digimon';
export interface WorkerPort {
  postMessage(message: SearchRequest): void; terminate(): void;
  onmessage: ((event: MessageEvent<SearchResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}
export interface SearchControllerState { running: boolean; cancelling: boolean; progress: SearchProgress | null; error: string | null }
/** Runtime-only ownership; a terminal message invalidates the job before callbacks. */
export function createSearchController(factory: () => WorkerPort, update: (state: SearchControllerState) => void, complete: (result: SimulationResult) => void) {
  let worker: WorkerPort | null = null, jobId: string | null = null, generation = 0;
  let state: SearchControllerState = { running: false, cancelling: false, progress: null, error: null };
  const publish = (patch: Partial<SearchControllerState>) => { state = { ...state, ...patch }; update(state); };
  const dispose = () => { jobId = null; if (worker) { worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate(); worker = null; } };
  const fail = (message: string) => { if (import.meta.env.DEV) console.error('Battle simulation failed:', message); dispose(); publish({ running: false, cancelling: false, error: message }); };
  return {
    start(request: Omit<Extract<SearchRequest, { type: 'START' }>, 'type' | 'jobId'>) {
      if (jobId) return;
      const id = 'simulation-' + ++generation; jobId = id;
      publish({ running: true, cancelling: false, progress: null, error: null });
      try {
        const snapshot = structuredClone(request);
        worker = factory();
        worker.onmessage = ({ data }) => {
          if (jobId !== id || data.jobId !== id) return;
          if (data.type === 'PROGRESS') { publish({ progress: data.progress }); return; }
          if (data.type === 'ERROR') { fail(data.message); return; }
          if (data.type !== 'COMPLETE' && data.type !== 'CANCELLED') return;
          dispose(); publish({ running: false, cancelling: false, progress: data.result.search ?? null });
          complete(data.result);
        };
        worker.onerror = event => { if (jobId !== id) return; event.preventDefault?.(); if (import.meta.env.DEV) console.error('Worker error:', event.message); fail('Simulation worker failed. Please retry.'); };
        worker.onmessageerror = () => { if (jobId === id) fail('Could not read simulation worker results. Please retry.'); };
        worker.postMessage({ ...snapshot, type: 'START', jobId: id });
      } catch (cause) { fail(cause instanceof Error ? cause.message : 'Could not start the simulation worker.'); }
    },
    cancel() { if (jobId && worker && !state.cancelling) { publish({ cancelling: true }); try { worker.postMessage({ type: 'CANCEL', jobId }); } catch { fail('Could not cancel the simulation worker.'); } } },
    dispose,
  };
}
