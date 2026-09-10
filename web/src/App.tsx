import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLandscapeMode } from "./hooks/useLandscapeMode";
import { useLayoutShell } from "./hooks/useLayoutShell";
import {
  applyRunRewards,
  clearSlot,
  getAccount,
  getSlotMeta,
  getLastAccountName,
  listAccounts,
  newSlotDraft,
  recordRun,
  sanitizeSlotDraft,
  setFirstClearGuideStep,
  SaveStorageError,
  upsertAccount,
  writeSlot,
  readSlot,
  type AccountData,
  type SlotData,
} from "./game/save";
import { advanceFirstClearGuide, isShopGuideStep } from "./game/onboarding";
import { MenuBgmPlayer, primeAudioFromUserGesture } from "./game/audio";
import type { HeroId, RunResult, LevelId, TrackId, WeaponId } from "./game/types";
import { CodexScreen } from "./ui/CodexScreen";
import { ShopScreen } from "./ui/ShopScreen";
import { AccountGate, SelectScreen, SlotPicker } from "./ui/screens";
import { GameScreen } from "./ui/GameScreen";
import { LandscapeModeToggle } from "./ui/LandscapeModeToggle";
import { isTouchDevice } from "./utils/touch";

type Phase = "account" | "slots" | "select" | "shop" | "codex" | "game";

function MenuShell(props: {
  touch: boolean;
  portrait: boolean;
  landscapeForced: boolean;
  /** 存档/整备/商城顶栏已有横屏按钮时，不再用顶栏条/右下角芯片 */
  headerHasLandscape?: boolean;
  saveError?: string | null;
  onEnableLandscape: () => void;
  onDisableLandscape: () => void;
  children: ReactNode;
}) {
  const showBar =
    props.touch &&
    !props.headerHasLandscape &&
    (props.portrait || props.landscapeForced);
  return (
    <div className="app-menu">
      {props.saveError && (
        <div className="menu-save-error" role="alert">
          {props.saveError}
        </div>
      )}
      {showBar && (
        <LandscapeModeToggle
          active={props.landscapeForced}
          portrait={props.portrait}
          variant="bar"
          onEnable={props.onEnableLandscape}
          onDisable={props.onDisableLandscape}
        />
      )}
      {props.children}
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState<Phase>("account");
  const [accountName, setAccountName] = useState<string | null>(getLastAccountName());
  const [accounts, setAccounts] = useState(() => listAccounts());
  const [slotIndex, setSlotIndex] = useState(0);
  const [draft, setDraft] = useState<SlotData>(() => newSlotDraft());
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [touch] = useState(isTouchDevice);
  const menuBgmRef = useRef<MenuBgmPlayer | null>(null);
  if (!menuBgmRef.current) menuBgmRef.current = new MenuBgmPlayer();
  const { portrait, forced, effectiveLandscape, enable, disable } = useLandscapeMode(true, false);
  const layoutPhase = phase === "game" ? "game" : "menu";
  // 菜单在强制横屏时按横屏壳布局；战斗仍用物理朝向驱动提示
  const layoutPortrait = phase === "game" ? portrait : !effectiveLandscape;
  useLayoutShell({
    touch,
    portrait: layoutPortrait,
    landscapeReady: phase === "game" ? effectiveLandscape : true,
    phase: layoutPhase,
  });

  useEffect(() => {
    document.querySelector(".app-menu")?.scrollTo({ top: 0, left: 0 });
  }, [phase]);

  useEffect(() => {
    const bgm = menuBgmRef.current;
    if (!bgm) return;
    if (phase === "shop") {
      void bgm.start("shop");
      return;
    }
    bgm.stop();
  }, [phase]);

  useEffect(() => {
    const bgm = menuBgmRef.current;
    const prime = () => {
      primeAudioFromUserGesture();
      bgm?.kickFromGesture();
    };
    document.addEventListener("pointerdown", prime, true);
    document.addEventListener("touchstart", prime, { capture: true, passive: true });
    document.addEventListener("keydown", prime, true);
    // 部分浏览器在 visibility 回来后也需要再踢一次
    const onVis = () => {
      if (document.visibilityState === "visible") bgm?.kickFromGesture();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("pointerdown", prime, true);
      document.removeEventListener("touchstart", prime, true);
      document.removeEventListener("keydown", prime, true);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    return () => {
      menuBgmRef.current?.stop();
    };
  }, []);

  const account: AccountData | null = useMemo(() => {
    if (!accountName) return null;
    return getAccount(accountName);
  }, [accountName, accounts, phase]);

  const meta = useMemo(() => {
    if (!accountName) return newSlotDraft();
    return getSlotMeta(accountName, slotIndex);
  }, [accountName, slotIndex, accounts, phase]);

  const refreshAccounts = () => setAccounts(listAccounts());

  const guideStep = meta.firstClearGuideStep;
  const archerOwned = meta.unlockedHeroes.includes(3);
  /** 商店弓使引导：仅第一关首通且未买弓使时有效 */
  const shopGuideLive =
    meta.shopPromptPending && !archerOwned && isShopGuideStep(guideStep);

  const advanceGuide = () => {
    if (!accountName || !guideStep || guideStep === "done") return;
    let next = advanceFirstClearGuide(guideStep);
    if (guideStep === "reward_gold" && runResult && !runResult.levelUnlocked) {
      next = "win_next";
    }
    if (guideStep === "win_next") {
      // 只有第一关首通、且还没买弓使时才进商店引导；其它情况（含第二关）直接结束
      const live =
        runResult?.levelId === 1 &&
        getSlotMeta(accountName, slotIndex).shopPromptPending &&
        !getSlotMeta(accountName, slotIndex).unlockedHeroes.includes(3);
      next = live ? "select_shop" : "done";
    }
    // 已拥有弓使时跳过整段商店引导
    if (isShopGuideStep(next) && getSlotMeta(accountName, slotIndex).unlockedHeroes.includes(3)) {
      next = "done";
    }
    setFirstClearGuideStep(accountName, slotIndex, next);
    refreshAccounts();
  };
  const completeGuide = () => {
    if (!accountName) return;
    setFirstClearGuideStep(accountName, slotIndex, "done");
    refreshAccounts();
  };

  const exitToSelect = () => {
    setRunResult(null);
    if (accountName) {
      const slot = readSlot(accountName, slotIndex);
      const m = getSlotMeta(accountName, slotIndex);
      if (slot) setDraft(sanitizeSlotDraft(slot, m));
    }
    setPhase("select");
  };

  const enterAccount = (name: string) => {
    try {
      setSaveError(null);
      const acc = upsertAccount(name);
      setAccountName(acc.name);
      refreshAccounts();
      setPhase("slots");
    } catch (err) {
      const msg =
        err instanceof SaveStorageError
          ? err.message
          : err instanceof Error
            ? err.message
            : "进入名号失败";
      setSaveError(msg);
    }
  };

  const pickSlot = (index: number, existing: SlotData | null) => {
    setSlotIndex(index);
    if (!existing) {
      const fresh = newSlotDraft();
      setDraft(fresh);
      if (accountName) writeSlot(accountName, index, fresh);
      refreshAccounts();
      setPhase("select");
      return;
    }
    const m = accountName ? getSlotMeta(accountName, index) : meta;
    setDraft(sanitizeSlotDraft(existing, m));
    setPhase("select");
  };

  const startGame = () => {
    if (!accountName) return;
    primeAudioFromUserGesture();
    // 出征不自动横屏：竖屏进战斗后由全屏提示按钮开启
    writeSlot(accountName, slotIndex, draft);
    refreshAccounts();
    setRunResult(null);
    setPhase("game");
  };

  const onHeroPurchased = (heroId: HeroId) => {
    setDraft((d) => ({ ...d, weaponId: heroId }));
    if (guideStep === "shop_buy" && heroId === 3) advanceGuide();
  };

  const menuProps = {
    touch,
    portrait,
    landscapeForced: forced,
    saveError,
    onEnableLandscape: enable,
    onDisableLandscape: disable,
  };
  const landscapeNav =
    touch && (portrait || forced)
      ? {
          landscapeForced: forced,
          portrait,
          onEnableLandscape: enable,
          onDisableLandscape: disable,
        }
      : null;

  if (phase === "account") {
    return (
      <MenuShell {...menuProps}>
        <AccountGate accounts={accounts} lastName={accountName} onEnter={enterAccount} />
      </MenuShell>
    );
  }

  if (phase === "slots") {
    if (!account) {
      return (
        <MenuShell {...menuProps}>
          <AccountGate accounts={accounts} lastName={accountName} onEnter={enterAccount} />
        </MenuShell>
      );
    }
    return (
      <MenuShell {...menuProps} headerHasLandscape={!!landscapeNav}>
        <SlotPicker
          account={account}
          landscape={landscapeNav}
          onBack={() => setPhase("account")}
          onPick={pickSlot}
          onClear={(i) => {
            clearSlot(account.name, i);
            refreshAccounts();
          }}
        />
      </MenuShell>
    );
  }

  if (phase === "shop" && accountName && meta.shopUnlocked) {
    return (
      <MenuShell {...menuProps} headerHasLandscape={!!landscapeNav}>
        <ShopScreen
          accountName={accountName}
          slotIndex={slotIndex}
          meta={meta}
          landscape={landscapeNav}
          highlightArcher={shopGuideLive}
          firstClearGuideStep={shopGuideLive ? guideStep : null}
          onGuideAdvance={advanceGuide}
          onHeroPurchased={onHeroPurchased}
          onMetaChange={refreshAccounts}
          onBack={() => {
            if (guideStep === "shop_back") advanceGuide();
            if (accountName) {
              setDraft((d) => sanitizeSlotDraft(d, getSlotMeta(accountName, slotIndex)));
            }
            setPhase("select");
          }}
        />
      </MenuShell>
    );
  }

  if (phase === "codex") {
    return (
      <MenuShell {...menuProps}>
        <CodexScreen onBack={() => setPhase("select")} />
      </MenuShell>
    );
  }

  if (phase === "select") {
    return (
      <MenuShell {...menuProps} headerHasLandscape={!!landscapeNav}>
        <SelectScreen
          levelId={draft.levelId}
          trackId={draft.trackId}
          weaponId={draft.weaponId}
          meta={meta}
          landscape={landscapeNav}
          shopPromptPending={meta.shopPromptPending && !archerOwned}
          firstClearGuideStep={guideStep}
          onGuideAdvance={advanceGuide}
          onGuideComplete={completeGuide}
          onLevel={(id: LevelId) => setDraft((d) => ({ ...d, levelId: id }))}
          onTrack={(id: TrackId) => setDraft((d) => ({ ...d, trackId: id }))}
          onWeapon={(id: WeaponId) => setDraft((d) => ({ ...d, weaponId: id }))}
          onStart={startGame}
          onBack={() => setPhase("slots")}
          onOpenShop={() => {
            if (!meta.shopUnlocked) return;
            if (guideStep === "select_shop") advanceGuide();
            primeAudioFromUserGesture();
            menuBgmRef.current?.unlockFromGesture();
            void menuBgmRef.current?.start("shop");
            setPhase("shop");
          }}
          onOpenCodex={() => setPhase("codex")}
        />
      </MenuShell>
    );
  }

  if (phase === "game" && accountName) {
    return (
      <GameScreen
        levelId={draft.levelId}
        trackId={draft.trackId}
        weaponId={draft.weaponId}
        latencyMs={draft.audioLatencyMs}
        muted={draft.muted}
        touch={touch}
        portrait={portrait}
        landscapeReady={effectiveLandscape}
        landscapeForced={forced}
        onEnableLandscape={enable}
        onDisableLandscape={disable}
        tutorial={false}
        runResultOverride={runResult}
        firstClearGuideStep={guideStep}
        onGuideAdvance={advanceGuide}
        onExitSelect={() => {
          if (guideStep === "win_next") {
            advanceGuide();
            exitToSelect();
            return;
          }
          exitToSelect();
        }}
        onNextLevel={() => {
          if (guideStep === "win_next") {
            advanceGuide();
            exitToSelect();
          } else {
            exitToSelect();
          }
        }}
        onGoShop={() => {
          if (!getSlotMeta(accountName, slotIndex).shopUnlocked) return;
          exitToSelect();
          if (guideStep === "win_next") advanceGuide();
          refreshAccounts();
          primeAudioFromUserGesture();
          menuBgmRef.current?.unlockFromGesture();
          void menuBgmRef.current?.start("shop");
          setPhase("shop");
        }}
        onLatencyChange={(ms) => {
          const next = { ...draft, audioLatencyMs: ms };
          setDraft(next);
          writeSlot(accountName, slotIndex, next);
        }}
        onMuteChange={(muted) => {
          const next = { ...draft, muted };
          setDraft(next);
          writeSlot(accountName, slotIndex, next);
        }}
        onOutcome={(r) => {
          const enriched =
            r.outcome === "win" ? applyRunRewards(accountName, slotIndex, r) : r;
          recordRun(accountName, slotIndex, enriched);
          setRunResult(enriched);
          refreshAccounts();
        }}
      />
    );
  }

  return (
    <MenuShell {...menuProps}>
      <AccountGate accounts={accounts} lastName={accountName} onEnter={enterAccount} />
    </MenuShell>
  );
}
