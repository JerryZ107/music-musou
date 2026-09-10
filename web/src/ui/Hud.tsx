import type { HudSnapshot, RunResult } from "../game/types";
import {
  beatMarkHot,
  beatTimelineView,
  BEAT_TIMELINE_WINDOW_MS,
  visibleBeatMarks,
} from "../game/beatTimeline";
import { BEAT_WINDOW_MS } from "../game/constants";
import { LEVELS } from "../game/levels";
import { formatStars } from "../game/runResult";
import { TRACKS, HEROES } from "../game/tracks";
import type { FirstClearGuideStep } from "../game/onboarding";
import { isFirstClearGuideActive } from "../game/onboarding";
import { GuideSpotlight } from "./GuideSpotlight";
import { RewardRevealCard } from "./RewardRevealCard";

export type HudHandlers = {
  hud: HudSnapshot;
  touch: boolean;
  onCombat: () => void;
  onRestart: () => void;
  onReselect: () => void;
  onMute: () => void;
  onLatency: (d: number) => void;
  onPause: () => void;
  onEnd: () => void;
  onShare?: () => void;
  onNextLevel?: () => void;
  onGoShop?: () => void;
  firstClearGuideStep?: FirstClearGuideStep | null;
  onGuideAdvance?: () => void;
  shareHint?: string | null;
  onWatchReviveAd?: () => void;
  onForfeitRevive?: () => void;
  portrait?: boolean;
  landscapeForced?: boolean;
  onEnableLandscape?: () => void;
  onDisableLandscape?: () => void;
};

export function TopBar(props: HudHandlers) {
  const h = props.hud;
  return (
    <header className="top-bar hud-frame">
      <div className="hud-brand">
        <span className="hud-brand__track">{LEVELS[h.levelId].short}</span>
        <span className="hud-brand__sep">·</span>
        <span className="hud-brand__hero">{TRACKS[h.trackId].name}</span>
        <span className="hud-brand__sep">·</span>
        <span className="hud-brand__hero">{HEROES[h.weaponId].short}</span>
      </div>
      <div className="hud-actions">
      {h.run === "tutorial" && !props.touch && (
        <button className="hud-btn hud-btn--cta" onClick={props.onCombat}>
          实战 T
        </button>
      )}
      {props.touch && h.run === "tutorial" && (
        <button className="hud-btn hud-btn--cta" onClick={props.onCombat}>
          实战
        </button>
      )}
      <button className="hud-btn" onClick={props.onPause}>
        {h.paused ? "继续" : "暂停"}
      </button>
      <button className="hud-btn" onClick={props.onEnd}>
        结束
      </button>
      <button className="hud-btn hud-btn--icon" onClick={props.onMute}>
        {h.muted ? "🔇" : "🔊"}
      </button>
      {!props.touch && (
        <>
          <button className="hud-btn hud-btn--sm" onClick={() => props.onLatency(10)}>
            延迟+
          </button>
          <button className="hud-btn hud-btn--sm" onClick={() => props.onLatency(-10)}>
            延迟-
          </button>
          <span className="hud-latency">{Math.round(h.latencyMs)}ms</span>
        </>
      )}
      </div>
      <div className="hud-buffs">
      {h.spearUltAttacksLeft > 0 && h.weaponId === 2 && (
        <span className="hud-tag hud-tag--spear">游龙 ×{h.spearUltAttacksLeft}</span>
      )}
      {h.weaponId === 1 && h.orbitSwordCount > 0 && (
        <span className="hud-tag hud-tag--shield">飞剑 ×{h.orbitSwordCount}</span>
      )}
      {props.touch &&
        (props.portrait || props.landscapeForced) &&
        props.onEnableLandscape &&
        props.onDisableLandscape && (
          <button
            type="button"
            className="hud-btn hud-btn--sm top-bar-landscape"
            onClick={props.landscapeForced ? props.onDisableLandscape : props.onEnableLandscape}
          >
            {props.landscapeForced ? "竖屏" : "横屏"}
          </button>
        )}
      </div>
    </header>
  );
}

/** 战斗顶端节拍进度条：过中点后游标钉住，拍点随时间左移。 */
export function BeatTimelineBar({ hud }: { hud: HudSnapshot }) {
  const windowMs = BEAT_TIMELINE_WINDOW_MS;
  const { scrollLeftMs, playheadFrac } = beatTimelineView(hud.timelineMs, windowMs);
  const showSkillColors = hud.weaponId === 1 || hud.weaponId === 3;
  const marks = visibleBeatMarks(
    hud.beatTimesMs,
    hud.loopMs,
    scrollLeftMs,
    windowMs,
    undefined,
    showSkillColors ? hud.beatSkillTiers : undefined,
  );
  const zoneFrac = BEAT_WINDOW_MS / windowMs;
  return (
    <div
      className={`beat-timeline${hud.inZone ? " beat-timeline--zone" : ""}`}
      aria-hidden
    >
      <div className="beat-timeline__past" style={{ width: `${playheadFrac * 100}%` }} />
      <div className="beat-timeline__track">
        {marks.map((m) => {
          const left = m.frac - zoneFrac / 2;
          const right = m.frac + zoneFrac / 2;
          if (right < -0.02 || left > 1.02) return null;
          const hot = beatMarkHot(m.absMs, hud.timelineMs);
          const tierClass =
            m.tier === "light"
              ? " is-skill-light"
              : m.tier === "mid"
                ? " is-skill-mid"
                : m.tier === "heavy"
                  ? " is-skill-heavy"
                  : "";
          return (
            <span
              key={m.absMs}
              className={`beat-timeline__beat${hot ? " is-hot" : ""}${tierClass}`}
              style={{ left: `${left * 100}%`, width: `${zoneFrac * 100}%` }}
            />
          );
        })}
        {hud.inputMarks.map((hit) => {
          const frac = (hit.absMs - scrollLeftMs) / windowMs;
          if (frac < -0.02 || frac > 1.02) return null;
          return (
            <span
              key={`hit-${hit.absMs}`}
              className={`beat-timeline__hit${hit.onBeat ? " is-onbeat" : ""}`}
              style={{ left: `${frac * 100}%` }}
            />
          );
        })}
      </div>
      <div className="beat-timeline__playhead" style={{ left: `${playheadFrac * 100}%` }} />
    </div>
  );
}

export function BottomHud(props: HudHandlers) {
  const h = props.hud;
  const goldFrac = Math.max(0.08, Math.min(0.45, h.windowFrac));
  const silverFrac = Math.max(goldFrac, Math.min(0.55, h.silverPreFrac));
  const goldW = `${goldFrac * 50}%`;
  const silverW = `${silverFrac * 50}%`;
  const warm = !h.inCombatZone && h.beatProximity > 0.35;
  return (
    <footer
      className={`bottom-hud hud-frame${h.inZone ? " beat-hot" : h.inSilverZone ? " beat-silver" : warm ? " beat-warm" : ""}`}
    >
      <div className="hud-hp" title="HP">
        {Array.from({ length: h.maxHp }, (_, i) => (
          <span key={i} className={i < h.hp ? "heart on" : "heart"} />
        ))}
      </div>
      <div className="hud-energy" title="大招能量">
        {Array.from({ length: h.energyMax }, (_, i) => (
          <span
            key={i}
            className={i < h.energy ? (h.ultReady ? "pip ready" : "pip on") : "pip"}
          />
        ))}
      </div>
      <div
        className={`beat-bar ${h.inZone ? "hot" : h.inSilverZone ? "silver" : warm ? "warm" : ""}`}
        title={`${h.beatCount} 个卡拍节点 · 银环预警 · 金环强普 · 延迟 ${Math.round(h.latencyMs)}ms`}
      >
        <span className="beat-zone-silver left" style={{ width: silverW }} />
        <span className="beat-zone-silver right" style={{ width: silverW }} />
        <span className="beat-zone left" style={{ width: goldW }} />
        <span className="beat-zone right" style={{ width: goldW }} />
        <span className="beat-tick left" style={{ left: goldW }} />
        <span className="beat-tick right" style={{ right: goldW }} />
        <span className="beat-dot" style={{ left: `${h.beatPhase01 * 100}%` }} />
        {h.inSilverZone && !h.inZone && <span className="beat-pre">预备</span>}
        {h.inZone && <span className="beat-now">拍!</span>}
      </div>
      {h.combo >= 2 && h.run === "playing" && (
        <div className="combo-meter" title="连击">
          <span className="combo-label">连击</span>
          <strong className="combo-value">×{h.combo}</strong>
          {h.maxCombo >= h.combo && h.maxCombo >= 5 && (
            <span className="combo-best">最高 {h.maxCombo}</span>
          )}
        </div>
      )}
      {h.nearestBossHp != null && h.nearestBossMax != null && (
        <div className="boss-bar-wrap">
          <span className="boss-bar-label">尸王</span>
          <div className="boss-bar" title="Boss HP">
            <span style={{ width: `${(h.nearestBossHp / h.nearestBossMax) * 100}%` }} />
          </div>
        </div>
      )}
      <span className={`hud-wave${h.run === "playing" ? " hud-wave--live" : ""}`}>
        {h.run === "playing"
          ? props.touch
            ? `${h.wave}/${h.waveTotal}波`
            : `第 ${h.wave}/${h.waveTotal} 波 · 丧尸 ${h.enemyCount - h.bossCount - h.megabossCount} · 尸王 ${h.bossCount}${h.megabossCount > 0 ? ` · 中王 ${h.megabossCount}` : ""}${h.pendingCount > 0 ? ` · 援军 ${h.pendingCount}` : ""}`
          : h.run === "tutorial"
            ? "训练场 · 武士旋斩 / 枪客半扫 / 弓使飞矢"
            : h.run === "win"
              ? "胜利"
              : "失败"}
        {h.inCombatZone && !h.inZone ? " · 预备" : ""}
        {h.inZone ? " · 拍!" : ""}
      </span>
      {!props.touch && (h.run === "win" || h.run === "lose") && (
        <>
          {h.run === "lose" && h.reviveAvailable && (
            <button className="primary" type="button" onClick={() => props.onWatchReviveAd?.()}>
              复活
            </button>
          )}
          <button
            className={h.run === "lose" && h.reviveAvailable ? undefined : "primary"}
            type="button"
            onClick={() => {
              if (h.run === "lose" && h.reviveAvailable) props.onForfeitRevive?.();
              props.onRestart?.();
            }}
          >
            重开 R
          </button>
          <button
            type="button"
            onClick={() => {
              if (h.run === "lose" && h.reviveAvailable) props.onForfeitRevive?.();
              props.onReselect?.();
            }}
          >
            回选曲 S
          </button>
        </>
      )}
      {props.touch && (h.run === "win" || h.run === "lose") && (
        <div className="touch-result-bar">
          {h.run === "lose" ? (
            <>
              {h.reviveAvailable && (
                <button className="primary" type="button" onClick={() => props.onWatchReviveAd?.()}>
                  复活
                </button>
              )}
              <button
                type="button"
                className={h.reviveAvailable ? undefined : "primary"}
                onClick={() => {
                  if (h.reviveAvailable) props.onForfeitRevive?.();
                  props.onRestart?.();
                }}
              >
                重开
              </button>
              <button
                type="button"
                onClick={() => {
                  if (h.reviveAvailable) props.onForfeitRevive?.();
                  props.onReselect?.();
                }}
              >
                回选曲
              </button>
            </>
          ) : (
            <>
              {h.levelId === 2 ? (
                <>
                  <button
                    className="primary"
                    type="button"
                    data-guide="win-next"
                    onClick={() =>
                      isFirstClearGuideActive(props.firstClearGuideStep)
                        ? props.onNextLevel?.()
                        : props.onReselect?.()
                    }
                  >
                    完成
                  </button>
                  <button type="button" onClick={() => props.onGoShop?.()}>
                    商店
                  </button>
                </>
              ) : isFirstClearGuideActive(props.firstClearGuideStep) ? (
                <button
                  className="primary"
                  type="button"
                  data-guide="win-next"
                  onClick={() => props.onNextLevel?.()}
                >
                  下一关
                </button>
              ) : (
                <button className="primary" type="button" onClick={() => props.onShare?.()}>
                  分享
                </button>
              )}
              {h.levelId !== 2 && (
                <>
                  <button type="button" onClick={props.onRestart}>
                    重开
                  </button>
                  <button type="button" onClick={props.onReselect}>
                    回选曲
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </footer>
  );
}

export function FieldOverlay(props: {
  hud: HudSnapshot;
  touch: boolean;
  runResultOverride?: RunResult | null;
  firstClearGuideStep?: FirstClearGuideStep | null;
  onGuideAdvance?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onRestart?: () => void;
  onReselect?: () => void;
  onShare?: () => void;
  onNextLevel?: () => void;
  onGoShop?: () => void;
  onWatchReviveAd?: () => void;
  onForfeitRevive?: () => void;
  onLatency?: (delta: number) => void;
  shareHint?: string | null;
}) {
  const h = props.hud;
  if (h.reviveHoldMs > 0 && h.run === "playing") {
    const sec = Math.max(1, Math.ceil(h.reviveHoldMs / 1000));
    return (
      <div className="overlay revive-countdown" role="status" aria-live="polite">
        <div className="revive-countdown-card">
          <p className="revive-countdown-lede">复活成功</p>
          <div className="revive-countdown-num">{sec}</div>
          <p className="revive-countdown-sub">稍后继续 · 开场 1 秒无敌</p>
        </div>
      </div>
    );
  }
  if (h.paused && h.run !== "win" && h.run !== "lose") {
    return (
      <div className="overlay pause result-panel">
        <div className="result-banner result-banner--pause">休</div>
        <h2>战场暂停</h2>
        <div className="status">{props.touch ? "点「继续」恢复" : "按 P 或 Esc 继续"}</div>
        {props.touch && (
          <p className="pause-touch-latency">
            节拍延迟 {Math.round(h.latencyMs)}ms
            <button type="button" className="ghost" onClick={() => props.onLatency?.(10)}>
              +
            </button>
            <button type="button" className="ghost" onClick={() => props.onLatency?.(-10)}>
              −
            </button>
          </p>
        )}
        <div className="overlay-actions">
          <button className="primary pause-resume" onClick={props.onPause}>
            继续
          </button>
          <button className="ghost" onClick={props.onEnd}>
            结束
          </button>
        </div>
      </div>
    );
  }
  if (h.run === "tutorial") {
    return (
      <div className={`overlay${props.touch ? " tutorial-scroll" : ""}`}>
        <div className="tutorial">
          <strong>训练场 · 废园墓园</strong>
          {props.touch ? (
            <>
              <div>左下摇杆 · 右下普攻/滑步/大招 · 顶栏「实战」开打</div>
              <div>卡拍 = 节拍条金环亮区出手，伤害更高；银环只是预警。</div>
            </>
          ) : (
            <>
              <div>WASD 移动 · Enter 普攻 · Shift 滑步 · 空格大招 · P 暂停 · Q 结束</div>
              <div>节拍条金环亮区普攻 = 卡拍强普（伤害 3），无视动作 CD；银环仅预警不算强普。每拍限一次强普。滑步另有独立卡拍槽；未卡拍滑步也会打出普通普攻。</div>
              <div>武士长刀绕身一圈，枪客 45° 挥枪（卡拍 90°），弓使射锁敌箭。打中丧尸身体才算命中。空挥不充能。卡拍命中（普攻与节拍技能，不含大招）累计 10 次可放大招。</div>
              <div>丧尸会冲刺，尸王会读条砸地并放弹幕：红圈前摇时滑步可躲，弹幕用位移躲开。木箱/灯柱/墓碑可打碎清路。</div>
              <div>按 T 进入实战。</div>
            </>
          )}
        </div>
      </div>
    );
  }
  if (h.run === "win") {
    const r = props.runResultOverride ?? h.runResult;
    const guideStep = props.firstClearGuideStep;
    const guideActive = isFirstClearGuideActive(guideStep);
    const showRewardCards = guideActive && guideStep?.startsWith("reward_");
    const showWinStats = !showRewardCards;
    const revealTrackId = r?.trackUnlocked ?? 2;
    const revealLevelId = r?.levelUnlocked ?? 2;
    const revealGold = r?.goldEarned ?? 10;
    const level2Clear = (r?.levelId ?? h.levelId) === 2;

    return (
      <>
        <RewardRevealCard
          open={guideStep === "reward_track"}
          kind="track"
          trackId={revealTrackId}
          title={TRACKS[revealTrackId].name}
          subtitle="新曲目已加入曲库"
          detail={TRACKS[revealTrackId].composer}
          onContinue={() => props.onGuideAdvance?.()}
        />
        <RewardRevealCard
          open={guideStep === "reward_gold"}
          kind="gold"
          title={`+${revealGold}`}
          subtitle="金币已入账"
          detail={r?.promptShop ? "可在商城招募武将" : undefined}
          onContinue={() => props.onGuideAdvance?.()}
        />
        <RewardRevealCard
          open={guideStep === "reward_level" && !!r?.levelUnlocked}
          kind="level"
          levelId={revealLevelId}
          title={LEVELS[revealLevelId].short}
          subtitle="新关卡已解锁"
          detail={LEVELS[revealLevelId].name}
          onContinue={() => props.onGuideAdvance?.()}
        />
        <div className={`overlay win result result-panel${showRewardCards ? " win--reveal" : ""}`}>
          <div className="result-banner result-banner--win">胜</div>
          <h2>丧尸清场</h2>
          {r && showWinStats && (
            <div className="result-card">
              <div className="result-stars" aria-label={`${r.stars} 星`}>
                {formatStars(r.stars)}
              </div>
              <div className="result-score">{r.score} 分</div>
              {!guideActive && (r.goldEarned ?? 0) > 0 && (
                <p className="result-reward">获得金币 +{r.goldEarned}</p>
              )}
              {!guideActive && r.trackUnlocked && (
                <p className="result-reward">解锁曲目 · {TRACKS[r.trackUnlocked].name}</p>
              )}
              {!guideActive && r.levelUnlocked && (
                <p className="result-reward">解锁关卡 · {LEVELS[r.levelUnlocked].short}</p>
              )}
              <dl className="result-stats">
                <div>
                  <dt>最高连击</dt>
                  <dd>{r.maxCombo}</dd>
                </div>
                <div>
                  <dt>总输出</dt>
                  <dd>{r.totalDamage}</dd>
                </div>
                <div>
                  <dt>卡拍命中</dt>
                  <dd>{r.beatHits}</dd>
                </div>
                <div>
                  <dt>剩余 HP</dt>
                  <dd>{r.hpLeft}</dd>
                </div>
              </dl>
              <p className={`result-hint${props.touch ? " touch" : ""}`}>
                {props.touch
                  ? level2Clear
                    ? "可返回整备，或前往商店"
                    : guideActive
                      ? r?.promptShop
                        ? "按引导继续挑战第二关"
                        : "按引导返回战前整备"
                      : "点下方或本页按钮分享 / 重开 / 回选曲"
                  : r.stars === 3
                    ? "三星：满血感 + 连击 + 卡拍全兑现"
                    : r.stars === 2
                      ? "二星：通关但还有优化空间，可再刷三星"
                      : "一星：先保证通关，再练连击与卡拍"}
              </p>
            </div>
          )}
          {showWinStats && (
            <div className={`overlay-actions result-actions${props.touch ? " result-actions--desktop" : ""}`}>
              {level2Clear ? (
                <>
                  <button
                    className="primary"
                    type="button"
                    data-guide="win-next"
                    onClick={() =>
                      guideActive ? props.onNextLevel?.() : props.onReselect?.()
                    }
                  >
                    完成
                  </button>
                  <button type="button" onClick={() => props.onGoShop?.()}>
                    商店
                  </button>
                </>
              ) : guideActive ? (
                <button
                  className="primary"
                  type="button"
                  data-guide="win-next"
                  onClick={() => props.onNextLevel?.()}
                >
                  下一关
                </button>
              ) : (
                <>
                  <button className="primary" type="button" onClick={() => props.onShare?.()}>
                    复制成绩分享
                  </button>
                  <button type="button" onClick={props.onRestart}>
                    再来一局
                  </button>
                  <button type="button" onClick={props.onReselect}>
                    回选曲
                  </button>
                </>
              )}
            </div>
          )}
          {props.shareHint && <div className="share-toast">{props.shareHint}</div>}
          {!props.touch && !props.shareHint && showWinStats && !guideActive && !level2Clear && (
            <div className="status">[R] 重开 · [S] 重选曲/角色</div>
          )}
        </div>
        <GuideSpotlight
          active={guideStep === "win_next" && !!r?.promptShop}
          targetId="win-next"
          label="点击进入战前整备"
        />
      </>
    );
  }
  if (h.run === "lose") {
    const canRevive = h.reviveAvailable;
    return (
      <>
        <div className="overlay lose result revive-offer result-panel">
          <div className="result-banner result-banner--lose">败</div>
          <h2>力竭倒下</h2>
          <div className="revive-card">
            {canRevive ? (
              <>
                <p className="revive-lede">本局还可看广告复活一次</p>
                <p className="revive-sub">复活后 3 HP，倒计时 3 秒再继续，并有 1 秒无敌</p>
              </>
            ) : (
              <>
                <p className="revive-lede">本局复活已用尽</p>
                <p className="revive-sub">可重开本关，或回选曲整备后再战</p>
              </>
            )}
          </div>
          <div className={`overlay-actions result-actions${props.touch ? " result-actions--desktop" : ""}`}>
            {canRevive && (
              <button className="primary" type="button" onClick={() => props.onWatchReviveAd?.()}>
                复活
              </button>
            )}
            <button
              type="button"
              className={canRevive ? undefined : "primary"}
              onClick={() => {
                if (canRevive) props.onForfeitRevive?.();
                props.onRestart?.();
              }}
            >
              重开
            </button>
            <button
              type="button"
              onClick={() => {
                if (canRevive) props.onForfeitRevive?.();
                props.onReselect?.();
              }}
            >
              回选曲
            </button>
          </div>
          {!props.touch && (
            <div className="status">
              {canRevive ? "复活 · [R] 重开 · [S] 回选曲" : "[R] 重开 · [S] 回选曲"}
            </div>
          )}
        </div>
      </>
    );
  }
  return null;
}
