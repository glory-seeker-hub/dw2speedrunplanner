import { DOMAINS, getDomainVariant } from '@/data/domains';
import { DOMAIN_GROUPS } from '@/data/domainGroups';
import { encounters } from '@/data/encounters';
import { DomainPhase } from '@/types/encounter';
import { getPlannerBattleReward } from '@/utils/battleProgressionPolicy';
import { COLISEUM_BATTLES, COLISEUM_LOCATION, getColiseumBattle, isColiseumLocation } from '@/data/coliseumBattles';

export const getDomainsForPhase = (phase: DomainPhase) =>
  DOMAINS.filter((domain) => domain.variants.some((variant) => variant.phase === phase));

export const getFloorsForDomain = (domainId: string, phase: DomainPhase): number[] =>
  [...new Set((getDomainVariant(domainId, phase)?.encounters ?? []).flatMap((entry) => entry.floors ?? []))]
    .sort((a, b) => a - b);

export const getBattlePreview = (encounterId: number) => {
  const encounter = encounters.find((entry) => entry.id === encounterId);
  return encounter ? { encounter, reward: getPlannerBattleReward(encounterId) } : undefined;
};

/** Keep location metadata separate from canonical battle stats and rewards. */
export const getEncountersForFloor = (domainId: string, phase: DomainPhase, floor: number) => {
  const groups = DOMAIN_GROUPS.filter((group) =>
    !getColiseumBattle(group.encounterId) && group.domainId === domainId && group.phase === phase && group.floors.includes(floor));
  return [...new Set(groups.map((group) => group.encounterId))].map((encounterId) => ({
    encounterId,
    groupIds: groups.filter((group) => group.encounterId === encounterId).map((group) => group.groupId),
    isBoss: groups.some((group) => group.encounterId === encounterId && group.isBoss),
    preview: getBattlePreview(encounterId),
  }));
};

export const getColiseumOptions = () => COLISEUM_BATTLES.map(b => ({
  ...b, groupIds: [] as number[], isBoss: false, preview: getBattlePreview(b.encounterId),
}));
export const getSelectedBattleOption = (selection: BattleSelection) =>
  isColiseumLocation(selection) ? getColiseumOptions().find(b => b.encounterId === selection.encounterId)
    : selection.floor === null ? undefined : getEncountersForFloor(selection.domainId, selection.phase, selection.floor).find(b => b.encounterId === selection.encounterId);

export interface BattleSelection {
  phase: DomainPhase;
  domainId: string;
  floor: number | null;
  encounterId: number | null;
}

export const initialBattleSelection: BattleSelection = {
  phase: 'before-blood-knights', domainId: '', floor: null, encounterId: null,
};

export type BattleSelectionAction =
  | { type: 'location'; domainId: string; phase: DomainPhase }
  | { type: 'coliseum' }
  | { type: 'phase'; phase: DomainPhase }
  | { type: 'domain'; domainId: string }
  | { type: 'floor'; floor: number }
  | { type: 'encounter'; encounterId: number };

/** Transient UI state only; no RunPlan or persistence dependency. */
export const battleSelectionReducer = (state: BattleSelection, action: BattleSelectionAction): BattleSelection => {
  switch (action.type) {
    case 'location': return { domainId: action.domainId, phase: action.phase, floor: null, encounterId: null };
    case 'coliseum': return { ...COLISEUM_LOCATION, encounterId: null };
    case 'phase':
      return { phase: action.phase, domainId: getDomainVariant(state.domainId, action.phase) ? state.domainId : '', floor: null, encounterId: null };
    case 'domain':
      return { ...state, domainId: getDomainVariant(action.domainId, state.phase) ? action.domainId : '', floor: null, encounterId: null };
    case 'floor':
      return { ...state, floor: getFloorsForDomain(state.domainId, state.phase).includes(action.floor) ? action.floor : null, encounterId: null };
    case 'encounter':
      if (isColiseumLocation({ ...state, encounterId: action.encounterId })) return { ...state, encounterId: action.encounterId };
      return { ...state, encounterId: state.floor !== null && getEncountersForFloor(state.domainId, state.phase, state.floor)
        .some((entry) => entry.encounterId === action.encounterId) ? action.encounterId : null };
  }
};
