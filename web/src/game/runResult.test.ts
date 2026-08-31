import { describe, expect, it } from "vitest";
import { createSim } from "./sim";
import { computeRunResult, formatStars } from "./runResult";

describe("结算与分享", () => {
  it("胜利三星：高 HP + 连击 + 卡拍", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: false });
    sim.run = "win";
    sim.player.hp = 5;
    sim.stats.maxCombo = 12;
    sim.stats.beatHits = 10;
    sim.stats.totalDamage = 80;
    const r = computeRunResult(sim);
    expect(r.stars).toBe(3);
    expect(r.score).toBeGreaterThan(500);
    expect(formatStars(r.stars)).toBe("★★★");
  });

  it("胜利一星：仅通关", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: false });
    sim.run = "win";
    sim.player.hp = 1;
    sim.stats.maxCombo = 2;
    sim.stats.beatHits = 1;
    const r = computeRunResult(sim);
    expect(r.stars).toBe(1);
  });

  it("失败零星仍计分", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: false });
    sim.run = "lose";
    sim.stats.totalDamage = 40;
    sim.stats.maxCombo = 6;
    const r = computeRunResult(sim);
    expect(r.stars).toBe(0);
    expect(r.score).toBe(40 + 6 * 15);
  });
});
