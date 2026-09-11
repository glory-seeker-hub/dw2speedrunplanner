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
        status-panel hover:border-primary
        ${isSelected ? 'menu-selected' : 'hover:shadow-card'}
      `}
      onClick={() => onSelect?.(digimon)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-foreground">{digimon.name}</CardTitle>
          <Badge variant="secondary" className="text-info">
            {digimon.specialty}
          </Badge>
        </div>
        <Badge variant="outline" className="w-fit text-xs">
          {digimon.type}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="stat-cell flex justify-between gap-1 px-2 py-1">
            <span className="text-muted-foreground">HP:</span>
            <span className="font-mono text-foreground">{digimon.baseStats.hp}</span>
          </div>
          <div className="stat-cell flex justify-between gap-1 px-2 py-1">
            <span className="text-muted-foreground">MP:</span>
            <span className="font-mono text-foreground">{digimon.baseStats.mp}</span>
          </div>
          <div className="stat-cell flex justify-between gap-1 px-2 py-1">
            <span className="text-muted-foreground">ATK:</span>
            <span className="font-mono text-foreground">{digimon.baseStats.atk}</span>
          </div>
          <div className="stat-cell flex justify-between gap-1 px-2 py-1">
            <span className="text-muted-foreground">DEF:</span>
            <span className="font-mono text-foreground">{digimon.baseStats.def}</span>
          </div>
          <div className="stat-cell flex justify-between gap-1 px-2 py-1 col-span-2">
            <span className="text-muted-foreground">SPD:</span>
            <span className="font-mono text-foreground">{digimon.baseStats.spd}</span>
          </div>
        </div>
        
        {onSelect && (
          <Button 
            variant={isSelected ? "secondary" : "outline"}
            size="sm" 
            aria-pressed={Boolean(isSelected)} className="w-full mt-4"
          >
            {isSelected ? 'Selected' : 'Select'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};