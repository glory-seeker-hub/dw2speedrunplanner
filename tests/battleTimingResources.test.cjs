const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('./helpers/loadTs.cjs');
const { cases, member, tech } = require('./helpers/battleFixtures.cjs');
const { simulateBattleCore: simulate, runBattleSimulation, aggregateBattleRuns } = load('src/utils/battleEngine.ts');
const { resolveActionTiming: timing, classifySkillTiming, summarizeBattleTiming } = load('src/utils/battle/battleTiming.ts');
const { shadowScytheCanRepeat, scheduleShadowScytheRepeat } = load('src/utils/battle/battleChains.ts');
const { depletionAlert } = load('src/utils/battle/battleResources.ts');
const { createSequenceBattleRng: sequence, createSeededBattleRng: seeded } = load('src/utils/battle/battleRng.ts');
const { createBattleState, linkLegacySkill } = load('src/utils/battle/battleInput.ts');
const { legacyActionPolicy, planAction } = load('src/utils/battle/battleActions.ts');
const { getBattleSkillById, BATTLE_SKILLS } = load('src/data/battleSkills.ts');
const { resolveEffectiveTargets } = load('src/utils/battle/battleTargets.ts');
const input = (player, enemy) => ({ player, enemy, floorSpecialty: 'None' });
const run = (p, e, options={}) => simulate(input(p,e), {rng: sequence(Array(10000).fill(0)), ...options});
const executed = r => r.actions.filter(a=>a.state==='resolved');
const resolve = (timingClass, effectiveTargetCount, outcome='hit', actionKind='attack') => timing({timingClass,effectiveTargetCount,outcome,actionKind});
const foes = (count, hp=1) => Array.from({length:count},()=>member('Duplicate',[tech('Rock Fist')],{hp}));
const shadow = (count=3, changes={}) => run([member('P',[tech('Shadow Scythe',changes)],{spd:100})],foes(count));

for(const [kind,count,frames] of [['single-target',1,685],['aoe',1,703],['aoe',2,873],['aoe',3,990],['field-all',2,758],['field-all',3,838],['field-all',4,915],['field-all',5,995],['field-all',6,1071]]) test(`measured ${kind} hit against ${count}: ${frames}f`,()=>assert.deepEqual(resolve(kind,count),{durationFrames:frames,diagnostics:[]}));
for(const kind of ['single-target','aoe','field-all','unknown']) for(const count of [0,1,3,7]) test(`explicit full ${kind} Miss against ${count} costs 194 once`,()=>assert.deepEqual(resolve(kind,count,'miss'),{durationFrames:194,diagnostics:[]}));
for(const outcome of ['cancelled','skipped','unsupported','invalid']) test(`${outcome} is not a 194f Miss`,()=>{const r=resolve('single-target',1,outcome);assert.equal(r.durationFrames,null);assert.ok(r.diagnostics.length);});
for(const [kind,count] of [['unknown',1],['aoe',4],['field-all',1],['field-all',7],['single-target',2],['single-target',0],['aoe',1.5],['aoe',NaN],['aoe',Infinity]]) test(`no interpolation: ${kind} / ${count}`,()=>{const r=resolve(kind,count);assert.equal(r.durationFrames,null);assert.ok(r.diagnostics.length);});
for(const kind of ['interrupt']) test(`no guessed ${kind} successful duration`,()=>assert.equal(resolve('single-target',1,'hit',kind).durationFrames,null));
test('Guard has no timing even for an untyped purported Miss',()=>assert.equal(resolve('single-target',1,'miss','guard').durationFrames,null));
for(const count of [1,2,3]) test(`AOE ${count} impacts charge exactly one action duration`,()=>{
 const r=run([member('P',[tech('Triple Forces')],{spd:100})],foes(count));const a=executed(r)[0];
 assert.equal(r.actionCount,1);assert.equal(a.impacts.length,count);assert.equal(a.durationFrames,[703,873,990][count-1]);assert.equal(r.totalFrames,a.durationFrames);
 assert.ok(a.impacts.every(i=>!('durationFrames' in i)));assert.equal(r.timingCompleteness,'complete');
});
test('Single and AOE with one impact have distinct measured classes',()=>{
 const a=run([member('P',[tech('Rock Fist')],{spd:100})],foes(1));const b=run([member('P',[tech('Triple Forces')],{spd:100})],foes(1));
 assert.equal(a.totalFrames,685);assert.equal(b.totalFrames,703);
});
test('enemy KO before AOE excludes its stale planned target and pending execution',()=>{
 const r=run([member('P1',[tech('Rock Fist')],{spd:100}),member('P2',[tech('Triple Forces')],{spd:70})],foes(3));
 const actions=executed(r);assert.equal(actions.length,2);assert.equal(actions[1].impacts.length,2);assert.equal(actions[1].durationFrames,873);
 assert.ok(!actions[1].effectiveTargetIds.includes(actions[0].impacts[0].targetId));assert.equal(r.totalFrames,1558);
 assert.ok(r.actions.filter(a=>a.actorId.startsWith('enemy')).every(a=>a.state==='skipped'));assert.deepEqual(r.state.queue,[]);
});
test('AOE four targets remains incomplete with no fabricated total',()=>{
 const r=run([member('P',[tech('Triple Forces')],{spd:100})],foes(4));assert.equal(r.outcome,'player-win');assert.equal(r.totalFrames,null);assert.equal(r.knownFrames,0);assert.equal(r.timingCompleteness,'incomplete');assert.ok(r.timingDiagnostics.length);
});
test('ordinary AOE never maps to field-all from battlefield population',()=>{
 const r=run([member('P',[tech('Triple Forces')],{spd:100}),member('P2',[tech('Rock Fist')])],foes(3));assert.equal(executed(r)[0].timingClass,'aoe');assert.equal(executed(r)[0].durationFrames,990);
});
test('canonical Assist field skills use measured field class; other fields remain unresolved',()=>{
 const field=BATTLE_SKILLS.filter(s=>s.targetGroup==='field');assert.ok(field.length);
 for(const skill of field)assert.equal(classifySkillTiming(linkLegacySkill({...tech('Rock Fist'),canonicalSkillId:skill.id,target:'All'})),skill.id===0xd2||skill.targetModes.includes('random-digimon')?'single-target':skill.actionKind==='assist'&&skill.targetModes.every(m=>m==='normal')?'field-all':'unknown');
});
test('mismatched canonical target data does not acquire a measured class',()=>assert.equal(classifySkillTiming(linkLegacySkill(tech('Triple Forces',{target:'Single'}))),'unknown'));
test('custom targeting allies does not claim measured opposing Attack timing',()=>{
 const r=run([member('P',[tech('Rock Fist')],{spd:100})],foes(1),{maxRounds:1,actionPolicy:{chooseAction:a=>({kind:'skill',skillKey:a.skills[0].key,targetIntent:{kind:'combatants',targetIds:[a.id]}})}});
 assert.equal(executed(r)[0].timingClass,'unknown');assert.equal(executed(r)[0].durationFrames,null);
});
test('total equals measured executed actions; cancelled and skipped contribute no charge',()=>{
 const r=run(...cases.koSkip);assert.equal(r.totalFrames,executed(r).reduce((sum,a)=>sum+a.durationFrames,0));assert.ok(r.actions.some(a=>a.state==='skipped'));
 assert.ok(r.actions.filter(a=>a.state==='skipped').every(a=>a.durationFrames===null));
});
test('Counter Single hits use measured timing',()=>{
 const r=run(...cases.counter);assert.equal(r.timingCompleteness,'complete');assert.equal(r.totalFrames,r.knownFrames);
 assert.ok(executed(r).filter(a=>a.kind==='counter').every(a=>a.durationFrames===685 && !a.timingDiagnostics.length));
});
test('one impact Miss never infers a full action Miss',()=>{
 const a=structuredClone(executed(run(...cases.aoe))[0]);a.impacts[0].outcome='miss';assert.equal(a.outcome,'hit');
 assert.equal(resolve(a.timingClass,a.effectiveTargetIds.length,a.outcome).durationFrames,990);
});

function resourceRun(options={}) {
 return run([member('P',[tech('Rock Fist')],{hp:1,mp:1,spd:10,atk:1})],[member('E',[tech('Rock Fist')],{hp:1000,mp:1,spd:100})],{maxRounds:3,...options});
}
test('player depletion does not stop selection, targeting, actions or create enemy victory',()=>{
 const r=resourceRun();const p=r.state.combatants[0];assert.equal(p.currentHp,0);assert.equal(p.isAlive,true);assert.equal(r.outcome,'limit-reached');assert.equal(r.winner,null);
 assert.equal(executed(r).filter(a=>a.actorId===p.id).length,3);assert.equal(r.state.plannedActions.filter(a=>a.actorId===p.id).length,3);
 const enemy=executed(r).filter(a=>a.actorId==='enemy-0');assert.equal(enemy.length,3);assert.ok(enemy.every(a=>a.effectiveTargetIds.includes(p.id)));
 assert.deepEqual(enemy.map(a=>a.impacts[0].hpBefore),[1,0,0]);assert.ok(enemy.every(a=>!a.impacts[0].ko));
});
test('HP transition alert is on the causing action with stable ID; no repeats at zero',()=>{
 const r=resourceRun();const alerts=r.actions.flatMap(a=>a.resourceAlerts).filter(a=>a.kind==='player-hp-depleted');
 assert.deepEqual(alerts,[{kind:'player-hp-depleted',combatantId:'player-0',combatantName:'P'}]);assert.equal(executed(r)[0].resourceAlerts[0].kind,'player-hp-depleted');
});
test('player initialized at zero HP remains active and receives no invented transition',()=>{
 const r=run([member('P',[tech('Rock Fist')],{hp:0,spd:100})],foes(1));assert.equal(r.outcome,'player-win');assert.equal(r.state.combatants[0].isAlive,true);assert.ok(!r.actions.flatMap(a=>a.resourceAlerts).some(a=>a.kind==='player-hp-depleted'));
});
test('after actual legacy drain restores HP a new depletion transition can alert',()=>{
 const r=run([member('P',[tech('Twig Tap')],{hp:1,spd:10})],[member('E',[tech('Rock Fist')],{hp:1000,spd:100})],{maxRounds:3});
 assert.equal(r.actions.flatMap(a=>a.resourceAlerts).filter(a=>a.kind==='player-hp-depleted').length,3);
 assert.ok(executed(r).filter(a=>a.actorId==='player-0').every(a=>a.impacts.some(i=>i.appliedEffects.some(e=>e.kind==='drain'))));
});
test('all enemies KO completes success despite depleted player resources',()=>{
 const r=run([member('P',[tech('Rock Fist')],{hp:1,mp:1,spd:10})],[member('E',[tech('Rock Fist')],{hp:1,spd:100})]);
 assert.equal(r.outcome,'player-win');assert.equal(r.state.combatants[0].currentHp,0);assert.equal(r.state.combatants[1].isAlive,false);assert.equal(r.totalFrames,1370);
});
for(const side of ['player','enemy']) test(`${side} MP cost is canonical and insufficient/zero MP never gates execution`,()=>{
 const r=resourceRun();const actions=executed(r).filter(a=>a.actorId===`${side}-0`);assert.equal(actions.length,3);
 assert.ok(actions.every(a=>a.mpAccounting.costCharged===getBattleSkillById(a.canonicalSkillId).mpCost));
 assert.deepEqual(actions.map(a=>a.mpAccounting.before),[1,0,0]);assert.ok(actions.every(a=>a.mpAccounting.after===0));
});
test('MP positive-to-zero transition alerts once for player, never for enemy',()=>{
 const r=resourceRun();const alerts=r.actions.flatMap(a=>a.resourceAlerts).filter(a=>a.kind==='player-mp-depleted');
 assert.deepEqual(alerts,[{kind:'player-mp-depleted',combatantId:'player-0',combatantName:'P'}]);
});
test('normal sufficient MP subtracts exact WAZADATA cost, not a caller-supplied cost',()=>{
 const r=run([member('P',[tech('Rock Fist',{mpCost:999})],{mp:50,spd:100})],foes(1));const a=executed(r)[0];
 const cost=getBattleSkillById(a.canonicalSkillId).mpCost;assert.deepEqual(a.mpAccounting,{before:50,costCharged:cost,after:50-cost,completeness:'complete',payerCombatantId:'player-0',payerName:'P',payerSide:'player',paymentRule:'own'});
});
test('activated 0x89 charges the causal actor',()=>{
 const skill=tech('Pummel Whack');assert.ok(skill.id);
 const r=run([member('P',[skill],{mp:50})],[member('E',[tech('Rock Fist')],{hp:1000})],{maxRounds:1});
 const a=executed(r).find(a=>a.canonicalSkillId===0x89);assert.ok(a);assert.deepEqual(a.mpAccounting,{before:42,costCharged:20,after:22,completeness:'complete',payerCombatantId:'enemy-0',payerName:'E',payerSide:'enemy',paymentRule:'counter-triggering-actor'});
 assert.deepEqual(a.resourceDiagnostics,[]); assert.equal(r.state.combatants[0].currentMp,50);
 assert.deepEqual(BATTLE_SKILLS.filter(s=>s.effects.some(e=>e.kind==='counter-payment')).map(s=>s.id),[0x89]);
});
test('unknown custom/synthetic MP has explicit limitation instead of an invented cost',()=>{
 for(const skills of [[],[{...tech('Rock Fist'),id:'custom',name:'Custom'}]]){
  const r=run([member('P',skills,{spd:100})],foes(1));const a=executed(r)[0];assert.equal(a.mpAccounting.costCharged,null);assert.equal(a.mpAccounting.before,a.mpAccounting.after);assert.ok(a.resourceDiagnostics.length);assert.equal(a.durationFrames,null);
 }
});
test('resource accounting and alerts do not mutate input teams',()=>{const p=cases.aoe[0],e=cases.aoe[1],before=structuredClone({p,e});run(p,e);assert.deepEqual({p,e},before);});
test('alerts preserve deterministic MP-before-impact ordering even with explicit player target intent',()=>{
 const p=[member('P',[tech('Triple Forces')],{mp:1,spd:100}),member('Ally',[tech('Rock Fist')],{hp:1})];
 const r=run(p,foes(1),{maxRounds:1,actionPolicy:{chooseAction:a=>({kind:'skill',skillKey:a.skills[0].key,...(a.id==='player-0'?{targetIntent:{kind:'combatants',targetIds:['player-1','enemy-0']}}:{})})}});
 assert.deepEqual(executed(r)[0].resourceAlerts.map(a=>a.kind),['player-mp-depleted','player-hp-depleted']);
});
test('depletion metadata is ignored by timing totals and adds no action',()=>{
 const r=resourceRun();const actions=structuredClone(r.actions);actions.forEach(a=>a.resourceAlerts=[]);
 assert.deepEqual(summarizeBattleTiming(actions),summarizeBattleTiming(r.actions));assert.equal(r.actionCount,6);
});
test('Guard runtime request is rejected before ID allocation, RNG initiative, costs or timing',()=>{
 const rng=sequence([]);const r=run(...cases.single,{rng,actionPolicy:{chooseAction:()=>({kind:'guard'})}});
 assert.equal(r.outcome,'unsupported');assert.equal(r.actionCount,0);assert.deepEqual(r.actions,[]);assert.deepEqual(r.state.plannedActions,[]);assert.equal(r.totalFrames,0);assert.equal(rng.consumed,0);
 assert.ok(r.state.combatants.every(a=>a.currentHp===a.maxHp&&a.currentMp===a.maxMp&&Object.keys(a.parameterModifiers).length===0));
});
test('production candidates and random policy contain no Guard',()=>{
 const state=createBattleState(input(...cases.single));const rng=seeded(42);
 for(const actor of state.combatants)for(let i=0;i<100;i++)assert.equal(legacyActionPolicy.chooseAction(actor,{round:1,combatants:state.combatants},rng).kind,'skill');
 assert.ok(state.combatants.flatMap(a=>a.skills).every(s=>s.kind!=='guard'));
});

for(const count of [1,2,3]) test(`Shadow Scythe ${count} KO executions have distinct IDs, frames and one MP cost`,()=>{
 const r=shadow(count);const actions=executed(r);assert.equal(actions.length,count);assert.equal(r.actionCount,count);assert.equal(r.totalFrames,685*count);
 assert.equal(new Set(actions.map(a=>a.id)).size,count);assert.ok(actions.every(a=>a.round===1&&a.kind==='attack'&&a.durationFrames===685&&a.impacts.length===1));
 assert.deepEqual(actions.map(a=>a.mpAccounting.costCharged),[20,...Array(count-1).fill(0)]);
 assert.deepEqual(actions.map(a=>a.chainFromActionId),[null,...actions.slice(0,-1).map(a=>a.id)]);
 assert.ok(actions.every(a=>a.reaction===null));assert.equal(new Set(actions.flatMap(a=>a.effectiveTargetIds)).size,count);assert.deepEqual(r.state.queue,[]);
});
test('renamed reviewed legacy identity still chains without display-name lookup',()=>assert.equal(executed(shadow(3,{name:'Renamed'})).length,3));
test('explicit numeric 0x4D with custom key/name chains',()=>assert.equal(executed(shadow(3,{id:'explicit',name:'Unrelated display',canonicalSkillId:0x4d})).length,3));
test('borrowed display name without reviewed numeric identity gains no canonical chain',()=>{
 const skill=tech('Shadow Scythe',{id:'custom-shadow'});assert.equal(linkLegacySkill(skill).canonicalSkillId,null);
 const r=run([member('P',[skill],{spd:100})],foes(3),{maxRounds:1});assert.equal(executed(r).filter(a=>a.actorId==='player-0').length,1);assert.ok(r.actions.every(a=>a.chainFromActionId===null));
});
test('different explicit ID named Shadow Scythe does not chain',()=>{
 const r=shadow(3,{canonicalSkillId:getBattleSkillById(0x4d).id-1});assert.ok(r.actions.every(a=>a.chainFromActionId===null));
});
test('no KO means no repeat; earlier KO does not force repeat after a survivor',()=>{
 const rng=sequence(Array(200).fill(0));const r=run([member('P',[tech('Shadow Scythe')],{spd:100})],[...foes(1),member('Survivor',[tech('Rock Fist')],{hp:1000}),...foes(1)],{rng,maxRounds:1});
 const attacks=executed(r).filter(a=>a.actorId==='player-0');assert.equal(attacks.length,2);assert.equal(attacks[0].impacts[0].ko,true);assert.equal(attacks[1].impacts[0].ko,false);
 assert.ok(r.state.combatants.find(a=>a.id==='enemy-2').isAlive);
});
test('first Shadow Scythe without KO has no causal repeat',()=>{
 const r=run([member('P',[tech('Shadow Scythe')],{spd:100})],foes(3,1000),{maxRounds:1});assert.equal(executed(r).filter(a=>a.actorId==='player-0').length,1);
});
test('chain RNG chooses remaining targets with no new action-choice or initiative draws',()=>{
 const rng=sequence([0,0,0,0,0,0,0,0,0.99,0,0.99,0,0,0]);const r=run([member('P',[tech('Shadow Scythe')],{spd:100})],foes(3),{rng});
 assert.equal(rng.consumed,14);assert.deepEqual(executed(r).map(a=>a.impacts[0].targetId),['enemy-2','enemy-1','enemy-0']);
 assert.deepEqual(rng.draws.map(d=>d.category),[...Array(4).fill('action-choice'),...Array(4).fill('initiative'),'target-choice','accuracy','target-choice','accuracy','target-choice','accuracy']);
 assert.throws(()=>rng.nextFloat(),/exhausted/);
});
test('Shadow Scythe complete histories are reproducible by seed',()=>assert.deepEqual(shadow(),shadow()));
test('Shadow Scythe KO target cannot create a legacy Counter reaction',()=>{
 const r=run([member('P',[tech('Shadow Scythe')],{spd:100})],[member('Counter',[tech('Beast King Fist')],{hp:1}),...foes(1)]);
 assert.ok(executed(r).every(a=>a.reaction===null));assert.equal(executed(r).length,2);
});
test('chain cause links and surviving target Counter reaction links remain independent',()=>{
 const rng=sequence(Array(500).fill(0));const r=run([member('P',[tech('Shadow Scythe')],{spd:100})],[...foes(1),member('Counter',[tech('Beast King Fist')],{hp:1000})],{rng,maxRounds:1});
 const chain=executed(r).find(a=>a.chainFromActionId);const reaction=executed(r).find(a=>a.reaction);assert.ok(chain);assert.ok(reaction);
 assert.equal(reaction.reaction.reactionToActionId,chain.id);assert.equal(reaction.reaction.triggeredByActorId,chain.actorId);assert.equal(reaction.chainFromActionId,null);assert.equal(chain.reaction,null);
 assert.equal(new Set(r.actions.map(a=>a.id)).size,r.actions.length);assert.deepEqual(r.state.queue,[]);
});
test('explicit Shadow Scythe Miss costs 194, stops chain and can sum to 879 after KO',()=>{
 const r=shadow(2);const actions=structuredClone(executed(r));const miss=actions[1];miss.outcome='miss';miss.impacts[0].ko=false;miss.impacts[0].outcome='miss';miss.impacts[0].damage=0;
 miss.durationFrames=resolve(miss.timingClass,1,miss.outcome).durationFrames;assert.equal(miss.durationFrames,194);assert.equal(shadowScytheCanRepeat(miss),false);
 assert.equal(summarizeBattleTiming(actions).totalFrames,879);
 const state=createBattleState(input([member('P',[tech('Shadow Scythe')])],foes(3)));state.round=1;
 const planned=planAction(state,state.combatants[0],{kind:'skill',skillKey:state.combatants[0].skills[0].key});
 assert.equal(scheduleShadowScytheRepeat(state,planned,miss),null);assert.deepEqual(state.queue,[]);
 // Explicit action-level Miss wins even over an inconsistent future KO impact.
 miss.impacts[0].ko=true;assert.equal(shadowScytheCanRepeat(miss),false);
});
test('custom legacy chain remains labeled custom and has no canonical MP/timing claim',()=>{
 const skill=tech('Rock Fist',{id:'custom-chain',name:'Custom chain',specialEffect:{type:'chainOnKill'}});
 const r=run([member('P',[skill],{spd:100})],foes(2));const a=executed(r)[0];assert.equal(a.source,'legacy-custom-technique');assert.equal(a.canonicalSkillId,null);assert.equal(a.impacts.length,2);assert.equal(a.durationFrames,null);assert.equal(a.mpAccounting.costCharged,null);
});

test('victory-only aggregates exclude invalid/unsupported/limit/defeat and select actual frame minimum',()=>{
 const slow=shadow(3),fast=shadow(1),middle=shadow(2),unknown=unknownVictory();
 const invalid=run([member('P',[tech('Rock Fist')],{def:0})],foes(1));
 const unsupported=run(...cases.single,{actionPolicy:{chooseAction:()=>({kind:'guard'})}});
 const limit=resourceRun();const defeat={...fast,outcome:'enemy-win',winner:'enemy',totalFrames:1};
 const batch=aggregateBattleRuns([slow,invalid,unsupported,limit,defeat,unknown,fast,middle]);
 assert.equal(batch.completedSuccesses,4);assert.equal(batch.timedSuccesses,3);assert.equal(batch.incompleteTimingSuccesses,1);
 assert.equal(batch.minFrames,685);assert.equal(batch.avgFrames,1370);assert.equal(batch.maxFrames,2055);assert.deepEqual(batch.fastestBattleByFrames,fast.actions);
 assert.equal(batch.totalSimulations,8);assert.equal(batch.winRate,50);
});
test('no complete timed victories yields null aggregates, no Infinity or invented zero',()=>{
 const batch=aggregateBattleRuns([resourceRun(),unknownVictory()]);assert.equal(batch.minFrames,null);assert.equal(batch.avgFrames,null);assert.equal(batch.maxFrames,null);assert.deepEqual(batch.fastestBattleByFrames,[]);
 const empty=aggregateBattleRuns([]);assert.equal(empty.minTurns,null);assert.equal(empty.avgTurns,null);assert.equal(empty.maxTurns,null);
});
test('public result contains frames and action histories, no obsolete seconds fields',()=>{
 const r=runBattleSimulation(...cases.single,'None',2,{rng:seeded(42)});assert.ok(r.minFrames>0);assert.ok(r.fastestBattleByFrames.length);assert.ok(!('minTime'in r));assert.ok(!('fastestBattleByTime'in r));assert.ok(!JSON.stringify(r).includes('timeSeconds'));
});
test('programmed successful simulations consume accuracy but no unrelated status RNG',()=>{
 const rng=sequence(Array(10000).fill(0));const r=run(...cases.aoe,{rng});assert.ok(executed(r).every(a=>a.outcome==='hit'));assert.ok(rng.draws.every(d=>['action-choice','initiative','target-choice','accuracy'].includes(d.category)));
 assert.ok(r.state.combatants.every(a=>Object.keys(a.statuses).length===0));
});
test('BattleResults renders frames, action-level impacts, MP traces and informational alerts',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {BattleResults}=load('src/components/BattleResults.tsx');
 const r=aggregateBattleRuns([resourceRun()]); // no victory history; use successful depleted resource fixture
 const success=run([member('P',[tech('Rock Fist')],{hp:1,mp:1,spd:10})],[member('E',[tech('Rock Fist')],{hp:1,spd:100})]);
 const html=renderToStaticMarkup(React.createElement(BattleResults,{results:aggregateBattleRuns([success])}));
 assert.match(html,/1,370 f/);assert.match(html,/685 f/);assert.match(html,/P reached 0 HP/);assert.match(html,/P reached 0 MP/);assert.match(html,/role="note"/);assert.match(html,/Guard\/item/);assert.match(html,/MP:/);assert.match(html,/Fastest Battle by Frames/);assert.doesNotMatch(html,/seconds|200 seconds|50 seconds/);
 const empty=renderToStaticMarkup(React.createElement(BattleResults,{results:r}));assert.match(empty,/Unavailable/);assert.doesNotMatch(empty,/Infinity|NaN/);
});
test('BattleResults visibly explains incomplete timing and excludes obsolete thresholds',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {BattleResults}=load('src/components/BattleResults.tsx');
 const html=renderToStaticMarkup(React.createElement(BattleResults,{results:aggregateBattleRuns([unknownVictory()])}));assert.match(html,/incomplete timing/);assert.match(html,/unknown, 1 effective targets/);
 const source=fs.readFileSync('src/components/BattleResults.tsx','utf8');assert.doesNotMatch(source,/minTime|maxTime|avgTime|timeSeconds|> 200|< 50/);
});
test('Guard has no selection option in BattleSimulation UI or Team Builder',()=>{
 for(const file of ['src/components/BattleSimulation.tsx','src/components/TeamBuilder.tsx'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/value=["']guard["']|kind: ["']guard["']/i);
});

function unknownVictory() { return run([member('Custom',[{...tech('Rock Fist'),id:'custom',name:'Custom'}],{spd:100,atk:1000})],foes(1)); }

test('authoritative Assist Single Hit uses measured 685f',()=>assert.equal(resolve('single-target',1,'hit','assist').durationFrames,685));
