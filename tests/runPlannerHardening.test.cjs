// Production module graph: no gameplay or validation test doubles.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.DEV', 'false');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const localRequire = (id) => {
    if (!id.startsWith('@/')) return require(id);
    const base = path.join('src', id.slice(2));
    return load(base + (fs.existsSync(path.resolve(root, base + '.ts')) ? '.ts' : '.tsx'));
  };
  new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
  return mod.exports;
}
const {createRunPlan}=load('src/utils/runPlanCreation.ts');
const {validateRunPlan}=load('src/utils/runInvariants.ts');
const storage=load('src/utils/runPlannerStorage.ts');
const recording=load('src/utils/runBattleRecording.ts');
const {recordRunDigivolution}=load('src/utils/runDigivolutionRecording.ts');
const {recordDnaAction}=load('src/utils/runDnaRecording.ts');
const {recordTradeAction}=load('src/utils/runTradeRecording.ts');
const {undoLastAction}=load('src/utils/runActionUndo.ts');
const {getBattleTechniqueChoices}=load('src/utils/battleTechniqueChoices.ts');
const {BattleTechniqueSelectionRequired}=load('src/utils/techniqueCapacity.ts');
const {getSpeciesProgression}=load('src/data/speciesProgression.ts');
const {getResolvedReward}=load('src/utils/rewardMatching.ts');
const {deriveActionPostState}=load('src/utils/runTransitionValidation.ts');
const {getRequiredTotalXpForLevel}=load('src/utils/experience.ts');
const {getInitialLevelCap}=load('src/utils/levelCap.ts');
const digiline=load('src/utils/runDigiline.ts');
const envelope=run=>({schemaVersion:7,runs:[run],activeRunId:run.id});
const meaningful=({updatedAt,...run})=>run;
const member=(run,id)=>run.roster.find(p=>p.instanceId===id);
const potential=(p,name)=>p.techniquePool.find(t=>t.name===name);
let values;
beforeEach(()=>{values=new Map();global.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};});
const locations=load('src/data/domainGroups.ts').DOMAIN_GROUPS.map(g=>({domainId:g.domainId,phase:g.phase,floor:g.floors[0],encounterId:g.encounterId}))
  .filter(r=>recording.getRecordingEncounter(r)?.preview?.reward);
const battle=locations.toSorted((a,b)=>getResolvedReward(b.encounterId).xp-getResolvedReward(a.encounterId).xp)[0];
function captureRequest(name){
  const options=locations.flatMap(r=>recording.getCaptureChoices(r).filter(c=>load('src/utils/digimonLookup.ts').getDigimonByName(c.name)?.id===load('src/utils/digimonLookup.ts').getDigimonByName(name)?.id&&!c.unavailableReason).map(c=>({...r,capturedEnemySlot:c.slot,capturedMaxLevel:c.levelCap.max,level:c.level})));
  assert.ok(options.length,'Real capture exists: '+name);return options.sort((a,b)=>b.level-a.level)[0];
}
function record(run,request=battle,choose=c=>c.choice.candidates.map(p=>p.key)){
  try{return recording.recordRunBattle(run,request).run;}catch(e){
    if(!(e instanceof BattleTechniqueSelectionRequired))throw e;
    return recording.recordRunBattle(run,{...request,techniqueSelections:e.choices.map(c=>({instanceId:c.instanceId,keptKeys:choose(c)}))}).run;
  }
}
function capture(run,name){const next=record(run,captureRequest(name));return {run:next,id:next.history.at(-1).capturedInstanceId};}
function solo(run,id){let next=run;for(const active of [...next.digiline])if(active!==id)next=digiline.removeFromDigiline(next,active);if(!next.digiline.includes(id))next=digiline.addToDigiline(next,id);return next;}
function train(run,id,level,choose){run=solo(run,id);let count=0;while(member(run,id).level<level){assert.ok(++count<150,'Progression must terminate');assert.ok(member(run,id).levelCap.resolved>=level);run=record(run,battle,choose);}return run;}
function reload(run){assert.equal(storage.saveRunPlannerData(envelope(run)),true);const next=storage.loadRunPlannerData().runs[0];assert.deepEqual(next,run);return next;}
function undo(run){const result=undoLastAction(run);assert.equal(result.ok,true,result.reason);return result.run;}
function verify(run){assert.deepEqual(validateRunPlan(run),[]);for(let i=0;i<run.history.length;i++){const expected=deriveActionPostState(run.history[i]),next=run.history[i+1]?.preActionCheckpoint??run;assert.deepEqual(expected.roster,next.roster);assert.equal(expected.totalBits,next.totalBits);}}
function dna(run,a,b){const before=[member(run,a),member(run,b)];const result=recordDnaAction(run,a,b);assert.equal(result.child.dp,Math.max(...before.map(p=>p.dp))+1);assert.equal(result.child.levelCap.resolved,Math.max(...before.map(p=>p.level))+Math.floor(Math.min(...before.map(p=>p.level))/5));assert.equal(result.child.totalXp,getRequiredTotalXpForLevel(result.child.level));assert.equal(result.child.techs.length,1);for(const p of result.child.techniquePool)for(const source of p.sources.filter(s=>s.type==='inherited'))assert.ok(before.find(parent=>parent.instanceId===source.parentInstanceId).techs.includes(p.name),'Only currently possessed techniques propagate');assert.deepEqual(result.child.source.parentInstanceIds,[a,b].sort());assert.ok(!result.run.roster.some(p=>p.instanceId===a||p.instanceId===b));verify(result.run);return result;}
function capturePair(first,second){let run=createRunPlan('gold-hawk','Real lineage');const a=capture(run,first),b=capture(a.run,second);return {run:b.run,a:a.id,b:b.id};}
function wizardLineage(){let run=createRunPlan('gold-hawk','Wizard lineage');const crab=capture(run,'Crabmon');const trade=recordTradeAction(crab.run,'trade-192',crab.id);const partner=capture(trade.run,'Greymon');const child=dna(partner.run,trade.received.instanceId,partner.id);return {initial:run,crab,trade,partner,child};}

test('2H integration 1: authoritative starter, evolve, discard, reload and complete Undo',()=>{
  const original=createRunPlan('gold-hawk','Starter journey');const id=original.starterInstanceId;
  let run=train(original,id,11);const beforeEvolution=run;run=recordRunDigivolution(run,id).run;
  assert.equal(member(run,id).stats.hp,member(beforeEvolution,id).stats.hp+30);
  assert.equal(member(run,id).stats.mp,member(beforeEvolution,id).stats.mp+30);
  assert.equal(potential(member(run,id),'Nova Blast').unlock.status,'pending');
  const beforeLearning=run;assert.throws(()=>recording.recordRunBattle(run,battle),BattleTechniqueSelectionRequired);
  run=record(run,battle,c=>c.choice.candidates.filter(p=>p.name!=='Nova Blast').map(p=>p.key));
  assert.equal(potential(member(run,id),'Nova Blast').unlock.status,'discarded');
  assert.deepEqual(meaningful(undo(run)),meaningful(beforeLearning));
  run=reload(record(run));verify(run);
  while(run.history.length){const checkpoint=run.history.at(-1).preActionCheckpoint;run=undo(run);assert.deepEqual({roster:run.roster,digiline:run.digiline,totalBits:run.totalBits},checkpoint);}
  assert.deepEqual(meaningful(run),meaningful(original));
});

test('2H integration 2: real Crabmon capture, Wizardmon trade, DNA, inherited learning and Undo',()=>{
  const {initial,crab,trade,child}=wizardLineage();const wizard=trade.received;
  assert.equal(wizard.levelCap.resolved,19);assert.equal(wizard.totalXp,483);assert.equal(wizard.dp,0);
  assert.deepEqual(wizard.stats,{hp:102,mp:79,atk:49,def:52,spd:31});assert.deepEqual(wizard.techs,['Thunder Ball','Necro Magic']);
  for(const t of wizard.techs)assert.equal(potential(child.child,t).unlock.status,'pending');
  let run=train(child.run,child.child.instanceId,12);for(const t of wizard.techs)assert.ok(member(run,child.child.instanceId).techs.includes(t));
  run=reload(run);verify(run);while(run.history.at(-1)?.type!=='dna')run=undo(run);
  run=undo(run);assert.ok(member(run,wizard.instanceId));run=undo(run);assert.deepEqual(run.roster,trade.run.roster);
  run=undo(run);assert.deepEqual(run.roster,crab.run.roster);run=undo(run);assert.deepEqual(meaningful(run),meaningful(initial));
});

test('2H integration 3: three DNA generations with capture, evolution, Trade, choices and reload',()=>{
  const original=createRunPlan('gold-hawk','Three generations');let run=original;
  const a=capture(run,'WarGreymon'),b=capture(a.run,'WarGreymon');let first=dna(b.run,a.id,b.id);run=train(first.run,first.child.instanceId,31);
  run=recordRunDigivolution(run,first.child.instanceId).run;
  const give=capture(run,'Numemon'),trade=recordTradeAction(give.run,'trade-193',give.id);run=reload(trade.run);
  const second=dna(run,first.child.instanceId,trade.received.instanceId);run=train(second.run,second.child.instanceId,21,c=>c.choice.candidates.slice(0,12).map(p=>p.key));
  run=recordRunDigivolution(run,second.child.instanceId).run;
  const partner=capture(run,'WarGreymon'),third=dna(partner.run,second.child.instanceId,partner.id);run=reload(third.run);verify(run);
  assert.equal(run.history.filter(e=>e.type==='dna').length,3);assert.ok(run.history.some(e=>e.type==='battle'&&e.techniqueChoices.length));
  assert.equal(third.child.dp,3);assert.ok(!run.roster.some(p=>[a.id,b.id,first.child.instanceId,trade.received.instanceId,second.child.instanceId,partner.id].includes(p.instanceId)));
  while(run.history.length)run=undo(run);assert.deepEqual(meaningful(run),meaningful(original));
});

test('2H integration 4: one saved branch excludes pending/discarded techniques and transmits kept techniques',()=>{
  const pair=capturePair('Cherrymon','MasterTyrannomon'),first=dna(pair.run,pair.a,pair.b);
  const partner=capture(first.run,'Greymon'),id=first.child.instanceId;const saved=reload(solo(partner.run,id));
  const target=first.child.techniquePool.find(p=>p.unlock.status==='pending'&&p.unlock.level===22&&!member(saved,partner.id).techs.includes(p.name));assert.ok(target);
  const early=dna(saved,id,partner.id);assert.ok(!potential(early.child,target.name)?.sources.some(s=>s.type==='inherited'&&s.parentInstanceId===id));
  assert.deepEqual(meaningful(undo(early.run)),meaningful(saved));
  for(const keep of [true,false]){
    const learned=train(structuredClone(saved),id,22,c=>c.choice.candidates.filter(p=>keep||p.key!==target.key).map(p=>p.key));
    assert.equal(member(learned,id).techs.includes(target.name),keep);const descendant=dna(learned,id,partner.id);
    assert.equal(!!potential(descendant.child,target.name)?.sources.some(s=>s.type==='inherited'&&s.parentInstanceId===id),keep);
    assert.deepEqual(meaningful(undo(descendant.run)),meaningful(learned));
    let restored=undo(descendant.run);while(restored.history.length>saved.history.length)restored=undo(restored);assert.deepEqual(meaningful(restored),meaningful(saved));
  }
});

test('2H integration 6: real Vademon mutation, EL22 selection, progression, reload and Undo',()=>{
  const pair=capturePair('Cherrymon','MasterTyrannomon'),result=dna(pair.run,pair.a,pair.b);assert.equal(result.child.name,'Vademon');
  assert.equal(result.event.actualResultRank,'Ultimate');assert.equal(result.child.level,21);assert.equal(result.child.totalXp,5883);
  assert.ok(result.child.techniquePool.filter(p=>p.unlock.status==='pending').every(p=>p.unlock.level===22||p.unlock.level===32));
  let run=train(result.run,result.child.instanceId,22);assert.ok(run.history.at(-1).techniqueChoices.length);
  run=reload(train(run,result.child.instanceId,23));verify(run);run=undo(run);assert.equal(member(run,result.child.instanceId).level,22);
  while(run.history.at(-1).type!=='dna')run=undo(run);assert.deepEqual(undo(run).roster,pair.run.roster);
});

function overflowLineage(){
  const original=createRunPlan('gold-hawk','Possessed technique lineage');const initial=capture(original,'WarGreymon');let run=initial.run,id=initial.id;
  for(const name of ['M-Garurumon','Phoenixmon','Rosemon','Boltmon','Puppetmon']){
    const partner=capture(run,name),child=dna(partner.run,id,partner.id);run=solo(child.run,child.child.instanceId);id=child.child.instanceId;
    while(member(run,id).level<32){
      const preview=load('src/utils/normalDigivolution.ts').previewNormalDigivolution(member(run,id));
      if(member(run,id).level===31&&preview.canDigivolve)run=recordRunDigivolution(run,id).run;
      const choices=getBattleTechniqueChoices(run.roster,run.digiline,getResolvedReward(battle.encounterId).xp);
      const overflow=choices.find(c=>c.choice.candidates.length>12);
      if(overflow)return {run,id,overflow};
      run=record(run);
    }
  }
  assert.fail('Real five-generation lineage must produce overflow');
}

function plannerHost(){
  const slots=[];let cursor=0;const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
  };
  const source=fs.readFileSync(path.join(root,'src/hooks/useRunPlanner.ts'),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',js)(id=>id==='react'?react:load('src/'+id.slice(2)+'.ts'),mod,mod.exports);
  return ()=>{cursor=0;return mod.exports.useRunPlanner();};
}

test('2H integration 5: real five-generation overflow, complete choice, quota atomicity and Undo',()=>{
  const {run,id,overflow}=overflowLineage();assert.equal(overflow.choice.candidates.length,13);
  const snapshot=structuredClone(run);const pending=member(run,id).techniquePool.filter(p=>p.unlock.status==='pending'&&p.unlock.level>overflow.newLevel);
  assert.ok(pending.every(p=>!overflow.choice.candidates.some(c=>c.key===p.key)));
  assert.throws(()=>recording.recordRunBattle(run,battle),BattleTechniqueSelectionRequired);
  for(const count of [0,13])assert.throws(()=>recording.recordRunBattle(run,{...battle,techniqueSelections:[{instanceId:id,keptKeys:overflow.choice.candidates.slice(0,count).map(p=>p.key)}]}));
  assert.deepEqual(run,snapshot);
  reload(run);const render=plannerHost(),planner=render();const review=planner.recordBattle(battle);assert.equal(review.status,'selection-required');
  const request={...battle,expectedRunState:review.expectedRunState,techniqueSelections:[{instanceId:id,keptKeys:overflow.choice.candidates.slice(0,12).map(p=>p.key)}]};
  const raw=values.get(storage.RUN_PLANNER_STORAGE_KEY),write=global.localStorage.setItem;
  global.localStorage.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};
  assert.equal(planner.recordBattle(request),null);assert.match(render().error,/storage is full/);assert.deepEqual(render().activeRun,run);assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
  global.localStorage.setItem=write;assert.ok(render().recordBattle(request));const committed=render().activeRun;
  assert.equal(member(committed,id).techs.length,12);assert.deepEqual(meaningful(undo(committed)),meaningful(run));
  const one=recording.recordRunBattle(run,{...battle,techniqueSelections:[{instanceId:id,keptKeys:[overflow.choice.candidates[0].key]}]}).run;assert.equal(member(one,id).techs.length,1);verify(one);
});

const fixtures=new Map();
function fixture(kind){
  if(!fixtures.has(kind)){
    let run=createRunPlan('gold-hawk','Corruption fixture');
    if(kind==='battle')run=record(run);
    if(kind==='highCapture')run=capture(run,'Greymon').run;
    if(kind==='capture'||kind==='adjacent')run=capture(run,'Crabmon').run;
    if(kind==='adjacent')run=record(run);
    if(kind==='evolution'){run=train(run,run.starterInstanceId,11);run=capture(run,'Crabmon').run;run=recordRunDigivolution(run,run.starterInstanceId).run;}
    if(kind==='dna'){const pair=capturePair('Cherrymon','MasterTyrannomon');run=dna(pair.run,pair.a,pair.b).run;}
    verify(run);fixtures.set(kind,run);
  }
  return structuredClone(fixtures.get(kind));
}
const alterTech=p=>Object.assign(p,load('src/utils/techniqueInheritance.ts').createAvailableTechniqueState(['Boom Bubble'],{type:'starter',speciesId:'patamon'}));
const childOf=run=>member(run,run.history.at(-1).childInstanceId);
const corruptions=[
  ['final battle XP','battle',r=>r.roster[0].totalXp+=123,'transition-roster-mismatch'],
  ['final battle HP','battle',r=>r.roster[0].stats.hp+=123,'transition-roster-mismatch'],
  ['final Bits','battle',r=>r.totalBits+=123,'transition-bits-mismatch'],
  ['next checkpoint XP','adjacent',r=>r.history[1].preActionCheckpoint.roster[0].totalXp+=123,'transition-roster-mismatch'],
  ['next checkpoint HP','adjacent',r=>r.history[1].preActionCheckpoint.roster[0].stats.hp+=123,'transition-roster-mismatch'],
  ['next checkpoint technique state','adjacent',r=>alterTech(r.history[1].preActionCheckpoint.roster[0]),'transition-roster-mismatch'],
  ['next checkpoint roster ordering','adjacent',r=>r.history[1].preActionCheckpoint.roster.reverse(),'transition-roster-mismatch'],
  ['next checkpoint Bits','adjacent',r=>r.history[1].preActionCheckpoint.totalBits++,'transition-bits-mismatch'],
  ['capture exact stats','capture',r=>r.roster[1].stats.atk++,'transition-roster-mismatch'],
  ['capture exact techniques','capture',r=>alterTech(r.roster[1]),'transition-roster-mismatch'],
  ['evolved member HP bonus','evolution',r=>r.roster[0].stats.hp--,'transition-roster-mismatch'],
  ['unaffected evolution survivor','evolution',r=>r.roster[1].stats.hp++,'transition-roster-mismatch'],
  ['unaffected DNA survivor','dna',r=>member(r,r.starterInstanceId).stats.hp++,'transition-roster-mismatch'],
  ['DNA child stats','dna',r=>childOf(r).stats.hp++,'transition-roster-mismatch'],
  ['DNA child technique state','dna',r=>alterTech(childOf(r)),'transition-roster-mismatch'],
  ['wrong starter definition','battle',r=>r.starterDefinitionId='blue-falcon','starter-definition-mismatch'],
  ['starter initial stats','battle',r=>r.history[0].preActionCheckpoint.roster[0].stats.hp++,'starter-definition-mismatch'],
  ['starter initial species','battle',r=>Object.assign(r.history[0].preActionCheckpoint.roster[0],{speciesId:'patamon',name:'Patamon'}),'starter-definition-mismatch'],
  ['starter initial techniques','battle',r=>alterTech(r.history[0].preActionCheckpoint.roster[0]),'starter-definition-mismatch'],
  ['XP below current EL threshold','highCapture',r=>r.roster[1].totalXp=0,'roster-xp-below-level'],
  ['canonical species disagreement','capture',r=>r.roster[1].name='Patamon','roster-species-mismatch'],
  ['authoritative XP reward','battle',r=>r.history[0].xpReward++,'transition-replay-invalid'],
  ['authoritative Bits reward','battle',r=>r.history[0].bitsReward++,'transition-replay-invalid'],
  ['invalid encounter location','battle',r=>r.history[0].domainId='invented','transition-replay-invalid'],
];
for(const [name,kind,mutate,category] of corruptions)test('2H corruption rejected: '+name,()=>{
  const run=fixture(kind);reload(run);const raw=values.get(storage.RUN_PLANNER_STORAGE_KEY);mutate(run);
  const errors=validateRunPlan(run);assert.ok(errors.some(e=>e.code===category),JSON.stringify(errors));
  assert.equal(storage.saveRunPlannerData(envelope(run)),false);assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
  values.set(storage.RUN_PLANNER_STORAGE_KEY,JSON.stringify(envelope(run)));assert.match(storage.loadRunPlannerDataResult().warning,/not automatically deleted/);
});

test('2H unlogged Digiline edits between actions and after final action are accepted; local invalid IDs reject',()=>{
  const captured=fixture('capture');let changed=digiline.addToDigiline(captured,captured.roster[1].instanceId);changed=digiline.moveDigilineMember(changed,captured.roster[1].instanceId,'up');
  const next=record(changed);assert.notDeepEqual(next.history[0].digilineInstanceIds,next.history[1].digilineInstanceIds);
  assert.deepEqual(deriveActionPostState(next.history[0]).roster,next.history[1].preActionCheckpoint.roster);
  verify(digiline.removeFromDigiline(next,next.starterInstanceId));
  next.history[1].preActionCheckpoint.digiline=['missing'];assert.ok(validateRunPlan(next).some(e=>e.code==='invalid-run-event'));
});

for(const action of ['battle','dna','trade'])test('2H stale load callback retains committed '+action,()=>{
  let run;
  if(action==='dna'){const pair=capturePair('Cherrymon','MasterTyrannomon');run=pair.run;}else run=fixture('capture');
  reload(run);const render=plannerHost(),old=render();
  if(action==='battle')assert.ok(old.recordBattle(battle));
  if(action==='dna')assert.equal(old.dna(run.id,run.roster[1],run.roster[2]),true);
  if(action==='trade')assert.equal(old.trade(run.id,'trade-192',run.roster[1]),true);
  const committed=render().data;old.loadRun(run.id);assert.deepEqual(render().data,committed);assert.deepEqual(storage.loadRunPlannerData(),committed);
});

test('2H old Battle and reset callbacks cannot act on another active run',()=>{
  const a=createRunPlan('gold-hawk','A'),b=createRunPlan('blue-falcon','B');storage.saveRunPlannerData({schemaVersion:7,runs:[a,b],activeRunId:a.id});
  const render=plannerHost(),old=render();old.loadRun(b.id);const committed=render().data;
  assert.equal(old.recordBattle(battle),null);assert.equal(old.resetRun(a.id),false);assert.deepEqual(render().data,committed);
  assert.equal(render().resetRun(a.id),false);assert.deepEqual(storage.loadRunPlannerData(),committed);
});

test('2H old ordinary Battle requires review after same-run progression or Digiline changes',()=>{
  const run=fixture('capture');reload(run);const render=plannerHost(),old=render();
  assert.ok(old.recordBattle(battle));const committed=render().data;assert.equal(old.recordBattle(battle),null);assert.deepEqual(render().data,committed);
  const current=render();current.addMember(run.roster[1].instanceId);assert.equal(current.recordBattle(battle),null);
  assert.ok(render().recordBattle(battle));assert.ok(render().recordBattle(battle));
});

test('2H old create/select/reset callbacks always derive writes from latest envelope',()=>{
  const render=plannerHost();render().setStarterId('gold-hawk');const creator=render();assert.equal(creator.startRun(),true);
  const first=render().activeRun;assert.equal(creator.startRun(),false);assert.equal(render().resetRun(first.id),true);
  render().setStarterId('blue-falcon');assert.equal(render().startRun(),true);const second=render().activeRun;
  creator.loadRun(first.id);assert.equal(render().activeRun.id,second.id);assert.equal(creator.startRun(),false);
});

test('2H reset and selection preserve newer changes to other saved runs',()=>{
  const a=createRunPlan('gold-hawk','A'),b=createRunPlan('blue-falcon','B');storage.saveRunPlannerData({schemaVersion:7,runs:[a,b],activeRunId:a.id});
  const render=plannerHost(),old=render();old.loadRun(b.id);assert.ok(render().recordBattle(battle));const latestB=render().activeRun;
  old.loadRun(a.id);assert.equal(old.resetRun(a.id),true);assert.deepEqual(render().data.runs,[latestB]);
});

test('2H strict graph retains evolution/DNA/Trade stale member guards and learning snapshot protection',()=>{
  const pair=capturePair('Cherrymon','MasterTyrannomon');reload(pair.run);let render=plannerHost(),old=render();
  const a=structuredClone(pair.run.roster[1]);a.stats.hp++;assert.equal(old.dna(pair.run.id,a,pair.run.roster[2]),false);
  let run=fixture('capture');reload(run);render=plannerHost();old=render();const crab=structuredClone(run.roster[1]);crab.totalXp++;assert.equal(old.trade(run.id,'trade-192',crab),false);
  run=createRunPlan('gold-hawk','Evolution');
  run=train(run,run.starterInstanceId,11);reload(run);render=plannerHost();old=render();const stale=structuredClone(run.roster[0]);stale.stats.mp++;assert.equal(old.digivolve(run.id,stale),false);
  assert.equal(old.digivolve(run.id,run.roster[0]),true);const current=render(),review=current.recordBattle(battle);assert.equal(review.status,'selection-required');
  current.removeMember(run.starterInstanceId);const kept=review.choices.map(c=>({instanceId:c.instanceId,keptKeys:c.choice.candidates.map(p=>p.key)}));
  assert.equal(render().recordBattle({...battle,expectedRunState:review.expectedRunState,techniqueSelections:kept}),null);
});

test('2H invalid storage warning is non-destructive; empty storage has no warning',()=>{
  assert.equal(storage.loadRunPlannerDataResult().warning,null);
  for(const raw of ['', '{broken',JSON.stringify({schemaVersion:6,runs:[],activeRunId:null})]){
    values.set(storage.RUN_PLANNER_STORAGE_KEY,raw);const loaded=storage.loadRunPlannerDataResult();assert.deepEqual(loaded.data,storage.emptyRunPlannerData());
    assert.match(loaded.warning,/Creating or saving new data may replace/);assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
    const render=plannerHost();assert.equal(render().storageWarning,loaded.warning);
  }
});

for(const error of [{name:'QuotaExceededError'},{name:'NS_ERROR_DOM_QUOTA_REACHED'},{code:22},{code:1014},{name:'SecurityError'}])test('2H storage failure classified without publishing: '+JSON.stringify(error),()=>{
  const run=createRunPlan('gold-hawk','Storage');reload(run);const render=plannerHost(),planner=render(),raw=values.get(storage.RUN_PLANNER_STORAGE_KEY);
  global.localStorage.setItem=()=>{throw error;};assert.equal(planner.recordBattle(battle),null);assert.deepEqual(render().activeRun,run);assert.equal(values.get(storage.RUN_PLANNER_STORAGE_KEY),raw);
  assert.match(render().error,error.name==='SecurityError'?/Could not save/:/storage is full/);
});

test('2H replay is deterministic, frozen-input safe and never allocates identities or writes storage',()=>{
  const run=fixture('dna');const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};freeze(run);
  const random=Math.random,cryptoDescriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
  Math.random=()=>assert.fail('No RNG during validation');Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:()=>assert.fail('No UUID during validation')}});
  global.localStorage.setItem=()=>assert.fail('No storage writes during validation');
  try{verify(run);verify(run);}finally{Math.random=random;if(cryptoDescriptor)Object.defineProperty(globalThis,'crypto',cryptoDescriptor);else delete globalThis.crypto;}
});

test('2H authoritative XP boundaries and UTF-8 size helper do not extrapolate',()=>{
  assert.equal(getRequiredTotalXpForLevel(50),277040);assert.equal(getRequiredTotalXpForLevel(51),null);
  const run=createRunPlan('gold-hawk','日本語 run');assert.equal(storage.getRunPlannerSerializedBytes(envelope(run)),Buffer.byteLength(JSON.stringify(envelope(run)),'utf8'));
  for(const starter of load('src/data/starters.ts').STARTERS){const r=createRunPlan(starter.id,'');verify(r);assert.equal(storage.saveRunPlannerData(envelope(r)),true);}
});

test('2H representative 100/300 action validation and serialized size measurements',t=>{
  let run=createRunPlan('gold-hawk','Representative route');for(const name of ['Crabmon','Greymon','Cherrymon','MetalGreymon','Piximon'])run=capture(run,name).run;
  run=digiline.addToDigiline(run,run.roster[1].instanceId);run=digiline.addToDigiline(run,run.roster[2].instanceId);
  for(const count of [100,300]){
    while(run.history.length<count)run=record(run);
    const samples=[];for(let i=0;i<5;i++){const start=performance.now();assert.deepEqual(validateRunPlan(run),[]);samples.push(performance.now()-start);}
    samples.sort((a,b)=>a-b);t.diagnostic(JSON.stringify({actions:count,roster:run.roster.length,utf8Bytes:storage.getRunPlannerSerializedBytes(envelope(run)),medianValidationMs:Number(samples[2].toFixed(2))}));
  }
});

test('2H exact starter binding survives real starter consumption and Undo',()=>{
  const original=createRunPlan('gold-hawk','Starter DNA');let run=train(original,original.starterInstanceId,11);
  run=recordRunDigivolution(run,original.starterInstanceId).run;const partner=capture(run,'Greymon');
  const result=dna(partner.run,original.starterInstanceId,partner.id);assert.equal(result.run.starterInstanceId,original.starterInstanceId);
  assert.equal(result.run.starterDefinitionId,original.starterDefinitionId);assert.ok(!member(result.run,original.starterInstanceId));
  verify(reload(result.run));assert.deepEqual(undo(result.run).roster,partner.run.roster);
  const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(load('src/components/run-planner/RunPlanner.tsx').RunPlanner,
    {planner:{data:envelope(result.run),activeRun:result.run,error:null,starterId:'',name:'',feedbackRevision:0}}));assert.ok(html.includes('Gold Hawk'));assert.ok(html.includes('Agumon'));
});

for(const trade of load('src/data/trades.ts').TRADE_DEFINITIONS)test('2H real capture/Trade continuity: '+trade.id,()=>{
  const giveName=load('src/utils/digimonLookup.ts').getDigimonById(trade.giveSpeciesId).name;
  const captured=capture(createRunPlan('gold-hawk','Authoritative trade'),giveName);const result=recordTradeAction(captured.run,trade.id,captured.id);
  assert.equal(result.received.dp,0);assert.equal(result.received.totalXp,getRequiredTotalXpForLevel(result.received.level));
  assert.equal(result.received.levelCap.min,result.received.levelCap.max);verify(reload(record(result.run)));
  assert.deepEqual(undo(result.run).roster,captured.run.roster);
});

test('2H representative adjacent action pairs all validate',()=>{
  const runs=[fixture('adjacent'),record(fixture('evolution')),record(fixture('dna'))];
  const captured=fixture('capture'),traded=recordTradeAction(captured,'trade-192',captured.roster[1].instanceId).run;runs.push(record(traded));
  const pairs=new Set();for(const run of runs){verify(run);for(let i=1;i<run.history.length;i++)pairs.add(run.history[i-1].type+'->'+run.history[i].type);}
  for(const pair of ['battle->battle','battle->digivolve','battle->dna','battle->trade','digivolve->battle','dna->battle','trade->battle'])assert.ok(pairs.has(pair),pair);
});

test('2H all recordable capture identities satisfy canonical consistency without exemptions',()=>{
  const seen=new Set();for(const location of locations)for(const choice of recording.getCaptureChoices(location)){
    if(choice.unavailableReason)continue;const key=location.encounterId+'/'+choice.slot;if(seen.has(key))continue;seen.add(key);
    const captured=load('src/utils/capture.ts').tryCreateCapturedDigimon(location.encounterId,choice.slot,choice.levelCap.max,()=>key);
    assert.equal(captured.ok,true);assert.equal(load('src/utils/runActionCheckpoint.ts').isRosterDigimon(captured.digimon),true,key);
  }
  assert.ok(seen.size>100);
});

test('2H invalid-storage and EL50 explanations are rendered in the existing UI',()=>{
  const react=require('react'),render=require('react-dom/server').renderToStaticMarkup;
  const warning='Saved data could not be validated and was not automatically deleted. Creating or saving new data may replace it.';
  const html=render(react.createElement(load('src/components/run-planner/RunPlanner.tsx').RunPlanner,{planner:{data:storage.emptyRunPlannerData(),activeRun:null,error:null,storageWarning:warning,starterId:'',name:''}}));assert.ok(html.includes(warning));
  const cap=render(react.createElement(load('src/components/run-planner/LevelCapDisplay.tsx').LevelCapDisplay,{member:{level:50,levelCap:{min:58,max:58,resolved:58}}}));assert.ok(cap.includes('Verified XP progression ends at EL50'));
});
