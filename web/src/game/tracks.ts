import { regularBeatGrid } from "./beatClock";
import track1Beats from "./track-1-beats.json";
import track2Beats from "./track-2-beats.json";
import track3Beats from "./track-3-beats.json";
import type { HeroId, MusicProfile, TrackId } from "./types";

/** 从录音 beat_track 分析得到的拍点（与 MP3 对齐，不做 BPM 放慢）。 */
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
  return {
    trackId,
    name,
    composer,
    bpmLabel: data.bpm,
    beatTimesMs: data.beatTimesMs,
    loopMs: data.durationMs,
    loopBeats: data.beatTimesMs.length,
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
    desc: "攻速 14 · 冲刺 15 · 攻击范围 10",
    passive: "强化普攻命中获 1 层护盾；常态冲刺距离 +5",
    ult: "狂暴 12 秒：强化普攻 +2 伤，冲刺 15→20",
  },
  2: {
    id: 2,
    name: "青衫枪客",
    short: "枪客",
    desc: "攻速 20 · 冲刺 10 · 攻击范围 15",
    passive: "小范围横扫；卡拍扇面更宽",
    ult: "游龙 7 次：横扫改突刺，+1 伤 +2 攻速，不计充能",
  },
  3: {
    id: 3,
    name: "灵耳弓使",
    short: "弓使",
    desc: "攻速 20 · 冲刺 10 · 弹程 40",
    passive: "强化普攻为爆裂箭，小范围 2 点伤害",
    ult: "留下分身协同射箭（1 伤，无爆裂，1 HP）",
  },
};

export const WEAPONS = HEROES;
