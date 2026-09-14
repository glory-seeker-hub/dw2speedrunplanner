const fs=require('node:fs'),{performance}=require('node:perf_hooks');
const {canonical,load}=require('../tests/helpers/optimizedFixtures.cjs');
const {rootPlanInfo,enumeratePlayerRoundPlans}=load('src/utils/battle/battleActionPlans.ts');
const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts');
const {createSimulationSearch}=load('src/utils/battle/battleSimulationSearch.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const {OPTIMIZED_PRESETS}=load('src/utils/battle/battleOptimizedSearch.ts');
const {compareCandidates,emptyCandidateStats}=load('src/utils/battle/battleSearchObjectives.ts');
const input=canonical(),report={node:process.version,seed:42,fixture:'3 Players each 4 Singles + 1 AOE; 3 selectable Enemies each 1 Single; low Enemy current HP makes terminal representatives practical',environment:'Node production worker host with task yields and cloned messages; not browser end-to-end',samples:[]};
fs.mkdirSync('docs/phase-2k-i3',{recursive:true});
const save=()=>fs.writeFileSync('docs/phase-2k-i3/performance.json',JSON.stringify(report,null,2)+'\n');
(async()=>{
  let started=performance.now();const root=rootPlanInfo(input),all=[...enumeratePlayerRoundPlans(root.state)];report.rootEnumerationMs=performance.now()-started;report.rootPlans=all.length;
  const ranks=all.map(p=>({key:p.key,stats:emptyCandidateStats()}));started=performance.now();ranks.reverse().sort((a,b)=>compareCandidates(a,b,'fastest-potential'));report.rank2197Ms=performance.now()-started;
  for(const [quality,mode]of [['Quick','strategy'],['Standard','strategy'],['Deep','strategy'],['Standard','game-accurate']]){
    const {budget,beamWidth,maxDepth}=OPTIMIZED_PRESETS[quality];let result,maxProgressBytes=0,progressMessages=0;
    global.gc?.();const heapBefore=process.memoryUsage().heapUsed;
    const host=createSimulationWorkerHost(message=>{const m=structuredClone(message);if(m.type==='ERROR')throw Error(m.message);if(m.type==='PROGRESS'){progressMessages++;maxProgressBytes=Math.max(maxProgressBytes,Buffer.byteLength(JSON.stringify(m)));}if(m.result)result=m.result;});
    started=performance.now();await host.receive({type:'START',jobId:'bench',input,requestedSimulations:budget,searchMethod:'optimized-action-search',optimizationObjective:'fastest-potential',optimizedConfig:{beamWidth,maxDepth},simulationRules:{accuracyMode:mode},seed:42});
    const wallMs=performance.now()-started;global.gc?.();
    const row={quality,accuracyMode:mode,configuredBudget:budget,rootPlans:result.optimized.rootPlanCount,depth:result.optimized.depth,evaluations:result.optimized.evaluations,candidates:result.optimized.candidatesEvaluated,beamSize:result.optimized.beamSize,wallMs,evaluationsPerSecond:result.optimized.evaluations/wallMs*1000,stats:result.optimized.recommendedStats,bestObservedFrames:result.minFrames,resultBytes:Buffer.byteLength(JSON.stringify(result)),retainedHeapDelta:process.memoryUsage().heapUsed-heapBefore,maxProgressBytes,progressMessages};report.samples.push(row);save();console.log(JSON.stringify(row));
  }
  const used=report.samples.find(r=>r.quality==='Standard'&&r.accuracyMode==='strategy').evaluations;
  started=performance.now();const mc=createSimulationSearch(input,used,{rng:createSeededBattleRng(42),simulationRules:{accuracyMode:'strategy'}});while(!mc.done)mc.step();const random=mc.result('completed',performance.now()-started);report.monteCarloComparison={budget:used,randomBestFrames:random.minFrames,optimizedBestFrames:report.samples[1].bestObservedFrames,randomWallMs:performance.now()-started,interpretation:'Same best when a one-action AOE victory is found; architectural comparison, not a superiority assertion.'};
  const longer=canonical(2);longer.player=longer.player.slice(0,2);longer.player.forEach(p=>p.techs=[p.techs[0],p.techs[1],p.techs[4]]);longer.enemy.forEach(e=>e.currentHp=500);
  let deeper;const depthHost=createSimulationWorkerHost(m=>{if(m.type==='ERROR')throw Error(m.message);if(m.result)deeper=m.result;});started=performance.now();
  await depthHost.receive({type:'START',jobId:'depth',input:longer,requestedSimulations:5000,searchMethod:'optimized-action-search',optimizedConfig:{beamWidth:4,maxDepth:4},seed:42,simulationRules:{accuracyMode:'strategy'}});
  report.deeperSearch={rootPlans:deeper.optimized.rootPlanCount,depth:deeper.optimized.depth,evaluations:deeper.optimized.evaluations,candidates:deeper.optimized.candidatesEvaluated,beamSize:deeper.optimized.beamSize,wallMs:performance.now()-started,stats:deeper.optimized.recommendedStats,resultBytes:Buffer.byteLength(JSON.stringify(deeper))};
  let cancelStart,terminal;const cancelHost=createSimulationWorkerHost(m=>{if(m.type==='PROGRESS'&&m.progress.completedSimulations>0&&!cancelStart){cancelStart=performance.now();setTimeout(()=>cancelHost.receive({type:'CANCEL',jobId:'cancel'}),0);}if(m.type==='CANCELLED')terminal=m.result;});
  await cancelHost.receive({type:'START',jobId:'cancel',input,requestedSimulations:1000000,searchMethod:'optimized-action-search',seed:42,simulationRules:{accuracyMode:'strategy'}});report.cancellation={latencyMs:performance.now()-cancelStart,evaluations:terminal.optimized.evaluations,fairStageEvaluations:terminal.optimized.fairStageEvaluations};
  save();console.log('Completed optimized benchmarks.');
})().catch(e=>{console.error(e);process.exitCode=1});
