const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {load}=require('./helpers/loadTs.cjs');const {member,tech,cases}=require('./helpers/battleFixtures.cjs');
const {simulateBattleCore:simulate,runBattleSimulation,aggregateBattleRuns,assessBattleSkill}=load('src/utils/battleEngine.ts');
const {createSequenceBattleRng:sequence,createSeededBattleRng:seeded,createBattleRng}=load('src/utils/battle/battleRng.ts');
const {hitThreshold128,resolveActionAccuracy}=load('src/utils/battle/battleAccuracy.ts');
const {recoverStatuses,statusSnapshot,applyDirectStatuses,resolveImpactStatuses}=load('src/utils/battle/battleStatuses.ts');
const {isConfusionUsableSkill,prepareConfusionAction}=load('src/utils/battle/battleConfusion.ts');
const {createBattleState,linkLegacySkill}=load('src/utils/battle/battleInput.ts');const {planAction,legacyActionPolicy}=load('src/utils/battle/battleActions.ts');
const {resolveEffectiveTargets}=load('src/utils/battle/battleTargets.ts');const {getBattleSkillById,BATTLE_SKILLS}=load('src/data/battleSkills.ts');
const input=(player,enemy)=>({player,enemy,floorSpecialty:'None'});const zeros=()=>sequence(Array(30000).fill(0));
const run=(p,e,options={})=>simulate(input(p,e),{rng:zeros(),maxRounds:1,...options});const executed=r=>r.actions.filter(a=>a.state==='resolved');
const unit=(name='P',skill='Pepper Breath',stats={},statuses={})=>({...member(name,[tech(skill)],{hp:1000,spd:40,...stats}),initialStatuses:statuses});
const prep=(p=unit(),e=unit('E','Rock Fist',{spd:20}))=>{const state=createBattleState(input([p],[e]));state.round=1;return state;};
// Categorized finite test scripts: unspecified categories deliberately use zero.
// Separate strict programmed-sequence tests below assert total budgets/exhaustion.
function choices(values={}) {
 const draws=[];const queues=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,[...v]]));
 const nextIntExclusive=(max,category)=>{const value=queues[category]?.length?queues[category].shift():0;assert.ok(Number.isInteger(value)&&value>=0&&value<max,`${category}: ${value}/${max}`);draws.push({category,value,max});return value;};
 return {draws,nextIntExclusive,nextIntInclusive:(min,max,category)=>min+nextIntExclusive(max-min+1,category),nextFloat:category=>{const value=queues[category]?.length?queues[category].shift():0;assert.ok(value>=0&&value<1);draws.push({category,value,max:1});return value;}};
}
for(const [multiple,threshold] of [[1,122],[2,116],[5,96],[10,64],[20,0],[0,128]])test(`base-128 exact threshold at target ${multiple}x SPD`,()=>assert.equal(hitThreshold128(20,20*multiple),threshold));
for(const [roll,hit] of [[0,true],[121,true],[122,false],[127,false]])test(`equal SPD boundary roll ${roll}`,()=>{
 const s=prep(unit('P','Rock Fist',{spd:20}));const r=resolveActionAccuracy(s.combatants[0],'attack',[s.combatants[1]],sequence([roll/128]));assert.equal(r.hitThreshold128,122);assert.equal(r.outcome,hit?'hit':'miss');assert.equal(r.roll128,roll);
});
for(const value of [0,-1,NaN,Infinity])test(`reject attacker effective SPD ${value}`,()=>assert.throws(()=>hitThreshold128(value,20),/effective SPD/));
test('fractional effective SPD uses integer ratio division and rejects target invalids',()=>{assert.equal(hitThreshold128(1.25,2.5),116);assert.equal(hitThreshold128(1e-100,1e-100),122);assert.equal(hitThreshold128(1e200,2e200),116);for(const v of [-1,NaN,Infinity])assert.throws(()=>hitThreshold128(20,v));});
test('effective modifiers drive normal accuracy',()=>{const s=prep(unit('P','Rock Fist',{spd:20}));s.combatants[0].parameterModifiers.spd=0.5;const a=resolveActionAccuracy(s.combatants[0],'attack',[s.combatants[1]],zeros());assert.equal(a.hitThreshold128,116);s.combatants[1].parameterModifiers.spd=0.5;assert.equal(resolveActionAccuracy(s.combatants[0],'attack',[s.combatants[1]],zeros()).hitThreshold128,122);});
for(const status of ['paralysis','confusion'])for(const roll of [0,1,2,3])test(`${status} natural recovery ${roll}/3`,()=>{
 const s=prep(unit('P','Rock Fist',{}, {[status]:true}));const rng=sequence([roll/4]);assert.deepEqual(recoverStatuses(s.combatants[0],rng),[{status,roll,recovered:roll===0}]);assert.equal(!!s.combatants[0].statuses[status],roll!==0);assert.deepEqual(rng.draws.map(d=>d.category),[`status-recovery-${status}`]);assert.throws(()=>rng.nextFloat(),/exhausted/);
});
test('independent recovery order is paralysis then confusion, Poison never rolls',()=>{
 const s=prep(unit('P','Pepper Breath',{}, {poison:true,paralysis:true,confusion:true}));const rng=sequence([0,0.75]);const r=recoverStatuses(s.combatants[0],rng);assert.deepEqual(r.map(x=>x.status),['paralysis','confusion']);assert.deepEqual(statusSnapshot(s.combatants[0]),{poison:true,paralysis:false,confusion:true});assert.equal(rng.consumed,2);
});
test('Assist accuracy guarantees Hit, skips failure/accuracy and does not clear remaining paralysis',()=>{
 const s=prep(unit('P','Pepper Breath',{}, {paralysis:true}));const rng=sequence([0.75]);recoverStatuses(s.combatants[0],rng);assert.equal(resolveActionAccuracy(s.combatants[0],'assist',[],rng).cause,'guaranteed');assert.equal(s.combatants[0].statuses.paralysis,true);assert.equal(rng.consumed,1);
});
test('production Assist remains unsupported after recovery without speculative effects',()=>{
 const p=unit();p.techs=[{...tech('Pepper Breath'),canonicalSkillId:0xc1,ap:0}];p.initialStatuses={paralysis:true};const rng=choices({'status-recovery-paralysis':[3]});
 const r=run([p],[unit('E')],{rng,actionPolicy:{chooseAction:a=>({kind:'skill',skillKey:a.skills[0].key})}});const a=r.actions[0];assert.equal(r.outcome,'unsupported');assert.equal(a.accuracy.cause,'guaranteed');assert.equal(a.mpAccounting,null);assert.equal(a.statusesAfterRecovery.paralysis,true);assert.ok(!rng.draws.some(d=>['accuracy','paralysis-failure'].includes(d.category)));
});
for(const status of ['poison','paralysis','confusion'])for(const chance of [33,66])for(const roll of [0,1,2])test(`${status} ${chance}% direct flag rolls ${roll}/2`,()=>{
 const s=prep();const effect={kind:'status-application',status,chancePercent:chance,condition:'always',byte:25,mask:1};const rng=sequence([roll/3]);const result=applyDirectStatuses(s.combatants[1],[effect],rng)[0];assert.equal(result.applied,roll<(chance===33?1:2));assert.equal(!!s.combatants[1].statuses[status],result.applied);assert.equal(rng.draws[0].category,`status-apply-${status}`);
});
test('all direct flags roll independently in Poison/Paralysis/Confusion order, including reapplications',()=>{
 const s=prep();const effects=['confusion','poison','paralysis'].map(status=>({kind:'status-application',status,chancePercent:66,condition:'always',byte:25,mask:1}));const rng=sequence([0,0,0,0,0,0]);
 assert.ok(applyDirectStatuses(s.combatants[1],effects,rng).every(x=>x.applied&&!x.alreadyActive));assert.ok(applyDirectStatuses(s.combatants[1],effects,rng).every(x=>x.applied&&x.alreadyActive));assert.deepEqual(statusSnapshot(s.combatants[1]),{poison:true,paralysis:true,confusion:true});assert.deepEqual(rng.draws.map(d=>d.category),[...['poison','paralysis','confusion'],...['poison','paralysis','confusion']].map(s=>`status-apply-${s}`));
});
for(const condition of ['counter-triggered','interrupt-triggered'])test(`conditional ${condition} ailments never roll`,()=>{const s=prep();const rng=sequence([]);const effects=['poison','paralysis','confusion'].map(status=>({kind:'status-application',status,chancePercent:66,condition,byte:25,mask:1}));assert.deepEqual(applyDirectStatuses(s.combatants[1],effects,rng),[]);});
for(const id of [1,107,15,105,62,66,69,228])test(`status source uses canonical descriptors at ID ${id}`,()=>{
 const skill=linkLegacySkill({...tech('Pepper Breath'),id:`renamed-${id}`,name:'Arbitrary name',canonicalSkillId:id});const s=prep();const result=resolveImpactStatuses(s.combatants[1],skill,20,zeros());const direct=getBattleSkillById(id).effects.filter(e=>e.kind==='status-application'&&e.condition==='always');assert.equal(result.statusApplications.length,direct.length);assert.ok(result.statusApplications.every(a=>a.applied));
});
test('normal Miss pays MP, costs 194, preserves target IDs and has no impacts/effect RNG',()=>{
 const rng=choices({accuracy:[127]});const r=run([unit('P','Poison Ivy',{spd:20})],[unit('E','Rock Fist',{spd:20})],{rng});const a=executed(r)[0];assert.equal(a.outcome,'miss');assert.equal(a.accuracy.cause,'normal-accuracy');assert.equal(a.durationFrames,194);assert.deepEqual(a.impacts,[]);assert.deepEqual(a.effectiveTargetIds,['enemy-0']);assert.equal(a.mpAccounting.costCharged,getBattleSkillById(1).mpCost);assert.ok(!rng.draws.some(d=>d.category.startsWith('status-apply')));assert.equal(r.state.combatants[1].statuses.poison,undefined);
});
test('paralysis failure short circuits accuracy and on-hit rolls, preserving attempted MP/time',()=>{
 const p=unit('P','Poison Ivy',{spd:40},{paralysis:true});const e=unit('E','Twig Tap',{hp:0});
 // Keep a living target but make it a confused Physical skip so no later RNG is needed.
 e.customStats.hp=1000;e.initialStatuses={confusion:true};const r=run([p],[e],{rng:choices({'status-recovery-paralysis':[3],'paralysis-failure':[1],'status-recovery-confusion':[3]})});const a=executed(r)[0];
 assert.equal(a.accuracy.cause,'paralysis');assert.equal(a.accuracy.roll128,undefined);assert.equal(a.durationFrames,194);assert.equal(a.mpAccounting.costCharged,8);assert.deepEqual(a.impacts,[]);assert.equal(a.statusesAfterRecovery.paralysis,true);
 const state=prep(p);const strict=sequence([0.99]);assert.equal(resolveActionAccuracy(state.combatants[0],'attack',[state.combatants[1]],strict).cause,'paralysis');assert.equal(strict.consumed,1);
});
for(const [roll,outcome] of [[0,'hit'],[127,'miss']])test(`paralysis passes then accuracy ${outcome} remains separately auditable`,()=>{
 const s=prep(unit('P','Rock Fist',{spd:20},{paralysis:true}));const rng=sequence([0,roll/128]);const a=resolveActionAccuracy(s.combatants[0],'attack',[s.combatants[1]],rng);assert.equal(a.outcome,outcome);assert.equal(a.cause,'normal-accuracy');assert.equal(a.paralysisRoll,0);assert.equal(a.roll128,roll);assert.deepEqual(rng.draws.map(d=>d.category),['paralysis-failure','accuracy']);
});
test('recovered paralysis has no failure draw and normal hit costs 685',()=>{const rng=choices();const r=run([unit('P','Pepper Breath',{spd:100},{paralysis:true})],[unit('E','Rock Fist',{hp:1})],{rng});const a=executed(r)[0];assert.equal(a.durationFrames,685);assert.equal(a.statusRecoveries[0].recovered,true);assert.ok(!rng.draws.some(d=>d.category==='paralysis-failure'));});
for(const outcome of ['hit','miss'])test(`AOE one accuracy ${outcome} uses execution-time average effective SPD`,()=>{
 const rng=choices({accuracy:[outcome==='hit'?0:127]});const r=run([unit('P','Triple Forces',{spd:40})],[unit('E1','Rock Fist',{spd:10,hp:1}),unit('E2','Rock Fist',{spd:20,hp:1}),unit('E3','Rock Fist',{spd:30,hp:1})],{rng});const a=executed(r)[0];
 assert.equal(a.accuracy.referenceRule,'average-effective-target-spd');assert.equal(a.accuracy.targetEffectiveSpd,20);assert.equal(a.accuracy.hitThreshold128,125);assert.equal(a.outcome,outcome);assert.equal(a.durationFrames,outcome==='hit'?990:194);assert.equal(a.impacts.length,outcome==='hit'?3:0);assert.equal(a.effectiveTargetIds.length,3);
 assert.equal(rng.draws.filter(d=>d.category==='accuracy').length,executed(r).length);assert.ok(a.impacts.every(i=>i.outcome==='ko'));if(outcome==='miss')assert.ok(r.state.combatants.filter(a=>a.side==='enemy').every(a=>a.currentHp===1));
});
test('AOE reference includes target SPD modifiers and excludes earlier KOs',()=>{
 const s=prep();const actor=s.combatants[0],t=s.combatants[1];const t2={...structuredClone(t),id:'enemy-1'};t.parameterModifiers.spd=0.5;t2.baseStats.spd=30;
 assert.equal(resolveActionAccuracy(actor,'attack',[t,t2],zeros()).targetEffectiveSpd,20);
 const r=run([unit('P1','Pepper Breath',{spd:100}),unit('P2','Triple Forces',{spd:70})],[unit('Slow','Rock Fist',{hp:1,spd:10}),unit('Fast','Rock Fist',{hp:1,spd:40})]);const a=executed(r)[1];assert.equal(a.accuracy.targetEffectiveSpd,40);assert.deepEqual(a.effectiveTargetIds,['enemy-1']);assert.equal(a.durationFrames,703);
});
test('Poison applying hit gains exactly +10 and subsequent hit retains it',()=>{
 const r=run([unit('P','Poison Ivy',{spd:100})],[unit('E','Rock Fist',{spd:20})],{maxRounds:2});const impacts=executed(r).filter(a=>a.actorId==='player-0').map(a=>a.impacts[0]);assert.equal(impacts.length,2);assert.ok(impacts.every(i=>i.poisonBonusDamage===10&&i.damage===i.baseDamage+10));assert.equal(impacts[0].statusApplications[0].alreadyActive,false);assert.equal(impacts[1].statusApplications[0].alreadyActive,true);
});
test('Poison bonus can cause enemy KO and normal player depletion alerts',()=>{
 const baseline=executed(run([unit('P','Rock Fist',{spd:100})],[unit('E')]))[0].impacts[0].baseDamage;
 const r=run([unit('P','Rock Fist',{spd:100})],[unit('E','Rock Fist',{hp:baseline+5},{poison:true})]);assert.equal(r.outcome,'player-win');assert.equal(executed(r)[0].impacts[0].ko,true);
 const player=unit('P','Rock Fist',{hp:1,spd:20},{poison:true});const r2=run([player],[unit('E','Rock Fist',{spd:100})]);const a=executed(r2)[0];assert.equal(a.impacts[0].poisonBonusDamage,10);assert.equal(a.resourceAlerts[0].kind,'player-hp-depleted');assert.equal(r2.state.combatants[0].isAlive,true);
});
test('Miss against Poisoned target has no +10, periodic tick or recovery',()=>{
 const rng=choices({accuracy:[127,127]});const r=run([unit('P','Rock Fist',{spd:20},{poison:true})],[unit('E','Rock Fist',{spd:20},{poison:true})],{rng});assert.ok(executed(r).every(a=>a.impacts.length===0));assert.ok(r.state.combatants.every(a=>a.currentHp===1000&&a.statuses.poison));assert.ok(!rng.draws.some(d=>d.category.startsWith('status-recovery')));
});
test('common Poison persists through actor opportunities and rounds without cure or tick',()=>{const r=run([unit('P','Rock Fist',{atk:0},{poison:true})],[unit('E','Rock Fist',{atk:0})],{maxRounds:2});assert.ok(r.state.combatants[0].statuses.poison);assert.equal(r.state.combatants[0].currentHp,980);assert.equal(executed(r).length,4);assert.ok(r.actions.every(a=>!a.statusRecoveries.some(s=>s.status==='poison')));});
for(const [name,eligible] of [['Twig Tap',false],['Shadow Scythe',false],['Rock Fist',true],['Pepper Breath',true],['Evil Charm',true]])test(`Confusion canonical animation eligibility: ${name}`,()=>{const skill=linkLegacySkill(tech(name));assert.equal(isConfusionUsableSkill(skill),eligible);if(name==='Twig Tap'){assert.equal(skill.canonicalSkillId,0x47);assert.equal(getBattleSkillById(0x47).animationKind,'physical');assert.equal(getBattleSkillById(0x47).provenance.bytes[2],0x52);}});
test('renamed Physical skill excluded by numeric identity, custom unknown is not guessed usable',()=>{assert.equal(isConfusionUsableSkill(linkLegacySkill(tech('Twig Tap',{name:'Renamed'}))),false);assert.equal(isConfusionUsableSkill(linkLegacySkill(tech('Pepper Breath',{id:'unknown',name:'Unknown'}))),false);});
for(const draw of [0,0.999])test(`Confusion filters candidate probability before selection (${draw})`,()=>{
 const p=unit('P','Twig Tap',{spd:100},{confusion:true});p.techs.push(tech('Pepper Breath'),tech('Nova Blast'));const rng=choices({'status-recovery-confusion':[3],'confusion-action-choice':[draw]});const r=run([p],[unit('E')],{rng});const a=executed(r)[0];assert.equal(a.skillKey,draw===0?'pepper-breath':'nova-blast');assert.deepEqual(a.confusion.eligibleSkillKeys,['pepper-breath','nova-blast']);assert.equal(a.confusion.plannedSkillKey,'twig-tap');assert.deepEqual(a.effectiveTargetIds,['player-0']);assert.equal(a.durationFrames,685);assert.ok(a.mpAccounting.costCharged>0);
});
test('only Physical skills gives Confusion skip with no fallback/targets/MP/Miss',()=>{
 const p=unit('P','Twig Tap',{spd:100},{confusion:true});const e=unit('E','Twig Tap',{spd:20},{confusion:true});const rng=choices({'status-recovery-confusion':[3,3]});const r=run([p],[e],{rng});assert.equal(r.actionCount,0);assert.ok(r.actions.every(a=>a.state==='skipped'&&a.reason==='confusion-no-eligible-skill'&&a.outcome==='skipped'&&a.durationFrames===null&&a.mpAccounting===null&&a.impacts.length===0&&a.effectiveTargetIds.length===0));assert.ok(r.state.combatants.every(a=>a.currentMp===a.maxMp));assert.ok(!rng.draws.some(d=>['accuracy','target-choice','confusion-target','confusion-action-choice','paralysis-failure'].includes(d.category)||d.category.startsWith('status-apply')));assert.equal(r.totalFrames,0);
});
test('Confusion recovery restores planned enemy-side Physical action',()=>{const r=run([unit('P','Twig Tap',{spd:100},{confusion:true})],[unit('E')]);const a=executed(r)[0];assert.equal(a.confusion.active,false);assert.equal(a.skillKey,'twig-tap');assert.deepEqual(a.effectiveTargetIds,['enemy-0']);assert.equal(a.statusRecoveries[0].recovered,true);});
for(const target of [0,1])test(`confused Single selects own-side ${target===0?'self':'ally'}, never opposing side`,()=>{
 const p=unit('P','Pepper Breath',{spd:100,mp:1},{confusion:true});const rng=choices({'status-recovery-confusion':[3],'confusion-target':[target]});const r=run([p,unit('Ally')],[unit('E')],{rng});const a=executed(r)[0];assert.deepEqual(a.effectiveTargetIds,[`player-${target}`]);assert.equal(a.accuracy.referenceTargetId,`player-${target}`);if(target===0)assert.equal(a.accuracy.hitThreshold128,122);assert.equal(a.durationFrames,685);assert.equal(a.resourceAlerts[0].kind,'player-mp-depleted');assert.ok(a.impacts[0].damage>0);
});
for(const miss of [false,true])test(`confused AOE ${miss?'Miss':'Hit'} affects own side once and includes zero-HP players`,()=>{
 const p=unit('P','Triple Forces',{spd:100,mp:1},{confusion:true});const rng=choices({'status-recovery-confusion':[3],accuracy:[0,miss?127:0]});const r=run([p,unit('Zero','Rock Fist',{hp:0,spd:200})],[unit('E','Rock Fist',{spd:10})],{rng});
 // Zero acts first; inspect the redirected action specifically.
 const a=executed(r).find(a=>a.confusion?.redirected);assert.deepEqual(a.effectiveTargetIds,['player-0','player-1']);assert.equal(a.accuracy.referenceRule,'average-effective-target-spd');assert.equal(a.impacts.length,miss?0:2);assert.equal(a.durationFrames,miss?194:873);assert.equal(a.mpAccounting.costCharged,getBattleSkillById(a.canonicalSkillId).mpCost);
});
test('confused Enemy AOE includes self/living allies but excludes KO enemy allies',()=>{
 const e=unit('E','Triple Forces',{spd:100},{confusion:true});const r=run([unit()],[e,unit('Dead','Rock Fist',{hp:0}),unit('Alive','Rock Fist',{hp:1})],{rng:choices({'status-recovery-confusion':[3]})});const a=executed(r)[0];assert.deepEqual(a.effectiveTargetIds,['enemy-0','enemy-2']);assert.equal(a.impacts.length,2);assert.equal(r.state.combatants[2].isAlive,false);
});
for(const [skill,status] of [['Brown Stinger','poison'],['Stun Flame Shot','paralysis'],['Evil Charm','confusion']])test(`confused self-Hit preserves canonical ${status} application`,()=>{
 const r=run([unit('P',skill,{spd:100},{confusion:true})],[unit('E')],{rng:choices({'status-recovery-confusion':[3]})});const a=executed(r)[0];assert.equal(a.impacts[0].targetId,'player-0');assert.ok(a.impacts[0].statusApplications.some(s=>s.status===status&&s.applied));assert.ok(r.state.combatants[0].statuses[status]);
});
test('confused self-Hit preserves supported parameter effect path including supplied legacy DEF down',()=>{
 const p=unit('P','Pepper Breath',{spd:100},{confusion:true});p.techs[0].specialEffect={type:'debuffStat',stat:'def'};const r=run([p],[unit('E')],{rng:choices({'status-recovery-confusion':[3]})});const a=executed(r)[0];assert.ok(a.impacts[0].appliedEffects.some(e=>e.kind==='parameter-modifier'&&e.stat==='def'&&e.combatantId==='player-0'));
});
for(const statuses of [{poison:true,paralysis:true},{poison:true,confusion:true},{paralysis:true,confusion:true},{poison:true,paralysis:true,confusion:true}])test(`multiple status snapshot ${Object.keys(statuses).join('+')}`,()=>{
 const p=unit('P','Pepper Breath',{spd:100},statuses);const r=run([p],[unit('E')],{rng:choices({'status-recovery-paralysis':[3],'status-recovery-confusion':[3]})});const a=executed(r)[0];for(const key of Object.keys(statuses)){assert.equal(a.statusesBefore[key],true);assert.equal(a.statusesAfterRecovery[key],true);}assert.equal(Object.values(a.statusesBefore).filter(Boolean).length,Object.keys(statuses).length);
});
for(const [skill,status] of [['Stun Flame Shot','paralysis'],['Evil Charm','confusion']])test(`new ${status} affects slower actor in the same round`,()=>{
 const rng=choices({'status-recovery-paralysis':[3],'paralysis-failure':[1],'status-recovery-confusion':[3]});const r=run([unit('P',skill,{spd:100})],[unit('E','Pepper Breath',{spd:20})],{rng});const a=executed(r).find(a=>a.actorId==='enemy-0');assert.equal(a.statusesBefore[status],true);if(status==='paralysis'){assert.equal(a.accuracy.cause,'paralysis');assert.equal(a.impacts.length,0);}else{assert.equal(a.confusion.redirected,true);assert.deepEqual(a.effectiveTargetIds,['enemy-0']);}
});
test('status cannot retroactively change an already-executed action',()=>{const r=run([unit('P','Evil Charm',{spd:10})],[unit('E','Pepper Breath',{spd:100})]);const a=executed(r)[0];assert.equal(a.actorId,'enemy-0');assert.equal(a.statusesBefore.confusion,false);assert.equal(a.confusion.redirected,false);assert.equal(r.state.combatants[1].statuses.confusion,true);});
test('strict one-hit accuracy/status sequence fails loudly if an extra draw is added',()=>{
 const rng=sequence([0,0,0,0,0,0,0]);const r=run([unit('P','Poison Ivy',{spd:100})],[unit('E','Rock Fist',{hp:1})],{rng});assert.equal(r.outcome,'player-win');assert.equal(rng.consumed,7);assert.deepEqual(rng.draws.map(d=>d.category),['action-choice','action-choice','initiative','initiative','target-choice','accuracy','status-apply-poison']);assert.throws(()=>rng.nextFloat(),/exhausted/);
});
test('Shadow Scythe initial Hit+KO then accuracy Miss totals 879 and stops without extra MP/recovery/choice',()=>{
 const p=unit('P','Shadow Scythe',{spd:100},{paralysis:true,confusion:true});const rng=sequence([0,0,0,0,0,0,0,0,0,0,0,0.999,0.75]);
 // 3 actors: 3 choices + 3 initiative; two recoveries; target+accuracy; repeat target+accuracy.
 const r=run([p],[unit('E1','Rock Fist',{hp:1,spd:20}),unit('E2','Twig Tap',{hp:1,spd:20},{confusion:true})],{rng});
 const a=executed(r).filter(a=>a.actorId==='player-0');assert.equal(a.length,2);assert.equal(a[0].durationFrames,685);assert.equal(a[1].durationFrames,194);assert.equal(a[1].accuracy.cause,'normal-accuracy');assert.equal(a[1].mpAccounting.costCharged,0);assert.deepEqual(a[1].statusRecoveries,[]);assert.equal(a[1].chainFromActionId,a[0].id);assert.equal(r.totalFrames,879);
 assert.equal(rng.consumed,13);assert.equal(rng.draws.filter(d=>d.category==='accuracy').length,2);assert.equal(rng.draws.filter(d=>d.category==='status-recovery-paralysis').length,1);assert.throws(()=>rng.nextFloat(),/exhausted/);
});
test('Shadow chain repeats reroll accuracy and paralysis failure but not natural recovery',()=>{
 const p=unit('P','Shadow Scythe',{spd:100},{paralysis:true});const rng=choices({'status-recovery-paralysis':[3],'paralysis-failure':[0,1],'status-recovery-confusion':[3]});const r=run([p],[unit('E1','Rock Fist',{hp:1,spd:20}),unit('E2','Twig Tap',{hp:1,spd:20},{confusion:true})],{rng});const a=executed(r).filter(a=>a.actorId==='player-0');assert.equal(a.length,2);assert.equal(a[1].accuracy.cause,'paralysis');assert.equal(a[1].durationFrames,194);assert.equal(a[1].mpAccounting.costCharged,0);assert.equal(rng.draws.filter(d=>d.category==='status-recovery-paralysis').length,1);assert.equal(rng.draws.filter(d=>d.category==='paralysis-failure').length,2);assert.equal(rng.draws.filter(d=>d.category==='accuracy').length,1);
});
test('persistent Confusion blocks Shadow Scythe while recovery allows its chain',()=>{
 const p=unit('P','Shadow Scythe',{spd:100},{confusion:true});const e=[unit('E1','Rock Fist',{hp:1}),unit('E2','Rock Fist',{hp:1})];const blocked=run([p],e,{rng:choices({'status-recovery-confusion':[3]})});assert.equal(blocked.actions[0].reason,'confusion-no-eligible-skill');assert.ok(!blocked.actions.some(a=>a.chainFromActionId));const allowed=run([p],e);assert.equal(executed(allowed).length,2);assert.equal(allowed.totalFrames,1370);
});
test('initial status input is validated and simulation does not mutate it',()=>{const p=unit('P','Pepper Breath',{}, {poison:true,paralysis:true,confusion:true});const before=structuredClone(p);run([p],[unit('E')]);assert.deepEqual(p,before);for(const initialStatuses of [{poison:'yes'},{freeze:true}])assert.equal(run([{...p,initialStatuses}],[unit('E')]).outcome,'invalid');});
test('support diagnostics no longer mark direct ailments as future but retain conditional effects',()=>{
 for(const name of ['Poison Ivy','Brown Stinger','Stun Flame Shot','Evil Charm'])assert.equal(assessBattleSkill(linkLegacySkill(tech(name))).level,'legacy-compatibility');
 const conditional=BATTLE_SKILLS.find(s=>s.actionKind==='counter'&&s.effects.some(e=>e.kind==='status-application'&&e.condition==='counter-triggered'));assert.ok(conditional);assert.notEqual(assessBattleSkill(linkLegacySkill({...tech('Rock Fist'),canonicalSkillId:conditional.id})).level,'supported');
});
test('legacy Counter compatibility now checks accuracy; a missed incoming hit triggers no counter',()=>{
 const r=run([unit('P','Rock Fist',{spd:20})],[unit('E','Beast King Fist',{spd:20})],{rng:choices({accuracy:[127]})});assert.equal(executed(r)[0].outcome,'miss');assert.ok(!r.actions.some(a=>a.reaction));assert.ok(executed(r).find(a=>a.kind==='counter').accuracy);
});
test('same seeded batches and full histories reproduce while other seeds alter outcomes',()=>{
 const p=[unit('P','Evil Charm',{hp:50,spd:20})],e=[unit('E','Stun Flame Shot',{hp:50,spd:20})];const a=run(p,e,{rng:seeded(42),maxRounds:30}),b=run(p,e,{rng:seeded(42),maxRounds:30});assert.deepEqual(a,b);assert.notDeepEqual(a.actions,run(p,e,{rng:seeded(7),maxRounds:30}).actions);
 const batch=()=>runBattleSimulation([unit('P','Pepper Breath',{spd:20})],[unit('E','Rock Fist',{hp:30,spd:20})],'None',30,{rng:seeded(123)});assert.deepEqual(batch(),batch());assert.ok(batch().maxFrames>batch().minFrames);
});
test('UI exposes Miss causes, recovery, redirect/skip and per-impact Poison separately',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{BattleResults}=load('src/components/BattleResults.tsx');
 const p=unit('P','Brown Stinger',{spd:100},{confusion:true,paralysis:true});const r=run([p],[unit('E')],{rng:choices({'status-recovery-confusion':[3]})});
 const misses=[run([unit('P','Pepper Breath',{spd:20})],[unit('E','Rock Fist',{spd:20})],{rng:choices({accuracy:[127]})}),run([unit('P','Pepper Breath',{}, {paralysis:true})],[unit('E')],{rng:choices({'status-recovery-paralysis':[3],'paralysis-failure':[1]})})];
 const skipped=run([unit('P','Twig Tap',{}, {confusion:true})],[unit('E')],{rng:choices({'status-recovery-confusion':[3]})});
 // Display fixture only: these are real core records, selected for UI coverage.
 const result=aggregateBattleRuns([]);result.fastestBattleHistory=[...r.actions,...misses.flatMap(x=>x.actions),...skipped.actions];
 const html=renderToStaticMarkup(React.createElement(BattleResults,{results:result}));for(const text of ['Miss — Accuracy','Miss — Paralysis','Paralysis','recovered','Poison +10','Poison','applied','Confusion redirect','Confusion skip','194 f'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/timeSeconds/);
});
