import { DEFAULT_AUDIO_LATENCY_MS } from "./constants";
import { midiToHz, TRACKS } from "./tracks";
import type { MelodyNote } from "./tracks";
import type { MusicProfile, TrackId } from "./types";

const SR = 22050;

function envDecay(phase: number, length: number): number {
  if (phase >= length || length <= 0) return 0;
  return (1 - phase / length) ** 1.6;
}

function noise(i: number, salt: number): number {
  const n = (Math.imul(i + salt, 1103515245) + 12345) & 0x7fffffff;
  return (n / 0x7fffffff) * 2 - 1;
}

/** 第一首 · 电音战歌（原版程序合成） */
function fillTrack1(data: Float32Array, bpm: number): void {
  const beatSec = 60 / bpm;
  const beats = 32;
  for (let i = 0; i < data.length; i++) {
    const t = i / SR;
    const beatF = t / beatSec;
    const beatIdx = Math.floor(beatF) % beats;
    const beatPhase = beatF % 1;
    const barIdx = Math.floor(beatIdx / 4);
    const chordIdx = Math.floor(barIdx / 2) % 4;
    const roots = [110, 87.31, 130.81, 98];
    let sample = 0;
    if ((beatIdx % 4 === 0 || beatIdx % 8 === 6) && beatPhase < 0.1) {
      sample += 0.62 * Math.sin(2 * Math.PI * 55 * beatPhase) * envDecay(beatPhase, 0.1);
    }
    if ((beatIdx % 4 === 1 || beatIdx % 4 === 3) && beatPhase < 0.08) {
      sample += 0.42 * noise(i, 0) * envDecay(beatPhase, 0.08);
    }
    if (beatPhase < 0.04 || (beatPhase > 0.45 && beatPhase < 0.49)) {
      sample += 0.11 * noise(i, 3) * (beatIdx % 2 ? 0.7 : 1);
    }
    const root = roots[chordIdx]!;
    sample += 0.2 * Math.sin(2 * Math.PI * root * t);
    const pent = [220, 261.63, 293.66, 329.63, 392];
    const melody = [0, 2, 4, 2, 1, 2, 0, -1, 2, 4, 3, 2, 1, 0, -1, -1];
    const noteI = melody[Math.floor(beatF * 2) % melody.length]!;
    if (noteI >= 0 && beatPhase < 0.42) {
      const freq = pent[noteI % pent.length]!;
      const env = envDecay(beatPhase, 0.42);
      sample += 0.14 * Math.sin(2 * Math.PI * freq * t) * env;
    }
    data[i] = Math.tanh(sample * 1.15) * 0.82;
  }
}

function pianoTone(freq: number, phase: number, gain: number): number {
  const w = 2 * Math.PI * freq * phase;
  return (
    (Math.sin(w) +
      0.38 * Math.sin(2 * w) +
      0.14 * Math.sin(3 * w) +
      0.06 * Math.sin(4 * w)) *
    gain
  );
}

function noteEnvelope(phase: number, dur: number, staccato = false): number {
  const attack = staccato ? 0.002 : 0.006;
  if (phase < attack) return phase / attack;
  const decay = staccato ? 2.8 : 3.4;
  return Math.exp((-decay * (phase - attack)) / Math.max(staccato ? 0.05 : 0.07, dur * 0.52));
}

function fillMelodyTrack(data: Float32Array, profile: MusicProfile): void {
  const loopSec = profile.loopMs / 1000;
  const beatSec = loopSec / profile.loopBeats;
  const notes = profile.melodyNotes ?? [];
  const bass = profile.bassNotes;
  const style = profile.style ?? "gentle";
  const bpm = profile.bpmLabel;

  for (let i = 0; i < data.length; i++) {
    const t = i / SR;
    const tLoop = t % loopSec;
    let out = 0;

    const renderNotes = (list: readonly MelodyNote[], gain: number) => {
      for (const [midi, startBeat, durBeats] of list) {
        const start = startBeat * beatSec;
        const dur = durBeats * beatSec;
        const phase = tLoop - start;
        if (phase < 0 || phase > dur) continue;
        const env = noteEnvelope(phase, dur, durBeats <= 0.25);
        const freq = midiToHz(midi);
        out += pianoTone(freq, phase, gain * env);
        if (style === "rhapsody" && durBeats <= 0.25) {
          out += pianoTone(freq * 1.002, phase, gain * env * 0.35);
        }
      }
    };

    renderNotes(notes, style === "rhapsody" ? 0.5 : 0.52);
    if (bass) renderNotes(bass, style === "rhapsody" ? 0.34 : 0.28);

    // 轻伴奏：进行曲/卡农加一点节奏，方便卡拍
    const beatF = tLoop / beatSec;
    const beatIdx = Math.floor(beatF) % profile.loopBeats;
    const beatPhase = beatF % 1;
    if (style === "march" || style === "dance" || style === "rhapsody") {
      if (beatIdx % 4 === 0 && beatPhase < 0.06) {
        out += (style === "rhapsody" ? 0.18 : 0.14) * Math.sin(2 * Math.PI * 80 * beatPhase) * (1 - beatPhase / 0.06);
      }
      if (style === "rhapsody" && beatPhase < 0.025) {
        out += 0.05 * Math.sin(2 * Math.PI * 240 * beatPhase) * (1 - beatPhase / 0.025);
      }
      if ((beatIdx % 4 === 2 || style === "march") && beatIdx % 4 === 2 && beatPhase < 0.04) {
        out += 0.06 * Math.sin(2 * Math.PI * 120 * beatPhase) * (1 - beatPhase / 0.04);
      }
    }
    if (style === "dance" && beatPhase < 0.02) {
      out += 0.04 * Math.sin(2 * Math.PI * 200 * beatPhase);
    }

    // 极轻 pad，避免干巴
    const rootMidi = bass?.[Math.floor(beatIdx / 2) % (bass.length || 1)]?.[0] ?? notes[0]?.[0] ?? 60;
    out += 0.045 * Math.sin(2 * Math.PI * midiToHz(rootMidi - 12) * tLoop);

    data[i] = Math.tanh(out * (style === "rhapsody" ? 1.22 : style === "march" ? 1.12 : 1.05)) * (bpm > 110 ? 0.8 : 0.74);
  }
}

async function fetchAudioBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
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
  const data = buffer.getChannelData(0);
  if (profile.synth === "edm") fillTrack1(data, profile.bpmLabel);
  else fillMelodyTrack(data, profile);
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
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.muted ? 0 : 0.55;
      this.gain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private async loadBuffer(ctx: AudioContext, trackId: TrackId): Promise<AudioBuffer> {
    const profile = TRACKS[trackId];
    if (
      profile.synth !== "edm" &&
      profile.audioUrl &&
      !this.fileLoaded.has(trackId) &&
      !this.fileFailed.has(trackId)
    ) {
      const candidates = [
        profile.audioUrl,
        profile.audioUrl.replace(/\.ogg$/i, ".mp3"),
        profile.audioUrl.replace(/\.ogg$/i, ".wav"),
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
    if (this.gain) this.gain.gain.value = muted ? 0 : 0.55;
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

  get playingTrack(): TrackId | null {
    return this.playingId;
  }

  /** 是否正在播放 public/audio 下的录音文件 */
  isUsingAudioFile(trackId: TrackId): boolean {
    return this.fileLoaded.has(trackId);
  }
}
