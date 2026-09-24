const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,unit,input,sample,confusionBest,createTasLuckSearch,createTasLuckReplay,createSeededBattleRng,simulateBattleCore}=require('./helpers/tasLuckFixtures.cjs');
const {run,rng,action}=require('./helpers/battleSupportFixtures.cjs');
const {createSimulationSearch}=load('src/utils/battle/battleSimulationSearch.ts');
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const {collectRngRequirements,rngRequirementText}=load('src/utils/battle/battleRngAudit.ts');
const {createFastestRouteTracker}=load('src/utils/battle/battleFastestRoute.ts');
const {replayTasLuckRoute}=load('src/utils/battle/battleTasLuckReplay.ts');
const rules={accuracyMode:'strategy',rngPolicy:'tas-luck'};
const finish=s=>{let steps=0;while(!s.done){s.step();assert.ok(++steps<50000);}return s.result('completed',100);};
const noConflict=()=>input([unit('P',105,{stats:{spd:100}})],[unit('E',6,{stats:{hp:80}})]);
const zero=s=>{for(const key of ['opportunities','branchesExplored','pruned','maxFrontier'])assert.equal(s[key],0,key);};
for(const side of ['player','enemy'])for(const confused of [false,true])test(`action gate ${side}, confusion ${confused}`,()=>{
 const {resolveParalysisFailure}=load('src/utils/battle/battleRngPolicy.ts');let branches=0;
 const r=resolveParalysisFailure('tas-luck',side,{nextIntExclusive(){throw Error('Natural draw');},tasLuck:{choose(c,s,t,alternatives){branches++;assert.deepEqual(alternatives,['miss','pass']);return 'pass';}}},'actor',confused);
 assert.equal(branches,side==='enemy'&&confused?1:0);assert.equal(r.succeeds,side==='enemy'&&!confused);
});
for(const [name,b] of [['paralysis',noConflict()],['confusion',(()=>{const b=confusionBest();delete b.enemy[0].initialStatuses.paralysis;return b;})()]])test(name+' across 64 fair samples creates no frontier',()=>{
 for(let seed=0;seed<64;seed++)zero(sample(b,seed).summary);
});
test('one conflict examines exactly two complete alternatives without status removal',()=>{
 const b=confusionBest(),s=sample(b,0,{maxRounds:1});assert.equal(s.summary.opportunities,1);assert.equal(s.summary.branchesExplored,2);assert.equal(s.summary.maxFrontier,2);
 const selected=s.result.tasLuckTrace[0];assert.deepEqual(selected.alternatives,['miss','pass']);
 for(const choice of selected.alternatives){const replay=createTasLuckReplay([{...selected,selected:choice}],true),r=s.execute(replay.control).result;replay.finish();const a=r.actions.find(a=>a.actorName==='E');assert.equal(a.accuracy.rngResolution.outcome,choice);assert.ok(a.statusesAfterRecovery.confusion&&a.statusesAfterRecovery.paralysis);assert.equal(a.confusion.redirected,true);if(choice==='miss'){assert.equal(a.durationFrames,194);assert.equal(a.mpAccounting.costCharged,0);}}
});
test('dead afflicted Enemy creates no conflict',()=>{
 const b=confusionBest();b.player[0].customStats.atk=999;b.enemy[0].customStats.hp=1;zero(sample(b).summary);
});
test('explicit cure before the action removes the conflict',()=>{
 const b=input([unit('P',6,{stats:{atk:1}})],[unit('Cure',201,{stats:{spd:100}}),unit('E',6,{initialStatuses:{paralysis:true,confusion:true}})]);
 const s=sample(b,0,{maxRounds:1});zero(s.summary);assert.ok(s.result.actions.some(a=>a.supportEvents?.some(e=>e.kind==='cure'&&e.before)));
});
test('Player recovery removes both statuses before action without a conflict',()=>{
 const b=input([unit('P',6,{initialStatuses:{paralysis:true,confusion:true}})],[unit('E',6)]),s=sample(b,0,{maxRounds:1});zero(s.summary);
 const a=s.result.actions.find(a=>a.actorName==='P');assert.equal(a.statusRecoveries.length,2);assert.ok(a.statusRecoveries.every(r=>r.recovered));assert.equal(a.confusion.active,false);
});
test('Poison has no natural recovery under Luck',()=>{
 const {createBattleState}=load('src/utils/battle/battleInput.ts'),{recoverStatuses}=load('src/utils/battle/battleStatuses.ts');const a=createBattleState(noConflict()).combatants[1];a.statuses={poison:true};assert.deepEqual(recoverStatuses(a,rng(),'tas-luck'),[]);assert.equal(a.statuses.poison,true);
});
for(const side of ['player','enemy'])test('Confused Paralyzed Interrupt remains direct '+side,()=>{
 const afflicted=unit('I',0xa1,{initialStatuses:{paralysis:true,confusion:true}});afflicted.techs.push(unit('Extra',6).techs[0]);
 const b=side==='enemy'?input([unit('P',6)],[afflicted]):input([afflicted],[unit('E',6)]);
 const s=sample(b,0,{maxRounds:1,actionPolicy:{chooseAction:a=>({kind:'skill',skillKey:a.skills[0].key})}});zero(s.summary);const a=s.result.actions.find(a=>a.actorName==='I');assert.deepEqual(a.statusRecoveries,[]);assert.equal(a.confusion.redirected,false);assert.equal(a.durationFrames,side==='enemy'?270:761);assert.equal(a.accuracy.rngResolution.outcome,side==='enemy'?'miss':'pass');
});
test('no-conflict fair sample calls engine exactly once',()=>{
 let calls=0;const s=createTasLuckSearch(tasLuck=>{calls++;return {result:simulateBattleCore(noConflict(),{simulationRules:rules,rng:createSeededBattleRng(0),tasLuck,maxRounds:5}),diverged:false,decisionTrace:[]};},8);s.step();assert.equal(s.done,true);assert.equal(calls,1);zero(s.summary);
});
for(const objective of ['fastest-potential','average-victory','success-rate'])test('conflict fair collapse across 64 samples '+objective,()=>{
 const r=finish(createOptimizedSearch(confusionBest(),64,{seed:1,maxRounds:1,simulationRules:rules,objective,config:{beamWidth:1,maxDepth:1}}));
 assert.equal(r.optimized.recommendedStats.evaluations,64);assert.equal(r.optimized.recommendedStats.victories,64);assert.equal(r.optimized.recommendedStats.successRate,1);assert.equal(r.optimized.recommendedStats.averageVictoryFrames,1370);assert.equal(r.tasLuckSummary.branchesExplored,128);assert.equal(r.tasLuckSummary.opportunities,64);assert.equal(r.totalSimulations,64);
});
test('Monte Carlo conflict counts one observation for two paths',()=>{
 const r=finish(createSimulationSearch(confusionBest(),4,{simulationRules:rules,maxRounds:1,rng:createSeededBattleRng(1)}));assert.equal(r.totalSimulations,4);assert.equal(r.tasLuckSummary.branchesExplored,8);assert.equal(r.completedSuccesses,4);
});
test('double E-Stun progresses without nested work in optimized search',()=>{
 const {doubleInput}=require('./helpers/tasFixtures.cjs');const s=createOptimizedSearch(doubleInput(),10000,{seed:42,maxRounds:60,simulationRules:rules,config:{beamWidth:8,maxDepth:4}});
 for(let i=0;i<100;i++)s.step();const p=s.progress(100),r=s.result('cancelled',100);assert.ok(p.completedSimulations>0);assert.ok(p.optimized.candidatesEvaluated>0);assert.ok(p.simulationsPerSecond>0);zero(r.tasLuckSummary);
});
test('Worker no-conflict progress advances before cancellation',async()=>{
 const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts'),messages=[];let time=0,ticks=0;
 const w=createSimulationWorkerHost(m=>messages.push(m),{now:()=>++time,yieldTask:async()=>{if(++ticks===8)await w.receive({type:'CANCEL',jobId:'progress'});},batchBudgetMs:50,maxBatchSize:3,progressIntervalMs:1});
 await w.receive({type:'START',jobId:'progress',input:noConflict(),requestedSimulations:10000,simulationRules:rules,searchMethod:'optimized-action-search',seed:1,maxRounds:5,optimizedConfig:{beamWidth:8,maxDepth:4}});
 assert.ok(messages.some(m=>m.type==='PROGRESS'&&m.progress.completedSimulations>0&&m.progress.simulationsPerSecond>0));zero(messages.at(-1).result.tasLuckSummary);
});
test('selected route combines ordinary requirements and specific conflict identity',()=>{
 const b=confusionBest(),s=sample(b),t=createFastestRouteTracker();t.consider(s.result,false,s.decisionTrace,'random-policy',0,0);const req=t.best.rngRequirements;
 assert.ok(req.some(r=>r.resolution.category==='natural-status-recovery'&&r.resolution.outcome==='remain'&&!r.opportunityKey));assert.ok(req.some(r=>r.opportunityKey&&rngRequirementText(r).includes('so Confusion can execute')));
 const changed=confusionBest();delete changed.enemy[0].initialStatuses.confusion;assert.throws(()=>replayTasLuckRoute(changed,t.best,{simulationRules:rules,maxRounds:5}),/Unused TAS|diverged/);
});
test('conflict report exports direct and selected requirements with frozen v1 semantics',()=>{
 const {snapshotSimulationReportJob,buildBattleSimulationReport}=load('src/utils/battle/battleSimulationReport.ts'),{serializeBattleSimulationReportMarkdown:md,serializeBattleSimulationReportJson:json}=load('src/utils/battle/battleSimulationReportSerialization.ts');
 const b=confusionBest(),r=finish(createSimulationSearch(b,1,{simulationRules:rules,maxRounds:1,rng:createSeededBattleRng(1)}));const report=buildBattleSimulationReport(r,snapshotSimulationReportJob({input:b,requestedSimulations:1,simulationRules:rules,maxRounds:1}));
 assert.equal(report.reportVersion,1);assert.equal(report.tasLuckSummary.opportunities,1);assert.equal(report.tasLuckTrace[0].selected,'pass');assert.match(md(report),/so Confusion can execute/);assert.match(md(report),/natural recovery must fail/);assert.match(md(report),/Only Enemy Confusion/);assert.deepEqual(JSON.parse(json(report)),report);assert.ok(Object.isFrozen(report.tasLuckTrace));
});
