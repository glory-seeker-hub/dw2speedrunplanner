import { BattleLearningWarning } from '@/utils/battleLearningWarnings';

export const BattleLearningWarnings = ({ warnings }: { warnings: BattleLearningWarning[] }) => warnings.length > 0 ?
  <section id="battle-learning-warning" aria-label="Evolution warning" role="status" className="planning-note rounded border border-primary p-3 text-sm space-y-3">
    <h3 className="font-semibold text-info">Evolution warning</h3>
    {warnings.map(warning => <div key={warning.instanceId} className="space-y-1">
      <p>{warning.name} is {warning.currentRank} at EL{warning.previousLevel}. This battle will raise it to EL{warning.projectedLevel} without reaching {warning.requiredRank} rank.</p>
      <p>{warning.requiredRank} learning opportunity will be missed.</p>
      {warning.techniques.length > 0 && <p>Techniques at risk: {warning.techniques.join(', ')}</p>}
      <p>Digivolve before recording if you want to keep this learning opportunity. You can still record the battle.</p>
    </div>)}
  </section> : null;
