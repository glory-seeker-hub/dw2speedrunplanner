const {test, beforeEach} = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('./helpers/loadTs.cjs');
const {richBackupRun, createRunPlan, record, digiline} = require('./helpers/backupFixture.cjs');
const backup = load('src/utils/runPlannerBackup.ts');
const storage = load('src/utils/runPlannerStorage.ts');
const {buildPlannerBattleAnalysisPreset} = load('src/utils/runPlanner/runBattleAnalysis.ts');
const {buildRouteDocument} = load('src/utils/routeDocument.ts');
const envelope = (...runs) => ({schemaVersion:7,runs,activeRunId:runs.at(-1)?.id??null});
let values;
beforeEach(()=>{values=new Map();global.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};});
const rich = richBackupRun();
const original = envelope(rich, createRunPlan('blue-falcon','Other'));
const current = () => backup.createRunBackup(original,'active-run');
const all = () => backup.createRunBackup(original,'all-runs');

test('backup v1: active scope, exact envelope, schema and immutable export',()=>{
  const before=structuredClone(original), result=current();
  assert.deepEqual(Object.keys(result).sort(),['format','backupVersion','plannerSchemaVersion','exportedAt','scope','activeRunId','runs'].sort());
  assert.equal(result.format,'dw2-speedrun-planner-backup');assert.equal(result.backupVersion,1);assert.equal(result.plannerSchemaVersion,7);
  assert.equal(result.scope,'active-run');assert.deepEqual(result.runs,[original.runs[1]]);assert.equal(result.activeRunId,result.runs[0].id);
  assert.equal(new Date(result.exportedAt).toISOString(),result.exportedAt);result.runs[0].roster[0].stats.hp=0;assert.deepEqual(original,before);
});
test('all export preserves order, active identity and every canonical field',()=>{
  const result=all();assert.deepEqual(result.runs,original.runs);assert.equal(result.activeRunId,original.activeRunId);
  assert.deepEqual(backup.parseRunBackup(backup.serializeRunBackup(result)),result);
});
for(const scope of ['active-run','all-runs']) test('empty export unavailable: '+scope,()=>assert.throws(()=>backup.createRunBackup(envelope(),scope),/no saved run/));
test('inconsistent active identity cannot be exported',()=>assert.throws(()=>backup.createRunBackup({...original,activeRunId:'missing'},'all-runs')));

const malformed = [
  ['array',()=>[]],['null',()=>null],['wrong marker',b=>({...b,format:'other'})],
  ['missing backup version',b=>{delete b.backupVersion;return b;}],['future backup',b=>({...b,backupVersion:99})],
  ['future schema',b=>({...b,plannerSchemaVersion:99})],['legacy schema',b=>({...b,plannerSchemaVersion:6})],
  ['missing runs',b=>{delete b.runs;return b;}],['runs not array',b=>({...b,runs:{}})],
  ['empty runs',b=>({...b,runs:[]})],['invalid active',b=>({...b,activeRunId:'unknown'})],
  ['missing active',b=>{delete b.activeRunId;return b;}],['bad date',b=>({...b,exportedAt:'yesterday'})],
  ['invalid calendar date',b=>({...b,exportedAt:'2026-02-30T00:00:00.000Z'})],
  ['bad scope',b=>({...b,scope:'replace'})],['active scope multiple runs',b=>({...b,scope:'active-run'})],
  ['unknown envelope field',b=>({...b,ui:{tab:'results'}})],
  ['missing starter',b=>{delete b.runs[0].starterDefinitionId;return b;}],
  ['string level',b=>{b.runs[0].roster[0].level='twenty';return b;}],
  ['invalid bits',b=>{b.runs[0].totalBits={};return b;}],
  ['non-array history',b=>{b.runs[0].history='battle';return b;}],
  ['invalid event',b=>{b.runs[0].history[0].type='other';return b;}],
  ['malformed checkpoint',b=>{b.runs[0].history[0].preActionCheckpoint.roster=null;return b;}],
  ['unknown nested field',b=>{b.runs[0].roster[0].ui={};return b;}],
  ['missing stats',b=>{delete b.runs[0].roster[0].stats.hp;return b;}],
  ['invalid current reference',b=>{b.runs[0].digiline=['missing'];return b;}],
  ['invalid historical reference',b=>{b.runs[0].history[0].digilineInstanceIds=['missing'];return b;}],
  ['invalid second run',b=>{b.runs[1].roster[0].speciesId='missing';return b;}],
  ['duplicate run IDs',b=>{b.runs[1].id=b.runs[0].id;return b;}],
  ['invalid inherited reference',b=>{const p=b.runs[0].roster.find(p=>p.source.type==='dna');p.source.parentInstanceIds=['missing','missing2'];return b;}],
  ['invalid technique parent',b=>{const p=b.runs[0].roster.find(p=>p.source.type==='dna');p.techniquePool.find(t=>t.sources.some(s=>s.type==='inherited')).sources.find(s=>s.type==='inherited').parentInstanceId='missing';return b;}],
  ['invalid capture source',b=>{b.runs[0].history.find(e=>e.type==='trade').preActionCheckpoint.roster.find(p=>p.source.type==='capture').source.enemySlot=999;return b;}],
];
for(const [label,mutate] of malformed) test('reject atomically: '+label,()=>{
  const before=JSON.stringify(original);assert.throws(()=>backup.parseRunBackup(JSON.stringify(mutate(all()))));assert.equal(JSON.stringify(original),before);assert.equal(values.size,0);
});
test('invalid JSON has readable failure',()=>assert.throws(()=>backup.parseRunBackup('{oops'),/not valid JSON/));
for(const key of ['__proto__','constructor','prototype']) test('hostile key rejected: '+key,()=>{
  const value=current();value.runs[0].roster[0]=JSON.parse(JSON.stringify(value.runs[0].roster[0]).replace('{','{"'+key+'":{"polluted":true},'));
  const before=Object.getOwnPropertyDescriptors(Object.prototype);assert.throws(()=>backup.parseRunBackup(JSON.stringify(value)));
  assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype),before);assert.equal({}.polluted,undefined);
});
test('HTML names stay data through round trip',()=>{
  const value=current();value.runs[0].name='<script>alert(1)</script>';
  assert.equal(backup.prepareRunImport(envelope(),backup.parseRunBackup(JSON.stringify(value))).runs[0].name,value.runs[0].name);
});
test('file size checked before read; unreadable file reported',async()=>{
  let read=false;await assert.rejects(backup.readRunBackupFile({size:backup.MAX_BACKUP_BYTES+1,text:()=>{read=true;}}),/too large/);assert.equal(read,false);
  await assert.rejects(backup.readRunBackupFile({size:1,text:()=>Promise.reject(new Error('disk'))}),/Could not read/);
  assert.throws(()=>backup.parseRunBackup(' '.repeat(backup.MAX_BACKUP_BYTES+1)),/too large/);
});
test('preview parse causes no storage or live-state mutation',async()=>{
  const before=structuredClone(original);const preview=await backup.readRunBackupFile({size:100,text:async()=>JSON.stringify(current())});
  assert.equal(preview.runs.length,1);assert.deepEqual(original,before);assert.equal(values.size,0);
});
test('append twice preserves existing runs and creates independent identities/names',()=>{
  const source=all(), before=structuredClone(original);
  const first=backup.prepareRunImport(original,source), second=backup.prepareRunImport(first,source);
  assert.deepEqual(second.runs.slice(0,2),before.runs);assert.equal(second.activeRunId,original.activeRunId);
  assert.deepEqual(second.runs.map(r=>r.name),['TAS','Other','TAS (Imported)','Other (Imported)','TAS (Imported 2)','Other (Imported 2)']);
  assert.equal(new Set(second.runs.map(r=>r.id)).size,6);
  second.runs[4].roster[0].stats.hp=1;assert.deepEqual(original,before);assert.deepEqual(source.runs,original.runs);
  assert.notEqual(second.runs[2].roster[0].stats.hp,1);
});
test('empty Planner activates mapped backup active ID or first for null',()=>{
  const source=all(), next=backup.prepareRunImport(envelope(),source);assert.equal(next.activeRunId,next.runs[1].id);
  source.activeRunId=null;const fallback=backup.prepareRunImport(envelope(),source);assert.equal(fallback.activeRunId,fallback.runs[0].id);
});
test('ID allocator collisions retry and fail safely; names without conflict unchanged',()=>{
  let attempt=0;const next=backup.prepareRunImport(envelope(),current(),()=>++attempt===1?original.activeRunId:'fresh');
  assert.equal(next.runs[0].id,'fresh');assert.equal(next.runs[0].name,'Other');
  assert.throws(()=>backup.prepareRunImport(original,current(),()=>original.activeRunId),/unique run identities/);
});
test('rich fixture round trip has exact semantics after normalizing only run identity',()=>{
  const source=backup.createRunBackup(envelope(rich),'active-run');
  const imported=backup.prepareRunImport(envelope(),backup.parseRunBackup(backup.serializeRunBackup(source))).runs[0];
  assert.notEqual(imported.id,rich.id);assert.deepEqual({...imported,id:rich.id},rich);
  assert.deepEqual(new Set(imported.history.map(e=>e.type)),new Set(['battle','digivolve','trade','dna']));
  assert.ok(imported.history.some(e=>e.domainId==='coliseum'));assert.ok(imported.history.some(e=>e.capturedInstanceId));
  assert.ok(imported.roster.some(p=>p.techniquePool.some(t=>t.sources.some(s=>s.type==='inherited'))));
  assert.equal(storage.isValidPersistedRunPlannerData(envelope(imported)),true);
});
test('imported historical Analyze preserves pre-battle roster, exact stats, techniques and new provenance',()=>{
  const imported=backup.prepareRunImport(envelope(),backup.createRunBackup(envelope(rich),'active-run')).runs[0];
  for(const event of imported.history.filter(e=>e.type==='battle')) {
    const a=buildPlannerBattleAnalysisPreset(rich,event.id), b=buildPlannerBattleAnalysisPreset(imported,event.id);
    assert.equal(b.source.runId,imported.id);assert.equal(b.source.battleEventId,event.id);
    assert.deepEqual(b.playerTeam,a.playerTeam);assert.deepEqual(b.enemyTeam,a.enemyTeam);assert.deepEqual(b.historicalStateSummary,a.historicalStateSummary);
  }
});
test('imported run allows subsequent battle, Digiline change, Undo and route export',()=>{
  let run=backup.prepareRunImport(envelope(),backup.createRunBackup(envelope(rich),'active-run')).runs[0];
  const next=record(run);assert.equal(next.history.length,run.history.length+1);
  assert.ok(buildRouteDocument(next,new Date()));
  const undone=load('src/utils/runActionUndo.ts').undoLastAction(next);assert.equal(undone.ok,true);
  run=digiline.removeFromDigiline(next,next.digiline[0]);assert.equal(run.digiline.length,0);
  run=digiline.addToDigiline(run,run.roster[0].instanceId);assert.equal(storage.isValidPersistedRunPlannerData(envelope(run)),true);
});
test('successful persistence reloads exact appended envelope; failed write keeps stored original',()=>{
  storage.saveRunPlannerData(original);const next=backup.prepareRunImport(original,all());
  assert.equal(storage.saveRunPlannerDataResult(next).ok,true);assert.deepEqual(storage.loadRunPlannerData(),next);
  storage.saveRunPlannerData(original);global.localStorage.setItem=()=>{throw Object.assign(new Error(),{name:'QuotaExceededError'});};
  assert.deepEqual(storage.saveRunPlannerDataResult(next),{ok:false,reason:'quota'});assert.deepEqual(storage.loadRunPlannerData(),original);
});
for(const name of ['TAS','São João','a/b\\c:d','?!:.*<>|','🎮','', 'x'.repeat(1000)]) test('safe filename: '+name.slice(0,20),()=>{
  const value=current();value.runs[0].name=name;const file=backup.backupFilename(value);
  assert.match(file,/^dw2-speedrunplanner-run-[a-zA-Z0-9_-]+-\d{4}-\d{2}-\d{2}\.json$/);assert.ok(file.length<120);assert.equal(value.runs[0].name,name);
});
test('all backup filename',()=>assert.match(backup.backupFilename(all()),/^dw2-speedrunplanner-backup-\d{4}-\d{2}-\d{2}\.json$/));
test('export refuses to emit a file larger than the importer supports',()=>{
  const value=current();value.runs[0].name='x'.repeat(backup.MAX_BACKUP_BYTES);
  assert.throws(()=>backup.serializeRunBackup(value),/exceeds 32 MiB/);
});
