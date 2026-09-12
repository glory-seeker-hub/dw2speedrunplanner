const { load } = require('./loadTs.cjs');
const { getTechByName } = load('src/utils/techLookup.ts');
const tech = (name, changes = {}) => ({ ...getTechByName(name), ...changes });
const member = (name, skills, stats = {}) => ({
  digimon: { id: name, name, type: 'Data', specialty: 'None', baseStats: { hp: 80, mp: 50, atk: 20, def: 20, spd: 20 } },
  customStats: { hp: 80, mp: 50, atk: 20, def: 20, spd: 20, ...stats }, techs: skills,
});
const cases = {
  single: [[member('P', [tech('Pepper Breath')], { spd: 40 })], [member('E', [tech('Rock Fist')])]],
  choices: [[member('P', [tech('Pepper Breath'), tech('Rock Fist')], { spd: 40 })], [member('E1', [tech('Rock Fist')]), member('E2', [tech('Rock Fist')])]],
  aoe: [[member('P', [tech('Triple Forces')], { spd: 40 })], [member('E1', [tech('Rock Fist')]), member('E2', [tech('Rock Fist')]), member('E3', [tech('Rock Fist')])]],
  koSkip: [[member('P1', [tech('Terra Force')], { spd: 40 }), member('P2', [tech('Rock Fist')])], [member('E1', [tech('Rock Fist')], { hp: 10 }), member('E2', [tech('Rock Fist')])]],
  counter: [[member('P', [tech('Rock Fist')], { spd: 40 })], [member('E', [tech('Beast King Fist')])]],
  noCounter: [[member('P', [tech('Howling Crusher')], { spd: 40 })], [member('E', [tech('Beast King Fist')])]],
  counterAll: [[member('P1', [tech('Rock Fist')], { spd: 40 }), member('P2', [tech('Rock Fist')])], [member('E', [tech('Smiley Warhead')], { hp: 150 })]],
  debuff: [[member('P', [tech('Scissor Claw')], { spd: 40 })], [member('E', [tech('Rock Fist')])]],
  consecutive: [[member('P', [tech('SubZero Ice Punch')], { spd: 40 })], [member('E', [tech('Rock Fist')], { hp: 150 })]],
  drain: [[member('P', [tech('Twig Tap')])], [member('E', [tech('Rock Fist')], { spd: 40 })]],
  legacyChain: [[member('P', [tech('Shadow Scythe', { specialEffect: { type: 'chainOnKill' } })], { spd: 40 })], [member('E1', [tech('Rock Fist')], { hp: 10 }), member('E2', [tech('Rock Fist')], { hp: 10 })]],
};
module.exports = { cases, member, tech };
