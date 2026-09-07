import type { ReactNode } from "react";
import type { HeroId } from "../game/types";
import { HERO_VISUAL } from "./menuTheme";

export function MenuBackdrop() {
  return (
    <div className="menu-backdrop" aria-hidden>
      <div className="menu-backdrop__fog" />
      <div className="menu-backdrop__vignette" />
      <div className="menu-backdrop__grain" />
    </div>
  );
}

export function GameLogo(props: { compact?: boolean }) {
  return (
    <div className={`game-logo${props.compact ? " game-logo--compact" : ""}`}>
      <span className="game-logo__kanji" aria-hidden>
        曲
      </span>
      <div className="game-logo__text">
        <h1 className="game-logo__title">曲无双</h1>
        {!props.compact && <p className="game-logo__sub">节拍斩丧尸 · 一曲一命</p>}
      </div>
    </div>
  );
}

export function GoldBadge(props: { amount: number }) {
  return (
    <div className="gold-badge" title="金币">
      <span className="gold-badge__icon" aria-hidden>
        ◆
      </span>
      <span className="gold-badge__val">{props.amount}</span>
    </div>
  );
}

export function SectionTitle(props: { children: ReactNode; icon?: string }) {
  return (
    <div className="section-title">
      {props.icon && <span className="section-title__icon">{props.icon}</span>}
      <span>{props.children}</span>
      <span className="section-title__line" />
    </div>
  );
}

export function MenuPanel(props: { children: ReactNode; className?: string }) {
  return <div className={`menu-panel${props.className ? ` ${props.className}` : ""}`}>{props.children}</div>;
}

export function HeroPortrait(props: { heroId: HeroId; size?: "sm" | "md" | "lg" }) {
  const v = HERO_VISUAL[props.heroId];
  return (
    <div
      className={`hero-portrait hero-portrait--${props.size ?? "md"}`}
      style={{ background: v.grad, ["--hero-accent" as string]: v.accent, ["--hero-glow" as string]: v.glow }}
    >
      <span className="hero-portrait__glyph">{v.glyph}</span>
    </div>
  );
}

export function MenuHeader(props: {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  gold?: number;
  actions?: ReactNode;
}) {
  return (
    <header className="menu-header">
      <div className="menu-header__main">
        {props.showLogo ? (
          <GameLogo compact />
        ) : (
          <div className="menu-header__titles">
            {props.title && <h1 className="menu-header__title">{props.title}</h1>}
            {props.subtitle && <p className="menu-header__sub">{props.subtitle}</p>}
          </div>
        )}
      </div>
      <div className="menu-header__actions">
        {props.gold != null && <GoldBadge amount={props.gold} />}
        {props.actions}
      </div>
    </header>
  );
}

export function MenuScreen(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`menu-screen${props.className ? ` ${props.className}` : ""}`}>
      <MenuBackdrop />
      <div className="menu-screen__frame">{props.children}</div>
    </div>
  );
}
