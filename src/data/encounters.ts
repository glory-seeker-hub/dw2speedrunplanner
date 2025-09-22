import { Encounter } from '@/types/encounter';

export const encounters: Encounter[] = [
  {
    id: 1,
    digimons: [
      { slot: 1, name: 'Gabumon', level: 1, hp: 27, mp: 22, atk: 24, def: 19, spd: 13, techs: ['Blue Blaster'] }
    ]
  },
  {
    id: 2,
    digimons: [
      { slot: 1, name: 'Crabmon', level: 1, hp: 25, mp: 25, atk: 20, def: 20, spd: 13, techs: ['Scissor Magic'] }
    ]
  },
  {
    id: 3,
    digimons: [
      { slot: 1, name: 'Patamon', level: 2, hp: 39, mp: 36, atk: 35, def: 34, spd: 21, techs: ['Boom Bubble'] }
    ]
  },
  {
    id: 4,
    digimons: [
      { slot: 1, name: 'Crabmon', level: 1, hp: 30, mp: 30, atk: 30, def: 30, spd: 20, techs: ['Scissor Magic'] },
      { slot: 2, name: 'Crabmon', level: 1, hp: 30, mp: 30, atk: 30, def: 30, spd: 20, techs: ['Scissor Magic'] }
    ]
  },
  {
    id: 5,
    digimons: [
      { slot: 1, name: 'Gabumon', level: 3, hp: 37, mp: 40, atk: 44, def: 39, spd: 26, techs: ['Blue Blaster'] },
      { slot: 2, name: 'Gotsumon', level: 3, hp: 40, mp: 35, atk: 40, def: 40, spd: 29, techs: ['Rock Fist'] }
    ]
  },
  {
    id: 6,
    digimons: [
      { slot: 1, name: 'Candlemon', level: 3, hp: 39, mp: 40, atk: 42, def: 40, spd: 27, techs: ['Flame Bomber'] },
      { slot: 2, name: 'Floramon', level: 3, hp: 41, mp: 40, atk: 38, def: 40, spd: 27, techs: ['Rain Of Pollen'] }
    ]
  },
  {
    id: 7,
    digimons: [
      { slot: 1, name: 'Candlemon', level: 5, hp: 50, mp: 50, atk: 50, def: 50, spd: 32, techs: ['Flame Bomber'] },
      { slot: 2, name: 'Candlemon', level: 5, hp: 50, mp: 50, atk: 50, def: 50, spd: 32, techs: ['Flame Bomber'] },
      { slot: 3, name: 'Palmon', level: 4, hp: 49, mp: 48, atk: 50, def: 46, spd: 38, techs: ['Poison Ivy'] }
    ]
  },
  {
    id: 8,
    digimons: [
      { slot: 1, name: 'Drimogemon', level: 11, hp: 85, mp: 85, atk: 50, def: 50, spd: 37, techs: ['Iron Drill Spin'] },
      { slot: 2, name: 'Elecmon', level: 5, hp: 60, mp: 60, atk: 50, def: 50, spd: 43, techs: ['S-Thunder Smack'] }
    ]
  },
  {
    id: 9,
    digimons: [
      { slot: 1, name: 'Yanmamon', level: 12, hp: 98, mp: 98, atk: 53, def: 53, spd: 44, techs: ['Thunder Ray'] },
      { slot: 2, name: 'Palmon', level: 5, hp: 63, mp: 61, atk: 50, def: 52, spd: 45, techs: ['Poison Ivy'] }
    ]
  },
  {
    id: 10,
    digimons: [
      { slot: 1, name: 'Kokatorimon', level: 12, hp: 94, mp: 100, atk: 52, def: 53, spd: 47, techs: ['Stun Flame Shot', 'Spiral Twister'] },
      { slot: 2, name: 'Kiwimon', level: 12, hp: 101, mp: 102, atk: 53, def: 51, spd: 42, techs: ['Pummel Peck'] }
    ]
  },
  // Continue with more encounters...
  {
    id: 25,
    digimons: [
      { slot: 1, name: 'SkullMeramon', level: 25, hp: 249, mp: 241, atk: 87, def: 91, spd: 73, techs: ['Metal Fireball'] },
      { slot: 2, name: 'MetalMamemon', level: 25, hp: 234, mp: 245, atk: 84, def: 90, spd: 66, techs: ['Energetic Bomb'] }
    ]
  }
];