# Phase 2P-B — Friendly Fire self-target verification

Canonical one-ally targeting includes self for Friendly Fire, verified in-game with BizHawk.

This conclusion records the user's empirical observation for canonical Friendly Fire (`0xCF`). Its self-target eligibility is confirmed, no longer unresolved. Friendly Fire may explicitly target its user or another living same-side recipient; opposing-side recipients remain excluded. The existing metadata-driven targeting implementation needs no change.

The observation directly validates Friendly Fire only. Other techniques share generic `one-ally` behavior, which remains unchanged; this does not establish that every such technique was individually tested in-game.

## Counter interaction

A damaging Friendly Fire hit on an eligible waiting allied Counter still promotes that Counter. A self-causal hit presented to the promotion hook follows the same eligibility checks and, if eligible, selects a living opponent using `counter-friendly-trigger-target` rather than retaliating against itself.

The hook regression deliberately constructs a waiting Counter and a separate self-causal impact. This is not a claim that a normal round permits two simultaneous orders for one actor. The simulator allows one normal action per actor and marks the actor as having acted before promotion. Self-damage therefore does not grant an additional Counter action. The full simulation regression verifies a waiting Counter replaced by Confusion with Friendly Fire: it can hit itself, retains `confusion-replacement`, and does not trigger a second action.

Regressions in `tests/phase2pbTargeting.test.cjs` cover explicit self/ally targets for both sides, exclusion of opposing recipients, Player enumeration including self and all living allies, self-causal promotion eligibility, and the Confusion replacement path.
