import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';

/** Keep children mounted, and keep a started action visible until explicit cancellation or completion. */
export const ActionDisclosure = ({ title, id, active, onCancel, compact, children }: {
  title: string; id: string; active: boolean; onCancel: () => void; compact: boolean; children: ReactNode;
}) => {
  const [expanded, setExpanded] = useState(false);
  const open = !compact || expanded || active;
  return <section aria-label={title} className="min-w-0 rounded-lg border p-3">
    {compact ? <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={id} disabled={active}
        onClick={() => setExpanded(!expanded)}>{title} {open ? '−' : '+'}</Button>
      {active && <Button variant="outline" size="sm" onClick={() => { onCancel(); setExpanded(false); }}>Cancel {title}</Button>}
    </div> : <h4 className="font-semibold">{title}</h4>}
    <div id={id} hidden={!open} className="space-y-3 pt-3">{children}</div>
  </section>;
};
