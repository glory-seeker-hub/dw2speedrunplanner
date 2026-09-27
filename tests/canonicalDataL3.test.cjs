const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {unit,first,rng,run,action,data,load}=require('./helpers/battleSupportFixtures.cjs');
const {DIGIMONS}=load('src/data/digimons.ts');
const {getSpecies,getDigimonById,getDigimonByName,ALL_SPECIES}=load('src/utils/digimonLookup.ts');
const {TECHS}=load('src/data/techs.ts');
const {getTechByName}=load('src/utils/techLookup.ts');
const {decodeByte3,decodeByte4,normalizeWazaRecord,exportWazaBytes}=load('src/utils/battleSkillDecoder.ts');
const {WAZADATA_RECORDS}=load('src/data/wazaSource.ts');
const {createBattleState}=load('src/utils/battle/battleInput.ts');
const {planAction}=load('src/utils/battle/battleActions.ts');
const {calculateActionDamage}=load('src/utils/battle/battleDamage.ts');
const species=getDigimonById('p-sukamon'),wing=data.getBattleSkillById(0xa1);
test('P-Sukamon is a single canonical Machine species and matching runtime/CSV entry',()=>{
 assert.equal(DIGIMONS.filter(d=>d.id==='p-sukamon').length,1);assert.equal(DIGIMONS.filter(d=>d.name==='P-Sukamon').length,1);
 assert.equal(species.specialty,'Machine');assert.notEqual(species.specialty,'Dark');assert.equal(ALL_SPECIES.find(d=>d.id===species.id).specialty,'Machine');
 const lines=fs.readFileSync('src/data/digimon_data.csv','utf8').split(/\r?\n/).filter(l=>l.startsWith('P-Sukamon,'));assert.deepEqual(lines,['P-Sukamon,Virus,Machine']);
});
for(const name of ['P-Sukamon','p-sukamon','P Sukamon','P.Sukamon','PSUKAMON'])test('P-Sukamon normalization shares corrected record '+name,()=>{
 assert.equal(getDigimonByName(name),species);assert.equal(getSpecies(name).specialty,'Machine');
});
const roster={...structuredClone(require('./fixtures/route-short.json').roster[0]),speciesId:'p-sukamon',name:'P-Sukamon',techs:['Rock Fist']};
test('Planner and historical team adapters dynamically resolve saved species identity',()=>{
 const before=JSON.stringify(roster);assert.equal('specialty' in roster,false);
 const {rosterDigimonToTeamDigimon}=load('src/utils/runPlannerBattleAdapter.ts');
 const {historicalPlayerTeam}=load('src/utils/runPlanner/runBattleAnalysis.ts');
 const current=rosterDigimonToTeamDigimon(roster),historical=historicalPlayerTeam({roster:[roster],digiline:[roster.instanceId]})[0];
 assert.equal(current.digimon.specialty,'Machine');assert.equal(historical.digimon.specialty,'Machine');
 assert.equal(createBattleState({player:[historical],enemy:[unit('E',6)],floorSpecialty:'None'}).combatants[0].specialty,'Machine');
 assert.equal(JSON.stringify(roster),before);assert.equal(load('src/utils/runPlannerStorage.ts').RUN_PLANNER_SCHEMA_VERSION,7);
});
test('all production P-Sukamon encounter slots inherit Machine without slot patches',()=>{
 const {encounters}=load('src/data/encounters.ts'),{encounterToBattleTeam}=load('src/utils/battle/battleEncounter.ts');
 const matches=encounters.filter(e=>e.digimons.some(d=>d.name==='P-Sukamon'));assert.ok(matches.length>0);
 for(const e of matches)assert.equal(encounterToBattleTeam(e).find(m=>m.digimon.id==='p-sukamon').digimon.specialty,'Machine');
});
test('Team Builder species card renders Machine without source warnings',()=>{
 const React=require('react'),{renderToStaticMarkup:html}=require('react-dom/server'),{DigimonCard}=load('src/components/DigimonCard.tsx');
 const rendered=html(React.createElement(DigimonCard,{digimon:species}));assert.match(rendered,/>Machine</);assert.doesNotMatch(rendered,/Dark|MetalKid/);
});
test('Wing Blade exact identity already decodes Interrupt Nature; V-Wing Blade stays separate',()=>{
 assert.equal(wing.name,'Wing Blade');assert.equal(wing.id,0x00a1);assert.equal(wing.actionKind,'interrupt');assert.equal(wing.element,'Nature');
 assert.equal(data.BATTLE_SKILLS.filter(s=>s.name==='Wing Blade').length,1);
 const other=data.getBattleSkillByName('V-Wing Blade');assert.equal(other.id,0x0031);assert.equal(other.actionKind,'attack');assert.equal(other.element,'Neutral');assert.notEqual(other,wing);
 assert.equal(data.getBattleSkillByName('Wing Blade'),wing);
});
test('Wing Blade source bytes and lossless decoder remain honest',()=>{
 const raw=WAZADATA_RECORDS.find(r=>r.row===258);assert.deepEqual(raw.bytes.slice(0,4),[0xa1,0,0x98,0x22]);
 assert.deepEqual(decodeByte3(raw.bytes[2]),{actionKind:'interrupt',animationKind:'projectile',targetGroup:'interrupt-target'});
 assert.deepEqual(decodeByte4(raw.bytes[3]),{rank:'Ultimate',element:'Nature'});
 assert.deepEqual(normalizeWazaRecord(raw),wing);assert.deepEqual(exportWazaBytes(wing),raw.bytes);
 assert.equal(load('src/utils/battleSkillValidation.ts').battleSourceFingerprint(),'00a1f844');
});
test('compatibility and historical skill projections preserve Nature independently of action kind',()=>{
 assert.equal(TECHS.filter(t=>t.name==='Wing Blade').length,1);assert.equal(getTechByName('Wing Blade').element,'Nature');
 const {analysisTechnique}=load('src/utils/runPlanner/runBattleAnalysis.ts');assert.equal(analysisTechnique('Wing Blade','player').element,'Nature');
 const s=createBattleState({player:[unit('P',6)],enemy:[unit('I',0xa1)],floorSpecialty:'None'});s.round=1;
 const a=planAction(s,s.combatants[1],first.chooseAction(s.combatants[1]));assert.equal(a.kind,'interrupt');assert.equal(a.skill.legacyTech.element,'Nature');
});
function damage(floor='None',specialty='Machine',element){
 const p=unit('P',6),i=unit('I',0xa1);p.digimon.specialty=specialty;
 const s=createBattleState({player:[p],enemy:[i],floorSpecialty:floor});s.round=1;
 const a=planAction(s,s.combatants[1],first.chooseAction(s.combatants[1]));if(element)a.skill={...a.skill,legacyTech:{...a.skill.legacyTech,element}};
 return calculateActionDamage(s.combatants[1],s.combatants[0],a,floor,s);
}
for(const floor of ['None','Nature','Water'])test('Wing Blade real Interrupt damage matches production Nature formula on '+floor,()=>{
 const p=unit('P',6),i=unit('I',0xa1);p.digimon.specialty='Machine';
 const r=run([p],[i],{floorSpecialty:floor}),a=action(r,'I');assert.equal(a.kind,'interrupt');assert.equal(a.durationFrames,761);
 assert.deepEqual(a.effectiveTargetIds,['player-0']);assert.equal(a.impacts[0].damage,damage(floor));assert.ok(a.impacts[0].damage>damage(floor,'Machine','None'));
 assert.equal(action(r).interrupt.restarted,true);
});
test('Nature floor boosts Wing Blade through ordinary element path; nonmatching floor does not',()=>{
 assert.ok(damage('Nature')>damage('None'));assert.equal(damage('Water'),damage('None'));
 assert.ok(damage('None','Machine')>damage('None','None'));assert.ok(damage('None','Dark')<damage('None','None'));
});
test('P-Sukamon takes Machine matchup and Machine-floor defense via canonical species',()=>{
 const p=unit('P',6);p.digimon=species;
 const plain=action(run([p],[unit('I',0xa1)]),'I').impacts[0].damage;
 const floor=action(run([p],[unit('I',0xa1)],{floorSpecialty:'Machine'}),'I').impacts[0].damage;
 const control=structuredClone(p);control.digimon={...species,id:'control-machine',name:'Control Machine'};
 assert.equal(plain,action(run([control],[unit('I',0xa1)]),'I').impacts[0].damage);assert.ok(floor<plain);
 const old=structuredClone(p);old.digimon.specialty='Dark';assert.ok(plain>action(run([old],[unit('I',0xa1)]),'I').impacts[0].damage);
});
for(const policy of ['natural','tas-luck'])test('Wing Blade Miss timing and restart preserved '+policy,()=>{
 const r=run([unit('P',6)],[unit('I',0xa1)],{rng:rng({accuracy:[0,127,0]}),simulationRules:{accuracyMode:'game-accurate',rngPolicy:policy}}),a=action(r,'I');
 assert.equal(a.outcome,'miss');assert.equal(a.durationFrames,270);assert.deepEqual(a.impacts,[]);assert.equal(action(r).interrupt.restarted,true);
});
test('Wing Blade does not trigger a Counter reaction',()=>{
 const r=run([unit('P',6),unit('C',0x86)],[unit('I',0xa1)]),i=action(r,'I');
 assert.equal(i.kind,'interrupt');assert.ok(!r.actions.some(a=>a.counter?.triggerActionId===i.id));assert.equal(action(r,'C').counter.executionMode,'untriggered-end-of-turn');
});
test('canonical self-checks enforce both reviewed identities',()=>{
 const checks=load('src/utils/dataSelfChecks.ts').runDataSelfChecks();assert.equal(checks.length,63);assert.ok(checks.every(c=>c.passed));
 assert.ok(checks.some(c=>c.name.includes('P-Sukamon')));assert.ok(checks.some(c=>c.name.includes('Wing Blade')));
});
test('report JSON and Markdown retain species/skill metadata without serializer exceptions',()=>{
 const p=unit('P',6);p.digimon=species;
 const {fixture}=require('./helpers/simulationReportFixtures.cjs');const h=fixture({method:'random-monte-carlo',budget:2,input:{player:[p],enemy:[unit('I',0xa1,{currentHp:10})],floorSpecialty:'Nature'}});
 const report=h.report,{serializeBattleSimulationReportJson:json,serializeBattleSimulationReportMarkdown:md}=load('src/utils/battle/battleSimulationReportSerialization.ts');
 assert.equal(report.playerTeam.find(a=>a.speciesId==='p-sukamon').specialty,'Machine');assert.equal(report.reportVersion,1);
 assert.ok(report.enemyTeam[0].skills.some(s=>s.canonicalSkillId===0xa1&&s.legacyTech.element==='Nature'));
 assert.ok(report.executedBattle.actions.some(a=>a.canonicalSkillId===0xa1&&a.kind==='interrupt'));
 assert.deepEqual(JSON.parse(json(report)),report);assert.match(md(report),/Machine/);assert.match(md(report),/Nature/);assert.match(md(report),/Wing Blade/);
});
