const fs=require('node:fs');
const {unit,input,sample,confusionBest,simulateBattleCore,createSeededBattleRng,load}=require('../tests/helpers/tasLuckFixtures.cjs');
const {doubleInput,doublePolicy}=require('../tests/helpers/tasFixtures.cjs');
const fixtures={
 'no-status':input([unit('P',6,{stats:{atk:200}})],[unit('E',6,{stats:{hp:10}})]),
 'repeated-paralysis':input([unit('P',105)],[unit('E',6,{stats:{hp:80}})]),
 'confusion-only':input([unit('P',6,{stats:{atk:1,spd:100}})],[unit('E',6,{initialStatuses:{confusion:true},stats:{hp:100,atk:400}})]),
 'one-conflict':confusionBest(),
 'repeated-conflicts':input([unit('P',6,{stats:{atk:1,spd:100}})],[unit('E',6,{initialStatuses:{paralysis:true,confusion:true},stats:{hp:1000,atk:1}})]),
 'double-e-stun':doubleInput()
};
const before=process.argv.includes('--before'), results=[];
const savedBrowser = fs.existsSync('docs/phase-2k-l1a/performance.json') ? JSON.parse(fs.readFileSync('docs/phase-2k-l1a/performance.json')).browserSmoke : undefined;
for(const [name,battle] of Object.entries(fixtures))for(const policy of ['natural','tas-favorable','tas-luck']){
 const options={maxRounds:name==='double-e-stun'?60:name==='one-conflict'?1:5,...(name==='double-e-stun'?{actionPolicy:doublePolicy}:{})};
 const count=before?3:30;let result,opportunities=0,branchesExplored=0,pruned=0,maxFrontier=0;
 const run=seed=>policy==='tas-luck'?sample(battle,seed,options):{result:simulateBattleCore(battle,{...options,rng:createSeededBattleRng(seed),simulationRules:{accuracyMode:'strategy',rngPolicy:policy}})};
 run(0);const start=performance.now();
 for(let seed=0;seed<count;seed++){const s=run(seed);result=s.result;if(s.summary){opportunities+=s.summary.opportunities;branchesExplored+=s.summary.branchesExplored;pruned+=s.summary.pruned;maxFrontier=Math.max(maxFrontier,s.summary.maxFrontier);}}
 const wallMs=performance.now()-start;results.push({name,policy,fairRollouts:count,wallMs,fairRolloutsPerSecond:count*1000/wallMs,opportunities,branchesExplored,pruned,maxFrontier,resultBytes:Buffer.byteLength(JSON.stringify(result))});
 console.log(JSON.stringify(results.at(-1)));
}
fs.mkdirSync('docs/phase-2k-l1a',{recursive:true});
fs.writeFileSync('docs/phase-2k-l1a/'+(before?'performance-before.json':'performance.json'),JSON.stringify({notes:'Local seeded engine characterization; one warmup per fixture/policy; strategy accuracy, cap 8. One-conflict limited to one round, repeated conflicts five, double E-Stun sixty. Timings characterize this machine, not test thresholds. Before counts include generalized initial replay work; after branch counts exclude initial execution.',results,...(!before && savedBrowser ? {browserSmoke:savedBrowser} : {})},null,2)+'\n');
