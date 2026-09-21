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
| P · Player Slot 1 (player-0) | 1000 | 1000 | 100 | 100 | 60 | 20 | 200 |

### P · Player Slot 1 (player-0)

- Species ID: P
- Type: Data
- Specialty: None
- Boss: No
- Available techniques: E-Stun Blast (105; legacy-known-technique)
- Initial ATK stage: 0
- Initial DEF stage: 0
- Initial SPD stage: 0

## Enemy Team

| Combatant | Max HP | Current HP | Max MP | Current MP | ATK | DEF | SPD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| E · Enemy Slot 1 (enemy-0) | 100 | 100 | 100 | 100 | 20 | 20 | 5 |

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
- RNG Policy: TAS Favorable
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
- Rng Override Counts / Direct Status: 192
- Rng Override Counts / Enemy Recovery Prevented: 128
- Rng Override Counts / Player Recovery Forced: 0
- Rng Override Counts / Enemy Paralysis Miss: 128
- Rng Override Counts / Player Paralysis Pass: 0
- Root Plan Count: 1
- Candidate Count: 1
- Candidates Evaluated: 1
- Depth: 1
- Fair Stage Evaluations: 64

## Result

### Fastest complete route found

- Total frames: 2443
- Rounds: 3
- Simulator seed: 2895911102
- Sample index: 0
- Source prefix identity: \["\[1,\[\\"\[\\\\\\"player-0\\\\\\",105,{\\\\\\"ap\\\\\\":15,\\\\\\"element\\\\\\":\\\\\\"Dark\\\\\\",\\\\\\"isCounter\\\\\\":false,\\\\\\"target\\\\\\":\\\\\\"Single\\\\\\"},{\\\\\\"kind\\\\\\":\\\\\\"combatants\\\\\\",\\\\\\"targetIds\\\\\\":\[\\\\\\"enemy-0\\\\\\"\]}\]\\"\]\]"\]

### Best screened prefix

- Rollouts in fair set: 64
- Arithmetic mean victory frames: 2443
- Fastest fair-stage sample (frames): 2443
- Success rate: 100%
- Divergence rate: 0%
- Victories: 64
- Complete timing victories: 64

Fair prefix orders (distinct from the global fastest observation):

### Round 1

- P · Player Slot 1 (player-0) — E-Stun Blast → E · Enemy Slot 1 (enemy-0)

### Top Candidates

Fair-stage rankings; the global fastest individual route is tracked separately.

| Rank / first-round orders | Rollouts | Fastest frames | Mean frames | Success | Divergence |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1. P · Player Slot 1 (player-0) — E-Stun Blast → E · Enemy Slot 1 (enemy-0) | 64 | 2443 | 2443 | 100% | 0% |

## Recommended Player Orders

- Order source: observed-route
These are intended orders. Orders can remain unexecuted if the battle ends earlier. Random/policy targets are resolved by the engine.

### Round 1

- P · Player Slot 1 (player-0) — E-Stun Blast → E · Enemy Slot 1 (enemy-0)

### Round 2

- P · Player Slot 1 (player-0) — E-Stun Blast → E · Enemy Slot 1 (enemy-0)

### Round 3

- P · Player Slot 1 (player-0) — E-Stun Blast → E · Enemy Slot 1 (enemy-0)

## TAS RNG Requirements

- Round 1 · s0-r1-a1 · P · Player Slot 1 (player-0) · E-Stun Blast · E · Enemy Slot 1 (enemy-0) · execution: E: paralysis application must succeed — TAS Favorable RNG
- Round 1 · s0-r1-a2 · E · Enemy Slot 1 (enemy-0) · Rock Fist · E · Enemy Slot 1 (enemy-0) · execution: E: paralysis natural recovery must fail — TAS Favorable RNG
- Round 1 · s0-r1-a2 · E · Enemy Slot 1 (enemy-0) · Rock Fist · E · Enemy Slot 1 (enemy-0) · execution: E: paralysis action must fail — TAS Favorable RNG
- Round 2 · s0-r2-a3 · P · Player Slot 1 (player-0) · E-Stun Blast · E · Enemy Slot 1 (enemy-0) · execution: E: paralysis application must succeed — TAS Favorable RNG
- Round 2 · s0-r2-a4 · E · Enemy Slot 1 (enemy-0) · Rock Fist · E · Enemy Slot 1 (enemy-0) · execution: E: paralysis natural recovery must fail — TAS Favorable RNG
- Round 2 · s0-r2-a4 · E · Enemy Slot 1 (enemy-0) · Rock Fist · E · Enemy Slot 1 (enemy-0) · execution: E: paralysis action must fail — TAS Favorable RNG
- Round 3 · s0-r3-a5 · P · Player Slot 1 (player-0) · E-Stun Blast · E · Enemy Slot 1 (enemy-0) · execution: E: paralysis application must succeed — TAS Favorable RNG

## Executed Battle

- Observation: global-fastest-observation
- Total modeled frames: 2443
- Rounds: 3

### Round 1


#### 1. P · Player Slot 1 (player-0) — E-Stun Blast

- Action ID: s0-r1-a1
- Outcome: hit
- State: resolved
- Action frames: 685
- Actual targets: E · Enemy Slot 1 (enemy-0)
- E · Enemy Slot 1 (enemy-0): 45 damage; 0 healing; HP 100 → 55; hit.
- Status application / 1 / Status: paralysis
- Status application / 1 / Successes Out Of3: 1
- Status application / 1 / Applied: true
- Status application / 1 / Already Active: false
- Status application / 1 / Rng Resolution / Policy: tas-favorable
- Status application / 1 / Rng Resolution / Category: direct-status-application
- Status application / 1 / Rng Resolution / Affected Side: enemy
- Status application / 1 / Rng Resolution / Outcome: apply
- Status application / 1 / Rng Resolution / Natural Probability / Numerator: 1
- Status application / 1 / Rng Resolution / Natural Probability / Denominator: 3
- Status application / 1 / Rng Resolution / Roll Skipped: true
- Base damage: 45
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
- Confusion / Planned Skill Key: waza-105
- Confusion / Selected Skill Key: waza-105
- Confusion / Original Target Intent / Kind: combatants
- Confusion / Original Target Intent / Target Ids / 1: enemy-0

#### 2. E · Enemy Slot 1 (enemy-0) — Rock Fist

- Action ID: s0-r1-a2
- Outcome: miss
- State: resolved
- Action frames: 194
- Actual targets: P · Player Slot 1 (player-0)
- MP accounting / Before: 100
- MP accounting / After: 100
- MP accounting / Cost Charged: 0
- MP accounting / Completeness: complete
- MP accounting / Payment Rule: none-on-miss
- Accuracy / Outcome: miss
- Accuracy / Cause: paralysis
- Accuracy / Rng Resolution / Policy: tas-favorable
- Accuracy / Rng Resolution / Category: paralysis-failure
- Accuracy / Rng Resolution / Affected Side: enemy
- Accuracy / Rng Resolution / Outcome: miss
- Accuracy / Rng Resolution / Natural Probability / Numerator: 1
- Accuracy / Rng Resolution / Natural Probability / Denominator: 2
- Accuracy / Rng Resolution / Roll Skipped: true
- Status before / Poison: false
- Status before / Paralysis: true
- Status before / Confusion: false
- Status after recovery / Poison: false
- Status after recovery / Paralysis: true
- Status after recovery / Confusion: false
- Status recovery / 1 / Status: paralysis
- Status recovery / 1 / Recovered: false
- Status recovery / 1 / Rng Resolution / Policy: tas-favorable
- Status recovery / 1 / Rng Resolution / Category: natural-status-recovery
- Status recovery / 1 / Rng Resolution / Affected Side: enemy
- Status recovery / 1 / Rng Resolution / Outcome: remain
- Status recovery / 1 / Rng Resolution / Natural Probability / Numerator: 3
- Status recovery / 1 / Rng Resolution / Natural Probability / Denominator: 4
- Status recovery / 1 / Rng Resolution / Roll Skipped: true
- Confusion / Active: false
- Confusion / Redirected: false
- Confusion / Skipped: false
- Confusion / Planned Skill Key: waza-6
- Confusion / Selected Skill Key: waza-6
- Confusion / Original Target Intent / Kind: opponents
- Confusion / Original Target Intent / Side: player
- Confusion / Original Target Intent / Selection: random-at-execution

### Round 2


#### 3. P · Player Slot 1 (player-0) — E-Stun Blast

- Action ID: s0-r2-a3
- Outcome: hit
- State: resolved
- Action frames: 685
- Actual targets: E · Enemy Slot 1 (enemy-0)
- E · Enemy Slot 1 (enemy-0): 45 damage; 0 healing; HP 55 → 10; hit.
- Status application / 1 / Status: paralysis
- Status application / 1 / Successes Out Of3: 1
- Status application / 1 / Applied: true
- Status application / 1 / Already Active: true
- Status application / 1 / Rng Resolution / Policy: tas-favorable
- Status application / 1 / Rng Resolution / Category: direct-status-application
- Status application / 1 / Rng Resolution / Affected Side: enemy
- Status application / 1 / Rng Resolution / Outcome: apply
- Status application / 1 / Rng Resolution / Natural Probability / Numerator: 1
- Status application / 1 / Rng Resolution / Natural Probability / Denominator: 3
- Status application / 1 / Rng Resolution / Roll Skipped: true
- Base damage: 45
- Poison bonus damage: 0
- MP accounting / Before: 92
- MP accounting / Cost Charged: 8
- MP accounting / After: 84
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
- Confusion / Planned Skill Key: waza-105
- Confusion / Selected Skill Key: waza-105
- Confusion / Original Target Intent / Kind: opponents
- Confusion / Original Target Intent / Side: enemy
- Confusion / Original Target Intent / Selection: random-at-execution

#### 4. E · Enemy Slot 1 (enemy-0) — Rock Fist

- Action ID: s0-r2-a4
- Outcome: miss
- State: resolved
- Action frames: 194
- Actual targets: P · Player Slot 1 (player-0)
- MP accounting / Before: 100
- MP accounting / After: 100
- MP accounting / Cost Charged: 0
- MP accounting / Completeness: complete
- MP accounting / Payment Rule: none-on-miss
- Accuracy / Outcome: miss
- Accuracy / Cause: paralysis
- Accuracy / Rng Resolution / Policy: tas-favorable
- Accuracy / Rng Resolution / Category: paralysis-failure
- Accuracy / Rng Resolution / Affected Side: enemy
- Accuracy / Rng Resolution / Outcome: miss
- Accuracy / Rng Resolution / Natural Probability / Numerator: 1
- Accuracy / Rng Resolution / Natural Probability / Denominator: 2
- Accuracy / Rng Resolution / Roll Skipped: true
- Status before / Poison: false
- Status before / Paralysis: true
- Status before / Confusion: false
- Status after recovery / Poison: false
- Status after recovery / Paralysis: true
- Status after recovery / Confusion: false
- Status recovery / 1 / Status: paralysis
- Status recovery / 1 / Recovered: false
- Status recovery / 1 / Rng Resolution / Policy: tas-favorable
- Status recovery / 1 / Rng Resolution / Category: natural-status-recovery
- Status recovery / 1 / Rng Resolution / Affected Side: enemy
- Status recovery / 1 / Rng Resolution / Outcome: remain
- Status recovery / 1 / Rng Resolution / Natural Probability / Numerator: 3
- Status recovery / 1 / Rng Resolution / Natural Probability / Denominator: 4
- Status recovery / 1 / Rng Resolution / Roll Skipped: true
- Confusion / Active: false
- Confusion / Redirected: false
- Confusion / Skipped: false
- Confusion / Planned Skill Key: waza-6
- Confusion / Selected Skill Key: waza-6
- Confusion / Original Target Intent / Kind: opponents
- Confusion / Original Target Intent / Side: player
- Confusion / Original Target Intent / Selection: random-at-execution

### Round 3


#### 5. P · Player Slot 1 (player-0) — E-Stun Blast

- Action ID: s0-r3-a5
- Outcome: hit
- State: resolved
- Action frames: 685
- Actual targets: E · Enemy Slot 1 (enemy-0)
- E · Enemy Slot 1 (enemy-0): 45 damage; 0 healing; HP 10 → 0; ko.
- Status application / 1 / Status: paralysis
- Status application / 1 / Successes Out Of3: 1
- Status application / 1 / Applied: true
- Status application / 1 / Already Active: true
- Status application / 1 / Rng Resolution / Policy: tas-favorable
- Status application / 1 / Rng Resolution / Category: direct-status-application
- Status application / 1 / Rng Resolution / Affected Side: enemy
- Status application / 1 / Rng Resolution / Outcome: apply
- Status application / 1 / Rng Resolution / Natural Probability / Numerator: 1
- Status application / 1 / Rng Resolution / Natural Probability / Denominator: 3
- Status application / 1 / Rng Resolution / Roll Skipped: true
- Base damage: 45
- Poison bonus damage: 0
- MP accounting / Before: 84
- MP accounting / Cost Charged: 8
- MP accounting / After: 76
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
- Confusion / Planned Skill Key: waza-105
- Confusion / Selected Skill Key: waza-105
- Confusion / Original Target Intent / Kind: opponents
- Confusion / Original Target Intent / Side: enemy
- Confusion / Original Target Intent / Selection: random-at-execution

#### 6. E · Enemy Slot 1 (enemy-0) — Rock Fist

- Action ID: s0-r3-a6
- Outcome: skipped
- State: skipped
- Reason: battle-ended
- Actual targets: 
- Status before / Poison: false
- Status before / Paralysis: true
- Status before / Confusion: false
- Status after recovery / Poison: false
- Status after recovery / Paralysis: true
- Status after recovery / Confusion: false

## Diagnostics

- Frame totals cover modeled battle actions. External real-game UI and order-menu overhead is not modeled.
- Remaining budget cannot fairly screen another complete decision state.
- Statistics are conditional on TAS Favorable policy, not natural probabilities. Simulator seeds are not game RNG seeds or manipulation inputs.
- Beam pruning and stochastic rollouts do not exhaust the battle tree. Orders after Round 1 are path-specific, not a complete adaptive policy.
