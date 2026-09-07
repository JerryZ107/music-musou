import { describe, expect, it } from "vitest";
import { ACTION_COOLDOWN_MS, MINION_HP, MINION_RADIUS, SLIDE_DURATION_MS, ULTIMATE_BEAT_CHARGES } from "./constants";
import { HERO_ULT_DURATION_MS, SAMURAI_ULT_ONBEAT_DAMAGE_BONUS, SPEAR_ULT_ATTACK_CHARGES } from "./heroStats";
import { createSim, doAttack, doSlide, doUltimate, reviveRun, stepSim } from "./sim";

describe("????", () => {
  it("??????????????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.run = "playing";
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 1.1,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
    ];
    doAttack(sim, false);
    expect(sim.enemies[0]?.hp).toBe(1);
    expect(sim.energy).toBe(0);
    sim.lastAttackMs = -9999;
    doAttack(sim, false);
    expect(sim.enemies).toHaveLength(0);
    expect(sim.run).toBe("win");
  });

  it("Beat-On Hit ????????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.run = "playing";
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 1.1,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
    ];
    doAttack(sim, true);
    expect(sim.enemies).toHaveLength(0);
    expect(sim.energy).toBe(1);
  });

  it("????????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 2, tutorial: true });
    sim.run = "playing";
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 1.2,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
    ];
    const hp = sim.player.hp;
    stepSim(sim, 16, 0, 0);
    expect(sim.player.hp).toBe(hp);
  });

  it("???????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 2, tutorial: true });
    sim.run = "playing";
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 0.2,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
    ];
    const hp = sim.player.hp;
    const px = sim.player.x;
    stepSim(sim, 16, 0, 0);
    expect(sim.player.hp).toBe(hp - 1);
    expect(sim.player.x).toBeLessThan(px);
  });

  it("?????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.run = "playing";
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 8,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
    ];
    doAttack(sim, true);
    expect(sim.enemies).toHaveLength(1);
    expect(sim.energy).toBe(0);
  });

  it("普攻后仍可立即滑步（滑步 CD 独立）", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.nowMs = 0;
    expect(doAttack(sim, false)).toBe(true);
    expect(doSlide(sim, false, 1, 0)).toBe(true);
  });

  it("?????? CD?CD ?????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.nowMs = 0;
    expect(doAttack(sim, false)).toBe(true);
    sim.nowMs = 40;
    expect(doAttack(sim, false)).toBe(false);
    expect(doAttack(sim, true)).toBe(true);
  });

  it("??????????????????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.nowMs = 0;
    expect(doAttack(sim, true)).toBe(true);
    sim.nowMs = 50;
    expect(doSlide(sim, true, 1, 0)).toBe(true);
  });

  it("???? CD ???", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.nowMs = 0;
    expect(doAttack(sim, false)).toBe(true);
    sim.nowMs = 100;
    expect(doAttack(sim, true)).toBe(true);
    sim.nowMs = 150;
    expect(doSlide(sim, true, 1, 0)).toBe(true);
  });

  it("????? CD ??", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.nowMs = 0;
    expect(doAttack(sim, false)).toBe(true);
    expect(doAttack(sim, false)).toBe(false);
    expect(doSlide(sim, true, 1, 0)).toBe(true);
    expect(doSlide(sim, false, 0, 1)).toBe(false);
  });

  it("???????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.nowMs = 0;
    expect(doSlide(sim, false, 1, 0)).toBe(true);
    expect(doAttack(sim, false)).toBe(false);
    sim.nowMs = SLIDE_DURATION_MS - 1;
    expect(doAttack(sim, false)).toBe(false);
    sim.nowMs = SLIDE_DURATION_MS + ACTION_COOLDOWN_MS + 1;
    expect(doAttack(sim, false)).toBe(true);
  });

  it("beat hit grants samurai shield", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    expect(sim.shieldHp).toBe(0);
    sim.run = "playing";
    sim.pendingWaves = [[]];
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 0.5,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP + 2,
        maxHp: MINION_HP + 2,
      },
    ];
    doAttack(sim, true);
    expect(sim.shieldHp).toBe(1);
    sim.enemies = [
      {
        id: 2,
        kind: "minion",
        x: sim.player.x + 0.2,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
    ];
    const hp = sim.player.hp;
    stepSim(sim, 16, 0, 0);
    expect(sim.player.hp).toBe(hp);
    expect(sim.shieldHp).toBe(0);
  });

  it("samurai berserk adds on-beat damage", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 1, tutorial: true });
    sim.run = "playing";
    sim.energy = ULTIMATE_BEAT_CHARGES;
    expect(doUltimate(sim)).toBe(true);
    expect(sim.ultBuffUntilMs).toBe(HERO_ULT_DURATION_MS);
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 0.5,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: 10,
        maxHp: 10,
      },
    ];
    doAttack(sim, true);
    expect(sim.enemies[0]?.hp).toBe(10 - (2 + SAMURAI_ULT_ONBEAT_DAMAGE_BONUS));
  });

  it("spear ult grants 7 enhanced attacks without charging energy", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 2, tutorial: true });
    sim.run = "playing";
    sim.energy = ULTIMATE_BEAT_CHARGES;
    expect(doUltimate(sim)).toBe(true);
    expect(sim.spearUltAttacksLeft).toBe(SPEAR_ULT_ATTACK_CHARGES);
    expect(sim.energy).toBe(0);
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 0.5,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
    ];
    doAttack(sim, true);
    expect(sim.spearUltAttacksLeft).toBe(SPEAR_ULT_ATTACK_CHARGES - 1);
    expect(sim.energy).toBe(0);
  });

  it("???????????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 2, tutorial: true });
    sim.run = "playing";
    sim.player.x = 48;
    sim.player.y = 36;
    const minion = {
      id: 1,
      kind: "minion" as const,
      x: 45,
      y: 36,
      r: MINION_RADIUS,
      hp: MINION_HP,
      maxHp: MINION_HP,
      windupUntil: 500,
      strikeUntil: 700,
      attackKind: "lunge" as const,
      attackX: 1,
      attackY: 0,
      attackRadius: 0.72,
      lungeDist: 2.2,
      lungeTraveled: 0,
      lungeSpeed: 14,
      lungeFromX: 45,
      lungeFromY: 36,
      lungeToX: 47.2,
      lungeToY: 36,
      lungeHit: false,
    };
    sim.enemies = [minion];
    sim.nowMs = 600;
    for (let i = 0; i < 30; i++) stepSim(sim, 16, 0, 0);
    expect(Math.hypot(minion.x - minion.lungeToX!, minion.y - minion.lungeToY!)).toBeLessThan(0.12);
  });

  it("??????? 2 ?", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 2, tutorial: true });
    sim.run = "playing";
    sim.player.x = 10;
    sim.player.y = 10;
    const boss = {
      id: 1,
      kind: "boss" as const,
      x: sim.player.x + 0.5,
      y: sim.player.y,
      r: 0.78,
      hp: 24,
      maxHp: 24,
      windupUntil: 500,
      strikeUntil: 700,
      attackKind: "lunge" as const,
      attackX: -1,
      attackY: 0,
      attackRadius: 0.85,
      lungeDist: 0.6,
      lungeTraveled: 0,
      lungeSpeed: 8,
      lungeFromX: sim.player.x + 0.5,
      lungeFromY: sim.player.y,
      lungeToX: sim.player.x - 0.1,
      lungeToY: sim.player.y,
      lungeHit: false,
    };
    sim.enemies = [boss];
    sim.nowMs = 600;
    const hp = sim.player.hp;
    stepSim(sim, 16, 0, 0);
    expect(sim.player.hp).toBe(hp - 2);
    expect(boss.lungeHit).toBe(true);
  });

  it("?????? playing ?????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 2, tutorial: true });
    sim.run = "lose";
    sim.player.hp = 0;
    expect(reviveRun(sim)).toBe(true);
    expect(sim.run).toBe("playing");
    expect(sim.player.hp).toBe(3);
    expect(sim.reviveAvailable).toBe(false);
    expect(reviveRun(sim)).toBe(false);
  });

  it("??????????????", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 3, tutorial: true });
    sim.run = "playing";
    sim.player.x = 0;
    sim.player.y = 0;
    sim.clones = [
      { id: 1, x: 10, y: 0, r: 0.26, hp: 1, maxHp: 1, lastHurtMs: -9999 },
    ];
    const chaseClone = {
      id: 2,
      kind: "minion" as const,
      x: 6,
      y: 0,
      r: MINION_RADIUS,
      hp: MINION_HP,
      maxHp: MINION_HP,
    };
    sim.enemies = [chaseClone];
    const cloneX = chaseClone.x;
    stepSim(sim, 16, 0, 0);
    expect(chaseClone.x).toBeGreaterThan(cloneX);

    sim.nowMs = 0;
    sim.enemies = [
      {
        id: 3,
        kind: "minion",
        x: 4,
        y: 0,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
    ];
    const playerSideX = sim.enemies[0]!.x;
    stepSim(sim, 16, 0, 0);
    expect(sim.enemies[0]!.x).toBeLessThan(playerSideX);
  });

  it("弓使分身箭矢固定 1 伤且无爆裂", () => {
    const sim = createSim({ levelId: 1, trackId: 1, weaponId: 3, tutorial: true });
    sim.run = "playing";
    sim.clones = [{ id: 99, x: 1, y: 0, r: 0.26, hp: 1, maxHp: 1, lastHurtMs: -9999 }];
    sim.enemies = [
      { id: 1, kind: "minion", x: 8, y: 0, r: MINION_RADIUS, hp: MINION_HP, maxHp: MINION_HP },
    ];
    doAttack(sim, true);
    const playerBullet = sim.bullets.find((b) => !b.fromClone);
    const cloneBullet = sim.bullets.find((b) => b.fromClone);
    expect(playerBullet?.explosive).toBe(true);
    expect(cloneBullet?.explosive).toBe(false);
    expect(cloneBullet?.enhanced).toBe(false);
    expect(cloneBullet?.damage).toBe(1);
  });
});
