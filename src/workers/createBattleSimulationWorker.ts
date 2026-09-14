export function createBattleSimulationWorker() {
  return new Worker(new URL('./battleSimulation.worker.ts', import.meta.url), { type: 'module' });
}
