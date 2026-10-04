const {test}=require('node:test'),assert=require('node:assert/strict');
const {load,unit,rng,run,action}=require('./helpers/battleSupportFixtures.cjs');
const {host,find,button,nodes}=require('./helpers/componentHost.cjs');
const {setup}=require('./helpers/statOverrideFixtures.cjs');
const {createPlayerTechniqueSelections:create,resolvePlayerTechniqueSelections:resolve,techniqueMemberKey:key}=load('src/utils/battle/battleTechniqueOverrides.ts');
const {createBattleState,linkLegacySkill}=load('src/utils/battle/battleInput.ts');
const {assistEligible}=load('src/utils/battle/battleSupportEffects.ts');
const {selectableSkills,legacyActionPolicy,planAction}=load('src/utils/battle/battleActions.ts');
const {resolvePolicyTarget}=load('src/utils/battle/battleEffectCompletion.ts');
const {rootPlanInfo,enumeratePlayerRoundPlans,replayPlayerPrefix}=load('src/utils/battle/battleActionPlans.ts');
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const {createSimulationSearch}=load('src/utils/battle/battleSimulationSearch.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const {snapshotSimulationReportJob,buildBattleSimulationReport}=load('src/utils/battle/battleSimulationReport.ts');
const serializers=load('src/utils/battle/battleSimulationReportSerialization.ts');
const {createPlayerStatDrafts,resolvePlayerStatDrafts,resetPlayerStatDrafts}=load('src/utils/battle/battleStatOverrides.ts');
const input=player=>({player,enemy:[unit('Enemy',2,{currentHp:1,stats:{spd:1}})],floorSpecialty:'none'});
const multi=()=>[{...unit('Player',6,{stats:{atk:100,spd:100}}),instanceId:'p',plannerDigimonInstanceId:'p',techs:[6,2,0xb5,0xa1,0x89].map(id=>unit('X',id).techs[0])}];
const finish=s=>{while(!s.done)s.step();return s.result('completed',10);};
const toggle=(h,id,checked)=>find(h.render(),p=>p.type==='checkbox'&&p['aria-label'].endsWith(': '+id)).props.onChange({target:{checked}});
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}

for(const [label,ally,enemy,expected] of [
 ['no KO',null,null,false],['KO ally MP',30,null,true],['KO enemy MP',null,30,true],['both',30,40,true],['zero MP',0,0,false],['living MP',null,null,false],
])test('Necro legality and root plans: '+label,()=>{
 const p=unit('Necro',0xd2);p.techs.push(unit('X',6).techs[0]);
 const i={player:[p,...(ally===null?[]:[unit('Ally',2,{currentHp:0,currentMp:ally})])],enemy:[unit('E'),...(enemy===null?[]:[unit('KO',2,{currentHp:0,currentMp:enemy})])],floorSpecialty:'none'};
 const {state}=rootPlanInfo(i),a=state.combatants[0],skill=a.skills[0];
 assert.equal(assistEligible(a,skill,state.combatants),expected);
 assert.equal(selectableSkills(a,state.combatants).some(s=>s.key===skill.key),expected);
 const plans=[...enumeratePlayerRoundPlans(state)];
 assert.equal(plans.some(p=>p.orders.some(o=>o.canonicalSkillId===0xd2)),expected);
 for(let n=0;n<8;n++)if(!expected)assert.notEqual(legacyActionPolicy.chooseAction(a,{combatants:state.combatants,round:1},createSeededBattleRng(n)).skillKey,skill.key);
});
test('Necro-only random actor skips without a target; unrelated heal remains selectable',()=>{
 const s=createBattleState(input([unit('P',0xd2)])),a=s.combatants[0];
 assert.equal(legacyActionPolicy.chooseAction(a,{combatants:s.combatants,round:1},rng()).kind,'skip');
 assert.equal(assistEligible(a,linkLegacySkill(unit('X',0xb5).techs[0]),s.combatants),true);
});
test('Necro both sides retain random all-field target and RNG label',()=>{
 const s=createBattleState({player:[unit('P',0xd2),unit('A',2,{currentHp:0,currentMp:30})],enemy:[unit('E'),unit('K',2,{currentHp:0,currentMp:40})],floorSpecialty:'none'});
 const a=planAction(s,s.combatants[0],{kind:'skill',skillKey:'waza-210'}),random=rng({'necro-ko-target':[0,1]});
 assert.deepEqual(resolvePolicyTarget(s,a,random),['player-1']);assert.deepEqual(resolvePolicyTarget(s,a,random),['enemy-1']);
 assert.deepEqual(random.draws.map(d=>[d.category,d.max]),[['necro-ko-target',2],['necro-ko-target',2]]);
});
test('Necro execution drains KO enemy using existing formula',()=>{
 const r=run([unit('P',0xd2,{currentMp:0,stats:{mp:200}})],[unit('E'),unit('K',2,{currentHp:0,currentMp:60})]);
 assert.deepEqual(action(r).effectiveTargetIds,['enemy-1']);assert.equal(r.state.combatants[0].currentMp,60);
});
test('Necro target depleted after legal planning retains existing Miss timing',()=>{
 const r=run([unit('P',0xd2,{currentMp:0,stats:{spd:100}}),unit('Second',0xd2,{currentMp:0,stats:{spd:90}})],[unit('E'),unit('KO',2,{currentHp:0,currentMp:1})]);
 const a=action(r,'Second');assert.equal(a.outcome,'miss');assert.equal(a.durationFrames,194);assert.equal(a.mpAccounting.costCharged,0);
});
test('all-enabled is an equal detached copy and reset restores exact source',()=>{
 const source=freeze(multi()),draft=create(source),r=resolve(source,draft);assert.deepEqual(r.team,source);assert.equal(r.changed,false);
 assert.notEqual(r.team[0].techs,source[0].techs);r.team[0].techs[0].name='local';r.team[0].customStats.atk=1;
 assert.deepEqual(resolve(source,create(source)).team,source);
});
test('skill keys preserve duplicate display names and refuse injected techniques',()=>{
 const source=multi();source[0].techs[1].name=source[0].techs[0].name;
 const r=resolve(source,{p:['waza-2','not-owned']});assert.deepEqual(r.team[0].techs.map(t=>t.id),['waza-2']);assert.equal(r.valid,true);
});
test('empty or unusable-only customization blocks synthetic fallback; original fallback is unchanged',()=>{
 const source=multi();assert.equal(resolve(source,{p:[]}).valid,false);
 source[0].techs.push({...unit().techs[0],id:'unused',canonicalSkillId:0xea});assert.equal(resolve(source,{p:['unused']}).valid,false);
 const empty=[{...unit(),techs:[]}];assert.equal(resolve(empty,create(empty)).valid,true);assert.deepEqual(resolve(empty,create(empty)).team,empty);
});
for(const id of [6,0xb5,0xa1,0x89])test('filter applies to action kind '+linkLegacySkill(unit('X',id).techs[0]).kind,()=>{
 const source=multi(),draft=create(source);draft.p=draft.p.filter(k=>k!=='waza-'+id);
 const r=resolve(source,draft),before=rootPlanInfo(input(source)),after=rootPlanInfo(input(r.team));
 assert.ok(after.count<before.count);assert.equal(after.minimumBudget,after.count*4);
 assert.ok([...enumeratePlayerRoundPlans(after.state)].every(p=>p.orders.every(o=>o.skillKey!=='waza-'+id)));
});
test('Motivation Down operates on effective skills, preserves forced Guard and never leaks',()=>{
 const source=multi();source[0].initialStatuses={'motivation-down':true};const before=structuredClone(source);freeze(source);
 const r=resolve(source,{p:['waza-6']});const {state}=rootPlanInfo(input(r.team));
 assert.deepEqual(state.combatants[0].motivationBlocked,['waza-6']);assert.equal(selectableSkills(state.combatants[0],state.combatants)[0].key,'motivation-guard');assert.deepEqual(source,before);
});
test('stats and techniques compose; each reset preserves the other customization',()=>{
 const source=freeze(multi()),draft=createPlayerStatDrafts(source);draft.p.atk='123';const custom=resolvePlayerStatDrafts(source,draft).team;
 assert.equal(resolve(custom,{p:['waza-6']}).team[0].customStats.atk,123);
 assert.deepEqual(resolve(custom,create(source)).team[0].techs,source[0].techs);
 const statsReset=resolvePlayerStatDrafts(source,resetPlayerStatDrafts(source,draft)).team;
 assert.equal(resolve(statsReset,{p:['waza-6']}).team[0].customStats.atk,source[0].customStats.atk);
 assert.equal(resolve(statsReset,{p:['waza-6']}).team[0].techs.length,1);
});

for(const method of ['optimized','random'])for(const accuracyMode of ['strategy','game-accurate'])for(const rngPolicy of ['natural','tas-favorable','tas-luck'])test(`${method}/${accuracyMode}/${rngPolicy} filtered strategy, trace, replay and exports`,()=>{
 const source=freeze(multi()),filtered=resolve(source,{p:['waza-6']}).team,i=input(filtered),options={seed:42,rng:createSeededBattleRng(42),simulationRules:{accuracyMode,rngPolicy},config:{beamWidth:1,maxDepth:2}};
 const result=finish(method==='optimized'?createOptimizedSearch(i,64,options):createSimulationSearch(i,64,options));
 assert.ok(result.completedSuccesses>0);
 const report=buildBattleSimulationReport(result,snapshotSimulationReportJob({input:i,requestedSimulations:64,searchMethod:method==='optimized'?'optimized-action-search':'random-monte-carlo',simulationRules:options.simulationRules}));
 assert.deepEqual(report.effectiveInput.player[0].techs.map(t=>t.id),['waza-6']);assert.deepEqual(report.playerTeam[0].skills.map(s=>s.key),['waza-6']);
 assert.ok(report.executedBattle.actions.some(a=>a.actorId.startsWith('player')&&a.skillName===source[0].techs[0].name));
 for(const a of report.executedBattle.actions.filter(a=>a.actorId.startsWith('player')))assert.equal(a.skillName,source[0].techs[0].name);
 for(const p of [...report.playerStrategy.plans,...(result.optimized?.recommendedPrefix??[]),...(result.optimized?.fastestRoute?.decisionTrace??[])])for(const o of p.orders)assert.equal(o.skillKey,'waza-6');
 if(result.optimized?.fastestRoute){const f=result.optimized.fastestRoute;const prefix=f.sourcePlayerPrefix??[...enumeratePlayerRoundPlans(rootPlanInfo(i).state)].filter(p=>JSON.parse(f.sourcePrefixKey).includes(p.key));const replay=replayPlayerPrefix(i,prefix,f.seed,{simulationRules:options.simulationRules},false,true);assert.equal(replay.result.totalFrames,f.totalFrames);assert.deepEqual(replay.decisionTrace,f.decisionTrace);}
 const md=serializers.serializeBattleSimulationReportMarkdown(report);assert.match(md,/Available techniques/);assert.ok(md.includes(source[0].techs[0].name));
 const playerMarkdown=md.split('## Player Team')[1].split('## Enemy Team')[0];
 for(const t of source[0].techs.slice(1))assert.ok(!playerMarkdown.includes(t.name),t.name);
 assert.deepEqual(JSON.parse(serializers.serializeBattleSimulationReportJson(report)).effectiveInput.player[0].techs.map(t=>t.id),['waza-6']);assert.equal(report.reportVersion,1);
 assert.equal(source[0].techs.length,5);
});

test('Planner UI composes, validates, resets, freezes and preserves historical run/preset',()=>{
 const h=setup(false);h.preset.playerTeam[0].techs.push(unit('X',2).techs[0]);const before=structuredClone([h.run,h.preset]);
 const name=h.preset.playerTeam[0].techs[1].name;h.edit(0,'atk',999);toggle(h,name,false);h.start();
 assert.equal(h.requests[0].input.player[0].techs.length,1);assert.equal(h.requests[0].input.player[0].customStats.atk,999);
 button(h.render(),'Reset stats to Planner values').props.onClick();h.start();assert.equal(h.requests[1].input.player[0].techs.length,1);assert.notEqual(h.requests[1].input.player[0].customStats.atk,999);
 h.edit(0,'atk',999);button(h.render(),'Reset techniques').props.onClick();h.start();assert.equal(h.requests[2].input.player[0].techs.length,2);assert.equal(h.requests[2].input.player[0].customStats.atk,999);
 toggle(h,name,false);toggle(h,h.preset.playerTeam[0].techs[0].name,false);assert.equal(button(h.render(),'Start Simulation').props.disabled,true);h.start();assert.equal(h.requests.length,3);
 button(h.render(),'Reset imported team').props.onClick();h.start();assert.deepEqual(h.requests[3].input.player,h.preset.playerTeam);
 h.search.running=true;const c=find(h.render(),p=>p.type==='checkbox');assert.equal(c.props.disabled,true);c.props.onChange({target:{checked:false}});assert.equal(find(h.render(),p=>p.type==='checkbox').props.checked,true);
 assert.deepEqual([h.run,h.preset],before);
});
test('manual UI scopes selection to team; source replacement and switching back reset drafts',()=>{
 const teams=[multi(),multi()],requests=[];const render=host('src/components/BattleSimulation.tsx','BattleSimulation',{'@/hooks/useBattleSimulationWorker':{useBattleSimulationWorker:()=>({running:false,start:r=>requests.push(structuredClone(r))})}});
 const props={savedTeams:teams,onSimulationComplete(){}},h={render:()=>render(props)},before=structuredClone(teams);
 const select=v=>find(h.render(),p=>p.onValueChange&&p.value===(v==='0'?'':'0')).props.onValueChange(v);
 select('0');toggle(h,teams[0][0].techs[1].name,false);assert.equal(find(h.render(),p=>p.type==='checkbox'&&p['aria-label'].endsWith(': '+teams[0][0].techs[1].name)).props.checked,false);
 select('1');assert.ok(nodes(h.render()).filter(n=>n.props?.type==='checkbox').every(n=>n.props.checked));
 find(h.render(),p=>p.onValueChange&&p.value==='1').props.onValueChange('0');assert.ok(nodes(h.render()).filter(n=>n.props?.type==='checkbox').every(n=>n.props.checked));
 toggle(h,teams[0][0].techs[1].name,false);props.savedTeams=[structuredClone(teams[0]),teams[1]];assert.ok(nodes(h.render()).filter(n=>n.props?.type==='checkbox').every(n=>n.props.checked));assert.deepEqual(teams,before);
});

test('real Planner history supplies pre-learning techniques; fresh analyses/manual remounts cannot leak',()=>{
 const f=require('./helpers/backupFixture.cjs');let r=f.createRunPlan('gold-hawk','historical');r=f.train(r,r.starterInstanceId,11);r=f.recordRunDigivolution(r,r.starterInstanceId).run;r=f.train(r,r.starterInstanceId,13);r=f.record(r);
 const build=load('src/utils/runPlanner/runBattleAnalysis.ts').buildPlannerBattleAnalysisPreset;
 const old=build(r,r.history[0].id),recent=build(r,r.history.at(-1).id),before=structuredClone(r);
 assert.equal(old.playerTeam[0].techs.length,1);assert.equal(recent.playerTeam[0].techs.length,2);
 const renderPreset=preset=>{const requests=[],render=host('src/components/BattleSimulation.tsx','BattleSimulation',{'@/hooks/useBattleSimulationWorker':{useBattleSimulationWorker:()=>({running:false,start:r=>requests.push(structuredClone(r))})}});const props={preset,savedTeams:[],onSimulationComplete(){}};return {render:()=>render(props),requests};};
 const h=renderPreset(recent);toggle(h,recent.playerTeam[0].techs[1].name,false);button(h.render(),'Start Simulation').props.onClick();assert.equal(h.requests[0].input.player[0].techs.length,1);
 const fresh=renderPreset(recent);assert.ok(nodes(fresh.render()).filter(n=>n.props?.type==='checkbox').every(n=>n.props.checked));
 const historical=renderPreset(old);assert.equal(nodes(historical.render()).filter(n=>n.props?.type==='checkbox').length,1);
 const manual=host('src/components/BattleSimulation.tsx','BattleSimulation')({savedTeams:[recent.playerTeam],onSimulationComplete(){}});assert.equal(nodes(manual).filter(n=>n.props?.type==='checkbox').length,0);
 assert.deepEqual(r,before);
});

for(const objective of ['fastest-potential','average-victory','success-rate'])for(const thoroughness of ['standard','thorough','maximum'])test(`filtered input reaches ${objective}/${thoroughness} search passes`,()=>{
 const source=multi(),i=input(resolve(source,{p:['waza-6']}).team);
 const r=finish(createOptimizedSearch(i,128,{seed:42,objective,searchThoroughness:thoroughness,simulationRules:{accuracyMode:'strategy'},config:{beamWidth:1,maxDepth:2}}));
 assert.ok(r.completedSuccesses>0);assert.equal(r.optimized.rootPlanCount,1);
 for(const p of r.optimized.recommendedPrefix)for(const o of p.orders)assert.equal(o.skillKey,'waza-6');
});

test('manual UI dispatches filtered team and root count immediately matches its input',()=>{
 const team=multi(),before=structuredClone(team),requests=[];
 const render=host('src/components/BattleSimulation.tsx','BattleSimulation',{'@/hooks/useBattleSimulationWorker':{useBattleSimulationWorker:()=>({running:false,start:r=>requests.push(structuredClone(r))})}}),props={savedTeams:[team,[unit('E',6,{currentHp:1})]],onSimulationComplete(){}},h={render:()=>render(props)};
 const selectWith=(tree,match)=>find(tree,(p,n)=>typeof p.onValueChange==='function'&&p.value!== 'saved'&&nodes(p.children).some(match));
 selectWith(h.render(),n=>n.props?.id==='player-team').props.onValueChange('0');
 find(h.render(),p=>p.value==='encounter'&&p.onValueChange).props.onValueChange('saved');
 selectWith(h.render(),n=>n.props?.placeholder==='Choose enemy team').props.onValueChange('1');
 for(const t of team[0].techs.slice(1))toggle(h,t.name,false);
 button(h.render(),'Start Simulation').props.onClick();assert.equal(requests.length,1);assert.deepEqual(requests[0].input.player[0].techs.map(t=>t.id),['waza-6']);
 const count=rootPlanInfo(requests[0].input).count;assert.ok(nodes(h.render()).some(n=>Array.isArray(n.props?.children)&&n.props.children[0]==='First-round Player plans: '&&n.props.children[1]===String(count)));
 assert.deepEqual(team,before);assert.notEqual(requests[0].input.player[0].techs,team[0].techs);
});
