import { describe, expect, it } from "vitest";
import { BeatGridClock, regularBeatGrid } from "./beatClock";
import { TRACKS } from "./tracks";

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
    const p = TRACKS[1];
    const clock = new BeatGridClock(p, 300, 0);
    const b0 = p.beatTimesMs[0]!;
    const b1 = p.beatTimesMs[1]!;
    const mid = (b0 + b1) / 2;
    expect(clock.hudInZone(b0)).toBe(true);
    expect(clock.hudInZone(mid)).toBe(false);
  });

  it("银环预警区：金环前 0.3s 可判强普但金环未亮", () => {
    const { times, loopMs } = regularBeatGrid(120, 4, 4);
    const clock = new BeatGridClock({ ...TRACKS[1], beatTimesMs: times, loopMs }, 300, 0);
    const beat = times[1]!;
    const silverAt = beat - 250;
    expect(clock.hudInSilverZone(silverAt)).toBe(true);
    expect(clock.hudInZone(silverAt)).toBe(false);
    expect(clock.combatBeatZone(silverAt)).toBe(true);
  });

  it("强普区在金环结束后关闭", () => {
    const { times, loopMs } = regularBeatGrid(60, 4, 4);
    const clock = new BeatGridClock({ ...TRACKS[1], beatTimesMs: times, loopMs }, 300, 0);
    const beat = times[0]!;
    expect(clock.combatBeatZone(beat + 150)).toBe(true);
    expect(clock.combatBeatZone(beat + 151)).toBe(false);
  });

  it("beatSlotKey 在同一拍内稳定", () => {
    const clock = new BeatGridClock(TRACKS[1], 300, 0);
    const beat1 = TRACKS[1].beatTimesMs[1] ?? TRACKS[1].beatTimesMs[0]!;
    const a = clock.beatSlotKey(beat1 + 20);
    const b = clock.beatSlotKey(beat1 + 80);
    expect(a).toBe(b);
    const silver = clock.beatSlotKey(beat1 - 250);
    expect(silver).toBe(a);
    expect(clock.beatSlotKey(clock.loopMs + beat1 + 20)).not.toBe(a);
  });

  it("regularBeatGrid 长度与 loop 对齐", () => {
    const g = regularBeatGrid(140);
    expect(g.times).toHaveLength(32);
    expect(g.loopMs).toBeCloseTo(32 * (60000 / 140), 5);
  });

  it("全部 Track 拍点表有效", () => {
    for (const t of Object.values(TRACKS)) {
      expect(t.beatTimesMs.length).toBeGreaterThan(8);
      expect(t.beatTimesMs.every((ms) => ms >= 0 && ms < t.loopMs)).toBe(true);
      const clock = new BeatGridClock(t, 300, 0);
      expect(clock.hudInZone(t.beatTimesMs[0]!)).toBe(true);
    }
  });
});
