// Historical accuracy/continuous-search contracts deliberately compare action-only
// timing. Phase 2O-B's canonical totals are covered by roundTransitionTiming tests.
const {load}=require('./loadTs.cjs');
function stripTiming(value) {
 if(Array.isArray(value))return value.map(stripTiming);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!['timing','fastestBattleHistoryTiming','fastestBattleByFramesTiming'].includes(key)).map(([key,item])=>[key,stripTiming(item)]));
}
function withActionOnlyTiming(fn) {
 const timing=load('src/utils/battle/battleTiming.ts'),original=timing.summarizeBattleTiming;
 timing.summarizeBattleTiming=actions=>{
  const {actionFrames,roundTransitionFrames,roundTransitions,...old}=original(actions,[]);
  return old;
 };
 try{return stripTiming(fn());}finally{timing.summarizeBattleTiming=original;}
}
module.exports={stripTiming,withActionOnlyTiming};
