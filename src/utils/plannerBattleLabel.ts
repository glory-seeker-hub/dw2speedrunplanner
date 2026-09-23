import { getColiseumBattle, isColiseumLocation } from '@/data/coliseumBattles';
import { getDomainStorySegment, getStoryDomains } from '@/data/storySegments';
import type { RunBattleEvent } from '@/types/runPlanner';

export const getPlannerBattleLabel = (event: Pick<RunBattleEvent, 'domainId' | 'phase' | 'floor' | 'encounterId'>): string => {
  if (isColiseumLocation(event)) return `Coliseum · ${getColiseumBattle(event.encounterId)!.label}`;
  const segment = getDomainStorySegment(event.domainId, event.phase);
  const domain = segment && getStoryDomains(segment.id).find(d => d.domainId === event.domainId && d.phase === event.phase);
  return `${domain?.label ?? event.domainId} · Floor ${event.floor} · ${segment?.label ?? event.phase}`;
};
