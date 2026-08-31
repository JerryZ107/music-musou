import { describe, expect, it } from "vitest";
import { BOSS_COUNT, MEGABOSS_COUNT, MINION_COUNT } from "./constants";
import { createWavePlan, spawnEnemies } from "./spawn";
import { ARENAS, inPlaza, STAGE_OBSTACLES } from "./stage";

describe("关卡布局", () => {
  it("四院尸王、广场中王、三倍杂兵，不进广场障碍", () => {
    const enemies = spawnEnemies({ n: 1 });
    const bosses = enemies.filter((e) => e.kind === "boss");
    const megabosses = enemies.filter((e) => e.kind === "megaboss");
    const minions = enemies.filter((e) => e.kind === "minion");
    expect(bosses).toHaveLength(BOSS_COUNT);
    expect(megabosses).toHaveLength(MEGABOSS_COUNT);
    expect(minions.length).toBeGreaterThanOrEqual(MINION_COUNT - 8);
    expect(minions.length).toBeLessThanOrEqual(MINION_COUNT);
    for (const b of bosses) {
      expect(ARENAS.some((a) => Math.hypot(a.x - b.x, a.y - b.y) < a.r)).toBe(true);
    }
    for (const e of minions) {
      expect(inPlaza(e.x, e.y, e.r)).toBe(false);
      for (const o of STAGE_OBSTACLES) {
        expect(Math.hypot(e.x - o.x, e.y - o.y)).toBeGreaterThan(e.r + o.r);
      }
    }
  });

  it("最后一波为 1 中王 + 2 尸王", () => {
    const waves = createWavePlan({ n: 1 });
    const final = waves[waves.length - 1]!;
    expect(final.filter((e) => e.kind === "megaboss")).toHaveLength(1);
    expect(final.filter((e) => e.kind === "boss")).toHaveLength(2);
  });
});
