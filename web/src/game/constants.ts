/** 在线试玩（GitHub Pages） */
export const PLAY_DEMO_URL = "https://jerryz107.github.io/music-musou/";

/** 连击窗口：超时未命中则清零。 */
export const COMBO_TIMEOUT_MS = 2400;

/** World units = 旧 Demo「格」。碰撞与绘制共用这些半径。 */

export const WORLD_W = 96;
export const WORLD_H = 72;
export const VIEW_W_DESKTOP = 24;
export const VIEW_H_DESKTOP = 18;
export const VIEW_W_TOUCH = 32;
export const VIEW_H_TOUCH = 16;

export const BEAT_WINDOW_MS = 300;
/** 金环亮起前银环预警时长（此期间起至金环结束均可判强普）。 */
export const BEAT_SILVER_PRE_MS = 300;
export const HUD_GRACE_MS = 0;
/** Web Audio currentTime 接近扬声器，默认比 pygame 130ms 更短。 */
export const DEFAULT_AUDIO_LATENCY_MS = 60;

export const MINION_COUNT = 48 * 3;
export const BOSS_COUNT = 4;
export const MEGABOSS_COUNT = 1;
export const MINION_HP = 2;
export const BOSS_HP = 12 * 2;
export const MEGABOSS_HP = BOSS_HP * 2;
export const SPAWN_CLEAR_RADIUS = 7;
export const MIN_ENEMY_SPAWN_DIST = 10;

export const PLAYER_HP = 5;
/** 看广告复活恢复血量。 */
export const REVIVE_HP = 3;
export const PLAYER_SPEED = 5.5;
export const MINION_SPEED = 1.8;
/** 尸王 / 王中王与小怪同速。 */
export const BOSS_SPEED = MINION_SPEED;
export const MEGABOSS_SPEED = MINION_SPEED;

/** 怪物攻击：前摇、判定窗口、后摇与索敌距离。 */
/** 杂兵突刺发动距离（体表到主角/分身，小于此距离即读条突刺）。 */
export const MINION_LUNGE_ATTACK_RANGE = 2.4;
/** @deprecated 旧贴脸判定，已改为 MINION_LUNGE_ATTACK_RANGE */
export const MINION_ATTACK_RANGE = 0.82;
export const MINION_WINDUP_MS = 580;
export const MINION_STRIKE_MS = 150;
export const MINION_LUNGE_SPEED = 7.5;
export const MINION_ATTACK_CD_MS = 1100;
export const MINION_TELEGRAPH_RADIUS = 1.08;
/** 尸王远程（弹幕+读条）发动距离：中远环，须大于突刺环。 */
export const BOSS_RANGED_ATTACK_RANGE = 10.5;
export const BOSS_WINDUP_MS = 720;
export const BOSS_STRIKE_MS = 180;
export const BOSS_ATTACK_RADIUS = 2.625;
export const BOSS_ATTACK_CD_MS = 4500;
export const BOSS_LUNGE_DAMAGE = 2;
/** 突刺命中判定圈（×2，与发动距离无关） */
export const BOSS_LUNGE_TELEGRAPH_RADIUS = 0.85 * 2 * 2 * 0.75;
/** 王中王远程发动距离。 */
export const MEGABOSS_RANGED_ATTACK_RANGE = 12.5;
export const MEGABOSS_WINDUP_MS = 850;
export const MEGABOSS_STRIKE_MS = 220;
export const MEGABOSS_ATTACK_RADIUS = 3.525;
export const MEGABOSS_ATTACK_CD_MS = 5400;
export const MEGABOSS_LUNGE_TELEGRAPH_RADIUS = 1.0 * 2 * 2 * 0.75;
/** @deprecated 使用 BOSS_RANGED_ATTACK_RANGE */
export const BOSS_ATTACK_RANGE = BOSS_RANGED_ATTACK_RANGE;
/** @deprecated 使用 MEGABOSS_RANGED_ATTACK_RANGE */
export const MEGABOSS_ATTACK_RANGE = MEGABOSS_RANGED_ATTACK_RANGE;

/**
 * Hit Volume：贴合 Q 版身体，不是脚底下那圈旧的大圆。
 * 接触伤害用同一半径，没有额外“怪物攻击距离”。
 */
export const PLAYER_RADIUS = 0.26;
export const MINION_RADIUS = 0.6;
export const BOSS_RADIUS = 1.17;
export const MEGABOSS_RADIUS = 1.575;
/** 弓使 / 分身相对武士·枪客的体型比例。 */
export const ARCHER_BODY_SCALE = 0.8;
export const CLONE_RADIUS = PLAYER_RADIUS * ARCHER_BODY_SCALE;
export const BULLET_RADIUS = 0.22;

/** 铁铠武士：在 r=4/3 基础上 ×1.3。 */
export const ATTACK_RANGE = (4.0 / 3) * 1.3;
/** 铁铠武士模型缩放。 */
export const SAMURAI_MODEL_SCALE = 2.5 * 0.75;
/** 普攻动作冷却（全角色）；与滑步冷却独立。 */
export const ACTION_COOLDOWN_MS = 130;
export const BASIC_ATTACK_DAMAGE = 1;
export const CONTACT_DAMAGE = 1;
export const CONTACT_IFRAME_MS = 500;
/** 受伤击退：瞬时位移 + 速度冲量（沿怪物反方向与攻击反方向合成）。 */
export const PLAYER_KNOCKBACK_BUMP = 0.42;
export const PLAYER_KNOCKBACK_IMPULSE = 3.8;
export const PLAYER_KNOCKBACK_DAMPING = 0.8;

export const SLIDE_DISTANCE = 3.0;
export const SLIDE_DURATION_MS = 110;
/** 滑步冷却：仅限制连续滑步，不受普攻 CD 影响。 */
export const SLIDE_COOLDOWN_MS = SLIDE_DURATION_MS;
export const SLIDE_PATH_SAMPLE = 0.55;

/** 全曲 BPM 略放慢（×0.92，约慢 8%）。 */
export const TRACK_BPM_SCALE = 0.92;

/** 青衫枪客：相对旧 r=6 缩至 3/5。 */
export const TEMPLATE2_ATTACK_RANGE = 6.0 * (3 / 5);
/** 青衫枪客模型与武士同大。 */
export const SPEAR_MODEL_SCALE = SAMURAI_MODEL_SCALE;
/** 灵耳弓使模型为枪客 0.8。 */
export const ARCHER_MODEL_SCALE = SAMURAI_MODEL_SCALE * ARCHER_BODY_SCALE;
export const SPEAR_ATTACK_RANGE_MULT = 1.8;
/** 尸王 / 王中王突刺发动距离（近身环，小于远程环）。 */
export const BOSS_LUNGE_ATTACK_RANGE = TEMPLATE2_ATTACK_RANGE;
export const MEGABOSS_LUNGE_ATTACK_RANGE = TEMPLATE2_ATTACK_RANGE * 1.12;
export const BOSS_LUNGE_CD_MS = 1000;
export const MEGABOSS_LUNGE_CD_MS = 1000;
/** 普攻 45°；卡拍强化 90°。 */
export const SPEAR_ARC_DEG = 45;
export const SPEAR_ONBEAT_ARC_DEG = 90;

/** 灵耳弓使：弹程在 ×1.6 后再缩至 2/3。 */
export const TEMPLATE3_BULLET_RANGE = 10.0 * 1.6 * (2 / 3);
export const TEMPLATE3_BULLET_SPEED = PLAYER_SPEED * 2.0;
export const TEMPLATE3_LOCK_RANGE = 18.0;
export const TEMPLATE3_CLONE_HP = 1;
export const TEMPLATE3_DAMAGE_FACTOR = 0.5;
export const TEMPLATE3_EXPLOSION_RADIUS = 1.35;
export const TEMPLATE3_EXPLOSION_DAMAGE = 2;

export const ULTIMATE_BEAT_CHARGES = 10;
export const ULT_FX_MS = 560;

/** Boss 弹幕 */
export const ENEMY_BULLET_RADIUS = 0.18;
export const ENEMY_BULLET_SPEED = 4.8;
export const ENEMY_BULLET_DAMAGE = 1;
export const ENEMY_BULLET_RANGE = 16;
export const BOSS_DANMAKU_COUNT = 7;
export const MEGABOSS_DANMAKU_COUNT = 14;
export const BOSS_DANMAKU_SPREAD_DEG = 42;
export const MEGABOSS_DANMAKU_RING_COUNT = 10;

/** 可破坏物 HP */
export const OBSTACLE_LANTERN_HP = 2;
export const OBSTACLE_CRATE_HP = 3;
export const OBSTACLE_BARREL_HP = 2;
export const OBSTACLE_GRAVE_HP = 4;

/** 铁铠武士被动：强化普攻命中获 1 层护盾，上限 1。 */
export const SAMURAI_SHIELD_MAX = 1;
/** 武士挥刀刀光时长；命中帧对齐脚下金环亮区。 */
export const SAMURAI_SWING_MS = 120;
export const SAMURAI_SWING_STRIKE_T = 0.5;
export const SAMURAI_SLIDE_SWING_MS = 160;

export const SLOT_COUNT = 3;
export const SAVE_KEY = "musicmusou.saves.v1";
