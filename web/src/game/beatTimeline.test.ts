import { describe, expect, it } from "vitest";
import {
  beatMarkHot,
  beatTimelineView,
  visibleBeatMarks,
} from "./beatTimeline";

describe("beatTimelineView", () => {
  it("开局游标从左侧前进，窗口不滚动", () => {
    expect(beatTimelineView(0, 8000)).toEqual({ scrollLeftMs: 0, playheadFrac: 0 });
    expect(beatTimelineView(2000, 8000).scrollLeftMs).toBe(0);
    expect(beatTimelineView(2000, 8000).playheadFrac).toBeCloseTo(0.25);
  });

  it("过中点后游标钉在 0.5，时间轴前移", () => {
    const v = beatTimelineView(5000, 8000);
    expect(v.playheadFrac).toBe(0.5);
    expect(v.scrollLeftMs).toBe(1000);
  });

  it("圆环：锁定 0.75 时游标钉在最上相位", () => {
    const v = beatTimelineView(7000, 8000, 0.75);
    expect(v.playheadFrac).toBe(0.75);
    expect(v.scrollLeftMs).toBe(1000);
  });
});

describe("visibleBeatMarks", () => {
  it("只返回窗口内拍点并展开 loop", () => {
    const marks = visibleBeatMarks([100, 900], 1000, 800, 800, 0);
    const abs = marks.map((m) => m.absMs);
    expect(abs).toContain(900);
    expect(abs).toContain(1100); // loop1 + 100
    expect(abs).not.toContain(100);
  });
});

describe("beatMarkHot", () => {
  it("金环半宽内点亮", () => {
    expect(beatMarkHot(1000, 1140, 150)).toBe(true);
    expect(beatMarkHot(1000, 1160, 150)).toBe(false);
  });
});
