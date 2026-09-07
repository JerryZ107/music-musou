import {
  BASIC_ATTACK_DAMAGE,
  BOSS_ATTACK_CD_MS,
  BOSS_ATTACK_RADIUS,
  BOSS_DANMAKU_COUNT,
  BOSS_DANMAKU_SPREAD_DEG,
  BOSS_LUNGE_ATTACK_RANGE,
  BOSS_LUNGE_CD_MS,
  BOSS_LUNGE_DAMAGE,
  BOSS_LUNGE_TELEGRAPH_RADIUS,
  BOSS_RANGED_ATTACK_RANGE,
  BOSS_STRIKE_MS,
  BOSS_WINDUP_MS,
  BULLET_RADIUS,
  CLONE_RADIUS,
  COMBO_TIMEOUT_MS,
  CONTACT_DAMAGE,
  CONTACT_IFRAME_MS,
  PLAYER_KNOCKBACK_BUMP,
  PLAYER_KNOCKBACK_DAMPING,
  PLAYER_KNOCKBACK_IMPULSE,
  ENEMY_BULLET_DAMAGE,
  ENEMY_BULLET_RADIUS,
  ENEMY_BULLET_RANGE,
  ENEMY_BULLET_SPEED,
  MEGABOSS_ATTACK_CD_MS,
  MEGABOSS_ATTACK_RADIUS,
  MEGABOSS_DANMAKU_COUNT,
  MEGABOSS_DANMAKU_RING_COUNT,
  MEGABOSS_LUNGE_ATTACK_RANGE,
  MEGABOSS_LUNGE_CD_MS,
  MEGABOSS_LUNGE_TELEGRAPH_RADIUS,
  MEGABOSS_RANGED_ATTACK_RANGE,
  MEGABOSS_STRIKE_MS,
  MEGABOSS_WINDUP_MS,
  MINION_ATTACK_CD_MS,
  MINION_LUNGE_ATTACK_RANGE,
  MINION_LUNGE_SPEED,
  MINION_SPEED,
  MINION_STRIKE_MS,
  MINION_TELEGRAPH_RADIUS,
  MINION_WINDUP_MS,
  PLAYER_HP,
  REVIVE_HP,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SAMURAI_SHIELD_MAX,
  SAMURAI_SWING_MS,
  SAMURAI_SWING_STRIKE_T,
  SAMURAI_SLIDE_SWING_MS,
  ARCHER_BODY_SCALE,
  SLIDE_COOLDOWN_MS,
  SLIDE_DURATION_MS,
  SLIDE_PATH_SAMPLE,
  SPEAR_ARC_DEG,
  SPEAR_ONBEAT_ARC_DEG,
  TEMPLATE3_BULLET_SPEED,
  TEMPLATE3_CLONE_HP,
  TEMPLATE3_DAMAGE_FACTOR,
  TEMPLATE3_EXPLOSION_DAMAGE,
  TEMPLATE3_EXPLOSION_RADIUS,
  TEMPLATE3_LOCK_RANGE,
  ULTIMATE_BEAT_CHARGES,
  ULT_FX_MS,
  WORLD_H,
  WORLD_W,
} from "./constants";
import {
  attackRadiusFor,
  bulletRangeFor,
  cooldownMsFor,
  HERO_ULT_DURATION_MS,
  samuraiUltActive,
  slideDistanceFor,
  consumeSpearUltAttack,
  spearUltActive,
  SPEAR_ULT_ATTACK_CHARGES,
  SPEAR_ULT_DAMAGE_BONUS,
  SAMURAI_ULT_ONBEAT_DAMAGE_BONUS,
} from "./heroStats";
import {
  attackArcHits,
  attackCircleHits,
  attackLineHits,
  bodiesOverlap,
  normalize,
  projectileHits,
  pushOut,
  samplePath,
} from "./collision";
import { createWavePlan } from "./spawn";
import { wavePlanIncludesFinalBoss } from "./meta";
import { createStageObstacles, liveObstacles } from "./stage";
import { emptyRunStats } from "./runResult";
import type { AttackFlash, Clone, Enemy, EnemyKind, LevelId, Obstacle, Player, Sim, TrackId, WeaponId } from "./types";

export function playerRadius(weapon: WeaponId): number {
  return weapon === 3 ? PLAYER_RADIUS * ARCHER_BODY_SCALE : PLAYER_RADIUS;
}

export function attackRadius(weapon: WeaponId, _ultBuff = false): number {
  return attackRadiusFor(weapon);
}

export function attackDamage(
  sim: Sim,
  weapon: WeaponId,
  onBeat: boolean,
  thrust = false,
): number {
  let dmg = BASIC_ATTACK_DAMAGE * (onBeat ? 2 : 1);
  if (weapon === 2 && thrust) dmg += SPEAR_ULT_DAMAGE_BONUS;
  if (weapon === 1 && onBeat && samuraiUltActive(sim)) dmg += SAMURAI_ULT_ONBEAT_DAMAGE_BONUS;
  return dmg;
}

export function actionCooldown(sim: Sim): number {
  return cooldownMsFor(sim);
}

function canPerformAttack(sim: Sim, onBeat = false): boolean {
  if (onBeat) return true;
  return sim.nowMs - sim.lastAttackMs >= actionCooldown(sim);
}

function canPerformSlide(sim: Sim, onBeat = false): boolean {
  if (onBeat) return true;
  return sim.nowMs - sim.lastSlideMs >= SLIDE_COOLDOWN_MS;
}

function isSliding(sim: Sim): boolean {
  return sim.nowMs < sim.slideUntil;
}

function clampBody(sim: Sim, x: number, y: number, r: number): { x: number; y: number } {
  const blocks = liveObstacles(sim.obstacles);
  const p = pushOut(x, y, r, blocks);
  return pushOut(
    Math.max(r, Math.min(WORLD_W - r, p.x)),
    Math.max(r, Math.min(WORLD_H - r, p.y)),
    r,
    blocks,
  );
}

export function createSim(opts: {
  levelId: LevelId;
  trackId: TrackId;
  weaponId: WeaponId;
  tutorial: boolean;
}): Sim {
  const spawnX = WORLD_W / 2;
  const spawnY = WORLD_H / 2;
  const nextId = { n: 1 };
  const plan = opts.tutorial
    ? []
    : createWavePlan(nextId, { includeFinalBoss: wavePlanIncludesFinalBoss(opts.levelId) });
  const pendingWaves = opts.tutorial ? [] : plan.slice(1);
  const enemies = opts.tutorial ? [] : (plan[0] ?? []);
  const player: Player = {
    x: spawnX,
    y: spawnY,
    r: playerRadius(opts.weaponId),
    hp: PLAYER_HP,
    maxHp: PLAYER_HP,
    facingX: 1,
    facingY: 0,
  };
  const sim: Sim = {
    nowMs: 0,
    run: opts.tutorial ? "tutorial" : "playing",
    trackId: opts.trackId,
    levelId: opts.levelId,
    weaponId: opts.weaponId,
    player,
    enemies,
    pendingWaves,
    wave: opts.tutorial ? 0 : enemies.length ? 1 : 0,
    waveTotal: opts.tutorial ? 0 : plan.length,
    bullets: [],
    clones: [],
    obstacles: createStageObstacles(nextId),
    propBreaks: [],
    ultFxUntilMs: 0,
    energy: 0,
    lastAttackMs: -9999,
    lastSlideMs: -9999,
    lastHurtMs: -9999,
    slideUntil: 0,
    slideFromX: spawnX,
    slideFromY: spawnY,
    slideToX: spawnX,
    slideToY: spawnY,
    ultBuffUntilMs: 0,
    spearUltAttacksLeft: 0,
    spearAtkSpeedStacks: 0,
    shieldHp: 0,
    explosions: [],
    flash: null,
    nextId: nextId.n,
    spawnX,
    spawnY,
    shake: 0,
    stats: emptyRunStats(),
    damagePopups: [],
    reviveAvailable: true,
    knockVX: 0,
    knockVY: 0,
  };
  return sim;
}

function grantSamuraiShieldOnBeat(sim: Sim, onBeat: boolean, hitCount: number): void {
  if (sim.weaponId !== 1 || !onBeat || hitCount <= 0) return;
  sim.shieldHp = Math.min(SAMURAI_SHIELD_MAX, Math.max(sim.shieldHp, 1));
}

function meleeFlashTiming(sim: Sim, totalMs: number): { startMs: number; untilMs: number } {
  const now = sim.nowMs;
  if (sim.weaponId !== 1) {
    return { startMs: now, untilMs: now + totalMs };
  }
  const strikeT = SAMURAI_SWING_STRIKE_T;
  return {
    startMs: now - strikeT * totalMs,
    untilMs: now + (1 - strikeT) * totalMs,
  };
}

function setMeleeFlash(sim: Sim, flash: Omit<AttackFlash, "startMs" | "untilMs"> & { totalMs: number }): void {
  const { totalMs, ...rest } = flash;
  const timing = meleeFlashTiming(sim, totalMs);
  sim.flash = { ...rest, ...timing };
}

function allocId(sim: Sim): number {
  return sim.nextId++;
}

export function samuraiShieldActive(sim: Sim): boolean {
  return sim.weaponId === 1 && sim.shieldHp > 0;
}

export { ultBuffActive } from "./heroStats";

function addEnergy(sim: Sim, n: number): void {
  if (n <= 0) return;
  sim.energy = Math.min(ULTIMATE_BEAT_CHARGES, sim.energy + n);
}

function maybeWin(sim: Sim): void {
  if (sim.run === "playing" && sim.enemies.length === 0 && sim.pendingWaves.length === 0) {
    sim.run = "win";
  }
}

function lockNearest(
  ox: number,
  oy: number,
  enemies: Enemy[],
  fx: number,
  fy: number,
): { x: number; y: number } {
  let best: Enemy | null = null;
  let bestD = TEMPLATE3_LOCK_RANGE + 1;
  for (const e of enemies) {
    const d = Math.hypot(e.x - ox, e.y - oy);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (!best) return normalize(fx, fy);
  return normalize(best.x - ox, best.y - oy, { x: fx, y: fy });
}

function spearArcDeg(onBeat: boolean): number {
  return onBeat ? SPEAR_ONBEAT_ARC_DEG : SPEAR_ARC_DEG;
}

function enemiesHitByShape(
  sim: Sim,
  x: number,
  y: number,
  radius: number,
  facingX: number,
  facingY: number,
  onBeat = false,
): Enemy[] {
  const origin = { x, y, r: 0 };
  if (sim.weaponId === 2) {
    if (spearUltActive(sim)) {
      if (onBeat) {
        const arc = SPEAR_ONBEAT_ARC_DEG * 1.25;
        return sim.enemies.filter((e) => attackArcHits(origin, radius, facingX, facingY, e, arc));
      }
      return sim.enemies.filter((e) => attackLineHits(origin, radius, facingX, facingY, e));
    }
    const arc = spearArcDeg(onBeat);
    return sim.enemies.filter((e) => attackArcHits(origin, radius, facingX, facingY, e, arc));
  }
  return sim.enemies.filter((e) => attackCircleHits(origin, radius, e));
}

function meleeFlashKind(sim: Sim, onBeat = false): AttackFlash["kind"] {
  if (sim.weaponId === 2) {
    if (spearUltActive(sim) && !onBeat) return "line";
    return "arc";
  }
  return "circle";
}

function spawnDamagePopup(sim: Sim, x: number, y: number, amount: number, crit: boolean): void {
  sim.damagePopups.push({
    id: allocId(sim),
    x,
    y,
    amount,
    crit,
    untilMs: sim.nowMs + 420,
  });
}

function registerHit(sim: Sim, x: number, y: number, dmg: number, onBeat: boolean, fromClone: boolean): void {
  sim.stats.totalDamage += dmg;
  spawnDamagePopup(sim, x, y - 0.35, dmg, onBeat);
  if (fromClone) return;
  sim.stats.combo += 1;
  sim.stats.maxCombo = Math.max(sim.stats.maxCombo, sim.stats.combo);
  sim.stats.comboUntilMs = sim.nowMs + COMBO_TIMEOUT_MS;
  if (onBeat) sim.stats.beatHits += 1;
}

function stepRunStats(sim: Sim): void {
  if (sim.stats.combo > 0 && sim.nowMs > sim.stats.comboUntilMs) {
    sim.stats.combo = 0;
  }
  sim.damagePopups = sim.damagePopups.filter((p) => p.untilMs > sim.nowMs);
}

function resetRunStats(sim: Sim): void {
  sim.stats = emptyRunStats();
  sim.damagePopups = [];
}

function applyHits(sim: Sim, hits: Enemy[], dmg: number, onBeat: boolean, fromClone: boolean): number {
  let beatHits = 0;
  const hitSet = new Set(hits.map((e) => e.id));
  for (const e of sim.enemies) {
    if (!hitSet.has(e.id)) continue;
    e.hp -= dmg;
    registerHit(sim, e.x, e.y, dmg, onBeat, fromClone);
    if (onBeat && !fromClone) beatHits += 1;
  }
  sim.enemies = sim.enemies.filter((e) => e.hp > 0);
  maybeWin(sim);
  grantSamuraiShieldOnBeat(sim, onBeat, beatHits);
  return beatHits;
}

function breakObstacle(sim: Sim, o: Obstacle): void {
  if (!o.destructible || (o.hp ?? 0) > 0) return;
  sim.propBreaks.push({ untilMs: sim.nowMs + 340, x: o.x, y: o.y, kind: o.kind });
  sim.shake = Math.max(sim.shake, 3.5);
}

function damageObstacle(sim: Sim, o: Obstacle, amount: number): void {
  if (!o.destructible || (o.hp ?? 0) <= 0) return;
  o.hp = Math.max(0, (o.hp ?? 0) - amount);
  if (o.hp <= 0) breakObstacle(sim, o);
}

function damageObstaclesInCircle(sim: Sim, x: number, y: number, radius: number, amount: number): void {
  const origin = { x, y, r: 0 };
  for (const o of sim.obstacles) {
    if (!o.destructible || (o.hp ?? 0) <= 0) continue;
    if (attackCircleHits(origin, radius, o)) damageObstacle(sim, o, amount);
  }
}

function spawnEnemyBullet(sim: Sim, x: number, y: number, ux: number, uy: number): void {
  const dir = normalize(ux, uy);
  sim.bullets.push({
    id: allocId(sim),
    team: "enemy",
    x,
    y,
    r: ENEMY_BULLET_RADIUS,
    ox: x,
    oy: y,
    ux: dir.x,
    uy: dir.y,
    traveled: 0,
    maxRange: ENEMY_BULLET_RANGE,
    damage: ENEMY_BULLET_DAMAGE,
    explosive: false,
    enhanced: false,
    fromClone: false,
    hitIds: new Set(),
    active: true,
  });
}

function fireBossDanmaku(sim: Sim, e: Enemy, ringBurst: boolean): void {
  const target = nearestChaseTarget(sim, e);
  const base = Math.atan2(target.y - e.y, target.x - e.x);
  if (ringBurst) {
    const n = MEGABOSS_DANMAKU_RING_COUNT;
    for (let i = 0; i < n; i++) {
      const ang = base + (i / n) * Math.PI * 2;
      spawnEnemyBullet(sim, e.x, e.y, Math.cos(ang), Math.sin(ang));
    }
    for (let i = 0; i < 4; i++) {
      const spread = (i - 1.5) * 0.12;
      spawnEnemyBullet(sim, e.x, e.y, Math.cos(base + spread), Math.sin(base + spread));
    }
    return;
  }
  const count = e.kind === "megaboss" ? MEGABOSS_DANMAKU_COUNT : BOSS_DANMAKU_COUNT;
  const spread = (BOSS_DANMAKU_SPREAD_DEG * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0 : i / (count - 1) - 0.5;
    const ang = base + t * spread;
    spawnEnemyBullet(sim, e.x, e.y, Math.cos(ang), Math.sin(ang));
  }
}

export function doAttack(sim: Sim, onBeat: boolean): boolean {
  if (sim.run !== "playing" && sim.run !== "tutorial") return false;
  if (isSliding(sim)) return false;
  if (!canPerformAttack(sim, onBeat)) return false;
  sim.lastAttackMs = sim.nowMs;
  const spearUltEnhance = spearUltActive(sim);
  const thrust = spearUltEnhance && !onBeat;
  const p = sim.player;

  if (sim.weaponId === 3) {
    spawnPlayerBullet(sim, p.x, p.y, onBeat, false);
    for (const c of sim.clones) {
      if (c.hp > 0) spawnPlayerBullet(sim, c.x, c.y, onBeat, true);
    }
    return true;
  }

  let fx = p.facingX;
  let fy = p.facingY;
  if (sim.weaponId === 2) {
    const aim = lockNearest(p.x, p.y, sim.enemies, fx, fy);
    fx = aim.x;
    fy = aim.y;
    p.facingX = fx;
    p.facingY = fy;
  }
  const radius = attackRadius(sim.weaponId);
  const dmg = attackDamage(sim, sim.weaponId, onBeat, thrust);
  const hits = enemiesHitByShape(sim, p.x, p.y, radius, fx, fy, onBeat);
  const beatHits = applyHits(sim, hits, dmg, onBeat, false);
  if (onBeat && !spearUltEnhance) addEnergy(sim, beatHits);
  damageObstaclesInCircle(sim, p.x, p.y, radius, 1);
  const kind = meleeFlashKind(sim, onBeat);
  setMeleeFlash(sim, {
    totalMs: thrust ? 150 : SAMURAI_SWING_MS,
    x: p.x,
    y: p.y,
    radius,
    kind,
    facingX: fx,
    facingY: fy,
    onBeat: onBeat || thrust,
    path: null,
    arcDeg: kind === "arc" ? spearArcDeg(onBeat) : undefined,
  });
  if (spearUltEnhance) consumeSpearUltAttack(sim);
  if (onBeat && hits.length) sim.shake = Math.max(sim.shake, 4);
  return true;
}

function t3BulletDamage(onBeat: boolean): number {
  const full = BASIC_ATTACK_DAMAGE * (onBeat ? 2 : 1);
  return Math.max(1, Math.round(full * TEMPLATE3_DAMAGE_FACTOR));
}

function spawnPlayerBullet(sim: Sim, x: number, y: number, onBeat: boolean, fromClone: boolean): void {
  const aim = lockNearest(x, y, sim.enemies, sim.player.facingX, sim.player.facingY);
  if (!fromClone) {
    sim.player.facingX = aim.x;
    sim.player.facingY = aim.y;
  }
  const beatShot = onBeat && !fromClone;
  sim.bullets.push({
    id: allocId(sim),
    team: "player",
    x,
    y,
    r: BULLET_RADIUS,
    ox: x,
    oy: y,
    ux: aim.x,
    uy: aim.y,
    traveled: 0,
    maxRange: bulletRangeFor(sim.weaponId),
    damage: fromClone ? 1 : t3BulletDamage(onBeat),
    explosive: beatShot,
    enhanced: beatShot,
    fromClone,
    hitIds: new Set(),
    active: true,
  });
}

export function doSlide(sim: Sim, onBeat: boolean, dirX: number, dirY: number): boolean {
  if (sim.run !== "playing" && sim.run !== "tutorial") return false;
  if (isSliding(sim)) return false;
  if (!canPerformSlide(sim, onBeat)) return false;
  const aim = normalize(dirX, dirY, { x: sim.player.facingX, y: sim.player.facingY });
  sim.player.facingX = aim.x;
  sim.player.facingY = aim.y;
  sim.lastSlideMs = sim.nowMs;
  sim.slideFromX = sim.player.x;
  sim.slideFromY = sim.player.y;
  const slideDist = slideDistanceFor(sim);
  const dest = clampBody(
    sim,
    sim.player.x + aim.x * slideDist,
    sim.player.y + aim.y * slideDist,
    sim.player.r,
  );
  sim.slideToX = dest.x;
  sim.slideToY = dest.y;
  sim.slideUntil = sim.nowMs + SLIDE_DURATION_MS;
  if (!onBeat) return true;

  if (sim.weaponId === 3) {
    spawnPlayerBullet(sim, sim.slideFromX, sim.slideFromY, true, false);
    return true;
  }

  let fx = aim.x;
  let fy = aim.y;
  if (sim.weaponId === 2) {
    const locked = lockNearest(sim.slideFromX, sim.slideFromY, sim.enemies, fx, fy);
    fx = locked.x;
    fy = locked.y;
  }
  const radius = attackRadius(sim.weaponId);
  const spearUltEnhance = spearUltActive(sim);
  const dmg = attackDamage(sim, sim.weaponId, true, spearUltEnhance);
  const path = samplePath(
    sim.slideFromX,
    sim.slideFromY,
    sim.slideToX,
    sim.slideToY,
    SLIDE_PATH_SAMPLE,
  );
  const hitIds = new Set<number>();
  const hits: Enemy[] = [];
  for (const pt of path) {
    for (const e of enemiesHitByShape(sim, pt.x, pt.y, radius, fx, fy, true)) {
      if (hitIds.has(e.id)) continue;
      hitIds.add(e.id);
      hits.push(e);
    }
  }
  const beatHits = applyHits(sim, hits, dmg, true, false);
  if (!spearUltEnhance) addEnergy(sim, beatHits);
  for (const pt of path) damageObstaclesInCircle(sim, pt.x, pt.y, radius, 1);
  const kind = meleeFlashKind(sim, true);
  setMeleeFlash(sim, {
    totalMs: SAMURAI_SLIDE_SWING_MS,
    x: sim.slideFromX,
    y: sim.slideFromY,
    radius,
    kind,
    facingX: fx,
    facingY: fy,
    onBeat: true,
    path: path.map((p) => ({ x: p.x, y: p.y, r: radius })),
    arcDeg: kind === "arc" ? spearArcDeg(true) : undefined,
  });
  if (spearUltEnhance) consumeSpearUltAttack(sim);
  if (hits.length) sim.shake = Math.max(sim.shake, 5);
  return true;
}

export function doUltimate(sim: Sim): boolean {
  if (sim.run !== "playing" && sim.run !== "tutorial") return false;
  if (sim.energy < ULTIMATE_BEAT_CHARGES) return false;
  sim.energy = 0;
  sim.ultFxUntilMs = sim.nowMs + ULT_FX_MS;
  sim.shake = Math.max(sim.shake, 9);
  const p = sim.player;
  if (sim.weaponId === 3) {
    const c: Clone = {
      id: allocId(sim),
      x: p.x + p.facingY * 0.6,
      y: p.y - p.facingX * 0.6,
      r: CLONE_RADIUS,
      hp: TEMPLATE3_CLONE_HP,
      maxHp: TEMPLATE3_CLONE_HP,
      lastHurtMs: -9999,
    };
    sim.clones.push(c);
    sim.flash = {
      untilMs: sim.nowMs + 320,
      x: p.x,
      y: p.y,
      radius: 2.4,
      kind: "ult",
      facingX: p.facingX,
      facingY: p.facingY,
      onBeat: true,
      path: null,
    };
    return true;
  }
  if (sim.weaponId === 2) {
    sim.spearUltAttacksLeft = SPEAR_ULT_ATTACK_CHARGES;
    sim.flash = {
      untilMs: sim.nowMs + 300,
      x: p.x,
      y: p.y,
      radius: attackRadius(2),
      kind: "ult",
      facingX: p.facingX,
      facingY: p.facingY,
      onBeat: true,
      path: null,
    };
    return true;
  }
  if (sim.weaponId === 1) {
    sim.ultBuffUntilMs = sim.nowMs + HERO_ULT_DURATION_MS;
    sim.flash = {
      untilMs: sim.nowMs + 300,
      x: p.x,
      y: p.y,
      radius: attackRadius(1) * 1.15,
      kind: "ult",
      facingX: p.facingX,
      facingY: p.facingY,
      onBeat: true,
      path: null,
    };
    return true;
  }
  return false;
}

export function switchWeapon(sim: Sim, id: WeaponId): void {
  if (sim.weaponId !== id) return;
  sim.weaponId = id;
  sim.player.r = playerRadius(id);
  sim.ultBuffUntilMs = 0;
  sim.spearUltAttacksLeft = 0;
  sim.shieldHp = 0;
}

export function beginCombat(sim: Sim): void {
  const nextId = { n: sim.nextId };
  const plan = createWavePlan(nextId, { includeFinalBoss: wavePlanIncludesFinalBoss(sim.levelId) });
  sim.enemies = plan[0] ?? [];
  sim.pendingWaves = plan.slice(1);
  sim.wave = sim.enemies.length ? 1 : 0;
  sim.waveTotal = plan.length;
  sim.nextId = nextId.n;
  sim.energy = 0;
  sim.player.hp = sim.player.maxHp;
  sim.lastHurtMs = -9999;
  sim.lastSlideMs = -9999;
  sim.slideUntil = 0;
  sim.ultBuffUntilMs = 0;
  sim.spearUltAttacksLeft = 0;
  sim.shieldHp = 0;
  sim.reviveAvailable = true;
  sim.explosions = [];
  sim.bullets = [];
  sim.clones = [];
  sim.obstacles = createStageObstacles({ n: sim.nextId });
  sim.propBreaks = [];
  sim.ultFxUntilMs = 0;
  sim.knockVX = 0;
  sim.knockVY = 0;
  resetRunStats(sim);
  sim.run = "playing";
}

export function restartRun(sim: Sim, tutorial: boolean): void {
  sim.player.x = sim.spawnX;
  sim.player.y = sim.spawnY;
  sim.player.hp = sim.player.maxHp;
  sim.player.facingX = 1;
  sim.player.facingY = 0;
  sim.energy = 0;
  sim.lastHurtMs = -9999;
  sim.lastAttackMs = -9999;
  sim.lastSlideMs = -9999;
  sim.slideUntil = 0;
  sim.ultBuffUntilMs = 0;
  sim.spearUltAttacksLeft = 0;
  sim.spearAtkSpeedStacks = 0;
  sim.shieldHp = 0;
  sim.reviveAvailable = true;
  sim.explosions = [];
  sim.bullets = [];
  sim.clones = [];
  sim.obstacles = createStageObstacles({ n: sim.nextId });
  sim.propBreaks = [];
  sim.ultFxUntilMs = 0;
  sim.flash = null;
  sim.knockVX = 0;
  sim.knockVY = 0;
  resetRunStats(sim);
  sim.pendingWaves = [];
  sim.wave = 0;
  sim.waveTotal = 0;
  if (tutorial) {
    sim.enemies = [];
    sim.run = "tutorial";
  } else {
    const nextId = { n: sim.nextId };
    const plan = createWavePlan(nextId, { includeFinalBoss: wavePlanIncludesFinalBoss(sim.levelId) });
    sim.enemies = plan[0] ?? [];
    sim.pendingWaves = plan.slice(1);
    sim.wave = sim.enemies.length ? 1 : 0;
    sim.waveTotal = plan.length;
    sim.nextId = nextId.n;
    sim.run = "playing";
  }
}

function triggerExplosion(sim: Sim, x: number, y: number, fromClone: boolean): number {
  sim.explosions.push({
    untilMs: sim.nowMs + 240,
    x,
    y,
    radius: TEMPLATE3_EXPLOSION_RADIUS,
  });
  const origin = { x, y, r: 0 };
  const hits = sim.enemies.filter((e) => attackCircleHits(origin, TEMPLATE3_EXPLOSION_RADIUS, e));
  damageObstaclesInCircle(sim, x, y, TEMPLATE3_EXPLOSION_RADIUS, 2);
  return applyHits(sim, hits, TEMPLATE3_EXPLOSION_DAMAGE, true, fromClone);
}

function bulletHitsObstacle(sim: Sim, b: { x: number; y: number; r: number; damage: number }): boolean {
  for (const o of liveObstacles(sim.obstacles)) {
    if (!o.destructible) {
      if (projectileHits(b, o)) return true;
      continue;
    }
    if (!projectileHits(b, o)) continue;
    damageObstacle(sim, o, b.damage);
    return true;
  }
  return false;
}

function stepBullets(sim: Sim, dtSec: number): void {
  let beatHits = 0;
  for (const b of sim.bullets) {
    if (!b.active) continue;
    const speed = b.team === "enemy" ? ENEMY_BULLET_SPEED : TEMPLATE3_BULLET_SPEED;
    const stepCap = speed * dtSec;
    const remain = b.maxRange - b.traveled;
    const step = Math.min(stepCap, remain);
    if (step <= 1e-6) {
      b.active = false;
      continue;
    }
    b.x += b.ux * step;
    b.y += b.uy * step;
    b.traveled += step;

    if (bulletHitsObstacle(sim, b)) {
      b.active = false;
      continue;
    }

    if (b.team === "enemy") {
      if (!isSliding(sim) && projectileHits(b, sim.player)) {
        damagePlayer(sim, b.damage, {
          fromX: b.x,
          fromY: b.y,
          attackX: b.ux,
          attackY: b.uy,
          strength: 0.7,
        });
        b.active = false;
        continue;
      }
      for (const c of sim.clones) {
        if (c.hp <= 0 || b.hitIds.has(c.id)) continue;
        if (!projectileHits(b, c)) continue;
        c.lastHurtMs = sim.nowMs;
        c.hp -= b.damage;
        b.active = false;
        break;
      }
      sim.clones = sim.clones.filter((c) => c.hp > 0);
      if (b.traveled >= b.maxRange - 1e-6) b.active = false;
      continue;
    }

    for (const e of sim.enemies) {
      if (b.hitIds.has(e.id)) continue;
      if (!projectileHits(b, e)) continue;
      b.hitIds.add(e.id);
      if (b.explosive) {
        beatHits += triggerExplosion(sim, e.x, e.y, b.fromClone);
        b.active = false;
        break;
      }
      e.hp -= b.damage;
      if (b.enhanced && !b.fromClone) beatHits += 1;
      b.active = false;
      break;
    }
    if (b.traveled >= b.maxRange - 1e-6) b.active = false;
  }
  sim.enemies = sim.enemies.filter((e) => e.hp > 0);
  sim.bullets = sim.bullets.filter((b) => b.active);
  addEnergy(sim, beatHits);
  maybeWin(sim);
}

function knockbackStrengthForEnemy(kind: EnemyKind): number {
  if (kind === "megaboss") return 1.45;
  if (kind === "boss") return 1.15;
  return 1;
}

function knockbackDir(
  px: number,
  py: number,
  fromX: number,
  fromY: number,
  attackX?: number,
  attackY?: number,
): { x: number; y: number } {
  const away = normalize(px - fromX, py - fromY, { x: 1, y: 0 });
  if (attackX === undefined || attackY === undefined) return away;
  const atk = normalize(attackX, attackY, { x: 0, y: 0 });
  return normalize(away.x - atk.x, away.y - atk.y, away);
}

function applyPlayerKnockback(
  sim: Sim,
  fromX: number,
  fromY: number,
  strength: number,
  attackX?: number,
  attackY?: number,
): void {
  const dir = knockbackDir(sim.player.x, sim.player.y, fromX, fromY, attackX, attackY);
  const bump = PLAYER_KNOCKBACK_BUMP * strength;
  const impulse = PLAYER_KNOCKBACK_IMPULSE * strength;
  const bumped = clampBody(
    sim,
    sim.player.x + dir.x * bump,
    sim.player.y + dir.y * bump,
    sim.player.r,
  );
  sim.player.x = bumped.x;
  sim.player.y = bumped.y;
  sim.knockVX += dir.x * impulse;
  sim.knockVY += dir.y * impulse;
  if (sim.nowMs < sim.slideUntil) sim.slideUntil = 0;
}

function stepPlayerKnockback(sim: Sim, dtSec: number): void {
  if (Math.abs(sim.knockVX) < 1e-4 && Math.abs(sim.knockVY) < 1e-4) return;
  const next = clampBody(
    sim,
    sim.player.x + sim.knockVX * dtSec,
    sim.player.y + sim.knockVY * dtSec,
    sim.player.r,
  );
  sim.player.x = next.x;
  sim.player.y = next.y;
  const damp = PLAYER_KNOCKBACK_DAMPING ** (dtSec / 0.016);
  sim.knockVX *= damp;
  sim.knockVY *= damp;
}

function damagePlayer(
  sim: Sim,
  amount: number,
  knock?: { fromX: number; fromY: number; attackX?: number; attackY?: number; strength?: number },
): void {
  if (sim.run !== "playing") return;
  if (sim.nowMs - sim.lastHurtMs < CONTACT_IFRAME_MS) return;
  sim.lastHurtMs = sim.nowMs;
  if (knock) {
    applyPlayerKnockback(
      sim,
      knock.fromX,
      knock.fromY,
      knock.strength ?? 1,
      knock.attackX,
      knock.attackY,
    );
  }
  if (sim.shieldHp > 0 && sim.weaponId === 1) {
    sim.shieldHp = Math.max(0, sim.shieldHp - amount);
    sim.shake = Math.max(sim.shake, 4);
  } else {
    sim.stats.damageTaken += amount;
    sim.player.hp -= amount;
    sim.shake = Math.max(sim.shake, 6);
    if (sim.player.hp <= 0) {
      sim.player.hp = 0;
      sim.run = "lose";
    }
  }
}

function bossRangedRange(kind: EnemyKind): number {
  return kind === "megaboss" ? MEGABOSS_RANGED_ATTACK_RANGE : BOSS_RANGED_ATTACK_RANGE;
}

function bossLungeRange(kind: EnemyKind): number {
  return kind === "megaboss" ? MEGABOSS_LUNGE_ATTACK_RANGE : BOSS_LUNGE_ATTACK_RANGE;
}

/** 体表到体表的有效交战距离（比圆心距更贴近手感）。 */
function engageDistance(e: Enemy, tx: number, ty: number, playerR: number): number {
  return Math.max(0, Math.hypot(e.x - tx, e.y - ty) - e.r - playerR);
}

function lungeCdMs(kind: EnemyKind): number {
  return kind === "megaboss" ? MEGABOSS_LUNGE_CD_MS : BOSS_LUNGE_CD_MS;
}

function windupMsFor(e: Enemy, attackKind: "lunge" | "slam"): number {
  if (attackKind === "lunge") return MINION_WINDUP_MS;
  return e.kind === "boss" ? BOSS_WINDUP_MS : MEGABOSS_WINDUP_MS;
}

function strikeMsFor(e: Enemy, attackKind: "lunge" | "slam"): number {
  if (attackKind === "lunge") return MINION_STRIKE_MS;
  return e.kind === "boss" ? BOSS_STRIKE_MS : MEGABOSS_STRIKE_MS;
}

function telegraphRadiusFor(e: Enemy, attackKind: "lunge" | "slam"): number {
  if (attackKind === "lunge") {
    if (e.kind === "minion") return MINION_TELEGRAPH_RADIUS;
    return e.kind === "megaboss" ? MEGABOSS_LUNGE_TELEGRAPH_RADIUS : BOSS_LUNGE_TELEGRAPH_RADIUS;
  }
  return e.kind === "boss" ? BOSS_ATTACK_RADIUS : MEGABOSS_ATTACK_RADIUS;
}

function lungeTargetRadius(sim: Sim, tx: number, ty: number): number {
  for (const c of sim.clones) {
    if (c.hp <= 0) continue;
    if (Math.hypot(c.x - tx, c.y - ty) < 0.08) return CLONE_RADIUS;
  }
  return sim.player.r;
}

function computeLungeDistance(e: Enemy, tx: number, ty: number, targetR: number): number {
  const hitR = telegraphRadiusFor(e, "lunge");
  const centerDist = Math.hypot(tx - e.x, ty - e.y);
  const surfaceDist = Math.max(0, centerDist - e.r - targetR);
  return Math.max(0.12, surfaceDist - hitR * 0.2);
}

function startEnemyWindup(sim: Sim, e: Enemy, tx: number, ty: number, attackKind: "lunge" | "slam" = "lunge"): void {
  const kind = e.kind;
  const resolved: "lunge" | "slam" = kind === "minion" ? "lunge" : attackKind;
  const windupMs = windupMsFor(e, resolved);
  const strikeMs = strikeMsFor(e, resolved);
  const dir = normalize(tx - e.x, ty - e.y);
  e.windupUntil = sim.nowMs + windupMs;
  e.strikeUntil = e.windupUntil + strikeMs;
  if (kind === "minion") {
    e.attackCdUntil = 0;
  } else if (resolved === "slam") {
    e.attackCdUntil =
      sim.nowMs + (kind === "megaboss" ? MEGABOSS_ATTACK_CD_MS : BOSS_ATTACK_CD_MS);
  }
  e.attackX = dir.x;
  e.attackY = dir.y;
  e.attackRadius = telegraphRadiusFor(e, resolved);
  e.attackHit = false;
  e.attackKind = resolved;
  e.danmakuFired = false;
  e.lungeHit = false;
  if (resolved === "lunge") {
    const targetR = lungeTargetRadius(sim, tx, ty);
    e.lungeDist = computeLungeDistance(e, tx, ty, targetR);
    e.lungeTraveled = 0;
    const strikeSec = strikeMsFor(e, "lunge") / 1000;
    e.lungeSpeed = e.lungeDist / Math.max(0.05, strikeSec);
    e.lungeFromX = e.x;
    e.lungeFromY = e.y;
    e.lungeToX = e.x + dir.x * e.lungeDist;
    e.lungeToY = e.y + dir.y * e.lungeDist;
  } else {
    e.lungeDist = 0;
    e.lungeTraveled = 0;
    e.lungeSpeed = 0;
    e.lungeFromX = undefined;
    e.lungeFromY = undefined;
    e.lungeToX = undefined;
    e.lungeToY = undefined;
  }
}

function tryStartBossAttack(sim: Sim, e: Enemy, tx: number, ty: number, dist: number, now: number): boolean {
  const kind = e.kind;
  if (kind !== "boss" && kind !== "megaboss") return false;
  const lungeR = bossLungeRange(kind);
  const rangedR = bossRangedRange(kind);
  const lungeReady = now >= (e.lungeCdUntil ?? 0);
  const rangedReady = now >= (e.attackCdUntil ?? 0);

  // 近身突刺环：优先突刺
  if (dist <= lungeR && lungeReady) {
    startEnemyWindup(sim, e, tx, ty, "lunge");
    return true;
  }
  // 中远远程环：仅在该环内且不在突刺优先区，或突刺 CD 中
  if (dist <= rangedR && rangedReady) {
    if (dist > lungeR || !lungeReady) {
      startEnemyWindup(sim, e, tx, ty, "slam");
      return true;
    }
  }
  return false;
}

function tryLungeStrikeHit(sim: Sim, e: Enemy): void {
  if (e.attackKind !== "lunge" || e.lungeHit) return;
  if (isSliding(sim)) return;
  const dmg = e.kind === "boss" || e.kind === "megaboss" ? BOSS_LUNGE_DAMAGE : CONTACT_DAMAGE;
  const radius = e.attackRadius ?? MINION_TELEGRAPH_RADIUS;
  const ux = e.attackX ?? 1;
  const uy = e.attackY ?? 0;
  const tipX = e.x + ux * (e.r + radius * 0.35);
  const tipY = e.y + uy * (e.r + radius * 0.35);
  const origin = { x: tipX, y: tipY, r: 0 };
  if (attackCircleHits(origin, radius, sim.player)) {
    damagePlayer(sim, dmg, {
      fromX: e.x,
      fromY: e.y,
      attackX: ux,
      attackY: uy,
      strength: knockbackStrengthForEnemy(e.kind),
    });
    e.lungeHit = true;
    return;
  }
  for (const c of sim.clones) {
    if (c.hp <= 0) continue;
    if (!attackCircleHits(origin, radius, c)) continue;
    c.lastHurtMs = sim.nowMs;
    c.hp -= dmg;
    e.lungeHit = true;
    sim.clones = sim.clones.filter((cl) => cl.hp > 0);
    return;
  }
}

function resolveEnemyStrike(sim: Sim, e: Enemy): void {
  const kind = e.kind;
  if (e.attackKind === "lunge") {
    if (kind === "boss" || kind === "megaboss") {
      e.lungeCdUntil = sim.nowMs + lungeCdMs(kind);
    } else {
      e.attackCdUntil = sim.nowMs + MINION_ATTACK_CD_MS;
    }
    return;
  }
  if (kind === "minion") {
    e.attackCdUntil = sim.nowMs + MINION_ATTACK_CD_MS;
    return;
  }
  // slam CD 已在读条开始时写入
  if (kind === "boss" || kind === "megaboss") {
    const target = nearestChaseTarget(sim, e);
    const base = Math.atan2(target.y - e.y, target.x - e.x);
    const shots = kind === "megaboss" ? 5 : 3;
    for (let i = 0; i < shots; i++) {
      const t = shots <= 1 ? 0 : i / (shots - 1) - 0.5;
      const ang = base + t * 0.22;
      spawnEnemyBullet(sim, e.x, e.y, Math.cos(ang), Math.sin(ang));
    }
  }
}

function lungeRemaining(e: Enemy): number {
  const tx = e.lungeToX ?? e.x;
  const ty = e.lungeToY ?? e.y;
  return Math.hypot(tx - e.x, ty - e.y);
}

function lungeComplete(e: Enemy): boolean {
  const total = e.lungeDist ?? 0;
  if (total <= 1e-6) return true;
  return lungeRemaining(e) <= 0.08;
}

function syncLungeTraveled(e: Enemy): void {
  const fx = e.lungeFromX ?? e.x;
  const fy = e.lungeFromY ?? e.y;
  const tx = e.lungeToX ?? e.x;
  const ty = e.lungeToY ?? e.y;
  const total = e.lungeDist ?? Math.hypot(tx - fx, ty - fy);
  if (total <= 1e-6) {
    e.lungeTraveled = 0;
    return;
  }
  const along = ((e.x - fx) * (tx - fx) + (e.y - fy) * (ty - fy)) / total;
  e.lungeTraveled = Math.max(0, Math.min(total, along));
}

function finishLungePose(sim: Sim, e: Enemy): void {
  const tx = e.lungeToX ?? e.x;
  const ty = e.lungeToY ?? e.y;
  const c = clampBody(sim, tx, ty, e.r);
  e.x = c.x;
  e.y = c.y;
  syncLungeTraveled(e);
}

function stepLungeMotion(sim: Sim, e: Enemy, dtSec: number): void {
  const tx = e.lungeToX ?? e.x;
  const ty = e.lungeToY ?? e.y;
  const remainDist = lungeRemaining(e);
  const speed = e.lungeSpeed ?? MINION_LUNGE_SPEED;
  const prevX = e.x;
  const prevY = e.y;
  const step = Math.min(speed * dtSec, remainDist);
  if (remainDist > 1e-4) {
    const nx = e.x + ((tx - e.x) / remainDist) * step;
    const ny = e.y + ((ty - e.y) / remainDist) * step;
    const c = clampBody(sim, nx, ny, e.r);
    e.x = c.x;
    e.y = c.y;
  }
  syncLungeTraveled(e);
  const moved = Math.hypot(e.x - prevX, e.y - prevY);
  if (moved < 1e-3 && remainDist > 0.12) {
    e.lungeTraveled = e.lungeDist ?? 0;
  }
  tryLungeStrikeHit(sim, e);
}

function stepEnemies(sim: Sim, dtSec: number): void {
  for (const e of sim.enemies) {
    const now = sim.nowMs;
    const windup = e.windupUntil ?? 0;
    const strike = e.strikeUntil ?? 0;
    if (windup > 0 && now < windup) continue;

    if (windup > 0 && e.attackKind === "lunge" && !(e.attackHit ?? false)) {
      if (now >= windup) stepLungeMotion(sim, e, dtSec);
      if (!lungeComplete(e)) continue;
      finishLungePose(sim, e);
      e.attackHit = true;
      resolveEnemyStrike(sim, e);
      continue;
    }

    if (windup > 0 && now < strike) {
      if ((e.kind === "boss" || e.kind === "megaboss") && e.attackKind === "slam" && !(e.danmakuFired ?? false)) {
        const windupMs =
          e.kind === "boss" ? BOSS_WINDUP_MS : MEGABOSS_WINDUP_MS;
        const windupStart = windup - windupMs;
        if (now >= windupStart + windupMs * 0.52) {
          e.danmakuFired = true;
          fireBossDanmaku(sim, e, e.kind === "megaboss");
        }
      }
      continue;
    }
    if (windup > 0 && !(e.attackHit ?? false)) {
      e.attackHit = true;
      resolveEnemyStrike(sim, e);
    }

    let { x: tx, y: ty } = nearestChaseTarget(sim, e);
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    const engage = engageDistance(e, tx, ty, sim.player.r);
    if (d < 1e-4) continue;
    let dirX = dx / d;
    let dirY = dy / d;
    if (e.kind === "minion") {
      if (now < (e.attackCdUntil ?? 0)) continue;
      let sepX = 0;
      let sepY = 0;
      for (const o of sim.enemies) {
        if (o === e || o.kind !== "minion") continue;
        const sx = e.x - o.x;
        const sy = e.y - o.y;
        const sd = Math.hypot(sx, sy);
        if (sd > 1e-4 && sd < 1.38) {
          sepX += sx / sd;
          sepY += sy / sd;
        }
      }
      dirX += sepX * 0.85;
      dirY += sepY * 0.85;
      const nd = Math.hypot(dirX, dirY);
      if (nd > 1e-4) {
        dirX /= nd;
        dirY /= nd;
      }
    }
    if (e.kind === "minion") {
      if (engage <= MINION_LUNGE_ATTACK_RANGE) {
        startEnemyWindup(sim, e, tx, ty);
        continue;
      }
    } else if (e.kind === "boss" || e.kind === "megaboss") {
      if (tryStartBossAttack(sim, e, tx, ty, engage, now)) continue;
    }
    const step = MINION_SPEED * dtSec;
    e.x += dirX * step;
    e.y += dirY * step;
    const c = clampBody(sim, e.x, e.y, e.r);
    e.x = c.x;
    e.y = c.y;
  }
}

function distTo(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 怪物追击/瞄准：在主角与存活分身中选距离最近者。 */
function nearestChaseTarget(sim: Sim, from: { x: number; y: number }): { x: number; y: number } {
  let tx = sim.player.x;
  let ty = sim.player.y;
  let bestD = distTo(from, sim.player);
  for (const c of sim.clones) {
    if (c.hp <= 0) continue;
    const d = distTo(from, c);
    if (d < bestD) {
      bestD = d;
      tx = c.x;
      ty = c.y;
    }
  }
  return { x: tx, y: ty };
}

function stepContact(sim: Sim): void {
  if (sim.run !== "playing") return;
  const sliding = isSliding(sim);
  for (const c of sim.clones) {
    if (c.hp <= 0) continue;
    if (sim.nowMs - c.lastHurtMs < CONTACT_IFRAME_MS) continue;
    if (sim.enemies.some((e) => bodiesOverlap(c, e))) {
      c.lastHurtMs = sim.nowMs;
      c.hp -= CONTACT_DAMAGE;
    }
  }
  sim.clones = sim.clones.filter((c) => c.hp > 0);
  if (sliding) return;
  const hitter = sim.enemies.find((e) => bodiesOverlap(sim.player, e));
  if (hitter) {
    damagePlayer(sim, CONTACT_DAMAGE, {
      fromX: hitter.x,
      fromY: hitter.y,
      strength: knockbackStrengthForEnemy(hitter.kind),
    });
  }
}

function stepWaveSpawning(sim: Sim): void {
  if (sim.run !== "playing") return;
  if (sim.enemies.length === 0 && sim.pendingWaves.length > 0) {
    sim.enemies = sim.pendingWaves.shift()!;
    sim.wave += 1;
    sim.shake = Math.max(sim.shake, 5);
  }
}

export function stepSim(sim: Sim, dtMs: number, moveX: number, moveY: number): void {
  const dt = Math.max(0, dtMs);
  sim.nowMs += dt;
  sim.shake *= 0.86;
  stepRunStats(sim);
  if (sim.flash && sim.nowMs >= sim.flash.untilMs) sim.flash = null;
  sim.explosions = sim.explosions.filter((e) => sim.nowMs < e.untilMs);
  sim.propBreaks = sim.propBreaks.filter((e) => sim.nowMs < e.untilMs);
  if (sim.run !== "playing" && sim.run !== "tutorial") return;

  const dtSec = dt / 1000;
  if (sim.nowMs < sim.slideUntil) {
    const t = 1 - (sim.slideUntil - sim.nowMs) / SLIDE_DURATION_MS;
    const u = Math.max(0, Math.min(1, t));
    const ease = 1 - (1 - u) ** 2;
    sim.player.x = sim.slideFromX + (sim.slideToX - sim.slideFromX) * ease;
    sim.player.y = sim.slideFromY + (sim.slideToY - sim.slideFromY) * ease;
  } else if (moveX !== 0 || moveY !== 0) {
    const n = normalize(moveX, moveY);
    sim.player.facingX = n.x;
    sim.player.facingY = n.y;
    const step = PLAYER_SPEED * dtSec;
    const next = clampBody(sim, sim.player.x + n.x * step, sim.player.y + n.y * step, sim.player.r);
    sim.player.x = next.x;
    sim.player.y = next.y;
  }

  if (sim.run === "playing") {
    stepEnemies(sim, dtSec);
    if (sim.bullets.length) stepBullets(sim, dtSec);
    stepContact(sim);
    stepWaveSpawning(sim);
  }
  stepPlayerKnockback(sim, dtSec);
}

export function cameraOrigin(
  px: number,
  py: number,
  viewW: number,
  viewH: number,
): { x: number; y: number } {
  let camX = px - viewW / 2;
  let camY = py - viewH / 2;
  camX = Math.max(0, Math.min(WORLD_W - viewW, camX));
  camY = Math.max(0, Math.min(WORLD_H - viewH, camY));
  return { x: camX, y: camY };
}

export function nearestBoss(sim: Sim): Enemy | null {
  const bosses = sim.enemies.filter((e) => e.kind === "boss" || e.kind === "megaboss");
  if (!bosses.length) return null;
  const p = sim.player;
  return bosses.reduce((a, b) => (distTo(a, p) < distTo(b, p) ? a : b));
}

/** 看广告复活：回到 playing，REVIVE_HP，本局复活次数用尽。 */
export function reviveRun(sim: Sim): boolean {
  if (sim.run !== "lose" || !sim.reviveAvailable) return false;
  sim.run = "playing";
  sim.player.hp = REVIVE_HP;
  sim.reviveAvailable = false;
  sim.lastHurtMs = sim.nowMs;
  sim.knockVX = 0;
  sim.knockVY = 0;
  sim.shake = Math.max(sim.shake, 6);
  return true;
}

export function forfeitRevive(sim: Sim): void {
  if (sim.run !== "lose") return;
  sim.reviveAvailable = false;
}
