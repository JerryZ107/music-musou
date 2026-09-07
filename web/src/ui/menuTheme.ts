import type { HeroId, TrackId } from "../game/types";

export const HERO_VISUAL: Record<
  HeroId,
  { glyph: string; accent: string; glow: string; grad: string }
> = {
  1: {
    glyph: "侍",
    accent: "#8ec8ff",
    glow: "rgba(110, 180, 255, 0.45)",
    grad: "linear-gradient(145deg, #1a2840 0%, #2a4060 50%, #142030 100%)",
  },
  2: {
    glyph: "枪",
    accent: "#7ee8a8",
    glow: "rgba(80, 220, 140, 0.4)",
    grad: "linear-gradient(145deg, #142820 0%, #1e4030 50%, #0e1810 100%)",
  },
  3: {
    glyph: "弓",
    accent: "#d4a8ff",
    glow: "rgba(180, 120, 255, 0.4)",
    grad: "linear-gradient(145deg, #281838 0%, #3a2850 50%, #181020 100%)",
  },
};

export const TRACK_VISUAL: Record<TrackId, { accent: string; grad: string; icon: string }> = {
  1: {
    accent: "#6ec8ff",
    grad: "linear-gradient(135deg, #0e1a28 0%, #183850 55%, #0a1420 100%)",
    icon: "♪",
  },
  2: {
    accent: "#ff8866",
    grad: "linear-gradient(135deg, #281018 0%, #502818 55%, #180a08 100%)",
    icon: "♫",
  },
  3: {
    accent: "#a8b8ff",
    grad: "linear-gradient(135deg, #181828 0%, #303858 55%, #101018 100%)",
    icon: "♬",
  },
};
