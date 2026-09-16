const fs=require('node:fs');
const {load}=require('../tests/helpers/loadTs.cjs');
const {runDataSelfChecks}=load('src/utils/dataSelfChecks.ts');
const checks=runDataSelfChecks(); console.log('Self checks',checks.filter(c=>c.passed).length,checks.length);
if(checks.some(c=>!c.passed)){ console.log(checks.filter(c=>!c.passed));process.exitCode=1; }
const {unit}=require('../tests/helpers/battleSupportFixtures.cjs');
const {simulateBattleCore}=load('src/utils/battle/battleSimulation.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const fixtures=[['ordinary', [unit('P',2)],[unit('E',2)]],['party-time',[unit('P',0x40,{initialStatuses:{poison:true}})],[unit('E',2)]],['motivation',[{...unit('P',2,{initialStatuses:{'motivation-down':true,paralysis:true}}),techs:[2,3,6].map(id=>unit('X',id).techs[0])}],[unit('E',2)]],['mp-interrupt',[unit('P',2)],[unit('E',0xa6)]],['fantasmic-random',[unit('P',0xf4),unit('R',0x84)],[unit('E',2)]],['shadow-scythe',[unit('P',2),unit('P2',2)],[unit('E',0x4d)]]];
const performance=fixtures.map(([name,player,enemy])=>{const input={player,enemy,floorSpecialty:'None'},evaluations=200,start=performanceNow();let result;for(let i=0;i<evaluations;i++)result=simulateBattleCore(input,{maxRounds:5,rng:createSeededBattleRng(i),simulationRules:{accuracyMode:'strategy',rngPolicy:'natural'}});const wallMs=performanceNow()-start;return {name,method:'Random Monte Carlo engine rollouts',config:{evaluations,maxRounds:5,accuracyMode:'strategy',rngPolicy:'natural',seeds:'0..199'},evaluations,wallMs,evaluationsPerSecond:evaluations*1000/wallMs,resultBytes:Buffer.byteLength(JSON.stringify(result))};});
function performanceNow(){return Number(process.hrtime.bigint())/1e6;}
fs.writeFileSync('docs/phase-2k-k/performance.json',JSON.stringify(performance,null,2)+'\n');
console.log(performance);
