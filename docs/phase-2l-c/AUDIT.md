# Phase 2L-C pre-edit audit

Baseline verified: clean `phase-2l-c-how-to-use`, HEAD `0edbb51`, merge of L4 commit `93b49e6`. No branch creation, commit or push.

Help lives in `src/components/InfoDialog.tsx`. The header's “About this application” icon opens a Radix dialog with How to Use (default), Battle Mechanics and Credits tabs. The dialog has a 2xl maximum width, 80vh height and vertical scrolling. The three-tab row currently does not explicitly wrap long labels on narrow screens.

How to Use has three static headings: Build Your Team, Run Battle Simulations, Analyze Results. Reusable facts: up to three manual Digimon, editable stats/techniques, saved-team and encounter selection, floor specialty, running simulations and Results. Obsolete framing: manual Team Builder as mandatory first step, undifferentiated simulation count/results, complete battle history claim without retained-replay provenance.

Missing: Planner as default, multiple runs, historical Analyze Battle, progression/events/Coliseum, optimized objectives, fair screening, quality versus thoroughness, narrow TAS, exact overrides, cancellation, result hierarchy, exports, limitations and glossary. Existing Simulator helper copy and `battlePresentation.RESULT_HELP` already define accuracy, RNG, observed versus screened results, timing and thoroughness. Reuse those definitions rather than copy entire guide paragraphs into controls.

Adjacent Battle Mechanics tab incorrectly says Interrupts are normal attacks and Assist/status effects are unimplemented. Replace stale presentation with a short supported-model overview and diagnostics guidance; do not change engine behavior or introduce a mechanics manual. Credits retained.

Production audit: Index defines Planner-first navigation, session-only manual teams, disabled Results without a result and direct historical Analyze routing. RunPlanner/BattleSelector/history implement saved runs, roster/Digiline, story groups and separate Coliseum; route export prints/PDF. Simulator has accuracy and RNG separately, optimized-only objectives/thoroughness, count presets and local stat drafts. Results/report presentation distinguishes concrete fastest observations from screened prefixes and retains replay provenance. Simulation export downloads Markdown from a frozen report; JSON is programmatic, not a download control.

Plan: one guide in the existing entry point, compact topic navigation, five default-open beginner sections, collapsed advanced sections, native keyboard disclosures, mobile wrapping. Extract unchanged budget presets into a shared presentation constant. Keep policy code untouched; pure schedule/beam descriptors are checked against the real resolver in tests so drift fails visibly.
