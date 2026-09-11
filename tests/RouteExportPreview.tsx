import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { RunPlan } from '@/types/runPlanner';
import { buildRouteDocument } from '@/utils/routeDocument';
import { RunRouteExport } from '@/components/run-planner/export/RunRouteExport';
import fresh from './fixtures/route-fresh.json';
import short from './fixtures/route-short.json';
import mixed from './fixtures/route-mixed.json';
import long from './fixtures/route-long.json';
const fixtures = { fresh, short, mixed, long };
export function RouteExportPreview() {
  const [kind, setKind] = useState<keyof typeof fixtures>('mixed');
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState(() => buildRouteDocument(mixed as RunPlan, new Date('2026-09-10T12:00:00Z')));
  return <main className="p-6 space-y-4"><h1>Route export QA fixtures</h1><p>Deterministic real-action fixtures. No user storage is read or written.</p>
    <label>Scenario <select value={kind} onChange={e => setKind(e.target.value as keyof typeof fixtures)}>
      <option value="fresh">Fresh / zero actions</option><option value="short">Short / capture and Trade</option>
      <option value="mixed">Mixed / all action types</option><option value="long">Long / 220 actions</option></select></label>
    <button className="border p-2" onClick={() => { setModel(buildRouteDocument(fixtures[kind] as RunPlan, new Date('2026-09-10T12:00:00Z'))); setOpen(true); }}>Export fixture</button>
    {open && <RunRouteExport model={model} onBack={() => setOpen(false)} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<RouteExportPreview />);
