const {test}=require('node:test');
const assert=require('node:assert/strict');
const {unit:rawUnit,rng,run,action,data,load}=require('./helpers/battleSupportFixtures.cjs');
const {createBattleState}=load('src/utils/battle/battleInput.ts');
const {planAction}=load('src/utils/battle/battleActions.ts');
const {applySupportEffects}=load('src/utils/battle/battleSupportEffects.ts');
const {calculateActionDamage,getTypeBonus}=load('src/utils/battle/battleDamage.ts');
const {enumerateLegalPlayerOrders}=load('src/utils/battle/battleActionPlans.ts');
const {classifyEffect}=load('src/utils/battle/battleEffectCoverage.ts');
function unit(name,id,options={}){const u=rawUnit(name,id,options);if(options.type)u.digimon.type=options.type;if(options.specialty)u.digimon.specialty=options.specialty;return u;}
const hit=r=>action(r).impacts[0];
const strike=(id,hp=100,options={},extra={})=>run([unit('P',id,options)],[unit('E',2,{currentHp:hp,...extra})]);
for(const hp of [100,101,3,2,1])test('HP Zapper floor current HP '+hp,()=>{
 const r=strike(0xe1,hp);assert.equal(hit(r).damage,Math.floor(hp/2));assert.equal(hit(r).hpAfter,hp-Math.floor(hp/2));assert.deepEqual(action(r).effectDiagnostics,[]);assert.equal(action(r).durationFrames,685);assert.equal(action(r).mpAccounting.costCharged,data.getBattleSkillById(0xe1).mpCost);
});
for(const atk of [1,200])for(const def of [1,200])test('HP Zapper bypasses ATK DEF '+atk+'/'+def,()=>assert.equal(hit(strike(0xe1,101,{stats:{atk}},{stats:{def}})).damage,50));
for(const type of ['Vaccine','Virus','Data'])test('HP Zapper bypasses type floor poison '+type,()=>{
 const r=run([unit('P',0xe1,{type,specialty:'Fire'})],[unit('E',2,{type:'Virus',currentHp:101,specialty:'Fire',initialStatuses:{poison:true}})],{floorSpecialty:'Fire'});
 assert.equal(hit(r).damage,50);assert.equal(hit(r).poisonBonusDamage,0);
});
for(const id of [0xe1,0xe2,0x50,0x47])for(const mechanical of [false,true])test('Hit required '+id+'/'+mechanical,()=>{
 const r=run([unit('P',id,{type:'Virus',initialStatuses:mechanical?{paralysis:true}:{}})],[unit('E',2,{type:'Vaccine',currentHp:10})],{rng:rng(mechanical?{'paralysis-failure':[1]}:{accuracy:[127]})});assert.equal(action(r).outcome,'miss');assert.deepEqual(action(r).impacts,[]);
});
for(const id of [0xe1,0xe2,0x47])test('Universal Invincibility prevents HP result '+id,()=>assert.equal(hit(strike(id,10,{}, {initialStatuses:{invincibility:true}})).damage,0));
for(const [max,hp,execute] of [[100,10,true],[100,9,true],[100,11,false],[155,15,true],[155,16,false]])test('Critical pre-impact threshold '+max+'/'+hp,()=>{
 const r=strike(0xe2,hp,{stats:{atk:1}},{stats:{hp:max,def:100}});const i=hit(r);assert.equal(i.damage,execute?hp:i.baseDamage);assert.equal(!!action(r).effectAudit?.some(e=>e.includes('execute')),execute);if(!execute)assert.ok(i.hpAfter>0);assert.deepEqual(action(r).effectDiagnostics,[]);
});
test('Critical execute causes earlier KO/skip and has no boss immunity',()=>{
 const r=strike(0xe2,100,{stats:{atk:1}},{isBoss:true});assert.equal(hit(r).hpAfter,0);assert.equal(action(r,'E').outcome,'skipped');
});
test('Critical preserves strategic Player HP0',()=>{
 const r=run([unit('P',2,{currentHp:100})],[unit('E',0xe2,{stats:{spd:100}})]);assert.equal(action(r,'E').impacts[0].hpAfter,0);assert.equal(r.state.combatants[0].isAlive,true);assert.equal(action(r).outcome,'hit');
});
for(const from of ['Vaccine','Virus','Data'])for(const to of ['Vaccine','Virus','Data'])test('Musical Fist type '+from+' -> '+to,()=>{
 const r=strike(0x50,500,{type:from},{type:to});const i=hit(r),heal=getTypeBonus(from,to)<1;assert.equal(i.damage,heal?0:i.baseDamage);assert.equal(i.healing,heal?i.baseDamage:0);assert.equal(i.hpAfter,500+(heal?i.baseDamage:-i.baseDamage));assert.equal(action(r).kind,'attack');assert.equal(action(r).outcome,'hit');assert.equal(action(r).durationFrames,685);assert.equal(action(r).mpAccounting.costCharged,data.getBattleSkillById(0x50).mpCost);assert.deepEqual(action(r).effectDiagnostics,[]);
});
test('Musical heal cap and legal random target enumeration',()=>{
 const r=strike(0x50,999,{type:'Virus'},{type:'Vaccine'});assert.equal(hit(r).healing,1);assert.equal(hit(r).hpAfter,1000);
 const s=createBattleState({player:[unit('P',0x50,{type:'Virus'})],enemy:[unit('E',2,{type:'Vaccine'})],floorSpecialty:'None'});s.round=1;assert.equal(enumerateLegalPlayerOrders(s,s.combatants[0]).length,1);
});
for(const id of [0x3c,0x41])for(const desired of [21,1,0])test('MP floor final damage '+id+'/'+desired,()=>{
 const u=unit('P',id);u.techs[0].ap=desired;u.type='Data';u.specialty='None';const e=unit('E',2,{type:'Data',specialty:'None'});const random=rng(),r=run([u],[e],{rng:random}),a=action(r);assert.equal(hit(r).damage,desired);assert.ok(a.resourceDiagnostics.includes('MP damage: '+Math.floor(desired/2)));assert.deepEqual(a.effectDiagnostics,[]);assert.equal(random.draws.some(d=>d.category?.includes('mp-damage')),false);
});
for(const id of [0x3c,0x41])test('MP clamps at zero '+id,()=>{
 const r=strike(id,100,{}, {currentMp:1});assert.equal(r.state.combatants[1].currentMp,0);
});
for(const [hp,damage,expected] of [[100,30,30],[20,35,20],[1,35,1],[100,0,0]])test('Twig actual HP loss '+hp+'/'+damage,()=>{
 const p=unit('P',0x47,{currentHp:100});p.techs[0].ap=damage;const r=run([p],[unit('E',2,{currentHp:hp})]);assert.equal(hit(r).appliedEffects.find(e=>e.kind==='drain').amount,expected);assert.equal(action(r).durationFrames,685);assert.deepEqual(action(r).effectDiagnostics,[]);
});
test('Twig cap and HP0 Player target',()=>{
 let p=unit('P',0x47,{currentHp:999});p.techs[0].ap=30;assert.equal(hit(run([p],[unit('E')])).appliedEffects[0].amount,1);
 const r=run([unit('P',2,{currentHp:0})],[unit('E',0x47,{currentHp:100,stats:{spd:100}})]);assert.equal(action(r,'E').impacts[0].appliedEffects[0].amount,0);
});
test('Twig descriptor audit only canonical occurrence',()=>assert.deepEqual(data.BATTLE_SKILLS.filter(s=>s.effects.some(e=>e.byte===19&&e.mask===8)).map(s=>s.id),[0x47]));
for(const mode of ['waiting','activated','shared-trigger-promoted','resolved','untriggered-end-of-turn'])test('Banana Counter lifecycle '+mode,()=>{
 const s=createBattleState({player:[unit('P',0xbb)],enemy:[unit('C',0x86)],floorSpecialty:'None'});s.round=1;
 const a=planAction(s,s.combatants[0],{kind:'skill',skillKey:s.combatants[0].skills[0].key}),c=planAction(s,s.combatants[1],{kind:'skill',skillKey:s.combatants[1].skills[0].key});c.state='waiting';c.counter.executionMode=mode;
 applySupportEffects(s,s.combatants[0],s.combatants[1],a,'after-damage');assert.equal(c.counter.executionMode,mode==='waiting'?'prevented':mode);
 s.round=2;const next=planAction(s,s.combatants[1],{kind:'skill',skillKey:s.combatants[1].skills[0].key});assert.equal(next.counter.executionMode,'waiting');
});
test('Banana prevents all waiting Counters before later damage',()=>{
 const r=run([unit('P',0xbb,{stats:{spd:100}}),unit('A',2)],[unit('C',0x86),unit('C2',0x86)]);
 for(const name of ['C','C2']){const c=action(r,name);assert.equal(c.outcome,'skipped');assert.equal(c.reason,'counter-prevented-by-banana-slip');assert.equal(c.durationFrames,null);assert.equal(c.mpAccounting,null);}
 assert.equal(action(r).durationFrames,873);assert.deepEqual(action(r).effectDiagnostics,[]);
 const baseline=run([unit('A',2)],[unit('C',0x86)]);assert.equal(action(baseline,'C').counter.executionMode,'activated');
});
test('Banana does not suppress later Interrupt opportunity',()=>{
 const r=run([unit('P',0xbb,{stats:{spd:100}}),unit('A',2)],[unit('I',0xa6)]);assert.equal(action(r,'I').outcome,'hit');assert.equal(action(r,'I').durationFrames,761);assert.ok(action(r,'A').restart);
});
test('Banana coverage distinguishes broken Interrupt from valid Counter',()=>{
 const s=data.getBattleSkillById(0xbb);for(const e of s.effects.filter(e=>e.scope==='turn'))assert.equal(classifyEffect(e,s).status,e.against==='counter'?'authoritative':'ignored-by-project');
});
test('All used deferred descriptors are closed',()=>{
 const rows=data.BATTLE_SKILLS.filter(s=>s.recordKind==='technique').flatMap(s=>s.effects.filter(e=>classifyEffect(e,s).status==='deferred-unresolved'));assert.deepEqual(rows,[]);
});

test('HP Zapper reads HP after an earlier action',()=>{
 const r=run([unit('A',2,{stats:{spd:100}}),unit('P',0xe1)],[unit('E')]);const first=action(r,'A').impacts[0],second=hit(r);assert.equal(second.hpBefore,first.hpAfter);assert.equal(second.damage,Math.floor(first.hpAfter/2));
});
test('Critical above threshold does not execute after its own damage crosses threshold',()=>{
 const p=unit('P',0xe2);p.techs[0].ap=5;const r=run([p],[unit('E',2,{currentHp:11,stats:{hp:100}})]);assert.equal(hit(r).hpAfter,6);assert.equal(hit(r).damage,5);
});
test('Musical healing uses exact shared calculation and cannot trigger Counter',()=>{
 const p=unit('P',0x50,{type:'Virus'}),e=unit('E',0x86,{type:'Vaccine',currentHp:500});
 const s=createBattleState({player:[p],enemy:[e],floorSpecialty:'None'});s.round=1;
 const a=planAction(s,s.combatants[0],{kind:'skill',skillKey:s.combatants[0].skills[0].key});
 const expected=calculateActionDamage(s.combatants[0],s.combatants[1],a,'None',s),r=run([p],[e]);assert.equal(hit(r).healing,expected);assert.equal(action(r,'E').counter.executionMode,'untriggered-end-of-turn');assert.ok(action(r).effectAudit.some(e=>e.includes('healed target for '+expected)));
});
for(const id of [0xe1,0xe2,0x47,0x3c,0x41])test('Closure mechanic adds no RNG draw '+id,()=>{
 const random=rng();run([unit('P',id)],[unit('E')],{rng:random});const baseline=rng();run([unit('P',2)],[unit('E')],{rng:baseline});assert.deepEqual(random.draws.map(d=>d.category),baseline.draws.map(d=>d.category));
});
test('Twig zero final loss under Invincibility has zero lifesteal',()=>{
 const r=strike(0x47,100,{currentHp:100},{initialStatuses:{invincibility:true}});assert.equal(hit(r).appliedEffects[0].amount,0);
});
