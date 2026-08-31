import {
  OBSTACLE_BARREL_HP,
  OBSTACLE_CRATE_HP,
  OBSTACLE_GRAVE_HP,
  OBSTACLE_LANTERN_HP,
  WORLD_H,
  WORLD_W,
} from "./constants";
import type { Obstacle } from "./types";

/** 中央起舞广场：开局与训练场落点。 */
export const PLAZA = { x: WORLD_W / 2, y: WORLD_H / 2, r: 8.2 };

export interface Arena {
  id: number;
  name: string;
  x: number;
  y: number;
  r: number;
  accent: number;
}

/** 四角 Boss 院落：杂兵成环围住，形成四场小割草。 */
export const ARENAS: readonly Arena[] = [
  { id: 0, name: "西北焰院", x: 22, y: 18, r: 9.5, accent: 0xff6a3c },
  { id: 1, name: "东北霜院", x: 74, y: 18, r: 9.5, accent: 0x7ec8ff },
  { id: 2, name: "西南蛊院", x: 22, y: 54, r: 9.5, accent: 0xc77dff },
  { id: 3, name: "东南金院", x: 74, y: 54, r: 9.5, accent: 0xe8c56b },
];

function pillar(
  x: number,
  y: number,
  r: number,
  kind: Obstacle["kind"],
  accent = 0xd4b36a,
): Omit<Obstacle, "id"> {
  return { x, y, r, kind, accent };
}

function destructible(
  x: number,
  y: number,
  r: number,
  kind: Extract<Obstacle["kind"], "lantern" | "crate" | "barrel" | "grave">,
  hp: number,
  accent?: number,
): Omit<Obstacle, "id"> {
  return { x, y, r, kind, accent, destructible: true, hp, maxHp: hp };
}

/**
 * 圆形体积障碍（绘制半径 = 判定半径）。
 * 十字大道可绕行，广场与院心留空。
 */
const STAGE_LAYOUT: readonly Omit<Obstacle, "id">[] = [
  pillar(36.5, 27.5, 0.72, "pillar"),
  pillar(59.5, 27.5, 0.72, "pillar"),
  pillar(36.5, 44.5, 0.72, "pillar"),
  pillar(59.5, 44.5, 0.72, "pillar"),
  pillar(48, 23.5, 0.58, "plinth"),
  pillar(48, 48.5, 0.58, "plinth"),
  pillar(33.5, 36, 0.58, "plinth"),
  pillar(62.5, 36, 0.58, "plinth"),
  destructible(29.2, 18, 0.5, "lantern", OBSTACLE_LANTERN_HP, 0xff6a3c),
  destructible(22, 25.2, 0.5, "lantern", OBSTACLE_LANTERN_HP, 0xff6a3c),
  destructible(66.8, 18, 0.5, "lantern", OBSTACLE_LANTERN_HP, 0x7ec8ff),
  destructible(74, 25.2, 0.5, "lantern", OBSTACLE_LANTERN_HP, 0x7ec8ff),
  destructible(29.2, 54, 0.5, "lantern", OBSTACLE_LANTERN_HP, 0xc77dff),
  destructible(22, 46.8, 0.5, "lantern", OBSTACLE_LANTERN_HP, 0xc77dff),
  destructible(66.8, 54, 0.5, "lantern", OBSTACLE_LANTERN_HP, 0xe8c56b),
  destructible(74, 46.8, 0.5, "lantern", OBSTACLE_LANTERN_HP, 0xe8c56b),
  // 十字大道可破坏物
  destructible(48, 31.5, 0.52, "crate", OBSTACLE_CRATE_HP),
  destructible(48, 40.5, 0.52, "crate", OBSTACLE_CRATE_HP),
  destructible(42, 36, 0.48, "barrel", OBSTACLE_BARREL_HP),
  destructible(54, 36, 0.48, "barrel", OBSTACLE_BARREL_HP),
  destructible(40, 32.5, 0.55, "grave", OBSTACLE_GRAVE_HP),
  destructible(56, 39.5, 0.55, "grave", OBSTACLE_GRAVE_HP),
  // 四院门口补给箱
  destructible(18, 14, 0.5, "crate", OBSTACLE_CRATE_HP),
  destructible(78, 14, 0.5, "crate", OBSTACLE_CRATE_HP),
  destructible(18, 58, 0.5, "barrel", OBSTACLE_BARREL_HP),
  destructible(78, 58, 0.5, "barrel", OBSTACLE_BARREL_HP),
  // 广场边缘
  destructible(PLAZA.x - 5.5, PLAZA.y + 5.8, 0.5, "crate", OBSTACLE_CRATE_HP),
  destructible(PLAZA.x + 5.5, PLAZA.y - 5.8, 0.5, "crate", OBSTACLE_CRATE_HP),
  destructible(PLAZA.x - 7.2, PLAZA.y - 2.2, 0.52, "grave", OBSTACLE_GRAVE_HP),
  destructible(PLAZA.x + 7.2, PLAZA.y + 2.2, 0.52, "grave", OBSTACLE_GRAVE_HP),
];

/** 静态布局（spawn 避让用）。 */
export const STAGE_OBSTACLES: readonly Obstacle[] = STAGE_LAYOUT.map((o, i) => ({
  ...o,
  id: i + 1,
}));

export function createStageObstacles(nextId: { n: number }): Obstacle[] {
  return STAGE_LAYOUT.map((o) => ({ ...o, id: nextId.n++ }));
}

export function liveObstacles(obstacles: readonly Obstacle[]): Obstacle[] {
  return obstacles.filter((o) => !o.destructible || (o.hp ?? 0) > 0);
}

export function inPlaza(x: number, y: number, extra = 0): boolean {
  return Math.hypot(x - PLAZA.x, y - PLAZA.y) < PLAZA.r + extra;
}
