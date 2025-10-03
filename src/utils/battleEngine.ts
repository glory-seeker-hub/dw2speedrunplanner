import { TeamDigimon, Tech, BattleDigimon, BattleTurn, SimulationResult, BattleSettings } from '@/types/digimon';
import { TECHS } from '@/data/techs';
import { DIGIMONS } from '@/data/digimons';

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

function calculateActionTime(targetsHit: number): number {
  if (targetsHit === 1) return 10;
  if (targetsHit === 2) return 12;
  return 14; // 3 or more targets
}

function calculateDamage(
  attacker: BattleDigimon,
  defender: BattleDigimon,
  tech: Tech,
  floorSpecialty: string,
  isCounterAttack: boolean = false
): number {
  const typeBonus = getTypeBonus(attacker.type, defender.type);
  const specialtyBonus = getSpecialtyBonus(tech.element, defender.specialty);
  
  // Handle special effects that modify AP
  let attackPower = tech.ap;
  
  // Beast King Fist: counter damage based on damage taken
  if (isCounterAttack && tech.specialEffect?.type === 'counterDamageMultiplier' && attacker.damageTakenThisTurn) {
    return Math.floor(attacker.damageTakenThisTurn * (tech.specialEffect.value || 1.5));
  }
  
  // Counter AP multiplier effects
  if (isCounterAttack && (tech.specialEffect?.type === 'counterApMultiplier' || tech.specialEffect?.type === 'counterApMultiplierAndTargetAll')) {
    attackPower *= (tech.specialEffect.value || 1.5);
  }
  
  // SubZero Ice Punch: consecutive use bonus
  if (tech.specialEffect?.type === 'consecutiveApIncrease' && attacker.lastTechUsed === tech.name && attacker.consecutiveTechCount) {
    const bonus = Math.min((attacker.consecutiveTechCount || 0) * (tech.specialEffect.value || 2.5), 25);
    attackPower += bonus;
  }
  
  const tileBonus = getTileBonus(tech.element, floorSpecialty);
  
  // Apply debuffs to stats
  const attack = attacker.stats.atk * (attacker.debuffs?.atk || 1);
  const defense = defender.stats.def * (defender.debuffs?.def || 1);
  const defenderBonus = getDefenderBonus(defender.specialty, floorSpecialty);

  const baseDamage = Math.floor(typeBonus * specialtyBonus * attackPower * tileBonus);
  const adjustedDefense = Math.floor(defense * defenderBonus);
  const finalDamage = Math.floor((baseDamage * attack) / adjustedDefense);
  
  return finalDamage;
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
    isAlive: true,
    debuffs: {},
    consecutiveTechCount: 0,
    lastTechUsed: undefined,
    damageTakenThisTurn: 0
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

    // Look up the actual Digimon data to get correct type and specialty
    const digimonData = DIGIMONS.find(d => d.name === digimon.name);
    
    return {
      id: `enemy-${index}`,
      name: digimon.name,
      type: digimonData?.type || 'Data' as const, // Use actual type or fallback
      specialty: digimonData?.specialty || 'None' as const, // Use actual specialty or fallback
      stats: {
        hp: digimon.hp,
        mp: digimon.mp,
        atk: digimon.atk,
        def: digimon.def,
        spd: digimon.spd
      },
      currentHp: digimon.hp,
      techs,
      isAlive: true,
      debuffs: {},
      consecutiveTechCount: 0,
      lastTechUsed: undefined,
      damageTakenThisTurn: 0
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

interface DigimonWithTech extends BattleDigimon {
  assignedTech?: Tech;
  counterUsed?: boolean;
  isCountering?: boolean; // Track if this is a triggered counter attack
}

function calculateTurnOrder(digimons: DigimonWithTech[]): DigimonWithTech[] {
  const aliveDigimons = digimons.filter(d => d.isAlive);
  
  // Separate counter and non-counter digimons
  const counterDigimons: DigimonWithTech[] = [];
  const normalDigimons: DigimonWithTech[] = [];
  
  for (const d of aliveDigimons) {
    if (d.assignedTech?.isCounter) {
      counterDigimons.push(d);
    } else {
      normalDigimons.push(d);
    }
  }
  
  // Add random 0-9 to speed for turn order (normal digimons)
  const normalWithInitiative = normalDigimons.map(d => ({
    digimon: d,
    initiative: d.stats.spd + Math.floor(Math.random() * 10)
  }));

  // Sort by initiative (highest first)
  normalWithInitiative.sort((a, b) => b.initiative - a.initiative);
  
  // Counter digimons go last
  const counterWithInitiative = counterDigimons.map(d => ({
    digimon: d,
    initiative: d.stats.spd + Math.floor(Math.random() * 10)
  }));
  
  counterWithInitiative.sort((a, b) => b.initiative - a.initiative);
  
  return [...normalWithInitiative.map(w => w.digimon), ...counterWithInitiative.map(w => w.digimon)];
}

function simulateBattle(
  playerTeam: TeamDigimon[],
  enemyTeam: TeamDigimon[] | any,
  floorSpecialty: string
): { turns: number; history: BattleTurn[]; playerWon: boolean; totalTime: number } {
  // Convert teams to battle format
  const playerDigimons = createBattleDigimon(playerTeam, 'player') as DigimonWithTech[];
  const enemyDigimons = (Array.isArray(enemyTeam) && 'digimon' in (enemyTeam[0] || {})
    ? createBattleDigimon(enemyTeam as TeamDigimon[], 'enemy')
    : createBattleDigimonFromEncounter(enemyTeam)) as DigimonWithTech[];

  const allDigimons = [...playerDigimons, ...enemyDigimons];
  const history: BattleTurn[] = [];
  let turnCount = 0;
  let round = 1;
  let totalTime = 0;

  while (true) {
    // Check victory conditions
    const alivePlayerDigimons = playerDigimons.filter(d => d.isAlive);
    const aliveEnemyDigimons = enemyDigimons.filter(d => d.isAlive);

    if (alivePlayerDigimons.length === 0) {
      return { turns: turnCount, history, playerWon: false, totalTime };
    }
    if (aliveEnemyDigimons.length === 0) {
      return { turns: turnCount, history, playerWon: true, totalTime };
    }

    // Assign techs to all digimons at the start of the round
    for (const digimon of allDigimons) {
      if (digimon.isAlive) {
        digimon.assignedTech = getRandomTech(digimon);
        digimon.counterUsed = false;
        digimon.isCountering = false;
      }
    }

    // Calculate turn order for this round
    const turnOrder = calculateTurnOrder(allDigimons);
    
    // Track which digimons have acted this round
    const actedThisRound = new Set<string>();

    // Execute turns
    let turnIndex = 0;
    while (turnIndex < turnOrder.length) {
      const attacker = turnOrder[turnIndex];
      
      if (!attacker.isAlive || actedThisRound.has(attacker.id)) {
        turnIndex++;
        continue;
      }

      actedThisRound.add(attacker.id);
      turnCount++;
      
      const tech = attacker.assignedTech!;
      const isPlayerDigimon = attacker.id.startsWith('player');
      const opponents = isPlayerDigimon ? enemyDigimons : playerDigimons;
      const aliveOpponents = opponents.filter(d => d.isAlive);

      if (aliveOpponents.length === 0) break;

      // Execute attack
      const executeAttack = (target: DigimonWithTech) => {
        const damage = calculateDamage(attacker, target, tech, floorSpecialty, attacker.isCountering || false);
        const actionTime = calculateActionTime(tech.target === 'All' ? aliveOpponents.length : 1);
        
        target.currentHp = Math.max(0, target.currentHp - damage);
        target.damageTakenThisTurn = damage;
        
        // Twig Tap: heal attacker
        if (tech.specialEffect?.type === 'healOnDamage') {
          attacker.currentHp = Math.min(attacker.stats.hp, attacker.currentHp + damage);
        }
        
        // Apply debuffs
        if (tech.specialEffect?.type === 'debuffStat' && tech.specialEffect.stat) {
          const stat = tech.specialEffect.stat;
          const currentDebuff = target.debuffs?.[stat] || 1;
          const maxStacks = tech.specialEffect.maxStacks || 2;
          const stackCount = Math.round(Math.log2(1 / currentDebuff));
          
          if (stackCount < maxStacks) {
            target.debuffs = target.debuffs || {};
            target.debuffs[stat] = currentDebuff / Math.SQRT2;
          }
        }
        
        const wasAlive = target.isAlive;
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
          result: target.currentHp <= 0 ? 'KO' : 'Hit',
          timeSeconds: actionTime,
          targetsHit: tech.target === 'All' ? aliveOpponents.length : 1
        });

        totalTime += actionTime;

        // Check for counter trigger (unless Howling Crusher or attacker is also countering)
        // Counters cannot trigger other counters
        if (wasAlive && target.isAlive && target.assignedTech?.isCounter && !target.counterUsed && !actedThisRound.has(target.id) && tech.specialEffect?.type !== 'noTriggerCounter' && !attacker.isCountering) {
          target.counterUsed = true;
          target.isCountering = true; // Mark as triggered counter
          turnOrder.splice(turnIndex + 1, 0, target);
        }
        
        return target.currentHp <= 0;
      };
      
      // Track consecutive tech usage
      if (attacker.lastTechUsed === tech.name) {
        attacker.consecutiveTechCount = (attacker.consecutiveTechCount || 0) + 1;
      } else {
        attacker.consecutiveTechCount = 1;
        attacker.lastTechUsed = tech.name;
      }

      // Determine actual targeting based on counter effects
      let actualTarget = tech.target;
      if (attacker.isCountering && (tech.specialEffect?.type === 'counterTargetAll' || tech.specialEffect?.type === 'counterApMultiplierAndTargetAll')) {
        actualTarget = 'All';
      }
      
      if (actualTarget === 'Single') {
        let target = getRandomTarget(aliveOpponents) as DigimonWithTech;
        let killed = executeAttack(target);
        
        // Shadow Scythe: chain on kill
        while (killed && tech.specialEffect?.type === 'chainOnKill') {
          const remainingTargets = opponents.filter(d => d.isAlive);
          if (remainingTargets.length === 0) break;
          target = getRandomTarget(remainingTargets) as DigimonWithTech;
          killed = executeAttack(target);
        }
      } else {
        for (const target of aliveOpponents) {
          executeAttack(target as DigimonWithTech);
        }
      }
      
      // Reset damage taken after attack is complete (for next turn)
      attacker.damageTakenThisTurn = 0;

      // Check if battle ended after this attack
      const remainingPlayerDigimons = playerDigimons.filter(d => d.isAlive);
      const remainingEnemyDigimons = enemyDigimons.filter(d => d.isAlive);

      if (remainingPlayerDigimons.length === 0) {
        return { turns: turnCount, history, playerWon: false, totalTime };
      }
      if (remainingEnemyDigimons.length === 0) {
        return { turns: turnCount, history, playerWon: true, totalTime };
      }

      turnIndex++;
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
  let totalTime = 0;
  let minTurns = Infinity;
  let minTime = Infinity;
  let maxTurns = 0;
  let maxTime = 0;
  let fastestBattleHistory: BattleTurn[] = [];
  let fastestBattleByTime: BattleTurn[] = [];

  for (let i = 0; i < simulationCount; i++) {
    const result = simulateBattle(playerTeam, enemyTeam, floorSpecialty);
    
    if (result.playerWon) {
      wins++;
    }

    totalTurns += result.turns;
    totalTime += result.totalTime;
    
    if (result.turns < minTurns) {
      minTurns = result.turns;
      fastestBattleHistory = [...result.history];
    }

    if (result.totalTime < minTime) {
      minTime = result.totalTime;
      fastestBattleByTime = [...result.history];
    }
    
    if (result.turns > maxTurns) {
      maxTurns = result.turns;
    }

    if (result.totalTime > maxTime) {
      maxTime = result.totalTime;
    }
  }

  return {
    winRate: (wins / simulationCount) * 100,
    totalSimulations: simulationCount,
    minTurns: minTurns === Infinity ? 0 : minTurns,
    avgTurns: totalTurns / simulationCount,
    maxTurns,
    minTime: minTime === Infinity ? 0 : minTime,
    avgTime: totalTime / simulationCount,
    maxTime,
    fastestBattleHistory,
    fastestBattleByTime
  };
}