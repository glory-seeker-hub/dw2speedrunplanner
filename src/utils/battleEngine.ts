import { TeamDigimon, Tech, BattleDigimon, BattleTurn, SimulationResult, BattleSettings } from '@/types/digimon';
import { TECHS } from '@/data/techs';

// Specialty bonus matrix based on attacker tech specialty vs defender digimon specialty
const SPECIALTY_BONUS_MATRIX: { [key: string]: { [key: string]: number } } = {
  'Dark': { 'Dark': 1, 'Fire': 0.8, 'Machine': 1, 'Nature': 1, 'Water': 1.2 },
  'Fire': { 'Dark': 1, 'Fire': 1, 'Machine': 0.8, 'Nature': 1.2, 'Water': 1 },
  'Machine': { 'Dark': 1.2, 'Fire': 1, 'Machine': 1, 'Nature': 1, 'Water': 0.8 },
  'Nature': { 'Dark': 0.8, 'Fire': 1, 'Machine': 1.2, 'Nature': 1, 'Water': 1 },
  'Water': { 'Dark': 1, 'Fire': 1.2, 'Machine': 1, 'Nature': 0.8, 'Water': 1 }
};

// Type advantage matrix: attacker type vs defender type
const TYPE_BONUS_MATRIX: { [key: string]: { [key: string]: number } } = {
  'Vaccine': { 'Vaccine': 1, 'Data': 0.8, 'Virus': 1.2 },
  'Data': { 'Vaccine': 1.2, 'Data': 1, 'Virus': 0.8 },
  'Virus': { 'Vaccine': 0.8, 'Data': 1.2, 'Virus': 1 }
};

function getSpecialtyBonus(techSpecialty: string, defenderSpecialty: string): number {
  // None specialty always returns 1
  if (techSpecialty === 'None' || defenderSpecialty === 'None') return 1;
  
  const specialtyMap = SPECIALTY_BONUS_MATRIX[techSpecialty];
  if (!specialtyMap) return 1;
  
  return specialtyMap[defenderSpecialty] || 1;
}

function getTypeBonus(attackerType: string, defenderType: string): number {
  const typeMap = TYPE_BONUS_MATRIX[attackerType];
  if (!typeMap) return 1;
  
  return typeMap[defenderType] || 1;
}

function getTileBonus(techSpecialty: string, floorSpecialty: string): number {
  if (techSpecialty === 'None') return 1;
  return techSpecialty.toLowerCase() === floorSpecialty.toLowerCase() ? 1.2 : 1;
}

function getDefenderBonus(defenderSpecialty: string, floorSpecialty: string): number {
  if (defenderSpecialty === 'None') return 1;
  return defenderSpecialty.toLowerCase() === floorSpecialty.toLowerCase() ? 1.2 : 1;
}

function calculateDamage(
  attacker: BattleDigimon,
  defender: BattleDigimon,
  tech: Tech,
  floorSpecialty: string
): number {
  const typeBonus = getTypeBonus(attacker.type, defender.type);
  const specialtyBonus = getSpecialtyBonus(tech.element, defender.specialty);
  const attackPower = tech.ap;
  const tileBonus = getTileBonus(tech.element, floorSpecialty);
  const attack = attacker.stats.atk;
  const defense = defender.stats.def;
  const defenderBonus = getDefenderBonus(defender.specialty, floorSpecialty);

  // Damage formula: floor(floor(type bonus * specialty bonus * attack power * tech tile bonus) * attacker attack / floor(defender defense * defender tile bonus))
  const baseDamage = Math.floor(typeBonus * specialtyBonus * attackPower * tileBonus);
  const adjustedDefense = Math.floor(defense * defenderBonus);
  
  // Use integer arithmetic to avoid floating-point precision issues
  const finalDamage = Math.floor((baseDamage * attack) / adjustedDefense);
  
  return Math.max(0, finalDamage);
}

function createBattleDigimon(teamDigimon: TeamDigimon[], teamPrefix: string): BattleDigimon[] {
  return teamDigimon.map((td, index) => ({
    id: `${teamPrefix}-${index}`,
    name: td.digimon.name,
    type: td.digimon.type,
    specialty: td.digimon.specialty,
    stats: { ...td.customStats },
    currentHp: td.customStats.hp,
    techs: td.techs,
    isAlive: true
  }));
}

function createBattleDigimonFromEncounter(encounter: any): BattleDigimon[] {
  return encounter.digimons.map((digimon: any, index: number) => {
    // Convert tech names to Tech objects
    const techs = digimon.techs.map((techName: string) => 
      TECHS.find(t => t.name === techName) || {
        id: `unknown-${techName}`,
        name: techName,
        ap: 10,
        element: 'None' as const,
        target: 'Single' as const,
        isCounter: false
      }
    );

    return {
      id: `enemy-${index}`,
      name: digimon.name,
      type: 'Data' as const, // Default type for encounters
      specialty: 'None' as const, // Default specialty for encounters
      stats: {
        hp: digimon.hp,
        mp: digimon.mp,
        atk: digimon.atk,
        def: digimon.def,
        spd: digimon.spd
      },
      currentHp: digimon.hp,
      techs,
      isAlive: true
    };
  });
}

function getRandomTech(digimon: BattleDigimon): Tech {
  const availableTechs = digimon.techs.filter(tech => tech.ap > 0);
  if (availableTechs.length === 0) {
    // Fallback tech if none available
    return {
      id: 'basic-attack',
      name: 'Basic Attack',
      ap: 10,
      element: 'None',
      target: 'Single',
      isCounter: false
    };
  }
  return availableTechs[Math.floor(Math.random() * availableTechs.length)];
}

function getRandomTarget(targets: BattleDigimon[]): BattleDigimon {
  const aliveTargets = targets.filter(d => d.isAlive);
  return aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
}

function calculateTurnOrder(digimons: BattleDigimon[]): BattleDigimon[] {
  const aliveDigimons = digimons.filter(d => d.isAlive);
  
  // Add random 0-9 to speed for turn order
  const withInitiative = aliveDigimons.map(d => ({
    digimon: d,
    initiative: d.stats.spd + Math.floor(Math.random() * 10)
  }));

  // Sort by initiative (highest first)
  withInitiative.sort((a, b) => b.initiative - a.initiative);
  
  return withInitiative.map(w => w.digimon);
}

function simulateBattle(
  playerTeam: TeamDigimon[],
  enemyTeam: TeamDigimon[] | any,
  floorSpecialty: string
): { turns: number; history: BattleTurn[]; playerWon: boolean } {
  // Convert teams to battle format
  const playerDigimons = createBattleDigimon(playerTeam, 'player');
  const enemyDigimons = Array.isArray(enemyTeam) && 'digimon' in (enemyTeam[0] || {})
    ? createBattleDigimon(enemyTeam as TeamDigimon[], 'enemy')
    : createBattleDigimonFromEncounter(enemyTeam);

  const allDigimons = [...playerDigimons, ...enemyDigimons];
  const history: BattleTurn[] = [];
  let turnCount = 0;
  let round = 1;

  while (true) {
    // Check victory conditions
    const alivePlayerDigimons = playerDigimons.filter(d => d.isAlive);
    const aliveEnemyDigimons = enemyDigimons.filter(d => d.isAlive);

    if (alivePlayerDigimons.length === 0) {
      return { turns: turnCount, history, playerWon: false };
    }
    if (aliveEnemyDigimons.length === 0) {
      return { turns: turnCount, history, playerWon: true };
    }

    // Calculate turn order for this round
    const turnOrder = calculateTurnOrder(allDigimons);

    // Execute turns
    for (const attacker of turnOrder) {
      if (!attacker.isAlive) continue;

      turnCount++;
      const tech = getRandomTech(attacker);
      const isPlayerDigimon = attacker.id.startsWith('player');
      const opponents = isPlayerDigimon ? enemyDigimons : playerDigimons;
      const aliveOpponents = opponents.filter(d => d.isAlive);

      if (aliveOpponents.length === 0) break;

      if (tech.target === 'Single') {
        const target = getRandomTarget(aliveOpponents);
        const damage = calculateDamage(attacker, target, tech, floorSpecialty);
        target.currentHp = Math.max(0, target.currentHp - damage);
        
        if (target.currentHp <= 0) {
          target.isAlive = false;
        }

        history.push({
          turn: turnCount,
          round,
          digimon: attacker.name,
          tech: tech.name,
          target: target.name,
          damage,
          hpRemaining: target.currentHp,
          result: target.currentHp <= 0 ? 'KO' : 'Hit'
        });
      } else {
        // Target all opponents
        for (const target of aliveOpponents) {
          const damage = calculateDamage(attacker, target, tech, floorSpecialty);
          target.currentHp = Math.max(0, target.currentHp - damage);
          
          if (target.currentHp <= 0) {
            target.isAlive = false;
          }

          history.push({
            turn: turnCount,
            round,
            digimon: attacker.name,
            tech: tech.name,
            target: target.name,
            damage,
            hpRemaining: target.currentHp,
            result: target.currentHp <= 0 ? 'KO' : 'Hit'
          });
        }
      }

      // Check if battle ended after this attack
      const remainingPlayerDigimons = playerDigimons.filter(d => d.isAlive);
      const remainingEnemyDigimons = enemyDigimons.filter(d => d.isAlive);

      if (remainingPlayerDigimons.length === 0) {
        return { turns: turnCount, history, playerWon: false };
      }
      if (remainingEnemyDigimons.length === 0) {
        return { turns: turnCount, history, playerWon: true };
      }
    }

    round++;
  }
}

export function runBattleSimulation(
  playerTeam: TeamDigimon[],
  enemyTeam: TeamDigimon[] | any,
  floorSpecialty: string,
  simulationCount: number
): SimulationResult {
  let wins = 0;
  let totalTurns = 0;
  let minTurns = Infinity;
  let maxTurns = 0;
  let fastestBattleHistory: BattleTurn[] = [];

  for (let i = 0; i < simulationCount; i++) {
    const result = simulateBattle(playerTeam, enemyTeam, floorSpecialty);
    
    if (result.playerWon) {
      wins++;
    }

    totalTurns += result.turns;
    
    if (result.turns < minTurns) {
      minTurns = result.turns;
      fastestBattleHistory = [...result.history];
    }
    
    if (result.turns > maxTurns) {
      maxTurns = result.turns;
    }
  }

  return {
    winRate: (wins / simulationCount) * 100,
    totalSimulations: simulationCount,
    minTurns: minTurns === Infinity ? 0 : minTurns,
    avgTurns: totalTurns / simulationCount,
    maxTurns,
    fastestBattleHistory
  };
}