/** 武士节拍技能分档：轻绿 / 中黄 / 重粉。 */
export type BeatSkillTier = "light" | "mid" | "heavy";

/** 确定性分配：约一半轻、约三成中、其余重，同曲同表可复现。 */
export function assignBeatSkillTiers(count: number, seed = 1): BeatSkillTier[] {
  const out: BeatSkillTier[] = [];
  for (let i = 0; i < count; i++) {
    const roll = ((i * 2654435761 + seed * 97) >>> 0) % 100;
    out.push(roll < 50 ? "light" : roll < 82 ? "mid" : "heavy");
  }
  return out;
}

export function beatIndexFromSlotKey(slotKey: string): number {
  const idx = Number(slotKey.split(":")[1] ?? 0);
  return Number.isFinite(idx) ? idx : 0;
}

export function beatSkillTierAt(
  tiers: readonly BeatSkillTier[],
  slotKey: string,
): BeatSkillTier | null {
  if (!tiers.length) return null;
  const idx = beatIndexFromSlotKey(slotKey);
  return tiers[idx] ?? null;
}
