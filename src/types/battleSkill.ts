export type EffectByte = 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33;
export type EffectFlags = Readonly<Record<EffectByte, number>>;
export interface RawWazaRecord {
  readonly row: number;
  readonly label: string | null;
  /** Exactly 68 bytes, zero-indexed here; source byte N is bytes[N - 1]. */
  readonly bytes: readonly number[];
}
export interface EffectSourceRow {
  readonly row: number;
  readonly byte: number;
  readonly mask: number;
  readonly sourceValue: string;
  readonly label: string;
}
export type ActionKind = 'attack' | 'counter' | 'interrupt' | 'assist';
export type AnimationKind = 'projectile' | 'magic' | 'physical';
export type TargetGroup = 'self' | 'one-ally' | 'all-allies' | 'one-enemy' | 'all-enemies' | 'field' | 'interrupt-target';
export type TargetMode = 'normal' | 'random-digimon' | 'all-on-counter';
export type SkillElement = 'Water' | 'Fire' | 'Nature' | 'Machine' | 'Darkness' | 'Neutral';
export type SkillRank = 'Rookie' | 'Champion' | 'Ultimate' | 'Mega';
export type Ailment = 'poison' | 'paralysis' | 'confusion' | 'motivation-down';
export type EffectCondition = 'always' | 'counter-triggered' | 'interrupt-triggered' | 'user-poisoned' | 'target-countering' | 'target-interrupting' | 'target-countering-or-interrupting' | 'user-interrupted';
export interface EffectEvidence {
  readonly byte: EffectByte;
  readonly mask: number;
  readonly sourceRow?: number;
  readonly sourceLabel?: string;
}
type EffectMeaning =
  | { kind: 'action-protection'; against: 'counter' | 'interrupt'; scope: 'skill' | 'turn'; caveat?: string }
  | { kind: 'accuracy-modifier'; modifier: 'cannot-miss' | 'increased-accuracy' | 'increased-evasion' | 'miss-unless-counter'; condition: EffectCondition; certainty: 'documented' | 'uncertain' }
  | { kind: 'initiative-modifier'; modifier: 'double-speed' | 'act-last'; subject: 'user' }
  | { kind: 'damage-modifier'; modifier: 'multiplier' | 'returned-damage'; multiplier: number; condition: EffectCondition }
  | { kind: 'consecutive-power'; displayedIncrement: number; documentedDisplayedCap: number; capMeaning: 'unresolved-total-or-bonus' }
  | { kind: 'drain'; resource: 'hp' | 'mp'; mode: 'damage' | 'dead-target-remaining-mp' | 'interrupted-tech-cost'; amount: 'unspecified' }
  | { kind: 'counter-payment'; payer: 'enemy' }
  | { kind: 'damage-rule'; rule: 'attribute-dependent-heal-or-damage' | 'half-current-hp' | 'execute-below-hp' | 'execute-after-hits' | 'additional-mp-damage'; threshold?: number; range?: readonly [number, number] }
  | { kind: 'parameter-modifier'; stats: readonly ('atk' | 'def' | 'spd')[]; direction: 'up' | 'down'; subject: 'target' | 'user'; attribute?: 'Vaccine' | 'Virus' | 'Data'; multiplier?: number; duration?: 'this-turn' }
  | { kind: 'parameter-reset'; scope: 'all' }
  | { kind: 'status-transfer' }
  | { kind: 'status-application'; status: Ailment | 'poison-body'; condition: EffectCondition; chancePercent?: number; sourceAlias?: 'stun' }
  | { kind: 'status-cure'; status: Ailment; sourceAlias?: 'stun' }
  | { kind: 'temporary-attack-power'; power: 'poison' | 'paralysis' | 'confusion' | SkillElement }
  | { kind: 'special-state'; state: 'zombie' | 'invisibility' | 'invincibility' }
  | { kind: 'recovery-restriction'; resource: 'hp' | 'status' }
  | { kind: 'recovery'; mode: 'full-heal' | 'revive-full-heal' }
  | { kind: 'interrupt-modifier'; modifier: 'cancel-action' | 'reduce-action-damage' | 'force-miss' | 'target-acts-last'; chancePercent?: number; reductionPercent?: number; excludesBosses?: boolean; condition: 'interrupt-triggered' | 'unspecified' }
  | { kind: 'target-mode-modifier'; mode: TargetMode }
  | { kind: 'unresolved'; reason: 'unknown-bit' | 'uncertain-source' | 'deprecated'; note: string };
export type SkillEffectDefinition = EffectEvidence & EffectMeaning;
export interface SkillDataIssue {
  readonly field: 'byte3' | 'byte4' | 'byte33' | 'attackPower' | 'identity';
  readonly value: number | string | null;
  readonly detail: string;
}
export interface BattleSkillDefinition {
  /** Stable identity, including the second ID byte. Never based on a display name. */
  readonly id: number;
  readonly name: string | null;
  readonly recordKind: 'technique' | 'item-or-system' | 'unresolved';
  readonly actionKind: ActionKind | null;
  readonly animationKind: AnimationKind | null;
  readonly targetGroup: TargetGroup | null;
  readonly targetModes: readonly TargetMode[];
  readonly rank: SkillRank | null;
  readonly element: SkillElement | null;
  readonly mpCost: number;
  /** Displayed units only. High-bit encodings remain unresolved, not huge positive AP. */
  readonly attackPower: number | null;
  readonly attackPowerRaw: number;
  readonly effectFlags: EffectFlags;
  readonly effects: readonly SkillEffectDefinition[];
  readonly issues: readonly SkillDataIssue[];
  readonly provenance: RawWazaRecord;
  readonly timing?: { readonly singleFrames?: number; readonly multiFrames?: number };
}
