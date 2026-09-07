import { useLayoutEffect, useState } from "react";

export type LayoutPhase = "menu" | "game";

function readShortScreen(): boolean {
  return Math.min(window.innerWidth, window.innerHeight) < 520;
}

function applyLayoutDataset(opts: {
  touch: boolean;
  portrait: boolean;
  landscapeReady: boolean;
  phase: LayoutPhase;
  short: boolean;
}): void {
  const root = document.documentElement;
  root.dataset.touch = opts.touch ? "1" : "0";
  root.dataset.orient = opts.portrait ? "portrait" : "landscape";
  root.dataset.landscapeReady = opts.landscapeReady ? "1" : "0";
  root.dataset.phase = opts.phase;
  root.dataset.short = opts.short ? "1" : "0";
}

/** 在 <html> 上挂 data-*，供 mobile-layout.css 统一适配。 */
export function useLayoutShell(opts: {
  touch: boolean;
  portrait: boolean;
  landscapeReady: boolean;
  phase: LayoutPhase;
}): { short: boolean } {
  const [short, setShort] = useState(readShortScreen);

  useLayoutEffect(() => {
    applyLayoutDataset({ ...opts, short });

    const onResize = () => {
      const s = readShortScreen();
      setShort(s);
      applyLayoutDataset({ ...opts, short: s });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [opts.touch, opts.portrait, opts.landscapeReady, opts.phase, short]);

  return { short };
}

/** 进战斗前同步 data-phase，避免首帧 CSS 仍按菜单阶段计算尺寸。 */
export function primeGameLayoutShell(opts: {
  touch: boolean;
  portrait: boolean;
  landscapeReady: boolean;
  short?: boolean;
}): void {
  applyLayoutDataset({
    touch: opts.touch,
    portrait: opts.portrait,
    landscapeReady: opts.landscapeReady,
    phase: "game",
    short: opts.short ?? readShortScreen(),
  });
}
