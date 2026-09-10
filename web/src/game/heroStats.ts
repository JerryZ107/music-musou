import { HERO_CODEX } from "./codex";
import { STAT_TEMPLATE } from "./meta";
import {
  ACTION_COOLDOWN_MS,
  ATTACK_RANGE,
  SLIDE_DISTANCE,
  SPEAR_ATTACK_RANGE_MULT,
  TEMPLATE2_ATTACK_RANGE,
  TEMPLATE3_BULLET_RANGE,
} from "./constants";
import type { WeaponId } from "./types";

/** 资料片：狂暴 / 游龙持续 12 秒。 */
export const HERO_ULT_DURATION_MS = 12_000;

/** 武士大招：强化普攻额外 +2 伤；冲刺距离再 +5 点（15→20）。 */
export const SAMURAI_ULT_ONBEAT_DAMAGE_BONUS = 2;
export const SAMURAI_ULT_DASH_BONUS = 5;

/** 枪客大招：突刺 +1 伤、攻速 +1 点；共 7 次强化攻击。 */
export const SPEAR_ULT_ATTACK_CHARGES = 7;
export const SPEAR_ULT_DAMAGE_BONUS = 1;
export const SPEAR_ULT_ATTACK_SPEED_BONUS = 1;

/** 枪客 15 点攻击范围标定（与旧版 TEMPLATE2 × 倍率一致）。 */
const SPEAR_RANGE_AT_15 = TEMPLATE2_ATTACK_RANGE * SPEAR_ATTACK_RANGE_MULT;

export function heroStatPoints(weaponId: WeaponId) {
  return HERO_CODEX[weaponId].stats;
}

export function ultBuffActive(sim: { weaponId: WeaponId; ultBuffUntilMs: number; nowMs: number }): boolean {
  return sim.nowMs < sim.ultBuffUntilMs;
}

export function samuraiUltActive(sim: { weaponId: WeaponId; ultBuffUntilMs: number; nowMs: number }): boolean {
  return sim.weaponId === 1 && ultBuffActive(sim);
}

export function spearUltActive(sim: { weaponId: WeaponId; spearUltAttacksLeft: number }): boolean {
  return sim.weaponId === 2 && sim.spearUltAttacksLeft > 0;
}

export function consumeSpearUltAttack(sim: { weaponId: WeaponId; spearUltAttacksLeft: number }): void {
  if (sim.weaponId === 2 && sim.spearUltAttacksLeft > 0) sim.spearUltAttacksLeft -= 1;
}

/** 攻速点 → 动作冷却（10 点 = 模板 ACTION_COOLDOWN_MS，约为旧基准攻速的 2/3）。 */
export function cooldownMsFor(sim: {
  weaponId: WeaponId;
  spearUltAttacksLeft: number;
}): number {
  const stats = heroStatPoints(sim.weaponId);
  let speed = stats.attackSpeed;
  if (spearUltActive(sim)) speed += SPEAR_ULT_ATTACK_SPEED_BONUS;
  return Math.round(ACTION_COOLDOWN_MS * (STAT_TEMPLATE.attackSpeed / speed));
}

/** 冲刺距离点 → 世界格（10 点 = SLIDE_DISTANCE）。 */
export function slideDistanceFor(sim: { weaponId: WeaponId; ultBuffUntilMs: number; nowMs: number }): number {
  const stats = heroStatPoints(sim.weaponId);
  const dash = stats.dashRange;
  return SLIDE_DISTANCE * (dash / STAT_TEMPLATE.dashRange);
}

/** 近战攻击半径：武士 / 枪客 15 点共用枪程标定。 */
export function attackRadiusFor(weaponId: WeaponId): number {
  const stats = heroStatPoints(weaponId);
  if (weaponId === 1 || weaponId === 2) {
    return SPEAR_RANGE_AT_15 * (stats.attackRange / 15);
  }
  return ATTACK_RANGE;
}

/** 弓使弹程：40 点 = TEMPLATE3_BULLET_RANGE。 */
export function bulletRangeFor(weaponId: WeaponId): number {
  const stats = heroStatPoints(weaponId);
  return TEMPLATE3_BULLET_RANGE * (stats.attackRange / 40);
}
