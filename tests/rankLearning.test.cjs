const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');
const {load}=require('./helpers/loadTs.cjs');
const React=require('react');const {renderToStaticMarkup:render}=require('react-dom/server');
const ready=require('./fixtures/route-snow-ready.json');
const evolved=require('./fixtures/route-snow-evolved.json');
const long=require('./fixtures/route-long.json');
const recording=load('src/utils/runBattleRecording.ts');
const {getBattleTechniqueChoices}=load('src/utils/battleTechniqueChoices.ts');
const {getBattleLearningWarnings:warnings}=load('src/utils/battleLearningWarnings.ts');
const {getBattleTechniqueProgression:project}=load('src/utils/battleTechniqueProgression.ts');
const {advanceTechniqueState:advance,calculateDnaTechniqueState:dna,createAvailableTechniqueState:available,isValidTechniqueState}=load('src/utils/techniqueInheritance.ts');
const {getSpeciesProgression:metadata}=load('src/data/speciesProgression.ts');
const {getDigimonByName}=load('src/utils/digimonLookup.ts');
const {canCompleteLearningMilestone:gate}=load('src/utils/learningMilestones.ts');
const {recordRunDigivolution:evolve}=load('src/utils/runDigivolutionRecording.ts');
const {previewNormalDigivolution}=load('src/utils/normalDigivolution.ts');
const {undoLastAction}=load('src/utils/runActionUndo.ts');
const {validateRunPlan}=load('src/utils/runInvariants.ts');
const storage=load('src/utils/runPlannerStorage.ts');
const {getRequiredTotalXpForLevel:xpFor}=load('src/utils/experience.ts');
const {buildRouteDocument,DEFAULT_ROUTE_OPTIONS}=load('src/utils/routeDocument.ts');
const {RouteDocument}=load('src/components/run-planner/export/RouteDocument.tsx');
const {BattleLearningWarnings}=load('src/components/run-planner/BattleLearningWarnings.tsx');
const {BattleRecordControls}=load('src/components/run-planner/BattleRecordControls.tsx');
const snow=ready.roster.find(p=>p.name==='SnowAgumon'),id=snow.instanceId;
const event=ready.history.at(-1);
const battle={domainId:event.domainId,phase:event.phase,floor:event.floor,encounterId:event.encounterId};
const reward=recording.getRecordingEncounter(battle).preview.reward;
const after=recording.recordRunBattle(ready,battle).run;
const member=run=>run.roster.find(p=>p.instanceId===id);
const pool=(p,name)=>p.techniquePool.find(t=>t.name===name);
const names=['Nova Blast','SubzeroIcePunch'];
const envelope=run=>({schemaVersion:7,runs:[run],activeRunId:run.id});
const parent=(instanceId,techs)=>({instanceId,...available(techs,{type:'inherited',parentInstanceId:'ancestor'})});
function state(name,level,techs){const speciesId=getDigimonByName(name).id;return dna({speciesId,actualRank:metadata(speciesId).rank,startingLevel:level},parent('a',techs),parent('b',[]));}
function subject(name,level,techs){const speciesId=getDigimonByName(name).id;return {...snow,name,speciesId,level,totalXp:xpFor(level+1)-1,levelCap:{min:53,max:53,resolved:53},...state(name,1,techs)};}
const withMember=p=>({...ready,roster:[p],digiline:[p.instanceId]});
function memory(run){let raw=JSON.stringify(envelope(run));global.localStorage={getItem:()=>raw,setItem:(_,value)=>{raw=value;},removeItem:()=>{raw=null;}};}
function hookHost(){const slots=[];let cursor=0;const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];}};const js=ts.transpileModule(fs.readFileSync('src/hooks/useRunPlanner.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports',js)(id=>id==='react'?react:load('src/'+id.slice(2)+'.ts'),mod,mod.exports);return ()=>{cursor=0;return mod.exports.useRunPlanner();};}

test('Rookie SnowAgumon crosses EL12 without learning Champion techniques',()=>{assert.equal(member(after).name,'SnowAgumon');assert.equal(member(after).level,12);assert.deepEqual(member(after).techs,snow.techs);});
for(const name of names){test(name+' becomes missed at effective EL12',()=>assert.deepEqual(pool(member(after),name).unlock,{status:'missed',level:12}));test(name+' is absent from possession and pending',()=>{assert.ok(!member(after).techs.includes(name));assert.notEqual(pool(member(after),name).unlock.status,'pending');});}
test('blocked learning never requests capacity selection, including explicit review',()=>{assert.deepEqual(getBattleTechniqueChoices(ready.roster,ready.digiline,reward.xp),[]);assert.doesNotThrow(()=>recording.recordRunBattle(ready,{...battle,reviewTechniques:true}));});
test('miss battle applies XP stats Bits atomically without mutating input',()=>{assert.equal(member(after).totalXp,snow.totalXp+reward.xp);assert.notDeepEqual(member(after).stats,snow.stats);assert.equal(after.totalBits,ready.totalBits+reward.bits);assert.equal(snow.level,11);for(const n of names)assert.equal(pool(snow,n).unlock.status,'pending');});
test('Frigimon evolution before EL12 offers both canonical potentials',()=>{const next=evolve(ready,id).run;assert.equal(member(next).name,'Frigimon');const choices=getBattleTechniqueChoices(next.roster,next.digiline,reward.xp);for(const name of names)assert.ok(choices[0].choice.candidates.some(p=>p.name===name));assert.deepEqual(warnings(next,battle),[]);});
for(const [name,level,tech,target] of [['Greymon',21,'Ninja Flower','Ultimate'],['MetalGreymon',31,'Terra Force','Mega']]){
 test(name+' misses EL'+(level+1)+' event below required rank',()=>{const p=subject(name,level,[tech]);const result=project(p,reward.xp);assert.deepEqual(pool(result.state,tech).unlock,{status:'missed',level:level+1});assert.deepEqual(result.state.techs,p.techs);});
 test(name+' evolved to '+target+' allows milestone learning',()=>{const p=subject(name,level,[tech]);p.dp=20;const next=previewNormalDigivolution(p);assert.equal(next.canDigivolve,true);assert.equal(metadata(next.digimon.speciesId).rank,target);assert.ok(project(next.digimon,reward.xp).state.learnedTechniques.includes(tech));});
 test(name+' projected rank skip produces warning',()=>assert.equal(warnings(withMember(subject(name,level,[tech])),battle)[0].requiredRank,target));
}
test('EL2 accepts every current rank',()=>{for(const rank of ['Rookie','Champion','Ultimate','Mega'])assert.equal(gate(rank,2),true);});
test('all milestone gate rank combinations',()=>{const ranks=['Rookie','Champion','Ultimate','Mega'];for(const [i,level]of[2,12,22,32].entries())for(const [j,rank]of ranks.entries())assert.equal(gate(rank,level),j>=i);});
test('warning predicts SnowAgumon EL11 to EL12',()=>{const w=warnings(ready,battle)[0];assert.equal(w.name,'SnowAgumon');assert.equal(w.projectedLevel,12);assert.equal(w.requiredRank,'Champion');});
test('insufficient XP produces no warning',()=>{const p={...snow,totalXp:0};const weak=load('src/data/domainGroups.ts').DOMAIN_GROUPS.map(g=>({domainId:g.domainId,phase:g.phase,floor:g.floors[0],encounterId:g.encounterId})).find(s=>recording.getRecordingEncounter(s)?.preview?.reward?.xp<10);assert.ok(weak);assert.deepEqual(warnings(withMember(p),weak),[]);});
test('capped EL11 produces no warning',()=>assert.deepEqual(warnings(withMember({...snow,levelCap:{min:11,max:11,resolved:11}}),battle),[]));
test('inactive participant produces no warning',()=>assert.deepEqual(warnings({...ready,digiline:[]},battle),[]));
test('unselected encounter produces no warning',()=>assert.deepEqual(warnings(ready,{...battle,encounterId:null}),[]));
test('warning lists pending techniques and deduplicates next own technique',()=>assert.deepEqual(warnings(ready,battle)[0].techniques.toSorted(),names.toSorted()));
test('deterministic future own technique warns without entering current pool',()=>{const p={...snow,techniquePool:snow.techniquePool.filter(t=>t.unlock.status!=='pending')};const before=JSON.stringify(p);assert.deepEqual(warnings(withMember(p),battle)[0].techniques,['SubzeroIcePunch']);assert.equal(JSON.stringify(p),before);});
test('multiple participants keep separate names and technique lists in UI',()=>{const p={...subject('Greymon',21,['Ninja Flower']),instanceId:'second'};const list=warnings({...ready,roster:[snow,p],digiline:[id,p.instanceId]},battle);assert.equal(list.length,2);assert.deepEqual(list[0].techniques.toSorted(),names.toSorted());assert.ok(list[1].techniques.includes('Ninja Flower'));const html=render(React.createElement(BattleLearningWarnings,{warnings:list}));assert.match(html,/SnowAgumon/);assert.match(html,/Greymon/);});
test('warning is informational and Record Battle remains enabled',()=>{const html=render(React.createElement(BattleRecordControls,{run:ready,selection:battle,hasParticipants:true,onRecord:()=>null}));assert.match(html,/Evolution warning/);assert.match(html,/<button(?![^>]* disabled=)[^>]*>Record Battle<\/button>/);assert.ok(!html.includes('text-destructive'));});
for(const [name,level,techs]of[['Greymon',11,['Pepper Breath','SubzeroIcePunch']],['MetalGreymon',21,['Pepper Breath','Nova Blast','Ninja Flower']],['Vademon',21,['Pepper Breath','Nova Blast','Ninja Flower']],['Yanmamon',11,['Pepper Breath','Nova Blast']],['SandYanmamon',11,['Pepper Breath','Nova Blast']]]){
 test(name+' DNA birth keeps own and learns all inherited lower-rank batch',()=>{const before=state(name,level,techs);assert.equal(before.techs.length,1);const next=advance(before,level,level+1,metadata(getDigimonByName(name).id).rank);for(const tech of techs)assert.ok(next.techs.includes(tech));assert.equal(next.missedTechniques.length,0);assert.equal(isValidTechniqueState(next),true);});
}
test('shifted Rookie potential can be missed at EL12 and remains valid',()=>{const before=state('Greymon',11,['Pepper Breath']);const next=advance(before,11,12,'Rookie');assert.deepEqual(pool(next,'Pepper Breath').unlock,{status:'missed',level:12});assert.equal(isValidTechniqueState(next),true);assert.deepEqual(advance(next,12,13,'Champion').techs,next.techs);});
test('late normal evolution cannot recover either missed technique',()=>{const next=evolve(after,id).run;assert.equal(member(next).name,'Frigimon');for(const name of names)assert.deepEqual(pool(member(next),name).unlock,{status:'missed',level:12});assert.deepEqual(getBattleTechniqueChoices(next.roster,next.digiline,reward.xp),[]);});
test('miss state survives validated save reload',()=>{memory(ready);assert.equal(storage.saveRunPlannerData(envelope(after)),true);assert.deepEqual(storage.loadRunPlannerData().runs[0],after);});
test('Undo restores complete pending checkpoint and warning',()=>{const result=undoLastAction(after);assert.equal(result.ok,true);assert.deepEqual(result.run.roster,ready.roster);assert.equal(result.run.totalBits,ready.totalBits);assert.deepEqual(warnings(result.run,battle),warnings(ready,battle));});
test('repeated battle after Undo reproduces state and audit',()=>{const repeated=recording.recordRunBattle(undoLastAction(after).run,battle).run;assert.deepEqual(repeated.roster,after.roster);assert.deepEqual(repeated.history.at(-1).techniqueMisses,after.history.at(-1).techniqueMisses);});
test('stale reviewed battle rejects intervening evolution and fresh callback requests choices',()=>{memory(ready);const host=hookHost(),old=host();assert.equal(old.digivolve(ready.id,snow),true);assert.equal(old.recordBattle(battle),null);const current=host();assert.equal(member(current.activeRun).name,'Frigimon');assert.equal(current.recordBattle(battle).status,'selection-required');});
test('chronological validation accepts real miss transition',()=>assert.deepEqual(validateRunPlan(after),[]));
test('chronological validation rejects tampered available state',()=>{const bad=structuredClone(after);pool(member(bad),names[0]).unlock={status:'available'};member(bad).techs.push(names[0]);assert.ok(validateRunPlan(bad).length);});
test('historical miss audit cannot be removed altered or duplicated',()=>{for(const audit of [undefined,[],[{instanceId:id,missed:[names[0]]}],[...after.history.at(-1).techniqueMisses,...after.history.at(-1).techniqueMisses]]){const bad=structuredClone(after);bad.history.at(-1).techniqueMisses=audit;assert.ok(validateRunPlan(bad).length);}});
test('regenerated long route contains actual Rookie missed learning event',()=>{const action=long.history.find(e=>e.techniqueMisses?.some(p=>p.instanceId===id));assert.ok(action);assert.equal(action.preActionCheckpoint.roster.find(p=>p.instanceId===id).name,'SnowAgumon');assert.deepEqual(action.techniqueChoices,[]);});
test('final long SnowAgumon Rookie EL14 lacks missed Champion techniques',()=>{const p=member(long);assert.equal(p.name,'SnowAgumon');assert.equal(p.level,14);for(const name of names)assert.ok(!p.techs.includes(name));assert.deepEqual(validateRunPlan(long),[]);});
test('valid Frigimon and Greymon learning remains exported',()=>{const model=buildRouteDocument(evolved,new Date(0));const frigimon=model.actions.flatMap(a=>a.decisions).find(d=>d.name==='Frigimon');for(const name of names)assert.ok(frigimon.learned.includes(name));assert.ok(model.actions.flatMap(a=>a.decisions).some(d=>d.name==='Greymon'&&d.discarded.includes('Nova Blast')));});
test('export renders historical Missed separately and is read only',()=>{const before=JSON.stringify(after);const model=buildRouteDocument(after,new Date(0));assert.deepEqual(model.actions.at(-1).misses,[{name:'SnowAgumon',missed:after.history.at(-1).techniqueMisses[0].missed}]);const html=render(React.createElement(RouteDocument,{model,options:DEFAULT_ROUTE_OPTIONS}));assert.match(html,/SnowAgumon — Missed:/);assert.equal(JSON.stringify(after),before);});

test('blocked milestone preserves normal capture and its reward atomically',()=>{const request=load('src/data/domainGroups.ts').DOMAIN_GROUPS.map(g=>({domainId:g.domainId,phase:g.phase,floor:g.floors[0],encounterId:g.encounterId})).flatMap(s=>recording.getCaptureChoices(s).filter(c=>!c.unavailableReason).map(c=>({...s,capturedEnemySlot:c.slot,capturedMaxLevel:c.levelCap.max})))[0];assert.ok(request);const result=recording.recordRunBattle(ready,request);assert.ok(result.event.capturedInstanceId);assert.equal(result.run.roster.length,ready.roster.length+1);assert.equal(member(result.run).level,12);assert.deepEqual(member(result.run).techs,snow.techs);assert.deepEqual(result.event.techniqueMisses,after.history.at(-1).techniqueMisses);assert.deepEqual(validateRunPlan(result.run),[]);});
test('History displays actual miss audit separately from learned and discarded',()=>{const {RunHistory}=load('src/components/run-planner/RunHistory.tsx');const html=render(React.createElement(RunHistory,{run:after,onUndo:()=>{},error:null}));assert.match(html,/SnowAgumon: Missed techniques: Nova Blast, SubzeroIcePunch/);});
