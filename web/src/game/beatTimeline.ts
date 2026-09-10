import { BEAT_TIMELINE_WINDOW_MS, BEAT_WINDOW_MS } from "./constants";
import type { BeatSkillTier } from "./beatSkill";

export { BEAT_TIMELINE_WINDOW_MS };

export type BeatTimelineView = {
  /** 窗口左边缘对应的绝对时间 */
  scrollLeftMs: number;
  /** 游标在窗口上的 0～1 位置；到达 lockFrac 后固定 */
  playheadFrac: number;
};

/**
 * 开局游标从 0 跑到 lockFrac，之后时间轴滚动、游标钉住。
 * 圆环：刷新点在正右(0)、针在最上(0.75) 时传 lockFrac=0.75。
 */
export function beatTimelineView(
  timelineMs: number,
  windowMs = BEAT_TIMELINE_WINDOW_MS,
  lockFrac = 0.5,
): BeatTimelineView {
  const t = Math.max(0, timelineMs);
  const lock = Math.max(0.05, Math.min(0.95, lockFrac));
  const lockMs = windowMs * lock;
  if (t < lockMs) {
    return { scrollLeftMs: 0, playheadFrac: t / windowMs };
  }
  return { scrollLeftMs: t - lockMs, playheadFrac: lock };
}

export type VisibleBeatMark = {
  absMs: number;
  frac: number;
  beatIndex: number;
  tier?: BeatSkillTier;
};

/**
 * 收集落在可视窗口内的绝对拍点时刻（含 loop 展开）。
 * 返回相对窗口左缘的归一化位置 0～1。
 */
export function visibleBeatMarks(
  beatTimesMs: readonly number[],
  loopMs: number,
  scrollLeftMs: number,
  windowMs: number,
  marginMs = BEAT_WINDOW_MS,
  beatSkillTiers?: readonly BeatSkillTier[],
): VisibleBeatMark[] {
  if (loopMs <= 0 || beatTimesMs.length === 0 || windowMs <= 0) return [];
  const start = scrollLeftMs - marginMs;
  const end = scrollLeftMs + windowMs + marginMs;
  const loopA = Math.floor(start / loopMs) - 1;
  const loopB = Math.ceil(end / loopMs) + 1;
  const out: VisibleBeatMark[] = [];
  for (let L = loopA; L <= loopB; L++) {
    for (let i = 0; i < beatTimesMs.length; i++) {
      const b = beatTimesMs[i]!;
      const absMs = L * loopMs + b;
      if (absMs < start || absMs > end) continue;
      out.push({
        absMs,
        frac: (absMs - scrollLeftMs) / windowMs,
        beatIndex: i,
        tier: beatSkillTiers?.[i],
      });
    }
  }
  return out;
}

/** 游标是否正压在该拍点的金环窗口内。 */
export function beatMarkHot(absMs: number, timelineMs: number, halfWindowMs = BEAT_WINDOW_MS / 2): boolean {
  return Math.abs(absMs - timelineMs) <= halfWindowMs;
}
