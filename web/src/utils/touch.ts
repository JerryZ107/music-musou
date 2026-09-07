/** 是否按触屏版运行（粗指针设备，或 ?touch=1 强制开启）。 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("touch") === "1") return true;
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}
