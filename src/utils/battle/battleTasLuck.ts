import type { BattleRng } from './battleRng';
import type { RngResolution } from './battleRngPolicy';
import type { BattleRunResult, BattleState, PlannedAction } from './battleTypes';
import type { PlayerRoundPlan } from './battleActionPlans';
import { playerDecisionTraceKey } from './battlePlayerDecisionTrace';

export interface TasLuckOpportunity {
  key: string; round: number; actionId: string; actorId: string; skillName: string | null;
  targetId: string; status?: string; phase: RngResolution['category'];
  alternatives: RngResolution['outcome'][]; probabilities: { numerator: number; denominator: number }[];
}
export interface TasLuckDecision extends TasLuckOpportunity { selected: RngResolution['outcome'] }
export type TasLuckDecisionTrace = TasLuckDecision[];
export interface TasLuckSummary { frontierCap: number; workLimit: number; opportunities: number; branchesExplored: number; deduplicated: number; pruned: number; maxFrontier: number }
export const tasLuckCapForBudget = (budget: number) => budget <= 10000 ? 8 : budget >= 1000000 ? 32 : 16;
export const emptyTasLuckSummary = (cap: number): TasLuckSummary => ({ frontierCap: cap, workLimit: cap * 256, opportunities: 0, branchesExplored: 0, deduplicated: 0, pruned: 0, maxFrontier: 0 });
export function addTasLuckSummary(a: TasLuckSummary, b: TasLuckSummary) {
  for (const k of ['opportunities','branchesExplored','deduplicated','pruned'] as const) a[k] += b[k];
  a.maxFrontier = Math.max(a.maxFrontier,b.maxFrontier);
}
export const tasLuckTraceKey = (trace: readonly TasLuckDecision[]) => JSON.stringify(trace.map(d=>[d.key,d.selected]));
export class TasLuckDivergence extends Error {}
export class TasLuckBranch extends Error {
  constructor(public opportunity: TasLuckOpportunity, public trace: TasLuckDecisionTrace, public checkpoint: string) { super('TAS Luck branch'); }
}
export interface TasLuckControl {
  readonly lastOpportunityKey?: string;
  action(state: BattleState, action: PlannedAction, continuation?: () => unknown): void;
  choose(category: RngResolution['category'], status: string | undefined, targetId: string | undefined,
    alternatives: RngResolution['outcome'][], numerator: number, denominator: number): RngResolution['outcome'];
}
/** Replay prefixes stop at the first unassigned Enemy Confusion + Paralysis action gate. No Natural draw is consumed. */
export function createTasLuckReplay(trace: readonly TasLuckDecision[], strict = false) {
  let state: BattleState | undefined, action: PlannedAction | undefined, index = 0;
  const visited: TasLuckDecisionTrace = [];
  let continuation: (()=>unknown) | undefined;
  const control: TasLuckControl = {
    get lastOpportunityKey() { return visited[visited.length - 1]?.key; },
    action(s,a,c) { state=s; action=a; continuation=c; },
    choose(category,status,targetId,alternatives,numerator,denominator) {
      if (!state || !action) throw new TasLuckDivergence('TAS gate has no execution identity.');
      const opportunity: TasLuckOpportunity = { key: JSON.stringify([action.id,index,category,targetId ?? action.actorId,status]),
        round: state.round, actionId: action.id, actorId: action.actorId, skillName: action.skill.legacyTech.name,
        targetId: targetId ?? action.actorId, status, phase: category, alternatives: [...alternatives],
        probabilities: [{numerator,denominator},{numerator:denominator-numerator,denominator}] };
      const expected=trace[index++];
      if (!expected) {
        if (strict) throw new TasLuckDivergence('Unrecorded TAS opportunity: '+opportunity.key);
        // Compare full engine state, continuation, timing/history and Natural stream
        // position. No HP-only or status-only merging.
        throw new TasLuckBranch(opportunity,visited,JSON.stringify([state,opportunity.key,continuation?.()]));
      }
      if (expected.key!==opportunity.key || !alternatives.includes(expected.selected)) throw new TasLuckDivergence('TAS trace diverged at '+opportunity.key);
      visited.push({...opportunity,selected:expected.selected});return expected.selected;
    },
  };
  return { control, visited, finish() { if (index !== trace.length) throw new TasLuckDivergence('Unused TAS replay decisions: '+(trace.length-index)); } };
}
export interface TasLuckSample { result: BattleRunResult; diverged: boolean; decisionTrace: PlayerRoundPlan[]; nextState?: BattleState | null }
const lexical=(a:string,b:string)=>a<b?-1:a>b?1:0;
/** One sample/seed; multiple bounded replay branches; exactly one terminal observation. */
export function createTasLuckSearch(execute: (control: TasLuckControl) => TasLuckSample, cap: number, reverseOutcomes = false) {
  if (![8,16,32].includes(cap)) throw new Error('Unsupported TAS frontier cap.');
  const summary=emptyTasLuckSummary(cap);
  let frontier: TasLuckDecisionTrace[] | null=null, best: TasLuckSample | null=null, started=false;
  let seen: Map<string,string> | null=null;
  const compare=(a:TasLuckSample,b:TasLuckSample)=>{
    const win=(s:TasLuckSample)=>!s.diverged&&s.result.outcome==='player-win';
    return Number(win(b))-Number(win(a)) || (win(a)?(a.result.totalFrames??Infinity)-(b.result.totalFrames??Infinity):0)
      || lexical(tasLuckTraceKey(a.result.tasLuckTrace??[]),tasLuckTraceKey(b.result.tasLuckTrace??[]))
      || lexical(playerDecisionTraceKey(a.decisionTrace),playerDecisionTraceKey(b.decisionTrace));
  };
  return {
    summary, get done(){return started && !frontier?.length;}, get best(){return best;},
    step(){
      if (started && !frontier?.length) return;
      const prefix=started ? frontier!.shift()! : [];
      if (started) summary.branchesExplored++;
      started=true;
      const replay=createTasLuckReplay(prefix);
      try {
        const sample=execute(replay.control);replay.finish();sample.result.tasLuckTrace=structuredClone(replay.visited);
        if(!best||compare(sample,best)<0)best=sample;
      } catch(error) {
        if(!(error instanceof TasLuckBranch))throw error;
        summary.opportunities++;
        frontier ??= [];
        seen ??= new Map<string,string>();
        const key=error.checkpoint;
        if(seen.has(key) && seen.get(key)! <= tasLuckTraceKey(error.trace))summary.deduplicated++;
        else {
          // Only retain keys for the active bounded expansion, never all visited states.
          seen.set(key,tasLuckTraceKey(error.trace));
          if(seen.size>cap)seen.delete(seen.keys().next().value!);
          const outcomes=reverseOutcomes?[...error.opportunity.alternatives].reverse():error.opportunity.alternatives;
          frontier.push(...outcomes.map(selected=>[...error.trace,{...error.opportunity,selected}]));
        }
      }
      if (!frontier) return; // Direct favorable sample: no frontier or nested replay.
      // Depth-first canonical order guarantees a terminal path before work pruning.
      frontier.sort((a,b)=>b.length-a.length||lexical(tasLuckTraceKey(a),tasLuckTraceKey(b)));
      const unique=new Map<string,TasLuckDecisionTrace>();for(const t of frontier){const k=tasLuckTraceKey(t);if(unique.has(k))summary.deduplicated++;else unique.set(k,t);}
      frontier=[...unique.values()];
      if(frontier.length>cap){summary.pruned+=frontier.length-cap;frontier.length=cap;}
      summary.maxFrontier=Math.max(summary.maxFrontier,frontier.length);
      if(best&&summary.branchesExplored>=summary.workLimit){summary.pruned+=frontier.length;frontier=[];}
    },
  };
}
export function attachTasLuck(rng: BattleRng, control?: TasLuckControl): BattleRng { return control ? {...rng,tasLuck:control} : rng; }

export function tasLuckRequirements(trace: readonly TasLuckDecision[], state: BattleState): import('./battleRngAudit').TasRngRequirement[] {
  return trace.map(d=>{
    const actor=state.combatants.find(a=>a.id===d.actorId)!,target=state.combatants.find(a=>a.id===d.targetId)!;
    return {opportunityKey:d.key,actionId:d.actionId,round:d.round,actorId:d.actorId,actorName:actor.name,
      targetId:d.targetId,targetName:target.name,skillName:d.skillName,status:d.status,phase:'execution',
      resolution:{policy:'tas-luck',category:d.phase,affectedSide:target.side,outcome:d.selected,
        naturalProbability:d.probabilities[d.alternatives.indexOf(d.selected)],rollSkipped:true}};
  });
}
