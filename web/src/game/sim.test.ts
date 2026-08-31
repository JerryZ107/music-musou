import { describe, expect, it } from "vitest";
import { ACTION_COOLDOWN_MS, MINION_HP, MINION_RADIUS, SLIDE_DURATION_MS, ULTIMATE_BEAT_CHARGES } from "./constants";
import { createSim, doAttack, doSlide, doUltimate, reviveRun, stepSim } from "./sim";

describe("战斗模拟", () => {
  it("普通攻击两刀杀杂兵，卡拍一刀", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: true });
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

  it("Beat-On Hit 一刀杀杂兵并充能", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: true });
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

  it("没碰到身体不掉血", () => {
    const sim = createSim({ trackId: 1, weaponId: 2, allowedWeapons: [2], tutorial: true });
    sim.run = "playing";
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 1.05,
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

  it("身体重合才掉血", () => {
    const sim = createSim({ trackId: 1, weaponId: 2, allowedWeapons: [2], tutorial: true });
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
    stepSim(sim, 16, 0, 0);
    expect(sim.player.hp).toBe(hp - 1);
  });

  it("挥空不充能", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: true });
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

  it("全角色普攻与滑步共用 0.34 秒冷却", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: true });
    sim.nowMs = 0;
    expect(doAttack(sim, false)).toBe(true);
    expect(doSlide(sim, false, 1, 0)).toBe(false);
    sim.nowMs = ACTION_COOLDOWN_MS + 1;
    expect(doSlide(sim, false, 1, 0)).toBe(true);
  });

  it("卡拍无视 CD 可出手", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: true });
    sim.nowMs = 0;
    expect(doAttack(sim, false)).toBe(true);
    sim.nowMs = 100;
    expect(doAttack(sim, true)).toBe(true);
    sim.nowMs = 150;
    expect(doSlide(sim, true, 1, 0)).toBe(true);
  });

  it("非卡拍仍受 CD 约束", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: true });
    sim.nowMs = 0;
    expect(doAttack(sim, false)).toBe(true);
    expect(doAttack(sim, false)).toBe(false);
    expect(doSlide(sim, true, 1, 0)).toBe(true);
    expect(doSlide(sim, false, 0, 1)).toBe(false);
  });

  it("滑步中不能普攻", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: true });
    sim.nowMs = 0;
    expect(doSlide(sim, false, 1, 0)).toBe(true);
    expect(doAttack(sim, false)).toBe(false);
    sim.nowMs = SLIDE_DURATION_MS - 1;
    expect(doAttack(sim, false)).toBe(false);
    sim.nowMs = SLIDE_DURATION_MS + ACTION_COOLDOWN_MS + 1;
    expect(doAttack(sim, false)).toBe(true);
  });

  it("武士开局有护盾并每 2 秒回复", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: true });
    expect(sim.shieldHp).toBe(1);
    sim.shieldHp = 0;
    sim.lastShieldTickMs = 0;
    sim.nowMs = 2000;
    stepSim(sim, 0, 0, 0);
    expect(sim.shieldHp).toBe(1);
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
    stepSim(sim, 16, 0, 0);
    expect(sim.player.hp).toBe(hp);
    expect(sim.shieldHp).toBe(0);
  });

  it("武士大招强化卡拍滑步造成 3 伤", () => {
    const sim = createSim({ trackId: 1, weaponId: 1, allowedWeapons: [1], tutorial: true });
    sim.run = "playing";
    sim.energy = ULTIMATE_BEAT_CHARGES;
    sim.enemies = [
      {
        id: 1,
        kind: "minion",
        x: sim.player.x + 2,
        y: sim.player.y,
        r: MINION_RADIUS,
        hp: MINION_HP,
        maxHp: MINION_HP,
      },
    ];
    expect(doUltimate(sim)).toBe(true);
    expect(sim.samuraiSlideCharges).toBe(1);
    sim.lastSlideMs = -9999;
    expect(doSlide(sim, true, 1, 0)).toBe(true);
    expect(sim.samuraiSlideCharges).toBe(0);
    expect(sim.enemies).toHaveLength(0);
  });

  it("尸王突刺命中扣 2 血", () => {
    const sim = createSim({ trackId: 1, weaponId: 2, allowedWeapons: [2], tutorial: true });
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
      lungeHit: false,
    };
    sim.enemies = [boss];
    sim.nowMs = 600;
    const hp = sim.player.hp;
    stepSim(sim, 16, 0, 0);
    expect(sim.player.hp).toBe(hp - 2);
    expect(boss.lungeHit).toBe(true);
  });

  it("看广告复活回到 playing 并消耗次数", () => {
    const sim = createSim({ trackId: 1, weaponId: 2, allowedWeapons: [2], tutorial: true });
    sim.run = "lose";
    sim.player.hp = 0;
    expect(reviveRun(sim)).toBe(true);
    expect(sim.run).toBe("playing");
    expect(sim.player.hp).toBe(1);
    expect(sim.reviveAvailable).toBe(false);
    expect(reviveRun(sim)).toBe(false);
  });

  it("怪物追击距离最近的主角或分身", () => {
    const sim = createSim({ trackId: 1, weaponId: 3, allowedWeapons: [3], tutorial: true });
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
});
