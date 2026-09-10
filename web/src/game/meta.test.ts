import { describe, expect, it } from "vitest";
import { computeWinRewards } from "./meta";
import { createWavePlan } from "./spawn";

describe("meta progression", () => {
  it("首关奖励 10 金币、解锁曲目 2 与关卡 2，并解锁商城引导招募", () => {
    const r = computeWinRewards(1, false, false);
    expect(r.goldEarned).toBe(10);
    expect(r.trackUnlocked).toBe(2);
    expect(r.levelUnlocked).toBe(2);
    expect(r.shopUnlocked).toBe(true);
    expect(r.promptShop).toBe(true);
  });

  it("首关已通关重复奖励 1 金币", () => {
    const r = computeWinRewards(1, true, false);
    expect(r.goldEarned).toBe(1);
    expect(r.trackUnlocked).toBeNull();
    expect(r.levelUnlocked).toBeNull();
    expect(r.shopUnlocked).toBe(false);
    expect(r.promptShop).toBe(false);
  });

  it("第二关首通奖励 20 金币并解锁曲目 3", () => {
    const r = computeWinRewards(2, true, false);
    expect(r.goldEarned).toBe(20);
    expect(r.trackUnlocked).toBe(3);
    expect(r.levelUnlocked).toBeNull();
  });

  it("第二关已通关重复奖励 2 金币", () => {
    const r = computeWinRewards(2, true, true);
    expect(r.goldEarned).toBe(2);
    expect(r.trackUnlocked).toBeNull();
  });
});

describe("createWavePlan", () => {
  it("第一关：四院同出，不含中央尸王波", () => {
    const waves = createWavePlan({ n: 1 }, { includeFinalBoss: false });
    expect(waves).toHaveLength(1);
    expect(waves[0]?.filter((e) => e.kind === "boss")).toHaveLength(4);
    expect(waves.every((w) => !w.some((e) => e.kind === "megaboss"))).toBe(true);
  });

  it("第二关：四院同出后再出尸王决战", () => {
    const waves = createWavePlan({ n: 1 }, { includeFinalBoss: true });
    expect(waves).toHaveLength(2);
    expect(waves[0]?.filter((e) => e.kind === "boss")).toHaveLength(4);
    expect(waves[1]?.some((e) => e.kind === "megaboss")).toBe(true);
  });
});
