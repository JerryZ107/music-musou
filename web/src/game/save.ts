import { DEFAULT_AUDIO_LATENCY_MS, SAVE_KEY, SLOT_COUNT } from "./constants";
import type { RunResult, TrackId, WeaponId } from "./types";

export interface SlotStats {
  runs: number;
  wins: number;
  losses: number;
  bestScore: number;
  bestStars: number;
}

export interface SlotData {
  updatedAt: number;
  trackId: TrackId;
  weaponIds: WeaponId[];
  lastWeaponId: WeaponId;
  audioLatencyMs: number;
  muted: boolean;
  stats: SlotStats;
}

export interface AccountData {
  name: string;
  createdAt: number;
  slots: (SlotData | null)[];
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

function writeRoot(root: SaveRoot): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(root));
}

export function listAccounts(): AccountData[] {
  const root = loadRoot();
  return Object.values(root.accounts).sort((a, b) => a.name.localeCompare(b.name, "zh"));
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
    root.accounts[trimmed] = acc;
  }
  root.lastAccount = trimmed;
  writeRoot(root);
  return acc;
}

export function setLastAccount(name: string): void {
  const root = loadRoot();
  if (!root.accounts[name]) return;
  root.lastAccount = name;
  writeRoot(root);
}

export function getAccount(name: string): AccountData | null {
  return loadRoot().accounts[name] ?? null;
}

export function readSlot(account: string, index: number): SlotData | null {
  const acc = getAccount(account);
  if (!acc || index < 0 || index >= SLOT_COUNT) return null;
  const raw = acc.slots[index];
  if (!raw) return null;
  return {
    ...raw,
    stats: {
      runs: raw.stats.runs ?? 0,
      wins: raw.stats.wins ?? 0,
      losses: raw.stats.losses ?? 0,
      bestScore: raw.stats.bestScore ?? 0,
      bestStars: raw.stats.bestStars ?? 0,
    },
  };
}

export function writeSlot(account: string, index: number, data: SlotData): void {
  const root = loadRoot();
  const acc = root.accounts[account];
  if (!acc || index < 0 || index >= SLOT_COUNT) return;
  const slots = [...acc.slots];
  slots[index] = { ...data, updatedAt: Date.now() };
  root.accounts[account] = { ...acc, slots };
  root.lastAccount = account;
  writeRoot(root);
}

export function clearSlot(account: string, index: number): void {
  const root = loadRoot();
  const acc = root.accounts[account];
  if (!acc || index < 0 || index >= SLOT_COUNT) return;
  const slots = [...acc.slots];
  slots[index] = null;
  root.accounts[account] = { ...acc, slots };
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

export function newSlotDraft(partial?: Partial<SlotData>): SlotData {
  return {
    updatedAt: Date.now(),
    trackId: 1,
    weaponIds: [1, 2, 3],
    lastWeaponId: 1,
    audioLatencyMs: DEFAULT_AUDIO_LATENCY_MS,
    muted: false,
    stats: { runs: 0, wins: 0, losses: 0, bestScore: 0, bestStars: 0 },
    ...partial,
  };
}
