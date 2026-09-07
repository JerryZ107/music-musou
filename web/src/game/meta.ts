import type { HeroId, LevelId, TrackId } from "./types";

/** 角色基础模板（资料片数值）。 */
export const STAT_TEMPLATE = {
  attackSpeed: 14,
  dashRange: 10,
  attackRange: 10,
} as const;

export const HERO_PRICES: Record<HeroId, number> = {
  1: 20,
  2: 0,
  3: 10,
};

export const LEVEL1_FIRST_CLEAR_GOLD = 10;
export const LEVEL2_FIRST_CLEAR_GOLD = 20;
export const LEVEL1_REPEAT_GOLD = 1;
export const LEVEL2_REPEAT_GOLD = 2;

/** @deprecated 使用 LEVEL1_FIRST_CLEAR_GOLD */
export const LEVEL1_GOLD_REWARD = LEVEL1_FIRST_CLEAR_GOLD;
/** @deprecated 使用 LEVEL2_FIRST_CLEAR_GOLD */
export const LEVEL2_GOLD_REWARD = LEVEL2_FIRST_CLEAR_GOLD;

export const DEFAULT_UNLOCKED_LEVELS: LevelId[] = [1];
export const DEFAULT_UNLOCKED_TRACKS: TrackId[] = [1];
export const DEFAULT_UNLOCKED_HEROES: HeroId[] = [2];

/** 战前整备页武将展示顺序：枪客 → 弓使 → 武士 */
export const HERO_SELECT_ORDER: HeroId[] = [2, 3, 1];

export function wavePlanIncludesFinalBoss(levelId: LevelId): boolean {
  return levelId >= 2;
}

export interface WinRewards {
  goldEarned: number;
  trackUnlocked: TrackId | null;
  levelUnlocked: LevelId | null;
  shopUnlocked: boolean;
  promptShop: boolean;
}

export function computeWinRewards(
  levelId: LevelId,
  level1Cleared: boolean,
  level2Cleared: boolean,
): WinRewards {
  if (levelId === 1) {
    const firstClear = !level1Cleared;
    return {
      goldEarned: firstClear ? LEVEL1_FIRST_CLEAR_GOLD : LEVEL1_REPEAT_GOLD,
      trackUnlocked: firstClear ? 2 : null,
      levelUnlocked: firstClear ? 2 : null,
      shopUnlocked: firstClear,
      promptShop: firstClear,
    };
  }
  if (levelId === 2) {
    const firstClear = !level2Cleared;
    return {
      goldEarned: firstClear ? LEVEL2_FIRST_CLEAR_GOLD : LEVEL2_REPEAT_GOLD,
      trackUnlocked: firstClear ? 3 : null,
      levelUnlocked: null,
      shopUnlocked: false,
      promptShop: false,
    };
  }
  return {
    goldEarned: 0,
    trackUnlocked: null,
    levelUnlocked: null,
    shopUnlocked: false,
    promptShop: false,
  };
}
