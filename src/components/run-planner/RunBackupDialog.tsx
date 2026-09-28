import { useRef, useState } from 'react';
import { useRunPlanner } from '@/hooks/useRunPlanner';
import { STARTERS } from '@/data/starters';
import { backupFilename, createRunBackup, readRunBackupFile, resolveImportedRunNames, RunBackup, serializeRunBackup } from '@/utils/runPlannerBackup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function RunBackupDialog({ planner }: { planner: ReturnType<typeof useRunPlanner> }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ filename: string; backup: RunBackup } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const request = useRef(0);
  const confirmed = useRef(false);
  const names = preview ? resolveImportedRunNames(planner.data.runs, preview.backup.runs) : [];
  const clearPreview = () => { request.current++; setPreview(null); setReading(false); setError(null); };
  const exportBackup = (scope: RunBackup['scope']) => {
    try {
      const backup = createRunBackup(planner.data, scope);
      const url = URL.createObjectURL(new Blob([serializeRunBackup(backup)], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = backupFilename(backup);
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not export the backup.'); }
  };
  return <Dialog open={open} onOpenChange={value => { setOpen(value); clearPreview(); setSuccess(null); }}>
    <DialogTrigger asChild><Button variant="outline">Backup / Import</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto min-w-0">
      <DialogHeader><DialogTitle>Backup and Restore</DialogTitle>
        <DialogDescription>Runs are stored in this browser. Download a backup to keep or move them. Backup files stay on your device. There is no automatic backup or cloud sync.</DialogDescription>
      </DialogHeader>
      <section className="space-y-2" aria-label="Backup">
        <h3 className="font-semibold">Backup</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!planner.activeRun} onClick={() => exportBackup('active-run')}>Export Current Run</Button>
          <Button variant="outline" disabled={!planner.data.runs.length} onClick={() => exportBackup('all-runs')}>Export All Runs</Button>
        </div>
        {!planner.data.runs.length && <p className="text-sm text-muted-foreground">No saved runs to export. You can import a backup below.</p>}
        <p className="text-sm text-muted-foreground">Backup JSON restores editable runs. Export Route creates a readable document for Print / Save as PDF.</p>
      </section>
      <section className="space-y-3 min-w-0" aria-label="Import Backup">
        <Label htmlFor="run-backup-file">Import Backup — choose a JSON file</Label>
        <Input id="run-backup-file" className="min-w-0" type="file" accept=".json,application/json" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = '';
          clearPreview(); setSuccess(null);
          if (!file) return;
          const token = request.current; setReading(true); confirmed.current = false;
          try {
            const backup = await readRunBackupFile(file);
            if (token === request.current) setPreview({ filename: file.name, backup });
          } catch (cause) {
            if (token === request.current) setError(cause instanceof Error ? cause.message : 'Could not read the backup.');
          } finally { if (token === request.current) setReading(false); }
        }} />
        {reading && <p role="status">Reading and validating backup…</p>}
        {preview && <div className="space-y-3 min-w-0">
          <h3 className="font-semibold">Import preview · {preview.backup.runs.length} {preview.backup.runs.length === 1 ? 'run' : 'runs'}</h3>
          <p className="text-sm break-all">{preview.filename}</p>
          <p className="text-sm">Exported: {preview.backup.exportedAt}<br />Backup v{preview.backup.backupVersion} · Planner schema v{preview.backup.plannerSchemaVersion} · {preview.backup.scope}</p>
          <ul className="max-h-48 overflow-y-auto space-y-2 rounded border p-3 text-sm" aria-label="Runs to import">
            {preview.backup.runs.map((run, index) => <li key={run.id} className="break-words [overflow-wrap:anywhere]">
              <strong>{run.name || '(Unnamed run)'}</strong> · {STARTERS.find(s => s.id === run.starterDefinitionId)?.name} · {run.history.length} actions
              {run.id === preview.backup.activeRunId && <span> · Active in backup</span>}
              {names[index] !== run.name && <p>Will be named: {names[index]}</p>}
            </li>)}
          </ul>
          <p className="text-sm">Imported runs are added as new runs. Existing runs are never overwritten. {planner.data.runs.length ? 'Your active run stays selected.' : 'The backup’s active run, or its first run, will be selected.'}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => {
              if (confirmed.current) return;
              confirmed.current = true;
              if (planner.importBackup(preview.backup)) {
                setSuccess(`${preview.backup.runs.length} ${preview.backup.runs.length === 1 ? 'run imported' : 'runs imported'}.${names.some((name, index) => name !== preview.backup.runs[index].name) ? ' Conflicting names received an Imported suffix.' : ''}`);
                clearPreview();
              } else { confirmed.current = false; setError('Could not save imported runs to browser storage. No runs were imported. Check available storage and try again.'); }
            }}>Import {preview.backup.runs.length} {preview.backup.runs.length === 1 ? 'run' : 'runs'}</Button>
            <Button variant="outline" onClick={clearPreview}>Cancel import</Button>
          </div>
        </div>}
      </section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="text-sm">{success}</p>}
    </DialogContent>
  </Dialog>;
}
