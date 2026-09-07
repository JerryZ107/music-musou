import { useCallback, useLayoutEffect, useState } from "react";
import { tryLockLandscape, tryUnlockOrientation, useOrientation } from "./useOrientation";

const STORAGE_KEY = "musicmusou_landscape_mode";

export function readLandscapeModePref(defaultOnTouch = false): boolean {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "1";
  } catch {
    /* ignore */
  }
  return defaultOnTouch;
}

function writeLandscapeModePref(on: boolean): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** 竖屏时用 CSS 把战斗层旋成横屏可视区域。 */
export function syncForcedLandscapeShell(active: boolean, portrait: boolean): void {
  const root = document.documentElement;
  root.classList.toggle("landscape-forced", active && portrait);
  if (active && portrait) {
    root.style.setProperty("--forced-w", `${window.innerHeight}px`);
    root.style.setProperty("--forced-h", `${window.innerWidth}px`);
  } else {
    root.style.removeProperty("--forced-w");
    root.style.removeProperty("--forced-h");
  }
}

async function requestLandscape(): Promise<void> {
  tryLockLandscape();
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen();
      tryLockLandscape();
    }
  } catch {
    /* 全屏 + 锁方向非必须；CSS 强制横屏仍可用 */
  }
}

export function useLandscapeMode(applyForcedShell = true, touch = false) {
  const { portrait, landscape } = useOrientation();
  const [forced, setForced] = useState(() => readLandscapeModePref(touch));

  const enable = useCallback(() => {
    setForced(true);
    writeLandscapeModePref(true);
    void requestLandscape();
  }, []);

  const disable = useCallback(() => {
    setForced(false);
    writeLandscapeModePref(false);
    tryUnlockOrientation();
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useLayoutEffect(() => {
    const active = applyForcedShell && forced;
    syncForcedLandscapeShell(active, portrait);
    const onResize = () => syncForcedLandscapeShell(applyForcedShell && forced, portrait);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [applyForcedShell, forced, portrait]);

  const effectiveLandscape = landscape || forced;

  return { forced, portrait, landscape, effectiveLandscape, enable, disable };
}
