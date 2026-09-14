const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,route,buildPlannerBattleAnalysisPreset:build}=require('./helpers/plannerAnalysisFixtures.cjs');
const {host,find,button}=require('./helpers/componentHost.cjs');
const React=require('react'),{renderToStaticMarkup:renderHtml}=require('react-dom/server');
const {cases}=require('./helpers/battleFixtures.cjs');
const {createSimulationSearch}=load('src/utils/battle/battleSimulationSearch.ts');
const {createSimulationWorkerHost}=load('src/workers/battleSimulationHost.ts');
const {createSearchController}=load('src/workers/battleSimulationController.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const input={player:cases.single[0],enemy:cases.single[1],floorSpecialty:'None'};
const modes=['strategy','game-accurate'];

function setup(imported=true){
  const run=route(1),preset=build(run,run.history[0].id),requests=[];
  const search={running:false,start:r=>requests.push(r),cancel(){}};
  const render=host('src/components/BattleSimulation.tsx','BattleSimulation',{'@/hooks/useBattleSimulationWorker':{useBattleSimulationWorker:()=>search}});
  const props={savedTeams:[],preset:imported?preset:undefined,onSimulationComplete(){}};
  return {run,preset,requests,search,render:()=>render(props)};
}
for(const imported of [false,true])test('fresh '+(imported?'Planner':'manual')+' session defaults Strategy',()=>{
  const h=setup(imported),tree=h.render();
  assert.equal(button(tree,'Strategy').props['aria-pressed'],true);
  assert.equal(button(tree,'Game-accurate').props['aria-pressed'],false);
  assert.ok(find(tree,p=>typeof p.children==='string'&&p.children.includes('Standard Hit Rate misses are disabled')));
});
for(const mode of modes)test('UI '+mode+' snapshot, reset and active locking',()=>{
  const h=setup(),before=JSON.stringify([h.run,h.preset]);
  if(mode==='strategy')button(h.render(),'Game-accurate').props.onClick();
  button(h.render(),mode==='strategy'?'Strategy':'Game-accurate').props.onClick();
  assert.ok(find(h.render(),p=>typeof p.children==='string'&&p.children.includes(mode==='strategy'?'Standard Hit Rate misses are disabled':"Uses Digimon World 2's normal Hit Rate RNG.")));
  button(h.render(),'Reset imported team').props.onClick();
  button(h.render(),'Start Simulation').props.onClick();
  assert.equal(h.requests[0].simulationRules.accuracyMode,mode);
  h.search.running=true;
  for(const label of ['Strategy','Game-accurate'])assert.equal(button(h.render(),label).props.disabled,true);
  assert.equal(JSON.stringify([h.run,h.preset]),before);
  assert.equal(button(setup().render(),'Strategy').props['aria-pressed'],true);
});
for(const mode of modes)for(const cancel of [false,true])test(mode+' worker '+(cancel?'partial':'complete')+' captures immutable rules',async()=>{
  const config={accuracyMode:mode},messages=[];let yields=0;
  const worker=createSimulationWorkerHost(m=>messages.push(m),{now:()=>0,batchBudgetMs:50,maxBatchSize:7,progressIntervalMs:150,yieldTask:async()=>{
    config.accuracyMode=mode==='strategy'?'game-accurate':'strategy';
    if(++yields===2&&cancel)await worker.receive({type:'CANCEL',jobId:'mode'});
  }});
  await worker.receive({type:'START',jobId:'mode',input,requestedSimulations:20,seed:50,simulationRules:config});
  const terminal=messages.at(-1),count=cancel?7:20;
  assert.equal(terminal.type,cancel?'CANCELLED':'COMPLETE');
  assert.equal(terminal.result.search.accuracyMode,mode);
  const reference=createSimulationSearch(input,count,{simulationRules:{accuracyMode:mode},rng:createSeededBattleRng(50)});
  while(!reference.done)reference.step();
  const {search,...expected}=reference.result('completed',0),{search:actualMeta,...actual}=terminal.result;
  assert.deepEqual(actual,expected);
  const html=renderHtml(React.createElement(load('src/components/BattleResults.tsx').BattleResults,{results:terminal.result}));
  assert.ok(html.includes('Accuracy mode: '+(mode==='strategy'?'Strategy':'Game-accurate')));
  assert.ok(html.includes(cancel?'Partial results':'Search completed'));
  if(mode==='strategy'){
    assert.ok(html.includes('Standard accuracy bypassed'));
    assert.ok(!html.includes('Miss — Accuracy'));
  }
});
for(const mode of modes)test(mode+' controller clones configuration independently of caller',()=>{
  const port={postMessage(m){this.message=m},terminate(){}},config={accuracyMode:mode};
  const controller=createSearchController(()=>port,()=>{},()=>{});
  controller.start({input,requestedSimulations:10,simulationRules:config});
  config.accuracyMode='invalid';
  assert.equal(port.message.simulationRules.accuracyMode,mode);
  controller.dispose();
});
test('omitted worker rules retain Game-accurate provenance',async()=>{
  let terminal;const worker=createSimulationWorkerHost(m=>terminal=m);
  await worker.receive({type:'START',jobId:'default',input,requestedSimulations:1,seed:50});
  assert.equal(terminal.result.search.accuracyMode,'game-accurate');
});
for(const mode of modes)test(mode+' Planner history and preset stay immutable after simulation and cancellation',()=>{
  const h=setup(),before=JSON.stringify([h.run,h.preset]);
  const s=createSimulationSearch({player:h.preset.playerTeam,enemy:h.preset.enemyTeam,floorSpecialty:'None'},10,{simulationRules:{accuracyMode:mode},rng:createSeededBattleRng(42)});
  s.step();s.result('cancelled',1);
  assert.equal(JSON.stringify([h.run,h.preset]),before);
});

for(const [cause,label] of [['paralysis','Paralysis'],['invisibility','Invisibility forced Miss'],['tail-blade-evasion','Tail Blade'],['interrupt-forced-miss','Forced by Interrupt'],['assist-target-lost','Assist target KO'],['counter-not-activated','Counter not activated'],['normal-accuracy','Accuracy']])test('history preserves '+cause+' label',()=>{
  const {aggregateBattleRuns}=load('src/utils/battle/battleCompatibility.ts');
  const {run,unit,rng}=require('./helpers/battleSupportFixtures.cjs');
  const r=run([unit()],[unit('E')],{rng:rng({accuracy:[127,0]})}),result=aggregateBattleRuns([]);
  const a=r.actions[0];assert.equal(a.outcome,'miss');
  result.fastestBattleHistory=[{...a,accuracy:{...a.accuracy,cause}}];
  result.accuracyMode=cause==='normal-accuracy'?'game-accurate':'strategy';
  const html=renderHtml(React.createElement(load('src/components/BattleResults.tsx').BattleResults,{results:result}));
  assert.ok(html.includes('Miss — '+label));
  if(cause!=='normal-accuracy')assert.ok(!html.includes('Miss — Accuracy'));
});
