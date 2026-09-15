// Production module graph: no gameplay or validation test doubles.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.DEV', 'false').replaceAll('import.meta.url', JSON.stringify(require('node:url').pathToFileURL(file).href));
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const localRequire = (id) => {
    if (/\.(jpg|png)$/.test(id)) return id; // Asset URL only; no image decoding in component tests.
    if(id.startsWith('.')) { const base=path.resolve(path.dirname(file),id); return load(base+(fs.existsSync(base+'.ts')?'.ts':'.tsx')); }
    if (!id.startsWith('@/')) return require(id);
    const base = path.join('src', id.slice(2));
    return load(base + (fs.existsSync(path.resolve(root, base + '.ts')) ? '.ts' : '.tsx'));
  };
  new Function('require', 'module', 'exports', js)(localRequire, mod, mod.exports);
  return mod.exports;
}
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
const {createRunPlan}=load('src/utils/runPlanCreation.ts');
const css=fs.readFileSync(path.join(root,'src/index.css'),'utf8');
const tokens=Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2]]));
const hsl=name=>tokens[name].startsWith('var(')?hsl(tokens[name].slice(6,-1)):tokens[name].split(' ').map(parseFloat);
const rgb=name=>{let [h,s,l]=hsl(name);s/=100;l/=100;const a=s*Math.min(l,1-l);return [0,8,4].map(n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));});};
const luminance=rgb=>rgb.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
const contrast=(a,b)=>{const x=luminance(rgb(a)),y=luminance(rgb(b));return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};

for(const [fg,bg,min] of [
 ['foreground','background',4.5],['foreground','card',4.5],['foreground','panel-raised',4.5],
 ['muted-foreground','panel-raised',4.5],['info','panel-raised',4.5],
 ['selection','selection-surface',4.5],['primary-foreground','primary',4.5],
 ['destructive','panel-raised',4.5],['destructive-foreground','destructive',4.5],
 ['secondary-foreground','secondary',4.5],['success-foreground','success',4.5],
 ['border','panel-raised',3],['ring','panel-raised',3]
])test(`theme contrast ${fg} / ${bg} >= ${min}:1`,()=>assert.ok(contrast(fg,bg)>=min,`${contrast(fg,bg).toFixed(2)}:1`));

test('theme top-level tabs retain selected and disabled semantics; Info has an accessible name',()=>{
 const html=render(load('src/pages/Index.tsx').default,{});
 const tabs=html.match(/<button[^>]*role="tab"[^>]*>/g);assert.ok(tabs.length>=4);
 assert.match(tabs[0],/aria-selected="true"/);assert.match(tabs[2],/disabled=""/);assert.match(tabs[3],/aria-selected="false"/);
 assert.ok(html.includes('aria-label="About this application"'));
});
test('theme active and reserve badges preserve text and do not alter the run during render',()=>{
 const run=createRunPlan('gold-hawk','Theme regression');run.roster.push({...structuredClone(run.roster[0]),instanceId:'visual-reserve'});
 const before=JSON.stringify(run);let writes=0;global.localStorage={getItem:()=>null,setItem:()=>writes++};
 const html=render(load('src/components/run-planner/RunPlanner.tsx').RunPlanner,{planner:{activeRun:run,data:{schemaVersion:7,activeRunId:run.id,runs:[run]},starterId:'',name:'',error:null,feedbackRevision:0}});
 assert.ok(html.includes('Active Digiline'));assert.ok(html.includes('Reserve'));assert.ok(html.includes('menu-active-badge'));
 assert.equal(JSON.stringify(run),before);assert.equal(writes,0);
});
test('theme selected techniques retain native checked/new/required states and original change callback',()=>{
 const {createAvailableTechniqueState}=load('src/utils/techniqueInheritance.ts');const {buildTechniqueChoice}=load('src/utils/techniqueCapacity.ts');
 const state=createAvailableTechniqueState(['Pepper Breath','Spiral Twister'],{type:'starter',speciesId:'agumon'});
 const choice=buildTechniqueChoice(state,['Spiral Twister']);let result;
 const props={choices:[{instanceId:'one',name:'Agumon',newLevel:2,currentlyPossessed:['Pepper Breath'],choice}],selections:[{instanceId:'one',keptKeys:[choice.candidates[0].key]}],onChange:v=>result=v,onConfirm:()=>{},onCancel:()=>{}};
 const Component=load('src/components/run-planner/TechniqueChoiceControls.tsx').TechniqueChoiceControls,html=render(Component,props);
 assert.match(html,/<input[^>]*type="checkbox"[^>]*checked=""/);assert.ok(html.includes('(new)'));assert.ok(html.includes('1–12'));
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n?.props?[n,...nodes(n.props.children)]:[];
 const inputs=nodes(Component(props)).filter(n=>n.type==='input');assert.equal(inputs[0].props.checked,true);assert.equal(inputs[1].props.checked,false);
 inputs[1].props.onChange({target:{checked:true}});assert.deepEqual(result[0].keptKeys,choice.candidates.map(p=>p.key));
});
test('theme reset is destructive while regular confirmation remains primary',()=>{
 const {AlertDialog,AlertDialogAction}=load('src/components/ui/alert-dialog.tsx');
 const html=renderToStaticMarkup(React.createElement(AlertDialog,null,React.createElement(AlertDialogAction,{variant:'destructive'},'Delete Run'),React.createElement(AlertDialogAction,null,'Confirm DNA')));
 assert.match(html,/<button[^>]*bg-destructive[^>]*>Delete Run/);assert.match(html,/<button[^>]*bg-primary[^>]*>Confirm DNA/);
 const source=fs.readFileSync(path.join(root,'src/components/run-planner/RunPlanner.tsx'),'utf8');assert.match(source,/<AlertDialogAction variant="destructive"[^>]*[\s\S]*?Delete Run/);
});
test('theme collapsed management panels keep accessible disclosure buttons and labelled hidden content',()=>{
 const html=render(load('src/components/run-planner/ActionDisclosure.tsx').ActionDisclosure,{title:'Trading Center',id:'test-trade',active:false,compact:true,onCancel:()=>{},children:React.createElement('input',{'aria-label':'Trade fixture'})});
 assert.match(html,/<button[^>]*aria-expanded="false"[^>]*aria-controls="test-trade"/);assert.match(html,/<div id="test-trade" hidden=""/);
});
test('theme team slot selection offers keyboard-native named buttons',()=>{
 const html=render(load('src/components/TeamBuilder.tsx').TeamBuilder,{});
 for(const slot of [1,2,3])assert.match(html,new RegExp(`<button[^>]*aria-label="Select team slot ${slot}"`));
});
test('theme reduced motion disables persistent motion and palette stays centralized',()=>{
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);assert.ok(css.includes('animation-iteration-count: 1'));
 assert.equal(hsl('secondary')[0],214);assert.equal(hsl('digital-purple')[0],hsl('info')[0]);
 for(const file of ['RunPlanner','DnaControls','TradeControls','TechniqueChoiceControls']){
  const source=fs.readFileSync(path.join(root,`src/components/run-planner/${file}.tsx`),'utf8');assert.doesNotMatch(source,/(?:#[0-9a-fA-F]{6}|rgba?\(|hsla?\()/);
 }
});
