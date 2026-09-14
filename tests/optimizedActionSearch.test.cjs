const {test}=require('node:test'),assert=require('node:assert/strict');
const {canonical,small,load,unit}=require('./helpers/optimizedFixtures.cjs');
const plans=load('src/utils/battle/battleActionPlans.ts');
const objectives=load('src/utils/battle/battleSearchObjectives.ts');
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const {createSimulationSearch}=load('src/utils/battle/battleSimulationSearch.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const {simulateBattleCore}=load('src/utils/battle/battleSimulation.ts');
const modes=['strategy','game-accurate'];
const options={seed:42,simulationRules:{accuracyMode:'strategy'},config:{beamWidth:2,maxDepth:3}};
const finish=s=>{while(!s.done)s.step();return s.result('completed',100);};
for(const [n,count] of [[1,125],[2,729],[3,2197]])test(n+' enemies give exactly '+count+' unique Player plans',()=>{
  const input=canonical(n),before=JSON.stringify(input),root=plans.rootPlanInfo(input),all=[...plans.enumeratePlayerRoundPlans(root.state)];
  assert.equal(root.count,count);assert.equal(all.length,count);assert.equal(new Set(all.map(p=>p.key)).size,count);
  for(const actor of root.state.combatants.slice(0,3))assert.equal(plans.enumerateLegalPlayerOrders(root.state,actor).length,4*n+1);
  assert.deepEqual(all[0].orders.map(o=>o.actorId),['player-0','player-1','player-2']);assert.equal(JSON.stringify(input),before);
});
test('Enemy skill/target possibilities do not multiply Player plans',()=>{const i=canonical();i.enemy.forEach(e=>e.techs=[unit('x',6).techs[0],unit('x',109).techs[0]]);assert.equal(plans.rootPlanInfo(i).count,2197);});
for(const id of [0x8b,133,0xa0,0xa1,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xc1,0xba])test('policy-target skill '+id+' contributes one choice',()=>{
  const i=canonical();i.player=[unit('P',id)];const s=plans.rootPlanInfo(i).state,orders=plans.enumerateLegalPlayerOrders(s,s.combatants[0]);assert.equal(orders.length,1);assert.equal(orders[0].targetIntent,undefined);
});
for(const id of [0xbc,0xc8,0xb7])test('Assist '+id+' eligibility and policy targeting reused',()=>{
  const i=canonical();i.player=[unit('P',id),unit('Ally',6,{currentHp:id===0xb7?0:10,initialStatuses:{poison:true}})];
  const s=plans.rootPlanInfo(i).state;assert.equal(plans.enumerateLegalPlayerOrders(s,s.combatants[0]).length,1);
});
test('cure without affected ally has no selectable order',()=>{const i=small();i.player=[unit('P',0xc8)];assert.equal(plans.rootPlanInfo(i).count,0);assert.throws(()=>createOptimizedSearch(i,100,options),/No complete legal/);});
test('invisibility filters Single targets but preserves AOE',()=>{const i=canonical();i.enemy[0].initialStatuses={invisibility:true};const s=plans.rootPlanInfo(i).state,orders=plans.enumerateLegalPlayerOrders(s,s.combatants[0]);assert.equal(orders.length,9);assert.ok(!orders.some(o=>o.targetIntent?.targetIds.includes('enemy-0')));assert.equal(orders.filter(o=>o.targetLabel==='All').length,1);});
test('sole invisible opponent remains selectable under existing rules',()=>{const i=canonical(1);i.enemy[0].initialStatuses={invisibility:true};assert.equal(plans.rootPlanInfo(i).count,125);});
test('Player HP zero remains strategic; revived-this-round actor suppressed',()=>{const i=small();i.player[0].currentHp=0;const s=plans.rootPlanInfo(i).state;assert.equal(plans.countPlayerRoundPlans(s),1);s.combatants[0].revivedRound=1;assert.equal(plans.countPlayerRoundPlans(s),0);});
test('same canonical decision aliases deduplicate while AP semantics stay distinct',()=>{const i=small();i.player[0].techs.push({...i.player[0].techs[0],id:'alias'});assert.equal(plans.rootPlanInfo(i).count,1);i.player[0].techs[1].ap++;assert.equal(plans.rootPlanInfo(i).count,2);});
test('explicit target remains locked in execution history',()=>{const i=canonical(2),p=[...plans.enumeratePlayerRoundPlans(plans.rootPlanInfo(i).state)].find(p=>p.orders.every(o=>o.targetIntent?.targetIds[0]==='enemy-1'));const r=plans.replayPlayerPrefix(i,[p],42,options);assert.equal(r.diverged,false);for(const a of r.result.actions.filter(a=>a.actorId.startsWith('player')&&a.kind==='attack'&&a.round===1))assert.deepEqual(a.targetIntent,{kind:'combatants',targetIds:['enemy-1']});});
for(const kind of ['target-ko','invisibility','actor','skill'])test('scripted '+kind+' mismatch diverges without random substitution',()=>{
  const i=canonical(2),root=plans.rootPlanInfo(i),p=[...plans.enumeratePlayerRoundPlans(root.state)].find(p=>p.orders.every(o=>o.targetIntent?.targetIds[0]==='enemy-0'));
  if(kind==='target-ko')i.enemy[0].currentHp=0;
  if(kind==='invisibility')i.enemy[0].initialStatuses={invisibility:true};
  if(kind==='actor')i.player.pop();
  if(kind==='skill')i.player[0].techs=[];
  const r=plans.replayPlayerPrefix(i,[p],42,options);
  if(kind==='skill')assert.ok(r.diverged||r.result.outcome==='unsupported');else assert.equal(r.diverged,true);
});
test('battle ending before an unused later order is harmless',()=>{const i=small(),p=[...plans.enumeratePlayerRoundPlans(plans.rootPlanInfo(i).state)][0];const r=plans.replayPlayerPrefix(i,[p,{round:2,key:'invalid-later',orders:[]}],42,options);assert.equal(r.diverged,false);assert.equal(r.result.outcome,'player-win');});
test('random tail and Enemy policy remain identical when prefix is empty',()=>{for(const accuracyMode of modes){const i=canonical(1),opts={simulationRules:{accuracyMode}};assert.deepEqual(plans.replayPlayerPrefix(i,[],42,opts).result,simulateBattleCore(i,{...opts,rng:createSeededBattleRng(42)}));}});
for(const accuracyMode of modes)test(accuracyMode+' committed Monte Carlo output unchanged',()=>{const {cases}=require('./helpers/battleFixtures.cjs');const s=createSimulationSearch({player:cases.single[0],enemy:cases.single[1],floorSpecialty:'None'},100,{simulationRules:{accuracyMode},rng:createSeededBattleRng(42)});while(!s.done)s.step();assert.deepEqual(s.result('completed',100),require('./fixtures/optimizedMonteCarloBaseline.json')[accuracyMode]);});
for(const sampleIndex of [0,1,2,15,63])test('paired sibling seed stable at sample '+sampleIndex,()=>{
  const a=['a','b','c'].map(()=>objectives.rolloutSeed(42,2,'parent',sampleIndex));const b=['c','b','a'].map(()=>objectives.rolloutSeed(42,2,'parent',sampleIndex));assert.deepEqual(a,b);assert.equal(new Set(a).size,1);assert.notEqual(a[0],objectives.rolloutSeed(42,2,'parent',sampleIndex+1));
});
const base=simulateBattleCore(small(),{rng:createSeededBattleRng(42),simulationRules:{accuracyMode:'strategy'}});
function candidate(key,outcomes){const stats=objectives.emptyCandidateStats();for(const [frames,diverged=false,victory=true]of outcomes)objectives.addCandidateOutcome(stats,{...base,outcome:victory?'player-win':'limit-reached',totalFrames:frames,timingCompleteness:frames===null?'incomplete':'complete'},diverged);return {key,stats};}
for(const [objective,a,b] of [
  ['fastest-potential',candidate('a',[[10],[100]]),candidate('b',[[20],[20]])],
  ['average-victory',candidate('a',[[20],[20]]),candidate('b',[[10],[100]])],
  ['success-rate',candidate('a',[[100],[100]]),candidate('b',[[10],[null,true]])],
])test(objective+' ranks by its defined primary objective',()=>assert.ok(objectives.compareCandidates(a,b,objective)<0));
for(const objective of ['fastest-potential','average-victory','success-rate']){
  test(objective+' exact ties use canonical key',()=>assert.ok(objectives.compareCandidates(candidate('a',[[10]]),candidate('b',[[10]]),objective)<0));
  test(objective+' divergence counts in denominator and is frame-ineligible',()=>{const c=candidate('c',[[1,true],[20]]);assert.equal(c.stats.successRate,.5);assert.equal(c.stats.divergenceRate,.5);assert.equal(c.stats.fastestFrames,20);assert.equal(c.stats.averageVictoryFrames,20);});
}
for(const objective of ['fastest-potential','average-victory'])test(objective+' excludes incomplete timing',()=>assert.ok(objectives.compareCandidates(candidate('a',[[1000]]),candidate('b',[[null]]),objective)<0));
for(const objective of ['fastest-potential','average-victory','success-rate'])test(objective+' representative selection independent of array order',()=>{const samples=[{frames:10,sampleIndex:2,seed:2},{frames:20,sampleIndex:1,seed:1},{frames:30,sampleIndex:0,seed:0}];const r=objectives.representativeSample(samples,objective);assert.equal(r.frames,objective==='fastest-potential'?10:20);assert.deepEqual(r,objectives.representativeSample(samples.reverse(),objective));});
test('median-nearest even-sample tie chooses earliest sample',()=>{const r=objectives.representativeSample([{frames:10,sampleIndex:9,seed:1},{frames:20,sampleIndex:1,seed:2}],'average-victory');assert.equal(r.sampleIndex,1);});
test('root budget below 8788 rejected; exact minimum screens all 2197 four times',()=>{
  assert.throws(()=>createOptimizedSearch(canonical(),8787,options),/8788/);
  const counts=new Map(),original=plans.replayPlayerPrefix;let r;
  try { plans.replayPlayerPrefix=(input,prefix,seed,opts,stop,capture)=>{if(!stop){const key=plans.prefixKey(prefix);if(!counts.has(key))counts.set(key,[]);counts.get(key).push(seed);}return original(input,prefix,seed,opts,stop,capture);};r=finish(createOptimizedSearch(canonical(),8788,options)); }
  finally {plans.replayPlayerPrefix=original;}
  assert.equal(counts.size,2197);const firstSeeds=[...counts.values()][0];for(const seeds of counts.values()){assert.equal(seeds.length,4);assert.deepEqual(seeds,firstSeeds);}
  assert.equal(r.optimized.evaluations,8788);assert.equal(r.optimized.candidatesEvaluated,2197);
  assert.ok(r.optimized.topCandidates.every(c=>c.stats.evaluations===4));assert.equal(r.optimized.fairStageEvaluations,8788);
});
test('cancel before first full stage yields no ranked recommendation',()=>{const s=createOptimizedSearch(canonical(1),1000,options);while(s.completed<10)s.step();const r=s.result('cancelled',1);assert.equal(r.optimized.recommendedStats,null);assert.equal(r.optimized.fairStageEvaluations,0);});
test('mid-refinement cancellation uses frozen four-sample fair comparison',()=>{const s=createOptimizedSearch(canonical(1),10000,options);while(s.completed<501)s.step();const r=s.result('cancelled',1);assert.equal(r.optimized.fairStageEvaluations,500);assert.ok(r.optimized.topCandidates.every(c=>c.stats.evaluations===4));});
test('survivors reach cumulative 16 and 64 with no budget overrun',()=>{const r=finish(createOptimizedSearch(canonical(1),10000,options));assert.ok(r.optimized.topCandidates.every(c=>c.stats.evaluations===64));assert.ok(r.optimized.evaluations<=10000);assert.ok(r.optimized.beamSize<=3);});
for(const accuracyMode of modes)for(const batch of [1,7,100,1000])test(accuracyMode+' optimized deterministic across batch '+batch,()=>{
  const o={...options,simulationRules:{accuracyMode}},reference=finish(createOptimizedSearch(small(),100,o)),s=createOptimizedSearch(small(),100,o);while(!s.done)for(let i=0;i<batch&&!s.done;i++)s.step();assert.deepEqual(s.result('completed',100),reference);
});
test('terminal representative stops below maximum budget at depth one',()=>{const r=finish(createOptimizedSearch(small(),10000,options));assert.equal(r.optimized.depth,1);assert.equal(r.optimized.evaluations,64);});
test('deeper children preserve prior orders and use replayed boundary state',()=>{
  const {cases}=require('./helpers/battleFixtures.cjs'),i={player:cases.single[0],enemy:cases.single[1],floorSpecialty:'None'};
  const r=finish(createOptimizedSearch(i,10000,options));assert.equal(r.optimized.depth,3);assert.equal(r.optimized.recommendedPrefix.length,3);assert.deepEqual(r.optimized.recommendedPrefix.map(p=>p.round),[1,2,3]);
  const prefix=r.optimized.recommendedPrefix.slice(0,1),replay=plans.replayPlayerPrefix(i,prefix,objectives.rolloutSeed(42,1,plans.prefixKey([]),0),options,true);assert.equal(replay.nextState.round,2);
});
test('source input and rules immutable across optimized completion',()=>{const i=canonical(1),o=structuredClone(options),before=JSON.stringify([i,o]);finish(createOptimizedSearch(i,500,o));assert.equal(JSON.stringify([i,o]),before);});

for(const count of [4,16,64])test('completed stage '+count+' is immediately available at cancellation boundary',()=>{
  const s=createOptimizedSearch(small(),100,options);while(s.completed<count)s.step();const r=s.result('cancelled',1);
  assert.equal(r.optimized.fairStageEvaluations,count);assert.equal(r.optimized.recommendedStats.evaluations,count);
});
test('later round illegal explicit target is divergence while battle still exists',()=>{
  const i=canonical(2),p=[...plans.enumeratePlayerRoundPlans(plans.rootPlanInfo(i).state)].find(p=>p.orders.every(o=>o.targetIntent?.targetIds[0]==='enemy-0'));
  const r=plans.replayPlayerPrefix(i,[p,{...p,round:2}],42,options);assert.equal(r.diverged,true);assert.ok(r.result.diagnostics.includes('scripted-plan-diverged'));
  assert.ok(!r.result.actions.some(a=>a.round===2&&a.state==='resolved'));
});
test('local HP/MP edits enter root state without modifying source',()=>{const i=small();i.player[0].currentHp=0;i.player[0].currentMp=0;const before=JSON.stringify(i),root=plans.rootPlanInfo(i);assert.equal(root.state.combatants[0].currentHp,0);assert.equal(root.state.combatants[0].currentMp,0);assert.equal(root.count,1);assert.equal(JSON.stringify(i),before);});

test('terminal winning strategy stays eligible while other beam paths expand',()=>{const i=canonical(3);i.player=[unit('P',6,{stats:{spd:100,atk:100}})];i.player[0].techs.push(unit('X',109).techs[0]);const r=finish(createOptimizedSearch(i,5000,options));assert.equal(r.optimized.recommendedPrefix.length,1);assert.equal(r.optimized.recommendedPrefix[0].orders[0].canonicalSkillId,109);assert.ok(r.optimized.depth>=2);});
