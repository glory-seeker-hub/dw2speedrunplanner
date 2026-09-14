const {unit,load}=require('./battleSupportFixtures.cjs');
function canonical(enemies=3){return {player:Array.from({length:3},(_,i)=>{const p=unit('P'+i,6,{stats:{spd:100,atk:100}});p.techs=[2,3,6,15,109].map(id=>unit('X',id).techs[0]);return p;}),enemy:Array.from({length:enemies},(_,i)=>unit('E'+i,6,{currentHp:10,stats:{spd:20}})),floorSpecialty:'None'};}
const small=()=>({player:[unit('P',6,{stats:{spd:100}})],enemy:[unit('E',6,{currentHp:10})],floorSpecialty:'None'});
module.exports={canonical,small,load,unit};
