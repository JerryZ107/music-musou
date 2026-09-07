import { BOSS_RADIUS, MEGABOSS_RADIUS, MINION_RADIUS } from "./constants";

export type TrackId = 1 | 2 | 3;
export type LevelId = 1 | 2;
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
  levelId: LevelId;
  weaponId: WeaponId;
  goldEarned?: number;
  trackUnlocked?: TrackId | null;
  levelUnlocked?: LevelId | null;
  shopUnlocked?: boolean;
  promptShop?: boolean;
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
  /** 本次突刺应位移距离（与读条终点一致）。 */
  lungeDist?: number;
  lungeTraveled?: number;
  lungeSpeed?: number;
  lungeFromX?: number;
  lungeFromY?: number;
  lungeToX?: number;
  lungeToY?: number;
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
  startMs?: number;
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
  levelId: LevelId;
  weaponId: WeaponId;
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
  ultBuffUntilMs: number;
  spearUltAttacksLeft: number;
  spearAtkSpeedStacks: number;
  shieldHp: number;
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
  knockVX: number;
  knockVY: number;
}

export type BeatCue = {
  phase01: number;
  /** 金环亮区 */
  inZone: boolean;
  /** 银环预警（金环前 0.3s） */
  inSilverZone: boolean;
  /** 强普判定区（银环起至金环结束） */
  inCombatZone: boolean;
  proximity: number;
  windowFrac: number;
  silverPreFrac: number;
};

export interface HudSnapshot {
  run: RunState;
  hp: number;
  maxHp: number;
  energy: number;
  energyMax: number;
  weaponId: WeaponId;
  trackId: TrackId;
  levelId: LevelId;
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
  inSilverZone: boolean;
  inCombatZone: boolean;
  beatProximity: number;
  windowFrac: number;
  silverPreFrac: number;
  beatCount: number;
  ultReady: boolean;
  ultBuffRemainingMs: number;
  spearUltAttacksLeft: number;
  spearAtkSpeedStacks: number;
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
