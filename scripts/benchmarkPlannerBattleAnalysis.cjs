const fs=require('node:fs');
const {performance}=require('node:perf_hooks');
const {route,record,buildPlannerBattleAnalysisPreset:build,load}=require('../tests/helpers/plannerAnalysisFixtures.cjs');
const {reconstructRunStateBeforeEvent:replay}=load('src/utils/runPlanner/runPlannerReplay.ts');
const {historicalPlayerTeam,historicalEnemyTeam}=load('src/utils/runPlanner/runBattleAnalysis.ts');
const samples=[];
let run=route(0);
for(let count=1;count<=500;count++){
 run=record(run);
 if(![10,100,500].includes(count))continue;
 const event=run.history.at(-1),times=[];
 // Fixture generation is outside the timed path. Warm modules once, then measure five fresh replays, no cache.
 build(run,event.id);
 for(let i=0;i<5;i++){
  let t=performance.now();const state=replay(run,event.id);const replayMs=performance.now()-t;
  t=performance.now();historicalPlayerTeam(state);const playerMappingMs=performance.now()-t;
  t=performance.now();historicalEnemyTeam(event);const enemyMappingMs=performance.now()-t;
  t=performance.now();const preset=build(run,event.id);const totalWallMs=performance.now()-t;
  times.push({replayMs,playerMappingMs,enemyMappingMs,totalWallMs,presetBytes:Buffer.byteLength(JSON.stringify(preset))});
 }
 const median=key=>times.map(x=>x[key]).sort((a,b)=>a-b)[2];
 const sample={eventCount:count,replayedEvents:count-1,...Object.fromEntries(Object.keys(times[0]).map(k=>[k,Number(median(k).toFixed(3))]))};samples.push(sample);console.log(sample);
}
fs.writeFileSync('docs/phase-2k-i/performance.json',JSON.stringify({method:'Five warm measurements, median; real recorded Boot Domain battles, fixture generation excluded; selected last event excluded; no cache',node:process.version,samples},null,2)+'\n');
