import { BOSS_RADIUS, MEGABOSS_RADIUS, MINION_RADIUS } from "./constants";

export type TrackId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type HeroId = 1 | 2 | 3;
export type WeaponId = HeroId;
export type RunState = "tutorial" | "playing" | "win" | "lose";
export type EnemyKind = "minion" | "boss" | "megaboss";

export interface RunStats {
  combo: number;
  maxCombo: number;
  comboUntilMs: number;
  totalDamage: number;
  beatHits: number;
  damageTaken: number;
}

export interface DamagePopup {
  id: number;
  x: number;
  y: number;
  amount: number;
  crit: boolean;
  untilMs: number;
}

export interface RunResult {
  outcome: "win" | "lose";
  stars: 0 | 1 | 2 | 3;
  score: number;
  maxCombo: number;
  totalDamage: number;
  beatHits: number;
  hpLeft: number;
  damageTaken: number;
  trackId: TrackId;
  weaponId: WeaponId;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface Obstacle extends Circle {
  id: number;
  kind: "pillar" | "plinth" | "lantern" | "crate" | "barrel" | "grave";
  accent?: number;
  destructible?: boolean;
  hp?: number;
  maxHp?: number;
}

export interface Enemy extends Circle {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  /** >0：正在蓄力/前摇，结束前冻结移动。 */
  windupUntil?: number;
  /** >0：攻击判定/冲刺窗口结束。 */
  strikeUntil?: number;
  /** >0：攻击后摇，期间不移动也不再发动新攻击。 */
  attackCdUntil?: number;
  /** Boss 突刺独立冷却。 */
  lungeCdUntil?: number;
  attackX?: number;
  attackY?: number;
  attackRadius?: number;
  attackHit?: boolean;
  attackKind?: "lunge" | "slam";
  /** Boss 弹幕：本次 windup 是否已发射。 */
  danmakuFired?: boolean;
  /** 突刺窗口内是否已结算伤害（Boss 突刺 2 点）。 */
  lungeHit?: boolean;
}

export interface Bullet extends Circle {
  id: number;
  team: "player" | "enemy";
  ox: number;
  oy: number;
  ux: number;
  uy: number;
  traveled: number;
  maxRange: number;
  damage: number;
  explosive: boolean;
  enhanced: boolean;
  fromClone: boolean;
  hitIds: Set<number>;
  active: boolean;
}

export interface PropBreakFx {
  untilMs: number;
  x: number;
  y: number;
  kind: Obstacle["kind"];
}

export interface ExplosionFx {
  untilMs: number;
  x: number;
  y: number;
  radius: number;
}

export interface Clone extends Circle {
  id: number;
  hp: number;
  maxHp: number;
  lastHurtMs: number;
}

export interface AttackFlash {
  untilMs: number;
  x: number;
  y: number;
  radius: number;
  kind: "circle" | "semicircle" | "arc" | "line" | "ult";
  facingX: number;
  facingY: number;
  onBeat: boolean;
  path: Circle[] | null;
  arcDeg?: number;
}

export interface Player extends Circle {
  hp: number;
  maxHp: number;
  facingX: number;
  facingY: number;
}

export interface Sim {
  nowMs: number;
  run: RunState;
  trackId: TrackId;
  weaponId: WeaponId;
  allowedWeapons: WeaponId[];
  player: Player;
  enemies: Enemy[];
  pendingWaves: Enemy[][];
  wave: number;
  waveTotal: number;
  bullets: Bullet[];
  clones: Clone[];
  obstacles: Obstacle[];
  propBreaks: PropBreakFx[];
  ultFxUntilMs: number;
  energy: number;
  lastAttackMs: number;
  lastSlideMs: number;
  lastHurtMs: number;
  slideUntil: number;
  slideFromX: number;
  slideFromY: number;
  slideToX: number;
  slideToY: number;
  spearThrustCharges: number;
  samuraiSlideCharges: number;
  shieldHp: number;
  lastShieldTickMs: number;
  explosions: ExplosionFx[];
  flash: AttackFlash | null;
  nextId: number;
  spawnX: number;
  spawnY: number;
  shake: number;
  stats: RunStats;
  damagePopups: DamagePopup[];
  /** 本局是否还能看广告复活（每局一次）。 */
  reviveAvailable: boolean;
}

export interface HudSnapshot {
  run: RunState;
  hp: number;
  maxHp: number;
  energy: number;
  energyMax: number;
  weaponId: WeaponId;
  allowedWeapons: WeaponId[];
  trackId: TrackId;
  enemyCount: number;
  pendingCount: number;
  wave: number;
  waveTotal: number;
  bossCount: number;
  megabossCount: number;
  nearestBossHp: number | null;
  nearestBossMax: number | null;
  beatPhase01: number;
  inZone: boolean;
  beatProximity: number;
  windowFrac: number;
  ultReady: boolean;
  spearThrustCharges: number;
  samuraiSlideCharges: number;
  shieldHp: number;
  latencyMs: number;
  muted: boolean;
  onBeatFlash: boolean;
  paused: boolean;
  combo: number;
  maxCombo: number;
  reviveAvailable: boolean;
  runResult: RunResult | null;
}

export interface MusicProfile {
  trackId: TrackId;
  name: string;
  composer: string;
  bpmLabel: number;
  beatTimesMs: readonly number[];
  loopMs: number;
  loopBeats: number;
  melodyNotes?: readonly (readonly [midi: number, startBeat: number, durBeats: number])[];
  bassNotes?: readonly (readonly [midi: number, startBeat: number, durBeats: number])[];
  style?: "gentle" | "march" | "dance" | "rhapsody";
  /** 电音战歌等程序合成 loop，不走名曲旋律 */
  synth?: "edm" | "melody";
  /** 可选：放入 web/public/audio/track-N.ogg 即优先播放录音（edm 曲目忽略） */
  audioUrl?: string;
}

export function radiusForKind(kind: EnemyKind): number {
  if (kind === "megaboss") return MEGABOSS_RADIUS;
  return kind === "boss" ? BOSS_RADIUS : MINION_RADIUS;
}
