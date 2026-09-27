import { buildPlannerBattleAnalysisPreset, type PlannerBattleAnalysisPreset } from '@/utils/runPlanner/runBattleAnalysis';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamBuilder } from '@/components/TeamBuilder';
import { BattleSimulation } from '@/components/BattleSimulation';
import { BattleResults } from '@/components/BattleResults';
import { TeamDigimon, SimulationResult } from '@/types/digimon';
import { Database, Zap, Trophy } from 'lucide-react';
import { InfoDialog } from '@/components/InfoDialog';
import { RunPlanner } from '@/components/run-planner/RunPlanner';
import { useRunPlanner } from '@/hooks/useRunPlanner';
const Index = () => {
  const planner = useRunPlanner();
  const [analysis, setAnalysis] = useState<{ preset: PlannerBattleAnalysisPreset; revision: number } | null>(null);
  const validAnalysis = analysis && analysis.preset.source.runId === planner.data.activeRunId && planner.data.runs.some(run => run.id === analysis.preset.source.runId && run.history.some(event => event.id === analysis.preset.source.battleEventId)) ? analysis : null;
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const handleAnalyze = (runId: string, eventId: string) => {
    try {
      const run = planner.data.runs.find(r => r.id === runId);
      if (!run || run.id !== planner.data.activeRunId) throw new Error('The selected run has changed. Review Analyze Battle again.');
      const preset = buildPlannerBattleAnalysisPreset(run, eventId);
      setAnalysis(old => ({ preset, revision: (old?.revision ?? 0) + 1 }));
      setSimulationResults(null); setAnalysisError(null); setActiveTab('battle-simulation');
    } catch (cause) { setAnalysisError(cause instanceof Error ? cause.message : 'Historical battle analysis unavailable.'); }
  };
  const [savedTeams, setSavedTeams] = useState<TeamDigimon[][]>([]);
  const [simulationResults, setSimulationResults] = useState<SimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>('run-planner');
  const [resultSource, setResultSource] = useState<PlannerBattleAnalysisPreset['source'] | null>(null);
  const staleResult = resultSource && (resultSource.runId !== planner.data.activeRunId || !planner.data.runs.some(run => run.id === resultSource.runId && run.history.some(event => event.id === resultSource.battleEventId)));
  // Clear stale local analysis during the state transition, before it can be shown for another route.
  if ((analysis && !validAnalysis) || staleResult) {
    if (analysis && !validAnalysis) setAnalysis(null);
    setSimulationResults(null); setResultSource(null); setAnalysisError(null);
    if (activeTab === 'results') setActiveTab('run-planner');
  }
  const visibleResults = staleResult || (analysis && !validAnalysis) ? null : simulationResults;
  const handleSaveTeam = (team: TeamDigimon[]) => {
    if (team.length > 0) {
      setSavedTeams([...savedTeams, team]);
      console.log('Team saved:', team);
      // Here you would typically save to localStorage or a database
    }
  };
  const handleSimulationComplete = (results: SimulationResult) => {
    setSimulationResults(results);
    setResultSource(validAnalysis?.preset.source ?? null);
    setActiveTab('results');
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="menu-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="menu-inset w-10 h-10 rounded flex items-center justify-center">
                <Database className="h-6 w-6 text-info" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-foreground">
                  Digimon World 2
                </h1>
                <p className="text-sm text-muted-foreground">Run Planner & Battle Simulator</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <InfoDialog />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-5">
        <div className="space-y-4">
          <section aria-label="Planner introduction" className="menu-inset rounded-md px-4 py-3 text-sm">
            <p className="font-semibold text-info">Plan the route. Analyze the battle. Optimize the result.</p>
            <p className="mt-1 text-muted-foreground">Use Run Planner to build and track your route, or Team Builder for a manual battle setup. Battle Simulation tests the selected team and Results shows the recommended strategy.</p>
          </section>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
              <TabsTrigger value="run-planner">Run Planner</TabsTrigger>
              <TabsTrigger value="team-builder" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Team Builder
              </TabsTrigger>
              <TabsTrigger value="battle-simulation">
                <Zap className="h-4 w-4 mr-2" />
                Battle Simulation
              </TabsTrigger>
              <TabsTrigger value="results" disabled={!visibleResults}>
                <Trophy className="h-4 w-4 mr-2" />
                Results
              </TabsTrigger>
            </TabsList>

            <TabsContent value="run-planner" className="mt-6">
              <RunPlanner planner={planner} onAnalyze={handleAnalyze} analysisError={analysisError} />
            </TabsContent>

            <TabsContent value="team-builder" className="mt-6">
              <TeamBuilder onSaveTeam={handleSaveTeam} />
            </TabsContent>

            <TabsContent value="battle-simulation" className="mt-6">
              <div className="mb-3 flex flex-wrap gap-2">{validAnalysis && <Button variant="outline" onClick={() => setActiveTab('run-planner')}>Back to Run Planner</Button>}<p className="text-sm">Configure battle → Run simulation → Results → Export Simulation</p></div>
              <BattleSimulation key={validAnalysis?.revision ?? 'manual'} preset={validAnalysis?.preset} onClearPreset={() => setAnalysis(null)} savedTeams={savedTeams} onSimulationComplete={handleSimulationComplete} />
            </TabsContent>

            <TabsContent value="results" className="mt-6">
              {visibleResults ? <><Button variant="outline" className="mb-3" onClick={() => setActiveTab('battle-simulation')}>Back to Simulator setup</Button><BattleResults results={visibleResults} /></> : <Card className="bg-gradient-card border-border">
                  <CardHeader>
                    <CardTitle>Battle Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Results and statistics will appear here after running simulations.
                    </p>
                  </CardContent>
                </Card>}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>;
};
export default Index;
