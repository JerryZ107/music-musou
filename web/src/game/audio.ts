import { DEFAULT_AUDIO_LATENCY_MS, TRACK_BPM_SCALE } from "./constants";
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
  private disposed = false;
  /** 与 TRACK_BPM_SCALE 一致；timelineMs 按此换算音频进度。 */
  private playbackRate = TRACK_BPM_SCALE;
  /** 递增以作废进行中的 play()，防止并发叠轨。 */
  private playEpoch = 0;
  private playTail: Promise<void> = Promise.resolve();

  async unlock(): Promise<void> {
    if (this.disposed) return;
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

  /** 是否已在播，或正在加载/启动中（避免重复 kick）。 */
  get isBusy(): boolean {
    return this.playingId !== null || this._starting;
  }

  private _starting = false;

  async play(trackId: TrackId): Promise<void> {
    if (this.disposed) return;
    const epoch = ++this.playEpoch;
    this._starting = true;
    const job = async () => {
      if (this.disposed || epoch !== this.playEpoch) return;
      try {
        const ctx = this.ensure();
        if (ctx.state === "suspended") await ctx.resume();
        if (this.disposed || epoch !== this.playEpoch) return;

        if (!this.buffers.has(trackId)) {
          const buf = await this.loadBuffer(ctx, trackId);
          if (this.disposed || epoch !== this.playEpoch) return;
          this.buffers.set(trackId, buf);
        }

        this.stopSourceOnly();
        if (this.disposed || epoch !== this.playEpoch) return;

        const src = ctx.createBufferSource();
        src.buffer = this.buffers.get(trackId)!;
        src.loop = true;
        // 与 timelineMs 共用 playbackRate，保证「听到的位置 === 判定时间轴」
        const rate = this.playbackRate;
        src.playbackRate.setValueAtTime(rate, ctx.currentTime);
        src.connect(this.gain!);
        this.startAt = ctx.currentTime;
        src.start(0);
        if (this.disposed || epoch !== this.playEpoch) {
          try {
            src.stop();
          } catch {
            /* ignore */
          }
          src.disconnect();
          return;
        }
        this.source = src;
        this.playingId = trackId;
      } finally {
        if (epoch === this.playEpoch) this._starting = false;
      }
    };

    this.playTail = this.playTail.then(job, job);
    return this.playTail;
  }

  /** 只停当前 source，不提升 epoch（供 play 内部换轨）。 */
  private stopSourceOnly(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      try {
        this.source.disconnect();
      } catch {
        /* ignore */
      }
      this.source = null;
    }
    this.playingId = null;
  }

  stop(): void {
    this.playEpoch += 1;
    this._starting = false;
    this.stopSourceOnly();
  }

  /** 退出战斗时彻底关闭，杜绝迟到的 play() 再出声。 */
  dispose(): void {
    this.disposed = true;
    this.stop();
    const ctx = this.ctx;
    this.ctx = null;
    this.gain = null;
    this.buffers.clear();
    if (ctx) {
      void ctx.close().catch(() => {});
    }
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
    if (this.disposed) return;
    const ctx = this.ctx;
    if (ctx && ctx.state === "suspended") await ctx.resume();
  }

  timelineMs(fallbackMs: number): number {
    if (!this.ctx || !this.source) return fallbackMs;
    // 缓冲时间轴（ms）= 上下文流逝 × playbackRate；必须与拍点 JSON（文件时间）同坐标系
    const rate = this.source.playbackRate.value || this.playbackRate;
    return Math.max(0, (this.ctx.currentTime - this.startAt) * rate * 1000 - this.latencyMs);
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

/** 商店循环曲；进入商店时播放，离开即停（HTMLAudio，避免 WebAudio 手势断链 / 大文件解码失败）。 */
export class MenuBgmPlayer {
  private audio: HTMLAudioElement | null = null;
  private wantPlay = false;
  private starting: Promise<void> | null = null;

  private ensure(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const el = new Audio(resolveAudioAsset(SHOP_BGM_URL));
    el.loop = true;
    el.preload = "auto";
    el.volume = MENU_BGM_GAIN;
    this.audio = el;
    return el;
  }

  /** 必须在点击/触摸的同步阶段调用，解锁自动播放。 */
  unlockFromGesture(): void {
    this.wantPlay = true;
    const el = this.ensure();
    const p = el.play();
    if (p && typeof p.then === "function") {
      void p
        .then(() => {
          if (!this.wantPlay) el.pause();
        })
        .catch(() => {
          /* 等 start 再试 */
        });
    }
  }

  async start(_kind: AmbientBgmKind = "shop"): Promise<void> {
    this.wantPlay = true;
    if (this.starting) return this.starting;
    this.starting = this.startInner().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async startInner(): Promise<void> {
    if (!this.wantPlay) return;
    const el = this.ensure();
    el.volume = MENU_BGM_GAIN;
    if (!el.paused && !el.ended) return;
    try {
      el.currentTime = 0;
      await el.play();
    } catch {
      /* 无手势时失败；等下次 kick */
    }
  }

  stop(): void {
    this.wantPlay = false;
    const el = this.audio;
    if (!el) return;
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }

  /** 用户手势后强制续播。 */
  kickFromGesture(): void {
    if (!this.wantPlay) return;
    this.unlockFromGesture();
    void this.start("shop");
  }
}