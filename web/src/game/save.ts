import { DEFAULT_AUDIO_LATENCY_MS, SAVE_KEY, SLOT_COUNT } from "./constants";
import {
  computeWinRewards,
  DEFAULT_UNLOCKED_HEROES,
  DEFAULT_UNLOCKED_LEVELS,
  DEFAULT_UNLOCKED_TRACKS,
  HERO_PRICES,
} from "./meta";
import type { FirstClearGuideStep } from "./onboarding";
import { isShopGuideStep, normalizeGuideStep } from "./onboarding";
import type { RunResult, TrackId, LevelId, WeaponId, HeroId } from "./types";

/** 单存档槽的进度（金币 / 解锁 / 引导）。空槽从默认进度开始。 */
export interface AccountMeta {
  gold: number;
  unlockedLevels: LevelId[];
  unlockedTracks: TrackId[];
  unlockedHeroes: HeroId[];
  level1Cleared: boolean;
  level2Cleared: boolean;
  shopUnlocked: boolean;
  shopPromptPending: boolean;
  firstClearGuideStep: FirstClearGuideStep | null;
}

export interface SlotStats {
  runs: number;
  wins: number;
  losses: number;
  bestScore: number;
  bestStars: number;
}

export interface SlotData extends AccountMeta {
  updatedAt: number;
  levelId: LevelId;
  trackId: TrackId;
  weaponId: WeaponId;
  audioLatencyMs: number;
  muted: boolean;
  stats: SlotStats;
  /** @deprecated 旧存档多选角色 */
  weaponIds?: WeaponId[];
  lastWeaponId?: WeaponId;
}

export interface AccountData {
  name: string;
  createdAt: number;
  slots: (SlotData | null)[];
  /** @deprecated 旧版账户级进度；迁移到各非空槽后不再写入 */
  gold?: number;
  unlockedLevels?: LevelId[];
  unlockedTracks?: TrackId[];
  unlockedHeroes?: HeroId[];
  level1Cleared?: boolean;
  level2Cleared?: boolean;
  shopUnlocked?: boolean;
  shopPromptPending?: boolean;
  firstClearGuideStep?: FirstClearGuideStep | null;
}

interface SaveRoot {
  version: 1;
  lastAccount: string | null;
  accounts: Record<string, AccountData>;
}

function emptyRoot(): SaveRoot {
  return { version: 1, lastAccount: null, accounts: {} };
}

function loadRoot(): SaveRoot {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return emptyRoot();
    const parsed = JSON.parse(raw) as SaveRoot;
    if (parsed.version !== 1 || !parsed.accounts) return emptyRoot();
    return parsed;
  } catch {
    return emptyRoot();
  }
}

export class SaveStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveStorageError";
  }
}

function writeRoot(root: SaveRoot): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(root));
  } catch {
    throw new SaveStorageError("无法写入存档（隐私模式或存储已满）");
  }
}

function clampLevelId(value: unknown): LevelId {
  return value === 2 ? 2 : 1;
}

function clampTrackId(value: unknown): TrackId {
  if (value === 2) return 2;
  if (value === 3) return 3;
  return 1;
}

function clampWeaponId(value: unknown): WeaponId {
  if (value === 1 || value === 2 || value === 3) return value;
  return 2;
}

export function defaultMeta(): AccountMeta {
  return {
    gold: 0,
    unlockedLevels: [...DEFAULT_UNLOCKED_LEVELS],
    unlockedTracks: [...DEFAULT_UNLOCKED_TRACKS],
    unlockedHeroes: [...DEFAULT_UNLOCKED_HEROES],
    level1Cleared: false,
    level2Cleared: false,
    shopUnlocked: false,
    shopPromptPending: false,
    firstClearGuideStep: null,
  };
}

function legacyAccountMeta(acc: AccountData): AccountMeta | null {
  const hasLegacy =
    acc.gold != null ||
    acc.unlockedLevels != null ||
    acc.unlockedTracks != null ||
    acc.unlockedHeroes != null ||
    acc.level1Cleared != null ||
    acc.level2Cleared != null ||
    acc.shopUnlocked != null ||
    acc.shopPromptPending != null ||
    acc.firstClearGuideStep != null;
  if (!hasLegacy) return null;
  const base = defaultMeta();
  const unlockedLevels = acc.unlockedLevels?.length ? [...acc.unlockedLevels] : base.unlockedLevels;
  const unlockedTracks = acc.unlockedTracks?.length ? [...acc.unlockedTracks] : base.unlockedTracks;
  const unlockedHeroes = acc.unlockedHeroes?.length ? [...acc.unlockedHeroes] : base.unlockedHeroes;
  if (!unlockedLevels.includes(1)) unlockedLevels.unshift(1);
  if (!unlockedTracks.includes(1)) unlockedTracks.unshift(1);
  if (!unlockedHeroes.includes(2)) unlockedHeroes.push(2);
  unlockedHeroes.sort((a, b) => a - b);
  unlockedLevels.sort((a, b) => a - b);
  unlockedTracks.sort((a, b) => a - b);
  const level1Cleared = acc.level1Cleared ?? base.level1Cleared;
  const shopUnlocked = acc.shopUnlocked ?? level1Cleared;
  return {
    gold: acc.gold ?? base.gold,
    unlockedLevels,
    unlockedTracks,
    unlockedHeroes,
    level1Cleared,
    level2Cleared: acc.level2Cleared ?? base.level2Cleared,
    shopUnlocked,
    shopPromptPending: acc.shopPromptPending ?? base.shopPromptPending,
    firstClearGuideStep:
      normalizeGuideStep(
        acc.firstClearGuideStep ??
          (level1Cleared ? (acc.shopPromptPending ? "select_shop" : "done") : null),
      ),
  };
}

function normalizeMeta(raw: Partial<AccountMeta> | null | undefined, fallback?: AccountMeta | null): AccountMeta {
  const base = fallback ?? defaultMeta();
  const unlockedLevels = raw?.unlockedLevels?.length ? [...raw.unlockedLevels] : [...base.unlockedLevels];
  const unlockedTracks = raw?.unlockedTracks?.length ? [...raw.unlockedTracks] : [...base.unlockedTracks];
  const unlockedHeroes = raw?.unlockedHeroes?.length ? [...raw.unlockedHeroes] : [...base.unlockedHeroes];
  if (!unlockedLevels.includes(1)) unlockedLevels.unshift(1);
  if (!unlockedTracks.includes(1)) unlockedTracks.unshift(1);
  if (!unlockedHeroes.includes(2)) unlockedHeroes.push(2);
  unlockedHeroes.sort((a, b) => a - b);
  unlockedLevels.sort((a, b) => a - b);
  unlockedTracks.sort((a, b) => a - b);
  const level1Cleared = raw?.level1Cleared ?? base.level1Cleared;
  const shopUnlocked = raw?.shopUnlocked ?? (raw?.level1Cleared != null ? level1Cleared : base.shopUnlocked);
  return {
    gold: raw?.gold ?? base.gold,
    unlockedLevels,
    unlockedTracks,
    unlockedHeroes,
    level1Cleared,
    level2Cleared: raw?.level2Cleared ?? base.level2Cleared,
    shopUnlocked,
    shopPromptPending: raw?.shopPromptPending ?? base.shopPromptPending,
    firstClearGuideStep:
      raw?.firstClearGuideStep !== undefined
        ? normalizeGuideStep(raw.firstClearGuideStep)
        : base.firstClearGuideStep,
  };
}

function slotHasOwnMeta(raw: SlotData): boolean {
  return (
    raw.gold != null ||
    raw.unlockedLevels != null ||
    raw.unlockedTracks != null ||
    raw.unlockedHeroes != null ||
    raw.level1Cleared != null ||
    raw.level2Cleared != null ||
    raw.shopUnlocked != null ||
    raw.shopPromptPending != null ||
    raw.firstClearGuideStep !== undefined
  );
}

function normalizeSlot(raw: SlotData | null | undefined, legacy?: AccountMeta | null): SlotData | null {
  if (!raw) return null;
  const weaponRaw = raw.weaponId ?? raw.lastWeaponId ?? raw.weaponIds?.[0] ?? 2;
  const meta = normalizeMeta(slotHasOwnMeta(raw) ? raw : null, legacy);
  return {
    updatedAt: raw.updatedAt ?? Date.now(),
    levelId: clampLevelId(raw.levelId),
    trackId: clampTrackId(raw.trackId),
    weaponId: clampWeaponId(weaponRaw),
    audioLatencyMs: raw.audioLatencyMs ?? DEFAULT_AUDIO_LATENCY_MS,
    muted: raw.muted ?? false,
    stats: {
      runs: raw.stats?.runs ?? 0,
      wins: raw.stats?.wins ?? 0,
      losses: raw.stats?.losses ?? 0,
      bestScore: raw.stats?.bestScore ?? 0,
      bestStars: raw.stats?.bestStars ?? 0,
    },
    ...meta,
  };
}

function stripLegacyAccountMeta(acc: AccountData): AccountData {
  const {
    gold: _g,
    unlockedLevels: _ul,
    unlockedTracks: _ut,
    unlockedHeroes: _uh,
    level1Cleared: _l1,
    level2Cleared: _l2,
    shopUnlocked: _su,
    shopPromptPending: _sp,
    firstClearGuideStep: _fg,
    ...rest
  } = acc;
  return rest;
}

function normalizeAccount(acc: AccountData): AccountData {
  const legacy = legacyAccountMeta(acc);
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) =>
    normalizeSlot(acc.slots?.[i] ?? null, legacy),
  );
  return {
    ...stripLegacyAccountMeta(acc),
    slots,
  };
}

export function getSlotMeta(account: string, index: number): AccountMeta {
  const slot = readSlot(account, index);
  if (!slot) return defaultMeta();
  const archerOwned = slot.unlockedHeroes.includes(3);
  let shopPromptPending = slot.shopPromptPending;
  let firstClearGuideStep = normalizeGuideStep(slot.firstClearGuideStep);
  // 已买弓使：商店弓使引导永久失效（兼容旧存档卡在 shop_* 的情况）
  if (archerOwned) {
    shopPromptPending = false;
    if (isShopGuideStep(firstClearGuideStep)) {
      firstClearGuideStep = "done";
    }
  }
  return {
    gold: slot.gold,
    unlockedLevels: [...slot.unlockedLevels],
    unlockedTracks: [...slot.unlockedTracks],
    unlockedHeroes: [...slot.unlockedHeroes],
    level1Cleared: slot.level1Cleared,
    level2Cleared: slot.level2Cleared,
    shopUnlocked: slot.shopUnlocked,
    shopPromptPending,
    firstClearGuideStep,
  };
}

/** @deprecated 使用 getSlotMeta；无槽位时返回默认进度 */
export function getAccountMeta(account: string, index = 0): AccountMeta {
  return getSlotMeta(account, index);
}

function writeSlotMeta(account: string, index: number, meta: AccountMeta): void {
  const existing = readSlot(account, index) ?? newSlotDraft();
  writeSlot(account, index, { ...existing, ...meta });
}

export function listAccounts(): AccountData[] {
  const root = loadRoot();
  return Object.values(root.accounts).map(normalizeAccount).sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

export function getLastAccountName(): string | null {
  return loadRoot().lastAccount;
}

export function upsertAccount(name: string): AccountData {
  const trimmed = name.trim().slice(0, 16);
  if (!trimmed) throw new Error("empty account");
  const root = loadRoot();
  let acc = root.accounts[trimmed];
  if (!acc) {
    acc = {
      name: trimmed,
      createdAt: Date.now(),
      slots: Array.from({ length: SLOT_COUNT }, () => null),
    };
  }
  const normalized = normalizeAccount(acc);
  root.accounts[trimmed] = normalized;
  root.lastAccount = trimmed;
  writeRoot(root);
  return normalized;
}

export function setLastAccount(name: string): void {
  const root = loadRoot();
  if (!root.accounts[name]) return;
  root.lastAccount = name;
  writeRoot(root);
}

export function getAccount(name: string): AccountData | null {
  const acc = loadRoot().accounts[name];
  return acc ? normalizeAccount(acc) : null;
}

export function readSlot(account: string, index: number): SlotData | null {
  const root = loadRoot();
  const acc = root.accounts[account];
  if (!acc || index < 0 || index >= SLOT_COUNT) return null;
  const legacy = legacyAccountMeta(acc);
  return normalizeSlot(acc.slots?.[index] ?? null, legacy);
}

export function writeSlot(account: string, index: number, data: SlotData): void {
  const root = loadRoot();
  const acc = root.accounts[account];
  if (!acc || index < 0 || index >= SLOT_COUNT) return;
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => acc.slots?.[i] ?? null);
  slots[index] = normalizeSlot({ ...data, updatedAt: Date.now() }, null);
  root.accounts[account] = normalizeAccount({ ...stripLegacyAccountMeta(acc), slots });
  root.lastAccount = account;
  writeRoot(root);
}

export function clearSlot(account: string, index: number): void {
  const root = loadRoot();
  const acc = root.accounts[account];
  if (!acc || index < 0 || index >= SLOT_COUNT) return;
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => acc.slots?.[i] ?? null);
  slots[index] = null;
  root.accounts[account] = normalizeAccount({ ...stripLegacyAccountMeta(acc), slots });
  writeRoot(root);
}

export function recordRun(account: string, index: number, result: RunResult): void {
  const slot = readSlot(account, index);
  if (!slot) return;
  slot.stats.runs += 1;
  if (result.outcome === "win") slot.stats.wins += 1;
  else slot.stats.losses += 1;
  if (result.score > slot.stats.bestScore) slot.stats.bestScore = result.score;
  if (result.stars > slot.stats.bestStars) slot.stats.bestStars = result.stars;
  writeSlot(account, index, slot);
}

export function applyRunRewards(account: string, index: number, result: RunResult): RunResult {
  if (result.outcome !== "win") return result;
  const meta = getSlotMeta(account, index);
  const existing = readSlot(account, index) ?? newSlotDraft();
  const rewards = computeWinRewards(result.levelId, meta.level1Cleared, meta.level2Cleared);
  const nextLevels = [...meta.unlockedLevels];
  if (rewards.levelUnlocked && !nextLevels.includes(rewards.levelUnlocked)) {
    nextLevels.push(rewards.levelUnlocked);
  }
  const nextTracks = [...meta.unlockedTracks];
  if (rewards.trackUnlocked && !nextTracks.includes(rewards.trackUnlocked)) {
    nextTracks.push(rewards.trackUnlocked);
  }
  const nextHeroes = [...meta.unlockedHeroes];
  const level1First = result.levelId === 1 && !meta.level1Cleared && rewards.promptShop;
  const level2First = result.levelId === 2 && !meta.level2Cleared && rewards.trackUnlocked != null;
  const nextGuideStep =
    level1First || level2First ? "reward_track" : meta.firstClearGuideStep;
  // 商店弓使引导只在第一关首通挂起；第二关首通绝不再打开
  const nextShopPrompt = level1First
    ? true
    : level2First
      ? false
      : meta.shopPromptPending;
  // 新解锁的关卡/曲子自动切上，不再逐步引导点选
  const nextLevelId = rewards.levelUnlocked ?? existing.levelId;
  const nextTrackId = rewards.trackUnlocked ?? existing.trackId;
  writeSlot(account, index, {
    ...existing,
    gold: meta.gold + rewards.goldEarned,
    unlockedLevels: nextLevels,
    unlockedTracks: nextTracks,
    unlockedHeroes: nextHeroes,
    level1Cleared: meta.level1Cleared || result.levelId === 1,
    level2Cleared: meta.level2Cleared || result.levelId === 2,
    shopUnlocked: meta.shopUnlocked || rewards.shopUnlocked,
    shopPromptPending: nextShopPrompt,
    firstClearGuideStep: nextGuideStep,
    levelId: nextLevelId,
    trackId: nextTrackId,
  });
  return {
    ...result,
    goldEarned: rewards.goldEarned,
    trackUnlocked: rewards.trackUnlocked,
    levelUnlocked: rewards.levelUnlocked,
    shopUnlocked: rewards.shopUnlocked,
    promptShop: rewards.promptShop,
  };
}

export function setFirstClearGuideStep(
  account: string,
  index: number,
  step: FirstClearGuideStep | null,
): void {
  const meta = getSlotMeta(account, index);
  const normalized = normalizeGuideStep(step);
  writeSlotMeta(account, index, {
    ...meta,
    firstClearGuideStep: normalized,
    shopPromptPending:
      normalized === "done" || normalized == null
        ? false
        : isShopGuideStep(normalized)
          ? true
          : meta.shopPromptPending,
  });
}

export function clearShopPrompt(account: string, index: number): void {
  setFirstClearGuideStep(account, index, "done");
}

export function purchaseHero(
  account: string,
  index: number,
  heroId: HeroId,
): { ok: true } | { ok: false; reason: string } {
  const meta = getSlotMeta(account, index);
  if (!meta.shopUnlocked) {
    return { ok: false, reason: "通关第一关后解锁商城" };
  }
  if (meta.unlockedHeroes.includes(heroId)) {
    return { ok: false, reason: "已拥有该角色" };
  }
  const price = HERO_PRICES[heroId];
  if (price <= 0) {
    return { ok: false, reason: "该角色不可购买" };
  }
  if (meta.gold < price) {
    return { ok: false, reason: `金币不足（需要 ${price}）` };
  }
  writeSlotMeta(account, index, {
    ...meta,
    gold: meta.gold - price,
    unlockedHeroes: [...meta.unlockedHeroes, heroId].sort((a, b) => a - b),
    // 买完弓使后商店弓使引导永久结束
    shopPromptPending: heroId === 3 ? false : meta.shopPromptPending,
  });
  return { ok: true };
}

export function sanitizeSlotDraft(draft: SlotData, meta: AccountMeta): SlotData {
  const weaponId = draft.weaponId ?? draft.lastWeaponId ?? draft.weaponIds?.[0] ?? 2;
  const safeWeapon = meta.unlockedHeroes.includes(weaponId) ? weaponId : meta.unlockedHeroes[0]!;
  const levelId = meta.unlockedLevels.includes(draft.levelId)
    ? draft.levelId
    : (meta.unlockedLevels[meta.unlockedLevels.length - 1] ?? 1);
  const trackId = meta.unlockedTracks.includes(draft.trackId)
    ? draft.trackId
    : (meta.unlockedTracks[meta.unlockedTracks.length - 1] ?? 1);
  return { ...draft, ...meta, levelId, trackId, weaponId: safeWeapon };
}

export function newSlotDraft(partial?: Partial<SlotData>): SlotData {
  return {
    updatedAt: Date.now(),
    levelId: 1,
    trackId: 1,
    weaponId: 2,
    audioLatencyMs: DEFAULT_AUDIO_LATENCY_MS,
    muted: false,
    stats: { runs: 0, wins: 0, losses: 0, bestScore: 0, bestStars: 0 },
    ...defaultMeta(),
    ...partial,
  };
}
