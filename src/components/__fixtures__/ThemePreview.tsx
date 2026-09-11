// Development-only visual fixtures, loaded by tests/theme-preview.html, never by the application entry point.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { createRunPlan } from '@/utils/runPlanCreation';
import { getDigimonByName } from '@/utils/digimonLookup';
import { getSpeciesProgression } from '@/data/speciesProgression';
import { createAvailableTechniqueState } from '@/utils/techniqueInheritance';
import { getRequiredTotalXpForLevel } from '@/utils/experience';
import { buildTechniqueChoice } from '@/utils/techniqueCapacity';
import { TradeControls } from '@/components/run-planner/TradeControls';
import { DnaControls } from '@/components/run-planner/DnaControls';
import { TechniqueChoiceControls } from '@/components/run-planner/TechniqueChoiceControls';
import { BattleResults } from '@/components/BattleResults';
import { SimulationResult } from '@/types/digimon';

const run = createRunPlan('gold-hawk', 'Visual fixture');
run.roster = ['D-Tyrannomon', 'Nanimon', 'ToyAgumon', 'Cherrymon', 'MasterTyrannomon'].map((name, index) => {
  const species = getDigimonByName(name)!;
  const level = index === 2 ? 11 : 49;
  return { ...run.roster[0], instanceId: `fixture-${index}`, speciesId: species.id, name, level,
    totalXp: getRequiredTotalXpForLevel(level)!, levelCap: { min: 50, max: 50, resolved: 50 },
    stats: { hp: 348.5, mp: 262, atk: 132.5, def: 117, spd: 86.25 },
    ...createAvailableTechniqueState([getSpeciesProgression(species.id)!.ownTechnique!], { type: 'own-species', speciesId: species.id }) };
});
run.digiline = run.roster.slice(0, 2).map(p => p.instanceId);
const choice = buildTechniqueChoice(createAvailableTechniqueState(['Pepper Breath', 'Fire Blast', 'Party Time'],
  { type: 'inherited', parentInstanceId: 'fixture-parent' }), ['Fire Blast', 'Party Time']);
const results: SimulationResult = { winRate: 86.5, totalSimulations: 200, minTurns: 2, avgTurns: 4.3, maxTurns: 8,
  minTime: 12, avgTime: 24.5, maxTime: 44,
  fastestBattleHistory: [{ turn: 1, round: 1, digimon: 'Agumon', tech: 'Pepper Breath', target: 'Biyomon', damage: 32,
    hpRemaining: 0, result: 'KO', timeSeconds: 6, targetsHit: 1 }],
  fastestBattleByTime: [{ turn: 1, round: 1, digimon: 'Agumon', tech: 'Pepper Breath', target: 'Biyomon', damage: 32,
    hpRemaining: 0, result: 'KO', timeSeconds: 6, targetsHit: 1 }] };

export function ThemePreview() {
  const [selections, setSelections] = useState([{ instanceId: 'fixture', keptKeys: choice.candidates.map(p => p.key) }]);
  const [notice, setNotice] = useState('');
  return <main className="container space-y-6 px-4 py-5">
    <header className="menu-panel rounded border p-4"><h1 className="text-xl font-bold">Theme visual fixtures</h1>
      <p className="text-sm text-muted-foreground">Synthetic display data. No run is saved and confirmation actions do not record gameplay.</p>
      <nav className="mt-2 flex flex-wrap gap-4 text-sm underline"><a href="#management">Management</a><a href="#learning">Technique learning</a><a href="#results">Results</a></nav></header>
    <section id="management" className="grid items-start gap-4 lg:grid-cols-2" aria-label="Management fixtures">
      <TradeControls run={run} onTrade={() => false} error={null} />
      <DnaControls run={run} onDna={() => false} error={null} />
    </section>
    <section id="learning" aria-label="Learning fixture"><TechniqueChoiceControls
      choices={[{ instanceId: 'fixture', name: 'Greymon', newLevel: 12, currentlyPossessed: ['Pepper Breath'], choice }]}
      selections={selections} onChange={setSelections} onConfirm={() => setNotice('Preview only — no battle recorded.')}
      onCancel={() => setSelections([{ instanceId: 'fixture', keptKeys: choice.candidates.map(p => p.key) }])} />
      {notice && <p role="status">{notice}</p>}</section>
    <section id="results" aria-label="Results fixture"><BattleResults results={results} /></section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<ThemePreview />);
