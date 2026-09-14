const fs=require('node:fs'),ts=require('typescript');
const {load}=require('./loadTs.cjs');
function host(file,name,overrides={}) {
 overrides={'@/hooks/useBattleSimulationWorker':{useBattleSimulationWorker:()=>({running:false,cancel(){},start(){}})},...overrides};
 const slots=[];let cursor=0;
 const react={...require('react'),useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},useEffect(effect){const i=cursor++;if(!(i in slots))slots[i]={cleanup:effect()}},useMemo:fn=>fn()};
 const mod={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',js)(id=>{if(id==='react')return react;if(id in overrides)return overrides[id];if(id.startsWith('@/')){const p='src/'+id.slice(2);return load(p+(fs.existsSync(p+'.ts')?'.ts':'.tsx'));}return require(id)},mod,mod.exports);
 const render=props=>{cursor=0;return mod.exports[name](props)};
 render.dispose=()=>slots.forEach(slot=>slot?.cleanup?.());
 return render;
}
function nodes(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];}
const find=(tree,predicate)=>nodes(tree).find(e=>predicate(e.props||{},e));
const button=(tree,label)=>find(tree,p=>p.children===label&&typeof p.onClick==='function');

module.exports={host,nodes,find,button};
