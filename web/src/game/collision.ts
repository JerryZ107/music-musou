import type { Circle } from "./types";

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function hypot(dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}

export function normalize(
  dx: number,
  dy: number,
  fallback: { x: number; y: number } = { x: 1, y: 0 },
): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (d < 1e-8) return fallback;
  return { x: dx / d, y: dy / d };
}

/** 两圆相交（含相切）。 */
export function circlesOverlap(a: Circle, b: Circle, extra = 0): boolean {
  const r = a.r + b.r + extra;
  return dist2(a.x, a.y, b.x, b.y) <= r * r;
}

/** 接触伤害：只有两具身体（Hit Volume）重合，没有 extra 攻击圈。 */
export function bodiesOverlap(a: Circle, b: Circle): boolean {
  return circlesOverlap(a, b, 0);
}

/** 把圆从障碍里挤出。 */
export function pushOut(x: number, y: number, r: number, blocks: readonly Circle[]): { x: number; y: number } {
  for (const o of blocks) {
    const dx = x - o.x;
    const dy = y - o.y;
    const d = Math.hypot(dx, dy);
    const need = r + o.r;
    if (d >= need) continue;
    if (d < 1e-8) {
      x += need;
      continue;
    }
    const k = need / d;
    x = o.x + dx * k;
    y = o.y + dy * k;
  }
  return { x, y };
}

/** 全圆 Attack Volume vs 目标 Hit Volume。 */
export function attackCircleHits(origin: Circle, attackRadius: number, target: Circle): boolean {
  return circlesOverlap({ x: origin.x, y: origin.y, r: attackRadius }, target);
}

/**
 * 半圆：先做圆∩圆，再要求目标不是整颗落在朝向反侧。
 * 半平面容差 = 目标半径，身体探进前半球就算打中。
 */
export function attackSemicircleHits(
  origin: Circle,
  attackRadius: number,
  facingX: number,
  facingY: number,
  target: Circle,
): boolean {
  return attackArcHits(origin, attackRadius, facingX, facingY, target, 180);
}

/**
 * 扇形：圆∩圆后，目标中心落在朝向 ±arcDeg/2 内（含目标半径容差）。
 */
export function attackArcHits(
  origin: Circle,
  attackRadius: number,
  facingX: number,
  facingY: number,
  target: Circle,
  arcDeg: number,
): boolean {
  if (!attackCircleHits(origin, attackRadius, target)) return false;
  const f = normalize(facingX, facingY, { x: 1, y: 0 });
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-8) return true;
  const dot = ((dx / dist) * f.x + (dy / dist) * f.y);
  const halfArc = (arcDeg * Math.PI) / 180 / 2;
  const edgeSlop = Math.asin(Math.min(1, target.r / dist));
  return dot >= Math.cos(halfArc + edgeSlop);
}

/** 直线戳击：沿朝向的线段 [0, length]，厚度 = 目标半径。 */
export function attackLineHits(
  origin: Circle,
  length: number,
  facingX: number,
  facingY: number,
  target: Circle,
): boolean {
  const f = normalize(facingX, facingY, { x: 1, y: 0 });
  const vx = target.x - origin.x;
  const vy = target.y - origin.y;
  const t = vx * f.x + vy * f.y;
  if (t < -target.r || t > length + target.r) return false;
  const clamped = Math.max(0, Math.min(length, t));
  const px = origin.x + f.x * clamped;
  const py = origin.y + f.y * clamped;
  return Math.hypot(target.x - px, target.y - py) <= target.r;
}

/** 弹体圆 vs Hit Volume。 */
export function projectileHits(proj: Circle, target: Circle): boolean {
  return circlesOverlap(proj, target);
}

export function samplePath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  step: number,
): { x: number; y: number }[] {
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d < 1e-6) return [{ x: x0, y: y0 }];
  const n = Math.max(2, Math.ceil(d / step) + 1);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
  }
  return out;
}
