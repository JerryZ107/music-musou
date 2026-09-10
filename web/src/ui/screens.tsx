import { useState } from "react";
import { HERO_SELECT_ORDER } from "../game/meta";
import { TRACKS, HEROES } from "../game/tracks";
import { LEVELS } from "../game/levels";
import type { AccountMeta, AccountData, SlotData } from "../game/save";
import type { LevelId, TrackId, WeaponId } from "../game/types";
import { TRACK_CODEX } from "../game/codex";
import type { FirstClearGuideStep } from "../game/onboarding";
import { guideStepLabel, isFirstClearGuideActive } from "../game/onboarding";
import { GuideSpotlight } from "./GuideSpotlight";
import { LandscapeModeToggle } from "./LandscapeModeToggle";
import {
  GameLogo,
  HeroPortrait,
  MenuHeader,
  MenuPanel,
  MenuScreen,
  SectionTitle,
} from "./MenuChrome";
import { TRACK_VISUAL } from "./menuTheme";
import { LEVEL_VISUAL } from "../game/levels";

type MenuLandscapeProps = {
  landscapeForced: boolean;
  portrait: boolean;
  onEnableLandscape: () => void;
  onDisableLandscape: () => void;
} | null;

export function AccountGate(props: {
  accounts: AccountData[];
  lastName: string | null;
  onEnter: (name: string) => void;
}) {
  const [name, setName] = useState(props.lastName ?? "");
  return (
    <MenuScreen>
      <GameLogo />
      <MenuPanel className="account-panel">
        <p className="lede">
          注册即得第一关、Recall 与枪兵。手机可选横屏浏览选单；出征后可按提示开启战斗横屏。通关解锁新曲、关卡与商城。
        </p>
        <div className="row">
          <input
            type="text"
            maxLength={16}
            placeholder="输入武者名号"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) props.onEnter(name.trim());
            }}
          />
          <button type="button" className="primary" disabled={!name.trim()} onClick={() => props.onEnter(name.trim())}>
            踏入废园
          </button>
        </div>
      </MenuPanel>
      {props.accounts.length > 0 && (
        <>
          <SectionTitle icon="◈">已有名号</SectionTitle>
          <div className="account-chips">
            {props.accounts.map((a) => (
              <button type="button" key={a.name} className="account-chip" onClick={() => props.onEnter(a.name)}>
                {a.name}
              </button>
            ))}
          </div>
        </>
      )}
    </MenuScreen>
  );
}

export function SlotPicker(props: {
  account: AccountData;
  landscape?: MenuLandscapeProps;
  onBack: () => void;
  onPick: (index: number, existing: SlotData | null) => void;
  onClear: (index: number) => void;
}) {
  return (
    <MenuScreen>
      <MenuHeader
        title={`存档 · ${props.account.name}`}
        subtitle="每个空槽都是独立进度，互不影响"
        actions={
          <>
            {props.landscape && (
              <LandscapeModeToggle
                active={props.landscape.landscapeForced}
                portrait={props.landscape.portrait}
                variant="nav"
                onEnable={props.landscape.onEnableLandscape}
                onDisable={props.landscape.onDisableLandscape}
              />
            )}
            <button type="button" className="ghost nav-btn" onClick={props.onBack}>
              换名号
            </button>
          </>
        }
      />
      <div className="cards">
        {props.account.slots.map((slot, i) => (
          <button type="button"
            key={i}
            className={`card slot-card${slot ? "" : " slot-card--empty"}`}
            onClick={() => props.onPick(i, slot)}
          >
            <div
              className="card__banner"
              style={{ background: slot ? LEVEL_VISUAL[slot.levelId].grad : "#1a2030" }}
            />
            <div className="card__inner">
              <div className="kicker">存档槽 {i + 1}</div>
              {slot ? (
                <>
                  <h3>
                    {LEVELS[slot.levelId].short} · {TRACKS[slot.trackId].name}
                  </h3>
                  <p>{HEROES[slot.weaponId].short}</p>
                  <div className="slot-card__stats">
                    <span>
                      <strong>{slot.stats.wins}</strong> 胜
                    </span>
                    <span>
                      <strong>{slot.stats.losses}</strong> 负
                    </span>
                    <span>{slot.stats.runs} 局</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="slot-card__plus">+</div>
                  <h3>空槽</h3>
                  <p>全新进度 · 从第一关开始</p>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
      <div className="row">
        {props.account.slots.map((slot, i) =>
          slot ? (
            <button type="button" key={i} className="ghost nav-btn" onClick={() => props.onClear(i)}>
              清空槽 {i + 1}
            </button>
          ) : null,
        )}
      </div>
    </MenuScreen>
  );
}

export function SelectScreen(props: {
  levelId: LevelId;
  trackId: TrackId;
  weaponId: WeaponId;
  meta: AccountMeta;
  landscape?: MenuLandscapeProps;
  shopPromptPending: boolean;
  firstClearGuideStep?: FirstClearGuideStep | null;
  onGuideAdvance?: () => void;
  onGuideComplete?: () => void;
  onLevel: (id: LevelId) => void;
  onTrack: (id: TrackId) => void;
  onWeapon: (id: WeaponId) => void;
  onStart: () => void;
  onBack: () => void;
  onOpenShop: () => void;
  onOpenCodex: () => void;
}) {
  const levelLocked = !props.meta.unlockedLevels.includes(props.levelId);
  const trackLocked = !props.meta.unlockedTracks.includes(props.trackId);
  const heroLocked = !props.meta.unlockedHeroes.includes(props.weaponId);
  const needArcher = props.levelId === 2 && !props.meta.unlockedHeroes.includes(3);
  const canStart = !levelLocked && !trackLocked && !heroLocked && !needArcher;
  const guideStep = props.firstClearGuideStep;
  const guideActive = isFirstClearGuideActive(guideStep);

  return (
    <MenuScreen>
      <MenuHeader
        title="战前整备"
        subtitle="关卡 · 曲目 · 武将（各选一）"
        gold={props.meta.gold}
        actions={
          <>
            {props.landscape && (
              <LandscapeModeToggle
                active={props.landscape.landscapeForced}
                portrait={props.landscape.portrait}
                variant="nav"
                onEnable={props.landscape.onEnableLandscape}
                onDisable={props.landscape.onDisableLandscape}
              />
            )}
            <button type="button" className="ghost nav-btn" onClick={props.onOpenCodex}>
              资料片
            </button>
            <button type="button"
              className="ghost nav-btn"
              disabled={!props.meta.shopUnlocked}
              title={props.meta.shopUnlocked ? undefined : "通关第一关后解锁"}
              data-guide="select-shop"
              onClick={() => props.meta.shopUnlocked && props.onOpenShop()}
            >
              商城{props.meta.shopUnlocked ? "" : " 🔒"}
            </button>
            <button type="button" className="ghost nav-btn" onClick={props.onBack}>
              返回
            </button>
          </>
        }
      />
      {props.shopPromptPending && !props.meta.unlockedHeroes.includes(3) && !guideActive && (
        <p className="shop-guide">
          第一关已通关！商城已开启：用 10 金币招募弓使（武士 20 金币），再挑战第二关。
        </p>
      )}

      <SectionTitle icon="⚑">关卡</SectionTitle>
      <div className="cards select-scroll">
        {([1, 2] as LevelId[]).map((id) => {
          const locked = !props.meta.unlockedLevels.includes(id);
          const lv = LEVELS[id];
          const vis = LEVEL_VISUAL[id];
          return (
            <button type="button"
              key={id}
              className={["card", id === props.levelId ? "selected" : "", locked ? "locked" : ""]
                .filter(Boolean)
                .join(" ")}
              disabled={locked}
              onClick={() => {
                if (locked) return;
                props.onLevel(id);
              }}
            >
              <div className="card__banner" style={{ background: vis.grad }} />
              <div className="card__inner">
                <div className="kicker">{lv.waves}</div>
                <h3>{lv.short}</h3>
                <p>{lv.name}</p>
                <p>{locked ? "🔒 未解锁" : lv.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <SectionTitle icon="♪">曲目</SectionTitle>
      <div className="cards select-scroll">
        {(Object.values(TRACKS) as (typeof TRACKS)[TrackId][]).map((t) => {
          const locked = !props.meta.unlockedTracks.includes(t.trackId);
          const vis = TRACK_VISUAL[t.trackId];
          return (
            <button type="button"
              key={t.trackId}
              className={["card", t.trackId === props.trackId ? "selected" : "", locked ? "locked" : ""]
                .filter(Boolean)
                .join(" ")}
              disabled={locked}
              onClick={() => {
                if (locked) return;
                props.onTrack(t.trackId);
              }}
            >
              <div className="card__banner" style={{ background: vis.grad }} />
              <div className="card__inner">
                <div className="kicker">
                  {vis.icon} {t.bpmLabel} BPM
                </div>
                <h3>{t.name}</h3>
                <p>{TRACK_CODEX[t.trackId].artist}</p>
                <p>{locked ? "🔒 未解锁" : `${t.beatTimesMs.length} 拍 · ${(t.loopMs / 1000).toFixed(1)}s`}</p>
              </div>
            </button>
          );
        })}
      </div>

      <SectionTitle icon="⚔">武将</SectionTitle>
      <div className="cards select-scroll">
        {HERO_SELECT_ORDER.map((heroId) => {
          const hero = HEROES[heroId];
          const owned = props.meta.unlockedHeroes.includes(hero.id);
          const active = props.weaponId === hero.id;
          return (
            <button type="button"
              key={hero.id}
              data-guide={hero.id === 3 ? "select-archer-3" : undefined}
              className={[active ? "selected" : "", owned ? "card" : "card locked"].filter(Boolean).join(" ")}
              disabled={!owned}
              onClick={() => {
                if (!owned) return;
                props.onWeapon(hero.id);
              }}
            >
              <div
                className="card__banner"
                style={{ background: `linear-gradient(90deg, ${TRACK_VISUAL[1].accent}22, transparent)` }}
              />
              <div className="card__inner">
                <div className="card__row">
                  <HeroPortrait heroId={hero.id} size="sm" />
                  <div className="card__body">
                    <div className="kicker">武将 {hero.id}</div>
                    <h3>{hero.name}</h3>
                    <p>{hero.desc}</p>
                  </div>
                </div>
                {!owned && <p className="lock-hint">商城招募</p>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="menu-cta-footer">
        {needArcher && <p className="shop-guide">第二关需要弓使 · 商城 10 金币</p>}
        <button type="button" className="primary" disabled={!canStart} onClick={props.onStart}>
          {canStart
            ? `⚔ 出征 · ${LEVELS[props.levelId].short} / ${TRACKS[props.trackId].name} / ${HEROES[props.weaponId].short}`
            : levelLocked
              ? "关卡未解锁"
              : trackLocked
                ? "曲目未解锁"
                : needArcher
                  ? "需要弓使"
                  : "选择武将"}
        </button>
      </div>
      <GuideSpotlight
        active={guideStep === "select_shop"}
        targetId="select-shop"
        label={guideStepLabel("select_shop")}
      />
    </MenuScreen>
  );
}
