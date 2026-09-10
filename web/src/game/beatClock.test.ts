import { describe, expect, it } from "vitest";
import {
  BeatGridClock,
  augmentBeatsWithRegularPulse,
  choosePulsePeriodMs,
  regularBeatGrid,
  withRegularPulseBeats,
} from "./beatClock";
import { PULSE_PERIOD_MAX_MS, PULSE_PERIOD_MIN_MS } from "./constants";
import { TRACKS } from "./tracks";
import track1Beats from "./track-1-beats.json";

describe("regular pulse augment", () => {
  it("脉冲周期落在 0.67s～1s", () => {
    expect(choosePulsePeriodMs(127, 465)).toBeGreaterThanOrEqual(PULSE_PERIOD_MIN_MS);
    expect(choosePulsePeriodMs(127, 465)).toBeLessThanOrEqual(PULSE_PERIOD_MAX_MS);
    expect(choosePulsePeriodMs(127, 465)).toBeCloseTo(930, 0);
  });

  it("原拍全部保留，仅在空档补点", () => {
    const raw = track1Beats.beatTimesMs as number[];
    const { beatTimesMs, pulsePeriodMs } = withRegularPulseBeats(
      raw,
      track1Beats.durationMs,
      track1Beats.bpm,
    );
    expect(pulsePeriodMs).toBeGreaterThanOrEqual(PULSE_PERIOD_MIN_MS);
    expect(pulsePeriodMs).toBeLessThanOrEqual(PULSE_PERIOD_MAX_MS);
    expect(beatTimesMs.length).toBeGreaterThanOrEqual(raw.length);
    for (const b of raw) {
      expect(beatTimesMs.some((t) => Math.abs(t - b) < 0.5)).toBe(true);
    }
  });

  it("附近已有拍则不重设", () => {
    const beats = [0, 900, 1800];
    const merged = augmentBeatsWithRegularPulse(beats, 2700, 900, 0, 120);
    expect(merged).toEqual([0, 900, 1800]);
  });
});

describe("BeatGridClock", () => {
  it("首曲强拍时刻处于亮区", () => {
    const p = TRACKS[1];
    const clock = new BeatGridClock(p, 300, 0);
    const beat0 = p.beatTimesMs[0]!;
    expect(clock.hudInZone(beat0)).toBe(true);
    expect(clock.combatBeatZone(beat0)).toBe(true);
    expect(p.beatTimesMs.length).toBeGreaterThan(8);
  });

  it("第二曲拍点落在 loop 内", () => {
    const p = TRACKS[2];
    expect(p.beatTimesMs.length).toBeGreaterThan(8);
    expect(p.beatTimesMs.every((t) => t >= 0 && t < p.loopMs)).toBe(true);
    const clock = new BeatGridClock(p, 300, 0);
    expect(clock.hudInZone(p.beatTimesMs[0]!)).toBe(true);
  });

  it("拍点间隔中点不在金环亮区", () => {
    const times = [0, 1000, 2000];
    const loopMs = 3000;
    const clock = new BeatGridClock({ ...TRACKS[1], beatTimesMs: times, loopMs }, 300, 0);
    expect(clock.hudInZone(0)).toBe(true);
    expect(clock.hudInZone(500)).toBe(false);
  });

  it("银环预警区：金环前仅预警，不可判强普", () => {
    const { times, loopMs } = regularBeatGrid(120, 4, 4);
    const clock = new BeatGridClock({ ...TRACKS[1], beatTimesMs: times, loopMs }, 300, 0);
    const beat = times[1]!;
    const silverAt = beat - 200;
    expect(clock.hudInSilverZone(silverAt)).toBe(true);
    expect(clock.hudInZone(silverAt)).toBe(false);
    expect(clock.combatBeatZone(silverAt)).toBe(false);
  });

  it("强普区在金环结束后关闭", () => {
    const { times, loopMs } = regularBeatGrid(60, 4, 4);
    const clock = new BeatGridClock({ ...TRACKS[1], beatTimesMs: times, loopMs }, 300, 0);
    const beat = times[0]!;
    expect(clock.combatBeatZone(beat + 150)).toBe(true);
    expect(clock.combatBeatZone(beat + 151)).toBe(false);
  });

  it("beatSlotKey 在同一拍金环内稳定", () => {
    const times = [0, 1000, 2000];
    const loopMs = 3000;
    const clock = new BeatGridClock({ ...TRACKS[1], beatTimesMs: times, loopMs }, 300, 0);
    const beat1 = 1000;
    const a = clock.beatSlotKey(beat1 + 20);
    const b = clock.beatSlotKey(beat1 + 80);
    expect(a).toBe(b);
    expect(clock.beatSlotKey(loopMs + beat1 + 20)).not.toBe(a);
  });

  it("重合金环：已消耗上一拍后切到下一拍", () => {
    const times = [0, 120, 240];
    const loopMs = 2000;
    const clock = new BeatGridClock({ ...TRACKS[1], beatTimesMs: times, loopMs }, 300, 0);
    const t = 120;
    expect(clock.combatBeatZone(t)).toBe(true);
    const consumed = new Set<string>();
    const first = clock.beatSlotKey(t, consumed);
    expect(first).toBe("0:0");
    consumed.add(first);
    const second = clock.beatSlotKey(t, consumed);
    expect(second).toBe("0:1");
    consumed.add(second);
    const third = clock.beatSlotKey(t, consumed);
    expect(third).toBe("0:2");
    consumed.add(third);
    expect(clock.beatSlotKey(t, consumed)).toBe(third);
  });

  it("regularBeatGrid 长度与 loop 对齐", () => {
    const g = regularBeatGrid(140);
    expect(g.times).toHaveLength(32);
    expect(g.loopMs).toBeCloseTo(32 * (60000 / 140), 5);
  });

  it("全部 Track 拍点表有效且含脉冲周期", () => {
    for (const t of Object.values(TRACKS)) {
      expect(t.beatTimesMs.length).toBeGreaterThan(8);
      expect(t.beatTimesMs.every((ms) => ms >= 0 && ms < t.loopMs)).toBe(true);
      expect(t.pulsePeriodMs).toBeGreaterThanOrEqual(PULSE_PERIOD_MIN_MS);
      expect(t.pulsePeriodMs).toBeLessThanOrEqual(PULSE_PERIOD_MAX_MS);
      const clock = new BeatGridClock(t, 300, 0);
      expect(clock.hudInZone(t.beatTimesMs[0]!)).toBe(true);
      expect(clock.periodMs).toBe(t.pulsePeriodMs);
    }
  });
});
