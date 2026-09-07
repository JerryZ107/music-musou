import { useEffect, useRef, useState } from "react";
import { GameRuntime } from "../game/runtime";
import type { HudSnapshot, RunResult, LevelId, TrackId, WeaponId } from "../game/types";
import type { FirstClearGuideStep } from "../game/onboarding";
import { copyShareText } from "../game/runResult";
import { waitForPlayfieldLayout } from "../utils/waitForPlayfieldLayout";
import { BottomHud, FieldOverlay, TopBar, type HudHandlers } from "./Hud";
import { LandscapeModeToggle } from "./LandscapeModeToggle";
import { ReviveAdModal } from "./ReviveAdModal";
import { TouchControls } from "./TouchControls";

export function GameScreen(props: {
  levelId: LevelId;
  trackId: TrackId;
  weaponId: WeaponId;
  latencyMs: number;
  muted: boolean;
  touch: boolean;
  portrait: boolean;
  landscapeReady: boolean;
  landscapeForced: boolean;
  onEnableLandscape: () => void;
  onDisableLandscape: () => void;
  tutorial: boolean;
  runResultOverride?: RunResult | null;
  firstClearGuideStep?: FirstClearGuideStep | null;
  onGuideAdvance?: () => void;
  onExitSelect: () => void;
  onNextLevel?: () => void;
  onGoShop?: () => void;
  onLatencyChange: (ms: number) => void;
  onMuteChange: (muted: boolean) => void;
  onOutcome: (r: RunResult) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rtRef = useRef<GameRuntime | null>(null);
  const keys = useRef(new Set<string>());
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [booting, setBooting] = useState(true);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [reviveAdOpen, setReviveAdOpen] = useState(false);
  const mobilePlay = props.touch && props.landscapeReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const boot = async () => {
      await waitForPlayfieldLayout(host, {
        touch: props.touch,
        portrait: props.portrait,
      });
      if (cancelled) return;

      const rt = new GameRuntime({
        levelId: props.levelId,
        trackId: props.trackId,
        weaponId: props.weaponId,
        audioLatencyMs: props.latencyMs,
        muted: props.muted,
        tutorial: props.tutorial,
        touch: props.touch,
      });
      rt.onHud = setHud;
      rt.onOutcome = props.onOutcome;
      rtRef.current = rt;
      setBooting(true);

      try {
        await rt.mount(host);
        if (cancelled) {
          rt.destroy();
          return;
        }
        rt.syncCanvasSize();
        resizeObserver = new ResizeObserver(() => rt.syncCanvasSize());
        resizeObserver.observe(host);
        setHud(rt.snapshot());
        setBooting(false);
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setBooting(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      rtRef.current?.destroy();
      rtRef.current = null;
    };
    // 开局参数固定；延迟/静音通过 runtime 方法改。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.levelId, props.trackId, props.weaponId, props.tutorial, props.touch, props.portrait]);

  useEffect(() => {
    if (props.touch) return;
    const applyMove = () => {
      const k = keys.current;
      let x = 0;
      let y = 0;
      if (k.has("KeyA") || k.has("ArrowLeft")) x -= 1;
      if (k.has("KeyD") || k.has("ArrowRight")) x += 1;
      if (k.has("KeyW") || k.has("ArrowUp")) y -= 1;
      if (k.has("KeyS") || k.has("ArrowDown")) y += 1;
      rtRef.current?.setMove(x, y);
    };
    const down = (e: KeyboardEvent) => {
      const rt = rtRef.current;
      if (!rt) return;
      if (e.code === "Escape" || e.code === "KeyP") {
        e.preventDefault();
        if (!e.repeat) rt.togglePause();
        return;
      }
      if (e.code === "KeyQ") {
        e.preventDefault();
        if (!e.repeat) props.onExitSelect();
        return;
      }
      if (rt.isPaused) return;
      if (["Space", "Enter", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      keys.current.add(e.code);
      applyMove();
      if (e.repeat) return;
      if (e.code === "Enter") rt.queueAttack();
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") rt.queueSlide();
      if (e.code === "Space") rt.queueUlt();
      if (e.code === "KeyT") {
        if (rt.sim.run === "tutorial") rt.startCombat();
        else if (rt.sim.run === "win" || rt.sim.run === "lose") rt.restart(false);
      }
      if (e.code === "KeyR" && (rt.sim.run === "win" || rt.sim.run === "lose")) rt.restart(false);
      if (e.code === "KeyS" && (rt.sim.run === "win" || rt.sim.run === "lose")) props.onExitSelect();
      if (e.code === "KeyM") props.onMuteChange(rt.toggleMute());
      if (e.code === "BracketLeft") {
        rt.nudgeLatency(10);
        props.onLatencyChange(rt.audio.latencyMs);
      }
      if (e.code === "BracketRight") {
        rt.nudgeLatency(-10);
        props.onLatencyChange(rt.audio.latencyMs);
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      applyMove();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.touch, props.onExitSelect, props.onLatencyChange, props.onMuteChange]);

  const hudProps: HudHandlers | null = hud
    ? {
        hud,
        touch: props.touch,
        shareHint,
        portrait: props.portrait,
        landscapeForced: props.landscapeForced,
        onEnableLandscape: props.onEnableLandscape,
        onDisableLandscape: props.onDisableLandscape,
        onCombat: () => rtRef.current?.startCombat(),
        onRestart: () => {
          if (hud?.run === "lose" && hud.reviveAvailable) rtRef.current?.forfeitRevive();
          rtRef.current?.restart(false);
        },
        onReselect: () => {
          if (hud?.run === "lose" && hud.reviveAvailable) rtRef.current?.forfeitRevive();
          props.onExitSelect();
        },
        onNextLevel: () => props.onNextLevel?.(),
        onGoShop: () => props.onGoShop?.(),
        firstClearGuideStep: props.firstClearGuideStep,
        onGuideAdvance: props.onGuideAdvance,
        onMute: () => {
          const rt = rtRef.current;
          if (rt) {
            rt.ensureAudioPlaying();
            props.onMuteChange(rt.toggleMute());
          }
        },
        onLatency: (d) => {
          const rt = rtRef.current;
          if (!rt) return;
          rt.nudgeLatency(d);
          props.onLatencyChange(rt.audio.latencyMs);
        },
        onPause: () => {
          rtRef.current?.ensureAudioPlaying();
          rtRef.current?.togglePause();
        },
        onEnd: props.onExitSelect,
        onShare: async () => {
          const r = hud.runResult;
          if (!r) return;
          const ok = await copyShareText(r);
          setShareHint(ok ? "成绩已复制，可粘贴到微信/简历" : "复制失败，请手动截图");
          window.setTimeout(() => setShareHint(null), 2800);
        },
        onWatchReviveAd: () => setReviveAdOpen(true),
        onForfeitRevive: () => rtRef.current?.forfeitRevive(),
      }
    : null;

  return (
    <div
      className={[
        "game-root",
        props.touch && "touch-mode",
        props.landscapeReady && "landscape-ready",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerDown={() => rtRef.current?.ensureAudioPlaying()}
    >
      {props.touch && props.portrait && !props.landscapeReady && (
        <LandscapeModeToggle
          active={props.landscapeForced}
          portrait={props.portrait}
          variant="overlay"
          onEnable={props.onEnableLandscape}
          onDisable={props.onDisableLandscape}
        />
      )}
      {hudProps && <TopBar {...hudProps} />}
      <div className="playfield">
        <div className="pixi-host" ref={hostRef} />
        {booting && (
          <div className="overlay">
            <h2>正在准备</h2>
            <div className="status">合成曲目并启动场景…</div>
          </div>
        )}
        {hud && hudProps && (
          <FieldOverlay
            hud={hud}
            touch={props.touch}
            runResultOverride={props.runResultOverride}
            firstClearGuideStep={props.firstClearGuideStep}
            onGuideAdvance={props.onGuideAdvance}
            onPause={hudProps.onPause}
            onEnd={hudProps.onEnd}
            onRestart={hudProps.onRestart}
            onReselect={hudProps.onReselect}
            onShare={hudProps.onShare}
            onNextLevel={hudProps.onNextLevel}
            onGoShop={props.onGoShop}
            onWatchReviveAd={() => setReviveAdOpen(true)}
            onForfeitRevive={() => rtRef.current?.forfeitRevive()}
            onLatency={hudProps.onLatency}
            shareHint={shareHint}
          />
        )}
        <ReviveAdModal
          open={reviveAdOpen && !!hud?.reviveAvailable && hud.run === "lose"}
          onClose={() => setReviveAdOpen(false)}
          onComplete={() => {
            setReviveAdOpen(false);
            rtRef.current?.reviveFromAd();
          }}
        />
        {mobilePlay &&
          hud &&
          !hud.paused &&
          hud.run !== "lose" &&
          hud.run !== "win" &&
          (hud.run === "playing" || hud.run === "tutorial") && (
          <TouchControls
            ultReady={hud.ultReady}
            tutorial={hud.run === "tutorial"}
            gameOver={false}
            onMove={(x, y) => rtRef.current?.setMove(x, y)}
            onAttack={() => rtRef.current?.queueAttack()}
            onSlide={() => rtRef.current?.queueSlide()}
            onUlt={() => rtRef.current?.queueUlt()}
            onPause={() => rtRef.current?.togglePause()}
            onContext={() => {
              const rt = rtRef.current;
              if (!rt) return;
              if (rt.sim.run === "tutorial") rt.startCombat();
              else if (rt.sim.run === "win" || rt.sim.run === "lose") rt.restart(false);
            }}
          />
        )}
      </div>
      {hudProps && <BottomHud {...hudProps} />}
    </div>
  );
}
