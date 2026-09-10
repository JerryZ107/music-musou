import { describe, expect, it } from "vitest";
import { ACTION_COOLDOWN_MS, SLIDE_DISTANCE } from "./constants";
import { attackRadiusFor, cooldownMsFor, heroStatPoints, slideDistanceFor } from "./heroStats";

describe("hero stat points", () => {
  it("samurai baseline is 8/15/15", () => {
    const stats = heroStatPoints(1);
    expect(stats.attackSpeed).toBe(8);
    expect(stats.dashRange).toBe(15);
    expect(stats.attackRange).toBe(15);
    expect(attackRadiusFor(1)).toBeCloseTo(attackRadiusFor(2));
    expect(attackRadiusFor(1)).toBeCloseTo((6.0 * (3 / 5)) * 1.8);
    expect(slideDistanceFor({ weaponId: 1, ultBuffUntilMs: 0, nowMs: 0 })).toBeCloseTo(SLIDE_DISTANCE * 1.5);
    expect(cooldownMsFor({ weaponId: 1, spearUltAttacksLeft: 0 })).toBe(
      Math.round(ACTION_COOLDOWN_MS * (10 / 8)),
    );
  });

  it("spear attack speed is above template", () => {
    expect(heroStatPoints(2).attackSpeed).toBe(14);
    expect(cooldownMsFor({ weaponId: 2, spearUltAttacksLeft: 0 })).toBe(
      Math.round(ACTION_COOLDOWN_MS * (10 / 14)),
    );
  });

  it("spear baseline dash is template 10", () => {
    expect(slideDistanceFor({ weaponId: 2, ultBuffUntilMs: 0, nowMs: 0 })).toBeCloseTo(SLIDE_DISTANCE);
  });

  it("samurai dash stays at 15 points without berserk", () => {
    const normal = slideDistanceFor({ weaponId: 1, ultBuffUntilMs: 0, nowMs: 0 });
    const buffed = slideDistanceFor({ weaponId: 1, ultBuffUntilMs: 1000, nowMs: 0 });
    expect(normal).toBeCloseTo(SLIDE_DISTANCE * 1.5);
    expect(buffed).toBeCloseTo(SLIDE_DISTANCE * 1.5);
  });
});
