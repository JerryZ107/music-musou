export type FirstClearGuideStep =
  | "reward_track"
  | "reward_gold"
  | "reward_level"
  | "win_next"
  | "select_shop"
  | "shop_archer"
  | "shop_buy"
  | "shop_back"
  /** @deprecated 旧存档兼容；读档时归并为 done */
  | "select_archer"
  /** @deprecated 旧存档兼容；读档时归并为 done */
  | "select_track"
  /** @deprecated 旧存档兼容；读档时归并为 done */
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
  "done",
];

/** 仅第一关首通会进入的商店弓使引导步骤 */
const SHOP_GUIDE_STEPS: FirstClearGuideStep[] = [
  "select_shop",
  "shop_archer",
  "shop_buy",
  "shop_back",
];

/** 已改为自动切关/切曲，不再逐步引导 */
const LEGACY_SELECT_GUIDE_STEPS: FirstClearGuideStep[] = [
  "select_archer",
  "select_track",
  "select_level2",
];

export function isShopGuideStep(step: FirstClearGuideStep | null | undefined): boolean {
  return step != null && SHOP_GUIDE_STEPS.includes(step);
}

export function isLegacySelectGuideStep(step: FirstClearGuideStep | null | undefined): boolean {
  return step != null && LEGACY_SELECT_GUIDE_STEPS.includes(step);
}

/** 读档时把旧「选曲/选关/选弓使」步骤收成 done。 */
export function normalizeGuideStep(
  step: FirstClearGuideStep | null | undefined,
): FirstClearGuideStep | null {
  if (step == null) return null;
  if (isLegacySelectGuideStep(step)) return "done";
  return step;
}

export function isFirstClearGuideActive(step: FirstClearGuideStep | null | undefined): boolean {
  const n = normalizeGuideStep(step);
  return n != null && n !== "done";
}

export function advanceFirstClearGuide(step: FirstClearGuideStep): FirstClearGuideStep {
  const cur = normalizeGuideStep(step) ?? "done";
  const i = GUIDE_ORDER.indexOf(cur);
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
      return "点击返回继续整备";
    default:
      return "";
  }
}
