const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {small,canonical,load}=require('./helpers/optimizedFixtures.cjs');
const {createOptimizedSearch,createOptimizedSearchPass,OPTIMIZED_PRESETS,optimizedConfigForBudget}=load('src/utils/battle/battleOptimizedSearch.ts');
const {createOptimizedPassSearch,explorationSeedForPass,mergeScreenedCandidates,resolveThoroughnessPolicy}=load('src/utils/battle/battleSearchPasses.ts');
const {compareCandidates,rolloutSeed}=load('src/utils/battle/battleSearchObjectives.ts');
const {snapshotSimulationReportJob,buildBattleSimulationReport}=load('src/utils/battle/battleSimulationReport.ts');
const {serializeBattleSimulationReportMarkdown:md,serializeBattleSimulationReportJson:json}=load('src/utils/battle/battleSimulationReportSerialization.ts');
const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts');
const {host,button,find}=require('./helpers/componentHost.cjs');
const {branching,stochastic,pruningSeed}=require('./fixtures/searchThoroughnessCases.json');
const opts={seed:42,config:{beamWidth:2,maxDepth:2},simulationRules:{accuracyMode:'strategy'}};
const finish=s=>{let steps=0;while(!s.done){s.step();assert.ok(++steps<1000000);}return s.result('completed',100);};
const base=finish(createOptimizedSearchPass(small(),300,opts));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
for(const row of JSON.parse(fs.readFileSync('tests/fixtures/searchThoroughnessBaseline.json')).rows)test('committed L3 full semantic hash: '+row.kind+' '+row.options.objective,()=>{
 const r=finish(createOptimizedSearch(row.kind==='small'?small():canonical(),row.budget,row.options));
 assert.equal(r.optimized.passes.passesStarted,1);assert.equal(r.optimized.evaluations,row.evaluations);assert.deepEqual(r.optimized.effort.screeningSchedule,[4,16,64]);assert.deepEqual(r.optimized.config,row.options.config);
 for(const o of [r.optimized,r.search.optimized]){delete o.passes;delete o.effort;}
 assert.equal(createHash('sha256').update(JSON.stringify(stable(r))).digest('hex'),row.hash);
});
test('legacy missing setting is explicit Standard',()=>assert.deepEqual(finish(createOptimizedSearch(small(),300,opts)),finish(createOptimizedSearch(small(),300,{...opts,searchThoroughness:'standard'}))));
for(const rngPolicy of ['natural','tas-luck'])for(const objective of ['fastest-potential','average-victory','success-rate'])test('stronger comparable screening, no terminal restarts: '+rngPolicy+' '+objective,()=>{
 let previous=0;for(const [searchThoroughness,expected]of [['standard',64],['thorough',128],['maximum',256]]){
 const settings={...opts,objective,searchThoroughness,simulationRules:{accuracyMode:'strategy',rngPolicy}},r=finish(createOptimizedSearch(small(),1000,settings)),o=r.optimized;
 assert.equal(o.recommendedStats.evaluations,expected);assert.ok(o.evaluations>previous);previous=o.evaluations;assert.equal(o.passes.passesStarted,1);assert.ok(o.evaluations<=1000);assert.ok(o.topCandidates.length<=5);assert.equal(new Set(o.topCandidates.map(c=>c.key)).size,o.topCandidates.length);
 assert.deepEqual(o.fastestRoute.actions,r.fastestBattleByFrames);assert.equal(r.search.completedSimulations,o.evaluations);assert.deepEqual(r,finish(createOptimizedSearch(small(),1000,settings)));
 }
});
for(const mode of ['standard','thorough','maximum'])test('hard budget and complete-stage accounting '+mode,()=>{
 for(const budget of [4,5,63,64,65,68,128,300]){const r=finish(createOptimizedSearch(small(),budget,{...opts,searchThoroughness:mode})),o=r.optimized;assert.ok(o.evaluations<=budget);assert.ok(o.effort.completedStages.includes(o.recommendedStats.evaluations));assert.equal(Object.values(o.effort.stageEvaluations).reduce((a,b)=>a+b,0),o.evaluations);if(o.evaluations===budget)assert.equal(o.passes.stopReason,'budget-exhausted');}
});
test('minimum root initialization stays count times four; larger schedules adapt to affordability',()=>{
 assert.throws(()=>createOptimizedSearch(canonical(),8787,{...opts,searchThoroughness:'maximum'}),/Minimum required.*8788/);
 for(const mode of ['standard','thorough','maximum']){const p=resolveThoroughnessPolicy(mode,2197,10000,{beamWidth:8,maxDepth:4});assert.deepEqual(p.screeningSchedule,[4,16,64]);assert.equal(p.config.maxDepth,4);}
});
test('common fair-world prefix extends identically across all modes',()=>{
 const plans=load('src/utils/battle/battleActionPlans.ts'),original=plans.replayPlayerPrefix,schedules=[];
 try {for(const mode of ['standard','thorough','maximum']){const seeds=[];plans.replayPlayerPrefix=(...a)=>{if(!a[4])seeds.push(a[2]);return original(...a);};finish(createOptimizedSearch(small(),1000,{...opts,searchThoroughness:mode}));schedules.push(seeds);}}
 finally{plans.replayPlayerPrefix=original;}
 assert.deepEqual(schedules.map(s=>s.length),[64,128,256]);assert.deepEqual(schedules[1].slice(0,64),schedules[0]);assert.deepEqual(schedules[2].slice(0,128),schedules[1]);assert.equal(new Set(schedules[2]).size,256);
 assert.equal(schedules[0][0],rolloutSeed(42,1,plans.prefixKey([]),0));
});
test('controlled real-battle witness: 4 samples prune eventual 128-sample winner, Thorough retains it',()=>{
 const options={seed:pruningSeed,maxRounds:12,objective:'average-victory',config:{beamWidth:1,maxDepth:1},simulationRules:{accuracyMode:'game-accurate'}};
 let initial;
 const s=createOptimizedSearchPass(stochastic,5000,{...options,onStage:(stage,rows)=>{if(stage.samples===4)initial=rows.map(c=>({key:c.key,stats:{...c.stats}}));}}),legacy=finish(s).optimized;
 const thorough=finish(createOptimizedSearch(stochastic,5000,{...options,searchThoroughness:'thorough'})).optimized;
 const oracle=finish(createOptimizedSearchPass(stochastic,5000,{...options,config:{beamWidth:4,maxDepth:1},screeningSchedule:[128]})).optimized;
 const best=oracle.topCandidates[0];assert.notEqual(initial.sort((a,b)=>compareCandidates(a,b,'average-victory'))[0].key,best.key);
 assert.ok(!legacy.topCandidates.some(c=>c.key===best.key));assert.ok(thorough.topCandidates.some(c=>c.key===best.key));
 const oldAt128=oracle.topCandidates.find(c=>c.key===legacy.topCandidates[0].key);assert.ok(compareCandidates(best,oldAt128,'average-victory')<0);
 assert.equal(thorough.rootPlanCount,legacy.rootPlanCount);
});
test('wider retention grows useful beam without changing legal root universe or depth',()=>{
 const a=finish(createOptimizedSearch(branching,12000,{...opts,config:{beamWidth:4,maxDepth:4},maxRounds:12})).optimized;
 const b=finish(createOptimizedSearch(branching,12000,{...opts,config:{beamWidth:4,maxDepth:4},maxRounds:12,searchThoroughness:'thorough'})).optimized;
 assert.equal(a.rootPlanCount,b.rootPlanCount);assert.equal(b.config.beamWidth,8);assert.equal(b.config.maxDepth,4);assert.ok(b.effort.maxBeam>a.effort.maxBeam);assert.ok(b.evaluations>a.evaluations);
});
test('Maximum fallback follows enhanced stages, uses distinct exploration and preserves cumulative work',()=>{
 const seen=[];const options={...opts,config:{beamWidth:2,maxDepth:2},maxRounds:12,searchThoroughness:'maximum'};
 const s=createOptimizedPassSearch(stochastic,20000,options,(i,b,o)=>{seen.push({budget:b,seed:o.seed,exploration:o.explorationSeed,schedule:o.screeningSchedule});return createOptimizedSearchPass(i,b,o);});let used=0,best=Infinity;
 while(!s.done){s.step();if(s.completed%128===0){const p=s.progress(100);assert.ok(p.completedSimulations>=used);used=p.completedSimulations;if(p.bestFrames!==null){assert.ok(p.bestFrames<=best);best=p.bestFrames;}}}
 const r=s.result('completed',100);assert.ok(seen.length>1);assert.deepEqual(seen[0].schedule,[16,64,256]);assert.equal(seen[0].exploration,undefined);assert.equal(seen[1].exploration,explorationSeedForPass(42,2));assert.ok(seen.every(x=>x.seed===42));assert.ok(r.optimized.evaluations<=20000);assert.equal(r.optimized.recommendedStats.evaluations,256);assert.equal(r.search.etaMs,null);
});
test('restart exploration changes continuation choices, never fair worlds',()=>{
 const plans=load('src/utils/battle/battleActionPlans.ts'),original=plans.replayPlayerPrefix,paths=[];
 try{for(const explorationSeed of [undefined,explorationSeedForPass(42,2),explorationSeedForPass(42,3)]){const seen=[];plans.replayPlayerPrefix=(...a)=>{if(a[4])seen.push({key:plans.prefixKey(a[1]),seed:a[2]});return original(...a);};finish(createOptimizedSearchPass(stochastic,3000,{...opts,explorationSeed,config:{beamWidth:2,maxDepth:3},maxRounds:12}));paths.push(seen);}}finally{plans.replayPlayerPrefix=original;}
 assert.ok(paths[0].length);assert.notDeepEqual(paths[0],paths[1]);assert.equal(new Set([1,2,3].map(p=>explorationSeedForPass(42,p))).size,3);
});
// Controlled adapter isolates aggregate decisions from battle mechanics.
function harness(rows,budget=30){let index=0;const caps=[];const search=createOptimizedPassSearch(small(),budget,{...opts,searchThoroughness:'maximum'},(input,cap)=>{
 const row=rows[index++];assert.ok(row,'unexpected extra pass');caps.push(cap);let done=false,count=0;
 const r=structuredClone(base);r.optimized.evaluations=row.used;delete r.optimized.effort;r.optimized.fastestRoute=row.frames===null?null:{...r.optimized.fastestRoute,totalFrames:row.frames,seed:index,sourcePrefixKey:'pass-'+index};r.optimized.topCandidates=row.candidates??r.optimized.topCandidates;
 return {minimumBudget:4,get done(){return done;},get completed(){return count;},get fastestRoute(){return count?r.optimized.fastestRoute:null;},get topCandidates(){return done?r.optimized.topCandidates:[];},step(){count=row.used;done=true;},progress:elapsed=>({...r.search,elapsedMs:elapsed,optimized:r.optimized}),result:()=>r};});return{search,caps};}
test('global fastest 15000 -> 14500 -> 14800 retains pass 2 concrete provenance',()=>{
 const h=harness([{used:10,frames:15000},{used:10,frames:14500},{used:10,frames:14800}]),r=finish(h.search);assert.equal(r.optimized.fastestRoute.totalFrames,14500);assert.equal(r.optimized.passes.fastestPass,2);assert.equal(r.optimized.passes.fastestImprovements,2);assert.equal(r.optimized.fastestRoute.seed,2);assert.equal(r.optimized.fastestRoute.sourcePrefixKey,'pass-2');assert.deepEqual(h.caps,[30,20,10]);
});
test('zero progress terminates safely without charging evaluations',()=>{const h=harness([{used:0,frames:null}]),r=finish(h.search);assert.equal(r.optimized.evaluations,0);assert.equal(r.optimized.passes.stopReason,'no-progress');assert.equal(h.caps.length,1);});
test('valid zero victory may be followed by winner',()=>{const r=finish(harness([{used:10,frames:null,candidates:[]},{used:10,frames:1000}],20).search);assert.equal(r.optimized.passes.fastestPass,2);assert.equal(r.optimized.fastestRoute.totalFrames,1000);});
test('remaining budget must support meaningful enhanced restart',()=>{const r=finish(harness([{used:10,frames:1000}],19).search);assert.equal(r.optimized.passes.stopReason,'insufficient-budget-for-pass');assert.equal(r.optimized.evaluations,10);});
for(const objective of ['fastest-potential','average-victory','success-rate'])test('unchanged cross-pass comparator, dedup and incomplete-stage exclusion '+objective,()=>{
 const a=structuredClone(base.optimized.topCandidates[0]),b=structuredClone(a);a.key='A';b.key='B';a.stats={...a.stats,evaluations:256,fastestFrames:1500,averageVictoryFrames:1500,successRate:.9};b.stats={...b.stats,evaluations:256,fastestFrames:1400,averageVictoryFrames:1400,successRate:1};
 const low={...b,key:'partial',stats:{...b.stats,evaluations:64,fastestFrames:1,averageVictoryFrames:1}},rows=mergeScreenedCandidates([a],[b,low,b],objective);assert.equal(rows.length,2);assert.equal(rows[0].key,[a,b].sort((x,y)=>compareCandidates(x,y,objective))[0].key);assert.equal(rows[0].stats.evaluations,256);
});
for(const searchThoroughness of ['thorough','maximum'])test('Worker cancellation preserves partial completed stages '+searchThoroughness,async()=>{
 const messages=[];let worker;worker=createSimulationWorkerHost(m=>{messages.push(structuredClone(m));if(m.type==='PROGRESS'&&m.progress.completedSimulations>=20)worker.receive({type:'CANCEL',jobId:'cancel'});},{now:()=>0,yieldTask:async()=>{},batchBudgetMs:50,maxBatchSize:1,progressIntervalMs:0});
 const request={type:'START',jobId:'cancel',input:small(),requestedSimulations:1000,searchMethod:'optimized-action-search',seed:42,searchThoroughness,optimizedConfig:opts.config,simulationRules:opts.simulationRules};await worker.receive(request);const end=messages.at(-1);assert.equal(end.type,'CANCELLED');assert.equal(end.result.optimized.evaluations,20);assert.equal(end.result.optimized.passes.passesStarted,1);assert.equal(end.result.optimized.passes.passesCompleted,0);assert.equal(end.result.optimized.passes.stopReason,'cancelled');assert.ok(end.result.optimized.recommendedStats.evaluations<20);assert.equal(Object.values(end.result.optimized.effort.stageEvaluations).reduce((a,b)=>a+b,0),20);
 const report=buildBattleSimulationReport(end.result,snapshotSimulationReportJob(request));assert.equal(report.resultStatus,'cancelled');assert.match(md(report),/Cancelled \/ Partial/);
});
test('Worker cancellation in Maximum restart prevents any next restart',async()=>{
 const messages=[];let firstCount=0,worker;worker=createSimulationWorkerHost(m=>{messages.push(structuredClone(m));if(m.type==='PROGRESS'&&m.progress.optimized.passes.passIndex===2){firstCount=m.progress.completedSimulations-m.progress.optimized.passes.currentPassEvaluations;if(m.progress.optimized.passes.currentPassEvaluations>=4)worker.receive({type:'CANCEL',jobId:'restart'});}},{now:()=>0,yieldTask:async()=>{},batchBudgetMs:50,maxBatchSize:1,progressIntervalMs:0});
 await worker.receive({type:'START',jobId:'restart',input:stochastic,requestedSimulations:20000,searchMethod:'optimized-action-search',seed:42,searchThoroughness:'maximum',optimizedConfig:{beamWidth:2,maxDepth:2},maxRounds:12,simulationRules:opts.simulationRules});
 const end=messages.at(-1);assert.equal(end.type,'CANCELLED');assert.equal(end.result.optimized.passes.passesStarted,2);assert.equal(end.result.optimized.passes.passesCompleted,1);assert.equal(end.result.optimized.evaluations,firstCount+4);assert.equal(end.result.optimized.recommendedStats.evaluations,256);assert.ok(end.result.optimized.fastestRoute);
 const progress=messages.filter(m=>m.type==='PROGRESS').map(m=>m.progress.completedSimulations);assert.ok(progress.every((x,i)=>!i||x>=progress[i-1]));
});
test('result cancelled snapshot remains observational for legacy callers',()=>{const s=createOptimizedSearch(small(),100,opts);assert.equal(s.result('cancelled',0).optimized.passes.stopReason,'cancelled');assert.equal(s.done,false);assert.equal(finish(s).optimized.evaluations,64);});
test('fatal errors propagate instead of retrying',()=>assert.throws(()=>createOptimizedPassSearch(small(),100,{...opts,searchThoroughness:'maximum'},()=>{throw Error('fatal search');}),/fatal search/));
for(const quality of [...Object.keys(OPTIMIZED_PRESETS),'Custom'])test('unchanged quality budgets and independent thoroughness '+quality,()=>{
 const budget=OPTIMIZED_PRESETS[quality]?.budget??12345,config=optimizedConfigForBudget(budget);if(quality!=='Custom')assert.deepEqual(config,{beamWidth:OPTIMIZED_PRESETS[quality].beamWidth,maxDepth:OPTIMIZED_PRESETS[quality].maxDepth});
 for(const mode of ['standard','thorough','maximum']){const p=resolveThoroughnessPolicy(mode,16,budget,config);assert.equal(p.config.maxDepth,config.maxDepth);if(mode==='standard')assert.deepEqual(p.config,config);assert.ok(p.screeningSchedule[0]*16<=budget);}
});
for(const searchThoroughness of ['standard','thorough','maximum'])for(const objective of ['fastest-potential','average-victory','success-rate'])test('Report v1 captures frozen policy and actual effort '+searchThoroughness+' '+objective,()=>{
 const request={input:small(),requestedSimulations:1000,searchMethod:'optimized-action-search',searchThoroughness,optimizationObjective:objective,seed:42,optimizedConfig:opts.config,simulationRules:opts.simulationRules};const job=snapshotSimulationReportJob(request),r=finish(createOptimizedSearch(small(),1000,{...opts,objective,searchThoroughness})),report=buildBattleSimulationReport(r,job),text=md(report);
 assert.equal(report.reportVersion,1);assert.deepEqual(JSON.parse(json(report)),report);assert.equal(report.searchSummary.evaluations,r.optimized.evaluations);assert.deepEqual(report.searchSummary.effort,r.optimized.effort);assert.match(text,/Search Thoroughness/);assert.match(text,/Screening schedule/);assert.match(text,/Completed screening stages/);assert.match(text,/Stop reason/);assert.doesNotMatch(text,/use-full-budget|single-pass|Passes \/ Stop Reason/);
 if(searchThoroughness!=='standard')assert.match(text,/does not guarantee the global optimum/);if(objective!=='fastest-potential')assert.ok(report.diagnostics.some(d=>d.includes('may belong to another prefix')));request.searchThoroughness='changed';assert.equal(md(report),text);assert.ok(Object.isFrozen(report.searchSummary.effort));
});
test('legacy Report v1 without optional effort/thoroughness fields serializes',()=>{const j=snapshotSimulationReportJob({input:small(),requestedSimulations:300,searchMethod:'optimized-action-search'}),old=JSON.parse(json(buildBattleSimulationReport(base,j)));delete old.simulationConfiguration.searchThoroughness;delete old.searchSummary.passes;delete old.searchSummary.effort;assert.match(md(old),/Standard/);assert.equal(JSON.parse(json(old)).reportVersion,1);});
test('Random ignores thoroughness and omits optimized report terminology',async()=>{
 const results=[];for(const searchThoroughness of ['standard','thorough','maximum']){const req={type:'START',jobId:'random',input:small(),requestedSimulations:4,seed:42,searchMethod:'random-monte-carlo',searchThoroughness};let result;await createSimulationWorkerHost(m=>{if(m.result)result=m.result;}).receive(req);results.push(result);const report=buildBattleSimulationReport(result,snapshotSimulationReportJob(req));assert.doesNotMatch(md(report),/Search Thoroughness|Screening schedule/);assert.equal(report.simulationConfiguration.searchThoroughness,undefined);}
 for(const r of results){r.search.elapsedMs=0;r.search.simulationsPerSecond=null;r.search.etaMs=null;}assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);
});
test('UI Standard default, three options, independent budget, invalidation, hiding and locking',()=>{
 let invalidated=0;const search={running:false,start(){},cancel(){}};const render=host('src/components/BattleSimulation.tsx','BattleSimulation',{'@/hooks/useBattleSimulationWorker':{useBattleSimulationWorker:()=>search}}),props={savedTeams:[],onSimulationComplete(){},onSimulationSettingsChange(){invalidated++;}};
 let tree=render(props);assert.equal(button(tree,'Standard').props['aria-pressed'],true);assert.ok(button(tree,'Thorough'));button(tree,'Maximum').props.onClick();tree=render(props);assert.equal(invalidated,1);assert.equal(button(tree,'Maximum').props['aria-pressed'],true);assert.equal(find(tree,p=>p.id==='simulation-count').props.value,100000);button(tree,'Random Monte Carlo').props.onClick();assert.equal(button(render(props),'Maximum'),undefined);button(render(props),'Optimized Action Search').props.onClick();search.running=true;tree=render(props);for(const label of ['Standard','Thorough','Maximum'])assert.equal(button(tree,label).props.disabled,true);
 const {SimulationSearchProgress}=load('src/components/SimulationSearchProgress.tsx');assert.ok(button(SimulationSearchProgress({progress:null,requested:300,cancelling:false,onCancel(){}}),'Cancel Simulation'));
});
test('Index invalidates displayed results when thoroughness changes',()=>{
 const run=require('./helpers/plannerAnalysisFixtures.cjs').route(1),planner={data:{schemaVersion:7,runs:[run],activeRunId:run.id},activeRun:run,starterId:'',name:'',error:null,feedbackRevision:0};const page=host('src/pages/Index.tsx','default',{'@/hooks/useRunPlanner':{useRunPlanner:()=>planner}});
 const sim=()=>find(page(),p=>'onSimulationComplete' in p);sim().props.onSimulationComplete(base);assert.ok(find(page(),p=>p.results===base));sim().props.onSimulationSettingsChange();assert.equal(find(page(),p=>p.results===base),undefined);
});
