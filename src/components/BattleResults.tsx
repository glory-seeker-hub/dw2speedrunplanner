import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SimulationResult } from '@/types/digimon';
import { Trophy, Clock, Target, TrendingUp, Timer } from 'lucide-react';

interface BattleResultsProps {
  results: SimulationResult;
}

export const BattleResults = ({ results }: BattleResultsProps) => {
  const getResultColor = (winRate: number) => {
    if (winRate >= 80) return 'bg-success text-success-foreground';
    if (winRate >= 60) return 'bg-digital-blue text-background';
    if (winRate >= 40) return 'bg-secondary text-secondary-foreground';
    return 'bg-destructive text-destructive-foreground';
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'KO':
        return '💀';
      case 'Hit':
        return '⚡';
      default:
        return '•';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Trophy className="h-4 w-4 text-digital-cyan" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Win Rate</p>
                <Badge className={getResultColor(results.winRate)}>
                  {results.winRate.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-digital-blue" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Min Turns</p>
                <p className="text-2xl font-bold text-digital-blue">{results.minTurns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Timer className="h-4 w-4 text-info" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Min Time</p>
                <p className="text-2xl font-bold text-info">{results.minTime}s</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-info" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">Simulations</p>
                <p className="text-2xl font-bold text-info">{results.totalSimulations.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fastest Battle by Time */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-digital-cyan" />
            Fastest Battle by Time ({results.minTime}s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            <div className="space-y-2">
              {results.fastestBattleByTime.map((turn, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline" className="w-16 justify-center">
                      T{turn.turn}
                    </Badge>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-digital-cyan">{turn.digimon}</span>
                      <span className="text-muted-foreground">uses</span>
                      <span className="font-medium text-digital-blue">{turn.tech}</span>
                      <span className="text-muted-foreground">on</span>
                      <span className="font-medium text-info">{turn.target}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <span className="text-destructive font-bold">{turn.damage}</span>
                      <span className="text-muted-foreground">dmg</span>
                    </div>
                    
                    <Separator orientation="vertical" className="h-4" />
                    
                    <div className="flex items-center space-x-1">
                      <span className="text-digital-cyan font-bold">{turn.hpRemaining}</span>
                      <span className="text-muted-foreground">HP</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <span className="text-info font-bold">{turn.timeSeconds}s</span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <span>{getResultIcon(turn.result)}</span>
                      <Badge 
                        variant={turn.result === 'KO' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {turn.result}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Fastest Battle by Turns */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-digital-cyan" />
            Fastest Battle by Turns ({results.minTurns} turns)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            <div className="space-y-2">
              {results.fastestBattleHistory.map((turn, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline" className="w-16 justify-center">
                      T{turn.turn}
                    </Badge>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-digital-cyan">{turn.digimon}</span>
                      <span className="text-muted-foreground">uses</span>
                      <span className="font-medium text-digital-blue">{turn.tech}</span>
                      <span className="text-muted-foreground">on</span>
                      <span className="font-medium text-info">{turn.target}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <span className="text-destructive font-bold">{turn.damage}</span>
                      <span className="text-muted-foreground">dmg</span>
                    </div>
                    
                    <Separator orientation="vertical" className="h-4" />
                    
                    <div className="flex items-center space-x-1">
                      <span className="text-digital-cyan font-bold">{turn.hpRemaining}</span>
                      <span className="text-muted-foreground">HP</span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <span className="text-info font-bold">{turn.timeSeconds}s</span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <span>{getResultIcon(turn.result)}</span>
                      <Badge 
                        variant={turn.result === 'KO' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {turn.result}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Additional Statistics */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Battle Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-digital-cyan">Turn Statistics</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fastest Victory:</span>
                  <span className="font-mono">{results.minTurns} turns</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Victory:</span>
                  <span className="font-mono">{results.avgTurns.toFixed(1)} turns</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Longest Battle:</span>
                  <span className="font-mono">{results.maxTurns} turns</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-digital-blue">Time Statistics</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fastest Time:</span>
                  <span className="font-mono">{results.minTime}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Time:</span>
                  <span className="font-mono">{results.avgTime.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Longest Time:</span>
                  <span className="font-mono">{results.maxTime}s</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-info">Performance</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Wins:</span>
                  <span className="font-mono text-digital-cyan">
                    {Math.round((results.winRate / 100) * results.totalSimulations)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Losses:</span>
                  <span className="font-mono text-destructive">
                    {results.totalSimulations - Math.round((results.winRate / 100) * results.totalSimulations)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Turn Spread:</span>
                  <span className="font-mono">{results.maxTurns - results.minTurns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time Spread:</span>
                  <span className="font-mono">{results.maxTime - results.minTime}s</span>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <h4 className="font-semibold text-info">Recommendations</h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              {results.winRate >= 80 ? (
                <p>🎉 Excellent team! Consider challenging stronger enemies.</p>
              ) : results.winRate >= 60 ? (
                <p>💪 Good performance. Fine-tune stats or tech selection.</p>
              ) : results.winRate >= 40 ? (
                <p>⚠️ Mixed results. Consider different type matchups.</p>
              ) : (
                <p>🔄 Low win rate. Review team composition and strategy.</p>
              )}
              
              {results.avgTurns > 20 && (
                <p>⏱️ Battles are long. Consider more offensive builds.</p>
              )}
              
              {results.minTurns < 5 && (
                <p>⚡ Very fast victories possible with optimal RNG!</p>
              )}

              {results.avgTime > 200 && (
                <p>🐌 Battles take too long. Focus on single-target techs.</p>
              )}

              {results.minTime < 50 && (
                <p>🚀 Lightning-fast victories are possible!</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};