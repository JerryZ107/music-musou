import {
  BOSS_COUNT,
  BOSS_HP,
  MEGABOSS_COUNT,
  MEGABOSS_HP,
  MINION_COUNT,
  MINION_HP,
  PLAYER_RADIUS,
} from "./constants";
import { dist2 } from "./collision";
import { ARENAS, inPlaza, PLAZA, STAGE_OBSTACLES } from "./stage";
import { radiusForKind, type Enemy } from "./types";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blocked(x: number, y: number, r: number, others: Enemy[]): boolean {
  if (inPlaza(x, y, r + PLAYER_RADIUS + 0.4)) return true;
  for (const o of STAGE_OBSTACLES) {
    if (Math.hypot(x - o.x, y - o.y) <= r + o.r + 0.08) return true;
  }
  for (const e of others) {
    const need = r + e.r + 0.35;
    if (dist2(x, y, e.x, e.y) < need * need) return true;
  }
  return false;
}

export function spawnEnemies(nextId: { n: number }, seed = 42): Enemy[] {
  const rng = mulberry32(seed);
  const enemies: Enemy[] = [];
  const bossR = radiusForKind("boss");
  const megabossR = radiusForKind("megaboss");
  const minionR = radiusForKind("minion");

  for (let i = 0; i < BOSS_COUNT; i++) {
    const a = ARENAS[i]!;
    enemies.push({
      id: nextId.n++,
      kind: "boss",
      x: a.x,
      y: a.y,
      r: bossR,
      hp: BOSS_HP,
      maxHp: BOSS_HP,
    });
  }

  for (let i = 0; i < MEGABOSS_COUNT; i++) {
    enemies.push({
      id: nextId.n++,
      kind: "megaboss",
      x: PLAZA.x,
      y: PLAZA.y - 4.5,
      r: megabossR,
      hp: MEGABOSS_HP,
      maxHp: MEGABOSS_HP,
    });
  }

  for (let i = 0; i < MINION_COUNT; i++) {
    const arena = ARENAS[i % ARENAS.length]!;
    let placed = false;
    for (let attempt = 0; attempt < 4000; attempt++) {
      const ang = rng() * Math.PI * 2;
      const dist = 3.2 + rng() * Math.max(1.2, arena.r - 2.4);
      const x = arena.x + Math.cos(ang) * dist;
      const y = arena.y + Math.sin(ang) * dist;
      if (blocked(x, y, minionR, enemies)) continue;
      enemies.push({
        id: nextId.n++,
        kind: "minion",
        x,
        y,
        r: minionR,
        hp: MINION_HP,
        maxHp: MINION_HP,
      });
      placed = true;
      break;
    }
    if (!placed) {
      for (let attempt = 0; attempt < 2000; attempt++) {
        const a = ARENAS[(i + attempt) % ARENAS.length]!;
        const ang = rng() * Math.PI * 2;
        const dist = a.r * (0.35 + rng() * 0.5);
        const x = a.x + Math.cos(ang) * dist;
        const y = a.y + Math.sin(ang) * dist;
        if (blocked(x, y, minionR, enemies)) continue;
        enemies.push({
          id: nextId.n++,
          kind: "minion",
          x,
          y,
          r: minionR,
          hp: MINION_HP,
          maxHp: MINION_HP,
        });
        break;
      }
    }
  }
  return enemies;
}


export interface ArenaWaveSpec {
  arenaIndex: number;
  minions: number;
  withBoss: boolean;
  seed: number;
}

function spawnRing(
  nextId: { n: number },
  cx: number,
  cy: number,
  rMin: number,
  rMax: number,
  count: number,
  rng: () => number,
  others: Enemy[],
): Enemy[] {
  const out: Enemy[] = [];
  const minionR = radiusForKind("minion");
  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 800; attempt++) {
      const ang = rng() * Math.PI * 2;
      const dist = rMin + rng() * (rMax - rMin);
      const x = cx + Math.cos(ang) * dist;
      const y = cy + Math.sin(ang) * dist;
      if (blocked(x, y, minionR, others)) continue;
      others.push({ id: nextId.n++, kind: "minion", x, y, r: minionR, hp: MINION_HP, maxHp: MINION_HP });
      out.push(others[others.length - 1]!);
      placed = true;
      break;
    }
    if (!placed) {
      // 保底：贴到 arena 内圈，避免卡住生成。
      const a = ARENAS[i % ARENAS.length]!;
      const ang = rng() * Math.PI * 2;
      const x = a.x + Math.cos(ang) * (rMin + 0.6);
      const y = a.y + Math.sin(ang) * (rMin + 0.6);
      others.push({ id: nextId.n++, kind: "minion", x, y, r: minionR, hp: MINION_HP, maxHp: MINION_HP });
      out.push(others[others.length - 1]!);
    }
  }
  return out;
}

/** 一关按波次推进：四院怪物同出，清完后再出中央决战波。 */
export function createWavePlan(
  nextId: { n: number },
  opts?: { includeFinalBoss?: boolean },
  seed = 42,
): Enemy[][] {
  const rng = mulberry32(seed);
  const waves: Enemy[][] = [];
  const specs: ArenaWaveSpec[] = [
    { arenaIndex: 0, minions: 22, withBoss: true, seed: 101 + (rng() * 0.1) },
    { arenaIndex: 1, minions: 24, withBoss: true, seed: 202 },
    { arenaIndex: 2, minions: 28, withBoss: true, seed: 303 },
    { arenaIndex: 3, minions: 32, withBoss: true, seed: 404 },
  ];
  const courtyardWave: Enemy[] = [];
  for (const spec of specs) {
    const arena = ARENAS[spec.arenaIndex]!;
    if (spec.withBoss) {
      courtyardWave.push({
        id: nextId.n++,
        kind: "boss",
        x: arena.x,
        y: arena.y,
        r: radiusForKind("boss"),
        hp: BOSS_HP,
        maxHp: BOSS_HP,
      });
    }
    spawnRing(
      nextId,
      arena.x,
      arena.y,
      2.8,
      Math.max(3.2, arena.r - 1.4),
      spec.minions,
      mulberry32(spec.seed),
      courtyardWave,
    );
    // 在院落外圈再挂一圈，从院门进场。
    spawnRing(
      nextId,
      arena.x,
      arena.y,
      arena.r + 1.2,
      arena.r + 2.6,
      Math.max(3, Math.floor(spec.minions / 3)),
      mulberry32(spec.seed + 7),
      courtyardWave,
    );
  }
  waves.push(courtyardWave);
  if (opts?.includeFinalBoss !== false) {
    // 中央广场：1 王中王 + 2 尸王 + 大群杂兵从外圈压入。
    const finalWave: Enemy[] = [
      {
        id: nextId.n++,
        kind: "megaboss",
        x: PLAZA.x,
        y: PLAZA.y - 4.5,
        r: radiusForKind("megaboss"),
        hp: MEGABOSS_HP,
        maxHp: MEGABOSS_HP,
      },
    ];
    for (let i = 0; i < 2; i++) {
      const ang = Math.PI * 0.25 + (i / 2) * Math.PI;
      finalWave.push({
        id: nextId.n++,
        kind: "boss",
        x: PLAZA.x + Math.cos(ang) * 5.2,
        y: PLAZA.y + Math.sin(ang) * 4.2,
        r: radiusForKind("boss"),
        hp: BOSS_HP,
        maxHp: BOSS_HP,
      });
    }
    spawnRing(nextId, PLAZA.x, PLAZA.y, PLAZA.r + 1.2, PLAZA.r + 3.8, 38, mulberry32(505), finalWave);
    waves.push(finalWave);
  }
  return waves;
}