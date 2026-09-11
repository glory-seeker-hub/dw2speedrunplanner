import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RouteDocumentModel, RouteOptions, DEFAULT_ROUTE_OPTIONS, safeRouteTitle } from '@/utils/routeDocument';
import { printRoute } from '@/utils/routePrint';
import { RouteDocument } from '@/components/run-planner/export/RouteDocument';
import { Button } from '@/components/ui/button';

export const RunRouteExport = ({ model, onBack }: { model: RouteDocumentModel; onBack: () => void }) => {
  const [options, setOptions] = useState<RouteOptions>({ ...DEFAULT_ROUTE_OPTIONS });
  const [error, setError] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const title = document.title;
    const root = document.getElementById('root');
    const inert = root?.inert ?? false;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.title = safeRouteTitle(model.name);
    if (root) root.inert = true;
    host.current?.focus();
    return () => { document.title = title; if (root) root.inert = inert; previousFocus?.focus({ preventScroll: true }); };
  }, [model]);
  return createPortal(<div ref={host} className="route-export-host" role="dialog" aria-modal="true" aria-label="Export Route" tabIndex={-1}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); onBack(); }
      if (event.key === 'Tab') {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input'));
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === host.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
    <div className="route-export-controls print-hidden">
      <div className="flex flex-wrap items-center gap-3"><h2 className="mr-auto text-xl font-semibold">Export Route</h2>
        <Button variant="outline" onClick={onBack}>Back to Planner</Button>
        <Button className="h-auto min-h-10 whitespace-normal" onClick={() => setError(printRoute(typeof window.print === 'function' ? () => window.print() : undefined))}>Print / Save as PDF</Button>
      </div>
      <p className="my-2 text-sm text-muted-foreground">Review the complete route, then choose your printer or Save as PDF. Use portrait A4 or Letter; disable browser headers and footers for a clean document.</p>
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><legend className="sr-only">Export options</legend>
        {([['roster', 'Include final roster'], ['digiline', 'Include final Digiline'], ['techniques', 'Include technique details'], ['rewards', 'Include battle rewards']] as const).map(([key, label]) =>
          <label className="flex items-center gap-2" key={key}><input type="checkbox" checked={options[key]} onChange={event => setOptions({ ...options, [key]: event.target.checked })} />{label}</label>)}
      </fieldset>
      {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}
    </div>
    <RouteDocument model={model} options={options} />
  </div>, document.body);
};
