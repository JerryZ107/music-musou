import { DEFAULT_AUDIO_LATENCY_MS } from "./constants";
import { TRACKS } from "./tracks";
import type { MusicProfile, TrackId } from "./types";

const SR = 22050;

/** 在用户点击/触摸的同步回调里预热 AudioContext（iOS 必需）。 */
let primedCtx: AudioContext | null = null;

export function primeAudioFromUserGesture(): void {
  try {
    const Ctx = getAudioContextCtor();
    if (!Ctx) return;
    if (!primedCtx) primedCtx = new Ctx();
    if (primedCtx.state === "suspended") void primedCtx.resume();
  } catch {
    /* 部分内嵌浏览器不支持 */
  }
}

function takePrimedAudioContext(): AudioContext | null {
  const ctx = primedCtx;
  primedCtx = null;
  return ctx;
}

export function resolveAudioAsset(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL;
  const rel = path.replace(/^\//, "");
  return `${base}${rel}`;
}

/** 战斗曲目标准音量 */
export const GAME_BGM_GAIN = 0.55;
/** 商店 BGM（与战斗曲同音量） */
export const MENU_BGM_GAIN = GAME_BGM_GAIN;
export const SHOP_BGM_URL = "audio/shop-bgm.mp3";

export type AmbientBgmKind = "shop";

const AMBIENT_BGM_URLS: Record<AmbientBgmKind, string> = {
  shop: SHOP_BGM_URL,
};

function getAudioContextCtor(): typeof AudioContext | null {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/** MP3 加载失败时的极简节拍 click 兜底（正常应播放 public/audio 录音）。 */
function fillAnalyzedFallback(data: Float32Array, profile: MusicProfile): void {
  const loopMs = profile.loopMs;
  for (let i = 0; i < data.length; i++) {
    const tMs = ((i / SR) * 1000) % loopMs;
    let out = 0;
    for (const beat of profile.beatTimesMs) {
      const d = Math.abs(tMs - beat);
      if (d < 12) {
        const phase = d / 12;
        out += 0.18 * Math.sin(2 * Math.PI * 180 * (i / SR)) * (1 - phase);
      }
    }
    data[i] = out;
  }
}

async function fetchAudioBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(resolveAudioAsset(url), { cache: "force-cache" });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return await ctx.decodeAudioData(ab.slice(0));
  } catch {
    return null;
  }
}

function buildSynthBuffer(ctx: AudioContext, trackId: TrackId): AudioBuffer {
  const profile = TRACKS[trackId];
  const seconds = profile.loopMs / 1000;
  const n = Math.floor(SR * seconds);
  const buffer = ctx.createBuffer(1, n, SR);
  fillAnalyzedFallback(buffer.getChannelData(0), profile);
  return buffer;
}

export class TrackPlayer {
  latencyMs = DEFAULT_AUDIO_LATENCY_MS;
  muted = false;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startAt = 0;
  private buffers = new Map<TrackId, AudioBuffer>();
  private fileLoaded = new Set<TrackId>();
  private fileFailed = new Set<TrackId>();
  private playingId: TrackId | null = null;

  async unlock(): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx = getAudioContextCtor();
      this.ctx = takePrimedAudioContext() ?? (Ctx ? new Ctx() : new AudioContext());
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : GAME_BGM_GAIN;
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private async loadBuffer(ctx: AudioContext, trackId: TrackId): Promise<AudioBuffer> {
    const profile = TRACKS[trackId];
    if (profile.audioUrl && !this.fileLoaded.has(trackId) && !this.fileFailed.has(trackId)) {
      const candidates = [
        profile.audioUrl,
        profile.audioUrl.replace(/\.mp3$/i, ".ogg"),
        profile.audioUrl.replace(/\.mp3$/i, ".wav"),
      ];
      for (const url of candidates) {
        const fileBuf = await fetchAudioBuffer(ctx, url);
        if (fileBuf) {
          this.fileLoaded.add(trackId);
          return fileBuf;
        }
      }
      this.fileFailed.add(trackId);
    }
    return buildSynthBuffer(ctx, trackId);
  }

  async play(trackId: TrackId): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    if (!this.buffers.has(trackId)) {
      this.buffers.set(trackId, await this.loadBuffer(ctx, trackId));
    }
    this.stop();
    const src = ctx.createBufferSource();
    src.buffer = this.buffers.get(trackId)!;
    src.loop = true;
    src.connect(this.gain!);
    this.startAt = ctx.currentTime;
    src.start(0);
    this.source = src;
    this.playingId = trackId;
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.source.disconnect();
      this.source = null;
    }
    this.playingId = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.gain) this.gain.gain.value = muted ? 0 : GAME_BGM_GAIN;
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  async suspend(): Promise<void> {
    const ctx = this.ctx;
    if (ctx && ctx.state === "running") await ctx.suspend();
  }

  async resume(): Promise<void> {
    const ctx = this.ctx;
    if (ctx && ctx.state === "suspended") await ctx.resume();
  }

  timelineMs(fallbackMs: number): number {
    if (!this.ctx || !this.source) return fallbackMs;
    return Math.max(0, (this.ctx.currentTime - this.startAt) * 1000 - this.latencyMs);
  }

  /** 已解码录音的实际时长（毫秒），用于与拍点对齐。 */
  bufferDurationMs(trackId: TrackId): number | null {
    const buf = this.buffers.get(trackId);
    return buf ? buf.duration * 1000 : null;
  }

  get playingTrack(): TrackId | null {
    return this.playingId;
  }

  isUsingAudioFile(trackId: TrackId): boolean {
    return this.fileLoaded.has(trackId);
  }
}

/** 商店循环曲；进入商店时播放，离开即停。 */
export class MenuBgmPlayer {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffers = new Map<AmbientBgmKind, AudioBuffer>();
  private failed = new Set<AmbientBgmKind>();
  private wantKind: AmbientBgmKind | null = null;
  private playingKind: AmbientBgmKind | null = null;
  private starting: Promise<void> | null = null;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctx = getAudioContextCtor();
    if (!Ctx) return null;
    // 优先接手势里预热过的 context，刷新后点一下即可出声
    this.ctx = takePrimedAudioContext() ?? new Ctx();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = MENU_BGM_GAIN;
    this.gain.connect(this.ctx.destination);
    return this.ctx;
  }

  private async resumeCtx(): Promise<boolean> {
    const ctx = this.ensure();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === "running";
  }

  async start(kind: AmbientBgmKind = "shop"): Promise<void> {
    this.wantKind = kind;
    const running = await this.resumeCtx();
    if (this.playingKind === kind && this.source && running) return;
    // 挂起时创建的 source 可能无声，清掉后等 running 再播
    if (this.source && !running) {
      this.stopSource();
    }
    if (this.playingKind === kind && this.source) return;
    if (this.starting) return this.starting;
    this.starting = this.startInner().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private stopSource(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.source.disconnect();
      this.source = null;
    }
    this.playingKind = null;
  }

  private async startInner(): Promise<void> {
    const ctx = this.ensure();
    if (!ctx || !this.gain) return;
    if (!(await this.resumeCtx())) return;

    while (this.wantKind && this.wantKind !== this.playingKind) {
      const kind = this.wantKind;
      if (!this.buffers.has(kind) && !this.failed.has(kind)) {
        const buf = await fetchAudioBuffer(ctx, AMBIENT_BGM_URLS[kind]);
        if (!buf) {
          this.failed.add(kind);
          return;
        }
        this.buffers.set(kind, buf);
      }
      if (!(await this.resumeCtx())) return;
      if (this.wantKind !== kind) continue;
      const buffer = this.buffers.get(kind);
      if (!buffer) return;
      this.stopSource();
      if (this.wantKind !== kind) continue;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.gain);
      src.start(0);
      this.source = src;
      this.playingKind = kind;
    }
  }

  stop(): void {
    this.wantKind = null;
    this.stopSource();
  }

  /** 用户手势后强制 resume 并续播（刷新后必须点一下）。 */
  kickFromGesture(): void {
    if (!this.wantKind) return;
    const kind = this.wantKind;
    void (async () => {
      const wasSuspended = !this.ctx || this.ctx.state !== "running";
      const running = await this.resumeCtx();
      if (!running) return;
      // 刷新后挂起期间拉起的 source 常常无声，解锁后重建
      if (wasSuspended && this.source) {
        this.stopSource();
      }
      await this.start(kind);
    })();
  }
}