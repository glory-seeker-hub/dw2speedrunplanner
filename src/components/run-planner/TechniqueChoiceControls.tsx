import { BattleTechniqueChoice, MAX_TECHNIQUES, TechniqueSelection } from '@/types/techniqueCapacity';
import { Button } from '@/components/ui/button';

export const TechniqueChoiceControls = ({ choices, selections, onChange, onConfirm, onCancel, context = 'battle' }: {
  context?: 'battle' | 'dna';
  choices: BattleTechniqueChoice[];
  selections: TechniqueSelection[];
  onChange: (selections: TechniqueSelection[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const valid = choices.every(entry => {
    const selected = selections.find(s => s.instanceId === entry.instanceId);
    return selected && selected.keptKeys.length >= 1 && selected.keptKeys.length <= MAX_TECHNIQUES &&
      new Set(selected.keptKeys).size === selected.keptKeys.length &&
      selected.keptKeys.every(key => entry.choice.candidates.some(p => p.key === key)) &&
      entry.choice.mandatoryKeys.every(key => selected.keptKeys.includes(key));
  });
  return <section className="space-y-4 rounded-lg border p-4" aria-label="Technique selection">
    <p className="font-semibold">Choose techniques to keep</p>
    <p className="text-sm">Keep 1–{MAX_TECHNIQUES} techniques. Unselected techniques will be discarded. The {context === 'dna' ? 'DNA' : 'battle'} is not recorded until you confirm all choices.</p>
    {choices.map(entry => {
      const selected = selections.find(s => s.instanceId === entry.instanceId)?.keptKeys ?? [];
      return <fieldset key={entry.instanceId} className="space-y-2">
        <legend className="font-semibold">{entry.name} · EL {entry.newLevel}</legend>
        <p className="text-sm">New techniques offered: {entry.choice.candidates.filter(p => entry.choice.newlyUnlockedKeys.includes(p.key)).map(p => p.name).join(', ')}</p>
        <p className="text-sm">Currently possessed: {entry.currentlyPossessed.join(', ') || 'None'}</p>
        <p className="text-sm">{selected.length} / {MAX_TECHNIQUES} selected{entry.choice.selectionRequired ? ' · Selection required' : ' · Optional changes'}</p>
        <div className="grid gap-2 sm:grid-cols-2">{entry.choice.candidates.map(p => <label key={p.key} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.includes(p.key)} disabled={entry.choice.mandatoryKeys.includes(p.key)} aria-label={`${entry.name}: keep ${p.name}`} onChange={event => {
            const keptKeys = event.target.checked ? [...selected, p.key] : selected.filter(key => key !== p.key);
            onChange(selections.map(s => s.instanceId === entry.instanceId ? { ...s, keptKeys } : s));
          }} />{p.name}{entry.choice.mandatoryKeys.includes(p.key) ? ' (required at birth)' : entry.choice.newlyUnlockedKeys.includes(p.key) ? ' (new)' : ''}
        </label>)}</div>
      </fieldset>;
    })}
    <div className="flex gap-2"><Button disabled={!valid} onClick={onConfirm}>{context === 'dna' ? 'Use selected techniques' : 'Confirm choices and record battle'}</Button>
      <Button variant="outline" onClick={onCancel}>Cancel technique selection</Button></div>
  </section>;
};
