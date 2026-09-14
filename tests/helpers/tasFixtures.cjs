const {unit,first,rng,run,action,data,load}=require('./battleSupportFixtures.cjs');
const tas={accuracyMode:'strategy',rngPolicy:'tas-favorable'};
const supported=c=>c==='paralysis-failure'||c==='status-recovery-paralysis'||c==='status-recovery-confusion'||c?.startsWith('status-apply-');
function doubleInput(){return {player:[unit('D-Tyrannomon',111,{stats:{spd:200,atk:30}}),unit('Nanimon A',105,{stats:{spd:190,atk:30}}),unit('Nanimon B',105,{stats:{spd:180,atk:30}})],enemy:[unit('Birdramon',6,{stats:{spd:20,hp:1000}}),unit('Candlemon',6,{stats:{spd:10,hp:1000}})],floorSpecialty:'None'};}
const doublePolicy={chooseAction(a){return {kind:'skill',skillKey:a.skills[0].key,...(a.side==='player'&&a.position>0?{targetIntent:{kind:'combatants',targetIds:['enemy-'+(a.position-1)]}}:{})};}};
module.exports={unit,first,rng,run,action,data,load,tas,supported,doubleInput,doublePolicy};
