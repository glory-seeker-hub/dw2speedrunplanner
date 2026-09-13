const assert=require('node:assert/strict');
const {load}=require('./loadTs.cjs'),{member,tech}=require('./battleFixtures.cjs');
const data=load('src/data/battleSkills.ts');
const {simulateBattleCore}=load('src/utils/battleEngine.ts');
function unit(name='P',id=2,options={}){const s=data.getBattleSkillById(id);return {...member(name,[{...tech('Rock Fist'),id:'waza-'+id,canonicalSkillId:id,name:s.name,ap:s.attackPower??0,target:['all-allies','all-enemies','field'].includes(s.targetGroup)?'All':'Single',element:s.element==='Darkness'?'Dark':s.element==='Neutral'?'None':s.element}],{hp:1000,mp:100,spd:40,...options.stats}),...options};}
const first={chooseAction:a=>({kind:'skill',skillKey:a.skills[0].key})};
function rng(values={}){const q=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,[...v]])),draws=[];
const nextIntExclusive=(max,category)=>{const value=q[category]?.length?q[category].shift():category?.startsWith('status-recovery-')?3:category==='tail-blade-evasion'?1:0;assert.ok(Number.isInteger(value)&&value>=0&&value<max,category+': '+value+'/'+max);draws.push({category,value,max});return value;};
return {draws,nextIntExclusive,nextIntInclusive:(min,max,c)=>min+nextIntExclusive(max-min+1,c),nextFloat:c=>nextIntExclusive(10000,c)/10000};}
const run=(player=[unit()],enemy=[unit('E')],options={})=>simulateBattleCore({player,enemy,floorSpecialty:options.floorSpecialty??'None'},{maxRounds:1,actionPolicy:first,rng:rng(),...options});
const action=(r,name='P')=>r.actions.find(a=>a.actorName===name);
module.exports={unit,first,rng,run,action,data,load};
