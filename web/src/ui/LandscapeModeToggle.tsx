export function LandscapeModeToggle(props: {
  active: boolean;
  portrait: boolean;
  variant: "bar" | "overlay" | "chip";
  onEnable: () => void;
  onDisable: () => void;
}) {
  if (!props.portrait && !props.active) return null;

  if (props.variant === "chip") {
    return (
      <button type="button" className="landscape-chip" onClick={props.active ? props.onDisable : props.onEnable}>
        {props.active ? "退出横屏" : "横屏"}
      </button>
    );
  }

  if (props.active && props.variant !== "overlay") {
    return (
      <div className="landscape-bar on">
        <span>横屏模式已开启（竖屏强制旋转）</span>
        <button type="button" className="ghost" onClick={props.onDisable}>
          关闭
        </button>
      </div>
    );
  }

  if (props.variant === "overlay") {
    return (
      <div className="landscape-prompt" role="dialog" aria-label="横屏模式">
        <div className="landscape-prompt-inner">
          <div className="landscape-phone" aria-hidden>
            <span />
          </div>
          <h2>需要横屏操作</h2>
          <p>点下面按钮开启横屏模式：自动旋转画面并尝试锁定方向（左摇杆 + 右下技能键）。</p>
          <button type="button" className="primary landscape-enable-btn" onClick={props.onEnable}>
            开启横屏模式
          </button>
          <p className="landscape-sub">也可手动旋转手机；已物理横屏则无需点击。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="landscape-bar">
      <span>手机建议横屏浏览选单</span>
      <button type="button" className="primary" onClick={props.onEnable}>
        开启横屏模式
      </button>
    </div>
  );
}
