import {
  ACTION_COOLDOWN_MS,
  ATTACK_RANGE,
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
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SAMURAI_SHIELD_MAX,
  SAMURAI_SHIELD_TICK_MS,
  SAMURAI_SLIDE_DISTANCE,
  SAMURAI_ULT_SLIDE_BONUS,
  SAMURAI_ULT_SLIDE_CHARGES,
  SAMURAI_ULT_SLIDE_DAMAGE,
  SLIDE_DISTANCE,
  SLIDE_DURATION_MS,
  SLIDE_PATH_SAMPLE,
  SPEAR_ARC_DEG,
  SPEAR_ONBEAT_ARC_DEG,
  SPEAR_THRUST_DAMAGE_BONUS,
  SPEAR_ULT_CHARGES,
  SPEAR_ULT_RANGE_MULT,
  TEMPLATE2_ATTACK_RANGE,
  TEMPLATE3_BULLET_RANGE,
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
import { createStageObstacles, liveObstacles } from "./stage";
import { emptyRunStats } from "./runResult";
import type { AttackFlash, Clone, Enemy, EnemyKind, Obstacle, Player, Sim, TrackId, WeaponId } from "./types";

export function attackRadius(weapon: WeaponId, ultBuff: boolean): number {
  if (weapon === 2) {
    return ultBuff ? TEMPLATE2_ATTACK_RANGE * SPEAR_ULT_RANGE_MULT : TEMPLATE2_ATTACK_RANGE;
  }
  return ATTACK_RANGE;
}

export function attackDamage(weapon: WeaponId, onBeat: boolean, thrust = false): number {
  const base = BASIC_ATTACK_DAMAGE * (onBeat ? 2 : 1);
  if (weapon === 2 && thrust) return base + SPEAR_THRUST_DAMAGE_BONUS;
  return base;
}

export function actionCooldown(_weapon?: WeaponId): number {
  return ACTION_COOLDOWN_MS;
}

export function slideDistance(weapon: WeaponId, empowered = false): number {
  const base = weapon === 1 ? SAMURAI_SLIDE_DISTANCE : SLIDE_DISTANCE;
  return empowered && weapon === 1 ? base + SAMURAI_ULT_SLIDE_BONUS : base;
}

function syncSamuraiShield(sim: Sim, resetTick = false): void {
  if (sim.weaponId !== 1) return;
  sim.shieldHp = Math.min(SAMURAI_SHIELD_MAX, Math.max(sim.shieldHp, 1));
  if (resetTick || sim.lastShieldTickMs === 0) sim.lastShieldTickMs = sim.nowMs;
}

function canPerformAction(sim: Sim): boolean {
  const last = Math.max(sim.lastAttackMs, sim.lastSlideMs);
  return sim.nowMs - last >= ACTION_COOLDOWN_MS;
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
  trackId: TrackId;
  weaponId: WeaponId;
  allowedWeapons: WeaponId[];
  tutorial: boolean;
}): Sim {
  const spawnX = WORLD_W / 2;
  const spawnY = WORLD_H / 2;
  const nextId = { n: 1 };
  const pendingWaves = opts.tutorial ? [] : createWavePlan(nextId);
  const player: Player = {
    x: spawnX,
    y: spawnY,
    r: PLAYER_RADIUS,
    hp: PLAYER_HP,
    maxHp: PLAYER_HP,
    facingX: 1,
    facingY: 0,
  };
  const sim: Sim = {
    nowMs: 0,
    run: opts.tutorial ? "tutorial" : "playing",
    trackId: opts.trackId,
    weaponId: opts.weaponId,
    allowedWeapons: [...opts.allowedWeapons],
    player,
    enemies: [],
    pendingWaves,
    wave: 0,
    waveTotal: pendingWaves.length,
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
    spearThrustCharges: 0,
    samuraiSlideCharges: 0,
    shieldHp: 0,
    lastShieldTickMs: 0,
    explosions: [],
    flash: null,
    nextId: nextId.n,
    spawnX,
    spawnY,
    shake: 0,
    stats: emptyRunStats(),
    damagePopups: [],
    reviveAvailable: true,
  };
  if (opts.weaponId === 1) syncSamuraiShield(sim, true);
  return sim;
}

function allocId(sim: Sim): number {
  return sim.nextId++;
}

export function ultBuffActive(sim: Sim): boolean {
  return sim.weaponId === 2 && sim.spearThrustCharges > 0;
}

export function samuraiShieldActive(sim: Sim): boolean {
  return sim.weaponId === 1 && sim.shieldHp > 0;
}

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
    if (ultBuffActive(sim)) {
      return sim.enemies.filter((e) => attackLineHits(origin, radius, facingX, facingY, e));
    }
    const arc = spearArcDeg(onBeat);
    return sim.enemies.filter((e) => attackArcHits(origin, radius, facingX, facingY, e, arc));
  }
  return sim.enemies.filter((e) => attackCircleHits(origin, radius, e));
}

function meleeFlashKind(sim: Sim): AttackFlash["kind"] {
  if (sim.weaponId === 2) return ultBuffActive(sim) ? "line" : "arc";
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
  if (!onBeat && !canPerformAction(sim)) return false;
  sim.lastAttackMs = sim.nowMs;
  const thrust = sim.weaponId === 2 && sim.spearThrustCharges > 0;
  const buff = thrust;
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
  const radius = attackRadius(sim.weaponId, buff);
  const dmg = attackDamage(sim.weaponId, onBeat, thrust);
  const hits = enemiesHitByShape(sim, p.x, p.y, radius, fx, fy, onBeat);
  const beatHits = applyHits(sim, hits, dmg, onBeat, false);
  if (thrust) sim.spearThrustCharges -= 1;
  if (onBeat) addEnergy(sim, beatHits);
  damageObstaclesInCircle(sim, p.x, p.y, radius, 1);
  const kind = meleeFlashKind(sim);
  sim.flash = {
    untilMs: sim.nowMs + (thrust ? 150 : 120),
    x: p.x,
    y: p.y,
    radius,
    kind,
    facingX: fx,
    facingY: fy,
    onBeat: onBeat || thrust,
    path: null,
    arcDeg: kind === "arc" ? spearArcDeg(onBeat) : undefined,
  };
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
    maxRange: TEMPLATE3_BULLET_RANGE,
    damage: t3BulletDamage(onBeat),
    explosive: onBeat,
    enhanced: onBeat,
    fromClone,
    hitIds: new Set(),
    active: true,
  });
}

export function doSlide(sim: Sim, onBeat: boolean, dirX: number, dirY: number): boolean {
  if (sim.run !== "playing" && sim.run !== "tutorial") return false;
  if (isSliding(sim)) return false;
  if (!onBeat && !canPerformAction(sim)) return false;
  const aim = normalize(dirX, dirY, { x: sim.player.facingX, y: sim.player.facingY });
  sim.player.facingX = aim.x;
  sim.player.facingY = aim.y;
  sim.lastSlideMs = sim.nowMs;
  sim.slideFromX = sim.player.x;
  sim.slideFromY = sim.player.y;
  const empoweredSlide = sim.weaponId === 1 && sim.samuraiSlideCharges > 0;
  const slideDist = slideDistance(sim.weaponId, empoweredSlide);
  const dest = clampBody(
    sim,
    sim.player.x + aim.x * slideDist,
    sim.player.y + aim.y * slideDist,
    sim.player.r,
  );
  sim.slideToX = dest.x;
  sim.slideToY = dest.y;
  sim.slideUntil = sim.nowMs + SLIDE_DURATION_MS;
  if (empoweredSlide) sim.samuraiSlideCharges -= 1;
  if (!onBeat) return true;

  if (sim.weaponId === 3) {
    spawnPlayerBullet(sim, sim.slideFromX, sim.slideFromY, true, false);
    return true;
  }

  const buff = ultBuffActive(sim);
  let fx = aim.x;
  let fy = aim.y;
  if (sim.weaponId === 2) {
    const locked = lockNearest(sim.slideFromX, sim.slideFromY, sim.enemies, fx, fy);
    fx = locked.x;
    fy = locked.y;
  }
  const radius = attackRadius(sim.weaponId, buff);
  const dmg =
    empoweredSlide && sim.weaponId === 1 ? SAMURAI_ULT_SLIDE_DAMAGE : attackDamage(sim.weaponId, true);
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
  addEnergy(sim, beatHits);
  for (const pt of path) damageObstaclesInCircle(sim, pt.x, pt.y, radius, 1);
  const kind = meleeFlashKind(sim);
  sim.flash = {
    untilMs: sim.nowMs + 160,
    x: sim.slideFromX,
    y: sim.slideFromY,
    radius,
    kind,
    facingX: fx,
    facingY: fy,
    onBeat: true,
    path: path.map((p) => ({ x: p.x, y: p.y, r: radius })),
    arcDeg: kind === "arc" ? spearArcDeg(true) : undefined,
  };
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
    sim.spearThrustCharges = SPEAR_ULT_CHARGES;
    sim.flash = {
      untilMs: sim.nowMs + 300,
      x: p.x,
      y: p.y,
      radius: attackRadius(2, true),
      kind: "ult",
      facingX: p.facingX,
      facingY: p.facingY,
      onBeat: true,
      path: null,
    };
    return true;
  }
  if (sim.weaponId === 1) {
    sim.samuraiSlideCharges = SAMURAI_ULT_SLIDE_CHARGES;
    sim.flash = {
      untilMs: sim.nowMs + 300,
      x: p.x,
      y: p.y,
      radius: ATTACK_RANGE * 1.15,
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
  if (!sim.allowedWeapons.includes(id)) return;
  sim.weaponId = id;
  sim.spearThrustCharges = 0;
  sim.samuraiSlideCharges = 0;
  sim.shieldHp = 0;
  if (id === 1) syncSamuraiShield(sim, true);
}

export function beginCombat(sim: Sim): void {
  const nextId = { n: sim.nextId };
  const plan = createWavePlan(nextId);
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
  sim.spearThrustCharges = 0;
  sim.samuraiSlideCharges = 0;
  sim.shieldHp = 0;
  sim.lastShieldTickMs = 0;
  if (sim.weaponId === 1) syncSamuraiShield(sim, true);
  sim.reviveAvailable = true;
  sim.explosions = [];
  sim.bullets = [];
  sim.clones = [];
  sim.obstacles = createStageObstacles({ n: sim.nextId });
  sim.propBreaks = [];
  sim.ultFxUntilMs = 0;
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
  sim.spearThrustCharges = 0;
  sim.samuraiSlideCharges = 0;
  sim.shieldHp = 0;
  sim.lastShieldTickMs = 0;
  sim.reviveAvailable = true;
  if (sim.weaponId === 1) syncSamuraiShield(sim, true);
  sim.explosions = [];
  sim.bullets = [];
  sim.clones = [];
  sim.obstacles = createStageObstacles({ n: sim.nextId });
  sim.propBreaks = [];
  sim.ultFxUntilMs = 0;
  sim.flash = null;
  resetRunStats(sim);
  sim.pendingWaves = [];
  sim.wave = 0;
  sim.waveTotal = 0;
  if (tutorial) {
    sim.enemies = [];
    sim.run = "tutorial";
  } else {
    const nextId = { n: sim.nextId };
    const plan = createWavePlan(nextId);
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
        damagePlayer(sim, b.damage);
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

function damagePlayer(sim: Sim, amount: number): void {
  if (sim.run !== "playing") return;
  if (sim.nowMs - sim.lastHurtMs < CONTACT_IFRAME_MS) return;
  sim.lastHurtMs = sim.nowMs;
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
function engageDistance(e: Enemy, tx: number, ty: number): number {
  return Math.max(0, Math.hypot(e.x - tx, e.y - ty) - e.r - PLAYER_RADIUS);
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
    return e.kind === "megaboss" ? MEGABOSS_LUNGE_TELEGRAPH_RADIUS : BOSS_LUNGE_TELEGRAPH_RADIUS;
  }
  return e.kind === "boss" ? BOSS_ATTACK_RADIUS : MEGABOSS_ATTACK_RADIUS;
}

function startEnemyWindup(sim: Sim, e: Enemy, tx: number, ty: number, attackKind: "lunge" | "slam" = "lunge"): void {
  const kind = e.kind;
  const resolved: "lunge" | "slam" = kind === "minion" ? "lunge" : attackKind;
  const windupMs = windupMsFor(e, resolved);
  const strikeMs = strikeMsFor(e, resolved);
  const dir = normalize(tx - e.x, ty - e.y);
  e.windupUntil = sim.nowMs + windupMs;
  e.strikeUntil = e.windupUntil + strikeMs;
  e.attackCdUntil = 0;
  e.attackX = dir.x;
  e.attackY = dir.y;
  e.attackRadius = telegraphRadiusFor(e, resolved);
  e.attackHit = false;
  e.attackKind = resolved;
  e.danmakuFired = false;
  e.lungeHit = false;
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
  const origin = { x: e.x, y: e.y, r: 0 };
  if (attackCircleHits(origin, radius, sim.player)) {
    damagePlayer(sim, dmg);
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
  e.attackCdUntil =
    sim.nowMs + (kind === "boss" ? BOSS_ATTACK_CD_MS : MEGABOSS_ATTACK_CD_MS);
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

function stepEnemies(sim: Sim, dtSec: number): void {
  for (const e of sim.enemies) {
    const now = sim.nowMs;
    const windup = e.windupUntil ?? 0;
    const strike = e.strikeUntil ?? 0;
    if (windup > 0 && now < windup) continue;
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
      if (e.attackKind === "lunge") {
        const step = MINION_LUNGE_SPEED * dtSec;
        e.x += (e.attackX ?? 1) * step;
        e.y += (e.attackY ?? 0) * step;
        const c = clampBody(sim, e.x, e.y, e.r);
        e.x = c.x;
        e.y = c.y;
        tryLungeStrikeHit(sim, e);
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
    const engage = engageDistance(e, tx, ty);
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
        if (sd > 1e-4 && sd < 0.92) {
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

function stepShield(sim: Sim): void {
  if (sim.weaponId !== 1) return;
  if (sim.run !== "playing" && sim.run !== "tutorial") return;
  while (sim.nowMs - sim.lastShieldTickMs >= SAMURAI_SHIELD_TICK_MS) {
    sim.lastShieldTickMs += SAMURAI_SHIELD_TICK_MS;
    sim.shieldHp = Math.min(SAMURAI_SHIELD_MAX, sim.shieldHp + 1);
  }
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
  if (sim.enemies.some((e) => bodiesOverlap(sim.player, e))) damagePlayer(sim, CONTACT_DAMAGE);
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
  stepShield(sim);
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

/** 看广告复活：回到 playing，1 HP，本局复活次数用尽。 */
export function reviveRun(sim: Sim): boolean {
  if (sim.run !== "lose" || !sim.reviveAvailable) return false;
  sim.run = "playing";
  sim.player.hp = 1;
  sim.reviveAvailable = false;
  sim.lastHurtMs = sim.nowMs;
  sim.shake = Math.max(sim.shake, 6);
  return true;
}

export function forfeitRevive(sim: Sim): void {
  if (sim.run !== "lose") return;
  sim.reviveAvailable = false;
}
