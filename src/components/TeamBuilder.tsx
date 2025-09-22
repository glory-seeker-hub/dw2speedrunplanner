import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DigimonCard } from './DigimonCard';
import { TechSelector } from './TechSelector';
import { DIGIMONS } from '@/data/digimons';
import { TECHS } from '@/data/techs';
import { Digimon, TeamDigimon, DigimonStats, Tech } from '@/types/digimon';
import { Plus, Trash2, Save } from 'lucide-react';

interface TeamBuilderProps {
  onSaveTeam?: (team: TeamDigimon[]) => void;
}

export const TeamBuilder = ({ onSaveTeam }: TeamBuilderProps) => {
  const [selectedDigimons, setSelectedDigimons] = useState<TeamDigimon[]>([]);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');

  const addDigimon = (digimon: Digimon) => {
    if (selectedDigimons.length < 3) {
      const newTeamDigimon: TeamDigimon = {
        digimon,
        customStats: { ...digimon.baseStats },
        techs: []
      };
      setSelectedDigimons([...selectedDigimons, newTeamDigimon]);
    }
  };

  const removeDigimon = (index: number) => {
    const updated = selectedDigimons.filter((_, i) => i !== index);
    setSelectedDigimons(updated);
    if (activeSlot >= updated.length && updated.length > 0) {
      setActiveSlot(updated.length - 1);
    }
  };

  const updateStats = (index: number, stat: keyof DigimonStats, value: number) => {
    const updated = [...selectedDigimons];
    updated[index].customStats[stat] = Math.max(0, value);
    setSelectedDigimons(updated);
  };

  const updateTechs = (index: number, techs: Tech[]) => {
    const updated = [...selectedDigimons];
    updated[index].techs = techs;
    setSelectedDigimons(updated);
  };

  const activeDigimon = selectedDigimons[activeSlot];

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold bg-gradient-digital bg-clip-text text-transparent">
            Team Builder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[0, 1, 2].map((slotIndex) => (
              <Card 
                key={slotIndex}
                className={`
                  relative min-h-[120px] cursor-pointer transition-all duration-300
                  ${activeSlot === slotIndex ? 'ring-2 ring-digital-blue shadow-digital' : 'hover:border-digital-blue/30'}
                  ${selectedDigimons[slotIndex] ? 'bg-gradient-card' : 'bg-muted/20 border-dashed'}
                `}
                onClick={() => setActiveSlot(slotIndex)}
              >
                <CardContent className="flex flex-col items-center justify-center h-full p-4">
                  {selectedDigimons[slotIndex] ? (
                    <>
                      <div className="text-center">
                        <h3 className="font-bold text-foreground">
                          {selectedDigimons[slotIndex].digimon.name}
                        </h3>
                        <Badge variant="secondary" className="mt-1">
                          {selectedDigimons[slotIndex].digimon.type}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-2">
                          {selectedDigimons[slotIndex].techs.length}/12 Techs
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDigimon(slotIndex);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <div className="text-center">
                      <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Empty Slot</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="select" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="select">Select Digimon</TabsTrigger>
              <TabsTrigger value="stats" disabled={!activeDigimon}>
                Customize Stats
              </TabsTrigger>
              <TabsTrigger value="techs" disabled={!activeDigimon}>
                Select Techs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="select" className="mt-4">
              <div className="space-y-4">
                <div className="relative">
                  <Plus className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Digimon..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {DIGIMONS.filter(digimon => 
                      digimon.name.toLowerCase().includes(searchTerm.toLowerCase())
                    ).map((digimon) => (
                      <DigimonCard
                        key={digimon.id}
                        digimon={digimon}
                        isSelected={selectedDigimons.some(td => td.digimon.id === digimon.id)}
                        onSelect={addDigimon}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              {activeDigimon && (
                <Card className="bg-muted/20">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Customize {activeDigimon.digimon.name} Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(Object.keys(activeDigimon.customStats) as Array<keyof DigimonStats>).map((stat) => (
                      <div key={stat} className="space-y-2">
                        <Label htmlFor={stat} className="capitalize">
                          {stat.toUpperCase()}
                        </Label>
                        <Input
                          id={stat}
                          type="number"
                          value={activeDigimon.customStats[stat]}
                          onChange={(e) => updateStats(activeSlot, stat, parseInt(e.target.value) || 0)}
                          className="font-mono"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="techs" className="mt-4">
              {activeDigimon && (
                <TechSelector
                  selectedTechs={activeDigimon.techs}
                  onTechsChange={(techs) => updateTechs(activeSlot, techs)}
                />
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end mt-6">
            <Button 
              onClick={() => onSaveTeam?.(selectedDigimons)}
              disabled={selectedDigimons.length === 0}
              className="bg-gradient-button hover:opacity-80"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Team
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};