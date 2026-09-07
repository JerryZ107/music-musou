import type { LevelId, TrackId } from "../game/types";
import { TRACK_VISUAL } from "./menuTheme";
import { LEVEL_VISUAL } from "../game/levels";

export function RewardRevealCard(props: {
  open: boolean;
  kind: "track" | "gold" | "level";
  title: string;
  subtitle: string;
  detail?: string;
  trackId?: TrackId;
  levelId?: LevelId;
  onContinue: () => void;
}) {
  if (!props.open) return null;

  const banner =
    props.kind === "track"
      ? TRACK_VISUAL[props.trackId ?? 2].grad
      : props.kind === "level"
        ? LEVEL_VISUAL[props.levelId ?? 2].grad
        : "linear-gradient(135deg, #3a3010 0%, #6a5018 55%, #201808 100%)";

  return (
    <div className="reward-reveal-backdrop" role="dialog" aria-modal>
      <button
        type="button"
        className={`reward-reveal-card reward-reveal-card--${props.kind}`}
        onClick={props.onContinue}
      >
        <div className="reward-reveal-flash" aria-hidden />
        <div className="reward-reveal-banner" style={{ background: banner }} />
        <div className="reward-reveal-body">
          <span className="reward-reveal-kicker">
            {props.kind === "track" ? "新曲目" : props.kind === "gold" ? "获得金币" : "新关卡"}
          </span>
          <h2>{props.title}</h2>
          <p>{props.subtitle}</p>
          {props.detail && <p className="reward-reveal-detail">{props.detail}</p>}
          <span className="reward-reveal-tap">点击继续</span>
        </div>
      </button>
    </div>
  );
}
