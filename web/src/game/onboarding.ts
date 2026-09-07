export type FirstClearGuideStep =
  | "reward_track"
  | "reward_gold"
  | "reward_level"
  | "win_next"
  | "select_shop"
  | "shop_archer"
  | "shop_buy"
  | "shop_back"
  | "select_archer"
  | "select_track"
  | "select_level2"
  | "done";

const GUIDE_ORDER: FirstClearGuideStep[] = [
  "reward_track",
  "reward_gold",
  "reward_level",
  "win_next",
  "select_shop",
  "shop_archer",
  "shop_buy",
  "shop_back",
  "select_archer",
  "select_track",
  "select_level2",
  "done",
];

/** 仅第一关首通会进入的商店弓使引导步骤 */
const SHOP_GUIDE_STEPS: FirstClearGuideStep[] = [
  "select_shop",
  "shop_archer",
  "shop_buy",
  "shop_back",
];

export function isShopGuideStep(step: FirstClearGuideStep | null | undefined): boolean {
  return step != null && SHOP_GUIDE_STEPS.includes(step);
}

export function isFirstClearGuideActive(step: FirstClearGuideStep | null | undefined): boolean {
  return step != null && step !== "done";
}

export function advanceFirstClearGuide(step: FirstClearGuideStep): FirstClearGuideStep {
  const i = GUIDE_ORDER.indexOf(step);
  if (i < 0 || i >= GUIDE_ORDER.length - 1) return "done";
  return GUIDE_ORDER[i + 1]!;
}

export function guideStepLabel(step: FirstClearGuideStep): string {
  switch (step) {
    case "win_next":
      return "点击进入战前整备";
    case "select_shop":
      return "打开商城招募武将";
    case "shop_archer":
      return "弓使适合挑战第二关";
    case "shop_buy":
      return "点击招募弓使";
    case "shop_back":
      return "点击返回装备继续整备";
    case "select_archer":
      return "选择弓使出征";
    case "select_track":
      return "选择新解锁的第二首曲子";
    case "select_level2":
      return "选择第二关出征";
    default:
      return "";
  }
}
