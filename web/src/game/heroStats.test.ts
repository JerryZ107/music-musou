import { describe, expect, it } from "vitest";
import { ATTACK_RANGE, ACTION_COOLDOWN_MS, SLIDE_DISTANCE } from "./constants";
import { attackRadiusFor, cooldownMsFor, heroStatPoints, slideDistanceFor } from "./heroStats";

describe("hero stat points", () => {
  it("samurai baseline matches template 14/15/10", () => {
    const stats = heroStatPoints(1);
    expect(stats.attackSpeed).toBe(14);
    expect(stats.dashRange).toBe(15);
    expect(stats.attackRange).toBe(10);
    expect(attackRadiusFor(1)).toBeCloseTo(ATTACK_RANGE);
    expect(slideDistanceFor({ weaponId: 1, ultBuffUntilMs: 0, nowMs: 0 })).toBeCloseTo(SLIDE_DISTANCE * 1.5);
    expect(cooldownMsFor({ weaponId: 1, spearUltAttacksLeft: 0 })).toBe(
      ACTION_COOLDOWN_MS,
    );
  });

  it("spear baseline dash is template 10", () => {
    expect(slideDistanceFor({ weaponId: 2, ultBuffUntilMs: 0, nowMs: 0 })).toBeCloseTo(SLIDE_DISTANCE);
  });

  it("samurai berserk dash totals 20 stat points", () => {
    const normal = slideDistanceFor({ weaponId: 1, ultBuffUntilMs: 0, nowMs: 0 });
    const ult = slideDistanceFor({ weaponId: 1, ultBuffUntilMs: 1000, nowMs: 0 });
    expect(normal).toBeCloseTo(SLIDE_DISTANCE * 1.5);
    expect(ult).toBeCloseTo(SLIDE_DISTANCE * 2);
  });
});
