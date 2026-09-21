const {load,unit}=require('./battleSupportFixtures.cjs');
const {createTasLuckSearch,createTasLuckReplay}=load('src/utils/battle/battleTasLuck.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const {simulateBattleCore}=load('src/utils/battle/battleSimulation.ts');
const {createPlayerDecisionTrace}=load('src/utils/battle/battlePlayerDecisionTrace.ts');
function sample(input,seed=0,{cap=8,reverse=false,accuracyMode='strategy',maxRounds=5,...options}={}){
 const execute=tasLuck=>{const decisions=createPlayerDecisionTrace();return {result:simulateBattleCore(input,{...options,maxRounds,rng:createSeededBattleRng(seed),simulationRules:{accuracyMode,rngPolicy:'tas-luck'},tasLuck,playerDecisionObserver:decisions.observer}),diverged:false,decisionTrace:decisions.trace};};
 const search=createTasLuckSearch(execute,cap,reverse);let steps=0;while(!search.done){search.step();if(++steps>30000)throw Error('unbounded fixture');}return {...search.best,summary:search.summary,execute};
}
const input=(player,enemy)=>({player,enemy,floorSpecialty:'None'});
const confusionBest=()=>input([unit('P',6,{stats:{atk:1,spd:100}})],[unit('E',6,{initialStatuses:{paralysis:true,confusion:true},stats:{hp:100,atk:400,spd:40}})]);
module.exports={load,unit,input,sample,confusionBest,createTasLuckSearch,createTasLuckReplay,createSeededBattleRng,simulateBattleCore};
