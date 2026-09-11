import { ActionDisclosure } from '@/components/run-planner/ActionDisclosure';
import { useState } from 'react';
import { TRADE_DEFINITIONS, getTradeReceipt } from '@/data/trades';
import { previewTrade } from '@/utils/tradeProposal';
import { getDigimonById } from '@/utils/digimonLookup';
import { RunPlan, RosterDigimon } from '@/types/runPlanner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export const TradeControls = ({ run, onTrade, error, compact = false }: {
  run: RunPlan;
  onTrade: (runId: string, tradeId: string, given: RosterDigimon) => boolean;
  error: string | null;
  compact?: boolean;
}) => {
  const [tradeId, setTradeId] = useState('');
  const [reviewed, setReviewed] = useState<RosterDigimon | null>(null);
  const [confirm, setConfirm] = useState(false);
  let preview: ReturnType<typeof previewTrade> | null = null;
  let previewError: string | null = null;
  if (tradeId) {
    try { preview = previewTrade(tradeId); }
    catch (cause) { previewError = cause instanceof Error ? cause.message : 'Trade preview unavailable'; }
  }
  const eligible = preview ? run.roster.filter(p => p.speciesId === preview.trade.giveSpeciesId) : [];
  const blocked = !preview || !reviewed || !eligible.some(p => p.instanceId === reviewed.instanceId);
  const reset = () => { setTradeId(''); setReviewed(null); setConfirm(false); };
  return <ActionDisclosure title="Trading Center" id="trade-controls" active={Boolean(tradeId)} onCancel={reset} compact={compact}>
    <label className="block space-y-1 text-sm"><span>Trade</span>
      <select aria-label="Trade definition" className="block w-full rounded border bg-background p-2" value={tradeId} onChange={e => {
        setTradeId(e.target.value); setReviewed(null); setConfirm(false);
      }}><option value="">Select a trade</option>
        {TRADE_DEFINITIONS.map(t => <option key={t.id} value={t.id}>{getDigimonById(t.giveSpeciesId)?.name} → {getTradeReceipt(t.id).record.name}</option>)}
      </select>
    </label>
    {previewError && <p role="alert">{previewError}</p>}
    {preview && <>
      {preview.trade.availabilityNote && <span className="text-xs text-muted-foreground" tabIndex={0}
        title={preview.trade.availabilityNote} aria-label={`In-game timing (informational): ${preview.trade.availabilityNote}`}>In-game timing ⓘ</span>}
      <label className="block space-y-1 text-sm"><span>Give</span>
        <select aria-label="Trade given Digimon" className="block w-full rounded border bg-background p-2" value={reviewed?.instanceId ?? ''} onChange={e => {
          const given = eligible.find(p => p.instanceId === e.target.value);
          setReviewed(given ? structuredClone(given) : null); setConfirm(false);
        }}><option value="">Select the individual to give</option>
          {eligible.map(p => <option key={p.instanceId} value={p.instanceId}>{run.roster.indexOf(p) + 1}. {p.name} · EL{p.level} · DP{p.dp} · {run.digiline.includes(p.instanceId) ? 'Active' : 'Reserve'}</option>)}
        </select>
      </label>
      {!eligible.length && <p role="status">Requires {getDigimonById(preview.trade.giveSpeciesId)?.name} in current roster.</p>}
      <div className="menu-result space-y-1 text-sm">
        <p className="font-semibold">Receive: {preview.received.name}</p>
        <p>EL{preview.received.level} · DP0 · Max EL{preview.trade.fixedMaxLevel}</p>
        <p>{Object.entries(preview.received.stats).map(([stat, value]) => `${stat.toUpperCase()} ${value}`).join(' · ')}</p>
        <p>Techniques: {preview.received.techs.join(', ')}</p>
      </div>
      <Button disabled={blocked} onClick={() => setConfirm(true)}>Trade Digimon</Button>
    </>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Trade {reviewed?.name} for {preview?.received.name}?</AlertDialogTitle>
        <AlertDialogDescription>{reviewed?.name} will leave the roster and you will receive {preview?.received.name} EL{preview?.received.level}.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={blocked} onClick={e => {
        if (reviewed && preview && onTrade(run.id, tradeId, reviewed)) reset();
        else e.preventDefault();
      }}>Confirm Trade</AlertDialogAction></AlertDialogFooter>
      {error && <p role="alert">{error}</p>}
    </AlertDialogContent></AlertDialog>
  </ActionDisclosure>;
};
