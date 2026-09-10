import { describe, expect, it } from "vitest";
import { advanceFirstClearGuide, guideStepLabel, normalizeGuideStep } from "./onboarding";

describe("first clear guide", () => {
  it("商店买弓使后结束引导，不再引导选曲选关", () => {
    expect(advanceFirstClearGuide("shop_buy")).toBe("shop_back");
    expect(advanceFirstClearGuide("shop_back")).toBe("done");
    expect(advanceFirstClearGuide("select_track")).toBe("done");
    expect(normalizeGuideStep("select_level2")).toBe("done");
    expect(normalizeGuideStep("select_archer")).toBe("done");
  });

  it("商店引导文案", () => {
    expect(guideStepLabel("select_shop")).toContain("商城");
    expect(guideStepLabel("shop_buy")).toContain("弓使");
    expect(guideStepLabel("shop_back")).toContain("返回");
    expect(guideStepLabel("select_track")).toBe("");
  });
});
