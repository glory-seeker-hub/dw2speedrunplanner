# Digimon World 2 — Battle Simulation Report

Report version: 1

Search status: Completed


## Source

Manual setup

## Battle

- Enemy group: E

## Player Team

| Combatant | Max HP | Current HP | Max MP | Current MP | ATK | DEF | SPD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| P · Player Slot 1 (player-0) | 1000 | 1000 | 100 | 100 | 20 | 20 | 100 |

### P · Player Slot 1 (player-0)

- Species ID: P
- Type: Data
- Specialty: None
- Boss: No
- Available techniques: Rock Fist (6; legacy-known-technique)
- Initial ATK stage: 0
- Initial DEF stage: 0
- Initial SPD stage: 0

## Enemy Team

| Combatant | Max HP | Current HP | Max MP | Current MP | ATK | DEF | SPD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| E · Enemy Slot 1 (enemy-0) | 1000 | 10 | 100 | 100 | 20 | 20 | 40 |

### E · Enemy Slot 1 (enemy-0)

- Species ID: E
- Type: Data
- Specialty: None
- Boss: No
- Available techniques: Rock Fist (6; legacy-known-technique)
- Initial ATK stage: 0
- Initial DEF stage: 0
- Initial SPD stage: 0

## Simulation Configuration

- Search Method: Optimized Action Search
- Optimization Objective: Fastest Potential
- Accuracy Mode: Strategy
- RNG Policy: Natural
- Floor Specialty: None
- Requested evaluations / budget: 64
- Beam width: 2
- Max optimized depth: 2
- Simulator root seed: 17
- Max rounds safety limit: 1000

## Search Summary

- Evaluations: 64
- Elapsed Ms: 25
- Completed Successes: 64
- Timed Successes: 64
- Incomplete Timing Successes: 0
- Outcome Counts / Player win: 64
- Outcome Counts / Enemy win: 0
- Outcome Counts / Limit reached: 0
- Outcome Counts / Invalid: 0
- Outcome Counts / Unsupported: 0
- Runs With Resource Alerts: 0
- Root Plan Count: 1
- Candidate Count: 1
- Candidates Evaluated: 1
- Depth: 1
- Fair Stage Evaluations: 64

## Result

### Fastest complete route found

- Total frames: 685
- Rounds: 1
- Simulator seed: 2895911102
- Sample index: 0
- Source prefix identity: \["\[1,\[\\"\[\\\\\\"player-0\\\\\\",6,{\\\\\\"ap\\\\\\":20,\\\\\\"element\\\\\\":\\\\\\"None\\\\\\",\\\\\\"isCounter\\\\\\":false,\\\\\\"target\\\\\\":\\\\\\"Single\\\\\\"},{\\\\\\"kind\\\\\\":\\\\\\"combatants\\\\\\",\\\\\\"targetIds\\\\\\":\[\\\\\\"enemy-0\\\\\\"\]}\]\\"\]\]"\]

### Best screened prefix

- Rollouts in fair set: 64
- Arithmetic mean victory frames: 685
- Fastest fair-stage sample (frames): 685
- Success rate: 100%
- Divergence rate: 0%
- Victories: 64
- Complete timing victories: 64

Fair prefix orders (distinct from the global fastest observation):

### Round 1

- P · Player Slot 1 (player-0) — Rock Fist → E · Enemy Slot 1 (enemy-0)

### Top Candidates

Fair-stage rankings; the global fastest individual route is tracked separately.

| Rank / first-round orders | Rollouts | Fastest frames | Mean frames | Success | Divergence |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1. P · Player Slot 1 (player-0) — Rock Fist → E · Enemy Slot 1 (enemy-0) | 64 | 685 | 685 | 100% | 0% |

## Recommended Player Orders

- Order source: observed-route
These are intended orders. Orders can remain unexecuted if the battle ends earlier. Random/policy targets are resolved by the engine.

### Round 1

- P · Player Slot 1 (player-0) — Rock Fist → E · Enemy Slot 1 (enemy-0)

## Executed Battle

- Observation: global-fastest-observation
- Total modeled frames: 685
- Rounds: 1

### Round 1


#### 1. P · Player Slot 1 (player-0) — Rock Fist

- Action ID: s0-r1-a1
- Outcome: hit
- State: resolved
- Action frames: 685
- Actual targets: E · Enemy Slot 1 (enemy-0)
- E · Enemy Slot 1 (enemy-0): 20 damage; 0 healing; HP 10 → 0; ko.
- Base damage: 20
- Poison bonus damage: 0
- MP accounting / Before: 100
- MP accounting / Cost Charged: 8
- MP accounting / After: 92
- MP accounting / Completeness: complete
- MP accounting / Payer Combatant Id: player-0
- MP accounting / Payer Name: P
- MP accounting / Payer Side: player
- MP accounting / Payment Rule: own
- Accuracy / Outcome: hit
- Accuracy / Cause: strategy-accuracy-bypass
- Accuracy / Mode: strategy
- Accuracy / Standard Roll Skipped: true
- Accuracy / Reference Target Id: enemy-0
- Status before / Poison: false
- Status before / Paralysis: false
- Status before / Confusion: false
- Status after recovery / Poison: false
- Status after recovery / Paralysis: false
- Status after recovery / Confusion: false
- Confusion / Active: false
- Confusion / Redirected: false
- Confusion / Skipped: false
- Confusion / Planned Skill Key: waza-6
- Confusion / Selected Skill Key: waza-6
- Confusion / Original Target Intent / Kind: combatants
- Confusion / Original Target Intent / Target Ids / 1: enemy-0

#### 2. E · Enemy Slot 1 (enemy-0) — Rock Fist

- Action ID: s0-r1-a2
- Outcome: skipped
- State: skipped
- Reason: battle-ended
- Actual targets: 
- Status before / Poison: false
- Status before / Paralysis: false
- Status before / Confusion: false
- Status after recovery / Poison: false
- Status after recovery / Paralysis: false
- Status after recovery / Confusion: false

## Diagnostics

- Frame totals cover modeled battle actions. External real-game UI and order-menu overhead is not modeled.
- Beam pruning and stochastic rollouts do not exhaust the battle tree. Orders after Round 1 are path-specific, not a complete adaptive policy.
