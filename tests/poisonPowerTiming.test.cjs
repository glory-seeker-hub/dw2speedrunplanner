const {test}=require('node:test');
const assert=require('node:assert/strict');
const {unit,first,rng,run,action,data,load}=require('./helpers/battleSupportFixtures.cjs');
const {createBattleState}=load('src/utils/battle/battleInput.ts');
const {resolveImpactStatuses}=load('src/utils/battle/battleStatuses.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
function impact({id=6,power=false,poison=false,side='enemy',policy='natural',random=rng(),counter=false,interrupt=false}={}){
 const s=createBattleState({player:[unit('P',id,{initialPowers:power?{poison:true}:{}})],enemy:[unit('E',6,{initialStatuses:poison?{poison:true}:{}})],floorSpecialty:'None'});
 const [attacker,target]=s.combatants;target.side=side;attacker.side=side==='enemy'?'player':'enemy';
 const apply=()=>resolveImpactStatuses(target,attacker.skills[0],25,random,counter,interrupt,attacker,policy);
 return {attacker,target,apply,random};
}
for(const id of [1,0x6b,0x82])for(const power of [false,true])for(const poison of [false,true])test(`direct canonical Poison ${id}, Power ${power}, pre-poison ${poison}: exactly ten`,()=>{
 const h=impact({id,power,poison,counter:id===0x82}),i=h.apply();assert.equal(i.damage,35);assert.equal(i.poisonBonusDamage,10);assert.equal(h.target.statuses.poison,true);
 assert.ok(i.statusApplications.some(s=>s.status==='poison'&&s.applied&&s.condition!=='poison-power'));
 if(power){const p=i.statusApplications.find(s=>s.condition==='poison-power');assert.equal(p.alreadyActive,true);assert.equal(p.roll,null);}
 assert.equal(h.apply().damage,35);
});
for(const id of [1,0x6b])for(const power of [false,true])test(`failed direct Poison ${id}, Power ${power}: no application-hit bonus`,()=>{
 const random=rng({'status-apply-poison':[2]}),h=impact({id,power,random}),i=h.apply();
 assert.equal(i.damage,25);assert.equal(i.poisonBonusDamage,0);assert.equal(!!h.target.statuses.poison,power);
 assert.equal(i.statusApplications[0].applied,false);assert.equal(random.draws.length,1);
 if(power)assert.equal(i.statusApplications.find(s=>s.condition==='poison-power').applied,true);
});
for(const side of ['player','enemy'])for(const policy of ['natural','tas-luck'])test(`Power first/subsequent impact ${side} ${policy}`,()=>{
 const h=impact({power:true,side,policy}),one=h.apply(),two=h.apply();
 assert.equal(one.damage,25);assert.equal(one.poisonBonusDamage,0);assert.equal(one.statusApplications[0].applied,true);assert.equal(one.statusApplications[0].alreadyActive,false);
 assert.equal(h.target.statuses.poison,true);assert.equal(two.damage,35);assert.equal(two.statusApplications[0].alreadyActive,true);assert.equal(h.random.draws.length,0);
 delete h.attacker.temporaryPowers.poison;assert.equal(h.apply().damage,35);
});
for(const side of ['player','enemy'])test('TAS direct Poison follows side policy '+side,()=>{
 const h=impact({id:1,side,policy:'tas-luck'}),i=h.apply();assert.equal(i.damage,side==='enemy'?35:25);assert.equal(h.random.draws.length,0);
 assert.equal(i.statusApplications[0].rngResolution.policy,'tas-luck');assert.equal(i.statusApplications[0].rngResolution.opportunityKey,undefined);
});
for(const seed of [1,7,17,42])test('Natural seeded direct gates are consumed once, Power consumes none '+seed,()=>{
 const expected=createSeededBattleRng(seed),roll=expected.nextIntExclusive(3,'status-apply-poison');
 const actual=createSeededBattleRng(seed),h=impact({id:1,power:true,random:actual}),i=h.apply();
 assert.equal(i.statusApplications[0].roll,roll);assert.equal(i.damage,roll===0?35:25);assert.equal(actual.position(),1);assert.equal(h.target.statuses.poison,true);
 assert.equal(actual.nextFloat('initiative'),expected.nextFloat('initiative'));
});
test('ordinary hit on pre-poisoned target gets exactly ten without an application',()=>{
 const i=impact({poison:true}).apply();assert.equal(i.damage,35);assert.deepEqual(i.statusApplications,[]);
});
test('canonical ID governs direct same-hit Poison even after display-name changes',()=>{
 const h=impact({id:1});h.attacker.skills[0].legacyTech.name='Unrelated display name';assert.equal(h.apply().damage,35);
});
test('untriggered Needle Spray does not invent direct Poison',()=>{
 const h=impact({id:0x82,power:true}),i=h.apply();assert.equal(i.damage,25);assert.equal(i.statusApplications.length,1);assert.equal(i.statusApplications[0].condition,'poison-power');
});
test('AOE mixed state is independent, second action sees both targets poisoned',()=>{
 const id=data.getBattleSkillByName('Triple Forces').id;
 const r=run([unit('P',id,{initialPowers:{poison:true}})],[unit('E1',6,{initialStatuses:{poison:true}}),unit('E2',6)],{maxRounds:2});
 const actions=r.actions.filter(a=>a.actorName==='P');assert.equal(actions.length,2);
 assert.deepEqual(actions[0].impacts.map(i=>i.poisonBonusDamage),[10,0]);assert.deepEqual(actions[1].impacts.map(i=>i.poisonBonusDamage),[10,10]);
 for(const a of actions)for(const i of a.impacts)assert.equal(i.damage,i.baseDamage+i.poisonBonusDamage);
 assert.ok(r.state.combatants.slice(1).every(a=>a.statuses.poison));
});
test('another attacker inherits target Poison rather than applier identity',()=>{
 const r=run([unit('P',6,{initialPowers:{poison:true},stats:{spd:100}}),unit('Ally',6,{stats:{spd:80}})],[unit('E',6,{stats:{spd:1}})]);
 assert.equal(action(r).impacts[0].poisonBonusDamage,0);assert.equal(action(r,'Ally').impacts[0].poisonBonusDamage,10);
});
for(const id of [0xba,0xd7])test('canonical Power grant '+id+' produces delayed bonus on recipient attacks',()=>{
 const p=unit('P',id,{stats:{spd:100}}),ally=unit('Ally',6,{stats:{spd:80}});
 const policy={chooseAction:a=>({...first.chooseAction(a),...(a.name==='P'?{targetIntent:{kind:'combatants',targetIds:['player-1']}}:{})})};
 const r=run([p,ally],[unit('E',6,{stats:{spd:1}})],{actionPolicy:policy,maxRounds:2});
 const grant=action(r),attacks=r.actions.filter(a=>a.actorName==='Ally');assert.equal(grant.kind,'assist');assert.ok(grant.supportEvents.some(e=>e.state==='poison-power'));
 assert.equal(grant.impacts[0].damage,0);assert.deepEqual(grant.impacts[0].statusApplications,[]);
 assert.equal(attacks[0].impacts[0].poisonBonusDamage,0);assert.equal(attacks[1].impacts[0].poisonBonusDamage,10);
 if(id===0xd7){assert.ok(grant.supportEvents.some(e=>e.state==='poison-body'));assert.equal(r.state.combatants[1].statuses.poison,undefined);}
});
for(const id of [6,1,0xa1,0x86])for(const mechanical of [false,true])test(`Miss ${id} mechanical ${mechanical} cannot apply Power or bonus`,()=>{
 const r=run([unit('P',id,{initialPowers:{poison:true},initialStatuses:mechanical?{paralysis:true}:{}})],[unit('E',6)],{rng:rng(mechanical?{'paralysis-failure':[1]}:{accuracy:id===0xa1?[0,127,0]:[127,127]})});
 assert.equal(action(r).outcome,'miss');assert.deepEqual(action(r).impacts,[]);assert.equal(r.state.combatants[1].statuses.poison,undefined);
});
for(const id of [0x86,0xa1])test('Counter/Interrupt Power impact shares delayed rule '+id,()=>{
 const r=run([unit('P',id,{initialPowers:{poison:true}})],[unit('E',6)]),a=action(r),i=a.impacts[0];
 assert.equal(a.kind,id===0x86?'counter':'interrupt');assert.equal(i.poisonBonusDamage,0);assert.equal(i.statusApplications.find(s=>s.condition==='poison-power').applied,true);
 if(id===0xa1)assert.equal(a.durationFrames,761);
});
test('conditional Interrupt direct Poison still qualifies immediately',()=>{
 const original=data.getBattleSkillById;
 data.getBattleSkillById=id=>{const s=original(id);return id===0xa1?{...s,effects:[...s.effects,{kind:'status-application',status:'poison',condition:'interrupt-triggered',chancePercent:100,byte:25,mask:8}]}:s;};
 try{const h=impact({id:0xa1,power:true,interrupt:true}),i=h.apply();assert.equal(i.damage,35);assert.equal(i.statusApplications[0].condition,'interrupt-hit');}finally{data.getBattleSkillById=original;}
});
for(const id of [0xe1,0xe2])test('exact special HP damage excludes bonus with Power '+id,()=>{
 const r=run([unit('P',id,{initialPowers:{poison:true},stats:{spd:100}})],[unit('E',6,{currentHp:51})]),i=action(r).impacts[0];
 assert.equal(i.damage,id===0xe1?25:51);assert.equal(i.poisonBonusDamage,0);assert.equal(i.statusApplications[0].applied,true);
});
test('Twig Tap drains actual corrected HP damage',()=>{
 const r=run([unit('P',0x47,{initialPowers:{poison:true},currentHp:100})],[unit('E',6)]),i=action(r).impacts[0];
 assert.equal(i.damage,i.baseDamage);assert.equal(i.appliedEffects.find(e=>e.kind==='drain').amount,i.damage);
});
for(const id of [0x3c,0x41])test('MP damage uses corrected final HP damage '+id,()=>{
 const r=run([unit('P',id,{initialPowers:{poison:true}})],[unit('E',6)]),a=action(r),i=a.impacts[0];assert.equal(i.damage,i.baseDamage);assert.ok(a.resourceDiagnostics.includes('MP damage: '+Math.floor(i.damage/2)));
});
test('Poison Body reaction remains immediate and has no recovery roll for Poison',()=>{
 const random=rng(),r=run([unit('P',6)],[unit('E',6,{initialStatuses:{'poison-body':true}})],{rng:random});
 assert.equal(action(r).supportEvents.find(e=>e.kind==='poison-body').targetId,'player-0');assert.equal(action(r,'E').impacts[0].poisonBonusDamage,10);
 assert.ok(!random.draws.some(d=>d.category==='status-recovery-poison'));
});

test('source audit covers every canonical Poison descriptor and both Power grants',()=>{
 const direct=data.BATTLE_SKILLS.filter(s=>s.effects.some(e=>e.kind==='status-application'&&e.status==='poison'));
 assert.deepEqual(direct.map(s=>s.id),[1,0x6b,0x82,0xd7]);
 const powers=data.BATTLE_SKILLS.filter(s=>s.effects.some(e=>e.kind==='temporary-attack-power'&&e.power==='poison'));
 assert.deepEqual(powers.map(s=>s.id),[0xba,0xd7]);
 const wave=data.getBattleSkillById(0xd7),effect=wave.effects.find(e=>e.kind==='status-application'&&e.status==='poison');
 assert.equal(load('src/utils/battle/battleEffectCoverage.ts').classifyEffect(effect,wave).status,'ignored-by-project');
});
test('Musical Fist conversion preserves corrected first-hit amount',()=>{
 const p=unit('P',0x50,{initialPowers:{poison:true}}),e=unit('E',6,{currentHp:500});p.digimon.type='Virus';e.digimon.type='Vaccine';
 const i=action(run([p],[e])).impacts[0];assert.equal(i.damage,0);assert.equal(i.healing,i.baseDamage);assert.equal(i.poisonBonusDamage,0);assert.equal(i.statusApplications[0].applied,true);
});
test('Party Time user-Poison AP scaling remains independent of new target Poison',()=>{
 const id=data.getBattleSkillByName('Party Time').id;
 const p=unit('P',id,{initialStatuses:{poison:true}}),e=unit('E',6);
 const baseline=action(run([p],[e])).impacts[0];p.initialPowers={poison:true};const a=action(run([p],[e]));
 assert.equal(a.impacts[0].damage,baseline.damage);assert.equal(a.impacts[0].poisonBonusDamage,0);assert.ok(a.effectAudit.some(t=>t.includes('Party Time AP bonus')));
});
const {fixture}=require('./helpers/simulationReportFixtures.cjs');
const {serializeBattleSimulationReportJson:json,serializeBattleSimulationReportMarkdown:markdown}=load('src/utils/battle/battleSimulationReportSerialization.ts');
for(const method of ['random-monte-carlo','optimized-action-search'])for(const policy of ['natural','tas-luck'])for(const objective of (method==='random-monte-carlo'?['fastest-potential']:['fastest-potential','average-victory','success-rate']))test(`retained search/report corrected history ${method} ${policy} ${objective}`,()=>{
 const input={player:[unit('P',6,{initialPowers:{poison:true},stats:{spd:100}})],enemy:[unit('E',6,{currentHp:45,stats:{spd:1}})],floorSpecialty:'None'};
 const h=fixture({method,rngPolicy:policy,objective,input,budget:64});
 const hits=h.report.executedBattle.actions.filter(a=>a.actorName==='P').flatMap(a=>a.impacts);
 assert.deepEqual(hits.map(i=>i.damage),[20,30]);assert.deepEqual(hits.map(i=>i.poisonBonusDamage),[0,10]);
 assert.equal(hits[0].statusApplications.find(s=>s.condition==='poison-power').applied,true);
 assert.equal(hits[0].hpAfter,25);assert.equal(hits[1].hpAfter,0);
 assert.equal(h.report.reportVersion,1);assert.deepEqual(JSON.parse(json(h.report)),h.report);
 const md=markdown(h.report);assert.match(md,/20/);assert.match(md,/30/);assert.match(md,/poison-power/);
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{ActionHistory}=load('src/components/BattleResults.tsx');
 const rendered=renderToStaticMarkup(React.createElement(ActionHistory,{actions:h.report.executedBattle.actions}));
 assert.match(rendered,/20 damage/);assert.match(rendered,/30 damage/);assert.match(rendered,/Poison/);
 if(policy==='tas-luck'){assert.equal(h.result.tasLuckSummary.opportunities,0);assert.equal(h.result.tasLuckSummary.branchesExplored,0);}
});
test('corrected first-hit HP can require another action at the old lethal threshold',()=>{
 const r=run([unit('P',6,{initialPowers:{poison:true},stats:{spd:100}})],[unit('E',6,{currentHp:25,stats:{spd:1}})],{maxRounds:2});
 const hits=r.actions.filter(a=>a.actorName==='P').flatMap(a=>a.impacts);
 assert.equal(hits[0].baseDamage,20);assert.equal(hits[0].hpAfter,5);assert.equal(hits[1].damage,30);assert.equal(hits[1].hpAfter,0);
});
