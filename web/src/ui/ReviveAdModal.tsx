import { useEffect, useState } from "react";

const AD_MS = 2800;

export function ReviveAdModal(props: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!props.open) {
      setProgress(0);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const pct = Math.min(100, ((now - start) / AD_MS) * 100);
      setProgress(pct);
      if (pct < 100) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [props.open]);

  if (!props.open) return null;

  const ready = progress >= 100;

  return (
    <div className="overlay ad-revive" role="dialog" aria-label="看广告复活">
      <div className="ad-revive-card">
        <span className="ad-badge">广告演示</span>
        <h3>曲无双 · 赞助展示</h3>
        <p className="ad-lede">观看后可原地复活，继续本局（演示弹窗，无真实广告 SDK）</p>
        <div className="ad-screen" aria-hidden>
          <span className="ad-screen-title">Music Musou</span>
          <span className="ad-screen-sub">节奏割草 · 卡拍更强</span>
        </div>
        <div className="ad-progress" aria-label="广告进度">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="ad-status">{ready ? "可以复活了" : `播放中 ${Math.ceil((AD_MS / 1000) * (1 - progress / 100))}s…`}</p>
        <div className="overlay-actions ad-actions">
          <button type="button" className="primary" disabled={!ready} onClick={props.onComplete}>
            立即复活
          </button>
          <button type="button" className="ghost" onClick={props.onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
