import { RESULT_HELP } from '@/utils/battle/battlePresentation';
import { getPlannerBattleLabel } from '@/utils/plannerBattleLabel';
import { createPlayerStatDrafts, resolvePlayerStatDrafts, resetPlayerStatDrafts, playerStatProvenance, SIMULATION_FIELDS, STAT_LABELS } from '@/utils/battle/battleStatOverrides';
import { type BattleRngPolicy } from '@/utils/battle/battleRngPolicy';
import { rootPlanInfo } from '@/utils/battle/battleActionPlans';
import { OBJECTIVE_LABELS, type BattleSearchMethod, type OptimizationObjective } from '@/utils/battle/battleSearchObjectives';
import { optimizedConfigForBudget } from '@/utils/battle/battleOptimizedSearch';
import type { PlannerBattleAnalysisPreset } from '@/utils/runPlanner/runBattleAnalysis';
import type { AccuracyMode } from '@/utils/battle/battleSimulationRules';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TeamDigimon, SimulationResult } from '@/types/digimon';
import { encounters } from '@/data/encounters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useBattleSimulationWorker } from '@/hooks/useBattleSimulationWorker';
import { SimulationSearchProgress } from '@/components/SimulationSearchProgress';
import { Loader2 } from 'lucide-react';


interface BattleSimulationProps {
  savedTeams: TeamDigimon[][];
  preset?: PlannerBattleAnalysisPreset; onClearPreset?: () => void;
  onSimulationComplete: (results: SimulationResult) => void;
}

interface FloorSpecialty {
  id: string;
  name: string;
}

const floorSpecialties: FloorSpecialty[] = [
  { id: 'none', name: 'None' },
  { id: 'water', name: 'Water' },
  { id: 'fire', name: 'Fire' },
  { id: 'dark', name: 'Dark' },
  { id: 'machine', name: 'Machine' },
  { id: 'nature', name: 'Nature' }
];

export const BattleSimulation = ({ savedTeams: manualTeams, onSimulationComplete, preset, onClearPreset }: BattleSimulationProps) => {
  const [imported, setImported] = useState(() => preset ? structuredClone(preset) : null);
  const [statDrafts, setStatDrafts] = useState(() => createPlayerStatDrafts(preset?.playerTeam ?? []));
  const localStats = useMemo(() => imported ? resolvePlayerStatDrafts(imported.playerTeam, statDrafts) : null, [imported, statDrafts]);
  const provenance = imported && localStats ? playerStatProvenance(imported.playerTeam, localStats.team) : undefined;
  const savedTeams = useMemo(() => imported ? [...manualTeams, localStats!.team, imported.enemyTeam] : manualTeams, [imported, localStats, manualTeams]);
  const [selectedPlayerTeam, setSelectedPlayerTeam] = useState<number | null>(preset ? manualTeams.length : null);
  const [selectedEnemyTeam, setSelectedEnemyTeam] = useState<'encounter' | 'saved'>(preset ? 'saved' : 'encounter');
  const [selectedEncounter, setSelectedEncounter] = useState<number | null>(null);
  const [selectedEnemySaved, setSelectedEnemySaved] = useState<number | null>(preset ? manualTeams.length + 1 : null);
  const [floorSpecialty, setFloorSpecialty] = useState<string>('none');
  const [customBudget, setCustomBudget] = useState(false);
  const [simulationCount, setSimulationCount] = useState<number>(100000);
  const [encounterSearch, setEncounterSearch] = useState<string>('');
  const [rngPolicy, setRngPolicy] = useState<BattleRngPolicy>('natural');
  const [accuracyMode, setAccuracyMode] = useState<AccuracyMode>('strategy');
  const [searchMethod, setSearchMethod] = useState<BattleSearchMethod>('optimized-action-search');
  const [objective, setObjective] = useState<OptimizationObjective>('fastest-potential');
  const search = useBattleSimulationWorker(onSimulationComplete);
  const isSimulating = search.running;
  const validCount = Number.isSafeInteger(simulationCount) && simulationCount > 0;
  const handleSimulate = () => {
    if (selectedPlayerTeam === null || !validCount || isSimulating || localStats?.valid === false) return;
    const enemy = selectedEnemyTeam === 'encounter' ? encounters.find(e => e.id === selectedEncounter)
      : selectedEnemySaved === null ? null : savedTeams[selectedEnemySaved];
    if (!enemy || (searchMethod === 'optimized-action-search' && rootDiagnostic)) return;
    search.start({ ...(imported ? { plannerProvenance: { source: imported.source, selectedBattle: imported.selectedBattle, historicalStateSummary: imported.historicalStateSummary, diagnostics: imported.diagnostics } } : {}), ...(provenance ? { playerStatProvenance: provenance } : {}), input: { player: savedTeams[selectedPlayerTeam], enemy, floorSpecialty }, requestedSimulations: simulationCount, simulationRules: { accuracyMode, rngPolicy }, searchMethod, ...(searchMethod === 'optimized-action-search' ? { optimizationObjective: objective, optimizedConfig: optimizedConfigForBudget(simulationCount) } : {}) });
  };

  const canSimulate = selectedPlayerTeam !== null && 
    ((selectedEnemyTeam === 'encounter' && selectedEncounter !== null) || 
     (selectedEnemyTeam === 'saved' && selectedEnemySaved !== null));

  const filteredEncounters = useMemo(() => {
    if (!encounterSearch) return encounters;
    return encounters.filter(encounter => 
      encounter.id.toString().includes(encounterSearch) ||
      encounter.digimons.some(digimon => 
        digimon.name.toLowerCase().includes(encounterSearch.toLowerCase())
      )
    );
  }, [encounterSearch]);

  const selectedEnemyData = useMemo(() => {
    if (selectedEnemyTeam === 'encounter' && selectedEncounter !== null) {
      return encounters.find(e => e.id === selectedEncounter);
    } else if (selectedEnemyTeam === 'saved' && selectedEnemySaved !== null) {
      return savedTeams[selectedEnemySaved];
    }
    return null;
  }, [selectedEnemyTeam, selectedEncounter, selectedEnemySaved, savedTeams]);

  const root = useMemo(() => {
    if (selectedPlayerTeam === null || !selectedEnemyData) return null;
    try { const { count, minimumBudget } = rootPlanInfo({ player: savedTeams[selectedPlayerTeam], enemy: selectedEnemyData, floorSpecialty }); return { count, minimumBudget, error: '' }; }
    catch (cause) { return { count: 0, minimumBudget: 0, error: cause instanceof Error ? cause.message : 'Invalid battle input.' }; }
  }, [savedTeams, selectedPlayerTeam, selectedEnemyData, floorSpecialty]);
  const rootDiagnostic = root?.error || (root?.count === 0 ? 'No complete legal Player round plan is available.' : root && simulationCount < root.minimumBudget ? 'Search budget too small. Minimum required for current first-round action space: ' + root.minimumBudget.toLocaleString() + '.' : '');
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Battle Simulation Setup</CardTitle><p className="text-sm text-muted-foreground">Battle / Teams → Simulation Strategy → RNG / Accuracy → Search Quality</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset disabled={isSimulating} className="space-y-6 min-w-0">
          {imported && <section className="rounded border p-3 space-y-2" aria-label="Pre-battle Planner state">
            <nav aria-label="Battle source" className="text-sm">Run Planner › {getPlannerBattleLabel(imported.selectedBattle)}</nav><p className="font-semibold">Analyzing pre-battle state — historical Planner copy</p>
            <p className="text-sm">Run: {imported.source.runName ?? 'Saved run'}</p>
            <p className="text-sm">{getPlannerBattleLabel(imported.selectedBattle)} · Encounter {imported.selectedBattle.encounterId} · Action {imported.source.battleEventIndex + 1}</p>
            <p className="text-sm text-muted-foreground">Run Planner does not track historical current HP/MP. This copy starts at full resources. Adjust below if needed; changes affect only this simulation.</p>
            <p className="text-xs text-muted-foreground">Stats follow Planner expected growth, rounded down for simulation. Floor specialty is a local setting.</p>
            <p className="text-sm">Planner stats use expected growth. If you know the Digimon's actual in-game stats, you can override them for this simulation.</p>
            <p className="font-semibold">{provenance?.source === 'custom-simulation-stats' ? 'Custom simulation stats' : 'Using Planner stats'}</p>
            <details open={localStats?.valid === false}><summary className="cursor-pointer font-semibold">Advanced — exact simulation stats</summary>{imported.playerTeam.map((member, index) => <div key={member.plannerDigimonInstanceId} className="space-y-1">
              <p className="text-sm">Slot {index + 1}: {member.digimon.name} · Lv{member.level} · DP{member.dp}</p>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Stat</th><th className="text-left">Planner baseline</th><th className="text-left">Simulation value</th></tr></thead><tbody>
              {SIMULATION_FIELDS.map(field => {
                const id = member.plannerDigimonInstanceId, inputId = `stat-${index}-${field}`, error = localStats?.errors[id]?.[field];
                const baseline = field === 'currentHp' || field === 'currentMp' ? null : member.customStats[field];
                const draft = statDrafts[id][field];
                return <tr key={field}><td><Label htmlFor={inputId}>{STAT_LABELS[field]}</Label></td><td>{baseline ?? 'Not tracked'}</td><td className="py-1">
                  <Input id={inputId} className="w-28" type="text" inputMode="numeric" value={draft} disabled={isSimulating}
                    aria-label={`Slot ${index + 1} ${member.digimon.name} Simulation ${STAT_LABELS[field]}`} aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined}
                    onChange={e => { const value = e.target.value; if (!isSimulating) setStatDrafts(previous => ({ ...previous, [id]: { ...previous[id], [field]: value } })); }} />
                  {baseline !== null && draft !== String(baseline) && <span className="text-xs">Planner {baseline} → Simulation {draft || '(empty)'}</span>}
                  {error && <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
                </td></tr>;
              })}
              </tbody></table></div>
            </div>)}
            </details><div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={isSimulating} onClick={() => { if (!isSimulating) setStatDrafts(resetPlayerStatDrafts(imported.playerTeam, statDrafts)); }}>Reset stats to Planner values</Button>
              <Button variant="outline" size="sm" disabled={isSimulating} onClick={() => { if (!isSimulating) { setImported(structuredClone(preset!)); setStatDrafts(createPlayerStatDrafts(preset!.playerTeam)); } }}>Reset imported team</Button>
              <Button variant="outline" size="sm" disabled={isSimulating} onClick={onClearPreset}>Use manual setup</Button>
            </div>
            {imported.diagnostics.filter(d => d.code !== 'planner-resource-history-unavailable').map((d, i) => <p key={i} className="text-xs text-muted-foreground">{d.message}</p>)}
          </section>}
          {!imported && <>
          {/* Player Team Selection */}
          <div className="space-y-2">
            <Label htmlFor="player-team">Select Your Team</Label>
            {savedTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved teams available. Create a team first.</p>
            ) : (
              <Select disabled={isSimulating} value={selectedPlayerTeam?.toString() || ''} onValueChange={(value) => setSelectedPlayerTeam(parseInt(value))}>
                <SelectTrigger id="player-team">
                  <SelectValue placeholder="Choose your team" />
                </SelectTrigger>
                <SelectContent>
                  {savedTeams.map((team, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      Team {index + 1} ({team.length} Digimon)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Enemy Team Selection */}
          <div className="space-y-4">
            <Label>Select Enemy Team</Label>
            <Tabs value={selectedEnemyTeam} onValueChange={(value) => setSelectedEnemyTeam(value as 'encounter' | 'saved')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger disabled={isSimulating} value="encounter">Enemy Encounters</TabsTrigger>
                <TabsTrigger disabled={isSimulating} value="saved">Saved Teams</TabsTrigger>
              </TabsList>
              
              <TabsContent value="encounter" className="space-y-2">
                <div className="space-y-2">
                  <Input
                    placeholder="Search encounters by ID or Digimon name..."
                    value={encounterSearch}
                    onChange={(e) => setEncounterSearch(e.target.value)}
                  />
                  <Select disabled={isSimulating} value={selectedEncounter?.toString() || ''} onValueChange={(value) => setSelectedEncounter(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose enemy encounter" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEncounters.map((encounter) => (
                        <SelectItem key={encounter.id} value={encounter.id.toString()}>
                          <div className="flex items-center gap-2">
                            Fight {encounter.id}
                            <div className="flex flex-wrap gap-1">
                              {encounter.digimons.map((digimon, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {digimon.name} Lv.{digimon.level}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
              
              <TabsContent value="saved" className="space-y-2">
                {savedTeams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved teams available.</p>
                ) : (
                  <Select disabled={isSimulating} value={selectedEnemySaved?.toString() || ''} onValueChange={(value) => setSelectedEnemySaved(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose enemy team" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedTeams.map((team, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          Team {index + 1} ({team.length} Digimon)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </TabsContent>
            </Tabs>
          </div>

          </>}
          <div className="space-y-2" role="group" aria-label="Search Method">
            <Label>Search Method</Label>
            <div className="flex flex-wrap gap-2">{([['optimized-action-search', 'Optimized Action Search'], ['random-monte-carlo', 'Random Monte Carlo']] as const).map(([method, label]) => <Button key={method} disabled={isSimulating} variant={searchMethod === method ? 'default' : 'outline'} aria-pressed={searchMethod === method} onClick={() => setSearchMethod(method)}>{label}</Button>)}</div>
          </div>
          {searchMethod === 'optimized-action-search' && <section aria-label="Optimized search settings" className="space-y-2">
            <Label>Optimization Objective</Label>
            <div className="flex flex-wrap gap-2">{Object.entries(OBJECTIVE_LABELS).map(([value, label]) => <Button key={value} disabled={isSimulating} variant={objective === value ? 'default' : 'outline'} aria-pressed={objective === value} onClick={() => setObjective(value as OptimizationObjective)}>{label}</Button>)}</div>
            {objective === 'fastest-potential' && <p className="text-sm text-muted-foreground">Fastest Potential searches for the fastest complete valid battle route observed anywhere in the search. It may depend on favorable remaining RNG.</p>}
            <p>First-round Player plans: {root?.count.toLocaleString() ?? '—'}</p>
            <p>Minimum screening evaluations: {root?.minimumBudget.toLocaleString() ?? '—'}</p>
            {root && root.count > 10000 && <p>Large action space — optimized search may take longer.</p>}
            {rootDiagnostic && <p role="alert">{rootDiagnostic}</p>}
          </section>}
          <div className="space-y-2" role="group" aria-label="Accuracy Mode">
            <Label>Accuracy Mode</Label>
            <div className="flex gap-2">
              <Button variant={accuracyMode === 'strategy' ? 'default' : 'outline'} aria-pressed={accuracyMode === 'strategy'} disabled={isSimulating} onClick={() => setAccuracyMode('strategy')}>Strategy</Button>
              <Button variant={accuracyMode === 'game-accurate' ? 'default' : 'outline'} aria-pressed={accuracyMode === 'game-accurate'} disabled={isSimulating} onClick={() => setAccuracyMode('game-accurate')}>Game-accurate</Button>
            </div>
            <p className="text-sm text-muted-foreground">{accuracyMode === 'strategy' ? 'Standard Hit Rate misses are disabled. Misses caused by Paralysis, Invisibility and other battle mechanics still occur.' : "Uses Digimon World 2's normal Hit Rate RNG."}</p></div><div className="space-y-2" role="group" aria-label="RNG Policy"><Label>RNG Policy</Label><div className="flex gap-2">
              <Button variant={rngPolicy === 'natural' ? 'default' : 'outline'} aria-pressed={rngPolicy === 'natural'} disabled={isSimulating} onClick={() => setRngPolicy('natural')}>Natural</Button>
              <Button variant={rngPolicy === 'tas-luck' ? 'default' : 'outline'} aria-pressed={rngPolicy === 'tas-luck'} disabled={isSimulating} onClick={() => setRngPolicy('tas-luck')}>TAS Luck</Button>
            </div>
            {rngPolicy === 'natural' ? <p className="text-sm text-muted-foreground">{RESULT_HELP.natural}</p> : <>
              <p className="text-sm text-muted-foreground">{RESULT_HELP.tas}</p>
              <p role="note" className="text-sm">{RESULT_HELP.conditional}</p>
              <p>Standard accuracy is controlled separately by Accuracy Mode.</p>
            </>}
          </div>
          {/* Floor Specialty */}
          <div className="space-y-2">
            <Label htmlFor="floor-specialty">Floor Specialty</Label>
            <Select disabled={isSimulating} value={floorSpecialty} onValueChange={setFloorSpecialty}>
              <SelectTrigger id="floor-specialty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {floorSpecialties.map((specialty) => (
                  <SelectItem key={specialty.id} value={specialty.id}>
                    {specialty.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Simulation Count */}
          <div className="space-y-2">
            <Label htmlFor="simulation-count">{searchMethod === 'optimized-action-search' ? 'Search Quality / Rollout Budget' : 'Number of Simulations'}</Label>
            <p className="text-sm">{simulationCount.toLocaleString()} {searchMethod === 'optimized-action-search' ? 'rollout budget' : 'simulations'}</p>
            <Input
              hidden={!customBudget} className={customBudget ? '' : 'hidden'}
              id="simulation-count"
              type="number"
              min="1"
              max={Number.MAX_SAFE_INTEGER}
              value={simulationCount}
              onChange={(e) => { setSimulationCount(Number(e.target.value)); setCustomBudget(true); }}
            />
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Simulation count presets">
            {([['Quick', 10000], ['Standard', 100000], ['Deep', 1000000]] as const).map(([label, count]) => <Button key={label} variant="outline" aria-pressed={!customBudget && simulationCount === count} onClick={() => { setSimulationCount(count); setCustomBudget(false); }}>{label} · {count.toLocaleString()}</Button>)}
            <Button variant="outline" aria-pressed={customBudget} onClick={() => { setCustomBudget(true); requestAnimationFrame(() => document.getElementById('simulation-count')?.focus()); }}>Custom</Button>
          </div>
          <p className="text-sm text-muted-foreground">{searchMethod === 'optimized-action-search' ? 'Every legal Player plan is screened at expanded states. Beam pruning, stochastic/fair rollouts and bounded TAS conflict search do not prove a global optimum.' : 'Quick: fast iteration. Standard (100,000): a good first/development search. Deep (1,000,000): important battles. Monte Carlo search does not prove the global optimum.'}</p>
          {!validCount && <p role="alert">Enter a positive safe integer number of simulations.</p>}
          </fieldset>
          {search.error && <p role="alert">Simulation unavailable: {search.error}</p>}
          {isSimulating && <SimulationSearchProgress progress={search.progress} requested={simulationCount} cancelling={search.cancelling} onCancel={search.cancel} />}
          {/* Simulate Button */}
          <Button 
            onClick={handleSimulate} 
            disabled={!canSimulate || !validCount || isSimulating || localStats?.valid === false || (searchMethod === 'optimized-action-search' && !!rootDiagnostic)}
            className="w-full"
            size="lg"
          >
            {isSimulating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Simulating...
              </>
            ) : canSimulate ? (
              'Start Simulation'
            ) : (
              'Select teams to simulate'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Selected Teams */}
      {selectedPlayerTeam !== null && (
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>Selected Player Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {savedTeams[selectedPlayerTeam].map((digimon, index) => (
                <div key={index} className="p-3 bg-muted/20 rounded-lg">
                  <h4 className="font-semibold">{digimon.digimon.name}</h4>
                  <div className="text-sm text-muted-foreground">
                    <p>HP: {digimon.customStats.hp} | MP: {digimon.customStats.mp}</p>
                    <p>ATK: {digimon.customStats.atk} | DEF: {digimon.customStats.def} | SPD: {digimon.customStats.spd}</p>
                    <p>Techs: {digimon.techs.length}{imported ? ' recorded' : '/3'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Selected Enemy Team */}
      {selectedEnemyData && (
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>Selected Enemy Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {'digimons' in selectedEnemyData ? (
                // Encounter team
                selectedEnemyData.digimons.map((digimon, index) => (
                  <div key={index} className="p-3 bg-muted/20 rounded-lg">
                    <h4 className="font-semibold">{digimon.name}</h4>
                    <div className="text-sm text-muted-foreground">
                      <p>Level: {digimon.level}</p>
                      <p>HP: {digimon.hp} | MP: {digimon.mp}</p>
                      <p>ATK: {digimon.atk} | DEF: {digimon.def} | SPD: {digimon.spd}</p>
                      <p>Techs: {digimon.techs.join(', ')}</p>
                    </div>
                  </div>
                ))
              ) : (
                // Saved team
                selectedEnemyData.map((digimon, index) => (
                  <div key={index} className="p-3 bg-muted/20 rounded-lg">
                    <h4 className="font-semibold">{digimon.digimon.name}</h4>
                    <div className="text-sm text-muted-foreground">
                      <p>HP: {digimon.customStats.hp} | MP: {digimon.customStats.mp}</p>
                      <p>ATK: {digimon.customStats.atk} | DEF: {digimon.customStats.def} | SPD: {digimon.customStats.spd}</p>
                      <p>Techs: {digimon.techs.length}{imported ? ' recorded' : '/3'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
