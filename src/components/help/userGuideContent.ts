import { RESULT_HELP, SEARCH_QUALITY_PRESETS, THOROUGHNESS_LABELS, THOROUGHNESS_DESCRIPTIONS, THOROUGHNESS_DETAILS, THOROUGHNESS_HELP } from '@/utils/battle/battlePresentation';

export interface GuideSection {
  id: string;
  title: string;
  open?: boolean;
  paragraphs: readonly string[];
  items?: readonly string[];
  video?: { embedUrl: string; watchUrl: string; title: string };
}

/** Display content only. No simulation, progression or policy calculation. */
export const GUIDE_SECTIONS: readonly GuideSection[] = [
  { id: 'workflows', title: 'Getting Started · Choose Your Workflow', open: true, paragraphs: [
    'Plan a speedrun route over time, or analyze a manually configured battle. Start with either workflow below.',
    'Route workflow: Run Planner → choose or create a saved run → record progression → Analyze Battle in Route History → Battle Simulation → Results.',
    'Manual workflow: Team Builder → Save Team → Battle Simulation → Results. Team Builder is not required after Analyze Battle.',
    'Tabs are ordered Run Planner, Team Builder, Battle Simulation, Results. Run Planner opens by default. The highlighted yellow tab is selected; keyboard and selected-tab semantics also identify it. Results is unavailable until a result exists. Finishing a simulation opens Results automatically.',
  ] },
  { id: 'video', title: 'Video Tutorial', open: true, paragraphs: [
    'Prefer a visual walkthrough? Watch the official video tutorial.',
  ], video: { embedUrl: 'https://www.youtube-nocookie.com/embed/2mG2kCHFp4Y', watchUrl: 'https://www.youtube.com/watch?v=2mG2kCHFp4Y', title: 'Digimon World 2 Run Planner and Battle Simulator — Video Tutorial' } },
  { id: 'planner', title: 'Run Planner · Route and History', open: true, paragraphs: [
    'Choose your starter, optionally name the route, then select Start Run. The starter joins your roster and Current Digiline. New Run creates another route; Saved runs switches the active run. Runs are saved in this browser, not synchronized to an account.',
    'Roster holds your Digimon; Current Digiline is the active battle team. Removing a Digimon from the Digiline keeps it in the roster. Review levels, level caps, stored XP, stats, techniques and accumulated Total Bits as you record progression.',
    'In Battle Selector choose Story phase, Domain, Floor and an encounter. There are 33 normal Domain variants across four story groupings, plus a separate Coliseum section with 24 battles. Selection previews the battle; recording it changes the route.',
    'Coliseum gives 0 XP, 0 Bits, no capture and no level-up opportunity from that battle. Previously stored XP remains stored.',
    'Route History records the event sequence. Review previews, participant choices and validation messages before confirming progression changes.',
  ], items: [
    'Battle: record participation, rewards and available battle choices; Planner updates XP, Bits, level progression and any chosen capture/technique outcomes under its validation rules.',
    'Digivolve: preview an eligible evolution and technique choices; confirmation updates the roster member and records the event.',
    'DNA: choose two parents, review the resulting Digimon and retained techniques; confirmation replaces the parents with the result and updates the Digiline as applicable.',
    'Trade: choose an available trade and eligible roster member, review what you receive, then confirm the roster exchange. In-game timing notes are informational; check the displayed requirements.',
  ] },
  { id: 'analyze', title: 'Analyze Battle · Historical Team', paragraphs: [
    'Analyze Battle on a recorded battle reconstructs the historical team state BEFORE that battle and opens Battle Simulation directly. The visible Planner source/breadcrumb identifies the run and selected battle; review it before starting.',
    'Simulating does not edit historical route progression or automatically write victories back to Planner. Results are analytical; record intended route changes through Planner controls. Back to Run Planner returns to the route. Switching runs or removing the source event can invalidate the imported analysis.',
  ] },
  { id: 'team', title: 'Team Builder · Manual Alternative', open: true, paragraphs: [
    'Use Team Builder without creating a Planner route. Add up to three Digimon, select a slot, use Customize Stats for HP/MP/ATK/DEF/SPD, and Select Techs for available techniques. Save Team makes the team selectable in Battle Simulation.',
    'Manual saved teams belong to the current app session; do not rely on them surviving a reload. Choose a saved Player team and either an enemy encounter or another saved team in the Simulator. Analyze Battle already supplies a historical team, so no manual rebuild is required.',
  ] },
  { id: 'simulation', title: 'Battle Simulation · Start and Cancel', open: true, paragraphs: [
    'Review Battle / Teams and Floor Specialty first. Choose Search Method and, for Optimized Action Search, Optimization Objective and Search Thoroughness. Set Accuracy Mode and RNG Policy independently, then the Search Quality / Rollout Budget (or Number of Simulations for Random). Review advanced exact stats if needed.',
    'Simulation Techniques starts with all source techniques enabled. Disable techniques per Player Digimon to restrict Random and Optimized search, or reset to the source set. Filters combine with exact stat overrides and do not change the Planner run or Team Builder team. Optimized plan counts and minimum budget use the filtered set.',
    'Select Start Simulation once the setup is valid. If it is unavailable, check team selections, exact-stat validation and the minimum screening evaluations shown for optimized search.',
    'Progress reports work completed. Cancel stops future work; Partial/Cancelled Results may retain valid observations found so far, but are not a completed search. Export availability follows the retained report. Use Back to Simulator setup to adjust the next run.',
  ] },
  { id: 'methods', title: 'Search Method and Objectives', paragraphs: [
    'Random Monte Carlo repeatedly simulates the configured battle using the current randomized action/continuation behavior. Use it to observe success and timing variation and inspect a retained replay. It does not optimize Player actions or evaluate a user-authored fixed action script.',
    'Optimized Action Search enumerates legal Player round plans at expanded states, evaluates candidate strategies, retains promising alternatives and explores future Player decisions. Complete battle executions are observed along the way; this is not exhaustive enumeration of the entire battle tree.',
    RESULT_HELP.fastest, RESULT_HELP.average, RESULT_HELP.success,
    'When a capture objective is active, Fastest Potential, Average Victory and Success Rate require a capture-qualified victory: the selected Enemy must be defeated last. One action defeating multiple Enemies uses the rightmost defeated Enemy (E3 > E2 > E1). Analyze Battle carries the recorded target automatically; manual Encounter setup offers an optional target.',
    'Fastest Potential asks which quickest winning execution was actually found. Average Victory and Success Rate select a repeatedly screened Player strategy; that selection can differ from the single fastest observation.',
  ] },
  { id: 'quality', title: 'Search Quality and Thoroughness', paragraphs: [
    'Search Quality answers “How much total work is available?” Search Thoroughness answers “How aggressively does the optimizer screen and retain strategies?” Maximum does not raise the budget.',
    'Rollout Budget is a hard ceiling on total candidate evaluations, not a target that must be consumed. Unused budget is not by itself an error: the useful frontier may be exhausted or another complete valid stage may not fit.',
    'Deep + Standard keeps the default search policy with a large ceiling. Deep + Maximum uses the same ceiling with stronger screening and retention. All thoroughness modes keep the existing round depth. Preferred schedules and beam growth adapt downward when the available budget cannot support them.',
    THOROUGHNESS_HELP,
  ], items: [
    ...SEARCH_QUALITY_PRESETS.map(([label, budget]) => `${label}: ${budget.toLocaleString('en-US')} evaluations available for optimized search, or simulations for Random.`),
    'Custom: enter your own computational ceiling.',
    ...Object.entries(THOROUGHNESS_DETAILS).map(([key, d]) => {
      const mode = key as keyof typeof THOROUGHNESS_DETAILS;
      return `${THOROUGHNESS_LABELS[mode]}: ${THOROUGHNESS_DESCRIPTIONS[mode]} Preferred screening ${d.samples.join(' → ')}; ${d.beamMultiplier === 1 ? 'existing beam' : `up to ${d.beamMultiplier}× existing beam`}; unchanged depth. ${d.restart}`;
    }),
    'Quick + Standard: rough checks. Standard quality + Standard or Thorough: everyday analysis. Deep + Thorough: stronger screening for important battles. Deep + Maximum: final route/TAS investigation when longer runtime is acceptable. These are starting points, not guarantees of improvement.',
  ] },
  { id: 'accuracy', title: 'Accuracy and RNG', paragraphs: [
    'Strategy disables ordinary Hit Rate misses. Paralysis, Invisibility and other modeled mechanics can still cause misses; Strategy does not make all mechanics deterministic.',
    'Game-accurate uses ordinary Hit Rate RNG. Accuracy is separate from Natural / TAS Luck.',
    RESULT_HELP.natural,
    'Natural search can evaluate many seeded worlds; it does not mean one fixed real-game seed. Repeating identical inputs with the same search seed is reproducible, not a fresh source of real-game randomness.',
  ] },
  { id: 'results', title: 'Reading Results · Observation vs Strategy', open: true, paragraphs: [
    RESULT_HELP.fastest, RESULT_HELP.screened,
    'Recommended Player Actions for Fastest show actual targets from the retained winning execution, including Assist recipients and Counter or Interrupt targets. Planned orders that did not execute retain their intended targets and are marked. For Average/Success they show the selected screened strategy/prefix. A prefix can end before the battle: later continuation can be path-dependent.',
    'Important: for Average/Success, Executed Battle Replay and its TAS Requirements may belong to the retained Fastest Route rather than the selected screened strategy. Do not treat that replay as proof that the selected strategy executed those exact actions.',
    'Screened strategies retain “Random target” or “Engine policy” when the recipient can vary between rollouts. Showing the actual recipient from a concrete fastest execution does not replace the intended Random target or claim that recipient is fixed across the strategy.',
    RESULT_HELP.timing,
  ], items: [
    'Main Result: Fastest Route Found, Selected Average Victory Strategy or Selected Success Rate Strategy, according to the objective. With no completed victory, no winning route is fabricated.',
    'Recommended Player Actions → TAS Requirements (when applicable) → Strategy/Search Statistics: read intended orders, route-specific RNG conditions and sample-based metrics together.',
    RESULT_HELP.candidates + ' They are not TAS branches or every explored candidate.',
    'Executed Battle Replay: one retained concrete observation. Compact action cards show round, actor, technique, actual target, Hit/Miss/Guard, frames and damage/healing/status. Expand Action details for MP, accuracy, recovery, Counter, Interrupt, support events, resource alerts and effect diagnostics.',
    'Search Details shows method, objective, quality/thoroughness, evaluations used versus budget, screening, beam, depth and stop reason. Pass/restart details matter only if fallback exploration actually occurred. Technical Details holds lower-level audit data.',
    'Random Results summarize observed samples and a retained replay (fastest timed victory, or a fewest-actions observation when complete frame timing is unavailable); there is no screened-strategy selection.',
  ] },
  { id: 'tas', title: 'TAS Luck · Supported Status Outcomes', paragraphs: [
    RESULT_HELP.tas,
    'Supported direct negative-status application against Enemy succeeds; against Player it fails. Supported natural negative-status recovery is unfavorable to Enemy and favorable to Player. Enemy Paralysis blocks its action; Player Paralysis allows action, except for the explicit Enemy conflict search below.',
    'The only explicit TAS branch search occurs when an Enemy reaches an eligible normal action while both Confused AND Paralyzed. It compares (A) Paralysis blocks the action and (B) Paralysis allows it to proceed through existing Confusion behavior. It does not branch over all battle RNG.',
    'Unsupported RNG remains Natural/current behavior. TAS Luck does not control every hit, target, initiative or damage event; ordinary Hit Rate remains governed by Accuracy Mode.',
    'TAS Requirements are actionable supported RNG conditions attached to the retained route. For Fastest they belong to that winning observation. For Average/Success they can belong to the retained fastest observation instead of the selected strategy. Not every random event is represented.',
    RESULT_HELP.conditional,
  ] },
  { id: 'advanced', title: 'Advanced Search Concepts · Samples, Beam, Depth', paragraphs: [
    'Screening schedules are candidate sample checkpoints, not rounds, attacks or the simulation count for the entire search. Candidates start with a smaller common sample set; promising candidates receive progressively more samples. Later checkpoints extend the same fair sequence.',
    RESULT_HELP.fair,
    'Beam is the number of promising alternatives retained for deeper exploration. A larger beam keeps more alternatives alive and can reduce premature pruning, but costs more work and does not always improve results.',
    'Round Depth is the number of future rounds of PLAYER DECISIONS explicitly expanded in the searched strategy prefix. With Round Depth 4, rounds 1–4 may be represented in the prefix; the battle can continue into rounds 5, 6, 7 and beyond through rollout/continuation. It is not battle duration, an attack count, a sample count or the simulation round limit.',
    'A pass/restart is another exploration attempt after the enhanced current search, when useful continuation and enough budget remain. It is neither a battle round nor a sample; Maximum uses it only as a conditional fallback.',
    'Common stop reasons mean: configured search completed; budget exhausted; too little budget for another valid stage/attempt; no further useful frontier; or cancelled. Read actual effort and stop reason together when budget remains unused.',
  ] },
  { id: 'stats', title: 'Exact Stats · Advanced', paragraphs: [
    'After Analyze Battle, expand Advanced — exact simulation stats in the imported Planner setup. Planner stats establish the baseline; exact overrides change the simulation input, not Planner history. Review baseline and overridden values and resolve validation warnings before starting. For a manual team, use Customize Stats in Team Builder instead.',
    'Current HP/MP are remaining resources; Max HP/MP are capacities. Planner does not track historical Current HP/MP, so review those simulation values explicitly. Reset stats to Planner values restores the baseline; Reset imported team restores the supplied historical copy. These controls do not rewrite saved progression.',
  ] },
  { id: 'exports', title: 'Exports · Simulation and Route', paragraphs: [
    'Export Simulation downloads a human-readable Markdown report from the frozen simulation result. It includes configuration/provenance, how to read the search, selected strategy, fastest route where available, TAS requirements, retained replay and technical information. Later setup edits do not rewrite that snapshot.',
    'Export Route in Run Planner opens a separate route document. Review the route and options for final roster, Digiline, techniques and rewards; select Print / Save as PDF using the browser print dialog. This exports route progression, not a Simulation Report.',
    'Technical note: Simulation Report JSON serialization is available programmatically; it is not a JSON download button in the current UI. Report version remains 1. Route printing is not a saved-run backup/import feature.',
    'Backup / Import in Run Planner downloads restorable JSON: Export Current Run includes only the active run; Export All Runs includes every saved run in order. Download backups explicitly to protect browser-local work. This is separate from Export Route and its readable document/PDF.',
    'Import Backup reads a local JSON file, validates it and shows a preview before you confirm. Imported runs are added as new runs and never overwrite existing runs; conflicting names receive an Imported suffix. Cancel or close the preview to leave saved runs unchanged. Your current active run stays selected; in an empty Planner, the backup’s active run (or first run) becomes active. Backup files stay on your device. There is no account or cloud synchronization and no automatic backup.',
  ] },
  { id: 'limits', title: 'Important Limitations', paragraphs: [
    'Player HP or MP depletion does not stop the offensive simulation. Recovery, revival, Guard and item actions required in-game are not inserted or counted. Inspect the resource alerts in Action details; a simulated victory and its frames do not establish that the route is executable without additional recovery.',
    'Optimized Search is bounded and uses sampled/stochastic continuations. Fastest Route Found is not proof of a global optimum or exact global minimum. More budget or thoroughness can increase coverage without improving the result; Maximum does not guarantee convergence and can legitimately finish with unused budget.',
    'Screened strategy and fastest individual observation answer different questions. Average/Success use completed fair samples. Average winning frames excludes losing samples and is not expected real-game completion time; observed success does not imply a confidence interval.',
    'Battle timing excludes external menu/order-entry overhead, so it is not a full end-to-end speedrun segment time. TAS covers only supported modeled status RNG. Exact-stat changes remain simulation-local. Review resource and unsupported-effect diagnostics when interpreting an outcome.',
  ] },
];

export const GUIDE_GLOSSARY = [
  ['Rollout / Evaluation', 'One complete candidate fair sample as counted by the optimizer. TAS internal branches are not individually counted as extra evaluations.'],
  ['Candidate', 'A Player-action alternative being evaluated.'],
  ['Player Round Plan', 'The intended legal Player orders for one round.'],
  ['Strategy / Prefix', 'A sequence of Player round plans; continuation may extend beyond its fixed decisions.'],
  ['Screened Strategy', 'A Player prefix repeatedly evaluated over a completed fair sample stage.'],
  ['Fair Sample', 'One candidate evaluation under the shared comparison schedule.'],
  ['Common RNG World', 'A shared sampled random setup used for comparable candidates; later paths can diverge.'],
  ['Beam', 'How many promising strategy alternatives are retained for deeper search.'],
  ['Round Depth', 'The number of future rounds of Player decisions explicitly expanded in the searched prefix. A battle can continue beyond this depth through rollout/continuation.'],
  ['Fastest Route Found', 'The fastest complete winning execution actually observed.'],
  ['Executed Battle Replay', 'One retained concrete battle observation, not the entire search.'],
  ['TAS Requirement', 'A supported RNG condition attached to the retained observation.'],
  ['Rollout Budget', 'The global hard maximum on candidate evaluations, not mandatory consumption.'],
  ['Search Thoroughness', 'The policy for screening precision and retention within the available budget.'],
  ['Pass / Restart', 'A conditional new exploration attempt after enhanced search; not a round or sample.'],
] as const;
