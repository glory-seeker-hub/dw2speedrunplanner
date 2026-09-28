const fs=require('node:fs'),{small,unit,load}=require('../tests/helpers/optimizedFixtures.cjs');
const {createOptimizedSearchPass}=load('src/utils/battle/battleOptimizedSearch.ts');
const i=small();i.player[0].techs=[2,3,6,15].map(id=>unit('X',id).techs[0]);i.player[0].customStats.atk=50;i.player[0].currentHp=120;i.enemy[0].currentHp=150;i.enemy[0].customStats.atk=35;i.enemy[0].initialStatuses={paralysis:true};
const {compareCandidates}=load('src/utils/battle/battleSearchObjectives.ts');
let found=null;
for(let seed=0;seed<30&&!found;seed++){const history=[];const opts={seed,maxRounds:12,objective:'average-victory',config:{beamWidth:1,maxDepth:1},simulationRules:{accuracyMode:'game-accurate'}};
const run=(schedule,beam)=>{const s=createOptimizedSearchPass(i,5000,{...opts,screeningSchedule:schedule,config:{...opts.config,beamWidth:beam},onStage:(stage,rows)=>history.push({schedule,stage,rows:rows.map(c=>({key:c.key,stats:{...c.stats}}))})});while(!s.done)s.step();return s.result('completed',0).optimized;};
const legacy=run([4,16,64],1),enhanced=run([8,32,128],2),oracle=run([128],4);
const best=oracle.topCandidates[0];const initial=history.find(x=>x.schedule[0]===4).rows.sort((a,b)=>compareCandidates(a,b,'average-victory'));
if(initial[0].key!==best.key&&enhanced.topCandidates.some(c=>c.key===best.key)){found={seed,input:i,options:opts,legacy:legacy.topCandidates,enhanced:enhanced.topCandidates,allCandidates128:oracle.topCandidates,initial4:initial};}}
fs.writeFileSync('docs/phase-2k-l4/pruning-characterization.json',JSON.stringify({found},null,2)+'\n');console.log(found?{seed:found.seed,legacy:found.legacy[0].stats,enhanced:found.enhanced[0].stats}: 'No witness in bounded scan');
