const fs=require('node:fs'),{performance}=require('node:perf_hooks');
const {load}=require('../tests/helpers/loadTs.cjs'),{cases}=require('../tests/helpers/battleFixtures.cjs');
const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts');
const {createSimulationSearch}=load('src/utils/battle/battleSimulationSearch.ts');
const {createSeededBattleRng,createBattleRng}=load('src/utils/battle/battleRng.ts');
const input={player:cases.single[0],enemy:cases.single[1],floorSpecialty:'None'};
const report={node:process.version,fixture:'cases.single',seed:42,environment:'Node worker host, actual task yields and cloned messages; not browser end-to-end',policy:{batchBudgetMs:50,maxBatchSize:1000,progressIntervalMs:150},rngSamples:[],samples:[]};
fs.mkdirSync('docs/phase-2k-i2',{recursive:true});
const save=()=>fs.writeFileSync('docs/phase-2k-i2/performance.json',JSON.stringify(report,null,2)+'\n');
(async()=>{
  for(const accuracyMode of ['strategy','game-accurate']){
    const seed=createSeededBattleRng(42),draws={};
    const search=createSimulationSearch(input,1000,{simulationRules:{accuracyMode},rng:createBattleRng(()=>seed.nextFloat(),category=>draws[category]=(draws[category]??0)+1)});
    while(!search.done)search.step();
    report.rngSamples.push({accuracyMode,simulations:1000,draws});
  }
  for(const requested of [10000,100000,1000000])for(const accuracyMode of ['strategy','game-accurate']){
    let result,progressMessages=0;
    const host=createSimulationWorkerHost(message=>{
      const m=structuredClone(message);
      if(m.type==='ERROR')throw Error(m.message);
      if(m.type==='PROGRESS')progressMessages++;
      if(m.result)result=m.result;
    });
    const start=performance.now();
    await host.receive({type:'START',jobId:'bench',input,requestedSimulations:requested,seed:42,simulationRules:{accuracyMode}});
    const wallMs=performance.now()-start;
    const row={accuracyMode,requested,wallMs,simulationsPerSecond:requested/wallMs*1000,progressMessages,resultBytes:Buffer.byteLength(JSON.stringify(result)),bestFrames:result.minFrames,bestOccurrenceCount:result.search.bestOccurrenceCount,successfulVictories:result.completedSuccesses};
    report.samples.push(row);save();console.log(JSON.stringify(row));
  }
})().catch(e=>{console.error(e);process.exitCode=1});
