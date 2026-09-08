import { useState } from 'react';
import { RosterDigimon } from '@/types/runPlanner';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { getDigimonById } from '@/utils/digimonLookup';
import { getNormalDigivolutionRule, lookupNormalEvolution, previewNormalDigivolution } from '@/utils/normalDigivolution';
import { getLevelCapDisplay } from '@/utils/levelCapDisplay';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

type Props = {
  runId: string;
  member: RosterDigimon;
  onDigivolve: (runId: string, expectedMember: RosterDigimon) => boolean;
  error: string | null;
};

/** Keep the reviewed instance snapshot fixed until confirmation or cancellation. */
export const DigivolutionControls = ({ runId, member, onDigivolve, error }: Props) => {
  const [reviewed, setReviewed] = useState<RosterDigimon | null>(null);
  const lookup = lookupNormalEvolution(member.speciesId, member.dp);
  const rule = getNormalDigivolutionRule(member.speciesId);
  const eligibility = previewNormalDigivolution(member);
  const preview = reviewed && previewNormalDigivolution(reviewed);
  const target = preview?.canDigivolve ? preview.digimon : null;
  return <div className="space-y-2 text-sm">
    {lookup.status === 'ambiguous' ? <p>Evolution data ambiguous</p>
      : lookup.status === 'invalid' ? <p>Evolution data unavailable: {lookup.reason}</p>
      : lookup.status === 'unavailable' || !rule ? <p>No further normal Digivolution</p>
      : <>
        <p>Next: {getDigimonById(lookup.targetSpeciesId)?.name ?? lookup.targetSpeciesId}</p>
        {eligibility.canDigivolve === true
          ? <Button size="sm" onClick={() => setReviewed(structuredClone(member))} aria-label={`Digivolve ${member.name}`}>Digivolve</Button>
          : <p className="text-muted-foreground">{member.level < rule.level ? `Available at EL${rule.level}` : eligibility.reason}</p>}
      </>}
    <AlertDialog open={reviewed !== null} onOpenChange={open => { if (!open) setReviewed(null); }}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Preview Digivolution</AlertDialogTitle>
          <AlertDialogDescription>Review this change before recording it as a run action.</AlertDialogDescription>
        </AlertDialogHeader>
        {reviewed && target && <>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="font-semibold">Current</p><p>{reviewed.name}</p><p>{getSpeciesProgression(reviewed.speciesId)?.rank}</p><p>EL {reviewed.level} · DP {reviewed.dp}</p></div>
            <div><p className="font-semibold">Result</p><p>{target.name}</p><p>{getSpeciesProgression(target.speciesId)?.rank}</p><p>EL {target.level} · DP {target.dp}</p></div>
          </div>
          <div className="space-y-1 text-sm">
            <p>Max EL: unchanged ({getLevelCapDisplay(reviewed).levelLabel})</p>
            <p>Total XP: {reviewed.totalXp} — unchanged</p>
            <p>HP: {reviewed.stats.hp} → {target.stats.hp}</p>
            <p>MP: {reviewed.stats.mp} → {target.stats.mp}</p>
            <p>ATK: {reviewed.stats.atk} — unchanged · DEF: {reviewed.stats.def} — unchanged · SPD: {reviewed.stats.spd} — unchanged</p>
            <p>Known techniques: preserved ({reviewed.techs.join(', ') || 'None'})</p>
          </div>
          <p className="text-sm text-muted-foreground">The evolved form's own technique is not learned immediately. It is learned only when leveling into the rank-specific technique level (EL12 / EL22 / EL32). Late Digivolution does not grant missed techniques retroactively.</p>
        </>}
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={!target} onClick={event => {
          if (!reviewed || !onDigivolve(runId, reviewed)) event.preventDefault();
        }}>Confirm Digivolution</AlertDialogAction></AlertDialogFooter>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </AlertDialogContent>
    </AlertDialog>
  </div>;
};
