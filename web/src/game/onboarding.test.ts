import { describe, expect, it } from "vitest";
import { advanceFirstClearGuide, guideStepLabel } from "./onboarding";

describe("first clear guide", () => {
  it("购买弓使后依次引导弓使、第二曲、第二关", () => {
    expect(advanceFirstClearGuide("shop_buy")).toBe("shop_back");
    expect(advanceFirstClearGuide("shop_back")).toBe("select_archer");
    expect(advanceFirstClearGuide("select_archer")).toBe("select_track");
    expect(advanceFirstClearGuide("select_track")).toBe("select_level2");
    expect(advanceFirstClearGuide("select_level2")).toBe("done");
  });

  it("整备页引导文案", () => {
    expect(guideStepLabel("select_archer")).toContain("弓使");
    expect(guideStepLabel("select_track")).toContain("第二");
    expect(guideStepLabel("select_level2")).toContain("第二关");
    expect(guideStepLabel("shop_back")).toContain("返回装备");
  });
});
