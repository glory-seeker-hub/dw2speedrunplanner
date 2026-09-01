export interface EncounterDigimon {
  slot: number;
  name: string;
  level: number;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spd: number;
  techs: string[];
}

export interface Encounter {
  id: number;
  digimons: EncounterDigimon[];
  /**
   * Run Planner metadata only. The battle engine never reads these.
   * Undefined = not yet verified.
   */
  xp?: number;
  bits?: number;
}

/** Story progression phase. Some sources label the second one "After Black Knights". */
export type DomainPhase = 'before-blood-knights' | 'after-blood-knights';

export const DOMAIN_PHASES: DomainPhase[] = [
  'before-blood-knights',
  'after-blood-knights',
];

/** Where an encounter appears in the world. Encounter stats are never duplicated here. */
export interface DomainEncounter {
  encounterId: number;
  floors?: number[];
  isBoss?: boolean;
}

/** A domain configuration for one progression phase. */
export interface DomainVariant {
  phase: DomainPhase;
  maxFloor?: number;
  encounters: DomainEncounter[];
}

export interface Domain {
  id: string;
  name: string;
  variants: DomainVariant[];
}

export interface FloorSpecialty {
  id: string;
  name: string;
}
