import { useEffect, useRef, useState } from 'react';
import type { SimulationResult } from '@/types/digimon';
import { createSearchController, type SearchControllerState } from '@/workers/battleSimulationController';
import { createBattleSimulationWorker } from '@/workers/createBattleSimulationWorker';
export function useBattleSimulationWorker(onComplete: (result: SimulationResult) => void) {
  const [state, setState] = useState<SearchControllerState>({ running: false, cancelling: false, progress: null, error: null });
  const callback = useRef(onComplete); callback.current = onComplete;
  const controller = useRef<ReturnType<typeof createSearchController> | null>(null);
  if (!controller.current) controller.current = createSearchController(createBattleSimulationWorker, setState, result => callback.current(result));
  useEffect(() => () => controller.current?.dispose(), []);
  return { ...state, start: controller.current.start, cancel: controller.current.cancel };
}
