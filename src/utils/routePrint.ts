/** Browser concern only. Cancelling the native dialog is a successful, read-only operation. */
export const printRoute = (print: (() => void) | undefined): string | null => {
  try {
    if (!print) throw new Error('Unavailable');
    print();
    return null;
  } catch { return 'Printing is unavailable. Try your browser’s Print command, or return to the Planner.'; }
};
