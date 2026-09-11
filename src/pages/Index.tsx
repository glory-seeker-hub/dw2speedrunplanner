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
  const [savedTeams, setSavedTeams] = useState<TeamDigimon[][]>([]);
  const [simulationResults, setSimulationResults] = useState<SimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>('team-builder');
  const handleSaveTeam = (team: TeamDigimon[]) => {
    if (team.length > 0) {
      setSavedTeams([...savedTeams, team]);
      console.log('Team saved:', team);
      // Here you would typically save to localStorage or a database
    }
  };
  const handleSimulationComplete = (results: SimulationResult) => {
    setSimulationResults(results);
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
            <p className="font-semibold text-info">Plan the route. Build the team. Test the battle.</p>
            <p className="mt-1 text-muted-foreground">Run Planner tracks your roster and route. Team Builder prepares simulation teams; Battle Simulation tests them and Results shows the outcome.</p>
          </section>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
              <TabsTrigger value="team-builder" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Team Builder
              </TabsTrigger>
              <TabsTrigger value="battle-simulation">
                <Zap className="h-4 w-4 mr-2" />
                Battle Simulation
              </TabsTrigger>
              <TabsTrigger value="results" disabled={!simulationResults}>
                <Trophy className="h-4 w-4 mr-2" />
                Results
              </TabsTrigger>
              <TabsTrigger value="run-planner">Run Planner</TabsTrigger>
            </TabsList>

            <TabsContent value="run-planner" className="mt-6">
              <RunPlanner planner={planner} />
            </TabsContent>

            <TabsContent value="team-builder" className="mt-6">
              <TeamBuilder onSaveTeam={handleSaveTeam} />
            </TabsContent>

            <TabsContent value="battle-simulation" className="mt-6">
              <BattleSimulation savedTeams={savedTeams} onSimulationComplete={handleSimulationComplete} />
            </TabsContent>

            <TabsContent value="results" className="mt-6">
              {simulationResults ? <BattleResults results={simulationResults} /> : <Card className="bg-gradient-card border-border">
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