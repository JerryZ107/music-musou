import { useState } from "react";
import { HERO_CODEX } from "../game/codex";
import { HERO_PRICES } from "../game/meta";
import { purchaseHero, type AccountMeta } from "../game/save";
import { HEROES } from "../game/tracks";
import type { HeroId } from "../game/types";
import type { FirstClearGuideStep } from "../game/onboarding";
import { guideStepLabel, isFirstClearGuideActive, isShopGuideStep } from "../game/onboarding";
import { GuideSpotlight } from "./GuideSpotlight";
import { LandscapeModeToggle } from "./LandscapeModeToggle";
import { HeroPortrait, MenuHeader, MenuScreen, SectionTitle } from "./MenuChrome";

export function ShopScreen(props: {
  accountName: string;
  slotIndex: number;
  meta: AccountMeta;
  landscape?: {
    landscapeForced: boolean;
    portrait: boolean;
    onEnableLandscape: () => void;
    onDisableLandscape: () => void;
  } | null;
  highlightArcher?: boolean;
  firstClearGuideStep?: FirstClearGuideStep | null;
  onGuideAdvance?: () => void;
  onHeroPurchased?: (heroId: HeroId) => void;
  onMetaChange: () => void;
  onBack: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const guideStep = props.firstClearGuideStep;
  const guideActive = isFirstClearGuideActive(guideStep);
  const archerOwned = props.meta.unlockedHeroes.includes(3);
  const shopGuideLive =
    !!props.highlightArcher && !archerOwned && isShopGuideStep(guideStep);

  const buy = (heroId: HeroId) => {
    const result = purchaseHero(props.accountName, props.slotIndex, heroId);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    props.onMetaChange();
    props.onHeroPurchased?.(heroId);
    setMessage(`已招募 ${HEROES[heroId].name}${guideStep === "shop_buy" && heroId === 3 ? "，请点击返回继续整备" : ""}`);
  };

  return (
    <MenuScreen className="shop-screen">
      <MenuHeader
        title="招募武将"
        subtitle="过关所得金币，在此扩充编队"
        gold={props.meta.gold}
        actions={
          <>
            {props.landscape && (
              <LandscapeModeToggle
                active={props.landscape.landscapeForced}
                portrait={props.landscape.portrait}
                variant="nav"
                onEnable={props.landscape.onEnableLandscape}
                onDisable={props.landscape.onDisableLandscape}
              />
            )}
            <button
              type="button"
              className="ghost nav-btn"
              data-guide="shop-back"
              onClick={() => props.onBack()}
            >
              返回装备
            </button>
          </>
        }
      />
      {shopGuideLive && !guideActive && (
        <p className="shop-guide">推荐先招募弓使（10 金币）挑战第二关；武士需 20 金币。</p>
      )}
      {message && <p className="shop-msg">{message}</p>}

      <SectionTitle icon="◆">可招募</SectionTitle>
      <div className="cards">
        {([1, 2, 3] as HeroId[]).map((id) => {
          const hero = HEROES[id];
          const owned = props.meta.unlockedHeroes.includes(id);
          const price = HERO_PRICES[id];
          const highlight = shopGuideLive && (guideStep === "shop_archer" || props.highlightArcher) && id === 3 && !owned;
          return (
            <div
              key={id}
              data-guide={id === 3 ? "shop-archer" : undefined}
              className={`card shop-card${highlight ? " shop-highlight" : ""}`}
              onClick={() => {
                if (shopGuideLive && guideStep === "shop_archer" && id === 3) props.onGuideAdvance?.();
              }}
            >
              <div className="card__inner">
                <div className="card__row">
                  <HeroPortrait heroId={id} size="lg" />
                  <div className="card__body">
                    <div className="kicker">武将 {id}</div>
                    <h3>{hero.name}</h3>
                    <p>{HERO_CODEX[id].passive}</p>
                  </div>
                </div>
                <p>{HERO_CODEX[id].ultimate}</p>
                <div className="shop-price">
                  {owned ? (
                    <span className="shop-owned">✓ 已招募</span>
                  ) : price > 0 ? (
                    <button
                      className="primary"
                      data-guide={id === 3 ? "shop-buy-archer" : undefined}
                      disabled={props.meta.gold < price}
                      onClick={() => buy(id)}
                    >
                      招募 · {price} 金币
                    </button>
                  ) : (
                    <span className="shop-owned">初始武将</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <GuideSpotlight
        active={shopGuideLive && guideStep === "shop_archer"}
        targetId="shop-archer"
        label={guideStepLabel("shop_archer")}
      />
      <GuideSpotlight
        active={shopGuideLive && guideStep === "shop_buy"}
        targetId="shop-buy-archer"
        label={guideStepLabel("shop_buy")}
      />
      <GuideSpotlight
        active={shopGuideLive && guideStep === "shop_back"}
        targetId="shop-back"
        label={guideStepLabel("shop_back")}
      />
    </MenuScreen>
  );
}
