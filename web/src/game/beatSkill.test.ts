import { describe, expect, it } from "vitest";
import { assignBeatSkillTiers, beatSkillTierAt } from "./beatSkill";
import {
  ARCHER_ICE_SLOW_FACTOR,
  ARCHER_LIGHTNING_DAMAGE,
  ARCHER_LIGHTNING_STUN_MS,
  ARCHER_SHOCK_WAVE_DAMAGE,
  ARCHER_SPECIAL_ARROW_COUNT,
  ARCHER_SPECIAL_ARROW_RADIUS,
  MINION_HP,
  MINION_RADIUS,
  SAMURAI_ORBIT_SWORD_DURATION_MS,
  SAMURAI_ORBIT_SWORD_RADIUS,
  SAMURAI_SKILL_LIGHT_RANGE_MULT,
  SAMURAI_SWORD_WAVE_COUNT,
  SAMURAI_SWORD_WAVE_DAMAGE,
  SAMURAI_SWORD_WAVE_RANGE,
  SAMURAI_SWORD_WAVE_WIDTH,
  TEMPLATE3_EXPLOSION_DAMAGE,
} from "./constants";
import { attackRadiusFor, bulletRangeFor } from "./heroStats";
import { createSim, doAttack, doUltimate, stepSim } from "./sim";

describe("beatSkill tiers", () => {
  it("分配长度与种子可复现", () => {
    const a = assignBeatSkillTiers(20, 1);
    const b = assignBeatSkillTiers(20, 1);
    expect(a).toEqual(b);
    expect(a).toHaveLength(20);
    expect(a.some((t) => t === "light")).toBe(true);
    expect(a.some((t) => t === "mid")).toBe(true);
    expect(a.some((t) => t === "heavy")).toBe(true);
  });

  it("按 slot key 取分档", () => {
    const tiers = ["light", "mid", "heavy"] as const;
    expect(beatSkillTierAt(tiers, "0:1")).toBe("mid");
    expect(beatSkillTierAt(tiers, "2:0")).toBe("light");
  });
});

describe("武士节拍技能", () => {
  it("轻节拍：圆形近战范围减半且带星屑", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.run = "playing";
    doAttack(sim, true, "light");
    expect(sim.flash?.radius).toBeCloseTo(attackRadiusFor(1) * SAMURAI_SKILL_LIGHT_RANGE_MULT);
    expect(sim.flash?.sparkle).toBe(true);
    expect(sim.flash?.kind).toBe("circle");
    expect(sim.bullets.filter((b) => b.style === "swordWave")).toHaveLength(0);
  });

  it("中节拍：发射 3 段剑气（命中即消）", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.run = "playing";
    doAttack(sim, true, "mid");
    const waves = sim.bullets.filter((b) => b.style === "swordWave");
    expect(waves).toHaveLength(SAMURAI_SWORD_WAVE_COUNT);
    expect(waves[0]?.maxRange).toBe(SAMURAI_SWORD_WAVE_RANGE);
    expect(waves[0]?.damage).toBe(SAMURAI_SWORD_WAVE_DAMAGE);
    expect(waves[0]?.r).toBeCloseTo(SAMURAI_SWORD_WAVE_WIDTH / 2);
    expect(waves[0]?.pierce).toBeFalsy();
  });

  it("重节拍：生成可叠加飞剑", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.run = "playing";
    // 避免空场 maybeWin 直接胜利导致第二次攻击被拒
    sim.enemies = [
      {
        id: 99,
        kind: "minion",
        x: sim.player.x + 20,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: 99,
        maxHp: 99,
      },
    ];
    doAttack(sim, true, "heavy");
    expect(sim.orbitSwords).toHaveLength(1);
    expect(sim.orbitSwords[0]?.orbitR).toBe(SAMURAI_ORBIT_SWORD_RADIUS);
    expect(sim.orbitSwords[0]?.untilMs).toBe(sim.nowMs + SAMURAI_ORBIT_SWORD_DURATION_MS);
    sim.lastAttackMs = -9999;
    doAttack(sim, true, "heavy");
    expect(sim.orbitSwords).toHaveLength(2);
  });

  it("剑气命中敌人后消失", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.run = "playing";
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 4,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
      {
        id: 2,
        kind: "minion",
        x: sim.player.x + 30,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: 99,
        maxHp: 99,
      },
    ];
    sim.player.facingX = 1;
    sim.player.facingY = 0;
    doAttack(sim, true, "mid");
    const before = sim.bullets.filter((b) => b.style === "swordWave").length;
    expect(before).toBe(SAMURAI_SWORD_WAVE_COUNT);
    for (let i = 0; i < 40; i++) stepSim(sim, 50, 0, 0);
    const front = sim.enemies.find((e) => e.id === 1);
    expect(front).toBeUndefined();
    expect(sim.bullets.filter((b) => b.style === "swordWave")).toHaveLength(0);
  });
});

describe("弓使节拍技能", () => {
  it("绿节拍：爆裂箭 3 发散射且体积×2", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 3, tutorial: true });
    sim.run = "playing";
    doAttack(sim, true, "light");
    const arrows = sim.bullets.filter((b) => !b.fromClone && b.explosive);
    expect(arrows).toHaveLength(ARCHER_SPECIAL_ARROW_COUNT);
    expect(arrows.every((b) => b.r === ARCHER_SPECIAL_ARROW_RADIUS)).toBe(true);
    expect(arrows[0]?.style).toBe("normal");
  });

  it("黄节拍：寒冰箭 3 发散射，扩散伤并减速", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 3, tutorial: true });
    sim.run = "playing";
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 3,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: 20,
        maxHp: 20,
      },
    ];
    doAttack(sim, true, "mid");
    const arrows = sim.bullets.filter((b) => b.style === "iceArrow");
    expect(arrows).toHaveLength(ARCHER_SPECIAL_ARROW_COUNT);
    expect(arrows.every((b) => b.explosive && b.r === ARCHER_SPECIAL_ARROW_RADIUS)).toBe(true);
    for (let i = 0; i < 40; i++) stepSim(sim, 40, 0, 0);
    const foe = sim.enemies[0];
    expect(foe).toBeTruthy();
    // 三发散可能多发命中，至少结算一次扩散伤
    expect(foe!.hp).toBeLessThanOrEqual(20 - TEMPLATE3_EXPLOSION_DAMAGE);
    expect(foe!.slowFactor).toBe(ARCHER_ICE_SLOW_FACTOR);
    expect((foe!.slowUntilMs ?? 0)).toBeGreaterThan(sim.nowMs);
  });

  it("粉节拍：制作分身", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 3, tutorial: true });
    sim.run = "playing";
    sim.enemies = [
      { id: 1, kind: "minion", x: 20, y: 0, r: MINION_RADIUS, hp: 99, maxHp: 99 },
    ];
    expect(sim.clones).toHaveLength(0);
    doAttack(sim, true, "heavy");
    expect(sim.clones).toHaveLength(1);
    expect(sim.bullets).toHaveLength(0);
    expect(sim.energy).toBe(1);
  });

  it("黄剑气 / 寒冰卡拍命中可充能，雷电大招不充能", () => {
    const samurai = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    samurai.run = "playing";
    samurai.enemies = [
      {
        id: 1,
        kind: "minion",
        x: samurai.player.x + 3,
        y: samurai.player.y,
        r: MINION_RADIUS,
        hp: 20,
        maxHp: 20,
      },
    ];
    doAttack(samurai, true, "mid");
    for (let i = 0; i < 40; i++) stepSim(samurai, 40, 0, 0);
    expect(samurai.energy).toBeGreaterThanOrEqual(1);

    const archer = createSim({ levelId: 1, trackId: 1, weaponId: 3, tutorial: true });
    archer.run = "playing";
    archer.enemies = [
      {
        id: 1,
        kind: "minion",
        x: archer.player.x + 3,
        y: archer.player.y,
        r: MINION_RADIUS,
        hp: 20,
        maxHp: 20,
      },
    ];
    doAttack(archer, true, "mid");
    for (let i = 0; i < 40; i++) stepSim(archer, 40, 0, 0);
    expect(archer.energy).toBeGreaterThanOrEqual(1);

    const ult = createSim({ levelId: 1, trackId: 1, weaponId: 3, tutorial: true });
    ult.run = "playing";
    ult.energy = 10;
    ult.enemies = [
      {
        id: 1,
        kind: "minion",
        x: ult.player.x + 4,
        y: ult.player.y,
        r: MINION_RADIUS,
        hp: 40,
        maxHp: 40,
      },
    ];
    doUltimate(ult);
    for (let i = 0; i < 80; i++) {
      stepSim(ult, 16, 0, 0);
      if (!ult.bullets.some((b) => b.style === "lightningBolt")) break;
    }
    expect(ult.energy).toBe(0);
  });

  it("大招雷电箭：主箭 5 伤眩晕并外扩带电波", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 3, tutorial: true });
    sim.run = "playing";
    sim.energy = 10;
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 4,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: 40,
        maxHp: 40,
      },
      {
        id: 2,
        kind: "minion",
        x: sim.player.x + 8,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: 20,
        maxHp: 20,
      },
    ];
    expect(doUltimate(sim)).toBe(true);
    expect(sim.bullets.some((b) => b.style === "lightningBolt")).toBe(true);
    for (let i = 0; i < 80; i++) {
      stepSim(sim, 16, 0, 0);
      if (!sim.bullets.some((b) => b.style === "lightningBolt")) break;
    }
    const primary = sim.enemies.find((e) => e.id === 1);
    expect(primary).toBeTruthy();
    expect(primary!.hp).toBe(40 - ARCHER_LIGHTNING_DAMAGE);
    expect(primary!.stunUntilMs).toBe(sim.nowMs + ARCHER_LIGHTNING_STUN_MS);
    expect(sim.shockWaves).toHaveLength(1);
    expect(sim.shockWaves[0]?.maxRadius).toBeCloseTo(bulletRangeFor(3));
    for (let i = 0; i < 120; i++) stepSim(sim, 50, 0, 0);
    const side = sim.enemies.find((e) => e.id === 2);
    expect(side?.hp).toBe(20 - ARCHER_SHOCK_WAVE_DAMAGE);
  });
});
