import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Digimon } from '@/types/digimon';

interface DigimonCardProps {
  digimon: Digimon;
  isSelected?: boolean;
  onSelect?: (digimon: Digimon) => void;
}

export const DigimonCard = ({ digimon, isSelected, onSelect }: DigimonCardProps) => {
  return (
    <Card 
      className={`
        relative overflow-hidden transition-all duration-300 cursor-pointer
        bg-gradient-card border-border hover:border-digital-blue/50
        ${isSelected ? 'ring-2 ring-digital-blue shadow-digital animate-glow' : 'hover:shadow-card'}
      `}
      onClick={() => onSelect?.(digimon)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-foreground">{digimon.name}</CardTitle>
          <Badge variant="secondary" className="bg-secondary/20 text-secondary">
            {digimon.specialty}
          </Badge>
        </div>
        <Badge variant="outline" className="w-fit text-xs">
          {digimon.type}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">HP:</span>
            <span className="font-mono text-digital-cyan">{digimon.baseStats.hp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MP:</span>
            <span className="font-mono text-digital-blue">{digimon.baseStats.mp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ATK:</span>
            <span className="font-mono text-destructive">{digimon.baseStats.atk}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">DEF:</span>
            <span className="font-mono text-accent">{digimon.baseStats.def}</span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-muted-foreground">SPD:</span>
            <span className="font-mono text-digital-magenta">{digimon.baseStats.spd}</span>
          </div>
        </div>
        
        {onSelect && (
          <Button 
            variant={isSelected ? "secondary" : "outline"}
            size="sm" 
            className="w-full mt-4"
          >
            {isSelected ? 'Selected' : 'Select'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};