const fs=require('node:fs');
const {load}=require('../tests/helpers/loadTs.cjs');
const {cases,member,tech}=require('../tests/helpers/battleFixtures.cjs');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const {runBattleSimulation,simulateBattleCore}=load('src/utils/battleEngine.ts');
const measurements=[1,100,1000].map(count=>{
 const start=performance.now();runBattleSimulation(...cases.aoe,'None',count,{rng:createSeededBattleRng(42)});
 return {count,ms:performance.now()-start};
});
const run=simulateBattleCore({player:cases.aoe[0],enemy:cases.aoe[1],floorSpecialty:'None'},{rng:createSeededBattleRng(42)});
const enemies=Array.from({length:3},()=>member('Duplicate',[tech('Rock Fist')],{hp:1}));
const player=[member('P',[tech('Shadow Scythe')],{spd:100})];
const start=performance.now();runBattleSimulation(player,enemies,'None',1000,{rng:createSeededBattleRng(42)});
const shadowMs=performance.now()-start;
const chain=simulateBattleCore({player,enemy:enemies,floorSpecialty:'None'},{rng:createSeededBattleRng(42)});
const result={measurements,actionCount:run.actionCount,recordCount:run.actions.length,impactCount:run.actions.flatMap(a=>a.impacts).length,
 shadowScythe:{count:1000,ms:shadowMs,actionCount:chain.actionCount,recordCount:chain.actions.length,impactCount:chain.actions.flatMap(a=>a.impacts).length,totalFrames:chain.totalFrames}};
fs.mkdirSync('docs/phase-2k-d',{recursive:true});fs.writeFileSync('docs/phase-2k-d/performance-after.json',JSON.stringify(result,null,2)+'\n');console.log(result);
