const {test}=require('node:test');
const assert=require('node:assert/strict');
const {unit,rng,run,action,data,load}=require('./helpers/battleSupportFixtures.cjs');
const {createBattleState}=load('src/utils/battle/battleInput.ts');
const {calculateLegacyDamage}=load('src/utils/battle/battleDamage.ts');
const {assessBattleSkill}=load('src/utils/battle/battleSupport.ts');
const {toLegacyTech}=load('src/utils/battleSkillCompatibility.ts');
const {validateBattleSkillLabels}=load('src/utils/battleSkillValidation.ts');
const {RANDOM_ELEMENT_SKILL_IDS,isRandomElementSkillId}=load('src/utils/battleSkillSemantics.ts');
const elements=['Water','Fire','Nature','Machine','Darkness'];

test('only the two canonical Fantasmic IDs have random-element semantics',()=>{
  assert.deepEqual(RANDOM_ELEMENT_SKILL_IDS,[0xf1,0xf4]);
  assert.deepEqual(data.BATTLE_SKILLS.filter(s=>s.element===null).map(s=>s.id),[241,244]);
  for(const s of data.BATTLE_SKILLS) assert.equal(isRandomElementSkillId(s.id),[241,244].includes(s.id));
  assert.equal(isRandomElementSkillId(null),false);
  const unresolved={...data.getBattleSkillById(0xf1),id:999};
  assert.throws(()=>toLegacyTech(unresolved,'unknown','Unknown'),/unresolved/);
});

for(const [id,name] of [[0xf1,'Fantasmic Bomb'],[0xf4,'Fantasmic Ray']]) {
  test(name+' canonical identity and validation preserve raw null',()=>{
    const s=data.getBattleSkillByName(name);
    assert.equal(s.id,id); assert.equal(s.element,null);
    assert.ok(s.issues.some(i=>i.field==='byte4'));
    assert.equal(validateBattleSkillLabels([name]).complete,true);
    assert.equal(toLegacyTech(s,'test',name).element,'None'); // Compatibility placeholder only.
    const state=createBattleState({player:[unit('P',id)],enemy:[unit('E')],floorSpecialty:'None'});
    assert.notEqual(assessBattleSkill(state.combatants[0].skills[0]).level,'canonical-data-incomplete');
  });
  for(const policy of ['natural','tas-favorable']) for(const [roll,element] of elements.entries()) {
    test(`${name} ${policy} outcome ${roll}: audit, shared impacts and production damage`,()=>{
      const p=unit('P',id), enemies=[unit('E'),unit('E2')];
      for(const e of enemies)e.digimon.specialty='Fire';
      const initial=createBattleState({player:[p],enemy:enemies,floorSpecialty:'Water'});
      const random=rng({'fantasmic-element':[roll]});
      const result=run([p],enemies,{rng:random,floorSpecialty:'Water',simulationRules:{accuracyMode:'game-accurate',rngPolicy:policy}});
      const a=action(result);
      assert.equal(a.outcome,'hit');
      assert.deepEqual(random.draws.filter(d=>d.category==='fantasmic-element'),[{category:'fantasmic-element',value:roll,max:5}]);
      assert.ok(a.effectAudit.includes('Random attack element: '+element));
      const planned=result.state.plannedActions.find(x=>x.actorId==='player-0');
      assert.equal(planned.effectiveElement,element);
      const expectedCount=data.getBattleSkillById(id).targetGroup==='all-enemies'?2:1;
      assert.equal(a.impacts.length,expectedCount);
      for(const impact of a.impacts){
        assert.equal(impact.effectiveElement,element);
        const attacker=initial.combatants[0], defender=initial.combatants.find(c=>c.id===impact.targetId);
        const tech=attacker.skills[0].legacyTech;
        const expected=calculateLegacyDamage(attacker,defender,{...tech,element:element==='Darkness'?'Dark':element},'Water');
        assert.equal(impact.baseDamage,expected);
        if(element==='Water')assert.notEqual(expected,calculateLegacyDamage(attacker,defender,{...tech,element:'None'},'Water'));
      }
      if(policy==='natural')assert.ok(random.draws.findIndex(d=>d.category==='accuracy')<random.draws.findIndex(d=>d.category==='fantasmic-element'));
    });
  }
  test(name+' draws again on subsequent execution',()=>{
    const random=rng({'fantasmic-element':[0,4]});
    const result=run([unit('P',id)],[unit('E')],{rng:random,maxRounds:2});
    const actions=result.actions.filter(a=>a.actorName==='P');
    assert.equal(actions.length,2);
    assert.deepEqual(random.draws.filter(d=>d.category==='fantasmic-element').map(d=>d.value),[0,4]);
    actions.forEach((a,i)=>{
      const element=i===0?'Water':'Darkness';
      assert.ok(a.effectAudit.includes('Random attack element: '+element));
      assert.ok(a.impacts.every(x=>x.effectiveElement===element));
    });
  });
  test(name+' misses consume no element draw',()=>{
    const random=rng({accuracy:[127]});
    const a=action(run([unit('P',id)],[unit('E')],{rng:random}));
    assert.equal(a.outcome,'miss');
    assert.equal(random.draws.filter(d=>d.category==='fantasmic-element').length,0);
    assert.deepEqual(a.impacts,[]);
  });
}
