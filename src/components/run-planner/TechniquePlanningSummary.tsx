import { RosterDigimon } from '@/types/runPlanner';
import { PLANNER_SCOPE_MAX_EL } from '@/data/statGrowthTables';
import { getPlanningSummary } from '@/utils/runPlanningDisplay';

export const TechniquePlanningSummary = ({ member }: { member: RosterDigimon }) => {
  const { pending, next, availableNow } = getPlanningSummary(member);
  const pendingList = <ul className="space-y-1">{pending.map(p => <li key={p.key}>
    {p.name} — EL{p.level} <span className="text-muted-foreground">({p.origin}{p.level > PLANNER_SCOPE_MAX_EL ? '; beyond verified XP progression'
      : member.levelCap.resolved !== null && p.level > member.levelCap.resolved ? '; beyond current cap'
      : member.levelCap.resolved === null && p.level > member.levelCap.min ? '; requires cap resolution' : ''})</span>
  </li>)}</ul>;
  return <div className="space-y-1 text-sm" aria-label={`Technique planning for ${member.name}`}>
    {pending.length > 3 ? <details><summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      Pending: {pending.length} · next EL{pending[0].level}</summary>{pendingList}</details>
      : <div><span className="text-muted-foreground">Pending: </span>{pending.length ? pendingList : 'None'}</div>}
    {availableNow && <p>Now: Digivolution available</p>}
    <p><span className="text-muted-foreground">Next milestone: </span>{next}</p>
  </div>;
};
