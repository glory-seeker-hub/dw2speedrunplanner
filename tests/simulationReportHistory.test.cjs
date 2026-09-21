const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,buildBattleSimulationReport,load}=require('./helpers/simulationReportFixtures.cjs');
const {unit,run,data,rng}=require('./helpers/battleSupportFixtures.cjs');
const {serializeBattleSimulationReportMarkdown:md,serializeBattleSimulationReportJson:json,reportText}=load('src/utils/battle/battleSimulationReportSerialization.ts');
// Serializer fixtures retain real canonical engine action records. No export-side effect calculations.
for(const name of ['HP Zapper','Critical Blow','Musical Fist','Twig Tap','Party Time','Banana Slip','Fantasmic Ray','Shadow Scythe','Light Gun','Rock Fist'])test('canonical executed history preserved: '+name,()=>{
 const skill=data.getBattleSkillByName(name);assert.ok(skill,name);
 const battle=run([unit('P',skill.id),unit('P2',6)],[unit('E',6)],{simulationRules:{accuracyMode:'strategy',rngPolicy:'natural'}});
 const h=fixture();h.result.optimized.fastestRoute.actions=battle.actions;h.result.optimized.fastestRoute.totalFrames=battle.knownFrames;
 const report=buildBattleSimulationReport(h.result,h.job);assert.deepEqual(report.executedBattle.actions,JSON.parse(JSON.stringify(battle.actions)));
 const text=md(report);assert.ok(text.includes(reportText(name)));assert.ok(text.includes('MP accounting'));assert.deepEqual(JSON.parse(json(report)).executedBattle.actions,report.executedBattle.actions);
});
for(const [name,player,enemy,options] of [
 ['Hit',[unit('P',6)],[unit('E',6)],{simulationRules:{accuracyMode:'strategy'}}],
 ['Miss',[unit('P',6,{initialStatuses:{paralysis:true}})],[unit('E',6)],{rng:rng({'paralysis-failure':[1]}),simulationRules:{accuracyMode:'strategy'}}],
 ['Guard',[unit('P',6,{initialStatuses:{'motivation-down':true}})],[unit('E',6)],{simulationRules:{accuracyMode:'strategy'},actionPolicy:load('src/utils/battle/battleActions.ts').legacyActionPolicy}],
 ['Counter',[unit('P',0x85)],[unit('E',6)],{simulationRules:{accuracyMode:'strategy'}}],
 ['Interrupt',[unit('P',6)],[unit('E',0xa6)],{simulationRules:{accuracyMode:'strategy'}}],
 ['Assist',[unit('P',0x40)],[unit('E',6)],{simulationRules:{accuracyMode:'strategy'}}],
 ['status recovery',[unit('P',6,{initialStatuses:{poison:true,paralysis:true}})],[unit('E',6)],{simulationRules:{accuracyMode:'strategy',rngPolicy:'tas-favorable'}}],
 ['status application',[unit('P',105)],[unit('E',6)],{simulationRules:{accuracyMode:'strategy',rngPolicy:'tas-favorable'}}],
])test('serializer retained event detail: '+name,()=>{
 const battle=run(player,enemy,options),h=fixture();h.result.optimized.fastestRoute.actions=battle.actions;
 const report=buildBattleSimulationReport(h.result,h.job),text=md(report);assert.deepEqual(JSON.parse(json(report)).executedBattle.actions,JSON.parse(JSON.stringify(battle.actions)));
 for(const a of battle.actions){assert.ok(text.includes(reportText(a.actorName)));assert.ok(text.includes(reportText(a.outcome)));if(a.mpAccounting)assert.ok(text.includes('MP accounting'));if(a.counter)assert.ok(text.includes('Counter'));if(a.interrupt)assert.ok(text.includes('Interrupt'));if(a.supportEvents?.length)assert.ok(text.includes('Support events'));}
 if(name==='Miss')assert.ok(battle.actions.some(a=>a.outcome==='miss'));
 if(name==='Guard')assert.ok(battle.actions.some(a=>a.outcome==='guard'));
});
