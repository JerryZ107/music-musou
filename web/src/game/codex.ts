import { STAT_TEMPLATE } from "./meta";
import type { HeroId, TrackId } from "./types";

export interface HeroCodexEntry {
  id: HeroId;
  title: string;
  role: string;
  stats: { attackSpeed: number; dashRange: number; attackRange: number };
  passive: string;
  ultimate: string;
}

export interface TrackCodexEntry {
  id: TrackId;
  title: string;
  artist: string;
  stage: string;
  lore: string;
  unlock: string;
}

export const CODEX_INTRO = `曲无双的世界以「节拍」为律：角色共用一套基础模板，再通过被动与大招改写手感。
基础模板：攻速 ${STAT_TEMPLATE.attackSpeed} 点 · 冲刺范围 ${STAT_TEMPLATE.dashRange} 点 · 攻击范围 ${STAT_TEMPLATE.attackRange} 点。`;

export const HERO_CODEX: Record<HeroId, HeroCodexEntry> = {
  1: {
    id: 1,
    title: "铁铠武士",
    role: "擅剑的武士",
    stats: { attackSpeed: 8, dashRange: 15, attackRange: 15 },
    passive:
      "攻速 8 点、攻击范围 15 点（与枪客同程）；普攻发 1 道小幅剑气（大剑气 1/3 宽、伤害 2）。绿节拍为圆形近战（范围×0.85）。重节拍飞剑环绕自身作护盾：1 剑挡 1 血，单次受击可按伤害量连扣多把。",
    ultimate: "怒气满：放出寻敌矮龙卷（无视障碍、无射程）；圆心触敌后驻留 3 秒（冲击 5 伤，之后每转一圈 3 伤）。",
  },
  2: {
    id: 2,
    title: "青衫枪客",
    role: "擅武的枪兵",
    stats: { attackSpeed: 14, dashRange: 10, attackRange: 15 },
    passive:
      "拥有优秀的攻击范围与小范围横扫能力。攻击范围 15 点、攻速 14 点；卡拍时扇面更宽。",
    ultimate:
      "游龙：接下来 7 次攻击强化为突刺，伤害 +1 点、攻速 +1 点；这 7 次卡拍命中不计入大招充能。",
  },
  3: {
    id: 3,
    title: "灵耳弓使",
    role: "远程弓使",
    stats: { attackSpeed: 14, dashRange: 10, attackRange: 40 },
    passive:
      "攻速 14 点、弹程 40 点。绿节拍爆裂箭 / 黄节拍寒冰箭：体积×2、3 发散射（扩散 2 伤；寒冰另减速至 30%）；粉节拍制作分身。",
    ultimate:
      "雷电箭（体积×4）：命中造成 5 伤与 1 秒眩晕，再以目标为中心外扩带电波（射程同弹程、较慢，波及 2 伤）。",
  },
};

export const TRACK_CODEX: Record<TrackId, TrackCodexEntry> = {
  1: {
    id: 1,
    title: "Recall",
    artist: "gabriawll · NCS",
    stage: "名曲",
    lore: "旋律如回忆闪回，节拍均匀而清晰。可与任意已解锁关卡搭配出战。",
    unlock: "注册即解锁。",
  },
  2: {
    id: 2,
    title: "whatdoyousee",
    artist: "GlitchCat · prodBigMike · NCS",
    stage: "名曲",
    lore: "节奏更密、鼓点更凶，适合高压决战场景。",
    unlock: "通关第一关后解锁商城招募。",
  },
  3: {
    id: 3,
    title: "I Still Hear Your Voice",
    artist: "johnny joined · Lynxie · NCS",
    stage: "名曲",
    lore: "空灵人声与推进鼓点交织，像是战场余音仍在耳畔回响。",
    unlock: "通关第二关后解锁。",
  },
};
