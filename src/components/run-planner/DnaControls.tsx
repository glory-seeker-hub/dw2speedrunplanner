import { ActionDisclosure } from '@/components/run-planner/ActionDisclosure';
import { useState } from 'react';
import { RunPlan, RosterDigimon } from '@/types/runPlanner';
import { proposeDnaChild } from '@/utils/dnaProposal';
import { resolveTechniqueChoice } from '@/utils/techniqueCapacity';
import { MAX_TECHNIQUES } from '@/types/techniqueCapacity';
import { TechniqueChoiceControls } from '@/components/run-planner/TechniqueChoiceControls';
import { getLevelCapDisplay } from '@/utils/levelCapDisplay';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export const DnaControls = ({ run, onDna, error, compact = false }: {
  run: RunPlan;
  onDna: (runId: string, a: RosterDigimon, b: RosterDigimon, kept?: string[]) => boolean;
  error: string | null;
  compact?: boolean;
}) => {
  const [parentA, setParentA] = useState(''), [parentB, setParentB] = useState('');
  const [reviewed, setReviewed] = useState<{ a: RosterDigimon; b: RosterDigimon; proposal: ReturnType<typeof proposeDnaChild> } | null>(null);
  const [kept, setKept] = useState<string[]>([]);
  const [reviewTechniques, setReviewTechniques] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const changeParents = (a: string, b: string) => {
    setParentA(a); setParentB(b); setReviewed(null); setKept([]); setConfirm(false); setReviewTechniques(false); setLocalError(null);
    const first = run.roster.find(p => p.instanceId === a), second = run.roster.find(p => p.instanceId === b);
    if (!first || !second) return;
    try {
      const proposal = proposeDnaChild(first, second);
      setReviewed({ a: structuredClone(first), b: structuredClone(second), proposal });
      if (proposal.status !== 'unavailable') {
        setKept(proposal.choice.candidates.map(p => p.key));
        setReviewTechniques(proposal.status === 'selection-required');
      }
    } catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'DNA unavailable'); }
  };
  const proposal = reviewed?.proposal;
  const result = proposal && proposal.status !== 'unavailable' ? proposal : null;
  let resolution: ReturnType<typeof resolveTechniqueChoice> | null = null;
  if (result && kept.length <= MAX_TECHNIQUES) {
    // Mechanical result is fixed to the reviewed snapshots; only capacity changes here.
    try { resolution = resolveTechniqueChoice(result.choice, result.choice.candidates.length ? kept : undefined); } catch { /* Invalid selection keeps confirmation disabled. */ }
  }
  const reset = () => { setLocalError(null); setParentA(''); setParentB(''); setReviewed(null); setKept([]); setReviewTechniques(false); setConfirm(false); };
  return <ActionDisclosure title="DNA Digivolution" id="dna-controls" active={Boolean(parentA || parentB)} onCancel={reset} compact={compact}>
    <div className="grid gap-3 sm:grid-cols-2">{(['A', 'B'] as const).map(which => <label key={which} className="space-y-1 text-sm">
      <span>Parent {which}</span>
      <select aria-label={`DNA Parent ${which}`} className="block w-full rounded border bg-background p-2" value={which === 'A' ? parentA : parentB}
        onChange={event => changeParents(which === 'A' ? event.target.value : parentA, which === 'B' ? event.target.value : parentB)}>
        <option value="">Select a roster Digimon</option>
        {run.roster.map((p, index) => <option key={p.instanceId} value={p.instanceId}>{index + 1}. {p.name} · EL{p.level} · DP{p.dp} · {run.digiline.includes(p.instanceId) ? 'Active' : 'Reserve'}</option>)}
      </select>
    </label>)}</div>
    {proposal?.status === 'unavailable' && <p role="alert">DNA unavailable: {proposal.reason}</p>}
    {localError && <p role="alert">{localError}</p>}
    {result && reviewed && <>
      <div className="grid gap-4 sm:grid-cols-2 text-sm">{[reviewed.a, reviewed.b].map((p, index) => {
        // Form labels follow selector order; mechanical/audit metadata stays canonical.
        const metadata = result.mechanical.parents.find(parent => parent.instanceId === p.instanceId)!;
        return <div key={p.instanceId}><p className="font-semibold">Parent {index === 0 ? 'A' : 'B'} · {p.name}</p>
          <p>{metadata.rank} · {metadata.type} · {metadata.family}</p><p>EL{p.level} · DP{p.dp} · Max EL {getLevelCapDisplay(p).levelLabel}</p>
          <p>Possessed techniques: {p.techs.length}</p></div>;
      })}</div>
      <div className="space-y-1 text-sm"><p className="font-semibold">Result: {result.mechanical.actualResultName}{result.mechanical.isMutation ? ' · Mutation' : ''}</p>
        <p>{result.mechanical.actualResultRank} · {result.mechanical.actualResultType}</p>
        <p>EL{result.mechanical.startingLevel} · DP{result.mechanical.childDp} · Max EL{result.mechanical.childMaxLevel}</p>
        <p>{Object.entries(result.mechanical.childStats).map(([stat, value]) => `${stat.toUpperCase()} ${value}`).join(' · ')}</p>
        {result.mechanical.isMutation && <p>Matrix: {result.mechanical.matrixSelectionRank} / {result.mechanical.matrixSelectionType} · Actual: {result.mechanical.actualResultRank} / {result.mechanical.actualResultType}</p>}
        <p>Available techniques selected: {result.choice.candidates.filter(p => kept.includes(p.key)).map(p => p.name).join(', ') || 'None'}</p>
        <p>Discarded by this choice: {result.choice.candidates.filter(p => !kept.includes(p.key)).map(p => p.name).join(', ') || 'None'}</p>
        <p>Pending: {result.choice.state.techniquePool.filter(p => p.unlock.status === 'pending').map(p => `${p.name} — EL${'level' in p.unlock ? p.unlock.level : ''}`).join(', ') || 'None'}</p>
      </div>
      {result.choice.selectionRequired && <p className="font-semibold">Technique selection required. Keep 1–{MAX_TECHNIQUES} techniques, including the result’s own technique.</p>}
      {result.choice.candidates.some(p => !result.choice.mandatoryKeys.includes(p.key)) && <Button variant="outline" onClick={() => setReviewTechniques(true)}>Review techniques before DNA</Button>}
      {reviewTechniques && <TechniqueChoiceControls context="dna" choices={[{ instanceId: 'dna-proposal', name: result.mechanical.actualResultName,
        newLevel: result.mechanical.startingLevel, currentlyPossessed: [], choice: result.choice }]}
        selections={[{ instanceId: 'dna-proposal', keptKeys: kept }]} onChange={values => setKept(values[0].keptKeys)}
        onConfirm={() => setReviewTechniques(false)} onCancel={() => { setKept(result.choice.candidates.map(p => p.key)); setReviewTechniques(false); }} />}
      <Button disabled={resolution?.status !== 'resolved'} onClick={() => setConfirm(true)}>DNA Digivolve</Button>
    </>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Confirm DNA Digivolution</AlertDialogTitle>
        <AlertDialogDescription>DNA Digivolve {reviewed?.a.name} + {reviewed?.b.name} into {result?.mechanical.actualResultName}? Both parent Digimon will be consumed.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={resolution?.status !== 'resolved'} onClick={event => {
        if (reviewed && result && onDna(run.id, reviewed.a, reviewed.b, result.choice.candidates.length ? kept : undefined)) reset();
        else event.preventDefault();
      }}>Confirm DNA</AlertDialogAction></AlertDialogFooter>
      {error && <p role="alert">{error}</p>}
    </AlertDialogContent></AlertDialog>
  </ActionDisclosure>;
};
