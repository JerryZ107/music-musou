import type { LevelId } from "./types";

export const LEVELS: Record<
  LevelId,
  { id: LevelId; name: string; short: string; desc: string; waves: string }
> = {
  1: {
    id: 1,
    name: "四角院落",
    short: "第一关",
    desc: "四座院落同时开战，无中央尸王。",
    waves: "1 波",
  },
  2: {
    id: 2,
    name: "中央决战",
    short: "第二关",
    desc: "四院同出，清完后再迎中央尸王与王中王。",
    waves: "2 波 · 尸王",
  },
};

export const LEVEL_VISUAL: Record<LevelId, { accent: string; grad: string }> = {
  1: {
    accent: "#7ec8a0",
    grad: "linear-gradient(135deg, #142820 0%, #1e4030 55%, #0e1810 100%)",
  },
  2: {
    accent: "#ff8866",
    grad: "linear-gradient(135deg, #281018 0%, #502818 55%, #180a08 100%)",
  },
};
