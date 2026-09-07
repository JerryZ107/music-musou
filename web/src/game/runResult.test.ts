import { describe, expect, it } from "vitest";
import { createSim } from "./sim";
import { computeRunResult, formatStars } from "./runResult";

const THREE_STARS = "\u2605\u2605\u2605";

describe("run result scoring", () => {
  it("win with 3 stars: high HP, combo, beat hits", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: false });
    sim.run = "win";
    sim.player.hp = 5;
    sim.stats.maxCombo = 12;
    sim.stats.beatHits = 10;
    sim.stats.totalDamage = 80;
    const r = computeRunResult(sim);
    expect(r.stars).toBe(3);
    expect(r.score).toBeGreaterThan(500);
    expect(formatStars(r.stars)).toBe(THREE_STARS);
  });

  it("win with 1 star: clear only", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: false });
    sim.run = "win";
    sim.player.hp = 1;
    sim.stats.maxCombo = 2;
    sim.stats.beatHits = 1;
    const r = computeRunResult(sim);
    expect(r.stars).toBe(1);
  });

  it("loss still scores damage and combo", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: false });
    sim.run = "lose";
    sim.stats.totalDamage = 40;
    sim.stats.maxCombo = 6;
    const r = computeRunResult(sim);
    expect(r.stars).toBe(0);
    expect(r.score).toBe(40 + 6 * 15);
  });
});
