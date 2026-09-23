import { encounters } from '@/data/encounters';
import type { DomainPhase } from '@/types/encounter';

export interface ColiseumBattle { encounterId: number; category: 'coliseum'; rank: number; round: 'A' | 'B' | 'C'; label: string }
export const COLISEUM_BATTLES: readonly ColiseumBattle[] = Array.from({ length: 8 }, (_, i) => i + 2).flatMap(rank =>
  (['A', 'B', 'C'] as const).map((round, i) => ({ encounterId: 158 + (rank - 2) * 3 + i, category: 'coliseum', rank, round, label: `Rank ${rank}-${round}` })));
export const getColiseumBattle = (encounterId: number | null) => COLISEUM_BATTLES.find(b => b.encounterId === encounterId);
/** V7 compatibility encoding only; never added to DOMAINS or shown as a dungeon/floor. */
export const COLISEUM_LOCATION: { domainId: string; phase: DomainPhase; floor: number } = { domainId: 'coliseum', phase: 'after-blood-knights', floor: 0 };
export const isColiseumLocation = (value: { domainId: unknown; phase: unknown; floor: unknown; encounterId: unknown }): boolean =>
  value.domainId === COLISEUM_LOCATION.domainId && value.phase === COLISEUM_LOCATION.phase && value.floor === COLISEUM_LOCATION.floor &&
  typeof value.encounterId === 'number' && !!getColiseumBattle(value.encounterId);
export const validateColiseumBattles = (): string[] => {
  const errors: string[] = [];
  if (COLISEUM_BATTLES.length !== 24) errors.push('Expected 24 Coliseum battles');
  if (new Set(COLISEUM_BATTLES.map(b => b.encounterId)).size !== 24) errors.push('Duplicate Coliseum encounter');
  if (new Set(COLISEUM_BATTLES.map(b => b.label)).size !== 24) errors.push('Duplicate Coliseum label');
  COLISEUM_BATTLES.forEach((b, i) => {
    if (b.encounterId !== 158 + i || b.rank !== 2 + Math.floor(i / 3) || b.round !== ['A', 'B', 'C'][i % 3] || b.label !== `Rank ${b.rank}-${b.round}`) errors.push(`Invalid Coliseum order: ${i}`);
    if (encounters.filter(e => e.id === b.encounterId).length !== 1) errors.push(`Missing/duplicate canonical encounter: ${b.encounterId}`);
  });
  return errors;
};
