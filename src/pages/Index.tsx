import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamBuilder } from '@/components/TeamBuilder';
import { TeamDigimon } from '@/types/digimon';
import { Database, Zap, Trophy, Settings } from 'lucide-react';

const Index = () => {
  const [savedTeams, setSavedTeams] = useState<TeamDigimon[][]>([]);

  const handleSaveTeam = (team: TeamDigimon[]) => {
    setSavedTeams([...savedTeams, team]);
    // Here you would typically save to localStorage or a database
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-digital rounded-lg flex items-center justify-center animate-digital-pulse">
                <Database className="h-6 w-6 text-background" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-digital bg-clip-text text-transparent">
                  Digimon World 2
                </h1>
                <p className="text-sm text-muted-foreground">Battle Simulator</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Welcome Card */}
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-center">
                Welcome to the Digital World
              </CardTitle>
              <p className="text-center text-muted-foreground">
                Build your ultimate Digimon team and simulate epic battles against preset enemy teams.
                Customize stats, select powerful techs, and analyze battle statistics to perfect your strategy.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/20 rounded-lg">
                  <Database className="h-8 w-8 mx-auto mb-2 text-digital-blue" />
                  <h3 className="font-semibold">Team Builder</h3>
                  <p className="text-sm text-muted-foreground">
                    Select up to 3 Digimon and customize their stats and techs
                  </p>
                </div>
                <div className="text-center p-4 bg-muted/20 rounded-lg">
                  <Zap className="h-8 w-8 mx-auto mb-2 text-digital-cyan" />
                  <h3 className="font-semibold">Battle Simulation</h3>
                  <p className="text-sm text-muted-foreground">
                    Simulate millions of battles with advanced mechanics
                  </p>
                </div>
                <div className="text-center p-4 bg-muted/20 rounded-lg">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-digital-magenta" />
                  <h3 className="font-semibold">Statistics</h3>
                  <p className="text-sm text-muted-foreground">
                    Analyze win rates, turn counts, and battle histories
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Tabs */}
          <Tabs defaultValue="team-builder" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="team-builder" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Team Builder
              </TabsTrigger>
              <TabsTrigger value="battle-setup" disabled>
                <Zap className="h-4 w-4 mr-2" />
                Battle Setup
              </TabsTrigger>
              <TabsTrigger value="simulation" disabled>
                <Settings className="h-4 w-4 mr-2" />
                Simulation
              </TabsTrigger>
              <TabsTrigger value="results" disabled>
                <Trophy className="h-4 w-4 mr-2" />
                Results
              </TabsTrigger>
            </TabsList>

            <TabsContent value="team-builder" className="mt-6">
              <TeamBuilder onSaveTeam={handleSaveTeam} />
            </TabsContent>

            <TabsContent value="battle-setup" className="mt-6">
              <Card className="bg-gradient-card border-border">
                <CardHeader>
                  <CardTitle>Battle Setup</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Battle setup will be available after creating your team.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="simulation" className="mt-6">
              <Card className="bg-gradient-card border-border">
                <CardHeader>
                  <CardTitle>Battle Simulation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Simulation controls will be available after setting up your battle.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="mt-6">
              <Card className="bg-gradient-card border-border">
                <CardHeader>
                  <CardTitle>Battle Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Results and statistics will appear here after running simulations.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;