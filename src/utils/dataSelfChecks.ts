import { DOMAIN_GROUPS } from '@/data/domainGroups';
import { ENCOUNTER_REWARD_SOURCE } from '@/data/encounterRewardSource';
import {
  ATK_DEF_GROWTH_ROWS,
  GROWTH_OUTCOMES_PER_ROW,
  GROWTH_OUTCOME_PROBABILITY,
  HP_MP_GROWTH_ROWS,
  RANK_MINIMUM_EL,
  SPD_GROWTH_ROWS,
} from '@/data/statGrowthTables';
import { getGrowthProfile } from '@/data/growthProfiles';
import { encounters } from '@/data/encounters';
import {
  REWARDS_BY_ENCOUNTER_ID, REWARD_MATCHES, AMBIGUOUS_REWARD_MATCHES,
  UNMATCHED_REWARD_MATCHES, matchRewardRecord, getRewardMatchingSlots,
} from '@/utils/rewardMatching';
import { normalizeDigimonName } from '@/utils/digimonLookup';
import { VERIFIED_REWARD_MATCH_OVERRIDES, PROJECT_ONLY_ENCOUNTERS_WITHOUT_SOURCE_REWARD } from '@/data/rewardMatchOverrides';
import { applyBattleXp } from '@/utils/experience';
import {
  bracketContains,
  estimateStatGrowth,
  getRankOffset,
  rollsExpected,
} from '@/utils/statGrowth';
import { resolveBattle } from '@/utils/runProgression';
import { RosterDigimon } from '@/types/runPlanner';

/**
 * DETERMINISTIC DEVELOPER SELF-CHECKS
 *
 * Pure assertions over the static game-data layer and the planner's mechanics.
 * They never mutate anything and never depend on RNG.
 */

export interface SelfCheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const check = (
  results: SelfCheckResult[],
  name: string,
  fn: () => true | string
): void => {
  try {
    const outcome = fn();
    results.push(
      outcome === true ? { name, passed: true } : { name, passed: false, detail: outcome }
    );
  } catch (error) {
    results.push({ name, passed: false, detail: String(error) });
  }
};

const roster = (partial: Partial<RosterDigimon>): RosterDigimon => ({
  instanceId: 'test-1',
  speciesId: 'agumon',
  name: 'Agumon',
  source: { type: 'starter' },
  level: 1,
  totalXp: 0,
  dp: 0,
  levelCap: { min: 50, max: 50, resolved: 50 },
  stats: { hp: 30, mp: 20, atk: 20, def: 18, spd: 12 },
  techs: [],
  techniquePool: [],
  ...partial,
});

export const runDataSelfChecks = (): SelfCheckResult[] => {
  const results: SelfCheckResult[] = [];

  // --- Rewards -------------------------------------------------------------
  check(results, 'zero XP / zero Bits records are valid known data', () => {
    const zeros = ENCOUNTER_REWARD_SOURCE.filter((r) => r.xp === 0 && r.bits === 0);
    if (zeros.length !== 36) return `expected 36 explicit zero records, found ${zeros.length}`;
    return zeros.every((r) => typeof r.xp === 'number' && typeof r.bits === 'number')
      ? true
      : 'a zero record lost its numeric reward values';
  });

  check(results, 'reward source excludes non-encounter rows 268-273', () =>
    ENCOUNTER_REWARD_SOURCE.some((r) => r.sourceRow >= 268 && r.sourceRow <= 273)
      ? 'excluded source rows were reintroduced'
      : true
  );

  check(results, 'reward record matches its encounter by full battle data', () => {
    const record = ENCOUNTER_REWARD_SOURCE.find((r) => r.slots.length === 3);
    if (!record) return 'no multi-slot reward record available';
    const match = matchRewardRecord(record);
    if (match.status !== 'unique') return `record ${record.sourceRow} is ${match.status}`;
    const encounter = encounters.find((e) => e.id === match.encounterId);
    if (!encounter) return 'matched encounter does not exist';
    return encounter.digimons.length === record.slots.length
      ? true
      : 'matched encounter has a different enemy count';
  });

  check(results, 'rewards are never matched by coinciding XP/Bits', () => {
    const fabricated = {
      sourceRow: -1,
      sourceLabel: 'fabricated',
      slots: [{ slot: 1, name: 'NotADigimonAtAll', level: 99, xp: 0, bits: 0 }],
      xp: ENCOUNTER_REWARD_SOURCE[0].xp,
      bits: ENCOUNTER_REWARD_SOURCE[0].bits,
      rewardStatus: 'test',
      recordKind: 'test',
    };
    return matchRewardRecord(fabricated).status === 'unmatched'
      ? true
      : 'a record with no matching battle data was matched anyway';
  });

  // --- XP / level-up -------------------------------------------------------
  check(results, 'huge XP gain grants at most +1 level and keeps excess XP', () => {
    const xp = applyBattleXp(1, 0, 100000);
    if (xp.newLevel !== 2) return `expected level 2, got ${xp.newLevel}`;
    if (xp.newTotalXp !== 100000) return 'excess XP was not retained';
    return xp.xpToNextLevel === 0 ? true : 'XP-to-next should be 0 with excess XP';
  });

  check(results, 'captured Digimon receives no XP from its capture battle', () => {
    const encounterId = [...REWARDS_BY_ENCOUNTER_ID.keys()].find((id) => {
      const reward = REWARDS_BY_ENCOUNTER_ID.get(id);
      const encounter = encounters.find((e) => e.id === id);
      return Boolean(reward && reward.xp > 0 && encounter);
    });
    if (encounterId === undefined) return 'no rewarded encounter available';
    const before = roster({ level: 5, totalXp: 57 });
    const result = resolveBattle({
      encounterId,
      digilineInstanceIds: [before.instanceId],
      roster: [before],
      totalBits: 0,
      capturedEnemySlot: 1,
    });
    if (!result.capturedInstanceId) return `capture failed: ${result.captureError}`;
    const captured = result.roster.find((r) => r.instanceId === result.capturedInstanceId);
    const enemy = encounters
      .find((e) => e.id === encounterId)!
      .digimons.find((d) => d.slot === 1)!;
    if (!captured) return 'captured Digimon missing from roster';
    if (captured.level !== enemy.level) return 'captured level does not match encounter slot';
    return result.bitsAwarded === result.totalBits
      ? true
      : 'Bits were not added exactly once';
  });

  // --- HP/MP boundaries ----------------------------------------------------
  const hpMpBoundary = (fromLevel: number, expectedBracket: string) =>
    check(results, `HP/MP bracket for Lv${fromLevel} -> Lv${fromLevel + 1}`, () => {
      const row = HP_MP_GROWTH_ROWS.find(
        (r) => r.rate === 'normal' && bracketContains(r.bracket, fromLevel + 1)
      );
      if (!row) return 'no HP/MP row found';
      return row.bracket === expectedBracket
        ? true
        : `expected bracket ${expectedBracket}, got ${row.bracket}`;
    });
  hpMpBoundary(11, '12-21');
  hpMpBoundary(21, '22-31');
  hpMpBoundary(31, '32-41');

  // --- ATK/DEF rank offsets ------------------------------------------------
  const offsetCheck = (rank: string, fromLevel: number) =>
    check(results, `${rank} Lv${fromLevel} -> Lv${fromLevel + 1} gives rankOffset 1`, () => {
      const offset = getRankOffset(rank, fromLevel + 1);
      return offset === 1 ? true : `expected 1, got ${offset}`;
    });
  offsetCheck('Champion', 11);
  offsetCheck('Ultimate', 21);
  offsetCheck('Mega', 31);

  check(results, 'rank minimum EL values are Rookie 1 / Champion 11 / Ultimate 21 / Mega 31', () =>
    RANK_MINIMUM_EL.Rookie === 1 &&
    RANK_MINIMUM_EL.Champion === 11 &&
    RANK_MINIMUM_EL.Ultimate === 21 &&
    RANK_MINIMUM_EL.Mega === 31
      ? true
      : 'rank minimum EL table is wrong'
  );

  // --- SPD uses pre-level-up speed ----------------------------------------
  check(results, 'SPD growth uses the pre-level-up SPD value', () => {
    const profile = getGrowthProfile('agumon');
    if (!profile) return 'agumon growth profile missing';
    const slow = estimateStatGrowth('agumon', 'spd', 10, 15);
    const fast = estimateStatGrowth('agumon', 'spd', 10, 150);
    if (!slow.available || !fast.available) return 'SPD growth rows missing';
    if (slow.bracket === fast.bracket) return 'different SPD values selected the same bracket';
    return slow.bracket === '1-20' && fast.bracket === '>100'
      ? true
      : `unexpected brackets ${slow.bracket} / ${fast.bracket}`;
  });

  // --- Growth table structure ---------------------------------------------
  check(results, 'every growth row has exactly four 25% outcomes', () => {
    const rows = [...HP_MP_GROWTH_ROWS, ...ATK_DEF_GROWTH_ROWS, ...SPD_GROWTH_ROWS];
    const bad = rows.filter((r) => r.rolls.length !== GROWTH_OUTCOMES_PER_ROW);
    if (bad.length > 0) return `${bad.length} row(s) do not have four outcomes`;
    return GROWTH_OUTCOME_PROBABILITY === 0.25
      ? true
      : `outcome probability is ${GROWTH_OUTCOME_PROBABILITY}`;
  });

  check(results, 'expected growth equals the arithmetic mean of the four rolls', () => {
    const rows = [...HP_MP_GROWTH_ROWS, ...ATK_DEF_GROWTH_ROWS, ...SPD_GROWTH_ROWS];
    const bad = rows.filter((r) => {
      const mean = r.rolls.reduce((s, v) => s + v, 0) / r.rolls.length;
      return Math.abs(rollsExpected(r.rolls) - mean) > 1e-9;
    });
    return bad.length === 0 ? true : `${bad.length} row(s) mismatch the mean`;
  });

  // --- Domain mapping ------------------------------------------------------
  check(results, 'Domain mapping resolves 473/473 groups', () =>
    DOMAIN_GROUPS.length === 473 ? true : `found ${DOMAIN_GROUPS.length} groups`
  );

  check(results, 'exactly 17 contextual corrections and 456 strict matches', () => {
    const corrections = DOMAIN_GROUPS.filter(
      (g) => g.resolution === 'contextual-correction'
    );
    const strict = DOMAIN_GROUPS.filter((g) => g.resolution === 'csv-unique');
    return corrections.length === 17 && strict.length === 456
      ? true
      : `strict ${strict.length}, corrections ${corrections.length}`;
  });

  check(results, 'MetalKid group 186 resolves by contextual correction, not a global alias', () => {
    const group = DOMAIN_GROUPS.find((g) => g.groupId === 186);
    if (!group) return 'group 186 missing';
    if (group.resolution !== 'contextual-correction') return 'group 186 is not a correction';
    return group.encounterId === 52
      ? true
      : `group 186 points to encounter ${group.encounterId}`;
  });

  check(results, 'every domain group references an existing encounter', () => {
    const ids = new Set(encounters.map((e) => e.id));
    const bad = DOMAIN_GROUPS.filter((g) => !ids.has(g.encounterId));
    return bad.length === 0 ? true : `${bad.length} group(s) reference missing encounters`;
  });

  // Phase 1.6a: preserve all earlier checks and audit the authoritative patch.
  for (const [source, canonical] of [
    ['Centaurmon', 'Centarumon'], ['Piedmon', 'Pierrotmon'],
    ['VenomMyotismon', 'V-Myotismon'],
  ]) {
    check(results, `safe alias: ${source} -> ${canonical}`, () =>
      normalizeDigimonName(source) === normalizeDigimonName(canonical)
        ? true : 'safe alias does not resolve');
  }
  check(results, 'MetalTyrannomon remains distinct from Master Tyrannomon', () =>
    normalizeDigimonName('MetalTyrannomon') !== normalizeDigimonName('Master Tyrannomon')
      ? true : 'contextual discrepancy became a global alias');

  for (const [row, expected] of Object.entries(VERIFIED_REWARD_MATCH_OVERRIDES)) {
    check(results, `verified reward row ${row} -> encounter ${expected.encounterId}`, () => {
      const source = ENCOUNTER_REWARD_SOURCE.find((r) => r.sourceRow === Number(row));
      if (!source) return 'source record missing';
      const match = matchRewardRecord(source);
      if (match.status !== 'unique' || match.encounterId !== expected.encounterId)
        return 'verified encounter did not resolve';
      return source.xp === expected.xp && source.bits === expected.bits
        ? true : 'source XP/Bits differ from authoritative evidence';
    });
  }
  check(results, 'row 33 excludes only the exact Boot Domain artifact', () => {
    const source = ENCOUNTER_REWARD_SOURCE.find((r) => r.sourceRow === 33)!;
    const slots = getRewardMatchingSlots(source);
    if (slots.length !== 2 || slots.some((s) => s.name === 'Boot Domain'))
      return 'artifact was not excluded';
    const otherRow = { ...source, sourceRow: -33 };
    const otherZero = { ...source, slots: source.slots.map((s) =>
      s.slot === 3 ? { ...s, name: 'GAIA1' } : s) };
    return getRewardMatchingSlots(otherRow).length === source.slots.length &&
      getRewardMatchingSlots(otherZero).length === source.slots.length
      ? true : 'cleanup removed an unrelated entry';
  });
  check(results, 'row 52 does not map to encounter 189', () => {
    const match = matchRewardRecord(ENCOUNTER_REWARD_SOURCE.find((r) => r.sourceRow === 52)!);
    return match.status === 'unique' && match.encounterId !== 189 ? true : 'wrong MetalGreymon';
  });
  check(results, 'rows 164 and 171 remain distinct known zero rewards', () => {
    const first = REWARDS_BY_ENCOUNTER_ID.get(165);
    const second = REWARDS_BY_ENCOUNTER_ID.get(172);
    return first?.sourceRow === 164 && second?.sourceRow === 171 &&
      first.xp === 0 && first.bits === 0 && second.xp === 0 && second.bits === 0
      ? true : 'Coliseum rewards were merged or lost';
  });
  check(results, 'all 184 reward source records resolve to distinct encounters', () =>
    REWARD_MATCHES.length === 184 && REWARD_MATCHES.every((m) => m.status === 'unique') &&
      REWARDS_BY_ENCOUNTER_ID.size === 184 ? true : 'incomplete or duplicate reward mapping');
  check(results, 'no ambiguous reward matches remain', () =>
    AMBIGUOUS_REWARD_MATCHES.length === 0 ? true : 'ambiguous rewards remain');
  check(results, 'no unmatched reward records remain', () =>
    UNMATCHED_REWARD_MATCHES.length === 0 ? true : 'unmatched rewards remain');
  check(results, 'all Domain-referenced encounters have known rewards', () =>
    DOMAIN_GROUPS.every((g) => REWARDS_BY_ENCOUNTER_ID.has(g.encounterId))
      ? true : 'Domain reward metadata missing');
  check(results, 'exactly the eight project-only encounters remain without rewards', () => {
    const missing = encounters.filter((e) => !REWARDS_BY_ENCOUNTER_ID.has(e.id))
      .map((e) => e.id).sort((a, b) => a - b);
    return JSON.stringify(missing) === JSON.stringify(PROJECT_ONLY_ENCOUNTERS_WITHOUT_SOURCE_REWARD) &&
      missing.every((id) => !DOMAIN_GROUPS.some((g) => g.encounterId === id))
      ? true : 'unexpected missing rewards or project-only Domain references';
  });
  check(results, 'verified overrides reject changed composition', () => {
    const source = ENCOUNTER_REWARD_SOURCE.find((r) => r.sourceRow === 52)!;
    return matchRewardRecord({ ...source, slots: [{ ...source.slots[0], name: 'NotADigimonAtAll' }] }).status === 'unmatched'
      ? true : 'override accepted incompatible source data';
  });

  return results;
};

export const logDataSelfChecks = (): SelfCheckResult[] => {
  const results = runDataSelfChecks();
  if (import.meta.env.DEV) {
    const failed = results.filter((r) => !r.passed);
    console.groupCollapsed(
      `[self-checks] ${results.length - failed.length}/${results.length} passed`
    );
    results.forEach((r) =>
      r.passed
        ? console.info(`PASS ${r.name}`)
        : console.warn(`FAIL ${r.name}: ${r.detail}`)
    );
    console.groupEnd();
  }
  return results;
};
