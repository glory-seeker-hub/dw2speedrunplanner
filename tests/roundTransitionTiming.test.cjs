const {test}=require('node:test'),assert=require('node:assert/strict');
const {unit,run,rng,load}=require('./helpers/battleSupportFixtures.cjs');
const {roundTransitionTiming,summarizeBattleTiming}=load('src/utils/battle/battleTiming.ts');
const {aggregateBattleRuns}=load('src/utils/battle/battleCompatibility.ts');
const {createFastestRouteTracker}=load('src/utils/battle/battleFastestRoute.ts');
const {emptyCandidateStats,addCandidateOutcome,compareCandidates}=load('src/utils/battle/battleSearchObjectives.ts');
const rules={accuracyMode:'strategy'};
function lockedRun(extra={}) {
 const random=rng(), player=[unit('Fast',6,{stats:{spd:200,atk:100}}),unit('Slow',1,{stats:{spd:100,atk:1}})],enemy=[unit('E1',6,{currentHp:1,stats:{spd:1}}),unit('E2',6,{stats:{spd:1,hp:1000}})];
 const result=run(player,enemy,{rng:random,actionPolicy:{chooseAction:a=>({kind:'skill',skillKey:a.skills[0].key,...(a.side==='player'?{targetIntent:{kind:'combatants',targetIds:['enemy-0']}}:{})})},...extra});
 return {result,random};
}
test('locked KO target resolves one canonical Miss without accuracy or on-hit RNG, impacts, MP or retargeting',()=>{
 const {result,random}=lockedRun();const a=result.actions.find(a=>a.actorName==='Slow');
 assert.equal(a.state,'resolved');assert.equal(a.outcome,'miss');assert.deepEqual(a.accuracy,{outcome:'miss',cause:'no-effective-target',referenceTargetId:null});
 assert.equal(a.durationFrames,194);assert.equal(a.mpAccounting.costCharged,0);assert.equal(a.mpAccounting.paymentRule,'none-on-miss');
 assert.deepEqual(a.targetIntent,{kind:'combatants',targetIds:['enemy-0']});assert.deepEqual(a.effectiveTargetIds,[]);assert.deepEqual(a.impacts,[]);
 assert.equal(result.actionCount,result.actions.filter(a=>a.state==='resolved').length);
 assert.equal(random.draws.filter(d=>d.category==='accuracy').length,2);assert.ok(!random.draws.some(d=>/application|tail-blade/.test(d.category)));
 assert.equal(result.state.combatants.find(a=>a.id==='enemy-1').currentHp,1000);
});
test('battle-ended queued actions remain free skips',()=>{
 const r=run([unit('Fast',6,{stats:{spd:200,atk:100}}),unit('Slow',1,{stats:{spd:100}})],[unit('E',6,{currentHp:1})]);
 const a=r.actions.find(a=>a.actorName==='Slow');assert.equal(a.reason,'battle-ended');assert.equal(a.state,'skipped');assert.equal(a.durationFrames,null);assert.equal(r.roundTransitionFrames,0);
});
test('an invalid already-dead planning lock remains a skip, not a target-lost Miss',()=>{
 const r=run([unit('P')],[unit('Dead',6,{currentHp:0}),unit('Living')],{actionPolicy:{chooseAction:a=>({kind:'skill',skillKey:a.skills[0].key,...(a.side==='player'?{targetIntent:{kind:'combatants',targetIds:['enemy-0']}}:{})})}});
 const a=r.actions.find(a=>a.actorName==='P');assert.equal(a.state,'skipped');assert.equal(a.reason,'no-living-targets');assert.equal(a.durationFrames,null);
});
for(const [hp,rounds,frames] of [[1,1,0],[61,2,452],[121,3,904]])test(`victory in Round ${rounds} charges exactly ${rounds-1} transitions`,()=>{
 const r=run([unit('P1',6,{stats:{hp:100000,spd:100}}),unit('P2',6,{stats:{hp:100000,spd:90}}),unit('P3',6,{stats:{hp:100000,spd:80}})],[unit('E',6,{stats:{hp,spd:1,atk:1}})],{maxRounds:5,simulationRules:rules});
 assert.equal(r.outcome,'player-win');assert.equal(r.rounds,rounds);assert.equal(r.roundTransitionFrames,frames);assert.equal(r.roundTransitions.length,rounds-1);assert.equal(r.totalFrames,r.actionFrames+frames);
});
test('random-at-execution retains living-target selection',()=>{
 const r=run([unit('Fast',6,{stats:{spd:200,atk:100}}),unit('Slow',6,{stats:{spd:100}})],[unit('E1',6,{currentHp:1}),unit('E2',6)]);
 const a=r.actions.find(a=>a.actorName==='Slow');assert.equal(a.outcome,'hit');assert.deepEqual(a.effectiveTargetIds,['enemy-1']);
});
for(const allies of [1,2,3])for(const enemies of [1,2,3])test(`transition ${allies} Players, ${enemies} Enemies`,()=>{
 const r=run(Array.from({length:allies},(_,i)=>unit('P'+i,6,{stats:{hp:100000,atk:1}})),Array.from({length:enemies},(_,i)=>unit('E'+i,6,{stats:{hp:100000,atk:1}})),{maxRounds:2,simulationRules:rules});
 assert.deepEqual(r.roundTransitions,[{fromRound:1,toRound:2,livingPlayerAllies:allies,frames:[319,385,452][allies-1]}]);
 assert.equal(r.totalFrames,r.actionFrames+r.roundTransitionFrames);assert.equal(r.actionCount,(allies+enemies)*2);
});
test('three rounds have exactly two transitions; operational limit has no trailing charge',()=>{
 const r=run([unit('P1'),unit('P2'),unit('P3')],[unit('E',6,{stats:{hp:100000,atk:1}})],{maxRounds:3,simulationRules:rules});
 assert.equal(r.rounds,3);assert.equal(r.roundTransitionFrames,904);assert.equal(r.roundTransitions.length,2);
});
test('dynamic HP count is read after the completed round without changing action eligibility',()=>{
 const r=run([unit('P1',6,{currentHp:1,stats:{spd:100,atk:1}}),unit('P2'),unit('P3')],[unit('E',6,{stats:{hp:100000,atk:100}})],{maxRounds:2,simulationRules:rules});
 assert.equal(r.roundTransitions[0].livingPlayerAllies,2);assert.equal(r.roundTransitions[0].frames,385);
 assert.ok(r.actions.some(a=>a.actorName==='P1'&&a.round===2&&a.state==='resolved'));
});
test('zero HP continuation has explicit missing transition and known action subtotal',()=>{
 const r=run([unit('P',6,{currentHp:1,stats:{atk:1,spd:100}})],[unit('E',6,{stats:{hp:100000,atk:100}})],{maxRounds:2,simulationRules:rules});
 assert.equal(r.roundTransitions[0].frames,null);assert.equal(r.totalFrames,null);assert.equal(r.timingCompleteness,'incomplete');assert.equal(r.knownFrames,r.actionFrames);
 assert.match(r.timingDiagnostics.join(' '),/0 living Player allies/);
});
test('unknown action timing still retains known overhead; HP restoration selects resulting row',()=>{
 const combatants=[{side:'player',currentHp:1},{side:'player',currentHp:0},{side:'enemy',currentHp:1}];
 assert.equal(roundTransitionTiming(1,combatants).frames,319);combatants[1].currentHp=1;assert.equal(roundTransitionTiming(1,combatants).frames,385);
 const summary=summarizeBattleTiming([{id:'a',state:'resolved',durationFrames:null,timingDiagnostics:['unknown']}],[roundTransitionTiming(1,combatants)]);
 assert.equal(summary.knownFrames,385);assert.equal(summary.totalFrames,null);
});
// Controlled timing witnesses exercise production comparison and capture eligibility.
function routes(){
 const base=run([unit('P',6,{stats:{atk:100,spd:200}})],[unit('E',6,{currentHp:1})]);
 const route=(frames,transitions)=>{const actions=structuredClone(base.actions);actions[0].durationFrames=frames;return {...base,actions,rounds:1+transitions.length,...summarizeBattleTiming(actions,transitions)};};
 return [route(3000,[]),route(2700,[{fromRound:1,toRound:2,livingPlayerAllies:3,frames:452}])];
}
for(const capture of [false,true])test(`Fastest and Average reverse action-only preference; capture=${capture}`,()=>{
 const [a,b]=routes(),target=capture?{position:0,name:'E'}:undefined;
 const tracker=createFastestRouteTracker(target);tracker.consider(b,false,[],'B',0,0);tracker.consider(a,false,[],'A',1,0);
 assert.equal(tracker.best.totalFrames,3000);assert.equal(b.totalFrames,3152);
 const sa=emptyCandidateStats(),sb=emptyCandidateStats();addCandidateOutcome(sa,a,false,target);addCandidateOutcome(sb,b,false,target);
 for(const objective of ['fastest-potential','average-victory','success-rate'])assert.ok(compareCandidates({key:'A',stats:sa},{key:'B',stats:sb},objective)<0);
 assert.equal(sa.successRate,sb.successRate);
 const aggregate=aggregateBattleRuns([b,a],target);assert.equal(aggregate.minFrames,3000);assert.equal(aggregate.avgFrames,3076);assert.equal(aggregate.maxFrames,3152);assert.deepEqual(aggregate.fastestBattleByFrames,a.actions);
});
test('TAS controlled complete-path comparison includes transition timing',()=>{
 const {createTasLuckSearch}=load('src/utils/battle/battleTasLuck.ts'),[a,b]=routes();
 const search=createTasLuckSearch(control=>{control.action(a.state,{...a.state.plannedActions[0],id:'gate'});const chosen=control.choose('paralysis-failure','paralysis','enemy-0',['miss','pass'],1,2);return {result:structuredClone(chosen==='miss'?a:b),diverged:false,decisionTrace:[]};},8);
 while(!search.done)search.step();assert.equal(search.best.result.totalFrames,3000);assert.equal(search.summary.branchesExplored,2);
});
test('TAS target loss adds no decision or accuracy draw and still charges 194',()=>{
 let decisions=0;const {result}=lockedRun({tasLuck:{action(){},choose(){decisions++;throw Error('unexpected gate');}},simulationRules:{accuracyMode:'strategy',rngPolicy:'tas-luck'}});
 assert.equal(decisions,0);assert.equal(result.actions.find(a=>a.actorName==='Slow').durationFrames,194);
});
for(const capture of [false,true])test(`report JSON/Markdown and Results preserve target loss and timing, capture=${capture}`,()=>{
 const {result}=lockedRun({maxRounds:20,simulationRules:rules,actionPolicy:{chooseAction:(a,context)=>({kind:'skill',skillKey:a.skills[0].key,targetIntent:{kind:'combatants',targetIds:[context.combatants.find(t=>t.side!==a.side&&t.isAlive).id]}})}});
 assert.equal(result.outcome,'player-win');assert.ok(result.roundTransitions.length);
 const aggregate=aggregateBattleRuns([result],capture?{position:1,name:'E2'}:undefined);
 const {snapshotSimulationReportJob,buildBattleSimulationReport}=load('src/utils/battle/battleSimulationReport.ts');
 const {serializeBattleSimulationReportJson:json,serializeBattleSimulationReportMarkdown:md}=load('src/utils/battle/battleSimulationReportSerialization.ts');
 const input={player:[unit('P')],enemy:[unit('E')],floorSpecialty:'None'};
 const report=buildBattleSimulationReport(aggregate,snapshotSimulationReportJob({input,requestedSimulations:1}));
 const parsed=JSON.parse(json(report)),text=md(report);assert.equal(parsed.reportVersion,1);assert.equal(parsed.executedBattle.timing.actionFrames,result.actionFrames);
 assert.match(text,/no-effective-target/);assert.match(text,/194/);assert.match(text,/none-on-miss/);assert.match(text,/Known round-transition frames/);
 assert.deepEqual(parsed.executedBattle.timing.roundTransitions,result.roundTransitions);assert.equal(parsed.executedBattle.timing.roundTransitionFrames,result.roundTransitionFrames);
 for(const t of result.roundTransitions)assert.ok(text.includes(`Round ${t.fromRound} -> ${t.toRound}: ${t.livingPlayerAllies} living Player allies`));
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const html=renderToStaticMarkup(React.createElement(load('src/components/BattleResults.tsx').BattleResults,{results:{...aggregate,report}}));
 assert.match(html,/Miss — No effective target/);assert.match(html,/194 f/);assert.match(html,/Timing breakdown/);assert.match(html,/Intended target/);
});
for(const method of ['random-monte-carlo','optimized-action-search'])test(`Worker serializes canonical transition totals and report: ${method}`,async()=>{
 const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts');const messages=[];
 const host=createSimulationWorkerHost(m=>messages.push(structuredClone(m)),{now:()=>0,yieldTask:async()=>{},maxBatchSize:1,progressIntervalMs:0,batchBudgetMs:20});
 const input={player:[unit('P',6,{stats:{spd:100,hp:100000,atk:20}})],enemy:[unit('E',6,{stats:{hp:100,atk:1}})],floorSpecialty:'None'};
 await host.receive({type:'START',jobId:'timing',input,requestedSimulations:8,searchMethod:method,seed:17,simulationRules:rules,optimizedConfig:{beamWidth:1,maxDepth:1}});
 const last=messages.at(-1);assert.equal(last.type,'COMPLETE');assert.ok(messages.some(m=>m.type==='PROGRESS'));
 const timing=last.result.fastestBattleByFramesTiming;assert.ok(timing.roundTransitions.length>0);assert.equal(timing.totalFrames,timing.actionFrames+timing.roundTransitionFrames);assert.ok(timing.roundTransitions.every(t=>t.frames===319));
 assert.deepEqual(JSON.parse(JSON.stringify(timing)),timing);
});

