import { BEAT_WINDOW_MS, HUD_GRACE_MS } from "./constants";
import type { MusicProfile } from "./types";

export class BeatGridClock {
  loopMs: number;
  beatTimesMs: readonly number[];
  periodMs: number;
  beatWindowMs: number;
  audioLatencyMs: number;

  constructor(profile: MusicProfile, beatWindowMs = BEAT_WINDOW_MS, audioLatencyMs = 0) {
    this.loopMs = profile.loopMs;
    this.beatTimesMs = profile.beatTimesMs;
    this.periodMs = profile.loopMs / Math.max(1, profile.beatTimesMs.length);
    this.beatWindowMs = beatWindowMs;
    this.audioLatencyMs = audioLatencyMs;
  }

  tLoop(timelineMs: number): number {
    if (this.loopMs <= 0) return 0;
    const t = ((timelineMs % this.loopMs) + this.loopMs) % this.loopMs;
    return t;
  }

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
    return Math.max(0.18, Math.min(0.45, this.beatWindowMs / this.periodMs));
  }

  hudInZone(timelineMs: number): boolean {
    const p = this.beatPhase01(timelineMs);
    const w = this.hudWindowFrac();
    return p <= w || p >= 1.0 - w;
  }

  judgmentForCombat(
    inputTimelineMs: number,
    hudWasOk: boolean,
    hudTimelineMs: number,
    graceMs = HUD_GRACE_MS,
  ): boolean {
    if (this.hudInZone(inputTimelineMs)) return true;
    if (hudWasOk && Math.abs(inputTimelineMs - hudTimelineMs) <= graceMs) return true;
    return false;
  }

  beatProximity(timelineMs: number): number {
    if (this.hudInZone(timelineMs)) return 1;
    const p = this.beatPhase01(timelineMs);
    const w = this.hudWindowFrac();
    const gap = p < 0.5 ? Math.max(0, p - w) : Math.max(0, 1 - w - p);
    const span = Math.max(0.06, 0.5 - w);
    return Math.max(0, 1 - gap / span);
  }

  /** 当前时间落在哪一拍（loop 内索引）。 */
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

  /** 跨 loop 唯一的拍子槽位键，用于「一拍只强化一次」。 */
  beatSlotKey(timelineMs: number): string {
    const loop = Math.floor(timelineMs / this.loopMs);
    const t = this.tLoop(timelineMs);
    const beats = this.beatTimesMs;
    const n = beats.length;
    if (n === 0) return `${loop}:0`;
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
