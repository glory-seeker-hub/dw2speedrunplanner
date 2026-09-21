import { Button } from '@/components/ui/button';
import type { BattleSimulationReport } from '@/utils/battle/battleSimulationReport';
import { serializeBattleSimulationReportMarkdown, simulationReportFilename } from '@/utils/battle/battleSimulationReportSerialization';
import { downloadTextFile } from '@/utils/downloadTextFile';

export function SimulationReportExport({ report }: { report?: BattleSimulationReport }) {
  if (!report) return null;
  return <Button variant="outline" onClick={() => downloadTextFile(serializeBattleSimulationReportMarkdown(report), simulationReportFilename(report), 'text/markdown;charset=utf-8')}>Export Simulation</Button>;
}
