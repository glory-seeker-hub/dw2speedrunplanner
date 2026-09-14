import { createSimulationWorkerHost } from './battleSimulationHost';
import type { SearchRequest } from './battleSimulationProtocol';
const host = createSimulationWorkerHost(message => self.postMessage(message));
self.onmessage = (event: MessageEvent<SearchRequest>) => { void host.receive(event.data); };
