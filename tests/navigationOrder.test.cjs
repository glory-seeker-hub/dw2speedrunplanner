const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderToStaticMarkup:html}=require('react-dom/server');
const {host,find,button}=require('./helpers/componentHost.cjs');
const {route}=require('./helpers/plannerAnalysisFixtures.cjs');
function page(saved=true){
 const run=saved?route(1):null;
 const planner={data:{schemaVersion:7,runs:run?[run]:[],activeRunId:run?.id??null},activeRun:run,starterId:'',name:'',error:null,feedbackRevision:0};
 const render=host('src/pages/Index.tsx','default',{'@/hooks/useRunPlanner':{useRunPlanner:()=>planner}});
 return {run,planner,render,tabs:()=>find(render(),p=>typeof p.onValueChange==='function'),sim:()=>find(render(),p=>'onSimulationComplete' in p),analyze:()=>find(render(),p=>p.planner).props.onAnalyze(run.id,run.history[0].id)};
}
function tabMarkup(h){return html(h.render()).match(/<button[^>]*role="tab"[^>]*>[\s\S]*?<\/button>/g).slice(0,4);}
const result=require('./helpers/simulationReportFixtures.cjs').fixture({method:'random-monte-carlo',budget:1}).result;
const labels=['Run Planner','Team Builder','Battle Simulation','Results'];
test('navigation DOM order and initial active state use Planner first',()=>{
 const h=page(false),tabs=tabMarkup(h);
 assert.deepEqual(tabs.map(t=>labels.find(label=>t.includes(label))),labels);
 assert.equal(h.tabs().props.value,'run-planner');
 assert.match(tabs[0],/aria-selected="true"/);assert.match(tabs[0],/data-state="active"/);
 tabs.slice(1).forEach(t=>assert.match(t,/data-state="inactive"/));
 assert.match(tabs[3],/disabled=""/);
});
for(const [id,label] of [['team-builder','Team Builder'],['battle-simulation','Battle Simulation'],['results','Results']])test('selected semantics and active styling move to '+label,()=>{
 const h=page(false);if(id==='results')h.sim().props.onSimulationComplete(result);
 h.tabs().props.onValueChange(id);
 const tabs=tabMarkup(h);assert.equal(tabs.filter(t=>t.includes('data-state="active"')).length,1);
 assert.match(tabs.find(t=>t.includes(label)),/aria-selected="true"/);
 assert.match(tabs.find(t=>t.includes(label)),/data-state="active"/);
 assert.match(tabs.find(t=>t.includes('Run Planner')),/data-state="inactive"/);
});
for(const saved of [false,true])test('initial Planner landing '+(saved?'retains saved run':'offers starter without creating run'),()=>{
 const h=page(saved),before=JSON.stringify(h.planner.data),markup=html(h.render());
 assert.match(markup,saved?/Active run/:/No active run/);
 assert.match(markup,saved?/Analysis gold-hawk/:/Choose your starter/);
 assert.equal(JSON.stringify(h.planner.data),before);
});
test('intro explicitly offers primary route and alternative manual entry',()=>{
 const markup=html(page(false).render());
 assert.match(markup,/Plan the route\. Analyze the battle\. Optimize the result\./);
 assert.match(markup,/Use Run Planner to build and track your route, or Team Builder for a manual battle setup/);
 assert.doesNotMatch(markup,/Build the team\. Test the battle/);
});
test('Analyze and contextual returns use semantic destinations after reorder',()=>{
 const h=page();h.analyze();assert.equal(h.tabs().props.value,'battle-simulation');
 assert.equal(h.sim().props.preset.source.runId,h.run.id);
 button(h.render(),'Back to Run Planner').props.onClick();assert.equal(h.tabs().props.value,'run-planner');
 h.analyze();h.sim().props.onSimulationComplete(result);assert.equal(h.tabs().props.value,'results');
 button(h.render(),'Back to Simulator setup').props.onClick();assert.equal(h.tabs().props.value,'battle-simulation');
});
test('manual entry saves a team, opens simulator and reaches fourth Results tab',()=>{
 const h=page(false);h.tabs().props.onValueChange('team-builder');
 find(h.render(),p=>typeof p.onSaveTeam==='function').props.onSaveTeam([{name:'Agumon'}]);
 h.tabs().props.onValueChange('battle-simulation');assert.equal(h.sim().props.savedTeams.length,1);
 assert.equal(h.sim().props.preset,undefined);
 h.sim().props.onSimulationComplete(result);assert.equal(h.tabs().props.value,'results');
 assert.doesNotMatch(tabMarkup(h)[3],/disabled=""/);
});
test('manual reset clears historical preset while retaining Simulator destination',()=>{
 const h=page();h.analyze();h.sim().props.onClearPreset();assert.equal(h.sim().props.preset,undefined);
 assert.equal(h.tabs().props.value,'battle-simulation');assert.equal(button(h.render(),'Back to Run Planner'),undefined);
});
test('stale Planner results return to first Planner tab and disable fourth Results',()=>{
 const h=page();h.analyze();h.sim().props.onSimulationComplete(result);
 h.planner.data.activeRunId=null;h.render();h.render();assert.equal(h.tabs().props.value,'run-planner');
 assert.match(tabMarkup(h)[3],/disabled=""/);assert.equal(h.sim().props.preset,undefined);
});
test('Go to Battle stays an in-Planner anchor with an existing destination',()=>{
 const markup=html(page().render());assert.match(markup,/href="#run-battle"/);assert.match(markup,/id="run-battle"/);
});
