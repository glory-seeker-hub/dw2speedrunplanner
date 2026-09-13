const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/loadTs.cjs'),{member,tech}=require('./helpers/battleFixtures.cjs');
const {simulateBattleCore:simulate,aggregateBattleRuns,assessBattleSkill}=load('src/utils/battleEngine.ts');
const data=load('src/data/battleSkills.ts');
const {createBattleState,linkLegacySkill}=load('src/utils/battle/battleInput.ts');
const {planAction}=load('src/utils/battle/battleActions.ts');
const {calculateActionOrder}=load('src/utils/battle/battleOrder.ts');
const {potentiallyInterruptible,refreshPlayerReservations,reduceInterruptedDamage}=load('src/utils/battle/battleInterrupts.ts');
const {getStatusImmunity}=load('src/utils/battle/battleImmunity.ts');
const {calculateActionDamage}=load('src/utils/battle/battleDamage.ts');
const {createSeededBattleRng,createSequenceBattleRng}=load('src/utils/battle/battleRng.ts');
const input=(player,enemy)=>({player,enemy,floorSpecialty:'None'});
const first={chooseAction:a=>({kind:'skill',skillKey:a.skills[0].key})};
const unit=(name='A',skill='Rock Fist',stats={},statuses={})=>({...member(name,[tech(skill)],{hp:1000,mp:100,spd:40,...stats}),initialStatuses:statuses});
const I=(name='I',id=0xa1,stats={},statuses={})=>{const s=data.getBattleSkillById(id);return {...unit(name,'Rock Fist',{spd:20,...stats},statuses),techs:[{...tech('Rock Fist'),id:`id-${id}`,canonicalSkillId:id,name:s.name,ap:s.attackPower}]};};
function rng(values={}){const q=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,[...v]])),draws=[];
 const nextIntExclusive=(max,category)=>{const value=q[category]?.length?q[category].shift():category==='tail-blade-evasion'?1:0;assert.ok(Number.isInteger(value)&&value>=0&&value<max,`${category}: ${value}/${max}`);draws.push({category,value,max});return value;};
 return {draws,nextIntExclusive,nextIntInclusive:(min,max,c)=>min+nextIntExclusive(max-min+1,c),nextFloat:c=>nextIntExclusive(10000,c)/10000};}
const run=(p=[unit()],e=[I()],options={})=>simulate(input(p,e),{actionPolicy:first,rng:rng(),maxRounds:1,...options});
const executed=r=>r.actions.filter(a=>a.state==='resolved');
const ints=r=>executed(r).filter(a=>a.kind==='interrupt');
const target=r=>r.actions.find(a=>a.restart);
function prepare(p=[unit()],e=[I()]){const state=createBattleState(input(p,e));state.round=1;const actions=state.combatants.map(a=>planAction(state,a,first.chooseAction(a)));state.queue=calculateActionOrder(state,actions,rng());return {state,actions};}
function withEffects(effects,fn){const original=data.getBattleSkillById;data.getBattleSkillById=id=>{const s=original(id);return id===0xa1?{...s,effects:[...s.effects,...effects]}:s;};try{return fn();}finally{data.getBattleSkillById=original;}}
const statusEffect=(status,condition='always')=>({kind:'status-application',status,condition,chancePercent:condition==='always'?33:100,byte:25,mask:128});

test('Interrupt selection is waiting, outside SPD queue and has exactly one intention',()=>{const {state,actions}=prepare([unit()],[I('I',0xa1,{spd:999})]);assert.deepEqual(state.queue,[actions[0].id]);assert.equal(actions[1].state,'waiting');assert.equal(actions[1].interrupt.state,'waiting');assert.equal(actions[1].initiative,null);});
test('zero-AP Interrupt is selectable by production policy without synthetic fallback',()=>{const r=run([unit()],[I('I',0xa4)],{actionPolicy:undefined});assert.equal(ints(r).length,1);assert.equal(r.state.combatants[1].skills.length,1);assert.equal(ints(r)[0].canonicalSkillId,0xa4);});
for(const id of [0xa0,0xa1,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8])for(const miss of [false,true])test(`canonical Interrupt ${id} ${miss?'Miss':'Hit'} accounting, single target and timing`,()=>{
 const random=rng({accuracy:[0,miss?127:0,0]});const r=run([unit()],[I('I',id)],{rng:random}),a=ints(r)[0];assert.ok(a);assert.deepEqual(a.effectiveTargetIds,['player-0']);assert.equal(a.accuracy.referenceRule,'single-target');assert.equal(a.accuracy.targetEffectiveSpd,40);assert.equal(a.accuracy.hitThreshold128,116);assert.equal(a.outcome,miss?'miss':'hit');assert.equal(a.durationFrames,miss?194:null);assert.equal(a.mpAccounting.costCharged,miss?0:data.getBattleSkillById(id).mpCost);assert.equal(a.statusRecoveries.length,0);assert.equal(r.state.plannedActions.filter(a=>a.actorId==='enemy-0').length,1);assert.equal(r.state.plannedActions.find(a=>a.actorId==='enemy-0').interrupt.state,'resolved');if(miss){assert.deepEqual(a.impacts,[]);assert.ok(!random.draws.some(d=>['interrupt-delete-action','interrupt-force-miss'].includes(d.category)));assert.equal(target(r).interrupt.restarted,true);}else assert.equal(r.timingCompleteness,'incomplete');
});
for(const [scenario,p,e,values] of [
 ['accuracy',[unit()],[I()],{accuracy:[127]}],
 ['Paralysis',[unit('A','Rock Fist',{}, {paralysis:true})],[I()],{'status-recovery-paralysis':[3],'paralysis-failure':[1]}],
 ['AOE',[unit('A','Triple Forces')],[I(),unit('E')],{accuracy:[127]}],
 ['Tail Blade',[unit()],[unit('Tail','Tail Blade'),I()],{'tail-blade-evasion':[0]}],
])test(`initial ${scenario} Miss cannot consume an Interrupt`,()=>{const random=rng(values),r=run(p,e,{rng:random});assert.equal(executed(r)[0].outcome,'miss');assert.equal(ints(r).length,0);assert.ok(!random.draws.some(d=>d.category==='interrupt-user-choice'));const a=r.actions.find(a=>a.kind==='interrupt');assert.equal(a.reason,'interrupt-no-eligible-target');assert.equal(a.outcome,'skipped');assert.equal(a.mpAccounting,null);assert.equal(a.durationFrames,null);});
test('no Interrupt uses initial accuracy once, normal cost and damage unchanged',()=>{const random=rng();const r=run([unit()],[unit('E')],{rng:random});assert.equal(random.draws.filter(d=>d.category==='accuracy').length,2);assert.equal(executed(r)[0].mpAccounting.costCharged,8);assert.equal(executed(r)[0].impacts[0].damage,20);});
for(const interruptMiss of [false,true])for(const targetMiss of [false,true])test(`Interrupt ${interruptMiss?'Miss':'Hit'} restarts target to ${targetMiss?'Miss':'Hit'}, locks skill/target, pays only final result`,()=>{
 const random=rng({accuracy:[0,interruptMiss?127:0,targetMiss?127:0]});const r=run([unit()],[I()],{rng:random}),a=target(r);assert.equal(a.restart.initialAccuracyResolution.outcome,'hit');assert.equal(a.outcome,targetMiss?'miss':'hit');assert.equal(a.mpAccounting.costCharged,targetMiss?0:8);assert.deepEqual(a.effectiveTargetIds,['enemy-0']);assert.equal(a.skillName,'Rock Fist');assert.equal(random.draws.filter(d=>d.category==='accuracy').length,3);assert.equal(random.draws.filter(d=>d.category==='target-choice').length,1);assert.equal(r.actionCount,2);assert.equal(r.actions.length,2);assert.equal(a.interrupt.restarted,true);assert.ok(a.restart.targetLocked&&a.restart.skillLocked&&a.restart.recoverySuppressedOnRestart);assert.equal(a.interrupt.targetActionId,a.id);
});
for(const count of [2,3])for(let choice=0;choice<count;choice++)test(`${count} Enemy users choose executor ${choice}, next eligible action uses remaining pool`,()=>{
 const random=rng({'interrupt-user-choice':[choice]});const r=run([unit('First'),unit('Second','Rock Fist',{spd:30})],Array.from({length:count},(_,i)=>I(`I${i}`)),{rng:random});assert.equal(ints(r)[0].actorName,`I${choice}`);assert.deepEqual(ints(r).map(a=>a.interrupt.targetActorId),['player-0','player-1']);assert.equal(new Set(ints(r).map(a=>a.actorId)).size,2);assert.ok(!random.draws.some(d=>d.category==='interrupt-target-choice'));assert.equal(random.draws.filter(d=>d.category==='interrupt-user-choice').length,count===2?1:2);
});
test('single Interrupt executor consumes no executor-choice RNG',()=>{const random=rng();run([unit()],[I()],{rng:random});assert.ok(!random.draws.some(d=>d.category==='interrupt-user-choice'));});
test('Enemy first-attacker follows actual initiative and skips earlier Miss',()=>{
 const random=rng({accuracy:[127,0,0,0]});const r=run([unit('Slow','Rock Fist',{spd:30}),unit('Fast','Rock Fist',{spd:100})],[I()],{rng:random});assert.equal(executed(r)[0].actorName,'Fast');assert.equal(ints(r)[0].interrupt.targetActorId,'player-0');
});
for(const pick of [0,1,2])test(`Player action reservation chooses ${pick} independently of SPD`,()=>{
 const random=rng({'interrupt-target-choice':[pick]});const r=run([I()],[unit('E0','Rock Fist',{spd:60}),unit('E1'),unit('E2','Rock Fist',{spd:20})],{rng:random});assert.equal(ints(r)[0].interrupt.targetActorId,`enemy-${pick}`);assert.equal(ints(r)[0].interrupt.targetPolicy,'player-random');assert.equal(random.draws.filter(d=>d.category==='interrupt-target-choice').length,1);
});
test('two Player reservations without replacement, executor chosen at claim time',()=>{
 const random=rng({'interrupt-target-choice':[1,0],'interrupt-user-choice':[1]});const r=run([I('I0'),I('I1')],[unit('E0'),unit('E1','Rock Fist',{spd:30})],{rng:random});assert.equal(ints(r)[0].actorName,'I1');assert.deepEqual(ints(r).map(a=>a.interrupt.targetActorId),['enemy-0','enemy-1']);assert.equal(new Set(ints(r).map(a=>a.interrupt.targetActionId)).size,2);assert.equal(random.draws.filter(d=>d.category==='interrupt-user-choice').length,1);
});
test('reserved initial Miss releases reservation without consuming user and chooses remaining opportunity',()=>{
 const random=rng({'interrupt-target-choice':[0,0],accuracy:[127,0,0,0]});const r=run([I()],[unit('E0'),unit('E1','Rock Fist',{spd:30})],{rng:random});assert.equal(ints(r).length,1);assert.equal(ints(r)[0].interrupt.targetActorId,'enemy-1');assert.equal(random.draws.filter(d=>d.category==='interrupt-target-choice').length,2);
});
test('dead/promoted reservation invalidation preserves waiting executor and selects another action',()=>{
 for(const invalid of ['ko','activated','shared-trigger-promoted']){const {state,actions}=prepare([I()],[unit('Counter','Beast King Fist'),unit('E')]);const reserved=new Set([actions[1].id]);if(invalid==='ko')state.combatants[1].isAlive=false;else actions[1].counter.executionMode=invalid;const random=rng();refreshPlayerReservations(state,reserved,random);assert.deepEqual([...reserved],[actions[2].id]);assert.equal(actions[0].interrupt.state,'waiting');}
});
for(const status of ['paralysis','confusion'])test(`Interrupt user's ${status} remains; no recovery or Confusion behavior`,()=>{
 const random=rng({'paralysis-failure':[0]});const r=run([unit()],[I('I',0xa1,{}, {[status]:true})],{rng:random}),a=ints(r)[0];assert.equal(a.outcome,'hit');assert.equal(a.statusRecoveries.length,0);assert.equal(a.confusion.redirected,false);assert.equal(a.confusion.skipped,false);assert.equal(r.state.combatants[1].statuses[status],true);assert.ok(!random.draws.some(d=>d.category.startsWith('status-recovery')||d.category.startsWith('confusion-')));
});
test('Paralysed Interrupt fails without accuracy, effects or MP; target still restarts',()=>{const random=rng({'paralysis-failure':[1]});const r=run([unit()],[I('I',0xa4,{}, {paralysis:true})],{rng:random}),a=ints(r)[0];assert.equal(a.accuracy.cause,'paralysis');assert.equal(a.durationFrames,194);assert.equal(a.mpAccounting.costCharged,0);assert.equal(random.draws.filter(d=>d.category==='accuracy').length,2);assert.equal(target(r).interrupt.restarted,true);assert.ok(!random.draws.some(d=>d.category==='interrupt-delete-action'));});
for(const status of ['paralysis','confusion'])test(`target ${status} preparation occurs once, restart reuses finalized action`,()=>{
 const p=unit('A','Pepper Breath',{}, {[status]:true}),random=rng({[`status-recovery-${status}`]:[3],'paralysis-failure':[0,0]});const r=run([p],[I()],{rng:random}),a=target(r);assert.equal(a.statusRecoveries.length,1);assert.equal(random.draws.filter(d=>d.category===`status-recovery-${status}`).length,1);assert.equal(a.restart.recoverySuppressedOnRestart,true);if(status==='confusion'){assert.deepEqual(a.effectiveTargetIds,['player-0']);assert.equal(random.draws.filter(d=>d.category==='confusion-target').length,1);}
});
for(const roll of [0,1,2,3,4,5,6,7])test(`delete-action exact ${roll}/7; seven successes, final value restarts`,()=>{
 const random=rng({'interrupt-delete-action':[roll]});const r=run([unit()],[I('I',0xa4)],{rng:random}),a=target(r);assert.equal(a.interrupt.deleteActionRoll,roll);assert.equal(a.interrupt.cancelled,roll<7);assert.equal(random.draws.filter(d=>d.category==='accuracy').length,roll<7?2:3);assert.equal(a.state,roll<7?'cancelled':'resolved');if(roll<7){assert.equal(a.reason,'cancelled-by-interrupt');assert.equal(a.mpAccounting,null);assert.equal(a.durationFrames,null);assert.deepEqual(a.impacts,[]);assert.equal(r.actionCount,1);}
});
for(const boss of [false,true])test(`${boss?'Boss':'non-boss'} deletion immunity and no unnecessary RNG`,()=>{
 const p={...unit(),isBoss:boss},random=rng();const r=run([p],[I('I',0xa4)],{rng:random}),a=target(r);assert.equal(a.interrupt.cancelled,!boss);assert.equal(a.interrupt.deletionImmunity,boss?'boss':undefined);assert.equal(random.draws.filter(d=>d.category==='interrupt-delete-action').length,boss?0:1);assert.equal(a.interrupt.restarted,boss);
});
for(const roll of [0,1,2])test(`forced-Miss exact ${roll}/2 and restart short circuit`,()=>{
 const p=unit('A','Rock Fist',{}, {paralysis:true}),random=rng({'status-recovery-paralysis':[3],'paralysis-failure':[0,0],'interrupt-force-miss':[roll]});const r=run([p],[I('I',0xa3)],{rng:random}),a=target(r);assert.equal(a.interrupt.forceMiss,roll<2);assert.equal(a.outcome,roll<2?'miss':'hit');assert.equal(random.draws.filter(d=>d.category==='paralysis-failure').length,roll<2?1:2);assert.equal(random.draws.filter(d=>d.category==='accuracy').length,roll<2?2:3);if(roll<2){assert.equal(a.accuracy.cause,'interrupt-forced-miss');assert.equal(a.durationFrames,194);assert.equal(a.mpAccounting.costCharged,0);}
});
for(const [id,numerator] of [[0xa0,77],[0xa2,38]])for(const count of [1,2,3])test(`${numerator}/128 reduction shared by ${count} AOE impacts`,()=>{
 const r=run([unit('A','Triple Forces')],[I('I',id),...Array.from({length:count-1},(_,i)=>unit(`E${i}`))]),a=target(r);assert.equal(a.impacts.length,count);assert.deepEqual(a.interrupt.damageRetained,{numerator,denominator:128});for(const impact of a.impacts)assert.equal(impact.damage,Math.floor(impact.damageBeforeInterruptReduction*numerator/128));
});
for(const n of [38,77])for(const damage of [0,1,10,127,128,129,99999])test(`exact damage reduction ${damage} * ${n}/128`,()=>assert.equal(reduceInterruptedDamage(damage,{damageRetained:{numerator:n,denominator:128}}),Number(BigInt(damage)*BigInt(n)/128n)));
test('Interrupt Miss leaves outgoing damage unchanged',()=>{const r=run([unit()],[I('I',0xa2)],{rng:rng({accuracy:[0,127,0]})});assert.equal(target(r).impacts[0].damage,20);assert.equal(target(r).interrupt.damageRetained,undefined);});
test('send-last preserves original opportunity and restart after ordinary AND Counter actions',()=>{
 const random=rng({'interrupt-user-choice':[0]});const r=run([unit('Sent'),unit('Ordinary','Rock Fist',{spd:30}),unit('Counter','Beast King Fist')],[I('Last',0xa5),I('Other')],{rng:random}),rows=executed(r),sent=rows.find(a=>a.actorName==='Sent');assert.equal(rows.at(-1).id,sent.id);assert.equal(sent.interrupt.sentLast,true);assert.equal(sent.interrupt.restarted,true);assert.equal(sent.canonicalSkillId,linkLegacySkill(tech('Rock Fist')).canonicalSkillId);assert.deepEqual(sent.effectiveTargetIds,['enemy-0']);assert.equal(r.actions.filter(a=>a.id===sent.id).length,1);assert.equal(ints(r).filter(a=>a.interrupt.targetActionId===sent.id).length,1);assert.equal(sent.statusRecoveries.length,0);assert.ok(rows.findIndex(a=>a.actorName==='Counter')<rows.indexOf(sent));
});
for(const side of ['player','enemy'])test(`Shadow Scythe initial and repeat excluded from ${side} Interrupt targeting`,()=>{
 const random=rng();const shadow=unit('Shadow','Shadow Scythe',{atk:100,spd:100}),other=unit('Other','Rock Fist',{hp:1});const r=side==='enemy'?run([shadow],[other,I()],{rng:random}):run([other,I()],[shadow],{rng:random});assert.equal(ints(r).length,0);assert.ok(!random.draws.some(d=>d.category==='interrupt-target-choice'));assert.ok(r.actions.filter(a=>a.skillName==='Shadow Scythe').every(a=>!a.restart));
});
test('waiting Counter can be interrupted and never gains activated mechanics',()=>{const r=run([unit('C','Beast King Fist')],[I()]),a=target(r);assert.equal(a.kind,'counter');assert.equal(a.counter.executionMode,'untriggered-end-of-turn');assert.equal(a.counter.activatedMechanics,false);assert.equal(a.counter.triggerActorId,undefined);assert.equal(a.impacts[0].baseDamage,15);});
for(const mode of ['activated','shared-trigger-promoted','resolved'])test(`${mode} Counter statically excludes Interrupt`,()=>{const {state,actions}=prepare([unit('C','Beast King Fist')],[I()]);actions[0].counter.executionMode=mode;assert.equal(potentiallyInterruptible(state,actions[0]),false);});
for(const side of ['player','enemy'])test(`Interrupt KO ${side} target uses strategic HP policy`,()=>{
 const victim=unit('Victim','Rock Fist',{hp:1}),r=side==='player'?run([victim],[I()]):run([I()],[victim]);const a=target(r);assert.equal(ints(r).length,1);assert.equal(a.interrupt.restarted,side==='player');assert.equal(a.mpAccounting?.costCharged??0,side==='player'?8:0);if(side==='player')assert.equal(ints(r)[0].resourceAlerts[0].kind,'player-hp-depleted');else { assert.equal(a.state,'cancelled'); assert.equal(a.interrupt.cancellationReason,'actor-ko'); }
});
for(const status of ['poison','paralysis','confusion'])for(const miss of [false,true])test(`Interrupt ${miss?'Miss':'Hit'} applies ${status} immediately with current-action Confusion suppression`,()=>withEffects([statusEffect(status)],()=>{
 const random=rng({accuracy:[0,miss?127:0,0],'paralysis-failure':[1]});const r=run([unit('A','Twig Tap')],[I()],{rng:random}),a=target(r);assert.equal(!!r.state.combatants[0].statuses[status],!miss);assert.equal(a.skillName,'Twig Tap');assert.deepEqual(a.effectiveTargetIds,['enemy-0']);assert.equal(a.statusRecoveries.length,0);assert.equal(a.confusion.redirected,false);if(status==='paralysis'&&!miss)assert.equal(a.accuracy.cause,'paralysis');if(status==='confusion'&&!miss){assert.equal(a.interrupt.confusionSuppressedForActionId,a.id);assert.equal(a.restart.statusesAtRestart.confusion,true);assert.equal(r.state.combatants[0].confusionSuppressedForActionId,undefined);}if(miss)assert.ok(!random.draws.some(d=>d.category.startsWith('status-apply')));
}));
test('Interrupt-applied Confusion leaves current AOE aimed at prepared side, changes next turn',()=>withEffects([statusEffect('confusion')],()=>{
 const random=rng({'status-recovery-confusion':[3]});const r=run([unit('A','Triple Forces')],[I(),unit('E','Rock Fist',{spd:10})],{rng:random,maxRounds:2});const p=executed(r).filter(a=>a.actorName==='A');assert.deepEqual(p[0].effectiveTargetIds,['enemy-0','enemy-1']);assert.deepEqual(p[1].effectiveTargetIds,['player-0']);assert.equal(p[0].confusion.redirected,false);assert.equal(p[1].confusion.redirected,true);
}));
test('Interrupt conditional Paralysis guaranteed with typed audit and no probability roll',()=>withEffects([statusEffect('paralysis','interrupt-triggered')],()=>{
 const random=rng({'paralysis-failure':[1]}),r=run([unit()],[I()],{rng:random});const status=ints(r)[0].impacts[0].statusApplications[0];assert.equal(status.condition,'interrupt-hit');assert.equal(status.roll,null);assert.equal(status.applied,true);assert.equal(target(r).accuracy.cause,'paralysis');assert.ok(!random.draws.some(d=>d.category==='status-apply-paralysis'));
}));
for(const source of ['attack','counter','interrupt'])test(`Boss immune to ${source} Confusion with typed reason`,()=>{
 const boss={...unit('Boss'),isBoss:true};let r;
 if(source==='interrupt')r=withEffects([statusEffect('confusion')],()=>run([boss],[I()]));
 else if(source==='counter')r=run([boss],[unit('C','Buffalo Breath')]);
 else r=run([unit('A','Evil Charm',{spd:100})],[{...boss,customStats:{...boss.customStats,spd:20}}]);
 const a=r.actions.flatMap(a=>a.impacts).flatMap(i=>i.statusApplications).find(s=>s.status==='confusion');assert.equal(a.result,'immune');assert.equal(a.immunityReason,'boss');assert.equal(a.applied,false);assert.equal(r.state.combatants.find(a=>a.name==='Boss').statuses.confusion,undefined);
});
for(const status of ['poison','paralysis'])test(`Boss remains susceptible to Interrupt ${status}`,()=>withEffects([statusEffect(status)],()=>{const r=run([{...unit(),isBoss:true}],[I()]);assert.equal(ints(r)[0].impacts[0].statusApplications[0].applied,true);}));
for(const side of ['player','enemy'])for(const isBoss of [false,true])test(`${side} boss=${isBoss} Motivation Down immunity`,()=>{const state=createBattleState(input([{...unit(),isBoss}],[{...unit('E'),isBoss}]));assert.equal(getStatusImmunity(state.combatants.find(a=>a.side===side),'motivation-down'),side==='enemy'?'enemy':null);});
test('domain boss metadata drives encounter input; unknown zero-reward encounter remains non-boss',()=>{
 const {DOMAIN_GROUPS}=load('src/data/domainGroups.ts'),boss=DOMAIN_GROUPS.find(g=>g.isBoss),normal=DOMAIN_GROUPS.find(g=>!g.isBoss);
 for(const [id,expected] of [[boss.encounterId,true],[normal.encounterId,false],[999999,false]]){const e={id,xp:0,bits:0,digimons:[{slot:1,name:'Agumon',level:1,hp:100,mp:20,atk:20,def:20,spd:20,techs:['Rock Fist']}]};assert.equal(createBattleState(input([unit()],e)).combatants[1].isBoss,expected);}
});
test('explicit non-boss Coliseum fixture is susceptible to deletion and Confusion despite zero rewards',()=>withEffects([statusEffect('confusion')],()=>{const coliseum={...unit('Coliseum'),isBoss:false,xp:0,bits:0};const r=run([coliseum],[I()]);assert.equal(r.state.combatants[0].statuses.confusion,true);assert.equal(target(run([coliseum],[I('Delete',0xa4)])).interrupt.cancelled,true);}));
for(const miss of [false,true])test(`interrupted AOE final ${miss?'Miss':'Hit'} has exactly one restart accuracy`,()=>{const random=rng({accuracy:[0,0,miss?127:0,0]});const r=run([unit('A','Triple Forces')],[I(),unit('E','Rock Fist',{spd:20})],{rng:random}),a=target(r);assert.equal(a.impacts.length,miss?0:2);assert.equal(a.accuracy.referenceRule,'average-effective-target-spd');assert.deepEqual(a.effectiveTargetIds,['enemy-0','enemy-1']);assert.equal(ints(r)[0].impacts.length,1);assert.equal(random.draws.filter(d=>d.category==='accuracy').length,4);});
test('Tail Blade initial and restart draw separately, evasion does not consume waiting window',()=>{
 const random=rng({'tail-blade-evasion':[1,0]});const r=run([unit()],[unit('Tail','Tail Blade'),I()],{rng:random}),a=target(r);assert.equal(a.accuracy.cause,'tail-blade-evasion');assert.equal(random.draws.filter(d=>d.category==='tail-blade-evasion').length,2);assert.equal(r.actions.find(a=>a.kind==='counter').counter.executionMode,'untriggered-end-of-turn');
});
test('canonical protection excludes target/executor RNG without suppressing normal accuracy',()=>{const protectedSkill=data.BATTLE_SKILLS.find(s=>s.actionKind==='attack'&&s.effects.some(e=>e.kind==='action-protection'&&e.against==='interrupt'));const p=unit();p.techs[0]={...p.techs[0],canonicalSkillId:protectedSkill.id};const random=rng();const r=run([I()],[p],{rng:random});assert.equal(ints(r).length,0);assert.ok(!random.draws.some(d=>d.category.startsWith('interrupt-')));});
for(const [id,condition] of [[0x26,'target-interrupting'],[0x31,'target-countering-or-interrupting'],[0x34,'user-interrupted']])test(`${condition} canonical output uses explicit runtime state and floor`,()=>{
 const {state,actions}=prepare([unit()],[I()]);actions[0].skill=linkLegacySkill({...tech('Rock Fist'),canonicalSkillId:id});if(condition==='user-interrupted')actions[0].prepared={interruptedByActionId:'cause'};const boosted=calculateActionDamage(state.combatants[0],state.combatants[1],actions[0],'None',state);actions[1].interrupt.state='resolved';actions[0].prepared=undefined;const base=calculateActionDamage(state.combatants[0],state.combatants[1],actions[0],'None',state);assert.equal(boosted,Math.floor(base*1.5));
});
test('deterministic replay retains caller input and no duplicate action IDs',()=>{const data=input([unit('A'),unit('B','Triple Forces')],[I('I0',0xa3),I('I1',0xa5)]),before=structuredClone(data);const r=simulate(data,{rng:createSeededBattleRng(62),maxRounds:4}),again=simulate(data,{rng:createSeededBattleRng(62),maxRounds:4});assert.deepEqual(r,again);assert.deepEqual(data,before);assert.equal(new Set(r.actions.map(a=>a.id)).size,r.actions.length);});
test('strict programmed sequence has no recovery/choice repeats and no extra executor RNG',()=>{const random=createSequenceBattleRng([0,0,0,0,127/128]);const r=run([unit()],[I()],{rng:random});assert.equal(target(r).outcome,'miss');assert.deepEqual(random.draws.map(d=>d.category),['initiative','target-choice','accuracy','accuracy','accuracy']);});

test('Results renders Interrupt outcome, restart, cancellation, force, reduction, send-last, skip and immunity',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{BattleResults}=load('src/components/BattleResults.tsx');
 const runs=[run(),run([unit()],[I()],{rng:rng({accuracy:[0,127,127]})}),run([unit()],[I('D',0xa4)]),run([unit()],[I('F',0xa3)]),run([unit()],[I('R',0xa2)]),run([unit()],[I('L',0xa5)]),run([I()],[I('Other')]),run([{...unit(),isBoss:true}],[I('D',0xa4)]),withEffects([statusEffect('confusion')],()=>run([unit()],[I()])),withEffects([statusEffect('paralysis','interrupt-triggered')],()=>run([unit()],[I()]))];
 const result=aggregateBattleRuns([]);result.fastestBattleHistory=runs.flatMap(r=>r.actions);const html=renderToStaticMarkup(React.createElement(BattleResults,{results:result}));
 for(const text of ['Interrupt — Hit','Interrupt — Miss — Accuracy','Interrupt target: A','Initial Hit → Interrupted → Restarted → Final miss','Natural recovery suppressed on restart','Action cancelled by Interrupt','Forced Miss by Interrupt','Damage reduced by Interrupt','Action sent to end of turn, after Counters','Boss immune to action deletion','Interrupt skipped — no eligible target','Confusion applied — effective next turn','by Interrupt; affects restarted action immediately'])assert.ok(html.includes(text),text);
});
test('all-successful Interrupt run retains known frame subtotal and null total; Interrupt Miss alone permits complete timing',()=>{const hit=run(),miss=run([unit()],[I()],{rng:rng({accuracy:[0,127,0]})});assert.equal(hit.totalFrames,null);assert.equal(hit.knownFrames,685);assert.equal(miss.totalFrames,879);assert.equal(miss.timingCompleteness,'complete');});
test('send-last restart uses current Paralysis but no extra recovery or target choice',()=>withEffects([statusEffect('paralysis')],()=>{
 const original=data.getBattleSkillById;data.getBattleSkillById=id=>{const s=original(id);return id===0xa5?{...s,effects:[...s.effects,statusEffect('paralysis')]}:s;};
 try{const random=rng({'paralysis-failure':[1]});const r=run([unit('Sent'),unit('Other','Rock Fist',{spd:30}),unit('Counter','Beast King Fist')],[I('I',0xa5)],{rng:random});const a=target(r);assert.equal(executed(r).at(-1).id,a.id);assert.equal(a.accuracy.cause,'paralysis');assert.equal(a.statusRecoveries.length,0);assert.equal(a.mpAccounting.costCharged,0);assert.equal(random.draws.filter(d=>d.category==='status-recovery-paralysis').length,0);}finally{data.getBattleSkillById=original;}
}));
test('damage reduction follows Poison bonus before final HP loss and Counter activation',()=>{
 const {state}=prepare();const poisoned=I('I',0xa2,{}, {poison:true});const r=run([unit()],[poisoned]);const a=target(r);assert.equal(a.impacts[0].poisonBonusDamage,10);assert.equal(a.impacts[0].damageBeforeInterruptReduction,30);assert.equal(a.impacts[0].damage,8);
 assert.equal(getStatusImmunity(state.combatants[0],'poison'),null);
});
test('canonical input with conflicting All targeting still produces Single Interrupt',()=>{const i=I();i.techs[0].target='All';const r=run([unit('A'),unit('B')],[i]);assert.equal(ints(r)[0].effectiveTargetIds.length,1);assert.equal(ints(r)[0].impacts.length,1);});
for(const id of [0xa6,0xa8])test(`0x${id.toString(16)} ambiguous MP transfer remains diagnosed and does not drain guessed amount`,()=>{const r=run([unit()],[I('I',id)]);assert.equal(ints(r)[0].impacts[0].appliedEffects.length,0);assert.notEqual(assessBattleSkill(r.state.combatants[1].skills[0]).level,'supported');assert.equal(r.state.combatants[0].currentMp,92);});
