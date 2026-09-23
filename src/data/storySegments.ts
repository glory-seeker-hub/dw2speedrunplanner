import { DOMAINS, getDomainById } from '@/data/domains';
import type { DomainPhase } from '@/types/encounter';

export const STORY_SEGMENTS = [
  { id: 'before-blood-knights', label: 'Before Blood Knights' },
  { id: 'after-blood-knights', label: 'After Blood Knights' },
  { id: 'file-island', label: 'File Island' },
  { id: 'after-file-island', label: 'After File Island' },
  { id: 'coliseum', label: 'Coliseum' },
] as const;
export type StorySegment = typeof STORY_SEGMENTS[number]['id'];
export interface StoryDomain { domainId: string; phase: DomainPhase; label: string }
const before: DomainPhase = 'before-blood-knights';
const after: DomainPhase = 'after-blood-knights';
const domain = (domainId: string, phase: DomainPhase, label?: string): StoryDomain => ({
  domainId, phase, label: label ?? getDomainById(domainId)!.name,
});
/** Progression order. Phase is the legacy source identity, not the presentation segment. */
export const STORY_DOMAINS: Record<Exclude<StorySegment, 'coliseum'>, readonly StoryDomain[]> = {
  'before-blood-knights': ['boot', 'scsi', 'disk', 'video', 'bios', 'web', 'drive', 'modem'].map(id => domain(id + '-domain', before)),
  'after-blood-knights': [
    ...['scsi', 'disk', 'video', 'bios', 'web', 'drive', 'modem'].map(id => domain(id + '-domain', after, getDomainById(id + '-domain')!.name + ' 2')),
    domain('dvd-domain', before), domain('code-domain', after), domain('laser-domain', after),
  ],
  'file-island': ['power', 'port', 'giga', 'scan', 'diode', 'patch', 'mega', 'data', 'soft'].map(id => domain(id, after)),
  'after-file-island': ['bug-domain', 'ram-domain', 'rom-domain', 'core-tower', 'chaos-tower', 'tera-domain'].map(id => domain(id, after)),
};
// The canonical runtime source has no developer/test domains. Keep exclusions explicit.
export const EXCLUDED_PLANNER_DOMAINS: readonly string[] = [];
export const getStoryDomains = (segment: StorySegment): readonly StoryDomain[] => segment === 'coliseum' ? [] : STORY_DOMAINS[segment];
export const getDomainStorySegment = (domainId: string, phase: DomainPhase) => STORY_SEGMENTS.find(s =>
  getStoryDomains(s.id).some(d => d.domainId === domainId && d.phase === phase));
export const validateStoryDomains = (): string[] => {
  const assigned = Object.values(STORY_DOMAINS).flat().map(d => `${d.domainId}/${d.phase}`);
  const canonical = DOMAINS.filter(d => !EXCLUDED_PLANNER_DOMAINS.includes(d.id)).flatMap(d => d.variants.map(v => `${d.id}/${v.phase}`));
  return [
    ...(assigned.length !== 33 ? ['Expected 33 playable Domain variants'] : []),
    ...assigned.filter((id, i) => assigned.indexOf(id) !== i).map(id => `Duplicate: ${id}`),
    ...canonical.filter(id => !assigned.includes(id)).map(id => `Unassigned: ${id}`),
    ...assigned.filter(id => !canonical.includes(id)).map(id => `Unknown: ${id}`),
    ...Object.values(STORY_DOMAINS).flatMap((entries, i) => entries.length === [8, 10, 9, 6][i] ? [] : ['Incorrect segment count']),
  ];
};
