const {load}=require('./loadTs.cjs');
const {createRunPlan}=load('src/utils/runPlanCreation.ts');
const {recordRunBattle,getRecordingEncounter}=load('src/utils/runBattleRecording.ts');
const {buildPlannerBattleAnalysisPreset,historicalEnemyTeam}=load('src/utils/runPlanner/runBattleAnalysis.ts');
const {BattleTechniqueSelectionRequired}=load('src/utils/techniqueCapacity.ts');
const locations=load('src/data/domainGroups.ts').DOMAIN_GROUPS.flatMap(g=>g.floors.length?[{domainId:g.domainId,phase:g.phase,floor:g.floors[0],encounterId:g.encounterId}]:[]);
const safe=locations.find(l=>{try{return !!getRecordingEncounter(l)?.preview?.reward&&historicalEnemyTeam({...l,id:'fixture'}).length>0;}catch{return false;}});
function record(run,request=safe){try{return recordRunBattle(run,request).run;}catch(e){if(!(e instanceof BattleTechniqueSelectionRequired))throw e;return recordRunBattle(run,{...request,techniqueSelections:e.choices.map(c=>({instanceId:c.instanceId,keptKeys:c.choice.candidates.slice(0,12).map(p=>p.key)}))}).run;}}
const route=(n=2,starter='gold-hawk')=>{let r=createRunPlan(starter,'Analysis '+starter);for(let i=0;i<n;i++)r=record(r);return r;};
module.exports={load,route,record,safe,locations,buildPlannerBattleAnalysisPreset};
