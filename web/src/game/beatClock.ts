import { BEAT_SILVER_PRE_MS, BEAT_WINDOW_MS, HUD_GRACE_MS } from "./constants";
import type { MusicProfile } from "./types";

/** loop 内时间 t 到最近拍点的最短距离（毫秒）。 */
function distToNearestBeat(t: number, beats: readonly number[], loopMs: number): number {
  if (beats.length === 0) return Infinity;
  let best = Infinity;
  for (const beat of beats) {
    let d = Math.abs(t - beat);
    d = Math.min(d, loopMs - d);
    if (d < best) best = d;
  }
  return best;
}

/** 相对最近拍点的有符号偏移（负=拍前，正=拍后）。 */
function offsetFromNearestBeat(
  t: number,
  beats: readonly number[],
  loopMs: number,
): { offsetMs: number } {
  if (beats.length === 0) return { offsetMs: Infinity };
  let bestOffset = Infinity;
  for (const beat of beats) {
    let offset = t - beat;
    if (offset > loopMs / 2) offset -= loopMs;
    if (offset < -loopMs / 2) offset += loopMs;
    if (Math.abs(offset) < Math.abs(bestOffset)) bestOffset = offset;
  }
  return { offsetMs: bestOffset };
}

export class BeatGridClock {
  loopMs: number;
  beatTimesMs: number[];
  periodMs: number;
  beatWindowMs: number;
  audioLatencyMs: number;

  constructor(profile: MusicProfile, beatWindowMs = BEAT_WINDOW_MS, audioLatencyMs = 0) {
    this.loopMs = profile.loopMs;
    this.beatTimesMs = [...profile.beatTimesMs];
    this.periodMs = medianBeatPeriod(this.beatTimesMs, profile.loopMs);
    this.beatWindowMs = beatWindowMs;
    this.audioLatencyMs = audioLatencyMs;
  }

  /** 录音实际时长与 JSON 不一致时，按比例缩放拍点。 */
  syncToAudioDuration(audioDurationMs: number): void {
    if (audioDurationMs <= 0 || this.beatTimesMs.length === 0) return;
    const scale = audioDurationMs / this.loopMs;
    if (Math.abs(scale - 1) < 0.001) {
      this.loopMs = audioDurationMs;
      return;
    }
    this.beatTimesMs = this.beatTimesMs.map((t) => t * scale);
    this.loopMs = audioDurationMs;
    this.periodMs = medianBeatPeriod(this.beatTimesMs, this.loopMs);
  }

  tLoop(timelineMs: number): number {
    if (this.loopMs <= 0) return 0;
    const t = ((timelineMs % this.loopMs) + this.loopMs) % this.loopMs;
    return t;
  }

  private goldHalfMs(): number {
    return this.beatWindowMs / 2;
  }

  private offsetForBeat(tLoop: number, beatMs: number): number {
    let offset = tLoop - beatMs;
    if (offset > this.loopMs / 2) offset -= this.loopMs;
    if (offset < -this.loopMs / 2) offset += this.loopMs;
    return offset;
  }

  beatOffsetMs(timelineMs: number): number {
    return offsetFromNearestBeat(this.tLoop(timelineMs), this.beatTimesMs, this.loopMs).offsetMs;
  }

  /** 金环亮区：拍点 ± 半窗。 */
  hudInZone(timelineMs: number): boolean {
    const half = this.goldHalfMs();
    const t = this.tLoop(timelineMs);
    return this.beatTimesMs.some((beat) => Math.abs(this.offsetForBeat(t, beat)) <= half);
  }

  /** 银环专属阶段：金环亮起前 BEAT_SILVER_PRE_MS。 */
  hudInSilverZone(timelineMs: number): boolean {
    const half = this.goldHalfMs();
    const t = this.tLoop(timelineMs);
    return this.beatTimesMs.some((beat) => {
      const offset = this.offsetForBeat(t, beat);
      return offset >= -(half + BEAT_SILVER_PRE_MS) && offset < -half;
    });
  }

  /** 强普判定区：银环亮起 → 金环结束（全英雄通用）。 */
  combatBeatZone(timelineMs: number): boolean {
    const half = this.goldHalfMs();
    const t = this.tLoop(timelineMs);
    return this.beatTimesMs.some((beat) => {
      const offset = this.offsetForBeat(t, beat);
      return offset >= -(half + BEAT_SILVER_PRE_MS) && offset <= half;
    });
  }

  /** 当前在相邻两拍之间的进度 0→1（用于节拍条游标）。 */
  beatPhase01(timelineMs: number): number {
    const t = this.tLoop(timelineMs);
    const beats = this.beatTimesMs;
    const n = beats.length;
    if (n === 0) return 0;
    for (let i = 0; i < n; i++) {
      const start = beats[i]!;
      const rawEnd = beats[(i + 1) % n]!;
      const end = rawEnd + (i + 1 >= n ? this.loopMs : 0);
      if (start <= t && t < end) {
        const span = end - start;
        return span > 1e-6 ? (t - start) / span : 0;
      }
    }
    return 0;
  }

  hudWindowFrac(): number {
    const half = this.goldHalfMs();
    return Math.max(0.08, Math.min(0.45, half / this.periodMs));
  }

  /** 银环预警区宽度（含金环半宽 + 提前量），用于节拍条外圈。 */
  hudSilverPreFrac(): number {
    const half = this.goldHalfMs();
    return Math.max(0.1, Math.min(0.55, (half + BEAT_SILVER_PRE_MS) / this.periodMs));
  }

  judgmentForCombat(
    inputTimelineMs: number,
    hudWasCombat: boolean,
    hudTimelineMs: number,
    graceMs = HUD_GRACE_MS,
  ): boolean {
    if (this.combatBeatZone(inputTimelineMs)) return true;
    if (hudWasCombat && Math.abs(inputTimelineMs - hudTimelineMs) <= graceMs) return true;
    return false;
  }

  beatProximity(timelineMs: number): number {
    const t = this.tLoop(timelineMs);
    const half = this.goldHalfMs();
    const dist = distToNearestBeat(t, this.beatTimesMs, this.loopMs);
    if (dist <= half) return 1;
    const silverEdge = half + BEAT_SILVER_PRE_MS;
    if (dist <= silverEdge) return 0.55 + (0.45 * (silverEdge - dist)) / BEAT_SILVER_PRE_MS;
    const span = Math.max(silverEdge, this.periodMs * 0.35);
    return Math.max(0, 1 - (dist - silverEdge) / span);
  }

  beatIndexAt(timelineMs: number): number {
    const t = this.tLoop(timelineMs);
    const beats = this.beatTimesMs;
    const n = beats.length;
    if (n === 0) return 0;
    for (let i = 0; i < n; i++) {
      const start = beats[i]!;
      const rawEnd = beats[(i + 1) % n]!;
      const end = rawEnd + (i + 1 >= n ? this.loopMs : 0);
      if (start <= t && t < end) return i;
    }
    return 0;
  }

  beatSlotKey(timelineMs: number): string {
    const loop = Math.floor(timelineMs / this.loopMs);
    const t = this.tLoop(timelineMs);
    const beats = this.beatTimesMs;
    const n = beats.length;
    if (n === 0) return `${loop}:0`;
    const half = this.goldHalfMs();
    const combatPre = half + BEAT_SILVER_PRE_MS;
    for (let i = 0; i < n; i++) {
      const offset = this.offsetForBeat(t, beats[i]!);
      if (offset >= -combatPre && offset <= half) return `${loop}:${i}`;
    }
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const start = beats[i]!;
      const dist = Math.min(Math.abs(start - t), this.loopMs - Math.abs(start - t));
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return `${loop}:${bestIdx}`;
  }
}

/** 相邻拍间隔中位数，比 loop/拍数 更适合不规则/onset 解析曲。 */
function medianBeatPeriod(beats: readonly number[], loopMs: number): number {
  if (beats.length < 2) return loopMs / Math.max(1, beats.length);
  const gaps: number[] = [];
  for (let i = 0; i < beats.length; i++) {
    const start = beats[i]!;
    const end = i + 1 < beats.length ? beats[i + 1]! : loopMs;
    gaps.push(end - start);
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? loopMs / beats.length;
}

export function regularBeatGrid(
  bpm: number,
  bars = 8,
  beatsPerBar = 4,
): { times: number[]; loopMs: number } {
  const period = 60_000 / bpm;
  const n = bars * beatsPerBar;
  const times: number[] = [];
  for (let i = 0; i < n; i++) times.push(i * period);
  return { times, loopMs: n * period };
}
