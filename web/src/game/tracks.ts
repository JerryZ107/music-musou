import { regularBeatGrid } from "./beatClock";
import { TRACK_BPM_SCALE } from "./constants";
import type { HeroId, MusicProfile, TrackId } from "./types";

/** [midi, startBeat, durationBeats] */
export type MelodyNote = readonly [midi: number, startBeat: number, durBeats: number];

function melodyProfile(
  trackId: TrackId,
  name: string,
  composer: string,
  bpm: number,
  notes: readonly MelodyNote[],
  loopBeats: number,
  opts?: {
    bass?: readonly MelodyNote[];
    style?: MusicProfile["style"];
    audioUrl?: string;
    subdiv?: number;
    synth?: MusicProfile["synth"];
  },
): MusicProfile {
  bpm = Math.max(60, Math.round(bpm * TRACK_BPM_SCALE));
  const beatMs = 60_000 / bpm;
  const subdiv = opts?.subdiv ?? 1;
  const starts: number[] = [];
  const pushOnsets = (list: readonly MelodyNote[]) => {
    for (const [, s, d] of list) {
      starts.push(s * beatMs);
      if (Math.abs(d - 1.5) < 0.01) starts.push((s + 1) * beatMs);
      if (Math.abs(d - 0.5) < 0.01) {
        /* half-beat note = one onset */
      } else if (d > 1) {
        for (let i = 1; i < Math.floor(d); i++) starts.push((s + i) * beatMs);
      }
    }
  };
  pushOnsets(notes);
  if (opts?.bass) pushOnsets(opts.bass);
  if (subdiv > 1) {
    for (let i = 0; i < loopBeats * subdiv; i++) starts.push((i * beatMs) / subdiv);
  }
  // 卡拍格：旋律/onset 为主，必要时补四分拍网格
  if (starts.length < loopBeats / 2) {
    for (let i = 0; i < loopBeats; i++) starts.push(i * beatMs);
  }
  const beatTimesMs = [...new Set(starts.map((x) => Math.round(x * 100) / 100))].sort(
    (a, b) => a - b,
  );
  return {
    trackId,
    name,
    composer,
    bpmLabel: bpm,
    beatTimesMs,
    loopMs: loopBeats * beatMs,
    loopBeats,
    melodyNotes: notes,
    bassNotes: opts?.bass,
    style: opts?.style ?? "gentle",
    synth: opts?.synth ?? "melody",
    audioUrl:
      opts?.audioUrl === ""
        ? undefined
        : opts?.audioUrl ?? (opts?.synth === "edm" ? undefined : `/audio/track-${trackId}.ogg`),
  };
}

/** 第一首：原版电音合成，固定 120 BPM，不参与全曲放慢。 */
function edmProfile(trackId: TrackId, name: string, bpm: number): MusicProfile {
  const g = regularBeatGrid(bpm);
  return {
    trackId,
    name,
    composer: "原创合成",
    bpmLabel: bpm,
    beatTimesMs: g.times,
    loopMs: g.loopMs,
    loopBeats: 32,
    synth: "edm",
  };
}

/** 贝多芬 · 第九交响曲「欢乐颂」主题 */
const ODE_MELODY: readonly MelodyNote[] = [
  [64, 0, 1],
  [64, 1, 1],
  [65, 2, 1],
  [67, 3, 1],
  [67, 4, 1],
  [65, 5, 1],
  [64, 6, 1],
  [62, 7, 1],
  [60, 8, 1],
  [60, 9, 1],
  [62, 10, 1],
  [64, 11, 1],
  [64, 12, 1.5],
  [62, 13.5, 0.5],
  [62, 14, 2],
  [64, 16, 1],
  [64, 17, 1],
  [65, 18, 1],
  [67, 19, 1],
  [67, 20, 1],
  [65, 21, 1],
  [64, 22, 1],
  [62, 23, 1],
  [60, 24, 1],
  [60, 25, 1],
  [62, 26, 1],
  [64, 27, 1],
  [62, 28, 1],
  [60, 29, 1],
  [60, 30, 2],
];

/** 贝多芬 · 致爱丽丝（开场主题） */
const FUR_ELISE: readonly MelodyNote[] = [
  [76, 0, 0.5],
  [75, 0.5, 0.5],
  [76, 1, 0.5],
  [75, 1.5, 0.5],
  [76, 2, 0.5],
  [71, 2.5, 1],
  [74, 3.5, 0.5],
  [72, 4, 0.5],
  [69, 4.5, 1.5],
  [69, 6, 0.5],
  [60, 6.5, 0.5],
  [64, 7, 0.5],
  [69, 7.5, 0.5],
  [71, 8, 1],
  [64, 9, 0.5],
  [68, 9.5, 0.5],
  [71, 10, 0.5],
  [72, 10.5, 1],
  [76, 12, 0.5],
  [75, 12.5, 0.5],
  [76, 13, 0.5],
  [75, 13.5, 0.5],
  [76, 14, 0.5],
  [71, 14.5, 1],
  [74, 15.5, 0.5],
  [72, 16, 0.5],
  [69, 16.5, 1.5],
];

/** 莫扎特 · 土耳其进行曲（主题片段） */
const TURKISH_MARCH: readonly MelodyNote[] = [
  [76, 0, 0.5],
  [76, 0.5, 0.5],
  [76, 1, 0.5],
  [77, 1.5, 0.5],
  [79, 2, 0.5],
  [79, 2.5, 0.5],
  [79, 3, 0.5],
  [81, 3.5, 0.5],
  [83, 4, 1],
  [83, 5, 0.5],
  [81, 5.5, 0.5],
  [79, 6, 0.5],
  [77, 6.5, 0.5],
  [76, 7, 1],
  [74, 8, 0.5],
  [76, 8.5, 0.5],
  [77, 9, 0.5],
  [79, 9.5, 0.5],
  [81, 10, 0.5],
  [83, 10.5, 0.5],
  [84, 11, 1],
  [83, 12, 0.5],
  [81, 12.5, 0.5],
  [79, 13, 0.5],
  [77, 13.5, 0.5],
  [76, 14, 1],
];

/** 帕赫贝尔 · D 大调卡农（低音 + 琶音） */
const CANON_BASS: readonly MelodyNote[] = [
  [50, 0, 2],
  [57, 2, 2],
  [59, 4, 2],
  [54, 6, 2],
  [55, 8, 2],
  [50, 10, 2],
  [55, 12, 2],
  [57, 14, 2],
];

const CANON_MELODY: readonly MelodyNote[] = [
  [74, 0, 0.5],
  [69, 0.5, 0.5],
  [66, 1, 0.5],
  [62, 1.5, 0.5],
  [74, 2, 0.5],
  [69, 2.5, 0.5],
  [66, 3, 0.5],
  [62, 3.5, 0.5],
  [76, 4, 0.5],
  [71, 4.5, 0.5],
  [67, 5, 0.5],
  [64, 5.5, 0.5],
  [76, 6, 0.5],
  [71, 6.5, 0.5],
  [67, 7, 0.5],
  [64, 7.5, 0.5],
  [77, 8, 0.5],
  [74, 8.5, 0.5],
  [69, 9, 0.5],
  [66, 9.5, 0.5],
  [77, 10, 0.5],
  [74, 10.5, 0.5],
  [69, 11, 0.5],
  [66, 11.5, 0.5],
  [74, 12, 0.5],
  [69, 12.5, 0.5],
  [66, 13, 0.5],
  [62, 13.5, 0.5],
  [74, 14, 0.5],
  [69, 14.5, 0.5],
  [66, 15, 0.5],
  [62, 15.5, 0.5],
];

/** 中国民歌 · 茉莉花 */
const JASMINE: readonly MelodyNote[] = [
  [71, 0, 1],
  [62, 1, 1],
  [64, 2, 1],
  [66, 3, 1],
  [69, 4, 1.5],
  [64, 5.5, 0.5],
  [66, 6, 1],
  [69, 7, 1],
  [64, 8, 1],
  [66, 9, 1],
  [69, 10, 1],
  [74, 11, 1],
  [71, 12, 1.5],
  [69, 13.5, 0.5],
  [67, 14, 1],
  [66, 15, 1],
  [62, 16, 1],
  [64, 17, 1],
  [66, 18, 1],
  [69, 19, 1],
  [74, 20, 1.5],
  [71, 21.5, 0.5],
  [67, 22, 1],
  [66, 23, 1],
  [67, 24, 1],
  [69, 25, 1],
  [71, 26, 1],
  [74, 27, 1],
  [66, 28, 2],
  [62, 30, 2],
];

/** Tonči Huljić · 克罗地亚狂想曲（C 小调主题 + 开场琶音，马克西姆版简化转写） */
function pushSixteenths(out: MelodyNote[], startBeat: number, pitches: readonly number[]): void {
  for (let i = 0; i < pitches.length; i++) {
    out.push([pitches[i]!, startBeat + i * 0.25, 0.22]);
  }
}

function pushEighths(out: MelodyNote[], startBeat: number, pitches: readonly number[]): void {
  for (let i = 0; i < pitches.length; i++) {
    out.push([pitches[i]!, startBeat + i * 0.5, 0.44]);
  }
}

function buildCroatianRhapsody(): readonly MelodyNote[] {
  const n: MelodyNote[] = [];
  // 开场：Cm 分解和弦上行 + 下行（原曲标志性快琶音）
  pushSixteenths(n, 0, [75, 79, 82, 87, 91, 94, 99, 103, 99, 94, 91, 87, 82, 79, 75, 70]);
  pushSixteenths(n, 4, [70, 75, 79, 82, 87, 91, 94, 99, 103, 99, 94, 91, 87, 82, 79, 75]);
  // 主题 A（原曲主旋律核心）
  pushEighths(n, 8, [
    82, 84, 82, 80, 79, 77, 75, 74, 75, 77, 79, 82, 84, 87, 89, 87,
  ]);
  pushEighths(n, 16, [
    84, 82, 80, 79, 77, 75, 77, 79, 82, 84, 87, 89, 91, 89, 87, 84,
  ]);
  // 高潮跑句
  pushSixteenths(n, 24, [84, 87, 89, 91, 94, 96, 99, 96, 94, 91, 89, 87, 84, 82, 79, 75]);
  return n;
}

function buildCroatianBass(): readonly MelodyNote[] {
  const n: MelodyNote[] = [];
  const roots = [36, 48, 43, 55, 39, 51, 46, 58] as const; // Cm 低音 + 八度
  for (let b = 0; b < 32; b += 2) {
    const i = (b / 2) % 4;
    n.push([roots[i * 2]!, b, 0.35]);
    n.push([roots[i * 2 + 1]!, b, 2]);
  }
  return n;
}

export const TRACKS: Record<TrackId, MusicProfile> = {
  1: edmProfile(1, "电音战歌", 120),
  2: melodyProfile(2, "欢乐颂", "贝多芬", 84, ODE_MELODY, 32, { style: "gentle" }),
  3: melodyProfile(3, "致爱丽丝", "贝多芬", 100, FUR_ELISE, 18, { style: "gentle" }),
  4: melodyProfile(4, "土耳其进行曲", "莫扎特", 132, TURKISH_MARCH, 16, {
    style: "march",
  }),
  5: melodyProfile(5, "D 大调卡农", "帕赫贝尔", 90, CANON_MELODY, 16, {
    bass: CANON_BASS,
    style: "dance",
  }),
  6: melodyProfile(6, "茉莉花", "中国民歌", 72, JASMINE, 32, { style: "gentle" }),
  7: melodyProfile(7, "克罗地亚狂想曲", "Tonči Huljić", 126, buildCroatianRhapsody(), 32, {
    bass: buildCroatianBass(),
    style: "rhapsody",
    subdiv: 4,
    audioUrl: "",
  }),
};

/** 无旋律数据时的兜底（不应触发） */
export const FALLBACK_GRID = regularBeatGrid(120);

export const HEROES: Record<
  HeroId,
  { id: HeroId; name: string; short: string; desc: string; ult: string }
> = {
  1: {
    id: 1,
    name: "铁铠武士",
    short: "武士",
    desc: "铠甲男武者 · 长刀旋斩 · 全圆 r≈1.7",
    ult: "被动·铁壁：开局 1 护盾，每 2 秒 +1（上限 1）；大招·疾风：下次滑步 +0.5 格，卡拍滑步斩 3 伤",
  },
  2: {
    id: 2,
    name: "青衫枪客",
    short: "枪客",
    desc: "长衫长发枪兵 · 45° 挥枪 · 卡拍 90° · r≈3.6",
    ult: "角色大招·穿云：7 次穿透戳击，伤害 +1",
  },
  3: {
    id: 3,
    name: "灵耳弓使",
    short: "弓使",
    desc: "精灵女弓手 · 锁敌飞矢 · 弹程 ≈10.7",
    ult: "角色大招·分影：召唤分身协同射箭",
  },
};

export const WEAPONS = HEROES;

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** @deprecated 用 TRACKS[2].melodyNotes */
export function odeMelodyNotes(): readonly MelodyNote[] {
  return ODE_MELODY;
}
