// Generate a local-only browser harness against the real production Worker asset.
// Run after npm run build, then open /phase-2ob-smoke.html on the local preview.
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const {unit}=require('../tests/helpers/battleSupportFixtures.cjs');
const assets=fs.readdirSync('dist/assets'),worker=assets.find(f=>/^battleSimulation\.worker-.*\.js$/.test(f)),css=assets.find(f=>f.endsWith('.css'));
if(!worker)throw Error('Build the production Worker first.');
const player=[unit('Fast',6,{stats:{hp:100000,spd:200,atk:100}}),unit('Slow',1,{stats:{hp:100000,spd:100,atk:1}}),unit('Third',6,{stats:{hp:100000,spd:80,atk:1}})];
const enemy=[unit('E1',6,{currentHp:1,stats:{spd:1}}),unit('E2',6,{currentHp:50,initialStatuses:{invisibility:true},stats:{spd:1}})];
const cases={one:{player,enemy:enemy.slice(0,1),floorSpecialty:'None'},two:{player,enemy,floorSpecialty:'None'},dynamic:{player:player.map((p,i)=>i===0?{...p,currentHp:1}:p),enemy,floorSpecialty:'None'}};
const source=`import React from 'react';import{createRoot}from'react-dom/client';import{BattleResults}from'./src/components/BattleResults';import{InfoDialog}from'./src/components/InfoDialog';
const cases=${JSON.stringify(cases)};
function App(){const[result,setResult]=React.useState(null),[status,setStatus]=React.useState('Ready'),[port,setPort]=React.useState(null);
function start(kind,method='random-monte-carlo',count=1){const w=new Worker('/assets/${worker}',{type:'module'});setPort(w);setStatus('Running');let progress=0;
w.onerror=e=>setStatus('ERROR '+e.message);w.onmessage=({data:m})=>{if(m.type==='PROGRESS')progress++;if(['COMPLETE','CANCELLED','ERROR'].includes(m.type)){setStatus(m.type+'; progress events='+progress+(m.message?'; '+m.message:''));setResult(m.result??null);w.terminate();}};
w.postMessage({type:'START',jobId:'smoke',input:cases[kind],requestedSimulations:count,seed:kind==='dynamic'?2:1,searchMethod:method,simulationRules:{accuracyMode:'strategy'},optimizedConfig:{beamWidth:1,maxDepth:1},maxRounds:20});}
return <main className="p-6 space-y-4"><h1>Phase 2O-B production Worker smoke</h1><InfoDialog/><div className="flex gap-4"><button onClick={()=>start('one')}>One round</button><button onClick={()=>start('two')}>Target lost + transition</button><button onClick={()=>start('dynamic')}>Dynamic HP</button><button onClick={()=>start('two','optimized-action-search',64)}>Optimized</button><button onClick={()=>start('one','random-monte-carlo',1000000)}>Long Random</button><button onClick={()=>port?.postMessage({type:'CANCEL',jobId:'smoke'})}>Cancel</button></div><p role="status">{status}</p>{result&&<><pre>{JSON.stringify({minFrames:result.minFrames,timing:result.fastestBattleByFramesTiming??result.fastestBattleHistoryTiming,misses:(result.fastestBattleByFrames.length?result.fastestBattleByFrames:result.fastestBattleHistory).filter(a=>a.accuracy?.cause==='no-effective-target').map(a=>({state:a.state,outcome:a.outcome,frames:a.durationFrames,mp:a.mpAccounting.costCharged,intent:a.targetIntent,effective:a.effectiveTargetIds}))},null,2)}</pre><BattleResults results={result}/></>}</main>};createRoot(document.getElementById('root')).render(<App/>);`;
esbuild.buildSync({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'phase-2ob-smoke.tsx',loader:'tsx'},bundle:true,format:'esm',outfile:'dist/phase-2ob-smoke.js',loader:{'.jpg':'dataurl'},define:{'process.env.NODE_ENV':'"production"'},tsconfig:'tsconfig.app.json'});
fs.writeFileSync(path.join('dist','phase-2ob-smoke.html'),'<!doctype html><html><head><meta charset="utf-8"><title>Phase 2O-B smoke</title><link rel="stylesheet" href="/assets/'+css+'"></head><body><div id="root"></div><script type="module" src="/phase-2ob-smoke.js"></script></body></html>');
console.log('Local smoke harness ready: http://127.0.0.1:4173/phase-2ob-smoke.html');

