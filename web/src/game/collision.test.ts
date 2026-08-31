import { describe, expect, it } from "vitest";
import { ATTACK_RANGE, MINION_RADIUS, PLAYER_RADIUS } from "./constants";
import {
  attackArcHits,
  attackCircleHits,
  attackLineHits,
  attackSemicircleHits,
  circlesOverlap,
} from "./collision";

describe("圆形体积碰撞", () => {
  const player = { x: 10, y: 10, r: PLAYER_RADIUS };
  const attackR = ATTACK_RANGE;

  it("攻击圆与怪物圆相交则命中", () => {
    const enemy = { x: 10 + attackR + MINION_RADIUS - 0.05, y: 10, r: MINION_RADIUS };
    expect(attackCircleHits(player, attackR, enemy)).toBe(true);
  });

  it("两圆分离则不命中（不再用格子角点）", () => {
    const enemy = { x: 10 + attackR + MINION_RADIUS + 0.05, y: 10, r: MINION_RADIUS };
    expect(attackCircleHits(player, attackR, enemy)).toBe(false);
  });

  it("对角方向按圆心距离，不吃方块角", () => {
    const reach = attackR + MINION_RADIUS;
    const d = reach + 0.08;
    const enemy = { x: 10 + d / Math.SQRT2, y: 10 + d / Math.SQRT2, r: MINION_RADIUS };
    expect(attackCircleHits(player, attackR, enemy)).toBe(false);
  });

  it("半圆：朝向反侧的身体打不中", () => {
    const enemy = { x: 9.0, y: 10, r: MINION_RADIUS };
    expect(attackSemicircleHits(player, attackR, 1, 0, enemy)).toBe(false);
    expect(attackCircleHits(player, attackR, enemy)).toBe(true);
  });

  it("半圆：身体探进前半球可命中", () => {
    const enemy = { x: 10.6, y: 10, r: MINION_RADIUS };
    expect(attackSemicircleHits(player, attackR, 1, 0, enemy)).toBe(true);
  });

  it("45° 扇形：侧后方打不中", () => {
    const enemy = { x: 8.5, y: 10, r: MINION_RADIUS };
    expect(attackArcHits(player, attackR, 1, 0, enemy, 45)).toBe(false);
  });

  it("45° 扇形：正前方可命中", () => {
    const enemy = { x: 10 + attackR * 0.5, y: 10, r: MINION_RADIUS };
    expect(attackArcHits(player, attackR, 1, 0, enemy, 45)).toBe(true);
  });

  it("90° 扇形：侧前方可命中", () => {
    const enemy = { x: 10 + attackR * 0.4, y: 10 + attackR * 0.35, r: MINION_RADIUS };
    expect(attackArcHits(player, attackR, 1, 0, enemy, 90)).toBe(true);
  });

  it("直线戳击：朝向延长线上可命中", () => {
    const enemy = { x: 10 + attackR * 0.8, y: 10, r: MINION_RADIUS };
    expect(attackLineHits(player, attackR, 1, 0, enemy)).toBe(true);
  });

  it("直线戳击：偏离戳击线打不中", () => {
    const enemy = { x: 10 + attackR * 0.8, y: 10 + 1.2, r: MINION_RADIUS };
    expect(attackLineHits(player, attackR, 1, 0, enemy)).toBe(false);
  });

  it("接触伤害：半径相加", () => {
    const minion = { x: 10 + PLAYER_RADIUS + MINION_RADIUS - 0.01, y: 10, r: MINION_RADIUS };
    expect(circlesOverlap(player, minion)).toBe(true);
    const far = { x: 10 + PLAYER_RADIUS + MINION_RADIUS + 0.05, y: 10, r: MINION_RADIUS };
    expect(circlesOverlap(player, far)).toBe(false);
  });

  it("接触没有额外攻击圈：隔开一格碰到身体才算", () => {
    const gap = { x: 11, y: 10, r: MINION_RADIUS };
    expect(circlesOverlap(player, gap)).toBe(false);
  });
});
