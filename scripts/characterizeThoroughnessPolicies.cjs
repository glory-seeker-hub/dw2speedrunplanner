const fs=require('node:fs'),{performance}=require('node:perf_hooks');
const {canonical,small,unit,load}=require('../tests/helpers/optimizedFixtures.cjs');
const {createOptimizedSearchPass}=load('src/utils/battle/battleOptimizedSearch.ts');
const {explorationSeedForPass,mergeScreenedCandidates}=load('src/utils/battle/battleSearchPasses.ts');
// Experimental control: repeat the specified unenhanced/enhanced algorithm, including terminal roots.
// This intentionally measures the superseded policy, not the shipping Maximum fallback gates.
function experimentalRestarts(input,budget,options,make){let used=0,index=0,best=null,top=[],last;while(used<budget){const s=make(input,budget-used,{...options,...(index?{explorationSeed:explorationSeedForPass(options.seed,index+1)}:{})});while(!s.done)s.step();last=s.result('completed',0);used+=s.completed;index++;const o=last.optimized;top=mergeScreenedCandidates(top,o.topCandidates,options.objective);if(o.fastestRoute&&(!best||o.fastestRoute.totalFrames<best.totalFrames))best=o.fastestRoute;if(!s.completed||budget-used<s.minimumBudget)break;}return {...last,optimized:{...last.optimized,evaluations:used,fastestRoute:best,topCandidates:top,passes:{stopReason:used===budget?'budget-exhausted':'insufficient-budget-for-pass'}}};}
const {compareCandidates}=load('src/utils/battle/battleSearchObjectives.ts');
const variants=[
 {name:'A-legacy',schedule:[4,16,64],beam:4,depth:4},
 {name:'B-initial16',schedule:[16,64],beam:4,depth:4},
 {name:'C-beam8',schedule:[4,16,64],beam:8,depth:4},
 {name:'D-samples-beam',schedule:[8,32,128],beam:8,depth:4},
 {name:'D2-stronger',schedule:[16,64,256],beam:16,depth:4},
 {name:'E2-stronger-depth6',schedule:[16,64,256],beam:16,depth:6},
 {name:'E-depth6',schedule:[8,32,128],beam:8,depth:6},
 {name:'F-legacy-restarts',schedule:[4,16,64],beam:4,depth:4,restarts:true},
 {name:'G-enhanced-restarts',schedule:[16,64,256],beam:16,depth:4,restarts:true},
];
function branching(){const i=canonical(2);i.player=i.player.slice(0,2);i.player.forEach(p=>p.techs=[p.techs[0],p.techs[1]]);i.enemy.forEach(e=>{e.currentHp=180;e.customStats.spd=100;e.customStats.atk=65;});return i;}
function stochastic(){const i=small();i.player[0].techs=[2,3,6,15].map(id=>unit('X',id).techs[0]);i.player[0].customStats.atk=50;i.player[0].currentHp=120;i.enemy[0].currentHp=150;i.enemy[0].customStats.atk=35;i.enemy[0].initialStatuses={paralysis:true};return i;}
const fixtures=[['terminal125',canonical(1)],['branching16',branching()],['stochastic4',stochastic()]],budget=12000,rows=fs.existsSync('docs/phase-2k-l4/experiment-matrix.json')?JSON.parse(fs.readFileSync('docs/phase-2k-l4/experiment-matrix.json')).rows:[];
const save=()=>fs.writeFileSync('docs/phase-2k-l4/experiment-matrix.json',JSON.stringify({baseline:'f705977',budget,variants,fixtures:fixtures.map(([name,input])=>({name,input})),rows},null,2)+'\n');
// Warm production path before timing. Each experiment remains deterministic.
{const s=createOptimizedSearchPass(small(),128,{seed:42});while(!s.done)s.step();}
for(const [fixture,input]of fixtures)for(const objective of ['fastest-potential','average-victory','success-rate'])for(const seed of [42,137])for(const v of variants){
 if(rows.some(r=>r.fixture===fixture&&r.objective===objective&&r.seed===seed&&r.variant===v.name))continue;
 const stages=[],initial=[];let pass=0;const opts={seed,objective,maxRounds:12,config:{beamWidth:v.beam,maxDepth:v.depth},simulationRules:{accuracyMode:'game-accurate',rngPolicy:'natural'}};
 const make=(i,b,o)=>{const id=++pass;return createOptimizedSearchPass(i,b,{...o,screeningSchedule:v.schedule,onStage:(stage,candidates)=>{stages.push({pass:id,...stage});if(stage.depth===1&&stage.samples===v.schedule[0])initial.push([...candidates].sort((a,b)=>compareCandidates(a,b,objective)).map(c=>c.key));}});};
 const t=performance.now();let result;
 try {if(v.restarts)result=experimentalRestarts(input,budget,opts,make);else{const s=make(input,budget,opts);while(!s.done)s.step();result=s.result('completed',performance.now()-t);}}catch(error){rows.push({fixture,objective,seed,variant:v.name,error:String(error)});save();continue;}
 const elapsedMs=performance.now()-t,o=result.optimized,selected=o.topCandidates[0],stageRoot=stages.find(s=>s.depth===1),rootKey=o.fastestRoute?.sourcePrefixKey;
 rows.push({fixture,objective,seed,variant:v.name,evaluations:o.evaluations,budget,unused:budget-o.evaluations,fraction:o.evaluations/budget,elapsedMs,evalsPerSecond:o.evaluations*1000/elapsedMs,rootPlans:o.rootPlanCount,depth:o.depth,termination:o.passes?.stopReason??o.effort.termination,passes:pass,fastest:o.fastestRoute?.totalFrames??null,mean:selected?.stats.averageVictoryFrames??null,success:selected?.stats.successRate??null,samples:selected?.stats.evaluations??0,selectedKey:selected?.key??null,fastestSourceRootRank:initial[0]?.indexOf(rootKey)+1||null,initialRetained:stageRoot?.retained,stages});save();
 console.log(fixture,objective,seed,v.name,o.evaluations,Math.round(elapsedMs),o.fastestRoute?.totalFrames??null);
}
