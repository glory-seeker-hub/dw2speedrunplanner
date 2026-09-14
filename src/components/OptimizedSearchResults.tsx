import type { OptimizedSearchResult } from '@/utils/battle/battleOptimizedSearch';
import { OBJECTIVE_LABELS } from '@/utils/battle/battleSearchObjectives';
const value = (n: number | null) => n === null ? 'Unavailable' : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
export function OptimizedSearchResults({ result }: { result: OptimizedSearchResult }) {
  const fastest = result.objective === 'fastest-potential', route = result.fastestRoute, stats = result.recommendedStats;
  const orders = (plans: OptimizedSearchResult['recommendedPrefix']) => plans.map(plan => <div key={plan.key}><h4>Round {plan.round}</h4><ul>{plan.orders.map(o => <li key={o.key}>{o.actorName} — {o.skillName} → {o.targetLabel}</li>)}</ul></div>);
  const events = [...new Set((route?.actions ?? []).flatMap(a => [
    ...(a.accuracy && a.outcome === 'miss' ? [a.accuracy.cause + ' Miss'] : []),
    ...(a.confusion?.redirected ? ['Confusion replacement'] : []),
    ...a.statusRecoveries.filter(r => r.recovered).map(r => r.status + ' natural recovery'),
    ...a.impacts.flatMap(i => i.statusApplications.filter(r => r.applied).map(r => r.status + ' application')),
  ]))];
  return <section aria-label="Optimized search results" className="space-y-3 rounded border p-4">
    <h2 className="font-semibold">{result.status === 'cancelled' ? 'Partial optimized search — cancelled' : result.evaluations < result.rolloutBudget ? 'Search completed early' : 'Optimized search completed'}</h2>
    <p>Search method: Optimized Action Search · Optimization objective: {OBJECTIVE_LABELS[result.objective]}</p>
    <p>Rollout budget used: {value(result.evaluations)} / {value(result.rolloutBudget)} · Depth reached: {result.depth}</p>
    <p>Root Player plans: {value(result.rootPlanCount)} · Candidate plans evaluated: {value(result.candidatesEvaluated)}</p>
    <p>Screened-prefix statistics use the last completed fair comparison stage ({value(result.fairStageEvaluations)} evaluations). In-progress samples do not affect that ranking.</p>
    {result.diagnostics.map(d => <p key={d} role="status">{d}</p>)}
    {fastest && <div><h3 className="font-semibold">Fastest route found</h3>
      {route ? <><p>Observed frames: {value(route.totalFrames)}</p>{orders(route.decisionTrace)}
        <p>Rollout seed: {route.seed} · Sample index: {route.sampleIndex}</p>
        <details><summary>Source candidate/prefix</summary><code className="break-all">{route.sourcePrefixKey}</code></details>
        <p>Observed mechanical events: {events.join('; ') || 'None recorded'}.</p></> : <p>No eligible complete Player victory observed.</p>}
    </div>}
    <h3 className="font-semibold">{fastest ? 'Best screened prefix' : result.objective === 'average-victory' ? 'Best average strategy' : 'Highest-success strategy'}</h3>
    {stats && <div>
      {result.objective === 'success-rate' ? <p>Success rate: {value(stats.successRate * 100)}%</p> : <p>Average victory frames: {value(stats.averageVictoryFrames)}</p>}
      <p>Fastest fair-stage sample: {value(stats.fastestFrames)}f · Average victory frames: {value(stats.averageVictoryFrames)} · Success rate: {value(stats.successRate * 100)}% · Divergence: {value(stats.divergenceRate * 100)}% · Rollouts: {value(stats.evaluations)}</p>
    </div>}
    {orders(result.recommendedPrefix)}
    <p className="text-sm">Orders after Round 1 are path-specific and assume the searched battle state for that round. A different battle state may make those orders illegal or unsuitable. This is not a complete adaptive policy.</p>
    <h3 className="font-semibold">Top candidates</h3>
    <p>Fair-stage statistical candidates; these are not the globally fastest individual rollouts.</p>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Rank / first-round orders', 'Rollouts', 'Fastest f', 'Average victory f', 'Success rate', 'Divergence'].map(s => <th key={s} className="p-2 text-left">{s}</th>)}</tr></thead>
      <tbody>{result.topCandidates.map((c, i) => <tr key={c.key}><td className="p-2">{i + 1}. {c.plans[0]?.orders.map(o => `${o.actorName}: ${o.skillName} → ${o.targetLabel}`).join('; ')}</td><td>{value(c.stats.evaluations)}</td><td>{value(c.stats.fastestFrames)}</td><td>{value(c.stats.averageVictoryFrames)}</td><td>{value(c.stats.successRate * 100)}%</td><td>{value(c.stats.divergenceRate * 100)}%</td></tr>)}</tbody></table></div>
    <p className="text-sm">Every completed screening stage evaluates all legal Player plans at its expanded decision states, but beam pruning and stochastic rollouts do not exhaust the full battle tree. Fastest Potential may depend on favorable remaining RNG.</p>
    <h3 className="font-semibold">Best observed battle</h3>
    <p className="text-sm">The battle histories below are individual observed rollouts. Fastest route found uses the globally fastest eligible observation; screened prefixes use repeated fair evaluations.</p>
  </section>;
}
