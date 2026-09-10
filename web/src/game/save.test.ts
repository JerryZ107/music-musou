import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyRunRewards,
  clearSlot,
  getSlotMeta,
  newSlotDraft,
  readSlot,
  sanitizeSlotDraft,
  setFirstClearGuideStep,
  upsertAccount,
  writeSlot,
  type AccountMeta,
} from "./save";
import type { RunResult } from "./types";

const winResult = (levelId: 1 | 2): RunResult => ({
  outcome: "win",
  stars: 3,
  score: 1000,
  maxCombo: 10,
  totalDamage: 500,
  beatHits: 8,
  hpLeft: 5,
  damageTaken: 0,
  trackId: levelId === 1 ? 1 : 2,
  levelId,
  weaponId: 2,
});

const baseMeta = (): AccountMeta => ({
  gold: 10,
  unlockedLevels: [1],
  unlockedTracks: [1],
  unlockedHeroes: [2],
  level1Cleared: false,
  level2Cleared: false,
  shopUnlocked: false,
  shopPromptPending: false,
  firstClearGuideStep: null,
});

describe("applyRunRewards", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  it("第一关首通自动切到第二关与第二曲", () => {
    upsertAccount("test");
    writeSlot("test", 0, newSlotDraft({ levelId: 1, trackId: 1 }));
    applyRunRewards("test", 0, winResult(1));
    const slot = readSlot("test", 0)!;
    expect(slot.levelId).toBe(2);
    expect(slot.trackId).toBe(2);
    expect(getSlotMeta("test", 0).shopPromptPending).toBe(true);
  });

  it("第二关首通时重置引导到 reward_track（第一关引导已完成）", () => {
    upsertAccount("test");
    writeSlot("test", 0, newSlotDraft());
    applyRunRewards("test", 0, winResult(1));
    setFirstClearGuideStep("test", 0, "done");

    const enriched = applyRunRewards("test", 0, winResult(2));
    const meta = getSlotMeta("test", 0);

    expect(enriched.trackUnlocked).toBe(3);
    expect(enriched.goldEarned).toBe(20);
    expect(meta.firstClearGuideStep).toBe("reward_track");
    expect(meta.level2Cleared).toBe(true);
  });

  it("空槽从零开始，不继承其他槽进度", () => {
    upsertAccount("test");
    writeSlot("test", 0, newSlotDraft());
    applyRunRewards("test", 0, winResult(1));
    setFirstClearGuideStep("test", 0, "done");

    expect(getSlotMeta("test", 1).gold).toBe(0);
    expect(getSlotMeta("test", 1).level1Cleared).toBe(false);
    expect(getSlotMeta("test", 1).shopUnlocked).toBe(false);
    expect(getSlotMeta("test", 1).unlockedTracks).toEqual([1]);

    writeSlot("test", 1, newSlotDraft());
    expect(getSlotMeta("test", 1).gold).toBe(0);
    expect(getSlotMeta("test", 0).gold).toBe(10);
  });

  it("清空槽后进度归零", () => {
    upsertAccount("test");
    writeSlot("test", 0, newSlotDraft());
    applyRunRewards("test", 0, winResult(1));
    expect(getSlotMeta("test", 0).shopUnlocked).toBe(true);
    clearSlot("test", 0);
    expect(readSlot("test", 0)).toBeNull();
    expect(getSlotMeta("test", 0).gold).toBe(0);
    expect(getSlotMeta("test", 0).shopUnlocked).toBe(false);
  });
});

describe("sanitizeSlotDraft", () => {
  it("已解锁内容时保留当前关卡与曲目选择", () => {
    const meta: AccountMeta = {
      ...baseMeta(),
      unlockedLevels: [1, 2],
      unlockedTracks: [1, 2, 3],
      level1Cleared: true,
      level2Cleared: true,
      shopUnlocked: true,
    };
    const draft = newSlotDraft({ levelId: 2, trackId: 3, weaponId: 2 });
    const next = sanitizeSlotDraft(draft, meta);
    expect(next.levelId).toBe(2);
    expect(next.trackId).toBe(3);
  });

  it("当前曲目未解锁时回退到已解锁的最新曲", () => {
    const meta: AccountMeta = {
      ...baseMeta(),
      unlockedLevels: [1, 2],
      unlockedTracks: [1, 2],
      level1Cleared: true,
      shopUnlocked: true,
    };
    const draft = newSlotDraft({ levelId: 2, trackId: 3, weaponId: 2 });
    const next = sanitizeSlotDraft(draft, meta);
    expect(next.levelId).toBe(2);
    expect(next.trackId).toBe(2);
  });

  it("招募新武将后保留为默认武将", () => {
    const meta: AccountMeta = {
      ...baseMeta(),
      unlockedHeroes: [2, 3],
    };
    const draft = newSlotDraft({ weaponId: 3 });
    const next = sanitizeSlotDraft(draft, meta);
    expect(next.weaponId).toBe(3);
  });
});
