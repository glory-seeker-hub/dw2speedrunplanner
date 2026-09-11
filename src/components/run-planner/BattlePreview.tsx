import { getBattlePreview } from '@/utils/runBattleSelection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Props = {
  encounterId: number;
  domainName: string;
  phaseLabel: string;
  floor: number;
  isBoss: boolean;
};

export const BattlePreview = ({ encounterId, domainName, phaseLabel, floor, isBoss }: Props) => {
  const preview = getBattlePreview(encounterId);
  if (!preview) return <Alert variant="destructive"><AlertDescription>Data warning: encounter {encounterId} is missing.</AlertDescription></Alert>;
  const { encounter, reward } = preview;
  return (
    <Card className="status-panel" aria-label="Battle Preview">
      <CardHeader>
        <CardTitle>Battle Preview</CardTitle>
        <CardDescription>{domainName} · Floor {floor} · {phaseLabel}</CardDescription>
        <div><Badge variant={isBoss ? 'default' : 'secondary'}>{isBoss ? 'Boss' : 'Regular encounter'}</Badge></div>
        <p className="text-xs text-muted-foreground">Encounter ID: {encounterId}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {reward ? <p className="font-semibold tabular-nums">Total encounter reward: {reward.xp} XP · {reward.bits} Bits</p>
          : <Alert variant="destructive"><AlertDescription>Data warning: reward metadata is missing for encounter {encounterId}. XP and Bits are unknown.</AlertDescription></Alert>}
        <div className="grid gap-4 lg:grid-cols-3">
          {[...encounter.digimons].sort((a, b) => a.slot - b.slot).map((enemy) => (
            <div key={enemy.slot} className="menu-inset space-y-3 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Enemy slot {enemy.slot}</p>
              <h4 className="font-semibold">{enemy.name} · EL {enemy.level}</h4>
              <dl className="grid grid-cols-5 gap-2 text-center text-sm">
                {(['hp', 'mp', 'atk', 'def', 'spd'] as const).map((stat) => (
                  <div key={stat} className="stat-cell py-1"><dt className="text-xs text-muted-foreground">{stat.toUpperCase()}</dt><dd className="tabular-nums">{enemy[stat]}</dd></div>
                ))}
              </dl>
              <p className="text-sm"><span className="text-muted-foreground">Techniques: </span>{enemy.techs.join(', ') || 'None listed'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
