import {
  BEAT_SILVER_PRE_MS,
  BEAT_WINDOW_MS,
  HUD_GRACE_MS,
  PULSE_DEDUP_MS,
  PULSE_PERIOD_MAX_MS,
  PULSE_PERIOD_MIN_MS,
} from "./constants";
import { assignBeatSkillTiers, type BeatSkillTier } from "./beatSkill";
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

/** 相邻拍间隔中位数，比 loop/拍数 更适合不规则/onset 解析曲。 */
export function medianBeatPeriod(beats: readonly number[], loopMs: number): number {
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

/**
 * 选取落在 [0.67s, 1s] 的规律脉冲周期。
 * 优先：2×中位间隔（半拍格）、再 BPM 半拍/整拍，并钳到目标区间。
 */
export function choosePulsePeriodMs(bpm: number, medianGapMs: number): number {
  const quarter = 60_000 / Math.max(1, bpm);
  const candidates = [medianGapMs * 2, medianGapMs, quarter * 2, quarter].filter(
    (p) => p >= PULSE_PERIOD_MIN_MS && p <= PULSE_PERIOD_MAX_MS,
  );
  if (candidates.length) {
    const mid = (PULSE_PERIOD_MIN_MS + PULSE_PERIOD_MAX_MS) / 2;
    return candidates.reduce((a, b) => (Math.abs(a - mid) <= Math.abs(b - mid) ? a : b));
  }
  const half = quarter * 2;
  return Math.max(PULSE_PERIOD_MIN_MS, Math.min(PULSE_PERIOD_MAX_MS, half));
}

/** 选与现有拍点相位最吻合的脉冲起点。 */
export function bestPulseOffsetMs(
  beats: readonly number[],
  periodMs: number,
): number {
  if (beats.length === 0 || periodMs <= 0) return 0;
  const candidates = new Set<number>();
  const sample = Math.min(beats.length, 48);
  for (let i = 0; i < sample; i++) {
    const b = beats[i]!;
    candidates.add(((b % periodMs) + periodMs) % periodMs);
  }
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const off of candidates) {
    let score = 0;
    for (const b of beats) {
      const phase = (((b - off) % periodMs) + periodMs) % periodMs;
      const d = Math.min(phase, periodMs - phase);
      score -= d;
    }
    if (score > bestScore) {
      bestScore = score;
      best = off;
    }
  }
  return best;
}

/**
 * 在原拍点上按规律脉冲额外补点：格点附近已有拍则不重设，原拍全部保留。
 */
export function augmentBeatsWithRegularPulse(
  beats: readonly number[],
  loopMs: number,
  periodMs: number,
  offsetMs: number,
  dedupMs = PULSE_DEDUP_MS,
): number[] {
  const out = [...beats].filter((t) => t >= 0 && t < loopMs).sort((a, b) => a - b);
  if (periodMs <= 0 || loopMs <= 0) return out;
  let t = ((offsetMs % periodMs) + periodMs) % periodMs;
  // 避免 offset==0 时漏掉与 loop 重合的末拍：只铺 [0, loop)
  for (; t < loopMs - 1e-6; t += periodMs) {
    if (distToNearestBeat(t, out, loopMs) > dedupMs) {
      out.push(Math.round(t * 1000) / 1000);
    }
  }
  return out.sort((a, b) => a - b);
}

/** 为曲目生成：保留原拍 + 0.67～1s 脉冲补点。 */
export function withRegularPulseBeats(
  beats: readonly number[],
  loopMs: number,
  bpm: number,
): { beatTimesMs: number[]; pulsePeriodMs: number } {
  const medianGap = medianBeatPeriod(beats, loopMs);
  const pulsePeriodMs = choosePulsePeriodMs(bpm, medianGap);
  const offsetMs = bestPulseOffsetMs(beats, pulsePeriodMs);
  const beatTimesMs = augmentBeatsWithRegularPulse(beats, loopMs, pulsePeriodMs, offsetMs);
  return { beatTimesMs, pulsePeriodMs };
}

export class BeatGridClock {
  loopMs: number;
  beatTimesMs: number[];
  beatSkillTiers: BeatSkillTier[];
  periodMs: number;
  beatWindowMs: number;
  audioLatencyMs: number;

  constructor(profile: MusicProfile, beatWindowMs = BEAT_WINDOW_MS, audioLatencyMs = 0) {
    this.loopMs = profile.loopMs;
    this.beatTimesMs = [...profile.beatTimesMs];
    this.beatSkillTiers =
      profile.beatSkillTiers && profile.beatSkillTiers.length === this.beatTimesMs.length
        ? [...profile.beatSkillTiers]
        : assignBeatSkillTiers(this.beatTimesMs.length, profile.trackId);
    this.periodMs = profile.pulsePeriodMs ?? medianBeatPeriod(this.beatTimesMs, profile.loopMs);
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
    this.periodMs *= scale;
    this.loopMs = audioDurationMs;
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

  /** 强普判定区：仅金环（银环只作预警）。 */
  combatBeatZone(timelineMs: number): boolean {
    return this.hudInZone(timelineMs);
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

  /**
   * 金环归属拍槽。重合区内优先更早的拍；已消耗的拍跳过，顺延到下一重合拍，
   * 从而可在连续重合金环内连出多段强普。
   */
  beatSlotKey(timelineMs: number, consumedSlots: ReadonlySet<string> | null = null): string {
    const loop = Math.floor(timelineMs / this.loopMs);
    const t = this.tLoop(timelineMs);
    const beats = this.beatTimesMs;
    const n = beats.length;
    if (n === 0) return `${loop}:0`;
    const half = this.goldHalfMs();
    const hits: number[] = [];
    for (let i = 0; i < n; i++) {
      const offset = this.offsetForBeat(t, beats[i]!);
      if (offset >= -half && offset <= half) hits.push(i);
    }
    if (hits.length > 0) {
      for (const i of hits) {
        const key = `${loop}:${i}`;
        if (!consumedSlots?.has(key)) return key;
      }
      return `${loop}:${hits[hits.length - 1]!}`;
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
