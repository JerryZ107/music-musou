import { useRef } from "react";
import type { WeaponId } from "../game/types";
import { HEROES } from "../game/tracks";

const JOY_DEAD = 0.14;

function tapButton(fn: () => void) {
  return (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
}

export function TouchControls(props: {
  ultReady: boolean;
  tutorial: boolean;
  gameOver: boolean;
  allowed: WeaponId[];
  weaponId: WeaponId;
  onMove: (x: number, y: number) => void;
  onAttack: () => void;
  onSlide: () => void;
  onUlt: () => void;
  onWeapon: (id: WeaponId) => void;
  onContext: () => void;
  onPause: () => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);

  const centerKnob = () => {
    const k = knobRef.current;
    if (k) {
      k.style.transform = "translate(-50%, -50%)";
      k.style.left = "50%";
      k.style.top = "50%";
    }
  };

  const setKnob = (dx: number, dy: number) => {
    const k = knobRef.current;
    if (k) {
      k.style.left = `calc(50% + ${dx}px)`;
      k.style.top = `calc(50% + ${dy}px)`;
      k.style.transform = "translate(-50%, -50%)";
    }
  };

  const emitMove = (nx: number, ny: number) => {
    const mag = Math.hypot(nx, ny);
    if (mag < JOY_DEAD) {
      props.onMove(0, 0);
      return;
    }
    props.onMove(nx, ny);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = baseRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    pid.current = e.pointerId;
    onMoveAt(e);
  };

  const onMoveAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = baseRef.current;
    if (!el || pid.current !== e.pointerId) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = Math.max(24, r.width / 2 - r.width * 0.19);
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    setKnob(dx, dy);
    const nx = max > 0 ? dx / max : 0;
    const ny = max > 0 ? dy / max : 0;
    emitMove(nx, ny);
  };

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    centerKnob();
    props.onMove(0, 0);
  };

  const contextLabel = props.tutorial ? "实战" : props.gameOver ? "重开" : "T";

  return (
    <div className="touch-layer" aria-label="触屏操控">
      <div className="touch-left">
        <div
          ref={baseRef}
          className="joy-base"
          onPointerDown={onDown}
          onPointerMove={onMoveAt}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div ref={knobRef} className="joy-knob" />
        </div>
        <span className="touch-hint">移动</span>
      </div>

      <div className="touch-right">
        <div className="touch-weapons">
          {props.allowed.map((id) => (
            <button
              key={id}
              type="button"
              className={id === props.weaponId ? "touch-chip primary" : "touch-chip"}
              onPointerDown={tapButton(() => props.onWeapon(id))}
            >
              {HEROES[id].short}
            </button>
          ))}
          <button type="button" className="touch-chip" onPointerDown={tapButton(props.onContext)}>
            {contextLabel}
          </button>
          <button type="button" className="touch-chip" onPointerDown={tapButton(props.onPause)}>
            暂停
          </button>
        </div>

        <div className="touch-actions">
          <button
            type="button"
            className={props.ultReady ? "act-btn ult ready" : "act-btn ult"}
            aria-label="大招"
            onPointerDown={tapButton(props.onUlt)}
          >
            <span className="act-icon">★</span>
            <span className="act-label">大招</span>
          </button>
          <button
            type="button"
            className="act-btn slide"
            aria-label="滑步"
            onPointerDown={tapButton(props.onSlide)}
          >
            <span className="act-icon">↷</span>
            <span className="act-label">滑步</span>
          </button>
          <button
            type="button"
            className="act-btn attack"
            aria-label="普攻"
            onPointerDown={tapButton(props.onAttack)}
          >
            <span className="act-icon">⚔</span>
            <span className="act-label">普攻</span>
          </button>
        </div>
      </div>
    </div>
  );
}
