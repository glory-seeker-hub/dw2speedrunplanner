const {test}=require('node:test'),assert=require('node:assert/strict');
const {host,find,nodes,button,fixture,load}=require('./helpers/multipleRunFixtures.cjs');
const {createRunBackup}=load('src/utils/runPlannerBackup.ts');
const {createRunPlan}=load('src/utils/runPlanCreation.ts');
const incoming=createRunBackup({schemaVersion:7,runs:[createRunPlan('gold-hawk','UI import')],activeRunId:null},'all-runs');
function uiFixture(){const planner=fixture();const dialog=host('src/components/run-planner/RunBackupDialog.tsx','RunBackupDialog');return {planner,ui:()=>dialog({planner:planner.render()})};}
const fileEvent=(text=JSON.stringify(incoming))=>({target:{files:[{name:'test.json',size:text.length,text:async()=>text}],value:'test.json'}});
const choose=(h,event=fileEvent())=>find(h.ui(),p=>p.type==='file').props.onChange(event);
const confirm=h=>find(h.ui(),p=>Array.isArray(p.children)&&p.children[0]==='Import ');
test('file input resets; preview and cancel/close never write',async()=>{
  const h=uiFixture(),before=h.planner.raw(),event=fileEvent();await choose(h,event);assert.equal(event.target.value,'');
  assert.ok(confirm(h));assert.equal(h.planner.raw(),before);assert.equal(h.planner.writes(),0);
  button(h.ui(),'Cancel import').props.onClick();assert.equal(confirm(h),undefined);assert.equal(h.planner.raw(),before);
  await choose(h);h.ui().props.onOpenChange(false);assert.equal(confirm(h),undefined);assert.equal(h.planner.raw(),before);
});
test('confirmation writes once; double click ignored; successful import reloads/selects/edits/deletes',async()=>{
  const h=uiFixture();await choose(h);const action=confirm(h).props.onClick;action();action();
  assert.equal(h.planner.writes(),1);assert.equal(h.planner.render().data.runs.length,1);
  assert.deepEqual(h.planner.reload().data,h.planner.render().data);
  assert.match(find(h.ui(),p=>p.role==='status').props.children,/1 run imported/);
  const run=h.planner.render().activeRun;assert.equal(h.planner.render().loadRun(run.id),true);
  assert.ok(h.planner.render().recordBattle(require('./helpers/multipleRunFixtures.cjs').safe));
  assert.equal(h.planner.render().deleteRun(run.id),true);assert.equal(h.planner.render().data.runs.length,0);
});
for(const reason of ['QuotaExceededError','SecurityError'])test('import '+reason+' leaves memory/disk intact; retry works',async()=>{
  const h=uiFixture();h.planner.create('blue-falcon','Keep');const before=h.planner.raw(),writes=h.planner.writes();
  await choose(h);h.planner.fail(reason);confirm(h).props.onClick();
  assert.equal(h.planner.raw(),before);assert.deepEqual(h.planner.render().data,JSON.parse(before));assert.equal(h.planner.writes(),writes);
  assert.match(find(h.ui(),p=>p.role==='alert').props.children,/No runs were imported/);assert.ok(confirm(h));
  assert.equal(find(h.ui(),p=>p.role==='status'),undefined);h.planner.fail(null);confirm(h).props.onClick();assert.equal(h.planner.writes(),writes+1);
});
test('invalid existing browser payload blocks import without overwriting it',()=>{
  const h=fixture();global.localStorage.getItem=()=>'{broken';
  const render=host('src/hooks/useRunPlanner.ts','useRunPlanner');assert.equal(render({}).importBackup(incoming),false);assert.equal(h.writes(),0);
  assert.match(render({}).error,/protect/);
});
test('closing while a file reads discards the late preview',async()=>{
  const h=uiFixture();let resolve;const event=fileEvent();event.target.files[0].text=()=>new Promise(r=>{resolve=r;});
  const pending=choose(h,event);h.ui().props.onOpenChange(false);resolve(JSON.stringify(incoming));await pending;
  assert.equal(confirm(h),undefined);assert.equal(h.planner.writes(),0);
});
test('choosing another file discards older asynchronous result',async()=>{
  const h=uiFixture();let resolve;const event=fileEvent();event.target.files[0].text=()=>new Promise(r=>{resolve=r;});
  const pending=choose(h,event);await choose(h,fileEvent('{broken'));resolve(JSON.stringify(incoming));await pending;
  assert.equal(confirm(h),undefined);assert.match(find(h.ui(),p=>p.role==='alert').props.children,/valid JSON/);assert.equal(h.planner.writes(),0);
});
test('zero-run exports disabled and import chooser accessible',()=>{
  const h=uiFixture();for(const label of ['Export Current Run','Export All Runs'])assert.equal(button(h.ui(),label).props.disabled,true);
  assert.equal(find(h.ui(),p=>p.type==='file').props.accept,'.json,application/json');assert.ok(find(h.ui(),p=>p.htmlFor==='run-backup-file'));
});
test('HTML/script run name is escaped by React in preview',async()=>{
  const h=uiFixture(),b=structuredClone(incoming);b.runs[0].name='<script>evil()</script>';await choose(h,fileEvent(JSON.stringify(b)));
  const list=find(h.ui(),p=>p['aria-label']==='Runs to import');const html=require('react-dom/server').renderToStaticMarkup(list);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
test('help distinguishes local explicit backups and preview append from route print',()=>{
  const sections=load('src/components/help/userGuideContent.ts').GUIDE_SECTIONS;const text=JSON.stringify(sections);
  for(const term of ['Export Current Run','Export All Runs','preview','never overwrite','no automatic backup','cloud synchronization','Export Route'])assert.ok(text.includes(term),term);
});
for(const source of ['manual','planner'])test('append import preserves '+source+' simulation and completed Results',()=>{
  const run=require('./helpers/plannerAnalysisFixtures.cjs').route(1);
  const planner={data:{schemaVersion:7,runs:[run],activeRunId:run.id}};
  const render=host('src/pages/Index.tsx','default',{'@/hooks/useRunPlanner':{useRunPlanner:()=>planner}});
  if(source==='planner')find(render(),p=>p.planner).props.onAnalyze(run.id,run.history[0].id);
  const before=find(render(),p=>'onSimulationComplete' in p).props.preset;
  find(render(),p=>'onSimulationComplete' in p).props.onSimulationComplete({totalSimulations:1});
  planner.data=load('src/utils/runPlannerBackup.ts').prepareRunImport(planner.data,incoming);
  assert.deepEqual(find(render(),p=>'onSimulationComplete' in p).props.preset,before);
  assert.equal(find(render(),p=>p.results).props.results.totalSimulations,1);
});
test('empty-Planner import keeps unrelated manual Results',()=>{
  const planner={data:{schemaVersion:7,runs:[],activeRunId:null}};
  const render=host('src/pages/Index.tsx','default',{'@/hooks/useRunPlanner':{useRunPlanner:()=>planner}});
  find(render(),p=>'onSimulationComplete' in p).props.onSimulationComplete({totalSimulations:1});
  planner.data=load('src/utils/runPlannerBackup.ts').prepareRunImport(planner.data,incoming);
  assert.equal(find(render(),p=>p.results).props.results.totalSimulations,1);
});
