import type { HudSnapshot, WeaponId } from "../game/types";
import { formatStars } from "../game/runResult";
import { TRACKS, HEROES } from "../game/tracks";

export type HudHandlers = {
  hud: HudSnapshot;
  touch: boolean;
  onWeapon: (id: WeaponId) => void;
  onCombat: () => void;
  onRestart: () => void;
  onReselect: () => void;
  onMute: () => void;
  onLatency: (d: number) => void;
  onPause: () => void;
  onEnd: () => void;
  onShare?: () => void;
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
    <header className="top-bar">
      <strong>
        {TRACKS[h.trackId].name} · {HEROES[h.weaponId].name}
      </strong>
      {!props.touch &&
        h.allowedWeapons.map((id) => (
          <button
            key={id}
            className={id === h.weaponId ? "primary" : "ghost"}
            onClick={() => props.onWeapon(id)}
          >
            {HEROES[id].short}
          </button>
        ))}
      {h.run === "tutorial" && !props.touch && (
        <button className="primary" onClick={props.onCombat}>
          进入实战 T
        </button>
      )}
      {props.touch && h.run === "tutorial" && (
        <button className="primary" onClick={props.onCombat}>
          实战
        </button>
      )}
      <button className="ghost" onClick={props.onPause}>
        {h.paused ? "继续 P" : "暂停 P"}
      </button>
      <button className="ghost" onClick={props.onEnd}>
        结束 Q
      </button>
      <button className="ghost" onClick={props.onMute}>
        {h.muted ? "音乐关" : "音乐开"}
      </button>
      {!props.touch && (
        <>
          <button className="ghost" onClick={() => props.onLatency(10)}>
            延迟+
          </button>
          <button className="ghost" onClick={() => props.onLatency(-10)}>
            延迟-
          </button>
          <span className="status">{Math.round(h.latencyMs)}ms</span>
        </>
      )}
      {h.spearThrustCharges > 0 && <span className="tag">戳击 ×{h.spearThrustCharges}</span>}
      {h.samuraiSlideCharges > 0 && <span className="tag">强滑 ×{h.samuraiSlideCharges}</span>}
      {h.shieldHp > 0 && <span className="tag">盾 {h.shieldHp}</span>}
      {props.touch &&
        (props.portrait || props.landscapeForced) &&
        props.onEnableLandscape &&
        props.onDisableLandscape && (
          <button
            type="button"
            className="ghost top-bar-landscape"
            onClick={props.landscapeForced ? props.onDisableLandscape : props.onEnableLandscape}
          >
            {props.landscapeForced ? "退出横屏" : "横屏"}
          </button>
        )}
    </header>
  );
}

export function BottomHud(props: HudHandlers) {
  const h = props.hud;
  const frac = Math.max(0.08, Math.min(0.45, h.windowFrac));
  const left = `${frac * 50}%`;
  return (
    <footer className="bottom-hud">
      <div className="hearts" title="HP">
        {Array.from({ length: h.maxHp }, (_, i) => (
          <span key={i} className={i < h.hp ? "heart on" : "heart"} />
        ))}
      </div>
      <div className="pips" title="Rhythm Energy">
        {Array.from({ length: h.energyMax }, (_, i) => (
          <span
            key={i}
            className={i < h.energy ? (h.ultReady ? "pip ready" : "pip on") : "pip"}
          />
        ))}
      </div>
      <div className={`beat-bar ${h.inZone ? "hot" : ""}`}>
        <span className="beat-zone left" style={{ width: left }} />
        <span className="beat-zone right" style={{ width: left }} />
        <span className="beat-dot" style={{ left: `${h.beatPhase01 * 100}%` }} />
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
        <div className="boss-bar" title="Boss HP">
          <span style={{ width: `${(h.nearestBossHp / h.nearestBossMax) * 100}%` }} />
        </div>
      )}
      <span className={h.run === "playing" ? "status status-play" : "status"}>
        {h.run === "playing"
          ? props.touch
            ? `${h.wave}/${h.waveTotal}波`
            : `第 ${h.wave}/${h.waveTotal} 波 · 丧尸 ${h.enemyCount - h.bossCount - h.megabossCount} · 尸王 ${h.bossCount}${h.megabossCount > 0 ? ` · 中王 ${h.megabossCount}` : ""}${h.pendingCount > 0 ? ` · 援军 ${h.pendingCount}` : ""}`
          : h.run === "tutorial"
            ? "训练场 · 武士旋斩 / 枪客半扫 / 弓使飞矢"
            : h.run === "win"
              ? "胜利"
              : "失败"}
        {h.inZone ? " · 拍!" : ""}
      </span>
      {!props.touch && (h.run === "win" || h.run === "lose") && (
        <>
          <button className="primary" onClick={props.onRestart}>
            重开 R
          </button>
          <button onClick={props.onReselect}>重选 S</button>
        </>
      )}
      {props.touch && (h.run === "win" || h.run === "lose") && (
        <div className="touch-result-bar">
          {h.run === "lose" && h.reviveAvailable ? (
            <>
              <button className="primary" type="button" onClick={() => props.onWatchReviveAd?.()}>
                看广告复活
              </button>
              <button type="button" onClick={() => props.onForfeitRevive?.()}>
                放弃复活
              </button>
            </>
          ) : h.run === "win" ? (
            <>
              <button className="primary" type="button" onClick={() => props.onShare?.()}>
                分享
              </button>
              <button type="button" onClick={props.onRestart}>
                重开
              </button>
              <button type="button" onClick={props.onReselect}>
                回选曲
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={props.onRestart}>
                重开
              </button>
              <button type="button" onClick={props.onReselect}>
                回选曲
              </button>
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
  onPause?: () => void;
  onEnd?: () => void;
  onRestart?: () => void;
  onReselect?: () => void;
  onShare?: () => void;
  onWatchReviveAd?: () => void;
  onForfeitRevive?: () => void;
  shareHint?: string | null;
}) {
  const h = props.hud;
  if (h.paused && h.run !== "win" && h.run !== "lose") {
    return (
      <div className="overlay pause">
        <h2>暂停</h2>
        <div className="status">{props.touch ? "点「继续」恢复" : "按 P 或 Esc 继续"}</div>
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
              <div>卡拍 = 节拍条亮区出手，伤害更高。</div>
            </>
          ) : (
            <>
              <div>WASD 移动 · Enter 普攻 · Shift 滑步 · 空格大招 · P 暂停 · Q 结束</div>
              <div>节拍条亮区出手 = 卡拍强化（伤害 ×2 等），无视 0.26s 动作 CD；每拍只能强化一次，普攻与滑步共享该拍。</div>
              <div>武士长刀绕身一圈，枪客 45° 挥枪（卡拍 90°），弓使射锁敌箭。打中丧尸身体才算命中。空挥不充能。卡拍命中 10 次放角色大招。</div>
              <div>丧尸会冲刺，尸王会读条砸地并放弹幕：红圈前摇时滑步可躲，弹幕用位移躲开。木箱/灯柱/墓碑可打碎清路。</div>
              <div>按 T 进入实战。</div>
            </>
          )}
        </div>
      </div>
    );
  }
  if (h.run === "win") {
    const r = h.runResult;
    return (
      <div className="overlay win result">
        <h2>丧尸清场</h2>
        {r && (
          <div className="result-card">
            <div className="result-stars" aria-label={`${r.stars} 星`}>
              {formatStars(r.stars)}
            </div>
            <div className="result-score">{r.score} 分</div>
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
                ? "点下方或本页按钮分享 / 重开 / 回选曲"
                : r.stars === 3
                  ? "三星：满血感 + 连击 + 卡拍全兑现"
                  : r.stars === 2
                    ? "二星：通关但还有优化空间，可再刷三星"
                    : "一星：先保证通关，再练连击与卡拍"}
            </p>
          </div>
        )}
        <div className="overlay-actions result-actions">
          <button className="primary" type="button" onClick={() => props.onShare?.()}>
            复制成绩分享
          </button>
          <button type="button" onClick={props.onRestart}>
            再来一局
          </button>
          <button type="button" onClick={props.onReselect}>
            回选曲
          </button>
        </div>
        {props.shareHint && <div className="share-toast">{props.shareHint}</div>}
        {!props.touch && !props.shareHint && (
          <div className="status">[R] 重开 · [S] 重选曲/角色</div>
        )}
      </div>
    );
  }
  if (h.run === "lose") {
    const canRevive = h.reviveAvailable;
    return (
      <>
        <div className="overlay lose result revive-offer">
          <h2>HP 归零</h2>
          <div className="revive-card">
            {canRevive ? (
              <>
                <p className="revive-lede">本局还有一次看广告复活机会</p>
                <p className="revive-sub">复活后 1 HP 原地继续，歌曲与波次不变</p>
              </>
            ) : (
              <>
                <p className="revive-lede">本局复活已用尽</p>
                <p className="revive-sub">可重开或回选曲再来</p>
              </>
            )}
          </div>
          <div className="overlay-actions result-actions">
            {canRevive && (
              <>
                <button className="primary" type="button" onClick={() => props.onWatchReviveAd?.()}>
                  看广告复活
                </button>
                <button type="button" className="ghost" onClick={() => props.onForfeitRevive?.()}>
                  放弃复活
                </button>
              </>
            )}
            <button
              type="button"
              className={canRevive ? "ghost" : "primary"}
              onClick={() => {
                if (canRevive) props.onForfeitRevive?.();
                props.onRestart?.();
              }}
            >
              再来一局
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
            <div className="status">{canRevive ? "看广告复活 · [R] 重开 · [S] 回选曲" : "[R] 重开 · [S] 回选曲"}</div>
          )}
        </div>
      </>
    );
  }
  return null;
}
