// Regenerate only explicit test data. All actions use real recording/validation; no user storage.
const {load}=require('./helpers/loadTs.cjs');
const fs=require('node:fs');
let counter=0;
Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:()=>`route-fixture-${String(++counter).padStart(6,'0')}`}});
const RealDate=Date;
global.Date=class extends RealDate { constructor(...args){super(...(args.length?args:['2026-09-10T12:00:00.000Z']));} };
const {createRunPlan}=load('src/utils/runPlanCreation.ts');
const recording=load('src/utils/runBattleRecording.ts');
const {recordRunDigivolution}=load('src/utils/runDigivolutionRecording.ts');
const {recordDnaAction}=load('src/utils/runDnaRecording.ts');
const {recordTradeAction}=load('src/utils/runTradeRecording.ts');
const {BattleTechniqueSelectionRequired}=load('src/utils/techniqueCapacity.ts');
const {validateRunPlan}=load('src/utils/runInvariants.ts');
const {addToDigiline,removeFromDigiline}=load('src/utils/runDigiline.ts');
const {getResolvedReward}=load('src/utils/rewardMatching.ts');
const locations=load('src/data/domainGroups.ts').DOMAIN_GROUPS.map(g=>({domainId:g.domainId,phase:g.phase,floor:g.floors[0],encounterId:g.encounterId})).filter(r=>recording.getRecordingEncounter(r)?.preview?.reward);
const battle=locations.toSorted((a,b)=>getResolvedReward(b.encounterId).xp-getResolvedReward(a.encounterId).xp)[0];
function record(run,request=battle,discard=''){
 try{return recording.recordRunBattle(run,request).run;}catch(e){if(!(e instanceof BattleTechniqueSelectionRequired))throw e;
 return recording.recordRunBattle(run,{...request,techniqueSelections:e.choices.map(c=>({instanceId:c.instanceId,keptKeys:c.choice.candidates.filter(p=>p.name!==discard).slice(0,12).map(p=>p.key)}))}).run;}
}
function capture(run,name){
 const request=locations.flatMap(r=>recording.getCaptureChoices(r).filter(c=>load('src/utils/digimonLookup.ts').getDigimonByName(c.name)?.id===load('src/utils/digimonLookup.ts').getDigimonByName(name)?.id&&!c.unavailableReason).map(c=>({...r,capturedEnemySlot:c.slot,capturedMaxLevel:c.levelCap.max,level:c.level}))).sort((a,b)=>b.level-a.level)[0];
 if(!request)throw Error('Capture unavailable '+name);const next=record(run,request);return {run:next,id:next.history.at(-1).capturedInstanceId};
}
function solo(run,id){for(const active of [...run.digiline])if(active!==id)run=removeFromDigiline(run,active);return run.digiline.includes(id)?run:addToDigiline(run,id);}
const fresh=createRunPlan('gold-hawk','Fresh route');
let run=record(createRunPlan('gold-hawk','Mixed export route'));
const crab=capture(run,'Crabmon');run=recordTradeAction(crab.run,'trade-192',crab.id).run;
const short=structuredClone(run);short.name='Short capture and trade route';
const starter=run.starterInstanceId;
while(run.roster.find(p=>p.instanceId===starter).level<11)run=record(run);
run=recordRunDigivolution(run,starter).run;
run=record(run,battle,'Nova Blast');
const a=capture(run,'D-Tyrannomon'),b=capture(a.run,'Nanimon');run=recordDnaAction(b.run,a.id,b.id).run;
const c=capture(run,'Cherrymon'),d=capture(c.run,'MasterTyrannomon');const mutation=recordDnaAction(d.run,c.id,d.id);run=solo(mutation.run,mutation.child.instanceId);
const mixed=structuredClone(run);
// Real DNA lineage reproducing a Rookie crossing the Champion milestone.
const snowA=capture(run,'Greymon'),snowB=capture(snowA.run,'Frigimon');
const snowDna=recordDnaAction(snowB.run,snowA.id,snowB.id);
run=solo(snowDna.run,snowDna.child.instanceId);
while(run.roster.find(p=>p.instanceId===snowDna.child.instanceId).level<11)run=record(run);
const snowReady=structuredClone(run);
const snowEvolved=record(recordRunDigivolution(run,snowDna.child.instanceId).run);
while(run.roster.find(p=>p.instanceId===snowDna.child.instanceId).level<14)run=record(run);
run=solo(run,mutation.child.instanceId);
// A complete, valid long route rather than duplicated event IDs/checkpoints.
while(run.history.length<220)run=record(run);
run.name='Long route — 220 actions';
for(const [name,value] of Object.entries({fresh,short,mixed,long:run,'snow-ready':snowReady,'snow-evolved':snowEvolved})){
 const errors=validateRunPlan(value);if(errors.length)throw Error(JSON.stringify(errors));
 fs.writeFileSync(`tests/fixtures/route-${name}.json`,JSON.stringify(value));
 console.log(name,value.history.length,JSON.stringify(value).length);
}

