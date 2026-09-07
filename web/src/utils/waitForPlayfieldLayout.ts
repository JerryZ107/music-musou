/** 等战斗画布容器拿到正确横屏尺寸后再初始化 Pixi。 */
export async function waitForPlayfieldLayout(
  host: HTMLElement,
  opts: { touch: boolean; portrait: boolean },
  maxFrames = 48,
): Promise<void> {
  for (let i = 0; i < maxFrames; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const rect = host.getBoundingClientRect();
    const shellReady =
      !opts.touch || !opts.portrait || document.documentElement.classList.contains("landscape-forced");
    if (shellReady && rect.width >= 200 && rect.height >= 100) return;
  }
}
