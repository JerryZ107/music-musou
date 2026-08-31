import { useEffect, useState } from "react";

export function useOrientation(): { portrait: boolean; landscape: boolean } {
  const [portrait, setPortrait] = useState(
    () => window.matchMedia("(orientation: portrait)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const onChange = () => setPortrait(mq.matches);
    mq.addEventListener("change", onChange);
    window.addEventListener("orientationchange", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("orientationchange", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);
  return { portrait, landscape: !portrait };
}

export function tryLockLandscape(): void {
  const ori = screen.orientation;
  if (ori && "lock" in ori && typeof ori.lock === "function") {
    void ori.lock("landscape").catch(() => {
      /* iOS / 部分浏览器不支持 */
    });
  }
}

export function tryUnlockOrientation(): void {
  const ori = screen.orientation;
  if (ori && "unlock" in ori && typeof ori.unlock === "function") {
    void ori.unlock();
  }
}
