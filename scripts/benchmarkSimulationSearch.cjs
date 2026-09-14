const fs=require('node:fs'),{performance}=require('node:perf_hooks');
const {load}=require('../tests/helpers/loadTs.cjs');const {cases}=require('../tests/helpers/battleFixtures.cjs');
const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts');
const {runLegacyBattleSimulation}=load('src/utils/battle/battleCompatibility.ts');const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const input={player:cases.single[0],enemy:cases.single[1],floorSpecialty:'None'};
const report={node:process.version,fixture:'cases.single: canonical single-target attack, player/enemy with ordinary accuracy and resource accounting',policy:{batchBudgetMs:50,maxBatchSize:1000,progressIntervalMs:150,yield:'setTimeout(0)'},samples:[]};
const save=()=>fs.writeFileSync('docs/phase-2k-i1/performance.json',JSON.stringify(report,null,2)+'\n');
(async()=>{
 let t=performance.now();runLegacyBattleSimulation(input.player,input.enemy,'None',10000,{rng:createSeededBattleRng(42)});report.continuous10kMs=performance.now()-t;
 for(const requested of [10000,100000,1000000]){
  let batches=-1,messages=0,result,maxMessageBytes=0;global.gc?.();const before=process.memoryUsage().heapUsed;
  const host=createSimulationWorkerHost(m=>{const copy=structuredClone(m);if(copy.type==='PROGRESS'){messages++;maxMessageBytes=Math.max(maxMessageBytes,Buffer.byteLength(JSON.stringify(copy)));}else if(copy.result)result=copy.result;else throw Error(copy.message);},{now:()=>performance.now(),yieldTask:()=>{batches++;return new Promise(r=>setTimeout(r,0))},...report.policy});
  t=performance.now();await host.receive({type:'START',jobId:'bench',input,requestedSimulations:requested,seed:42});const wallMs=performance.now()-t;
  global.gc?.();const retainedHeapDelta=process.memoryUsage().heapUsed-before;
  const row={requested,totalWallMs:wallMs,simulationsPerSecond:requested/wallMs*1000,progressMessages:messages,maxProgressBytes:maxMessageBytes,batchCount:batches+1,retainedHeapDelta,resultBytes:Buffer.byteLength(JSON.stringify(result)),retainedHistories:[result.fastestBattleHistory.length,result.fastestBattleByFrames.length],semantic:{total:result.totalSimulations,successes:result.completedSuccesses,minFrames:result.minFrames,avgFrames:result.avgFrames,maxFrames:result.maxFrames,recoveryRuns:result.runsWithResourceAlerts,bestFound:result.search.bestFoundAtSimulation,occurrences:result.search.bestOccurrenceCount}};report.samples.push(row);save();console.log(JSON.stringify(row));
 }
 let cancelledAt,terminalAt;const cancelHost=createSimulationWorkerHost(m=>{if(m.type==='PROGRESS'&&m.progress.completedSimulations>0&&!cancelledAt){cancelledAt=performance.now();setTimeout(()=>cancelHost.receive({type:'CANCEL',jobId:'cancel'}),0);}if(m.type==='CANCELLED')terminalAt=performance.now();});await cancelHost.receive({type:'START',jobId:'cancel',input,requestedSimulations:1000000,seed:42});report.cancellationLatencyMs=terminalAt-cancelledAt;report.batched10kOverheadPercent=(report.samples[0].totalWallMs/report.continuous10kMs-1)*100;save();console.log('done',report.cancellationLatencyMs);
})().catch(e=>{console.error(e);process.exitCode=1});
