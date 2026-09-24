const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,unit,input,sample,confusionBest,createTasLuckSearch,createTasLuckReplay,createSeededBattleRng,simulateBattleCore}=require('./helpers/tasLuckFixtures.cjs');
const {tasLuckCapForBudget,tasLuckTraceKey,TasLuckDivergence}=load('src/utils/battle/battleTasLuck.ts');
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const {createSimulationSearch}=load('src/utils/battle/battleSimulationSearch.ts');
const {replayTasLuckRoute}=load('src/utils/battle/battleTasLuckReplay.ts');
const {createFastestRouteTracker}=load('src/utils/battle/battleFastestRoute.ts');
const plans=load('src/utils/battle/battleActionPlans.ts');
const rules={accuracyMode:'strategy',rngPolicy:'tas-luck'};
const oneGate=()=>input([unit('P',105,{stats:{atk:200,spd:100}})],[unit('E',6,{stats:{hp:10}})]);
const finish=(s,batch=1)=>{let steps=0;while(!s.done){for(let i=0;i<batch&&!s.done;i++)s.step();if(++steps>100000)throw Error('search did not finish');}return s.result('completed',100);};
for(const [budget,cap] of [[10000,8],[100000,16],[1000000,32]])test('preset frontier '+budget,()=>assert.equal(tasLuckCapForBudget(budget),cap));
for(const side of ['player','enemy'])for(const status of ['poison','paralysis','confusion','motivation-down'])test(`direct favorable application ${side}/${status}`,()=>{
 const {resolveDirectStatusApplication}=load('src/utils/battle/battleRngPolicy.ts');
 const rng={nextIntExclusive(){throw Error('Natural draw');},tasLuck:{choose(){throw Error('ordinary branch');}}};
 const r=resolveDirectStatusApplication('tas-luck',side,status,2,rng,'target');assert.equal(r.succeeds,side==='enemy');assert.equal(r.roll,null);assert.equal(r.rngResolution.naturalProbability.numerator,side==='enemy'?2:1);
});
for(const side of ['player','enemy'])for(const status of ['paralysis','confusion','motivation-down'])test(`direct favorable recovery ${side}/${status}`,()=>{
 const {resolveNaturalStatusRecovery}=load('src/utils/battle/battleRngPolicy.ts');const r=resolveNaturalStatusRecovery('tas-luck',side,status,{tasLuck:{choose(){throw Error('ordinary branch');}},nextIntExclusive(){throw Error('Natural draw');}},'target');assert.equal(r.succeeds,side==='player');
});
for(const status of ['poison-body','poison-power','paralysis-power','confusion-power','elemental-power','invincibility','invisibility'])test('unsupported recovery still Natural '+status,()=>{
 const {resolveNaturalStatusRecovery}=load('src/utils/battle/battleRngPolicy.ts');let draws=0;const r=resolveNaturalStatusRecovery('tas-luck','enemy',status,{tasLuck:{choose(){throw Error('unsupported branch');}},nextIntExclusive(max,c){draws++;assert.equal(max,4);assert.equal(c,'status-recovery-'+status);return 0;}});assert.equal(draws,1);assert.equal(r.succeeds,true);assert.equal(r.rngResolution,undefined);
});
test('Confusion beats Paralysis Miss; both statuses remain active',()=>{
 const s=sample(confusionBest());assert.equal(s.result.outcome,'player-win');assert.equal(s.result.totalFrames,1370);
 assert.deepEqual(s.result.tasLuckTrace.map(d=>d.selected),['pass']);assert.ok(s.result.actions.some(a=>a.actorName==='E'&&a.statusesAfterRecovery.paralysis&&a.statusesAfterRecovery.confusion));
 assert.ok(s.result.actions.some(a=>a.actorName==='E'&&a.confusion?.redirected&&a.impacts.some(i=>i.targetId==='enemy-0'&&i.ko)));
 const old=simulateBattleCore(confusionBest(),{rng:createSeededBattleRng(0),maxRounds:5,simulationRules:{accuracyMode:'strategy',rngPolicy:'tas-favorable'}});assert.notEqual(old.outcome,'player-win');
});
test('Paralysis Miss remains best when acting brings no downstream benefit',()=>{
 const b=input([unit('P',6,{stats:{spd:100}})],[unit('E',6,{initialStatuses:{paralysis:true,confusion:true},stats:{hp:25,atk:1}})]),s=sample(b);
 assert.equal(s.result.outcome,'player-win');assert.ok(s.result.tasLuckTrace.some(d=>d.selected==='miss'));assert.ok(s.result.actions.some(a=>a.statusRecoveries.some(r=>r.rngResolution?.outcome==='remain')));
});
test('Paralyzed Enemy action proceeds when Confusion self-KO is best; blocked recovery creates no gates',()=>{
 const b=confusionBest();b.player=[unit('P',103,{stats:{atk:1,spd:100}})];const s=sample(b);assert.equal(s.result.outcome,'player-win');assert.deepEqual(s.result.tasLuckTrace.map(d=>d.selected),['pass']);assert.equal(s.result.tasLuckTrace[0].phase,'paralysis-failure');
});
test('guaranteed Concert Crush never creates an application branch; subsequent recovery resolves directly',()=>{
 const b=input([unit('P',6,{stats:{spd:100}})],[unit('E',0x49,{stats:{hp:50}})]),s=sample(b,0,{maxRounds:2});
 assert.ok(s.result.actions.some(a=>a.impacts.some(i=>i.statusApplications.some(r=>r.status==='motivation-down'))));
 assert.ok(!s.result.tasLuckTrace.some(d=>d.status==='motivation-down'&&d.phase==='direct-status-application'));
});
for(const [id,boss] of [[0x49,false],[0x49,true],[66,true]])test(`immunity removes illegal application branches ${id}/${boss}`,()=>{
 const s=sample(input([unit('P',id,{stats:{atk:200,spd:100}})],[unit('E',6,{isBoss:boss,stats:{hp:10}})]));assert.ok(!s.result.tasLuckTrace.some(d=>d.phase==='direct-status-application'));assert.equal(s.summary.opportunities,0);
});
test('practical double E-Stun remains legal and completes under bounded TAS Luck',()=>{
 const {doubleInput,doublePolicy}=require('./helpers/tasFixtures.cjs');const s=sample(doubleInput(),42,{maxRounds:60,actionPolicy:doublePolicy});
 assert.equal(s.result.outcome,'player-win');assert.deepEqual(s.result.tasLuckTrace,[]);assert.equal(s.summary.opportunities,0);assert.equal(s.summary.branchesExplored,0);assert.equal(s.summary.maxFrontier,0);assert.equal(s.summary.pruned,0);
});
test('requirements label both nonlocal outcomes and individual natural probabilities',()=>{
 const {tasLuckRequirements}=load('src/utils/battle/battleTasLuck.ts'),{rngRequirementText}=load('src/utils/battle/battleRngAudit.ts');const s=sample(confusionBest());
 const requirements=tasLuckRequirements(s.result.tasLuckTrace,s.result.state);assert.ok(requirements.some(r=>rngRequirementText(r).includes('action must proceed so Confusion can execute — TAS Luck RNG')));assert.ok(requirements.every(r=>r.resolution.naturalProbability.denominator>0));
});
test('policy/canonical Player enumeration remains 2197',()=>assert.equal(plans.rootPlanInfo(require('./helpers/optimizedFixtures.cjs').canonical()).count,2197));
for(const method of ['random','optimized'])for(const accuracyMode of ['strategy','game-accurate'])for(const policy of ['natural','tas-luck'])test(`${method}/${accuracyMode}/${policy}`,()=>{
 const options={simulationRules:{accuracyMode,rngPolicy:policy},seed:17,rng:createSeededBattleRng(17),config:{beamWidth:1,maxDepth:1}};
 const r=finish(method==='random'?createSimulationSearch(oneGate(),4,options):createOptimizedSearch(oneGate(),4,options));assert.equal(r.search.completedSimulations,4);assert.equal(r.search.accuracyMode,accuracyMode);
 if(policy==='tas-luck'){assert.equal(r.search.rngPolicy,'tas-luck');assert.equal(r.tasLuckSummary.branchesExplored,0);}else assert.equal(r.tasLuckSummary,undefined);
});
for(const objective of ['fastest-potential','average-victory','success-rate'])test('64 fair samples, not TAS variants: '+objective,()=>{
 const r=finish(createOptimizedSearch(oneGate(),64,{seed:17,objective,simulationRules:rules,config:{beamWidth:1,maxDepth:1}}));assert.equal(r.optimized.recommendedStats.evaluations,64);assert.equal(r.optimized.recommendedStats.victories,64);assert.equal(r.optimized.recommendedStats.successRate,1);assert.equal(r.tasLuckSummary.branchesExplored,0);assert.equal(r.optimized.rootPlanCount,1);
 const replay=replayTasLuckRoute(oneGate(),r.optimized.fastestRoute,{simulationRules:rules});assert.deepEqual(replay.result.actions,r.optimized.fastestRoute.actions);assert.deepEqual(replay.result.tasLuckTrace,r.optimized.fastestRoute.tasLuckTrace);
});
test('many-gate and no-gate Player candidates receive equal fair weight',()=>{
 const b=oneGate();b.player[0].techs.push(unit('X',6).techs[0]);const r=finish(createOptimizedSearch(b,128,{seed:17,simulationRules:rules,config:{beamWidth:2,maxDepth:1}}));assert.equal(r.optimized.rootPlanCount,2);assert.equal(r.optimized.topCandidates.length,2);assert.deepEqual(r.optimized.topCandidates.map(c=>c.stats.evaluations),[64,64]);assert.ok(r.optimized.topCandidates.every(c=>c.stats.successRate===1));
});
test('TAS outcome reversal produces identical selected trace and history',()=>{const a=sample(confusionBest()),b=sample(confusionBest(),0,{reverse:true});assert.deepEqual(a.result,b.result);assert.deepEqual(a.summary,b.summary);});
test('candidate reversal and batch grouping preserve complete fair results',()=>{
 const b=oneGate();b.player[0].techs.push(unit('X',6).techs[0]);const make=()=>createOptimizedSearch(b,128,{seed:17,simulationRules:rules,config:{beamWidth:2,maxDepth:1}});const a=finish(make()),original=plans.enumeratePlayerRoundPlans;
 try{plans.enumeratePlayerRoundPlans=function*(s){yield* [...original(s)].reverse();};assert.deepEqual(finish(make(),17),a);}finally{plans.enumeratePlayerRoundPlans=original;}
});
test('Random Monte Carlo preserves random-policy replay boundary',()=>{const b=oneGate(),r=finish(createSimulationSearch(b,3,{simulationRules:rules,rng:createSeededBattleRng(7)})),route=r.tasLuckRoute;assert.deepEqual(route.sourcePlayerPrefix,[]);const replay=replayTasLuckRoute(b,route,{simulationRules:rules});assert.deepEqual(replay.result.actions,route.actions);});
test('rendered TAS Luck history retains direct favorable requirements',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const b=oneGate(),r=finish(createSimulationSearch(b,3,{simulationRules:rules,rng:createSeededBattleRng(7)}));
 const text=renderToStaticMarkup(React.createElement(load('src/components/BattleResults.tsx').BattleResults,{results:r}));assert.match(text,/TAS Luck Requirements/);assert.match(text,/TAS Luck RNG/);assert.ok(!text.includes('TAS Favorable'));assert.match(text,/not natural probabilities/);
});
for(const batch of [1,7])test('Worker TAS Luck completed batching '+batch,async()=>{
 const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts'),messages=[];const worker=createSimulationWorkerHost(m=>messages.push(m),{now:()=>0,yieldTask:async()=>{},batchBudgetMs:50,maxBatchSize:batch,progressIntervalMs:150});
 await worker.receive({type:'START',jobId:'batch',input:oneGate(),requestedSimulations:4,simulationRules:rules,searchMethod:'optimized-action-search',seed:17,optimizedConfig:{beamWidth:1,maxDepth:1}});
 const actual=messages.at(-1);assert.equal(actual.type,'COMPLETE');const expected=finish(createOptimizedSearch(oneGate(),4,{seed:17,simulationRules:rules,config:{beamWidth:1,maxDepth:1}}));actual.result.search.elapsedMs=100;actual.result.search.simulationsPerSecond=40;assert.deepEqual(actual.result,expected);
});
test('strict trace identity rejects another gate and unused decisions',()=>{
 const s=sample(confusionBest()),route=createFastestRouteTracker();route.consider(s.result,false,s.decisionTrace,'random-policy',0,0);
 const bad=structuredClone(route.best);bad.tasLuckTrace[0].key+='wrong';assert.throws(()=>replayTasLuckRoute(confusionBest(),bad,{simulationRules:rules,maxRounds:5}),TasLuckDivergence);
 const extra=structuredClone(route.best);extra.tasLuckTrace.push(extra.tasLuckTrace[0]);assert.throws(()=>replayTasLuckRoute(confusionBest(),extra,{simulationRules:rules,maxRounds:5}),/Unused TAS/);
});
test('frontier and work are bounded; pruning visible; equivalent exact checkpoints deduplicate',()=>{
 const state=load('src/utils/battle/battleInput.ts').createBattleState(oneGate());state.round=1;const action=load('src/utils/battle/battleActions.ts').planAction(state,state.combatants[0],{kind:'skill',skillKey:state.combatants[0].skills[0].key});
 const terminal=simulateBattleCore(oneGate(),{simulationRules:{accuracyMode:'strategy'},rng:createSeededBattleRng(0)});
 const search=createTasLuckSearch(control=>{control.action(state,action);for(let i=0;i<20;i++)control.choose('paralysis-failure','paralysis','enemy-0',['miss','pass'],1,2);return {result:structuredClone(terminal),diverged:false,decisionTrace:[]};},8);
 let steps=0;while(!search.done){search.step();assert.ok(++steps<3000);}assert.ok(search.summary.pruned>0);assert.ok(search.summary.deduplicated>0);assert.ok(search.summary.maxFrontier<=8);assert.ok(search.best);
});
for(const method of ['random','optimized'])test('cancel midway through TAS sample excludes partial fair observation '+method,()=>{
 const b=confusionBest(),s=method==='random'?createSimulationSearch(b,64,{simulationRules:rules,rng:createSeededBattleRng(0),maxRounds:5}):createOptimizedSearch(b,64,{simulationRules:rules,seed:0,maxRounds:5,config:{beamWidth:1,maxDepth:1}});
 while(s.result('cancelled',1).tasLuckSummary.opportunities===0)s.step();const r=s.result('cancelled',1);assert.equal(r.search.status,'cancelled');assert.equal(r.search.completedSimulations,0);assert.equal(r.totalSimulations,0);assert.equal(r.tasLuckSummary.branchesExplored,0);assert.equal(r.tasLuckSummary.maxFrontier,2);if(r.optimized)assert.equal(r.optimized.recommendedStats,null);
});
test('Worker yields inside TAS exploration and retains cap/cancellation provenance',async()=>{
 const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts');const messages=[];let ticks=0;const w=createSimulationWorkerHost(m=>messages.push(m),{now:()=>0,yieldTask:async()=>{if(++ticks===2)await w.receive({type:'CANCEL',jobId:'luck'});},batchBudgetMs:50,maxBatchSize:1,progressIntervalMs:150});
 await w.receive({type:'START',jobId:'luck',input:confusionBest(),requestedSimulations:10000,simulationRules:rules,maxRounds:5,seed:0});const r=messages.at(-1);assert.equal(r.type,'CANCELLED');assert.equal(r.result.search.completedSimulations,0);assert.equal(r.result.tasLuckSummary.frontierCap,8);assert.ok(ticks>=2);
});
test('immutable report v1 preserves Luck settings, trace and requirements after edits',()=>{
 const {snapshotSimulationReportJob,buildBattleSimulationReport}=load('src/utils/battle/battleSimulationReport.ts'),{serializeBattleSimulationReportMarkdown:md,serializeBattleSimulationReportJson:json}=load('src/utils/battle/battleSimulationReportSerialization.ts');
 const request={input:oneGate(),requestedSimulations:4,searchMethod:'optimized-action-search',optimizationObjective:'fastest-potential',simulationRules:{...rules},seed:17,optimizedConfig:{beamWidth:1,maxDepth:1}};
 const job=snapshotSimulationReportJob(request),r=finish(createOptimizedSearch(request.input,4,{seed:17,simulationRules:rules,config:request.optimizedConfig})),report=buildBattleSimulationReport(r,job),before=json(report);
 request.simulationRules.rngPolicy='natural';request.optimizationObjective='success-rate';assert.equal(json(report),before);assert.equal(report.reportVersion,1);assert.equal(report.simulationConfiguration.tasFrontierCap,8);assert.deepEqual(JSON.parse(before),report);assert.match(md(report),/TAS Luck Requirements/);assert.match(md(report),/TAS Luck Conflicts/);assert.equal(report.tasLuckTrace.length,0);assert.ok(Object.isFrozen(report.tasLuckSummary));
});
