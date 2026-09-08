import { Badge } from '@/components/ui/badge';
import { RosterDigimon } from '@/types/runPlanner';
import { getLevelCapDisplay } from '@/utils/levelCapDisplay';

export const LevelCapDisplay = ({ member }: { member: Pick<RosterDigimon, 'level' | 'levelCap'> }) => {
  const display = getLevelCapDisplay(member);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="tabular-nums">{display.levelLabel}</span>
      {display.statusLabel && (
        <Badge variant={display.requiresResolution ? 'destructive' : display.isMax ? 'secondary' : 'outline'}
          title={display.isMax ? 'Maximum level reached. Additional battles grant no XP.' : undefined}>
          {display.statusLabel}
        </Badge>
      )}
    </div>
  );
};
