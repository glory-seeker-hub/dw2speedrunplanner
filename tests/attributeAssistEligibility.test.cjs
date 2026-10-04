const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,unit,rng,run,action,data}=require('./helpers/battleSupportFixtures.cjs');
const {assistEligible,isAttributeRestrictedAssist}=load('src/utils/battle/battleSupportEffects.ts');
const {createBattleState}=load('src/utils/battle/battleInput.ts');
const {selectableSkills,legacyActionPolicy}=load('src/utils/battle/battleActions.ts');
const {rootPlanInfo,enumeratePlayerRoundPlans}=load('src/utils/battle/battleActionPlans.ts');
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const reviewed=[[0xb4,'Vaccine'],[0xb6,'Virus'],[0xd6,'Data']];
const typed=(name,id,type,options={})=>{const m=unit(name,id,options);m.digimon={...m.digimon,type};return m;};
test('decoded target-attribute modifier audit is exactly the three reviewed Assists',()=>{
 const skills=data.BATTLE_SKILLS.filter(s=>s.effects.some(e=>e.kind==='parameter-modifier'&&e.subject==='target'&&e.attribute));
 assert.deepEqual(skills.map(s=>s.id),reviewed.map(([id])=>id));
 for(const [id,type] of reviewed){const s=data.getBattleSkillById(id);assert.equal(s.actionKind,'assist');const e=s.effects.find(e=>e.kind==='parameter-modifier');assert.equal(e.attribute,type);assert.equal(e.byte,23);assert.equal(e.subject,'target');}
});
for(const [id,type] of reviewed)for(const side of ['player','enemy']){
 for(const scenario of ['matching','other attributes','own side only','KO match','mixed'])test(`${id} ${side}: ${scenario}`,()=>{
  const other=['Vaccine','Virus','Data'].filter(t=>t!==type),actor=typed('Actor',id,type);
  const opponents=scenario==='matching'?[typed('Match',6,type)]
   :scenario==='mixed'?[typed('Other',6,other[0]),typed('Match',6,type)]
   :scenario==='KO match'?[typed('KO',6,type,{currentHp:0}),typed('Other',6,other[0])]
   :other.map((t,n)=>typed('Other'+n,6,t));
  const own=[actor,...(scenario==='own side only'?[typed('Ally',6,type)]:[])];
  const state=createBattleState({player:side==='player'?own:opponents,enemy:side==='enemy'?own:opponents,floorSpecialty:'none'});
  const a=state.combatants.find(a=>a.name==='Actor'),expected=['matching','mixed'].includes(scenario);
  assert.equal(assistEligible(a,a.skills[0],state.combatants),expected);
  assert.equal(selectableSkills(a,state.combatants).length,expected?1:0);
  const choice=legacyActionPolicy.chooseAction(a,{combatants:state.combatants,round:1},rng());
  assert.equal(choice.kind,expected?'skill':'skip');
 });
 test(`${id} ${side}: legal field execution preserves attribute stage effects, MP, timing and target policy`,()=>{
  const other=type==='Vaccine'?'Virus':'Vaccine',actor=typed('Actor',id,other,{stats:{spd:100}}),ally=typed('Ally',6,type);
  const opposition=[typed('Match',6,type),typed('Other',6,other)];
  const r=run(side==='player'?[actor,ally]:opposition,side==='enemy'?[actor,ally]:opposition),a=action(r,'Actor');
  assert.equal(a.state,'resolved');assert.equal(a.mpAccounting.costCharged,36);assert.equal(a.durationFrames,915);
  assert.equal(a.effectiveTargetIds.length,4); // Execution remains field-wide, including matching allies.
  for(const c of r.state.combatants){assert.equal(c.atkStage,c.type===type?-1:0);assert.equal(c.defStage,c.type===type?-1:0);}
  const events=a.supportEvents.filter(e=>e.kind==='stage');assert.equal(events.length,4);assert.ok(events.every(e=>e.delta===-1));
 });
 test(`${id} ${side}: unavailable reviewed Assist is never randomly selected alongside an attack`,()=>{
  const other=type==='Vaccine'?'Virus':'Vaccine',actor=typed('Actor',id,type);actor.techs.push(unit('X',6).techs[0]);
  const i={player:side==='player'?[actor]:[typed('Opp',6,other)],enemy:side==='enemy'?[actor]:[typed('Opp',6,other)],floorSpecialty:'none'};
  const s=createBattleState(i),a=s.combatants.find(a=>a.name==='Actor');
  for(let seed=0;seed<20;seed++)assert.equal(legacyActionPolicy.chooseAction(a,{combatants:s.combatants,round:1},createSeededBattleRng(seed)).skillKey,'waza-6');
 });
}
for(const [id,type] of reviewed)test(`${id}: root and optimized strategy exclude unavailable Assist`,()=>{
 const other=type==='Vaccine'?'Virus':'Vaccine',p=typed('P',id,type,{stats:{atk:100,spd:100}});p.techs.push(unit('X',6).techs[0]);
 const i={player:[p],enemy:[typed('E',6,other,{currentHp:1,stats:{spd:1}})],floorSpecialty:'none'};
 const root=rootPlanInfo(i);assert.equal(root.count,1);assert.ok([...enumeratePlayerRoundPlans(root.state)].every(p=>p.orders.every(o=>o.canonicalSkillId!==id)));
 const search=createOptimizedSearch(i,64,{seed:42,simulationRules:{accuracyMode:'strategy'},config:{beamWidth:1,maxDepth:1}});while(!search.done)search.step();const r=search.result('completed',1);
 assert.ok(r.completedSuccesses>0);for(const p of [...r.optimized.recommendedPrefix,...r.optimized.fastestRoute.decisionTrace])for(const o of p.orders)assert.equal(o.skillKey,'waza-6');
 i.player[0].techs.pop();assert.equal(rootPlanInfo(i).count,0);assert.throws(()=>createOptimizedSearch(i,64),/No complete legal Player round plan/);
 i.enemy[0].digimon.type=type;assert.equal(rootPlanInfo(i).count,1);
});
test('unrelated ineligible Assist retains historical policy fallback',()=>{
 const s=createBattleState({player:[unit('Revive',0xb7)],enemy:[unit('E')],floorSpecialty:'none'}),a=s.combatants[0];
 assert.equal(isAttributeRestrictedAssist(a.skills[0]),false);assert.equal(assistEligible(a,a.skills[0],s.combatants),false);
 assert.equal(legacyActionPolicy.chooseAction(a,{combatants:s.combatants,round:1},rng()).kind,'skill');
});
