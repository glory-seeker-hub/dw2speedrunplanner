const assert = require('node:assert/strict');
const {load} = require('./loadTs.cjs');
const {createRunPlan}=load('src/utils/runPlanCreation.ts');
const {validateRunPlan}=load('src/utils/runInvariants.ts');
const recording=load('src/utils/runBattleRecording.ts');
const {recordRunDigivolution}=load('src/utils/runDigivolutionRecording.ts');
const {recordDnaAction}=load('src/utils/runDnaRecording.ts');
const {recordTradeAction}=load('src/utils/runTradeRecording.ts');
const {BattleTechniqueSelectionRequired}=load('src/utils/techniqueCapacity.ts');
const {getResolvedReward}=load('src/utils/rewardMatching.ts');
const {deriveActionPostState}=load('src/utils/runTransitionValidation.ts');
const {getRequiredTotalXpForLevel}=load('src/utils/experience.ts');
const digiline=load('src/utils/runDigiline.ts');
const member=(run,id)=>run.roster.find(p=>p.instanceId===id);
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
function verify(run){assert.deepEqual(validateRunPlan(run),[]);for(let i=0;i<run.history.length;i++){const expected=deriveActionPostState(run.history[i]),next=run.history[i+1]?.preActionCheckpoint??run;assert.deepEqual(expected.roster,next.roster);assert.equal(expected.totalBits,next.totalBits);}}
function dna(run,a,b){const before=[member(run,a),member(run,b)];const result=recordDnaAction(run,a,b);assert.equal(result.child.dp,Math.max(...before.map(p=>p.dp))+1);assert.equal(result.child.levelCap.resolved,Math.max(...before.map(p=>p.level))+Math.floor(Math.min(...before.map(p=>p.level))/5));assert.equal(result.child.totalXp,getRequiredTotalXpForLevel(result.child.level));assert.equal(result.child.techs.length,1);for(const p of result.child.techniquePool)for(const source of p.sources.filter(s=>s.type==='inherited'))assert.ok(before.find(parent=>parent.instanceId===source.parentInstanceId).techs.includes(p.name),'Only currently possessed techniques propagate');assert.deepEqual(result.child.source.parentInstanceIds,[a,b].sort());assert.ok(!result.run.roster.some(p=>p.instanceId===a||p.instanceId===b));verify(result.run);return result;}

function richBackupRun() {
  let run = createRunPlan('gold-hawk', 'TAS');
  run = train(run, run.starterInstanceId, 11);
  run = recordRunDigivolution(run, run.starterInstanceId).run;
  run = record(run);
  const crab = capture(run, 'Crabmon');
  const traded = recordTradeAction(crab.run, 'trade-192', crab.id);
  const partner = capture(traded.run, 'Greymon');
  run = dna(partner.run, traded.received.instanceId, partner.id).run;
  const childId = run.history.at(-1).childInstanceId;
  run = solo(run, childId);
  run = record(run);
  const {COLISEUM_BATTLES} = load('src/data/coliseumBattles.ts');
  const coliseum = COLISEUM_BATTLES[0];
  run = record(run, {...load('src/data/coliseumBattles.ts').COLISEUM_LOCATION,encounterId:coliseum.encounterId});
  verify(run);
  return run;
}
module.exports = {richBackupRun, createRunPlan, record, battle, digiline, train, recordRunDigivolution};
