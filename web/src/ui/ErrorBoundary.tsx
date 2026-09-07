import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("UI crash:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fatal-screen">
        <h1>界面加载失败</h1>
        <p className="fatal-screen__msg">{this.state.error.message || "未知错误"}</p>
        <p className="fatal-screen__hint">
          可尝试清除本站数据后重试，或把此信息截图反馈。控制台（F12）里通常有更详细的报错。
        </p>
        <button
          type="button"
          className="primary"
          onClick={() => {
            try {
              localStorage.removeItem("musicmusou.saves.v1");
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
        >
          清除存档并刷新
        </button>
      </div>
    );
  }
}
