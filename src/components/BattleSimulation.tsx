import type { PlannerBattleAnalysisPreset } from '@/utils/runPlanner/runBattleAnalysis';
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
import { runBattleSimulation } from '@/utils/battleEngine';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const savedTeams = useMemo(() => imported ? [...manualTeams, imported.playerTeam, imported.enemyTeam] : manualTeams, [imported, manualTeams]);
  const [selectedPlayerTeam, setSelectedPlayerTeam] = useState<number | null>(preset ? manualTeams.length : null);
  const [selectedEnemyTeam, setSelectedEnemyTeam] = useState<'encounter' | 'saved'>(preset ? 'saved' : 'encounter');
  const [selectedEncounter, setSelectedEncounter] = useState<number | null>(null);
  const [selectedEnemySaved, setSelectedEnemySaved] = useState<number | null>(preset ? manualTeams.length + 1 : null);
  const [floorSpecialty, setFloorSpecialty] = useState<string>('none');
  const [simulationCount, setSimulationCount] = useState<number>(1000);
  const [encounterSearch, setEncounterSearch] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const handleSimulate = async () => {
    if (selectedPlayerTeam === null) return;
    
    setIsSimulating(true);
    
    try {
      const playerTeam = savedTeams[selectedPlayerTeam];
      let enemyTeam;
      
      if (selectedEnemyTeam === 'encounter' && selectedEncounter !== null) {
        enemyTeam = encounters.find(e => e.id === selectedEncounter);
      } else if (selectedEnemyTeam === 'saved' && selectedEnemySaved !== null) {
        enemyTeam = savedTeams[selectedEnemySaved];
      }
      
      if (!enemyTeam) return;
      
      // Run simulation in a setTimeout to allow UI to update
      setTimeout(() => {
        // Source validation can reject incomplete encounter data asynchronously.
        try {
          const results = runBattleSimulation(playerTeam, enemyTeam, floorSpecialty, simulationCount);
          onSimulationComplete(results);
        } catch (error) {
          console.error('Simulation error:', error);
          toast.error('Simulation unavailable', { description: error instanceof Error ? error.message : 'Could not validate battle data.' });
        } finally {
          setIsSimulating(false);
        }
      }, 100);
    } catch (error) {
      console.error('Simulation error:', error);
      setIsSimulating(false);
    }
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

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Battle Simulation Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {imported && <section className="rounded border p-3 space-y-2" aria-label="Pre-battle Planner state">
            <p className="font-semibold">Analyzing pre-battle state</p>
            <p className="text-sm">{imported.selectedBattle.domainId} · {imported.selectedBattle.phase} · Floor {imported.selectedBattle.floor} · Encounter {imported.selectedBattle.encounterId} · Action {imported.source.battleEventIndex + 1}</p>
            <p className="text-sm text-muted-foreground">Run Planner does not track historical current HP/MP. This copy starts at full resources. Adjust below if needed; changes affect only this simulation.</p>
            <p className="text-xs text-muted-foreground">Stats follow Planner expected growth, rounded down for simulation. Floor specialty is a local setting.</p>
            {imported.playerTeam.map((member, index) => <div key={member.instanceId} className="flex flex-wrap items-center gap-3">
              <span className="text-sm">Slot {index + 1}: {member.digimon.name} · Lv{member.level} · DP{member.dp}</span>
              {(['hp', 'mp'] as const).map(resource => <Label key={resource} className="text-xs">Current {resource.toUpperCase()}
                <Input className="w-24" type="number" min={0} max={member.customStats[resource]} value={resource === 'hp' ? member.currentHp ?? member.customStats.hp : member.currentMp ?? member.customStats.mp}
                  onChange={e => { const value = Number(e.target.value); if (!Number.isFinite(value)) return; setImported(previous => previous ? { ...previous, playerTeam: previous.playerTeam.map((m, i) => i === index ? { ...m, [resource === 'hp' ? 'currentHp' : 'currentMp']: Math.max(0, Math.min(m.customStats[resource], value)) } : m) } : null); }} />
              </Label>)}
            </div>)}
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setImported(structuredClone(preset!))}>Reset imported team</Button><Button variant="outline" size="sm" onClick={onClearPreset}>Use manual setup</Button></div>
            {imported.diagnostics.filter(d => d.code !== 'planner-resource-history-unavailable').map((d, i) => <p key={i} className="text-xs text-muted-foreground">{d.message}</p>)}
          </section>}
          {!imported && <>
          {/* Player Team Selection */}
          <div className="space-y-2">
            <Label htmlFor="player-team">Select Your Team</Label>
            {savedTeams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved teams available. Create a team first.</p>
            ) : (
              <Select value={selectedPlayerTeam?.toString() || ''} onValueChange={(value) => setSelectedPlayerTeam(parseInt(value))}>
                <SelectTrigger>
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
                <TabsTrigger value="encounter">Enemy Encounters</TabsTrigger>
                <TabsTrigger value="saved">Saved Teams</TabsTrigger>
              </TabsList>
              
              <TabsContent value="encounter" className="space-y-2">
                <div className="space-y-2">
                  <Input
                    placeholder="Search encounters by ID or Digimon name..."
                    value={encounterSearch}
                    onChange={(e) => setEncounterSearch(e.target.value)}
                  />
                  <Select value={selectedEncounter?.toString() || ''} onValueChange={(value) => setSelectedEncounter(parseInt(value))}>
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
                  <Select value={selectedEnemySaved?.toString() || ''} onValueChange={(value) => setSelectedEnemySaved(parseInt(value))}>
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
          {/* Floor Specialty */}
          <div className="space-y-2">
            <Label htmlFor="floor-specialty">Floor Specialty</Label>
            <Select value={floorSpecialty} onValueChange={setFloorSpecialty}>
              <SelectTrigger>
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
            <Label htmlFor="simulation-count">Number of Simulations</Label>
            <Input
              id="simulation-count"
              type="number"
              min="1"
              max="1000000"
              value={simulationCount}
              onChange={(e) => setSimulationCount(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Simulate Button */}
          <Button 
            onClick={handleSimulate} 
            disabled={!canSimulate || isSimulating}
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
