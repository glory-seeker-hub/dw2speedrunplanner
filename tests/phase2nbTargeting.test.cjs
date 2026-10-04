const {test}=require('node:test'),assert=require('node:assert/strict');
const {unit,rng,run,first,data,load}=require('./helpers/battleSupportFixtures.cjs');
const {rootPlanInfo,enumerateLegalPlayerOrders,enumeratePlayerRoundPlans,replayPlayerPrefix}=load('src/utils/battle/battleActionPlans.ts');
const {createBattleState}=load('src/utils/battle/battleInput.ts');
const {planAction,legacyActionPolicy}=load('src/utils/battle/battleActions.ts');
const {claimInterrupt}=load('src/utils/battle/battleInterrupts.ts');
const {resolveEffectiveTargets}=load('src/utils/battle/battleTargets.ts');
const {calculateActionDamage}=load('src/utils/battle/battleDamage.ts');
const {createPlayerDecisionTrace}=load('src/utils/battle/battlePlayerDecisionTrace.ts');
const {resolvedOrderTarget,intendedTarget}=load('src/utils/battle/battlePresentation.ts');
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const input=(id=0xa1,n=3)=>({player:[unit('P',id)],enemy:Array.from({length:n},(_,i)=>unit('E'+i,6,{stats:{spd:80-i*20}})),floorSpecialty:'None'});
const pick=(target)=>({beforeRound:()=>{},chooseAction:a=>({...first.chooseAction(a),targetIntent:{kind:'combatants',targetIds:[target]}})});
const interrupts=r=>r.actions.filter(a=>a.kind==='interrupt'&&a.state==='resolved');
const labels=state=>state.combatants.map(a=>({...a,slot:a.position+1}));
function prepare(id=0xa1){const state=createBattleState(input(id));state.round=1;const actions=state.combatants.map(a=>planAction(state,a,a.side==='player'?pick('enemy-1').chooseAction(a):first.chooseAction(a)));state.queue=actions.slice(1).map(a=>a.id);for(const a of actions.slice(1))a.prepared={initialAccuracy:{outcome:'hit'},interruptConsumed:false};return {state,actions};}

for(const id of [0x83,0x85,0x86,0x87,0x88,0x8b,0xa0,0xa1,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8])for(const n of [1,2,3])test(`explicit reaction 0x${id.toString(16)} enumerates ${n} target identities`,()=>{
 const i=input(id,n),before=structuredClone(i),root=rootPlanInfo(i),orders=enumerateLegalPlayerOrders(root.state,root.state.combatants[0]);
 assert.equal(root.count,n);assert.equal(root.minimumBudget,n*4);assert.equal(new Set(orders.map(o=>o.key)).size,n);
 assert.deepEqual(orders.flatMap(o=>o.targetIntent.targetIds).sort(),Array.from({length:n},(_,j)=>'enemy-'+j));assert.deepEqual(i,before);
});
test('Interrupt choices do not inspect future enemy techniques, counters or accuracy',()=>{
 const i=input();i.enemy=[unit('protected',0x4d),unit('counter',0x88),unit('interrupt',0xa1)];assert.equal(rootPlanInfo(i).count,3);
});
for(const id of [0xa1,0x88])test(`reaction ${id} applies current visibility and KO selection rules`,()=>{
 const i=input(id);i.enemy[0].initialStatuses={invisibility:true};i.enemy[2].currentHp=0;let r=rootPlanInfo(i);assert.equal(r.count,1);assert.deepEqual(enumerateLegalPlayerOrders(r.state,r.state.combatants[0])[0].targetIntent.targetIds,['enemy-1']);i.enemy[1].currentHp=0;r=rootPlanInfo(i);assert.equal(r.count,1);assert.deepEqual(enumerateLegalPlayerOrders(r.state,r.state.combatants[0])[0].targetIntent.targetIds,['enemy-0']);
});
for(const target of ['enemy-0','enemy-1','enemy-2'])test(`Interrupt triggers immediately before ${target}, with immutable intent and no target RNG`,()=>{
 const i=input(),random=rng(),trace=createPlayerDecisionTrace(),r=run(i.player,i.enemy,{rng:random,playerDecisions:pick(target),playerDecisionObserver:trace.observer});
 const a=interrupts(r)[0],index=r.actions.indexOf(a);assert.ok(a);assert.equal(a.interrupt.targetActorId,target);assert.equal(r.actions[index+1].actorId,target);assert.equal(r.actions[index+1].restart.initialAccuracyResolution.outcome,'hit');assert.deepEqual(a.targetIntent.targetIds,[target]);assert.deepEqual(trace.trace[0].orders[0].targetIntent.targetIds,[target]);assert.ok(!random.draws.some(d=>d.category==='interrupt-target-choice'));
});
for(const problem of ['miss','activated','shared-trigger-promoted','cancelled','ko','revived','interrupt','protected','shadow'])test(`selected ${problem} enemy cannot trigger or retarget`,()=>{
 const {state,actions}=prepare(),selected=actions[2];
 if(problem==='miss')selected.prepared.initialAccuracy.outcome='miss';
 if(['activated','shared-trigger-promoted'].includes(problem))selected.counter={executionMode:problem};
 if(problem==='cancelled')selected.state='cancelled';if(problem==='ko')state.combatants[2].isAlive=false;if(problem==='revived')state.combatants[2].revivedRound=1;
 if(problem==='interrupt')selected.kind='interrupt';
 if(problem==='protected')selected.skill={...selected.skill,canonicalSkillId:data.BATTLE_SKILLS.find(s=>s.effects.some(e=>e.kind==='action-protection'&&e.against==='interrupt')).id};
 if(problem==='shadow')selected.skill={...selected.skill,canonicalSkillId:0x4d};
 const random=rng();for(const a of actions.slice(1))assert.equal(claimInterrupt(state,a,random),null);
 assert.deepEqual(actions[0].targetIntent.targetIds,['enemy-1']);assert.equal(actions[0].interrupt.state,'waiting');assert.equal(random.draws.length,0);
});
test('selected miss remains an unexecuted order despite later hits',()=>{
 const i=input(),random=rng({accuracy:[0,127,0]}),r=run(i.player,i.enemy,{rng:random,playerDecisions:pick('enemy-1')});
 assert.equal(interrupts(r).length,0);const a=r.actions.find(a=>a.kind==='interrupt');assert.equal(a.reason,'interrupt-no-eligible-target');assert.deepEqual(a.targetIntent.targetIds,['enemy-1']);
});
test('Enemy Interrupt skips protected fastest action and interrupts next qualifying hit in queue order',()=>{
 const id=data.BATTLE_SKILLS.find(s=>s.actionKind==='attack'&&s.effects.some(e=>e.kind==='action-protection'&&e.against==='interrupt')).id;
 const r=run([unit('protected',id,{stats:{spd:120}}),unit('next',6,{stats:{spd:90}})],[unit('I',0xa1)]),a=interrupts(r)[0];assert.equal(a.interrupt.targetActorId,'player-1');assert.equal(a.interrupt.targetPolicy,'enemy-first-attacker');assert.equal(r.actions[0].actorName,'protected');
});
for(const id of [0xa1,0x88])test(`Random policy samples complete reaction orders ${id} before execution`,()=>{
 const state=rootPlanInfo(input(id)).state,actor=state.combatants[0];for(let target=0;target<3;target++){const random=rng({'action-choice':[target]}),choice=legacyActionPolicy.chooseAction(actor,{round:1,combatants:state.combatants},random);assert.deepEqual(choice.targetIntent.targetIds,['enemy-'+target]);assert.deepEqual(random.draws.map(d=>d.category),['action-choice']);const action=planAction(state,actor,choice);if(id===0x88){assert.deepEqual(resolveEffectiveTargets(state,action,random),['enemy-'+target]);assert.equal(random.draws.length,1);}}
});
for(const id of [0xa1,0x88])test(`scripted reaction ${id} preserves target across seeds and replay capture`,()=>{
 const i=input(id),plan=[...enumeratePlayerRoundPlans(rootPlanInfo(i).state)].find(p=>p.orders[0].targetIntent.targetIds[0]==='enemy-2');
 for(const seed of [0,1,42,99]){const r=replayPlayerPrefix(i,[plan],seed,{maxRounds:1},false,true);assert.equal(r.diverged,false);assert.deepEqual(r.decisionTrace[0].orders[0].targetIntent,plan.orders[0].targetIntent);assert.deepEqual(r.result.state.plannedActions.find(a=>a.actorId==='player-0').targetIntent,plan.orders[0].targetIntent);}
});
for(const id of [0x83,0x87,0x88,0x86])for(const activated of [false,true])test(`Counter ${id} ${activated?'activated overrides':'untriggered retains'} original target and exact recipient damage`,()=>{
 const i=input(id);i.player[0].customStats.atk=23;i.enemy.forEach((e,j)=>e.customStats.def=[19,27,31][j]);
 const state=createBattleState(i);state.round=1;const action=planAction(state,state.combatants[0],pick('enemy-2').chooseAction(state.combatants[0]));
 action.counter.executionMode=activated?'activated':'untriggered-end-of-turn';action.counter.activatedMechanics=activated;if(activated)action.counter.triggerActorId='enemy-0';
 const random=rng(),targets=resolveEffectiveTargets(state,action,random),all=activated&&id!==0x86;assert.deepEqual(targets,all?['enemy-0','enemy-1','enemy-2']:[activated?'enemy-0':'enemy-2']);assert.deepEqual(action.targetIntent.targetIds,['enemy-2']);assert.equal(random.draws.length,0);
 const ap={131:20,135:30,136:40,134:32.5}[id];for(const targetId of targets){const enemy=state.combatants.find(a=>a.id===targetId);const base=Math.floor(Math.floor(ap)*23/enemy.baseStats.def),expected=activated&&[0x86,0x88].includes(id)?Math.floor(base*3/2):base;assert.equal(calculateActionDamage(state.combatants[0],enemy,action,'None',state),expected);}
});
test('Smiley Warhead floor-sensitive output multiplication differs from AP multiplication',()=>{
 const {state,actions}=prepare(0x88),a=actions[0],p=state.combatants[0],e=state.combatants[1];p.baseStats.atk=23;e.baseStats.def=27;a.counter.executionMode='activated';a.counter.activatedMechanics=true;
 assert.equal(calculateActionDamage(p,e,a,'None',state),51);assert.equal(Math.floor(40*1.5*23/27),51);
 e.baseStats.def=19;assert.equal(calculateActionDamage(p,e,a,'None',state),72);assert.equal(Math.floor(40*1.5*23/19),72);
 e.baseStats.def=31;assert.equal(calculateActionDamage(p,e,a,'None',state),43);assert.equal(Math.floor(40*1.5*23/31),44);
});
test('untriggered Counter does not replace a KO original target',()=>{const {state,actions}=prepare(0x88);state.combatants[2].isAlive=false;assert.deepEqual(resolveEffectiveTargets(state,actions[0],rng()),[]);assert.deepEqual(actions[0].targetIntent.targetIds,['enemy-1']);});
for(const id of [0xa1,0x88])test(`reaction ${id} cannot choose invalid or invisible targets`,()=>{
 const i=input(id);i.enemy.forEach(e=>e.initialStatuses={invisibility:true});const root=rootPlanInfo(i);assert.equal(root.count,0);
 const r=run(i.player,i.enemy,{actionPolicy:undefined});assert.equal(r.actions.find(a=>a.actorId==='player-0').reason,'no-legal-technique');
 const s=rootPlanInfo(input(id)).state;for(const targetIds of [['unknown'],['player-0'],['enemy-0','enemy-1'],[]])assert.throws(()=>planAction(s,s.combatants[0],{kind:'skill',skillKey:s.combatants[0].skills[0].key,targetIntent:{kind:'combatants',targetIds}}),/not a legal Player choice/);
});
for(const id of [0x83,0x87,0x88])for(const activated of [false,true])test(`battle impacts ${id} ${activated?'activated AoE':'original Single'} use per-recipient arithmetic`,()=>{
 const i=input(id);i.player[0].customStats.atk=23;i.enemy=i.enemy.map((e,j)=>unit(e.digimon.name,activated?6:0xc1,{stats:{def:[19,27,31][j],spd:80-j*20}}));
 const trace=createPlayerDecisionTrace(),r=run(i.player,i.enemy,{playerDecisions:pick('enemy-2'),playerDecisionObserver:trace.observer,simulationRules:{accuracyMode:'strategy'}}),a=r.actions.find(a=>a.actorId==='player-0');
 assert.equal(a.counter.executionMode,activated?'activated':'untriggered-end-of-turn');assert.deepEqual(a.effectiveTargetIds,activated?['enemy-0','enemy-1','enemy-2']:['enemy-2']);assert.deepEqual(trace.trace[0].orders[0].targetIntent.targetIds,['enemy-2']);
 const ap={131:20,135:30,136:40}[id];for(const impact of a.impacts){const index=Number(impact.targetId.slice(-1)),base=Math.floor(ap*23/[19,27,31][index]),expected=activated&&id===0x88?Math.floor(base*3/2):base;assert.equal(impact.baseDamage,expected);assert.equal(impact.damage,expected);assert.equal(impact.hpBefore-impact.hpAfter,expected);}
});
test('activated Counter trace retains intention while concrete display uses all recipients',()=>{
 const i=input(0x88),trace=createPlayerDecisionTrace(),r=run(i.player,i.enemy,{playerDecisions:pick('enemy-2'),playerDecisionObserver:trace.observer,simulationRules:{accuracyMode:'strategy'}}),o=trace.trace[0].orders[0],a=r.actions.find(a=>a.actorId==='player-0');
 assert.equal(a.counter.executionMode,'activated');assert.deepEqual(o.targetIntent.targetIds,['enemy-2']);assert.deepEqual(a.targetIntent.targetIds,['enemy-2']);assert.equal(a.effectiveTargetIds.length,3);assert.equal(resolvedOrderTarget(o,1,r.actions,labels(r.state)).label,'E0 · Enemy 1, E1 · Enemy 2, E2 · Enemy 3');assert.equal(intendedTarget(o,labels(r.state)),'E2 · Enemy 3');
});
for(const id of [0xbc,0xb7,0xc8,0xc1,0xba,0xd2])test(`Assist ${id} retains policy and concrete recipient presentation`,()=>{
 const p=unit('Support',id),ally=unit('Recipient',6,{currentHp:id===0xb7||id===0xd2?0:10,initialStatuses:{poison:true}}),i={player:[p,ally],enemy:[unit('E',6,{stats:{spd:10}})],floorSpecialty:'None'},trace=createPlayerDecisionTrace();
 const root=rootPlanInfo(i),orders=enumerateLegalPlayerOrders(root.state,root.state.combatants[0]);assert.equal(orders.length,1);assert.equal(orders[0].targetIntent,undefined);
 const r=run(i.player,i.enemy,{playerDecisionObserver:trace.observer}),o=trace.trace[0].orders[0],a=r.actions.find(a=>a.actorId==='player-0');assert.equal(a.state,'resolved');assert.ok(a.effectiveTargetIds.length);assert.equal(resolvedOrderTarget(o,1,r.actions,labels(r.state)).label,a.effectiveTargetIds.map(id=>{const t=labels(r.state).find(x=>x.id===id);return `${t.name} · ${t.side==='player'?'Player':'Enemy'} ${t.slot}`;}).join(', '));assert.ok(['Engine policy','Self','Random target'].includes(intendedTarget(o,labels(r.state))));
});
test('unexecuted intentions cannot borrow another round or chain execution',()=>{
 const order={actorId:'player-0',targetIntent:{kind:'combatants',targetIds:['enemy-1']},targetLabel:'Selected'},team=[{id:'enemy-1',name:'Selected',side:'enemy',slot:2}];
 for(const actions of [[],[{actorId:'player-0',round:2,state:'resolved',effectiveTargetIds:['enemy-0']}],[{actorId:'player-0',round:1,state:'skipped',effectiveTargetIds:[]}],[{actorId:'player-0',round:1,state:'resolved',chainFromActionId:'original',effectiveTargetIds:['enemy-0']}]])assert.deepEqual(resolvedOrderTarget(order,1,actions,team),{label:'Selected · Enemy 2',executed:false});
});
test('search includes every explicit Interrupt target and retains replayable fastest intention',()=>{
 const i=input(0xa1,2);i.enemy.forEach(e=>e.currentHp=5);const search=createOptimizedSearch(i,80,{seed:42,maxRounds:5,config:{beamWidth:2,maxDepth:2},simulationRules:{accuracyMode:'strategy'}});while(!search.done)search.step();const r=search.result('completed',1).optimized;assert.equal(r.rootPlanCount,2);assert.ok(r.fastestRoute);assert.ok(r.fastestRoute.decisionTrace.every(p=>p.orders.every(o=>o.targetIntent.kind==='combatants')));assert.ok(r.fastestRoute.actions.filter(a=>a.kind==='interrupt'&&a.state==='resolved').every(a=>a.targetIntent.targetIds[0]===a.interrupt.targetActorId));
});
