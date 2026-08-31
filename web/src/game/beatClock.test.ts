import { describe, expect, it } from "vitest";
import { BeatGridClock, regularBeatGrid } from "./beatClock";
import { TRACKS } from "./tracks";

describe("BeatGridClock", () => {
  it("120 BPM 电音战歌拍点处于亮区", () => {
    const p = TRACKS[1];
    const clock = new BeatGridClock(p, 300, 0);
    expect(clock.hudInZone(0)).toBe(true);
    expect(clock.hudInZone(500)).toBe(true);
    expect(clock.beatPhase01(250) > 0.4 && clock.beatPhase01(250) < 0.6).toBe(true);
    expect(clock.hudInZone(250)).toBe(false);
  });

  it("欢乐颂拍点表非空且落在 loop 内", () => {
    const p = TRACKS[2];
    expect(p.beatTimesMs.length).toBeGreaterThan(8);
    expect(p.beatTimesMs.every((t) => t >= 0 && t < p.loopMs)).toBe(true);
    const clock = new BeatGridClock(p, 300, 0);
    expect(clock.hudInZone(p.beatTimesMs[0]!)).toBe(true);
  });

  it("beatSlotKey 在同一拍内稳定", () => {
    const clock = new BeatGridClock(TRACKS[1], 300, 0);
    const a = clock.beatSlotKey(20);
    const b = clock.beatSlotKey(80);
    expect(a).toBe(b);
    expect(clock.beatSlotKey(clock.loopMs + 20)).not.toBe(a);
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
