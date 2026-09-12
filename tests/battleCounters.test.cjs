const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/loadTs.cjs');
const {member,tech}=require('./helpers/battleFixtures.cjs');
const {simulateBattleCore:simulate,aggregateBattleRuns,assessBattleSkill}=load('src/utils/battleEngine.ts');
const {getBattleSkillById}=load('src/data/battleSkills.ts');
const {createBattleState,linkLegacySkill}=load('src/utils/battle/battleInput.ts');
const {planAction}=load('src/utils/battle/battleActions.ts');
const {calculateActionOrder}=load('src/utils/battle/battleOrder.ts');
const {promoteCounters,canInterruptCounter,waitingTailBlade}=load('src/utils/battle/battleReactions.ts');
const {resolveEffectiveTargets}=load('src/utils/battle/battleTargets.ts');
const {calculateActionDamage}=load('src/utils/battle/battleDamage.ts');
const {resolveImpactStatuses}=load('src/utils/battle/battleStatuses.ts');
const {createSeededBattleRng,createSequenceBattleRng}=load('src/utils/battle/battleRng.ts');
const input=(player,enemy)=>({player,enemy,floorSpecialty:'None'});
function unit(name,id=0x8b,stats={},statuses={}) {
 const skill=getBattleSkillById(id);
 return {...member(name,[{...tech('Rock Fist'),id:`canonical-${id}`,name:skill.name,canonicalSkillId:id,ap:skill.attackPower,target:skill.targetGroup==='all-enemies'?'All':'Single'}],{hp:1000,mp:100,spd:20,...stats}),initialStatuses:statuses};
}
const first={chooseAction:a=>({kind:'skill',skillKey:a.skills[0].key})};
function rng(values={}) {
 const queues=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,[...v]])),draws=[];
 const nextIntExclusive=(max,category)=>{const value=queues[category]?.length?queues[category].shift():category==='tail-blade-evasion'?1:0;assert.ok(value>=0&&value<max);draws.push({category,value,max});return value;};
 return {draws,nextIntExclusive,nextIntInclusive:(min,max,c)=>min+nextIntExclusive(max-min+1,c),nextFloat:c=>nextIntExclusive(1000000,c)/1000000};
}
const run=(p,e,options={})=>simulate(input(p,e),{maxRounds:1,actionPolicy:first,rng:rng(),...options});
const done=r=>r.actions.filter(a=>a.state==='resolved');
const counters=r=>done(r).filter(a=>a.counter);
const attack=(name='A',stats={})=>unit(name,0x2,{spd:100,...stats}); // Pepper Breath
const aoe=(name='A',stats={})=>({...member(name,[tech('Triple Forces')],{hp:1000,mp:100,spd:100,...stats})});
function modeRun(id,mode,options={}) {
 if(mode==='untriggered-end-of-turn')return run([unit('C',id)],[unit('Other',0x8b)],options);
 return run([aoe(),attack('Unrelated',{spd:10})],mode==='activated'?[unit('C',id)]:[unit('Left',0x8b),unit('C',id)],options);
}
function prepare(p=[attack()],e=[unit('C')]) {
 const state=createBattleState(input(p,e));state.round=1;
 const actions=state.combatants.map(a=>planAction(state,a,first.chooseAction(a)));
 state.queue=calculateActionOrder(state,actions,rng());return {state,actions};
}
for(const mode of ['waiting','activated','shared-trigger-promoted','untriggered-end-of-turn','resolved'])test(`future Interrupt eligibility: ${mode}`,()=>assert.equal(canInterruptCounter({selected:true,executionMode:mode,activatedMechanics:mode==='activated'}),mode==='waiting'));
test('initial Counter intentions use canonical kind and party position, no SPD draw or insertion-order dependency',()=>{
 const {state,actions}=prepare([unit('P0',0x8b,{spd:1}),unit('P1',0x8b,{spd:900})],[unit('E0'),unit('E1')]);
 const random=rng();const order=calculateActionOrder(state,[actions[3],actions[1],actions[2],actions[0]],random);
 assert.deepEqual(order,actions.map(a=>a.id));assert.equal(random.draws.length,0);
 assert.ok(actions.every(a=>a.state==='waiting'&&a.counter.executionMode==='waiting'&&!a.counter.activatedMechanics&&a.initiative===null));
});
for(const count of [1,2,3])test(`${count} affected Counter intentions promoted once, left to right after all AOE impacts`,()=>{
 const random=rng();const r=run([aoe(),attack('Unrelated',{spd:10})],Array.from({length:count},(_,i)=>unit(`C${i}`,0x8a,{spd:20+i*100})),{rng:random});
 const rows=done(r),cause=rows[0],group=rows.slice(1,count+1);assert.equal(cause.impacts.length,count);
 assert.deepEqual(group.map(a=>a.actorId),Array.from({length:count},(_,i)=>`enemy-${i}`));
 group.forEach((a,i)=>{assert.equal(a.counter.executionMode,i?'shared-trigger-promoted':'activated');assert.equal(a.counter.activatedMechanics,i===0);assert.equal(a.counter.triggerActionId,cause.id);assert.equal(a.counter.triggerActorId,cause.actorId);assert.deepEqual(a.effectiveTargetIds,[cause.actorId]);assert.equal(a.counter.damageReceivedFromTrigger,cause.impacts[i].damage);assert.equal(a.durationFrames,685);assert.equal(a.accuracy.referenceTargetId,cause.actorId);assert.equal(r.state.plannedActions.filter(x=>x.actorId===a.actorId).length,1);assert.equal(r.actions.filter(x=>x.id===a.id).length,1);const runtime=r.state.plannedActions.find(x=>x.id===a.id).counter;assert.equal(runtime.executionMode,'resolved');assert.equal(runtime.activatedMechanics,false);assert.equal(canInterruptCounter(runtime),false);});
 assert.equal(random.draws.filter(d=>d.category==='target-choice').length,1); // unrelated ordinary attack only
 assert.equal(group[0].impacts[0].baseDamage,33);if(count>1)assert.equal(group[1].impacts[0].baseDamage,22);
});
for(const id of [0x82,0x83,0x85,0x86,0x87,0x88,0x89,0x8a,0x8b,0x8c,0xed,0xf2,0xf5])for(const mode of ['activated','shared-trigger-promoted','untriggered-end-of-turn'])test(`canonical 0x${id.toString(16)} ${mode} effects, targets, MP and measured timing`,()=>{
 const r=modeRun(id,mode),a=counters(r).find(a=>a.actorName==='C'),skill=getBattleSkillById(id);assert.ok(a);assert.equal(a.counter.executionMode,mode);
 const active=mode==='activated',forced=id===0xf2&&!active;
 assert.equal(a.counter.activatedMechanics,active);assert.equal(a.outcome,forced?'miss':'hit');
 assert.equal(a.mpAccounting.costCharged,forced?0:skill.mpCost);assert.equal(a.mpAccounting.paymentRule,forced?'none-on-miss':active&&id===0x89?'counter-triggering-actor':'own');
 if(forced){assert.equal(a.accuracy.cause,'counter-not-activated');assert.equal(a.accuracy.roll128,undefined);assert.deepEqual(a.impacts,[]);assert.equal(a.durationFrames,194);return;}
 const expanded=active&&skill.targetModes.includes('all-on-counter');assert.equal(a.effectiveTargetIds.length,expanded?2:1);assert.equal(a.durationFrames,expanded?873:685);
 if(mode!=='untriggered-end-of-turn'&&!expanded)assert.deepEqual(a.effectiveTargetIds,['player-0']);
 const conditional=skill.effects.filter(e=>e.kind==='status-application'&&e.condition==='counter-triggered');
 for(const impact of a.impacts){assert.equal(impact.statusApplications.length,active?conditional.length:0);for(const status of impact.statusApplications){assert.equal(status.condition,'counter-activated');assert.equal(status.roll,null);assert.equal(status.applied,true);}if(id===0x82)assert.equal(impact.poisonBonusDamage,active?10:0);}
});
for(const id of [0x82,0x8b,0x89,0xf2])for(const mode of ['activated','shared-trigger-promoted','untriggered-end-of-turn'])test(`Counter 0x${id.toString(16)} ${mode} accuracy Miss is free, no effects`,()=>{
 const random=rng({accuracy:mode==='untriggered-end-of-turn'?[127]:mode==='activated'?[0,127]:[0,0,127]});
 const r=modeRun(id,mode,{rng:random}),a=counters(r).find(a=>a.actorName==='C');assert.equal(a.outcome,'miss');assert.equal(a.durationFrames,194);assert.deepEqual(a.impacts,[]);assert.equal(a.mpAccounting.costCharged,0);assert.equal(a.mpAccounting.payerCombatantId,null);assert.deepEqual(a.resourceAlerts,[]);
});
test('untriggered Counters all execute after ordinary actions, even with higher SPD',()=>{
 const r=run([unit('C0',0x8b,{spd:999}),unit('C1',0x8b,{spd:1})],[attack() ],{rng:rng({accuracy:[127]})});assert.deepEqual(done(r).map(a=>a.actorName),['A','C0','C1']);assert.ok(counters(r).every(a=>a.counter.executionMode==='untriggered-end-of-turn'));
});
for(const kind of ['attack','counter','interrupt','assist'])for(const outcome of ['hit','miss'])for(const damage of [0,10])test(`source ${kind}, ${outcome}, final ${damage} activation eligibility`,()=>{
 const {state,actions}=prepare();const cause=actions[0];cause.kind=kind;
 const promoted=promoteCounters(state,cause,{outcome,impacts:[{targetId:'enemy-0',damage}]},new Set(['player-0']));
 assert.equal(promoted.length,kind==='attack'&&outcome==='hit'&&damage>0?1:0);
});
test('zero base damage plus Poison ten qualifies; zero damage plus on-hit DEF effect does not',()=>{
 for(const poison of [false,true]){const p=attack();p.techs=[{...tech('Scissor Claw'),ap:0}];const r=run([p],[unit('C',0x8b,{},poison?{poison:true}:{})]);const a=done(r)[0];assert.equal(a.impacts[0].baseDamage,0);assert.equal(a.impacts[0].damage,poison?10:0);assert.equal(a.impacts[0].appliedEffects[0].kind,'parameter-modifier');assert.equal(counters(r)[0].counter.executionMode,poison?'activated':'untriggered-end-of-turn');}
});
test('causal Single target overrides unrelated explicit planned target without RNG',()=>{
 const {state,actions}=prepare([attack('Cause'),attack('Other')]);const c=actions[2];c.targetIntent={kind:'combatants',targetIds:['player-1']};promoteCounters(state,actions[0],{outcome:'hit',impacts:[{targetId:'enemy-0',damage:13}]},new Set());assert.deepEqual(resolveEffectiveTargets(state,c,createSequenceBattleRng([])),['player-0']);state.combatants[0].isAlive=false;assert.deepEqual(resolveEffectiveTargets(state,c,createSequenceBattleRng([])),[]);
});
test('returned damage uses the exact causal 13, floors 19.5, ignores unrelated last damage',()=>{
 const {state,actions}=prepare();const a=actions[1];promoteCounters(state,actions[0],{outcome:'hit',impacts:[{targetId:'enemy-0',damage:13}]},new Set());state.combatants[1].legacy.damageTakenThisTurn=999;assert.equal(calculateActionDamage(state.combatants[1],state.combatants[0],a,'None'),19);
});
for(const id of [0x86,0x8a])test(`0x${id.toString(16)} output multiplier floors base formula BEFORE multiplication`,()=>{
 const {state,actions}=prepare([attack('A',{def:7})],[unit('C',id,{atk:11})]);const a=actions[1];const base=calculateActionDamage(state.combatants[1],state.combatants[0],a,'None');promoteCounters(state,actions[0],{outcome:'hit',impacts:[{targetId:'enemy-0',damage:3}]},new Set());assert.equal(calculateActionDamage(state.combatants[1],state.combatants[0],a,'None'),Math.floor(base*1.5));
});
for(const roll of [0,1,2])for(const aoeAttack of [false,true])test(`Tail Blade sole target ${aoeAttack?'AOE':'Single'} separate evasion roll ${roll}`,()=>{
 const random=rng({'tail-blade-evasion':[roll]});const r=run([aoeAttack?aoe():attack()],[unit('Tail',0x85)],{rng:random});const a=done(r)[0];assert.equal(a.accuracy.tailBladeRoll,roll);assert.equal(a.outcome,roll===0?'miss':'hit');assert.equal(a.accuracy.cause,roll===0?'tail-blade-evasion':'normal-accuracy');assert.equal(counters(r)[0].counter.executionMode,roll===0?'untriggered-end-of-turn':'activated');assert.equal(random.draws.filter(d=>d.category==='tail-blade-evasion').length,1);assert.equal(random.draws.filter(d=>d.category==='accuracy').length,roll===0?1:2);if(!roll){assert.equal(a.durationFrames,194);assert.equal(a.mpAccounting.costCharged,0);}
});
for(const count of [2,3])test(`Tail Blade AOE ${count} targets omits evasion, uses mean SPD`,()=>{
 const random=rng({'tail-blade-evasion':[0]});const r=run([aoe()],Array.from({length:count},(_,i)=>unit(`C${i}`,i===1?0x85:0x8b,{spd:20+i*10})),{rng:random});assert.equal(random.draws.filter(d=>d.category==='tail-blade-evasion').length,0);assert.equal(done(r)[0].accuracy.targetEffectiveSpd,count===2?25:30);assert.equal(counters(r)[1].counter.executionMode,'shared-trigger-promoted');
});
for(const shared of [false,true])test(`Tail Blade ${shared?'shared promotion':'activation'} consumes defensive window before subsequent attack`,()=>{
 const {state,actions}=prepare([attack(),attack('Later')],shared?[unit('Left'),unit('Tail',0x85)]:[unit('Tail',0x85)]);const id=shared?'enemy-1':'enemy-0';assert.equal(waitingTailBlade(state,id),true);promoteCounters(state,actions[0],{outcome:'hit',impacts:state.combatants.filter(a=>a.side==='enemy').map(a=>({targetId:a.id,damage:10}))},new Set());assert.equal(waitingTailBlade(state,id),false);
 const random=rng();const r=run([shared?aoe():attack(),attack('Later',{spd:90})],shared?[unit('Left'),unit('Tail',0x85)]:[unit('Tail',0x85)],{rng:random});assert.equal(random.draws.filter(d=>d.category==='tail-blade-evasion').length,shared?0:1);assert.equal(done(r).find(a=>a.actorName==='Later').accuracy.tailBladeRoll,undefined);
});
test('Tail Blade numeric identity survives rename; borrowed display name gets no exception',()=>{
 const renamed=unit('C',0x85);renamed.techs[0].name='Renamed';assert.equal(done(run([attack()],[renamed],{rng:rng({'tail-blade-evasion':[0]})}))[0].accuracy.cause,'tail-blade-evasion');
 const borrowed=unit('C');borrowed.techs[0]={...tech('Rock Fist'),id:'fake-tail',name:'Tail Blade',isCounter:true};assert.equal(linkLegacySkill(borrowed.techs[0]).canonicalSkillId,null);assert.equal(done(run([attack()],[borrowed]))[0].accuracy.tailBladeRoll,undefined);
});
test('Paralysis failure precedes Tail Blade and skips both evasion and accuracy',()=>{
 const a=attack();a.initialStatuses={paralysis:true};const random=rng({'status-recovery-paralysis':[3],'paralysis-failure':[1]});const r=run([a],[unit('Tail',0x85)],{rng:random});assert.equal(done(r)[0].accuracy.cause,'paralysis');assert.ok(!random.draws.some(d=>d.category==='tail-blade-evasion'));assert.equal(counters(r)[0].counter.executionMode,'untriggered-end-of-turn');
});
for(const mode of ['activated','shared-trigger-promoted','untriggered-end-of-turn'])for(const recover of [false,true])test(`${mode} Counter recovers Paralysis only at execution; ${recover?'recovers':'fails'}`,()=>{
 const c=unit('C',0x8b,{}, {paralysis:true}),random=rng({'status-recovery-paralysis':[recover?0:3],'paralysis-failure':[1]});
 const r=mode==='untriggered-end-of-turn'?run([c],[unit('Other')],{rng:random}):run([aoe()],mode==='activated'?[c]:[unit('Left'),c],{rng:random});const a=counters(r).find(a=>a.actorName==='C');assert.equal(a.counter.executionMode,mode);assert.equal(a.statusRecoveries.length,1);assert.equal(a.outcome,recover?'hit':'miss');assert.equal(random.draws.filter(d=>d.category==='status-recovery-paralysis').length,1);assert.equal(a.mpAccounting.costCharged,recover?12:0);
});
for(const [skill,status] of [['Stun Flame Shot','paralysis'],['Evil Charm','confusion']])test(`same-action ${status} becomes visible before promoted Counter recovery`,()=>{
 const p=attack();p.techs=[tech(skill)];const r=run([p],[unit('C',0x8b)],{rng:rng({[`status-recovery-${status}`]:[3],'paralysis-failure':[1]})});const a=r.actions.find(a=>a.actorName==='C');assert.equal(a.counter.executionMode,'activated');assert.equal(a.statusesBefore[status],true);assert.equal(a.statusRecoveries[0].status,status);
});
for(const recovered of [false,true])test(`Confusion on Counter ${recovered?'recovers':'replaces with ordinary attack and removes activated effects'}`,()=>{
 const c=unit('C',0x82,{}, {confusion:true});c.techs.push(tech('Pepper Breath'));const r=run([attack()],[c],{rng:rng({'status-recovery-confusion':[recovered?0:3]})});const a=done(r)[1];assert.equal(a.kind,recovered?'counter':'attack');assert.equal(a.counter.activatedMechanics,recovered);assert.equal(!!a.counter.replacedByConfusion,!recovered);assert.equal(a.impacts[0].statusApplications.length,recovered?1:0);if(!recovered)assert.deepEqual(a.effectiveTargetIds,['enemy-0']);
});
for(const count of [1,3])test(`Confused friendly ${count===1?'Single':'AOE'} activates same-side Counters with actual attacker causality`,()=>{
 const p=count===1?attack():aoe();p.initialStatuses={confusion:true};const random=rng({'status-recovery-confusion':[3],'confusion-target':[1]});const r=run([p,...Array.from({length:count},(_,i)=>unit(`C${i}`))],[unit('Enemy')],{rng:random});const group=counters(r).filter(a=>a.actorId.startsWith('player'));assert.equal(group.length,count);group.forEach((a,i)=>{assert.equal(a.counter.executionMode,i?'shared-trigger-promoted':'activated');assert.equal(a.counter.triggerActorId,'player-0');assert.deepEqual(a.effectiveTargetIds,['player-0']);assert.equal(a.durationFrames,685);});
});
test('KO enemy excluded before leftmost activation; zero-HP player remains eligible',()=>{
 const r=run([aoe()],[unit('KO',0x8b,{hp:1}),unit('Survivor')]);assert.equal(counters(r).length,1);assert.equal(counters(r)[0].actorName,'Survivor');assert.equal(counters(r)[0].counter.executionMode,'activated');
 const p=run([unit('Zero',0x8b,{hp:1})],[attack()]);assert.equal(done(p)[0].resourceAlerts[0].kind,'player-hp-depleted');assert.equal(counters(p)[0].counter.executionMode,'activated');assert.equal(p.state.combatants[0].currentHp,0);
});
for(const mode of ['activated','shared-trigger-promoted','untriggered-end-of-turn'])test(`${mode} Pummel payment clamps, insufficient MP never blocks`,()=>{
 const r=mode==='untriggered-end-of-turn'?run([unit('C',0x89,{mp:1})],[unit('Other')]):run([aoe('A',{mp:1})],mode==='activated'?[unit('C',0x89,{mp:1})]:[unit('Left'),unit('C',0x89,{mp:1})]);const a=counters(r).find(a=>a.actorName==='C');assert.equal(a.outcome,'hit');assert.equal(a.mpAccounting.after,0);assert.equal(a.mpAccounting.payerCombatantId,mode==='activated'?'player-0':a.actorId);assert.equal(r.state.combatants.find(c=>c.id===a.actorId).currentMp,mode==='activated'?1:0);
});
test('Miss does not cause player MP depletion; subsequent Hit does',()=>{
 const random=rng({accuracy:[127,0]});const r=run([attack('A',{mp:1})],[unit('C')],{rng:random});assert.equal(done(r)[0].mpAccounting.costCharged,0);assert.ok(!done(r)[0].resourceAlerts.some(a=>a.kind==='player-mp-depleted'));assert.equal(r.state.combatants[0].currentMp,1);
 const hit=run([attack('A',{mp:1})],[unit('C')]);assert.ok(done(hit)[0].resourceAlerts.some(a=>a.kind==='player-mp-depleted'));
});
test('base AOE is retained for shared Thunder Ball, random target descriptor stays explicitly unresolved',()=>{
 const r=modeRun(0x84,'shared-trigger-promoted'),a=counters(r).find(a=>a.actorName==='C');assert.equal(a.effectiveTargetIds.length,2);assert.equal(a.counter.targetRule,'base-aoe');assert.equal(a.durationFrames,null);assert.equal(assessBattleSkill(linkLegacySkill(unit('C',0x84).techs[0])).level,'future-mechanic-unsupported');
});
test('Shadow Scythe repeat triggers surviving Counter with independent chain and reaction IDs',()=>{
 const p=attack();p.techs=[tech('Shadow Scythe')];const r=run([p],[attack('KO',{hp:1,spd:10}),unit('C')]);const rows=done(r);assert.equal(rows[1].chainFromActionId,rows[0].id);assert.equal(rows[1].mpAccounting.costCharged,0);assert.equal(rows[2].counter.triggerActionId,rows[1].id);assert.equal(rows[2].chainFromActionId,null);assert.equal(rows[2].counter.executionMode,'activated');
});
test('activated AOE Counter cannot promote waiting Counters on its target side',()=>{
 const r=run([attack(),unit('Waiting')],[unit('AOE',0x88)]);const a=counters(r).find(a=>a.actorName==='Waiting');assert.equal(a.counter.executionMode,'untriggered-end-of-turn');assert.equal(a.reaction,null);
});
test('activated status is guaranteed without status RNG and direct status helper remains independent',()=>{
 const {state}=prepare();const s=linkLegacySkill(unit('C',0x82).techs[0]);const random=createSequenceBattleRng([]);const out=resolveImpactStatuses(state.combatants[0],s,0,random,true);assert.equal(out.damage,10);assert.equal(out.statusApplications[0].condition,'counter-activated');assert.equal(random.consumed,0);
});
test('deterministic Counter replay with seeded RNG and immutable caller input',()=>{
 const data=input([aoe()],[unit('C0',0x85),unit('C1',0x88),unit('C2',0x89)]),copy=structuredClone(data);const a=simulate(data,{rng:createSeededBattleRng(77)}),b=simulate(data,{rng:createSeededBattleRng(77)});assert.deepEqual(a,b);assert.deepEqual(data,copy);
});
test('Results renders activated/shared/untriggered, causal actor, conditional status, Tail Blade and payer',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{BattleResults}=load('src/components/BattleResults.tsx');
 const runs=[modeRun(0x82,'activated'),modeRun(0x89,'activated'),modeRun(0x8b,'shared-trigger-promoted'),modeRun(0x8b,'untriggered-end-of-turn'),run([attack()],[unit('Tail',0x85)],{rng:rng({'tail-blade-evasion':[0]})})];
 const result=aggregateBattleRuns([]);result.fastestBattleHistory=runs.flatMap(r=>r.actions);const html=renderToStaticMarkup(React.createElement(BattleResults,{results:result}));for(const text of ['Counter — Activated','Counter — Shared AOE follow-up','Counter — Untriggered','Triggered by A','Using non-activated skill effects','Miss — Tail Blade','Poison applied by activated Counter','Payer: A'])assert.ok(html.includes(text),text);
});

test('direct and activated conditional Poison coexist: direct draw first, boolean reapplication, only +10',()=>{
 const data=load('src/data/battleSkills.ts'),original=data.getBattleSkillById;
 // Synthetic descriptor combination exercises the shared resolver without changing the imported workbook.
 data.getBattleSkillById=id=>{const s=original(id);return id===0x82?{...s,effects:[{kind:'status-application',status:'poison',condition:'always',chancePercent:33,byte:25,mask:1},...s.effects]}:s;};
 try{const {state}=prepare(),skill=linkLegacySkill(unit('C',0x82).techs[0]),random=createSequenceBattleRng([0]);const out=resolveImpactStatuses(state.combatants[0],skill,20,random,true);assert.equal(out.damage,30);assert.equal(out.statusApplications.length,2);assert.equal(out.statusApplications[0].roll,0);assert.equal(out.statusApplications[1].alreadyActive,true);assert.equal(out.statusApplications[1].condition,'counter-activated');assert.equal(random.consumed,1);}finally{data.getBattleSkillById=original;}
});
for(const count of [1,2,3])test(`activated AOE Counter ${count} effective opponents: single mean-SPD roll and measured timing`,()=>{
 const players=[attack('Trigger',{spd:100}),...Array.from({length:count-1},(_,i)=>attack(`P${i}`,{spd:10+i*10,hp:i===0?0:1000}))],random=rng();const r=run(players,[unit('C',0x88)],{rng:random}),a=counters(r)[0];
 assert.equal(a.effectiveTargetIds.length,count);assert.equal(a.durationFrames,[703,873,990][count-1]);assert.equal(a.accuracy.targetEffectiveSpd,players.reduce((sum,p)=>sum+p.customStats.spd/count,0));assert.equal(a.accuracy.referenceRule,count===1?'single-target':'average-effective-target-spd');assert.equal(random.draws.filter(d=>d.category==='accuracy').length,count+1);
});
test('Counter canonical AP and effects override contradictory compatibility hints',()=>{
 const c=unit('C',0x8a);c.techs[0].ap=999;c.techs[0].isCounter=false;c.techs[0].specialEffect={type:'counterApMultiplierAndTargetAll',value:999};const r=run([attack(),attack('Other',{spd:10})],[c]),a=counters(r)[0];assert.equal(a.impacts.length,1);assert.equal(a.impacts[0].baseDamage,33);assert.equal(a.kind,'counter');
});
test('Counter conditional ailments never consume direct-status RNG in any execution mode',()=>{
 for(const id of [0x82,0xed,0x8c])for(const mode of ['activated','shared-trigger-promoted','untriggered-end-of-turn']){const random=rng();modeRun(id,mode,{rng:random});assert.ok(!random.draws.some(d=>d.category.startsWith('status-apply-')));}
});
test('shared GAIA forced Miss consumes no accuracy draw and remains causally targeted',()=>{
 const random=rng();const r=modeRun(0xf2,'shared-trigger-promoted',{rng:random}),a=counters(r).find(a=>a.actorName==='C');assert.deepEqual(a.effectiveTargetIds,['player-0']);assert.equal(random.draws.filter(d=>d.category==='accuracy').length,3);assert.equal(a.accuracy.cause,'counter-not-activated');assert.equal(a.counter.activatedMechanics,false);
});
test('Shadow Scythe initial Miss is free and never promotes; Counter cannot trigger a Counter in its repeat sequence',()=>{
 const p=attack();p.techs=[tech('Shadow Scythe')];const r=run([p],[unit('C')],{rng:rng({accuracy:[127]})});assert.equal(done(r)[0].mpAccounting.costCharged,0);assert.equal(counters(r)[0].counter.executionMode,'untriggered-end-of-turn');assert.ok(!r.actions.some(a=>a.chainFromActionId));
 const chain=run([p,unit('Waiting')],[attack('KO',{hp:1,spd:10}),unit('AOE',0x88)]);const waiting=counters(chain).find(a=>a.actorName==='Waiting');assert.equal(waiting.counter.executionMode,'untriggered-end-of-turn');assert.equal(waiting.counter.triggerActorId,undefined);
});
