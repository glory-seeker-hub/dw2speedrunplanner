const {test}=require('node:test'),assert=require('node:assert/strict');
const {unit,rng,run,action,data,load}=require('./helpers/battleSupportFixtures.cjs');
const growth=load('src/utils/statGrowth.ts');
const species=load('src/utils/digimonLookup.ts').getDigimonByName('Kunemon');
const {getGrowthProfile}=load('src/data/growthProfiles.ts');
const {resolveBattle}=load('src/utils/runProgression.ts');
const {tryCreateCapturedDigimon}=load('src/utils/capture.ts');
const {getRequiredTotalXpForLevel}=load('src/utils/experience.ts');
const encounters=load('src/data/encounters.ts').encounters;
const encounter=encounters.find(e=>e.digimons.some(d=>d.name==='Kunemon'));
const slot=encounter.digimons.find(d=>d.name==='Kunemon').slot;
function member(id,spd){const r=tryCreateCapturedDigimon(encounter.id,slot,undefined,()=>id);assert.ok(r.ok);return {...r.digimon,level:8,totalXp:getRequiredTotalXpForLevel(9)-1,stats:{...r.digimon.stats,hp:98.5,def:67,spd}};}
function resolve(roster,ids=roster.map(m=>m.instanceId)){return resolveBattle({roster,digilineInstanceIds:ids,encounterId:154,totalBits:0});}
for(const spd of [20,20.25,20.5,20.75,21,50.25,50.75,51,100.75,101])test('fractional SPD bracket '+spd,()=>{
 const actual=growth.estimateStatGrowth(species.id,'spd',8,spd),integer=growth.estimateStatGrowth(species.id,'spd',8,Math.floor(spd));assert.equal(actual.available,true);assert.deepEqual(actual,integer);
 const applied=growth.applyExpectedLevelUpGrowth(species.id,8,{hp:98.5,mp:90,atk:60,def:67,spd});assert.equal(applied.stats.spd,spd+actual.expected);assert.equal(applied.stats.hp,98.5+applied.growth.hp.expected);
});
for(const reverseRoster of [false,true])for(const reverseParty of [false,true])test(`two independent Kunemon EL8 -> EL9 ${reverseRoster}/${reverseParty}`,()=>{
 const a=member('kunemon-a',20),b=member('kunemon-b',20.75),roster=reverseRoster?[b,a]:[a,b],before=JSON.stringify(roster),profile=JSON.stringify(getGrowthProfile(species.id));
 const r=resolve(roster,reverseParty?['kunemon-b','kunemon-a']:['kunemon-a','kunemon-b']);assert.equal(JSON.stringify(roster),before);
 for(const o of r.outcomes){assert.equal(o.previousLevel,8);assert.equal(o.newLevel,9);assert.deepEqual(o.statsWithoutGrowthData,[]);assert.equal(o.growth.spd.expected,3.25);assert.equal(o.newStats.spd-o.previousStats.spd,3.25);}
 assert.notEqual(r.roster[0].stats.spd,r.roster[1].stats.spd);assert.deepEqual(resolve(JSON.parse(before)).roster,r.roster);
 const sibling=structuredClone(roster);r.roster[0].stats.spd=999;assert.equal(JSON.stringify(sibling),before);assert.notEqual(r.roster[1].stats.spd,999);assert.equal(JSON.stringify(getGrowthProfile(species.id)),profile);
});
test('missing source remains diagnostic; zero-valued growth is valid',()=>{
 assert.equal(growth.estimateStatGrowth('missing','spd',8,20).available,false);
 for(const spd of [undefined,NaN,Infinity,0])assert.equal(growth.estimateStatGrowth(species.id,'spd',8,spd).available,false);
 assert.match(growth.estimateStatGrowth(species.id,'spd',8,0).reason,/EL 8 -> 9.*spd/);
 assert.equal(growth.rollsExpected([0,0,0,0]),0);assert.equal(growth.rollsExpected([0,1,1,1]),0.75);
});
test('HP MP ATK DEF expected arithmetic and historical import stay shared',()=>{
 const a=member('a',20.75),r=resolve([a]),out=r.outcomes[0];for(const s of ['hp','mp','atk','def'])assert.equal(out.newStats[s],a.stats[s]+growth.estimateStatGrowth(species.id,s,8).expected);
 const mapped=load('src/utils/runPlanner/runBattleAnalysis.ts').plannerDigimonToBattleTeamMember(r.roster[0]);assert.equal(mapped.customStats.spd,24);assert.equal(r.roster[0].stats.spd,24);
 assert.equal(load('src/utils/runPlannerStorage.ts').RUN_PLANNER_SCHEMA_VERSION,7);
});
test('recorded dual-Kunemon route replays progression and preserves sibling run',()=>{
 const {route,record,safe,buildPlannerBattleAnalysisPreset:build}=require('./helpers/plannerAnalysisFixtures.cjs');
 let r=route(0);const sibling=structuredClone(r),siblingText=JSON.stringify(sibling);
 const capture={domainId:'web-domain',phase:'before-blood-knights',floor:4,encounterId:66,capturedEnemySlot:2};
 r=record(r,capture);r=record(r,capture);const ids=r.roster.filter(m=>m.speciesId===species.id).map(m=>m.instanceId);assert.equal(ids.length,2);assert.notEqual(ids[0],ids[1]);r={...r,digiline:ids};
 let transition;for(let i=0;i<200&&r.roster.find(m=>m.instanceId===ids[0]).level<9;i++){
   const before=r.roster.find(m=>m.instanceId===ids[0]).level;r=record(r,safe);if(before===8&&r.roster.find(m=>m.instanceId===ids[0]).level===9)transition=r.history.at(-1);
 }
 assert.ok(transition,'EL8 -> EL9 must occur');r=record(r,safe);const restored=JSON.parse(JSON.stringify(r)),preset=build(restored,r.history.at(-1).id);
 const previous=transition.preActionCheckpoint.roster.filter(m=>ids.includes(m.instanceId));const next=preset.playerTeam;
 for(let i=0;i<2;i++){assert.equal(next[i].level,9);assert.equal(next[i].customStats.spd,Math.floor(previous.find(m=>m.instanceId===ids[i]).stats.spd+2.5));}
 assert.deepEqual(build(r,r.history.at(-1).id),preset);assert.equal(JSON.stringify(sibling),siblingText);assert.equal(load('src/utils/runInvariants.ts').validateRunPlan(restored).length,0);
});
test('Concert source is already Motivation; raw flags remain lossless',()=>{
 const s=data.getBattleSkillById(0x49);assert.equal(s.name,'Concert Crush');assert.equal(s.actionKind,'attack');assert.equal(s.targetGroup,'one-enemy');assert.equal(s.provenance.bytes[25],16);
 assert.ok(s.effects.some(e=>e.byte===26&&e.mask===16&&e.status==='motivation-down'));assert.ok(!s.effects.some(e=>e.status==='confusion'));
 assert.deepEqual(load('src/utils/battleSkillDecoder.ts').exportWazaBytes(s),s.provenance.bytes);
});
function concert(options={}){const p=unit('P',2,{stats:{spd:41}});p.techs=[2,0x3d,0x49].map(id=>unit('X',id).techs[0]);return run([p],[unit('E',0x49,{stats:{spd:40}})],options);}
for(const accuracyMode of ['strategy','game-accurate'])for(const rngPolicy of ['natural','tas-favorable'])test(`Concert guaranteed Hit ${accuracyMode}/${rngPolicy}`,()=>{
 const random=rng(),r=concert({rng:random,simulationRules:{accuracyMode,rngPolicy}}),e=action(r,'E'),p=r.state.combatants[0];
 assert.equal(e.outcome,'hit');assert.equal(p.statuses['motivation-down'],true);assert.equal(p.statuses.confusion,undefined);
 const s=e.impacts[0].statusApplications;assert.equal(s.length,1);assert.equal(s[0].status,'motivation-down');assert.equal(s[0].roll,null);assert.equal(s[0].successesOutOf3,null);assert.equal(s[0].applied,true);
 assert.ok(!random.draws.some(d=>/status-apply|confusion/.test(d.category)));
 const byCost=[...p.skills].sort((a,b)=>data.getBattleSkillById(b.canonicalSkillId).mpCost-data.getBattleSkillById(a.canonicalSkillId).mpCost);assert.deepEqual(new Set(p.motivationBlocked),new Set(byCost.slice(0,2).map(s=>s.key)));
 const legal=load('src/utils/battle/battleActionPlans.ts').enumerateLegalPlayerOrders(r.state,p);assert.ok(legal.every(o=>!p.motivationBlocked.includes(o.skillKey)));
});
for(const isBoss of [false,true])for(const name of ['Enemy','Coliseum opponent'])test(`Concert universal Enemy immunity ${name}/${isBoss}`,()=>{
 const r=run([unit('P',0x49)],[unit(name,2,{isBoss})]),s=action(r).impacts[0].statusApplications[0];assert.equal(s.applied,false);assert.equal(s.immunityReason,'enemy');assert.equal(r.state.combatants[1].statuses['motivation-down'],undefined);
});
for(const cause of ['accuracy','paralysis'])test('Concert Miss has no application '+cause,()=>{
 const r=run([unit('P')],[unit('E',0x49,{stats:{spd:100},initialStatuses:cause==='paralysis'?{paralysis:true}:{}})],{rng:rng(cause==='accuracy'?{accuracy:[127]}:{'paralysis-failure':[1]})});assert.equal(action(r,'E').outcome,'miss');assert.equal(r.state.combatants[0].statuses['motivation-down'],undefined);
});
test('genuine Confusion descriptor and natural RNG stay unchanged',()=>{
 const skill=data.BATTLE_SKILLS.find(s=>s.actionKind==='attack'&&s.effects.some(e=>e.status==='confusion'&&e.condition==='always'));
 const random=rng(),r=run([unit('P')],[unit('E',skill.id)],{rng:random});assert.ok(action(r,'E').impacts.some(i=>i.statusApplications.some(s=>s.status==='confusion')));assert.ok(random.draws.some(d=>d.category==='status-apply-confusion'));
});
const {createBattleState}=load('src/utils/battle/battleInput.ts');
const {effectiveParameter}=load('src/utils/battle/battleState.ts');
const {clearRoundEffects}=load('src/utils/battle/battleEffectCompletion.ts');
const {planAction}=load('src/utils/battle/battleActions.ts');
const {calculateActionDamage}=load('src/utils/battle/battleDamage.ts');
for(const stage of [-2,-1,0,1,2])for(const suppressed of [false,true])test(`half DEF exact odd arithmetic, stages and suppression ${stage}/${suppressed}`,()=>{
 const s=createBattleState({player:[unit('P',0x3d,{stats:{def:67}})],enemy:[unit('E')],floorSpecialty:'None'}),p=s.combatants[0],e=s.combatants[1];p.defStage=stage;p.parametersSuppressed=suppressed;
 const normal=effectiveParameter(p,'def'),attack=planAction(s,e,{kind:'skill',skillKey:e.skills[0].key});p.halfDefense=true;assert.equal(effectiveParameter(p,'def'),normal/2);
 const actual=calculateActionDamage(e,p,attack,'None',s);const equivalent=structuredClone(p);delete equivalent.halfDefense;equivalent.defStage=0;equivalent.parameterModifiers={};equivalent.baseStats.def=normal/2;assert.equal(calculateActionDamage(e,equivalent,attack,'None',s),actual);
 p.halfDefense=true;assert.equal(effectiveParameter(p,'def'),normal/2);clearRoundEffects(s);assert.equal(p.defStage,stage);assert.equal(p.baseStats.def,67);assert.equal(p.halfDefense,undefined);
});
for(const id of [0x15,0x3d])test('incoming before/use/after/next-round production damage '+id,()=>{
 const r=run([unit('P',id,{stats:{spd:40,def:67}})],[unit('Before',2,{stats:{spd:100}}),unit('After',2,{stats:{spd:1}})],{maxRounds:2,simulationRules:{accuracyMode:'strategy'}});
 const before=r.actions.filter(a=>a.actorName==='Before'),after=r.actions.filter(a=>a.actorName==='After');assert.equal(before.length,2);assert.equal(before[0].impacts[0].damage,before[1].impacts[0].damage);assert.ok(after[0].impacts[0].damage>before[0].impacts[0].damage);
 const s=createBattleState({player:[unit('P',id,{stats:{def:67}})],enemy:[unit('E')],floorSpecialty:'None'}),p=s.combatants[0],e=s.combatants[1],a=planAction(s,e,{kind:'skill',skillKey:e.skills[0].key});assert.equal(before[0].impacts[0].damage,calculateActionDamage(e,p,a,'None',s));p.halfDefense=true;assert.equal(after[0].impacts[0].damage,calculateActionDamage(e,p,a,'None',s));assert.equal(effectiveParameter(p,'def'),33.5);
 assert.ok(action(r).effectAudit.some(x=>x.includes('half DEF')));assert.ok(!r.actions.some(a=>a.effectAudit?.some(x=>x.includes('DEF = 1'))));
});
test('Results renders Motivation Down and deterministic audit instead of Confusion/null roll',()=>{
 const {renderToStaticMarkup}=require('react-dom/server'),React=require('react');const {BattleResults}=load('src/components/BattleResults.tsx');const {aggregateBattleRuns}=load('src/utils/battleEngine.ts');const r=concert();const result={...aggregateBattleRuns([]),totalSimulations:1,fastestBattleHistory:r.actions,fastestBattleByFrames:r.actions};
 const html=renderToStaticMarkup(React.createElement(BattleResults,{results:result}));assert.match(html,/Motivation Down.*applied/);assert.match(html,/guaranteed on Hit/);assert.doesNotMatch(html,/Confusion applied|roll null/);
});
for(const id of [0x49,0x15,0x3d])test('report v1 and Markdown/JSON consume corrected retained history '+id,()=>{
 const {fixture,buildBattleSimulationReport}=require('./helpers/simulationReportFixtures.cjs');const h=fixture(),battle=id===0x49?concert():run([unit('P',id)],[unit('E')]);h.result.optimized.fastestRoute.actions=battle.actions;
 const report=buildBattleSimulationReport(h.result,h.job),{serializeBattleSimulationReportMarkdown:md,serializeBattleSimulationReportJson:json}=load('src/utils/battle/battleSimulationReportSerialization.ts');assert.equal(report.reportVersion,1);assert.deepEqual(JSON.parse(json(report)),report);
 if(id===0x49){assert.match(md(report),/motivation-down/);assert.ok(report.executedBattle.actions.flatMap(a=>a.impacts).flatMap(i=>i.statusApplications).every(s=>s.status!=='confusion'));}else{assert.match(md(report),/half DEF/);assert.doesNotMatch(md(report),/DEF = 1/);}
});
