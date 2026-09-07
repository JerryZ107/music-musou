import { HERO_CODEX, TRACK_CODEX, CODEX_INTRO } from "../game/codex";
import type { HeroId, TrackId } from "../game/types";
import { HeroPortrait, MenuHeader, MenuPanel, MenuScreen, SectionTitle } from "./MenuChrome";

export function CodexScreen(props: { onBack: () => void }) {
  return (
    <MenuScreen className="codex-screen">
      <MenuHeader
        title="乱世图鉴"
        subtitle="武将志 · 名曲卷"
        actions={
          <button className="ghost nav-btn" onClick={props.onBack}>
            返回
          </button>
        }
      />
      <MenuPanel>
        <p className="lede">{CODEX_INTRO}</p>
      </MenuPanel>

      <SectionTitle icon="⚔">武将志</SectionTitle>
      <div className="codex-list">
        {(Object.values(HERO_CODEX) as (typeof HERO_CODEX)[HeroId][]).map((hero) => (
          <article key={hero.id} className={`codex-card codex-card--hero-${hero.id}`}>
            <div className="card__row">
              <HeroPortrait heroId={hero.id} size="md" />
              <div className="card__body">
                <div className="kicker">{hero.role}</div>
                <h3>{hero.title}</h3>
                <p className="codex-stats">
                  攻速 {hero.stats.attackSpeed} · 冲刺 {hero.stats.dashRange} · 范围 {hero.stats.attackRange}
                </p>
              </div>
            </div>
            <p>
              <strong>被动</strong> {hero.passive}
            </p>
            <p>
              <strong>大招</strong> {hero.ultimate}
            </p>
          </article>
        ))}
      </div>

      <SectionTitle icon="♪">名曲卷</SectionTitle>
      <div className="codex-list">
        {(Object.values(TRACK_CODEX) as (typeof TRACK_CODEX)[TrackId][]).map((track) => (
          <article key={track.id} className={`codex-card codex-card--track-${track.id}`}>
            <div className="kicker">{track.stage}</div>
            <h3>{track.title}</h3>
            <p className="codex-artist">{track.artist}</p>
            <p>{track.lore}</p>
            <p className="codex-unlock">{track.unlock}</p>
          </article>
        ))}
      </div>
    </MenuScreen>
  );
}
