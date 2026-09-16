const {test}=require('node:test'),assert=require('node:assert/strict');
const {small,canonical,unit,load}=require('./helpers/optimizedFixtures.cjs');
const {host,find,button}=require('./helpers/componentHost.cjs');
const React=require('react'),{renderToStaticMarkup:html}=require('react-dom/server');
const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts');
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const plans=load('src/utils/battle/battleActionPlans.ts');
const options={seed:42,simulationRules:{accuracyMode:'strategy'},config:{beamWidth:2,maxDepth:2}};
const finish=s=>{while(!s.done)s.step();return s.result('completed',100);};
const result=finish(createOptimizedSearch(small(),100,options));
test('canonical keys ignore object property order and distinguish target slot identity',()=>{
  assert.equal(plans.canonicalDecisionKey({b:1,a:{d:2,c:3}}),plans.canonicalDecisionKey({a:{c:3,d:2},b:1}));
  const i=canonical(2);i.enemy.forEach(e=>e.digimon={...e.digimon,name:'Same'});assert.equal(plans.rootPlanInfo(i).count,729);
});
test('candidate enumeration reversal preserves ranking, seeds, metrics and retained histories',()=>{
  const i=canonical(1),reference=finish(createOptimizedSearch(i,1000,options)),original=plans.enumeratePlayerRoundPlans;
  try { plans.enumeratePlayerRoundPlans=function*(s){yield* [...original(s)].reverse();};assert.deepEqual(finish(createOptimizedSearch(i,1000,options)),reference); }
  finally { plans.enumeratePlayerRoundPlans=original; }
});
for(const mode of ['strategy','game-accurate'])test('optimized '+mode+' keeps standard accuracy contract',()=>{
  const r=finish(createOptimizedSearch(small(),100,{...options,simulationRules:{accuracyMode:mode}}));
  assert.equal(r.search.accuracyMode,mode);
  for(const a of r.fastestBattleByFrames.filter(a=>a.state==='resolved'&&a.kind==='attack')){
    if(mode==='strategy'){assert.equal(a.accuracy.standardRollSkipped,true);assert.equal(a.accuracy.roll128,undefined);}else assert.equal(a.accuracy.cause,'normal-accuracy');
  }
});
test('scripted intended Assist permits authoritative Confusion replacement',()=>{
  const i=small();i.player=[unit('P',0xc1,{initialStatuses:{confusion:true}})];i.player[0].techs.push(unit('X',3).techs[0]);
  const p=[...plans.enumeratePlayerRoundPlans(plans.rootPlanInfo(i).state)].find(p=>p.orders[0].canonicalSkillId===0xc1);
  let found=false;for(let seed=0;seed<20;seed++){const r=plans.replayPlayerPrefix(i,[p],seed,options);const a=r.result.actions.find(a=>a.actorId==='player-0');if(a.confusion?.redirected){assert.equal(a.kind,'attack');assert.equal(a.canonicalSkillId,3);found=true;break;}}assert.ok(found);
});
for(const status of ['paralysis','invisibility'])test('optimized Strategy retains '+status+' mechanical Miss',()=>{
  const i=small();if(status==='paralysis')i.player[0].initialStatuses={paralysis:true};else i.enemy[0].initialStatuses={invisibility:true};
  const p=[...plans.enumeratePlayerRoundPlans(plans.rootPlanInfo(i).state)][0];let found=false;
  for(let seed=0;seed<30;seed++){const r=plans.replayPlayerPrefix(i,[p],seed,options);if(r.result.actions.some(a=>a.accuracy?.cause===status&&a.outcome==='miss')){found=true;break;}}assert.ok(found);
});
for(const batch of [1,7,100,1000])test('worker optimized semantic output independent of batch '+batch,async()=>{
  const messages=[];const worker=createSimulationWorkerHost(m=>messages.push(structuredClone(m)),{now:()=>0,yieldTask:async()=>{},batchBudgetMs:50,maxBatchSize:batch,progressIntervalMs:150});
  await worker.receive({type:'START',jobId:'test',input:small(),requestedSimulations:100,searchMethod:'optimized-action-search',simulationRules:options.simulationRules,seed:42,optimizedConfig:options.config});
  const actual=messages.at(-1);assert.equal(actual.type,'COMPLETE');const normalized=actual.result;normalized.search.elapsedMs=100;normalized.search.simulationsPerSecond=normalized.optimized.evaluations/100*1000;assert.deepEqual(normalized,result);
  for(const m of messages.filter(m=>m.type==='PROGRESS')){assert.ok(JSON.stringify(m).length<2500);assert.equal(m.progress.optimized.recommendedPrefix,undefined);}
});
for(const cancelAt of [1,10,70])test('worker cancellation at task '+cancelAt+' returns fair partial data',async()=>{
  let tasks=0;const messages=[];const worker=createSimulationWorkerHost(m=>messages.push(m),{now:()=>0,batchBudgetMs:50,maxBatchSize:7,progressIntervalMs:150,yieldTask:async()=>{if(++tasks===cancelAt)await worker.receive({type:'CANCEL',jobId:'cancel'});}});
  await worker.receive({type:'START',jobId:'cancel',input:canonical(1),requestedSimulations:10000,searchMethod:'optimized-action-search',simulationRules:options.simulationRules,seed:42});
  const end=messages.at(-1);assert.equal(end.type,'CANCELLED');assert.equal(end.result.optimized.status,'cancelled');assert.ok(end.result.optimized.evaluations<10000);
  assert.ok(end.result.optimized.topCandidates.every(c=>[4,16,64].includes(c.stats.evaluations)));
});
test('worker configuration structured clones and invalid budget is an error, not random fallback',async()=>{
  const request={type:'START',jobId:'x',input:canonical(),requestedSimulations:1,searchMethod:'optimized-action-search',optimizationObjective:'average-victory',optimizedConfig:options.config};assert.deepEqual(structuredClone(request),request);
  const messages=[];await createSimulationWorkerHost(m=>messages.push(m)).receive(request);assert.equal(messages.at(-1).type,'ERROR');assert.match(messages.at(-1).message,/8788/);
});
function setup(imported=true){
  const {route,buildPlannerBattleAnalysisPreset:build}=require('./helpers/plannerAnalysisFixtures.cjs');const run=route(1),preset=build(run,run.history[0].id),requests=[];
  const search={running:false,start:r=>requests.push(r),cancel(){}};
  const render=host('src/components/BattleSimulation.tsx','BattleSimulation',{'@/hooks/useBattleSimulationWorker':{useBattleSimulationWorker:()=>search}});
  return {run,preset,requests,search,render:()=>render({savedTeams:[],preset:imported?preset:undefined,onSimulationComplete(){}})};
}
for(const imported of [false,true])test((imported?'Planner':'manual')+' defaults Optimized / Strategy / Fastest / Standard',()=>{
  const h=setup(imported),tree=h.render();for(const label of ['Optimized Action Search','Strategy','Fastest Potential'])assert.equal(button(tree,label).props['aria-pressed'],true);
  assert.equal(find(tree,p=>p.id==='simulation-count').props.value,100000);
});
for(const objective of ['Fastest Potential','Average Victory','Success Rate'])test('objective '+objective+' is captured with independent accuracy',()=>{
  const h=setup(),before=JSON.stringify([h.run,h.preset]);button(h.render(),objective).props.onClick();button(h.render(),'Game-accurate').props.onClick();button(h.render(),'Reset imported team').props.onClick();button(h.render(),'Start Simulation').props.onClick();
  assert.equal(h.requests[0].searchMethod,'optimized-action-search');assert.equal(h.requests[0].simulationRules.accuracyMode,'game-accurate');assert.ok(h.requests[0].optimizationObjective);assert.equal(JSON.stringify([h.run,h.preset]),before);
});
test('Random method hides optimized controls and retains count requests',()=>{const h=setup();button(h.render(),'Random Monte Carlo').props.onClick();const tree=h.render();assert.equal(button(tree,'Fastest Potential'),undefined);find(tree,p=>p.id==='simulation-count').props.onChange({target:{value:'123'}});button(h.render(),'Start Simulation').props.onClick();assert.equal(h.requests[0].requestedSimulations,123);assert.equal(h.requests[0].searchMethod,'random-monte-carlo');assert.equal(h.requests[0].optimizedConfig,undefined);});
test('active search locks method, objective and accuracy controls',()=>{const h=setup();h.search.running=true;for(const label of ['Optimized Action Search','Random Monte Carlo','Fastest Potential','Average Victory','Success Rate','Strategy','Game-accurate'])assert.equal(button(h.render(),label).props.disabled,true);});
test('root count is visible and insufficient budget blocks Start',()=>{const h=setup();assert.ok(find(h.render(),p=>Array.isArray(p.children)&&p.children[0]==='First-round Player plans: '));find(h.render(),p=>p.id==='simulation-count').props.onChange({target:{value:'1'}});assert.equal(button(h.render(),'Start Simulation').props.disabled,true);assert.ok(find(h.render(),p=>p.role==='alert'&&String(p.children).includes('Minimum required')));});
for(const phase of ['enumerating','screening','refining','expanding','finalizing'])test('optimized progress renders phase '+phase+' with budget and method',()=>{
  const {SimulationSearchProgress}=load('src/components/SimulationSearchProgress.tsx');let called=0;const tree=SimulationSearchProgress({progress:{...result.search,optimized:{...result.optimized,phase}},requested:100,cancelling:false,onCancel:()=>called++}),text=html(tree);
  for(const label of [phase,'Optimized Action Search','Fastest Potential','Root Player plans:','Rollout evaluations:','Round depth:','Beam:','Best candidate:','evaluations/s'])assert.ok(text.includes(label),label);
  button(tree,'Cancel Simulation').props.onClick();assert.equal(called,1);
});
for(const status of ['completed','cancelled'])test('Results '+status+' shows strategy, statistics and path-specific notice',()=>{
  const r=structuredClone(result);r.optimized.status=status;const text=html(React.createElement(load('src/components/BattleResults.tsx').BattleResults,{results:r}));
  for(const label of ['Fastest route found','Best screened prefix','Round 1','Rock Fist','Top candidates','Fastest f','Average victory f','Success rate','Divergence','path-specific','Search method: Optimized Action Search','Accuracy mode: Strategy','Optimization objective: Fastest Potential','Best observed battle'])assert.ok(text.includes(label),label);
  assert.ok(text.includes(status==='cancelled'?'Partial optimized search — cancelled':'Search completed early'));assert.ok(!text.includes('100 / 100 simulations completed'));
});
test('AOE order renders All and recommended deferred effects stay diagnostic',()=>{
  const i=small();i.player=[unit('P',109)];const r=finish(createOptimizedSearch(i,64,options));const text=html(React.createElement(load('src/components/BattleResults.tsx').BattleResults,{results:r}));assert.ok(text.includes('All'));
  i.player=[unit('P',0xd2)];const unresolved=finish(createOptimizedSearch(i,4,{...options,maxRounds:1}));assert.ok(!unresolved.optimized.diagnostics.some(d=>d.includes('MP transfer')));
});
for(const cancelled of [false,true])test('Planner '+(cancelled?'cancellation':'completion')+' never persists recommended strategy',()=>{
  const h=setup(),before=JSON.stringify([h.run,h.preset]);const i={player:h.preset.playerTeam,enemy:h.preset.enemyTeam,floorSpecialty:'None'},s=createOptimizedSearch(i,10000,options);
  if(cancelled){for(let n=0;n<5;n++)s.step();s.result('cancelled',1);}else finish(s);
  assert.equal(JSON.stringify([h.run,h.preset]),before);assert.equal(load('src/utils/runPlannerStorage.ts').RUN_PLANNER_SCHEMA_VERSION,7);
});

for(const id of [0x8b,0xa1])test('scripted reaction '+id+' preserves authoritative activation and timing',()=>{
  const i=small();i.player=[unit('P',id)];i.enemy=[unit('E',6)];const p=[...plans.enumeratePlayerRoundPlans(plans.rootPlanInfo(i).state)][0];
  const r=plans.replayPlayerPrefix(i,[p],42,{...options,maxRounds:1});const a=r.result.actions.find(a=>a.actorId==='player-0'&&a.state==='resolved');assert.ok(a);assert.equal(a.durationFrames,id===0xa1?761:685);
  if(id===0x8b){assert.equal(a.counter.executionMode,'activated');assert.equal(a.counter.targetRule,'causal-attacker');}else assert.ok(a.interrupt);
});
test('scripted automatic heal retains lowest-HP target policy',()=>{
  const i=small();i.player=[unit('P',0xbc,{stats:{spd:100}}),unit('Low',6,{currentHp:1}),unit('Higher',6,{currentHp:10})];const p=[...plans.enumeratePlayerRoundPlans(plans.rootPlanInfo(i).state)][0];
  const r=plans.replayPlayerPrefix(i,[p],42,{...options,maxRounds:1});assert.deepEqual(r.result.actions.find(a=>a.actorId==='player-0').effectiveTargetIds,['player-1']);
});
for(const id of [0xc8,0xb7])test('multiple automatic Assist targets do not multiply plans '+id,()=>{
  const i=small();i.player=[unit('P',id),unit('A',6,{currentHp:id===0xb7?0:10,initialStatuses:{poison:true}}),unit('B',6,{currentHp:id===0xb7?0:10,initialStatuses:{poison:true}})];assert.equal(plans.rootPlanInfo(i).count,1);
});

