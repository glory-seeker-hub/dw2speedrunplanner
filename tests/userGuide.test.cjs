const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/loadTs.cjs');
const {GUIDE_SECTIONS:sections,GUIDE_GLOSSARY:glossary}=load('src/components/help/userGuideContent.ts');
const {UserGuide}=load('src/components/help/UserGuide.tsx');
const {RESULT_HELP,SEARCH_QUALITY_PRESETS,THOROUGHNESS_DETAILS}=load('src/utils/battle/battlePresentation.ts');
const {resolveThoroughnessPolicy}=load('src/utils/battle/battleSearchPasses.ts');
const {OPTIMIZED_PRESETS}=load('src/utils/battle/battleOptimizedSearch.ts');
const text=id=>{const s=sections.find(s=>s.id===id);assert.ok(s,id);return [...s.paragraphs,...s.items??[]].join('\n');};
const all=sections.map(s=>text(s.id)).join('\n')+'\n'+glossary.flat().join('\n');
const checks=[
 ['default workflow','workflows',/Run Planner opens by default/],
 ['direct Analyze workflow','workflows',/Run Planner →.*Analyze Battle.*→ Battle Simulation → Results/],
 ['manual alternative','workflows',/Team Builder is not required after Analyze Battle/],
 ['navigation order','workflows',/Run Planner, Team Builder, Battle Simulation, Results/],
 ['results availability','workflows',/Results is unavailable until a result exists/],
 ['multiple saved runs','planner',/New Run creates another route; Saved runs switches the active run/],
 ['history and event types','planner',/Route History[\s\S]*Battle:[\s\S]*Digivolve:[\s\S]*DNA:[\s\S]*Trade:/],
 ['Coliseum progression','planner',/0 XP, 0 Bits, no capture and no level-up opportunity[\s\S]*stored XP remains stored/],
 ['historical state','analyze',/BEFORE that battle[\s\S]*source\/breadcrumb/],
 ['simulation does not write history','analyze',/does not edit historical route progression or automatically write victories back/],
 ['manual session lifetime','team',/current app session[\s\S]*surviving a reload/],
 ['Random does not optimize','methods',/Random Monte Carlo[\s\S]*does not optimize Player actions/],
 ['bounded optimized tree','methods',/not exhaustive enumeration of the entire battle tree/],
 ['average semantics','methods',/average of winning samples, not expected real-game time/],
 ['success semantics','methods',/highest observed success rate[\s\S]*No confidence interval/],
 ['quality versus thoroughness','quality',/How much total work is available[\s\S]*How aggressively[\s\S]*Maximum does not raise the budget/],
 ['budget ceiling','quality',/hard ceiling[\s\S]*not a target[\s\S]*Unused budget is not by itself an error/],
 ['conditional restart','quality',/Conditional fallback restart only after enhanced search/],
 ['unchanged depth','quality',/All thoroughness modes keep the existing round depth/],
 ['accuracy separate from RNG','accuracy',/Strategy disables ordinary Hit Rate misses[\s\S]*does not make all mechanics deterministic[\s\S]*Accuracy is separate/],
 ['seeded Natural','accuracy',/Natural search can evaluate many seeded worlds/],
 ['fastest versus screened','results',/one concrete simulation path[\s\S]*repeatedly evaluated[\s\S]*may differ/],
 ['objective-aware recommendations','results',/Actions for Fastest[\s\S]*For Average\/Success they show the selected screened/],
 ['replay provenance warning','results',/Replay and its TAS Requirements may belong to the retained Fastest Route rather than the selected screened strategy/],
 ['intended Random target','results',/does not replace the intended Random target/],
 ['alternatives not branches','results',/not TAS branches or every explored candidate/],
 ['compact and expanded history','results',/Compact action cards[\s\S]*Expand Action details for MP/],
 ['timing scope','results',/external menu\/order-entry overhead is not included/],
 ['narrow eligible TAS conflict','tas',/only explicit TAS branch search[\s\S]*eligible normal action while both Confused AND Paralyzed[\s\S]*\(A\) Paralysis blocks[\s\S]*\(B\) Paralysis allows/],
 ['direct favorable TAS statuses','tas',/against Enemy succeeds; against Player it fails[\s\S]*recovery is unfavorable to Enemy and favorable to Player/],
 ['unsupported RNG remains natural','tas',/Unsupported RNG remains Natural\/current behavior/],
 ['TAS probabilities conditional','tas',/not natural game probabilities/],
 ['sample checkpoint meaning','advanced',/candidate sample checkpoints, not rounds, attacks[\s\S]*same fair sequence/],
 ['beam coverage tradeoff','advanced',/larger beam keeps more alternatives alive[\s\S]*does not always improve/],
 ['round depth not battle duration','advanced',/Round Depth 4[\s\S]*battle can continue into rounds 5, 6, 7[\s\S]*not battle duration/],
 ['restart not a sample','advanced',/neither a battle round nor a sample/],
 ['stat overrides local','stats',/simulation input, not Planner history[\s\S]*Current HP\/MP[\s\S]*Max HP\/MP/],
 ['frozen simulation Markdown','exports',/Export Simulation[\s\S]*Markdown[\s\S]*frozen simulation result/],
 ['separate printed route','exports',/Export Route[\s\S]*Print \/ Save as PDF[\s\S]*not a Simulation Report/],
 ['JSON not a UI download','exports',/JSON serialization is available programmatically; it is not a JSON download button/],
 ['cancellation is partial','simulation',/Cancel stops future work[\s\S]*not a completed search/],
 ['no optimum guarantee','limits',/not proof of a global optimum[\s\S]*does not guarantee convergence/],
];
for(const [name,id,pattern]of checks)test('guide: '+name,()=>assert.match(text(id),pattern));
for(const [mode,d]of Object.entries(THOROUGHNESS_DETAILS))test('guide policy descriptor matches production '+mode,()=>{
 const p=resolveThoroughnessPolicy(mode,16,1000000,{beamWidth:4,maxDepth:6});
 assert.deepEqual([...d.samples],p.screeningSchedule);assert.equal(4*d.beamMultiplier,p.config.beamWidth);assert.equal(p.config.maxDepth,6);
 assert.ok(text('quality').includes(d.samples.join(' → ')));
});
test('guide budget presets match production and Simulator consumes the shared source',()=>{
 for(const [label,budget]of SEARCH_QUALITY_PRESETS){assert.equal(budget,OPTIMIZED_PRESETS[label].budget);assert.ok(text('quality').includes(budget.toLocaleString('en-US')));}
 assert.match(fs.readFileSync('src/components/BattleSimulation.tsx','utf8'),/SEARCH_QUALITY_PRESETS\.map/);
});
test('guide uses Results and Markdown definitions without independent rewrites',()=>{
 for(const key of ['fastest','screened','average','success','fair','tas','conditional','timing','candidates','natural'])assert.ok(all.includes(RESULT_HELP[key]),key);
});
test('guide contains no superseded labels or unsupported certainty',()=>{
 assert.doesNotMatch(all,/Single Pass|Use Full Budget|global minimum found|guaranteed optimal|Maximum = exact|TAS controls all RNG|battle ends at Round Depth|budget must be fully consumed/i);
});
test('glossary evaluation accounting and prefix depth are explicit',()=>{
 assert.equal(glossary.length,15);assert.match(glossary[0][1],/complete candidate fair sample[\s\S]*branches are not individually counted/);
 assert.match(glossary.find(([t])=>t==='Round Depth')[1],/battle can continue beyond/);
});
test('guide has five beginner disclosures open and advanced topics closed',()=>{
 assert.deepEqual(sections.filter(s=>s.open).map(s=>s.id),['workflows','planner','team','simulation','results']);
 for(const id of ['quality','advanced','tas','stats','limits'])assert.ok(!sections.find(s=>s.id===id).open);
});
test('guide semantic headings, unique destinations and native keyboard controls',()=>{
 const html=renderToStaticMarkup(React.createElement(UserGuide));const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,15);assert.equal(new Set(ids).size,ids.length);assert.equal((html.match(/<summary /g)||[]).length,16);
 assert.equal((html.match(/<h3 /g)||[]).length,15);assert.doesNotMatch(html,/<h[12456][ >]/);
 for(const id of ids)assert.ok(html.includes(`aria-controls="${id}"`));
 assert.match(html,/aria-label="Guide topics"/);assert.match(html,/focus-visible:outline/);assert.doesNotMatch(html,/<table/);
});
test('topic navigation opens disclosure, focuses summary and scrolls it into view',()=>{
 const tree=UserGuide();const nav=tree.props.children.find(x=>x?.type==='details').props.children[1];const button=nav.props.children.props.children[0];
 const calls=[],summary={focus:o=>calls.push(['focus',o]),scrollIntoView:o=>calls.push(['scroll',o])};const detail={open:false,querySelector:s=>{assert.equal(s,'summary');return summary;}};
 const old=global.document;global.document={getElementById:id=>{assert.equal(id,'guide-workflows');return detail;}};
 try{button.props.onClick();assert.equal(detail.open,true);assert.deepEqual(calls,[['focus',{preventScroll:true}],['scroll',{block:'start'}]]);}finally{global.document=old;}
});
test('existing Info dialog hosts one guide and removes obsolete mechanics copy',()=>{
 const s=fs.readFileSync('src/components/InfoDialog.tsx','utf8');assert.equal((s.match(/<UserGuide/g)||[]).length,1);
 assert.match(s,/defaultValue="how-to"/);assert.match(s,/aria-label="About this application"/);
 assert.doesNotMatch(s,/Not Implemented|Treated as normal attacks|Build Your Team/);assert.match(s,/whitespace-normal/);
});
