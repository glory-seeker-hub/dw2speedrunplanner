const {test}=require('node:test'),assert=require('node:assert/strict');
const {unit,rng,run,first,data,load}=require('./helpers/battleSupportFixtures.cjs');
const {createBattleState}=load('src/utils/battle/battleInput.ts');
const {planAction}=load('src/utils/battle/battleActions.ts');
const {resolveEffectiveTargets}=load('src/utils/battle/battleTargets.ts');
const {promoteCounters}=load('src/utils/battle/battleReactions.ts');
const {playerTargetChoices}=load('src/utils/battle/battlePlayerTargets.ts');
const {rootPlanInfo,enumerateLegalPlayerOrders,enumeratePlayerRoundPlans,replayPlayerPrefix}=load('src/utils/battle/battleActionPlans.ts');
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const {createPlayerDecisionTrace}=load('src/utils/battle/battlePlayerDecisionTrace.ts');
const {resolvedOrderTarget}=load('src/utils/battle/battlePresentation.ts');
const input=()=>({player:[unit('Tsukaimon',0xcf,{stats:{spd:100}}),unit('Counter',0x8b)],enemy:[unit('E0',0xc1),unit('E1',0xc1)],floorSpecialty:'None'});
const counter=r=>r.actions.find(a=>a.actorName==='Counter');
const friendlyPolicy={chooseAction:a=>({...first.chooseAction(a),...(a.name==='Tsukaimon'?{targetIntent:{kind:'combatants',targetIds:['player-1']}}:{})})};
function prepared(){const state=createBattleState(input());state.round=1;const actor=state.combatants[1];const action=planAction(state,actor,{...first.chooseAction(actor),targetIntent:{kind:'combatants',targetIds:['enemy-0']}});Object.assign(action.counter,{executionMode:'activated',activatedMechanics:true,triggerActorId:'player-0'});return {state,action};}

// Canonical one-ally targeting includes self for Friendly Fire, verified in-game with BizHawk.
// This empirical observation concerns Friendly Fire; other one-ally techniques were not individually verified.
for(const side of ['player','enemy'])for(const recipient of [0,1])test(`explicit ${side} Friendly Fire damages ${recipient===0?'its own user':'another living ally'}`,()=>{
 const i=input();i.player[1]=unit('Ally',0xc1);if(side==='enemy')[i.player,i.enemy]=[i.enemy,i.player];
 const target=side+'-'+recipient,policy={chooseAction:a=>({...first.chooseAction(a),...(a.name==='Tsukaimon'?{targetIntent:{kind:'combatants',targetIds:[target]}}:{})})},random=rng();
 const r=run(i.player,i.enemy,{actionPolicy:policy,rng:random}),a=r.actions.find(a=>a.actorName==='Tsukaimon');
 assert.equal(a.canonicalSkillId,0xcf);assert.deepEqual(a.targetIntent.targetIds,[target]);assert.deepEqual(a.effectiveTargetIds,[target]);assert.equal(a.outcome,'hit');assert.equal(a.impacts.length,1);assert.equal(a.impacts[0].targetId,target);assert.ok(a.impacts[0].damage>0);assert.ok(a.impacts[0].hpAfter<a.impacts[0].hpBefore);assert.ok(!random.draws.some(d=>d.category==='target-choice'));
});

// Hook-only fixture: self-causality must obey the same eligibility rules as any other hit.
// Two simultaneous orders for one actor are not a normal simulated round.
function selfHitFixture(){
 const {state,action}=prepared(),actor=state.combatants[1];actor.skills.push(...createBattleState(input()).combatants[0].skills);
 const cause=planAction(state,actor,{kind:'skill',skillKey:actor.skills[1].key,targetIntent:{kind:'combatants',targetIds:[actor.id]}});
 action.counter={selected:true,executionMode:'waiting',activatedMechanics:false};action.state='waiting';state.queue=[action.id];actor.plannedActionId=action.id;
 assert.deepEqual(resolveEffectiveTargets(state,cause,rng()),[actor.id]);
 return {state,action,cause,entry:{outcome:'hit',impacts:[{targetId:actor.id,damage:10}]}};
}
for(const selection of [0,1])test(`eligible self-causal Friendly Fire hit promotes Counter against opponent ${selection}`,()=>{
 const {state,action,cause,entry}=selfHitFixture(),random=rng({'counter-friendly-trigger-target':[selection]});
 assert.deepEqual(promoteCounters(state,cause,entry,new Set()),[action]);assert.equal(action.counter.triggerActorId,action.actorId);assert.equal(action.counter.triggerActionId,cause.id);assert.equal(action.counter.damageReceivedFromTrigger,10);
 assert.deepEqual(resolveEffectiveTargets(state,action,random),['enemy-'+selection]);assert.equal(action.counter.targetRule,'friendly-trigger-random-opponent');assert.deepEqual(random.draws,[{category:'counter-friendly-trigger-target',value:selection,max:2}]);
});
test('self-damage cannot promote a Counter for an actor that already acted',()=>{
 const {state,action,cause,entry}=selfHitFixture();assert.deepEqual(promoteCounters(state,cause,entry,new Set([action.actorId])),[]);assert.equal(action.counter.executionMode,'waiting');
});
test('waiting Counter replaced by confused Friendly Fire can damage self without a second Counter action',()=>{
 const c=unit('Self counter',0x8b,{initialStatuses:{confusion:true}});c.techs.push(...unit('Friendly Fire',0xcf).techs);
 const random=rng({'confusion-target':[0]}),r=run([c,unit('Ally',0xc1)],[unit('Enemy',0xc1)],{rng:random}),actions=r.actions.filter(a=>a.actorName==='Self counter');
 assert.equal(actions.length,1);const a=actions[0];assert.equal(a.kind,'attack');assert.equal(a.canonicalSkillId,0xcf);assert.equal(a.counter.replacedByConfusion,true);assert.equal(a.counter.targetRule,'confusion-replacement');assert.deepEqual(a.effectiveTargetIds,['player-0']);assert.ok(a.impacts[0].damage>0);assert.equal(a.counter.triggerActorId,undefined);assert.ok(!random.draws.some(d=>d.category==='counter-friendly-trigger-target'));
});

test('Friendly Fire preserves canonical metadata and status cure',()=>{
 const s=data.getBattleSkillById(0xcf);assert.equal(s.provenance.bytes[2],0x10);assert.equal(s.actionKind,'attack');assert.equal(s.animationKind,'projectile');assert.equal(s.targetGroup,'one-ally');
 assert.equal(s.attackPower,17.5);assert.equal(s.mpCost,4);assert.equal(s.element,'Fire');assert.ok(s.effects.some(e=>e.kind==='status-cure'&&e.status==='confusion'));
 const i=input();i.player[1].initialStatuses={confusion:true};const r=run(i.player,i.enemy,{actionPolicy:friendlyPolicy});assert.equal(counter(r).confusion.active,false);assert.equal(counter(r).counter.executionMode,'activated');assert.equal(r.state.combatants[1].statuses.confusion,undefined);
});
for(const selection of [0,1])test(`Friendly Fire activates allied Counter and dedicated RNG selects enemy ${selection}`,()=>{
 const i=input(),random=rng({'counter-friendly-trigger-target':[selection]}),r=run(i.player,i.enemy,{actionPolicy:friendlyPolicy,rng:random}),c=counter(r),f=r.actions.find(a=>a.actorName==='Tsukaimon');
 assert.deepEqual(f.effectiveTargetIds,['player-1']);assert.ok(f.impacts[0].damage>0);assert.equal(c.counter.executionMode,'activated');assert.equal(c.counter.triggerActorId,'player-0');assert.equal(c.counter.targetRule,'friendly-trigger-random-opponent');assert.deepEqual(c.effectiveTargetIds,['enemy-'+selection]);assert.deepEqual(c.impacts.map(t=>t.targetId),c.effectiveTargetIds);
 assert.deepEqual(random.draws.filter(d=>d.category==='counter-friendly-trigger-target'),[{category:'counter-friendly-trigger-target',value:selection,max:2}]);
});
for(const selection of [0,1])test(`Confused ally activates normal Counter against enemy ${selection}`,()=>{
 const i=input();i.player[0]=unit('Confused',2,{stats:{spd:100},initialStatuses:{confusion:true}});const r=run(i.player,i.enemy,{rng:rng({'confusion-target':[1],'counter-friendly-trigger-target':[selection]})}),c=counter(r);
 assert.equal(r.actions[0].confusion.redirected,true);assert.equal(c.counter.triggerActorId,'player-0');assert.deepEqual(c.effectiveTargetIds,['enemy-'+selection]);assert.equal(c.counter.targetRule,'friendly-trigger-random-opponent');
});
test('enemy causal attacker overrides preselection without RNG and remains lost on KO',()=>{
 const {state,action}=prepared(),random=rng();action.counter.triggerActorId='enemy-1';assert.deepEqual(resolveEffectiveTargets(state,action,random),['enemy-1']);assert.equal(action.counter.targetRule,'causal-attacker');state.combatants[3].isAlive=false;assert.deepEqual(resolveEffectiveTargets(state,action,random),[]);assert.equal(random.draws.length,0);
});
test('friendly trigger overrides preselection using execution-time living opponents, even after causal ally KO',()=>{
 const {state,action}=prepared(),random=rng();state.combatants[0].isAlive=false;state.combatants[2].isAlive=false;assert.deepEqual(resolveEffectiveTargets(state,action,random),['enemy-1']);assert.equal(random.draws.length,0);state.combatants[3].isAlive=false;assert.deepEqual(resolveEffectiveTargets(state,action,random),[]);assert.equal(random.draws.length,0);
});
for(const id of [0x88,0x83])test(`friendly-trigger AoE Counter ${id} attacks every opponent without target draw`,()=>{
 const i=input();i.player[1]=unit('Counter',id);const random=rng(),r=run(i.player,i.enemy,{actionPolicy:friendlyPolicy,rng:random}),c=counter(r);assert.equal(c.counter.triggerActorId,'player-0');assert.deepEqual(c.effectiveTargetIds,['enemy-0','enemy-1']);assert.ok(!random.draws.some(d=>d.category==='counter-friendly-trigger-target'));
});
test('confused Counter replacement remains authoritative after same-side activation',()=>{
 const i=input();i.player[0]=unit('Confused trigger',2,{stats:{spd:100},initialStatuses:{confusion:true}});i.player[1].initialStatuses={confusion:true};i.player[1].techs.push(...unit('Replacement',2).techs);
 const random=rng({'confusion-target':[1,0]}),r=run(i.player,i.enemy,{rng:random}),c=counter(r);assert.equal(c.counter.triggerActorId,'player-0');assert.equal(c.counter.replacedByConfusion,true);assert.equal(c.counter.targetRule,'confusion-replacement');assert.equal(c.kind,'attack');assert.deepEqual(c.effectiveTargetIds,['player-0']);assert.ok(!random.draws.some(d=>d.category==='counter-friendly-trigger-target'));
});
test('Player choices include living own-side recipients including invisible allies and self',()=>{
 const i=input();i.player.push(unit('Other ally',0xc1));const state=createBattleState(i),actor=state.combatants[0];state.round=1;state.combatants[1].statuses.invisibility=true;
 const choices=()=>playerTargetChoices(state.combatants,actor,actor.skills[0]).map(t=>t.intent.targetIds[0]);
 assert.deepEqual(choices(),['player-0','player-1','player-2']);assert.deepEqual(enumerateLegalPlayerOrders(state,actor).map(o=>o.targetIntent.targetIds[0]).sort(),choices());
 state.combatants[2].isAlive=false;assert.deepEqual(choices(),['player-0','player-1']);state.combatants[1].isAlive=false;assert.deepEqual(choices(),['player-0']);
});
for(const side of ['player','enemy'])for(const selection of [0,1])test(`Random Simulation ${side} Friendly Fire chooses own-side recipient ${selection}`,()=>{
 const i=input();if(side==='enemy')[i.player,i.enemy]=[i.enemy,i.player];const random=rng({'target-choice':[selection]}),trace=createPlayerDecisionTrace(),r=run(i.player,i.enemy,{rng:random,actionPolicy:undefined,playerDecisionObserver:trace.observer}),a=r.actions.find(a=>a.actorName==='Tsukaimon');
 assert.deepEqual(a.effectiveTargetIds,[side+'-'+selection]);assert.deepEqual(a.impacts.map(t=>t.targetId),a.effectiveTargetIds);assert.ok(random.draws.some(d=>d.category==='target-choice'&&d.max===2));
 if(side==='player')assert.deepEqual(trace.trace[0].orders.find(o=>o.actorId==='player-0').targetIntent.targetIds,a.effectiveTargetIds);
});
test('explicit opposing-side Friendly Fire target cannot receive an impact',()=>{
 for(const side of ['player','enemy']){const i=input();if(side==='enemy')[i.player,i.enemy]=[i.enemy,i.player];const opposite=side==='player'?'enemy':'player',target=opposite+'-0';
 const policy={chooseAction:a=>({...first.chooseAction(a),...(a.name==='Tsukaimon'?{targetIntent:{kind:'combatants',targetIds:[target]}}:{})})},r=run(i.player,i.enemy,{actionPolicy:policy}),a=r.actions.find(a=>a.actorName==='Tsukaimon');
 assert.deepEqual(a.effectiveTargetIds,[]);assert.deepEqual(a.impacts,[]);assert.equal(a.state,'skipped');assert.equal(a.reason,'no-living-targets');}
});
test('ordinary one-enemy attacks preserve opponent choices and engine policy',()=>{
 const i=input();i.player[0]=unit('Ordinary',2);const state=createBattleState(i),actor=state.combatants[0];assert.deepEqual(playerTargetChoices(state.combatants,actor,actor.skills[0]).map(t=>t.intent.targetIds[0]),['enemy-0','enemy-1']);const a=planAction(state,actor,first.chooseAction(actor));assert.deepEqual(resolveEffectiveTargets(state,a,rng({'target-choice':[1]})),['enemy-1']);
});
test('own-side Attack targeting follows metadata even under a different ID and name',()=>{
 const original=data.getBattleSkillById;data.getBattleSkillById=id=>id===2?{...original(id),targetGroup:'one-ally',name:'Metadata fixture'}:original(id);
 try{const i=input();i.player[0]=unit('Other',2);const state=createBattleState(i),actor=state.combatants[0];assert.equal(playerTargetChoices(state.combatants,actor,actor.skills[0]).length,2);const a=planAction(state,actor,first.chooseAction(actor));assert.equal(a.targetIntent.side,'player');assert.deepEqual(resolveEffectiveTargets(state,a,rng({'target-choice':[1]})),['player-1']);}finally{data.getBattleSkillById=original;}
});
test('root enumeration, retained decisions, replay and report keep each Friendly Fire recipient',()=>{
 const i=input(),root=rootPlanInfo(i),orders=enumerateLegalPlayerOrders(root.state,root.state.combatants[0]);assert.deepEqual(orders.map(o=>o.targetIntent.targetIds[0]).sort(),['player-0','player-1']);assert.equal(root.count,4);
 for(const target of ['player-0','player-1'])for(const seed of [0,42]){const plan=[...enumeratePlayerRoundPlans(root.state)].find(p=>p.orders[0].targetIntent.targetIds[0]===target),replay=replayPlayerPrefix(i,[plan],seed,{maxRounds:1,simulationRules:{accuracyMode:'strategy'}},false,true);assert.equal(replay.diverged,false);const order=replay.decisionTrace[0].orders[0],a=replay.result.actions.find(a=>a.actorId==='player-0');assert.deepEqual(order.targetIntent.targetIds,[target]);assert.deepEqual(a.effectiveTargetIds,[target]);const labels=replay.result.state.combatants.map(a=>({...a,slot:a.position+1}));assert.equal(resolvedOrderTarget(order,1,replay.result.actions,labels).label,target==='player-0'?'Tsukaimon · Player 1':'Counter · Player 2');}
 const search=createOptimizedSearch(i,32,{seed:42,maxRounds:1,config:{beamWidth:2,maxDepth:1}});while(!search.done)search.step();assert.equal(search.result('completed',1).optimized.rootPlanCount,4);
});
