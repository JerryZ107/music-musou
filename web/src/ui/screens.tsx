import { useState } from "react";
import { TRACKS, HEROES } from "../game/tracks";
import type { AccountData, SlotData } from "../game/save";
import type { TrackId, WeaponId } from "../game/types";

export function AccountGate(props: {
  accounts: AccountData[];
  lastName: string | null;
  onEnter: (name: string) => void;
}) {
  const [name, setName] = useState(props.lastName ?? "");
  return (
    <div className="screen">
      <h1>曲无双</h1>
      <p className="lede">
        一首 Track 锁一局。三个角色共用一条命，1/2/3 切换不停歌。武士旋斩、枪客半扫、弓使飞矢打中身体才算
        Combat Hit。
      </p>
      <div className="row">
        <input
          type="text"
          maxLength={16}
          placeholder="账号名（仅本机）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) props.onEnter(name.trim());
          }}
        />
        <button className="primary" disabled={!name.trim()} onClick={() => props.onEnter(name.trim())}>
          进入
        </button>
      </div>
      {props.accounts.length > 0 && (
        <>
          <p className="tag">已有账号</p>
          <div className="row">
            {props.accounts.map((a) => (
              <button key={a.name} onClick={() => props.onEnter(a.name)}>
                {a.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SlotPicker(props: {
  account: AccountData;
  onBack: () => void;
  onPick: (index: number, existing: SlotData | null) => void;
  onClear: (index: number) => void;
}) {
  return (
    <div className="screen">
      <div className="row">
        <h1>存档槽 · {props.account.name}</h1>
        <button className="ghost" onClick={props.onBack}>
          换账号
        </button>
      </div>
      <p className="lede">每个账号 3 个 Save Slot。槽里记下 Track / 角色偏好、延迟与战绩，不中途存一局战斗。</p>
      <div className="cards">
        {props.account.slots.map((slot, i) => (
          <button key={i} className="card" onClick={() => props.onPick(i, slot)}>
            <div className="kicker">SLOT {i + 1}</div>
            {slot ? (
              <>
                <h3>{TRACKS[slot.trackId].name}</h3>
                <p>
                  角色 {slot.weaponIds.map((id) => HEROES[id].short).join("/")} · {slot.stats.wins}胜 {slot.stats.losses}负 / {slot.stats.runs}局
                </p>
              </>
            ) : (
              <>
                <h3>空槽</h3>
                <p>新开 Loadout，从选曲开始。</p>
              </>
            )}
          </button>
        ))}
      </div>
      <div className="row">
        {props.account.slots.map((slot, i) =>
          slot ? (
            <button key={i} className="ghost" onClick={() => props.onClear(i)}>
              清空槽 {i + 1}
            </button>
          ) : null,
        )}
      </div>
    </div>
  );
}

export function SelectScreen(props: {
  trackId: TrackId;
  weaponIds: WeaponId[];
  onTrack: (id: TrackId) => void;
  onToggleWeapon: (id: WeaponId) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const canStart = props.weaponIds.length >= 1;
  return (
    <div className="screen">
      <div className="row">
        <h1>选 Track 与角色</h1>
        <button className="ghost" onClick={props.onBack}>
          返回槽
        </button>
      </div>
      <p className="lede">
        一局只绑一首歌。角色可多选，进关后用 1/2/3 切换，歌不会停，血量共用一条。名曲为旋律编配；亦可放置{" "}
        <code>web/public/audio/track-N.ogg</code> 替换为更高音质录音。
      </p>
      <p className="tag">TRACK</p>
      <div className="cards select-scroll">
        {(Object.values(TRACKS) as (typeof TRACKS)[TrackId][]).map((t) => (
          <button
            key={t.trackId}
            className={t.trackId === props.trackId ? "card selected" : "card"}
            onClick={() => props.onTrack(t.trackId)}
          >
            <div className="kicker">{t.bpmLabel} BPM · {t.composer}</div>
            <h3>{t.name}</h3>
            <p>{t.beatTimesMs.length} 拍 · loop {(t.loopMs / 1000).toFixed(1)}s</p>
          </button>
        ))}
      </div>
      <p className="tag">角色</p>
      <div className="cards select-scroll">
        {(Object.values(HEROES) as (typeof HEROES)[WeaponId][]).map((hero) => (
          <button
            key={hero.id}
            className={props.weaponIds.includes(hero.id) ? "card selected" : "card"}
            onClick={() => props.onToggleWeapon(hero.id)}
          >
            <div className="kicker">HERO {hero.id} · {hero.short}</div>
            <h3>{hero.name}</h3>
            <p>{hero.desc}</p>
            <p>{hero.ult}</p>
          </button>
        ))}
      </div>
      <div className="screen-footer">
        <button className="primary" disabled={!canStart} onClick={props.onStart}>
          {canStart ? "开始训练场" : "至少选 1 个角色"}
        </button>
      </div>
    </div>
  );
}
