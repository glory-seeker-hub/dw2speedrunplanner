import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { TECHS } from '@/data/techs';
import { Tech } from '@/types/digimon';
import { Search, Plus, Minus } from 'lucide-react';

interface TechSelectorProps {
  selectedTechs: Tech[];
  onTechsChange: (techs: Tech[]) => void;
}

export const TechSelector = ({ selectedTechs, onTechsChange }: TechSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTechs = TECHS.filter(tech => 
    tech.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addTech = (tech: Tech) => {
    if (selectedTechs.length < 12 && !selectedTechs.find(t => t.id === tech.id)) {
      onTechsChange([...selectedTechs, tech]);
    }
  };

  const removeTech = (tech: Tech) => {
    onTechsChange(selectedTechs.filter(t => t.id !== tech.id));
  };

  return (
    <div className="space-y-4">
      {/* Selected Techs */}
      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            Selected Techs ({selectedTechs.length}/12)
            {selectedTechs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTechsChange([])}
              >
                Clear All
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedTechs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No techs selected</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedTechs.map((tech) => (
                <div
                  key={tech.id}
                  className="flex items-center justify-between p-2 menu-selected rounded border"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{tech.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs px-1">
                        {tech.type}
                      </Badge>
                      <span className="text-info">
                        {tech.element}
                      </span>
                       <span>AP: {tech.ap}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    aria-label={`Remove ${tech.name}`} onClick={() => removeTech(tech)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Techs */}
      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-lg">Available Techs</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search techs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="grid grid-cols-1 gap-2">
              {filteredTechs.map((tech) => {
                const isSelected = selectedTechs.find(t => t.id === tech.id);
                const canAdd = selectedTechs.length < 12 && !isSelected;

                return (
                  <Card
                    key={tech.id}
                    className={`
                      cursor-pointer transition-all duration-200
                      ${isSelected ? 'menu-selected' : 'hover:bg-muted/40'}
                    `}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{tech.name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Badge variant="outline" className="text-xs px-1">
                              {tech.type}
                            </Badge>
                            <span className="text-info">
                              {tech.element}
                            </span>
                            <span>AP: {tech.ap}</span>
                            {tech.isCounter && <span className="text-info">Counter</span>}
                            <span>{tech.target}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? "secondary" : "outline"}
                          className="h-8 w-8 p-0"
                          aria-pressed={Boolean(isSelected)} aria-label={`${isSelected ? 'Remove' : 'Add'} ${tech.name}`} onClick={() => isSelected ? removeTech(tech) : addTech(tech)}
                          disabled={!isSelected && !canAdd}
                        >
                          {isSelected ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};