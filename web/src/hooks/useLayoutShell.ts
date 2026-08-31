import { useEffect, useState } from "react";

export type LayoutPhase = "menu" | "game";

function readShortScreen(): boolean {
  return Math.min(window.innerWidth, window.innerHeight) < 520;
}

/** 在 <html> 上挂 data-*，供 mobile-layout.css 统一适配。 */
export function useLayoutShell(opts: {
  touch: boolean;
  portrait: boolean;
  landscapeReady: boolean;
  phase: LayoutPhase;
}): { short: boolean } {
  const [short, setShort] = useState(readShortScreen);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.touch = opts.touch ? "1" : "0";
    root.dataset.orient = opts.portrait ? "portrait" : "landscape";
    root.dataset.landscapeReady = opts.landscapeReady ? "1" : "0";
    root.dataset.phase = opts.phase;
    root.dataset.short = short ? "1" : "0";

    const onResize = () => {
      const s = readShortScreen();
      setShort(s);
      root.dataset.short = s ? "1" : "0";
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      delete root.dataset.touch;
      delete root.dataset.orient;
      delete root.dataset.landscapeReady;
      delete root.dataset.phase;
      delete root.dataset.short;
    };
  }, [opts.touch, opts.portrait, opts.landscapeReady, opts.phase, short]);

  return { short };
}
