import { BOSS_RADIUS, MEGABOSS_RADIUS, MINION_RADIUS } from "./constants";
import type { BeatSkillTier } from "./beatSkill";

export type { BeatSkillTier };

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
  /** >now：眩晕，冻结移动与攻击。 */
  stunUntilMs?: number;
  /** >now：减速中。 */
  slowUntilMs?: number;
  /** 减速倍率（如寒冰 0.3）。 */
  slowFactor?: number;
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
  /** 武士剑气等穿透弹。 */
  pierce?: boolean;
  /** 可视化/碰撞样式。 */
  style?: "normal" | "swordWave" | "iceArrow" | "lightningBolt";
  /** 延迟激活（剑气分段从身上依次发出）。 */
  wakeAtMs?: number;
}

/** 弓使雷电箭命中后外扩的带电波。 */
export interface ShockWave {
  id: number;
  x: number;
  y: number;
  /** 当前半径。 */
  radius: number;
  maxRadius: number;
  speed: number;
  damage: number;
  hitIds: Set<number>;
  active: boolean;
}

/** 武士重节拍环绕飞剑（护盾：1 剑挡 1 血）。 */
export interface OrbitSword extends Circle {
  id: number;
  angle: number;
  omega: number;
  orbitR: number;
  untilMs: number;
  damage: number;
  lastHitMs: Map<number, number>;
}

/** 武士大招矮龙卷：寻敌飞行，撞敌后驻留；持续伤害按自旋每圈结算。 */
export interface SwordTornado extends Circle {
  id: number;
  ux: number;
  uy: number;
  traveled: number;
  maxRange: number;
  seeking: boolean;
  /** 驻留结束时刻；寻敌中为 0。 */
  untilMs: number;
  lastTickMs: number;
  impactDone: boolean;
  active: boolean;
}

/** 剑气命中消散特效。 */
export interface SwordWavePopFx {
  untilMs: number;
  x: number;
  y: number;
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
  /** 卡拍爆裂箭等强化爆炸。 */
  enhanced?: boolean;
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
  /** 轻节拍挥刀/突刺星屑。 */
  sparkle?: boolean;
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
  /** 武士环绕飞剑（可叠加）。 */
  orbitSwords: OrbitSword[];
  /** 武士大招矮龙卷。 */
  tornados: SwordTornado[];
  /** 剑气命中消散。 */
  swordWavePops: SwordWavePopFx[];
  /** 弓使大招带电波。 */
  shockWaves: ShockWave[];
  nextId: number;
  spawnX: number;
  spawnY: number;
  shake: number;
  stats: RunStats;
  damagePopups: DamagePopup[];
  /** 本局是否还能看广告复活（每局一次）。 */
  reviveAvailable: boolean;
  /** 复活冻结倒计时结束时刻；> nowMs 时世界暂停。 */
  reviveHoldUntilMs: number;
  /** 复活无敌结束时刻（含倒计时 + 之后 1s）。 */
  reviveGraceUntilMs: number;
  knockVX: number;
  knockVY: number;
}

export type BeatCue = {
  phase01: number;
  /** 金环亮区 */
  inZone: boolean;
  /** 银环预警（金环前，仅提示） */
  inSilverZone: boolean;
  /** 强普判定区（仅金环） */
  inCombatZone: boolean;
  proximity: number;
  windowFrac: number;
  silverPreFrac: number;
  /** 角色圆环进度条用 */
  timelineMs: number;
  periodMs: number;
  loopMs: number;
  beatTimesMs: readonly number[];
  beatWindowMs: number;
  /** 普攻/滑步在时间轴上的打点痕迹（随窗口滚动刷新）。 */
  inputMarks: readonly { absMs: number; onBeat: boolean }[];
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
  /** 音频时间轴（含 latency 校正），供顶端节拍进度条。 */
  timelineMs: number;
  loopMs: number;
  /** 与判定时钟同源的拍点表（同引用，勿每帧拷贝）。 */
  beatTimesMs: readonly number[];
  /** 与拍点一一对应的技能分档（武士进度条配色）。 */
  beatSkillTiers: readonly BeatSkillTier[];
  /** 普攻/滑步打点痕迹。 */
  inputMarks: readonly { absMs: number; onBeat: boolean }[];
  ultReady: boolean;
  ultBuffRemainingMs: number;
  spearUltAttacksLeft: number;
  spearAtkSpeedStacks: number;
  shieldHp: number;
  /** 武士环绕飞剑数量。 */
  orbitSwordCount: number;
  latencyMs: number;
  muted: boolean;
  onBeatFlash: boolean;
  paused: boolean;
  combo: number;
  maxCombo: number;
  reviveAvailable: boolean;
  /** 复活冻结剩余毫秒；0 表示未在倒计时。 */
  reviveHoldMs: number;
  /** 复活无敌剩余毫秒。 */
  reviveGraceMs: number;
  runResult: RunResult | null;
}

export interface MusicProfile {
  trackId: TrackId;
  name: string;
  composer: string;
  bpmLabel: number;
  beatTimesMs: readonly number[];
  /** 与 beatTimesMs 对齐的武士技能分档。 */
  beatSkillTiers?: readonly BeatSkillTier[];
  loopMs: number;
  loopBeats: number;
  /** 额外规律脉冲周期（0.67s～1s）；HUD 节拍条比例优先用它。 */
  pulsePeriodMs?: number;
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
