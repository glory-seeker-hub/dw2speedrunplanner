import { RouteAction, RouteDocumentModel, RouteMember, RouteOptions, DEFAULT_ROUTE_OPTIONS } from '@/utils/routeDocument';

const names = (values: string[]) => values.join(', ') || 'None';
const MemberLevel = ({ member }: { member: RouteMember }) => <p>EL{member.level} / Max EL{member.maxLevel} · DP{member.dp}</p>;

export const RouteActionList = ({ actions, options }: { actions: RouteAction[]; options: RouteOptions }) => <section aria-labelledby="route-actions-title">
  <h2 id="route-actions-title">Chronological route</h2>
  {actions.length === 0 ? <p>No route actions recorded yet.</p> : <ol className="route-actions">
    {actions.map(action => <li className="route-action route-keep" key={action.number}>
      <h3>Action {action.number} · {action.title}</h3>
      {action.lines.map((line, i) => <p key={i}>{line}</p>)}
      {options.rewards && action.rewards && <p>{action.rewards}</p>}
      {options.techniques && action.decisions.map((decision, i) => <div className="route-decision" key={i}>
        <p><strong>{decision.name} — Technique decision</strong></p>
        {decision.learned && <p>Learned: {names(decision.learned)}</p>}
        {decision.kept && <p>Kept: {names(decision.kept)}</p>}
        <p>Discarded: {names(decision.discarded)}</p>
      </div>)}
    </li>)}
  </ol>}
</section>;

export const FinalDigilineSummary = ({ members, techniques }: { members: (RouteMember | null)[]; techniques: boolean }) => <section aria-labelledby="route-digiline-title">
  <h2 id="route-digiline-title">Final Digiline</h2>
  <ol className="route-slots">{members.map((member, i) => <li className="route-keep" key={i}>
    <h3>Slot {i + 1} · {member?.name ?? 'Empty'}</h3>
    {member && <><MemberLevel member={member} />{techniques && <p>Current techniques: {names(member.techniques)}</p>}</>}
  </li>)}</ol>
</section>;

export const FinalRosterSummary = ({ members, techniques }: { members: RouteMember[]; techniques: boolean }) => <section aria-labelledby="route-roster-title">
  <h2 id="route-roster-title">Final roster</h2>
  <ul className="route-roster">{members.map((member, i) => <li className="route-member route-keep" key={i}>
    <h3>{member.name} · {member.status}</h3><p>{member.rank}</p><MemberLevel member={member} />
    <dl className="route-stats">{member.stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
    {techniques && <><p>Current techniques: {names(member.techniques)}</p>
      {member.pending.length ? <div><p>Pending techniques:</p><ul>{member.pending.map(group => <li key={group.level}>EL{group.level}: {names(group.names)}</li>)}</ul></div> : <p>Pending: None</p>}</>}
    {member.availableNow && <p>Now: Digivolution available</p>}<p>Next milestone: {member.next}</p>
  </li>)}</ul>
</section>;

export const RouteDocument = ({ model, options = DEFAULT_ROUTE_OPTIONS }: { model: RouteDocumentModel; options?: RouteOptions }) => <article className="route-document" aria-label="Route document">
  <header className="route-document-header"><p>Digimon World 2</p><h1>Speedrun Planner Route</h1><h2>{model.name}</h2>
    <p>Original starter: {model.starter}</p><p>Generated: {model.generated}</p>
    <dl className="route-metadata"><div><dt>Recorded battles</dt><dd>{model.battles}</dd></div><div><dt>Total actions</dt><dd>{model.actions.length}</dd></div>
      <div><dt>Current Bits</dt><dd>{model.bits}</dd></div><div><dt>Roster</dt><dd>{model.roster.length}</dd></div></dl>
  </header>
  <RouteActionList actions={model.actions} options={options} />
  {options.digiline && <FinalDigilineSummary members={model.digiline} techniques={options.techniques} />}
  {options.roster && <FinalRosterSummary members={model.roster} techniques={options.techniques} />}
</article>;
