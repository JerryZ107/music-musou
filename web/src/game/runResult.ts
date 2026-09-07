import { PLAY_DEMO_URL } from "./constants";
import type { RunResult, RunStats, Sim, TrackId } from "./types";
import { TRACKS } from "./tracks";

export function emptyRunStats(): RunStats {
  return {
    combo: 0,
    maxCombo: 0,
    comboUntilMs: 0,
    totalDamage: 0,
    beatHits: 0,
    damageTaken: 0,
  };
}

export function computeRunResult(sim: Sim): RunResult {
  const outcome = sim.run === "win" ? "win" : "lose";
  const { maxCombo, totalDamage, beatHits, damageTaken } = sim.stats;
  const hpLeft = sim.player.hp;
  let stars: RunResult["stars"] = 0;
  if (outcome === "win") {
    stars = 1;
    if (hpLeft >= 3 && maxCombo >= 5) stars = 2;
    if (hpLeft >= 4 && maxCombo >= 10 && beatHits >= 8) stars = 3;
  }
  const score =
    outcome === "win"
      ? totalDamage + maxCombo * 40 + beatHits * 25 + hpLeft * 150
      : Math.floor(totalDamage + maxCombo * 15);
  return {
    outcome,
    stars,
    score,
    maxCombo,
    totalDamage,
    beatHits,
    hpLeft,
    damageTaken,
    trackId: sim.trackId,
    levelId: sim.levelId,
    weaponId: sim.weaponId,
  };
}

export function buildShareText(result: RunResult, trackName?: string): string {
  const name = trackName ?? TRACKS[result.trackId].name;
  const stars = "★".repeat(result.stars) + "☆".repeat(3 - result.stars);
  const headline = result.outcome === "win" ? "丧尸清场" : "惜败";
  return `曲无双 · ${name} · ${headline}\n${stars} ${result.score} 分 · 最高连击 ${result.maxCombo} · 卡拍 ${result.beatHits} 次 · 输出 ${result.totalDamage}\n${PLAY_DEMO_URL}`;
}

export async function copyShareText(result: RunResult): Promise<boolean> {
  const text = buildShareText(result);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function formatStars(stars: RunResult["stars"]): string {
  return "★".repeat(stars) + "☆".repeat(3 - stars);
}

export function trackLabel(id: TrackId): string {
  return TRACKS[id].name;
}
