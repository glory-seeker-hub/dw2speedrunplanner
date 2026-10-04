import { GUIDE_SECTIONS, GUIDE_GLOSSARY } from './userGuideContent';

export function UserGuide() {
  const jump = (id: string) => {
    const section = document.getElementById(`guide-${id}`) as HTMLDetailsElement | null;
    if (!section) return;
    section.open = true;
    const summary = section.querySelector('summary');
    summary?.focus({ preventScroll: true });
    summary?.scrollIntoView({ block: 'start' });
  };
  return <article aria-label="How to Use guide" className="min-w-0 space-y-3 text-sm break-words">
    <p className="text-muted-foreground">Start with a route or a manual team. The basics are open below; expand a topic when you need more detail.</p>
    <details className="rounded-md border">
      <summary className="min-h-11 cursor-pointer rounded-md p-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Jump to a topic</summary>
    <nav aria-label="Guide topics" className="px-3 pb-3">
      <div className="flex flex-wrap gap-1">{[...GUIDE_SECTIONS, { id: 'glossary', title: 'Quick Reference / Glossary' }].map(s =>
        <button key={s.id} type="button" aria-controls={`guide-${s.id}`} onClick={() => jump(s.id)} className="min-h-10 max-w-full rounded px-2 py-1 text-left text-info underline underline-offset-4 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{s.title.split(' · ')[0]}</button>
      )}</div>
    </nav></details>
    {GUIDE_SECTIONS.map(s => <details key={s.id} id={`guide-${s.id}`} open={s.open} className="rounded-md border bg-card">
      <summary className="min-h-11 cursor-pointer rounded-md p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><h3 className="inline font-semibold">{s.title}</h3></summary>
      <div className="space-y-3 px-3 pb-4 leading-relaxed text-muted-foreground">
        {s.paragraphs.map(p => <p key={p}>{p}</p>)}
        {s.video && <div className="min-w-0 space-y-2">
          <iframe src={s.video.embedUrl} title={s.video.title} loading="lazy" className="aspect-video w-full max-w-full rounded border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          <a href={s.video.watchUrl} target="_blank" rel="noopener noreferrer" className="text-info underline underline-offset-4">Watch on YouTube</a>
        </div>}
        {s.items && <ul className="list-disc space-y-2 pl-5">{s.items.map(p => <li key={p}>{p}</li>)}</ul>}
      </div>
    </details>)}
    <details id="guide-glossary" className="rounded-md border bg-card">
      <summary className="min-h-11 cursor-pointer rounded-md p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><h3 className="inline font-semibold">Quick Reference / Glossary</h3></summary>
      <dl className="space-y-3 px-3 pb-4">{GUIDE_GLOSSARY.map(([term, definition]) => <div key={term}><dt className="font-medium">{term}</dt><dd className="mt-1 leading-relaxed text-muted-foreground">{definition}</dd></div>)}</dl>
    </details>
  </article>;
}
