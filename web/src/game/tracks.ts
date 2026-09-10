import { regularBeatGrid, withRegularPulseBeats } from "./beatClock";
import { assignBeatSkillTiers } from "./beatSkill";
import track1Beats from "./track-1-beats.json";
import track2Beats from "./track-2-beats.json";
import track3Beats from "./track-3-beats.json";
import type { HeroId, MusicProfile, TrackId } from "./types";

/** 清晰升降调小包顶点作主拍（不问音量/鼓）；规律脉冲只补空档。 */
function analyzedAudioProfile(
  trackId: TrackId,
  name: string,
  composer: string,
  data: {
    bpm: number;
    durationMs: number;
    beatTimesMs: number[];
    beatOffsetMs?: number;
    mode?: string;
  },
  audioUrl: string,
): MusicProfile {
  const { beatTimesMs, pulsePeriodMs } = withRegularPulseBeats(
    data.beatTimesMs,
    data.durationMs,
    data.bpm,
  );
  return {
    trackId,
    name,
    composer,
    bpmLabel: data.bpm,
    beatTimesMs,
    beatSkillTiers: assignBeatSkillTiers(beatTimesMs.length, trackId),
    loopMs: data.durationMs,
    loopBeats: beatTimesMs.length,
    pulsePeriodMs,
    style: "dance",
    synth: "melody",
    audioUrl,
  };
}

export const TRACKS: Record<TrackId, MusicProfile> = {
  1: analyzedAudioProfile(1, "Recall", "gabriawll · NCS", track1Beats, "audio/track-1.mp3"),
  2: analyzedAudioProfile(
    2,
    "whatdoyousee",
    "GlitchCat · prodBigMike · NCS",
    track2Beats,
    "audio/track-2.mp3",
  ),
  3: analyzedAudioProfile(
    3,
    "I Still Hear Your Voice",
    "johnny joined · Lynxie · NCS",
    track3Beats,
    "audio/track-3.mp3",
  ),
};

/** 无旋律数据时的兜底（不应触发） */
export const FALLBACK_GRID = regularBeatGrid(120);

export const HEROES: Record<
  HeroId,
  { id: HeroId; name: string; short: string; desc: string; ult: string; passive: string }
> = {
  1: {
    id: 1,
    name: "铁铠武士",
    short: "武士",
    desc: "攻速 8 · 冲刺 15 · 攻击范围 15 · 节拍三技能",
    passive: "普攻小剑气；飞剑护盾挡伤；常态冲刺距离 +5",
    ult: "怒气大招：寻敌矮龙卷（圆心撞停 3s，冲击 5 / 每圈 3）",
  },
  2: {
    id: 2,
    name: "青衫枪客",
    short: "枪客",
    desc: "攻速 14 · 冲刺 10 · 攻击范围 15",
    passive: "小范围横扫；卡拍扇面更宽",
    ult: "游龙 7 次：横扫改突刺，+1 伤 +1 攻速，不计充能",
  },
  3: {
    id: 3,
    name: "灵耳弓使",
    short: "弓使",
    desc: "攻速 14 · 冲刺 10 · 弹程 40 · 节拍三技能",
    passive: "绿爆裂·黄寒冰（×2 / 三发散）/ 粉分身",
    ult: "雷电箭×4：5 伤+眩晕，再外扩慢速电波（同弹程 / 2 伤）",
  },
};

export const WEAPONS = HEROES;
