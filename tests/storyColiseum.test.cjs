const {test}=require('node:test');const assert=require('node:assert/strict');
const {load,record,locations,buildPlannerBattleAnalysisPreset}=require('./helpers/plannerAnalysisFixtures.cjs');
const {createRunPlan}=load('src/utils/runPlanCreation.ts');
const {recordRunBattle,getRecordingEncounter,getCaptureChoices}=load('src/utils/runBattleRecording.ts');
const {COLISEUM_BATTLES,COLISEUM_LOCATION,validateColiseumBattles}=load('src/data/coliseumBattles.ts');
const {STORY_SEGMENTS,STORY_DOMAINS,validateStoryDomains}=load('src/data/storySegments.ts');
const {encounters}=load('src/data/encounters.ts');
const {getBattleProgressionPolicy}=load('src/utils/battleProgressionPolicy.ts');
const {resolveBattle}=load('src/utils/runProgression.ts');
const {isValidPersistedRunPlannerData}=load('src/utils/runPlannerStorage.ts');
const {getRequiredTotalXpForLevel}=load('src/utils/experience.ts');
const {undoLastAction}=load('src/utils/runActionUndo.ts');
const {buildRouteDocument}=load('src/utils/routeDocument.ts');
const {isValidRunEvent}=load('src/utils/runEventValidation.ts');
const {getBattleLearningWarnings}=load('src/utils/battleLearningWarnings.ts');
const col=id=>({...COLISEUM_LOCATION,encounterId:id});
const rich=locations.reduce((a,b)=>(getRecordingEncounter(b)?.preview?.reward?.xp??0)>(getRecordingEncounter(a)?.preview?.reward?.xp??0)?b:a);
function pending(){const run=record(createRunPlan('gold-hawk','Pending XP'),rich);assert.ok(run.roster[0].totalXp>=getRequiredTotalXpForLevel(run.roster[0].level+1));return run;}
test('story allocation: all 33 variants exactly once, progression counts/order and legacy DVD identity',()=>{
 assert.deepEqual(validateStoryDomains(),[]);assert.deepEqual(Object.values(STORY_DOMAINS).map(d=>d.length),[8,10,9,6]);
 assert.deepEqual(STORY_SEGMENTS.map(s=>s.label),['Before Blood Knights','After Blood Knights','File Island','After File Island','Coliseum']);
 assert.deepEqual(STORY_DOMAINS['before-blood-knights'].map(d=>d.domainId),['boot','scsi','disk','video','bios','web','drive','modem'].map(x=>x+'-domain'));
 assert.deepEqual(STORY_DOMAINS['after-blood-knights'].map(d=>d.domainId),['scsi','disk','video','bios','web','drive','modem','dvd','code','laser'].map(x=>x+'-domain'));
 assert.deepEqual(STORY_DOMAINS['file-island'].map(d=>d.domainId),['power','port','giga','scan','diode','patch','mega','data','soft']);
 assert.deepEqual(STORY_DOMAINS['after-file-island'].map(d=>d.domainId),['bug-domain','ram-domain','rom-domain','core-tower','chaos-tower','tera-domain']);
});
test('24 ordered canonical Coliseum entries, no ordinary location overlap',()=>{assert.deepEqual(validateColiseumBattles(),[]);assert.equal(COLISEUM_BATTLES.length,24);assert.ok(!locations.some(l=>COLISEUM_BATTLES.some(b=>b.encounterId===l.encounterId)));});
const lineups={158:['Patamon','ToyAgumon','Gizamon'],163:['Gabumon','Raremon','Penguinmon'],168:['Woodmon','Bakemon','Soulmon'],169:['Centarumon','Tyrannomon','Monochromon'],174:['Lillymon','Angewomon','Etemon'],175:['Myotismon','Phantomon','Megadramon'],177:['Deramon','Blossomon','Pumpkinmon'],181:['Magnadramon','Jijimon','MarineAngemon']};
for(const [id,names] of Object.entries(lineups))test('canonical lineup '+id,()=>assert.deepEqual(encounters.find(e=>e.id===+id).digimons.map(e=>e.name),names));
for(const b of COLISEUM_BATTLES)test(b.label+' records one event, canonical Analyze team, no rewards/progression/capture',()=>{
 const before=pending(),saved=JSON.stringify(before);const {run,event,resolution}=recordRunBattle(before,col(b.encounterId));
 assert.equal(JSON.stringify(before),saved);assert.equal(run.history.length,before.history.length+1);assert.deepEqual(run.roster,before.roster);assert.equal(run.totalBits,before.totalBits);
 assert.deepEqual([event.xpReward,event.bitsReward,event.techniqueChoices.length,resolution.techniqueMisses.length],[0,0,0,0]);assert.ok(resolution.outcomes.every(o=>!o.leveledUp&&o.growth===null&&o.actualXpApplied===0));
 assert.deepEqual(getCaptureChoices(col(b.encounterId)),[]);assert.throws(()=>recordRunBattle(before,{...col(b.encounterId),capturedEnemySlot:1}),/capture/i);
 const preset=buildPlannerBattleAnalysisPreset(run,event.id),canonical=encounters.find(e=>e.id===b.encounterId);
 assert.deepEqual(preset.enemyTeam.map(e=>e.digimon.name),canonical.digimons.map(e=>e.name));
 assert.deepEqual(preset.enemyTeam.map(e=>e.techs.map(t=>t.canonicalSkillId)),canonical.digimons.map(e=>e.techs.map(name=>load('src/data/battleSkills.ts').getBattleSkillByName(name).id)));
 assert.deepEqual(preset.enemyTeam.map(e=>e.customStats),canonical.digimons.map(e=>({hp:e.hp,mp:e.mp,atk:e.atk,def:e.def,spd:e.spd})));
 assert.deepEqual(getBattleLearningWarnings(before,col(b.encounterId)),[]);assert.equal(getBattleProgressionPolicy(b.encounterId).resolveLevelUp,false);
});
test('normal -> A/B/C with pending XP -> normal; v7 reload, middle history, export, undo and isolation',()=>{
 const before=pending(),other=createRunPlan('blue-falcon','Other'),otherJson=JSON.stringify(other);let run=before;
 for(const id of [158,159,160]){run=record(run,col(id));assert.deepEqual(run.roster,before.roster);assert.equal(run.totalBits,before.totalBits);}
 const abc=run;run=record(run,rich);assert.equal(run.roster[0].level,before.roster[0].level+1);assert.ok(run.roster[0].totalXp>before.roster[0].totalXp);assert.ok(run.totalBits>before.totalBits);
 const saved=JSON.parse(JSON.stringify({schemaVersion:7,runs:[run,other],activeRunId:run.id}));assert.equal(isValidPersistedRunPlannerData(saved),true);assert.equal(JSON.stringify(other),otherJson);
 const preset=buildPlannerBattleAnalysisPreset(saved.runs[0],run.history[2].id);assert.equal(preset.source.encounterId,159);assert.equal(preset.playerTeam[0].level,before.roster[0].level);
 const doc=buildRouteDocument(saved.runs[0],new Date('2026-09-21'));for(let i=1;i<=3;i++){assert.match(doc.actions[i].lines[0],/Coliseum · Rank 2-[ABC]/);assert.equal(doc.actions[i].rewards,'0 XP · 0 Bits · No level-up');}
 const undo=undoLastAction(abc);assert.equal(undo.ok,true);assert.deepEqual(undo.run.roster,before.roster);assert.equal(undo.run.totalBits,before.totalBits);assert.equal(undo.run.history.length,abc.history.length-1);
 for(const field of ['xpReward','bitsReward'])assert.equal(isValidRunEvent({...abc.history[1],[field]:1}),false);
 assert.equal(isValidRunEvent({...abc.history[1],domainId:'scsi-domain',floor:1}),false);
});
test('three participants: two pending levels, one without pending XP; caps and technique milestone untouched',()=>{
 const starter=createRunPlan('gold-hawk','Party').roster[0];
 const roster=[{...starter,instanceId:'p1',level:10,totalXp:getRequiredTotalXpForLevel(12)},{...starter,instanceId:'p2'},{...starter,instanceId:'p3',level:10,totalXp:getRequiredTotalXpForLevel(12),levelCap:{min:10,max:10,resolved:10}}];
 for(const id of [164,165,166]){const r=resolveBattle({encounterId:id,roster,digilineInstanceIds:roster.map(p=>p.instanceId),totalBits:1234});assert.deepEqual(r.roster,roster);assert.equal(r.totalBits,1234);assert.deepEqual(r.techniqueChoices,[]);assert.deepEqual(r.techniqueMisses,[]);}
});
test('selector resets normal/Coliseum choices and rejects stale encounters',()=>{
 const {battleSelectionReducer:r,initialBattleSelection}=load('src/utils/runBattleSelection.ts');let s=r(initialBattleSelection,{type:'coliseum'});s=r(s,{type:'encounter',encounterId:174});assert.equal(getRecordingEncounter(s).encounterId,174);
 s=r(s,{type:'location',domainId:'power',phase:'after-blood-knights'});assert.equal(s.encounterId,null);assert.equal(s.floor,null);s=r(s,{type:'encounter',encounterId:174});assert.equal(s.encounterId,null);
 s=r(s,{type:'coliseum'});assert.equal(s.encounterId,null);assert.equal(s.domainId,COLISEUM_LOCATION.domainId);assert.equal(s.floor,0);
});
for(const rngPolicy of ['natural','tas-luck'])test('canonical Coliseum simulation and immutable Report v1 '+rngPolicy,()=>{
 const run=record(pending(),col(158));const preset=buildPlannerBattleAnalysisPreset(run,run.history.at(-1).id);const input={player:preset.playerTeam,enemy:preset.enemyTeam,floorSpecialty:'None'};
 const {fixture}=require('./helpers/simulationReportFixtures.cjs');const {report}=fixture({input,method:'random-monte-carlo',budget:1,rngPolicy,plannerProvenance:preset});
 assert.equal(report.reportVersion,1);assert.match(report.battle.label,/Coliseum · Rank 2-A/);assert.equal(report.battle.encounterId,158);assert.deepEqual(JSON.parse(JSON.stringify(report)).battle,report.battle);
 const serializer=load('src/utils/battle/battleSimulationReportSerialization.ts');const markdown=serializer.serializeBattleSimulationReportMarkdown(report);assert.match(markdown,/Coliseum/);
});
