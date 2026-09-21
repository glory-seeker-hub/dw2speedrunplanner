const {load,small,unit}=require('./optimizedFixtures.cjs');
const {snapshotSimulationReportJob,buildBattleSimulationReport}=load('src/utils/battle/battleSimulationReport.ts');
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const {createSimulationSearch}=load('src/utils/battle/battleSimulationSearch.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
function fixture({method='optimized-action-search',objective='fastest-potential',accuracyMode='strategy',rngPolicy='natural',partial=false,input=small(),budget=64,plannerProvenance,playerStatProvenance}={}) {
 const request={input,requestedSimulations:budget,searchMethod:method,simulationRules:{accuracyMode,rngPolicy},seed:17,maxRounds:1000,
  ...(method==='optimized-action-search'?{optimizationObjective:objective,optimizedConfig:{beamWidth:2,maxDepth:2}}:{}),plannerProvenance,playerStatProvenance};
 const job=snapshotSimulationReportJob(request);
 const search=method==='optimized-action-search'?createOptimizedSearch(input,budget,{seed:17,objective,config:request.optimizedConfig,simulationRules:request.simulationRules}):createSimulationSearch(input,budget,{rng:createSeededBattleRng(17),simulationRules:request.simulationRules});
 let steps=0;while(!search.done&&(!partial||search.completed<Math.min(8,budget))){search.step();if(++steps>100000)throw Error('Fixture failed to finish');}
 const result=search.result(partial?'cancelled':'completed',25);
 return {request,job,result,report:buildBattleSimulationReport(result,job)};
}
function plannerFixture(custom=false){
 const {buildPlannerBattleAnalysisPreset}=load('src/utils/runPlanner/runBattleAnalysis.ts');
 const run=require('../fixtures/route-short.json');
 const preset=buildPlannerBattleAnalysisPreset(run,run.history.find(e=>e.type==='battle').id);
 const baseline=structuredClone(preset.playerTeam);baseline[0].customStats.atk=67;
 const effective=structuredClone(baseline);if(custom)effective[0].customStats.atk=65;
 effective[0].currentHp=1;effective[0].currentMp=1;
 const {playerStatProvenance}=load('src/utils/battle/battleStatOverrides.ts');
 return fixture({method:'random-monte-carlo',budget:1,input:{player:effective,enemy:[unit('E',6,{currentHp:1})],floorSpecialty:'fire'},
  plannerProvenance:{source:preset.source,selectedBattle:preset.selectedBattle,historicalStateSummary:preset.historicalStateSummary,diagnostics:preset.diagnostics},playerStatProvenance:playerStatProvenance(baseline,effective)});
}
function representativeFixtures(){
 const tasInput={player:[unit('P',105,{stats:{atk:60,spd:200}})],enemy:[unit('E',6,{stats:{hp:100,spd:5}})],floorSpecialty:'None'};
 const longInput={player:[unit('P',6,{stats:{atk:40,spd:100}})],enemy:[unit('E',6,{stats:{hp:5000,spd:1}})],floorSpecialty:'None'};
 return {random:fixture({method:'random-monte-carlo',budget:2}),fastest:fixture(),average:fixture({objective:'average-victory'}),tas:fixture({input:tasInput,rngPolicy:'tas-favorable'}),long:fixture({input:longInput,method:'random-monte-carlo',budget:1}),cancelled:fixture({partial:true})};
}
module.exports={fixture,plannerFixture,representativeFixtures,load,small,unit,snapshotSimulationReportJob,buildBattleSimulationReport};
