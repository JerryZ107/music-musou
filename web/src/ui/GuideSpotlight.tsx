import { useEffect, useState, type ReactNode } from "react";

type Rect = { top: number; left: number; width: number; height: number };

function measureTarget(targetId: string): Rect | null {
  const el = document.querySelector(`[data-guide="${targetId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  const pad = 6;
  return {
    top: Math.max(8, r.top - pad),
    left: Math.max(8, r.left - pad),
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function GuideSpotlight(props: {
  active: boolean;
  targetId: string;
  label?: string;
  onTargetActivate?: () => void;
  children?: ReactNode;
}) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!props.active) {
      setRect(null);
      return;
    }
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      setRect(measureTarget(props.targetId));
    };
    sync();
    const timer = window.setInterval(sync, 120);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [props.active, props.targetId]);

  useEffect(() => {
    if (!props.active || !props.onTargetActivate) return;
    const el = document.querySelector(`[data-guide="${props.targetId}"]`);
    if (!el) return;
    const handler = (e: Event) => {
      e.stopPropagation();
      props.onTargetActivate?.();
    };
    el.addEventListener("click", handler, true);
    return () => el.removeEventListener("click", handler, true);
  }, [props.active, props.targetId, props.onTargetActivate]);

  if (!props.active || !rect) return <>{props.children}</>;

  return (
    <>
      {props.children}
      <div className="guide-spotlight-layer" aria-hidden>
        <div
          className="guide-spotlight-hole"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
        {props.label && (
          <p
            className="guide-spotlight-label"
            style={{
              top: rect.top + rect.height + 10,
              left: rect.left + rect.width / 2,
            }}
          >
            {props.label}
          </p>
        )}
      </div>
    </>
  );
}
