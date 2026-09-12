# Phase 2K-E — confirmed decisions carried forward

Source: the user's Phase 2K-D implementation request. These are requirements for the next status/accuracy phase, not behavior implemented in Phase 2K-D.

1. Assists never Miss.
2. Assists never fail because of Paralysis.
3. A Digimon may remain Paralyzed after using an Assist.
4. If Paralysis persists into a later Attack or other applicable action, it may affect that later action.
5. Natural status recovery occurs at the moment of that Digimon's action in the turn.
6. Process natural recovery before the status affects the current action.
7. Common Poison has no natural recovery.
8. Poison can only be cured by explicit compatible Assist/skill effects.
9. When a damaging attack successfully applies Poison, that same hit already receives the +10 Poison damage.
10. Future hits against a Poisoned target also receive the +10 Poison damage according to the future status resolver.

No recovery, cure, Poison bonus, Paralysis roll, Confusion targeting, accuracy formula or status RNG was added in Phase 2K-D. The future action-time hook remains immediately before execution/hit resolution; round cleanup must not become a substitute recovery point.

Phase 2K-D only accepts an **already classified action-level Miss** in its timing resolver, at **194 frames**. Production battle execution still always follows the prior non-Miss damage path. Mixed multi-target hit/miss timing, one-roll vs per-target accuracy, Can't Miss, Increased Accuracy, Counter evasion and Interrupt-induced forced Miss remain unresolved for implementation. Never infer an action-level Miss from one impact's outcome.

Guard remains excluded from the strategic simulator. References to Guard/items in depletion alerts explain omitted in-game actions and add no simulated action or frame duration.
