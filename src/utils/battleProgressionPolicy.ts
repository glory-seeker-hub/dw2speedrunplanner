import { getColiseumBattle } from '@/data/coliseumBattles';
import { getResolvedReward } from '@/utils/rewardMatching';

export interface BattleProgressionPolicy { category: 'normal' | 'coliseum'; resolveLevelUp: boolean; allowCapture: boolean }
const normal: BattleProgressionPolicy = { category: 'normal', resolveLevelUp: true, allowCapture: true };
const coliseum: BattleProgressionPolicy = { category: 'coliseum', resolveLevelUp: false, allowCapture: false };
export const getBattleProgressionPolicy = (encounterId: number | null): BattleProgressionPolicy => getColiseumBattle(encounterId) ? coliseum : normal;
export const getPlannerBattleReward = (encounterId: number) => getBattleProgressionPolicy(encounterId).category === 'coliseum'
  ? { xp: 0, bits: 0 } : getResolvedReward(encounterId);
