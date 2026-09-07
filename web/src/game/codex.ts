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
    stats: { attackSpeed: 14, dashRange: 15, attackRange: 10 },
    passive:
      "拥有强大的防御力与冲刺能力。常态冲刺距离 +5 点（合计 15 点）；每次强化普攻命中敌人后获得一层上限 1 滴血的护盾。",
    ultimate:
      "进入狂暴状态 12 秒：强化普攻伤害 +2 点，冲刺距离再 +5 点（合计 20 点）。适合在亮区连斩叠盾后一口气撕开尸潮。",
  },
  2: {
    id: 2,
    title: "青衫枪客",
    role: "擅武的枪兵",
    stats: { attackSpeed: 20, dashRange: 10, attackRange: 15 },
    passive:
      "拥有优秀的攻击范围与小范围横扫能力。攻击范围 15 点、攻速 20 点；卡拍时扇面更宽。",
    ultimate:
      "游龙：接下来 7 次攻击强化为突刺，伤害 +1 点、攻速 +2 点；这 7 次卡拍命中不计入大招充能。",
  },
  3: {
    id: 3,
    title: "灵耳弓使",
    role: "远程弓使",
    stats: { attackSpeed: 20, dashRange: 10, attackRange: 40 },
    passive:
      "拥有不俗的攻速与极远的攻击范围。常态攻速 20 点、弹程 40 点；强化普攻为爆裂箭，命中后造成小范围 2 点伤害。",
    ultimate:
      "原地留下一个分身：分身拥有弓使的攻击范围与攻速，但伤害固定 1 点且无法发射爆裂弹，生命 1 点，随弓使攻击而攻击。",
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
