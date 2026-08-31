import { Application } from "pixi.js";
import { TrackPlayer } from "./audio";
import { BeatGridClock } from "./beatClock";
import {
  BEAT_WINDOW_MS,
  ULTIMATE_BEAT_CHARGES,
  VIEW_H_DESKTOP,
  VIEW_H_TOUCH,
  VIEW_W_DESKTOP,
  VIEW_W_TOUCH,
} from "./constants";
import { beginCombat, createSim, doAttack, doSlide, doUltimate, forfeitRevive as forfeitReviveSim, nearestBoss, restartRun, reviveRun, stepSim, switchWeapon } from "./sim";
import { computeRunResult } from "./runResult";
import { TRACKS } from "./tracks";
import type { HudSnapshot, RunResult, Sim, TrackId, WeaponId } from "./types";
import { WorldRenderer } from "../pixi/worldRenderer";

export interface RuntimeConfig {
  trackId: TrackId;
  weaponIds: WeaponId[];
  weaponId: WeaponId;
  audioLatencyMs: number;
  muted: boolean;
  tutorial: boolean;
  touch: boolean;
}

export class GameRuntime {
  readonly sim: Sim;
  readonly audio = new TrackPlayer();
  readonly beat: BeatGridClock;
  viewW: number;
  viewH: number;
  moveX = 0;
  moveY = 0;
  onHud: ((h: HudSnapshot) => void) | null = null;
  onOutcome: ((r: RunResult) => void) | null = null;

  private app: Application | null = null;
  private world: WorldRenderer | null = null;
  private dead = false;
  private queuedAttack = false;
  private queuedSlide = false;
  private queuedUlt = false;
  private hudWasOk = false;
  private hudMs = 0;
  private reported: RunResult | null = null;
  private lastHudEmit = 0;
  private paused = false;

  private consumedBeatSlot: string | null = null; // 每拍仅允许一次卡拍强化（攻或滑步）

  constructor(cfg: RuntimeConfig) {
    this.viewW = cfg.touch ? VIEW_W_TOUCH : VIEW_W_DESKTOP;
    this.viewH = cfg.touch ? VIEW_H_TOUCH : VIEW_H_DESKTOP;
    this.sim = createSim({
      trackId: cfg.trackId,
      weaponId: cfg.weaponId,
      allowedWeapons: cfg.weaponIds,
      tutorial: cfg.tutorial,
    });
    this.beat = new BeatGridClock(TRACKS[cfg.trackId], BEAT_WINDOW_MS, cfg.audioLatencyMs);
    this.audio.latencyMs = cfg.audioLatencyMs;
    this.audio.setMuted(cfg.muted);
  }

  async mount(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      background: 0x1a2814,
      antialias: true,
      resizeTo: host,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    if (this.dead) {
      app.destroy(true);
      return;
    }
    this.app = app;
    host.appendChild(app.canvas);
    this.world = new WorldRenderer(app);
    try {
      await this.audio.play(this.sim.trackId);
    } catch {
      /* 浏览器可能拦截自动播放；首次按键后仍可 [M] 再试 */
    }
    if (this.dead) return;
    app.ticker.add(() => this.loop());
    this.emitHud(true);
  }

  destroy(): void {
    this.dead = true;
    this.audio.stop();
    this.world?.destroy();
    this.world = null;
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
  }

  setMove(x: number, y: number): void {
    if (this.paused) {
      this.moveX = 0;
      this.moveY = 0;
      return;
    }
    this.moveX = x;
    this.moveY = y;
    if (x !== 0 || y !== 0) this.kickAudio();
  }

  queueAttack(): void {
    if (this.paused) return;
    this.kickAudio();
    this.queuedAttack = true;
  }
  queueSlide(): void {
    if (this.paused) return;
    this.kickAudio();
    this.queuedSlide = true;
  }
  queueUlt(): void {
    if (this.paused) return;
    this.kickAudio();
    this.queuedUlt = true;
  }

  private kickAudio(): void {
    void (async () => {
      try {
        await this.audio.unlock();
        if (!this.audio.playingTrack) await this.audio.play(this.sim.trackId);
      } catch {
        /* autoplay */
      }
    })();
  }

  switchWeapon(id: WeaponId): void {
    switchWeapon(this.sim, id);
  }

  startCombat(): void {
    if (this.sim.run === "tutorial") beginCombat(this.sim);
  }

  restart(tutorial: boolean): void {
    this.reported = null;
    this.consumedBeatSlot = null;
    restartRun(this.sim, tutorial);
  }

  reviveFromAd(): boolean {
    if (!reviveRun(this.sim)) return false;
    this.paused = false;
    this.emitHud(true);
    return true;
  }

  forfeitRevive(): void {
    forfeitReviveSim(this.sim);
    if (this.sim.run === "lose") this.reportOutcome();
    this.emitHud(true);
  }

  private reportOutcome(): void {
    const result = computeRunResult(this.sim);
    if (!this.reported || this.reported.outcome !== result.outcome) {
      this.reported = result;
      this.onOutcome?.(result);
    }
  }

  setLatency(ms: number): void {
    this.audio.latencyMs = ms;
    this.beat.audioLatencyMs = ms;
  }

  nudgeLatency(delta: number): void {
    const next = Math.max(0, Math.min(400, this.audio.latencyMs + delta));
    this.setLatency(next);
  }

  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  togglePause(): boolean {
    this.paused = !this.paused;
    if (this.paused) {
      this.moveX = 0;
      this.moveY = 0;
      this.queuedAttack = false;
      this.queuedSlide = false;
      this.queuedUlt = false;
      void this.audio.suspend();
    } else {
      void this.audio.resume();
    }
    this.emitHud(true);
    return this.paused;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  snapshot(): HudSnapshot {
    return this.buildHud();
  }

  private onBeatNow(): boolean {
    const t = this.audio.timelineMs(this.sim.nowMs);
    if (!this.beat.judgmentForCombat(t, this.hudWasOk, this.hudMs)) return false;
    const slot = this.beat.beatSlotKey(t);
    if (this.consumedBeatSlot === slot) return false;
    return true;
  }

  private consumeBeatSlot(): void {
    const t = this.audio.timelineMs(this.sim.nowMs);
    this.consumedBeatSlot = this.beat.beatSlotKey(t);
  }

  private loop(): void {
    if (this.dead || !this.app || !this.world) return;
    if (this.paused) {
      this.world.render(this.sim, this.viewW, this.viewH, this.sim.nowMs);
      this.emitHud(false);
      return;
    }
    const dt = this.app.ticker.deltaMS;
    if (this.queuedAttack) {
      const onBeat = this.onBeatNow();
      if (doAttack(this.sim, onBeat)) {
        if (onBeat) this.consumeBeatSlot();
      }
      this.queuedAttack = false;
    }
    if (this.queuedSlide) {
      const onBeat = this.onBeatNow();
      if (doSlide(this.sim, onBeat, this.moveX, this.moveY)) {
        if (onBeat) this.consumeBeatSlot();
      }
      this.queuedSlide = false;
    }
    if (this.queuedUlt) {
      doUltimate(this.sim);
      this.queuedUlt = false;
    }
    stepSim(this.sim, dt, this.moveX, this.moveY);
    const drawT = this.audio.timelineMs(this.sim.nowMs);
    this.hudWasOk = this.beat.hudInZone(drawT);
    this.hudMs = drawT;
    this.world.render(this.sim, this.viewW, this.viewH, this.sim.nowMs);
    if (this.sim.run === "win" || this.sim.run === "lose") {
      const shouldReport = this.sim.run === "win" || !this.sim.reviveAvailable;
      if (shouldReport) this.reportOutcome();
    }
    this.emitHud(false);
  }

  private emitHud(force: boolean): void {
    if (!this.onHud) return;
    if (!force && this.sim.nowMs - this.lastHudEmit < 32) return;
    this.lastHudEmit = this.sim.nowMs;
    this.onHud(this.buildHud());
  }

  private buildHud(): HudSnapshot {
    const t = this.audio.timelineMs(this.sim.nowMs);
    const boss = nearestBoss(this.sim);
    const runResult =
      this.sim.run === "win" ||
      (this.sim.run === "lose" && !this.sim.reviveAvailable)
        ? computeRunResult(this.sim)
        : null;
    return {
      run: this.sim.run,
      hp: this.sim.player.hp,
      maxHp: this.sim.player.maxHp,
      energy: this.sim.energy,
      energyMax: ULTIMATE_BEAT_CHARGES,
      weaponId: this.sim.weaponId,
      allowedWeapons: this.sim.allowedWeapons,
      trackId: this.sim.trackId,
      enemyCount: this.sim.enemies.length,
      pendingCount: this.sim.pendingWaves.reduce((n, wave) => n + wave.length, 0),
      wave: this.sim.wave,
      waveTotal: this.sim.waveTotal,
      bossCount: this.sim.enemies.filter((e) => e.kind === "boss").length,
      megabossCount: this.sim.enemies.filter((e) => e.kind === "megaboss").length,
      nearestBossHp: boss?.hp ?? null,
      nearestBossMax: boss?.maxHp ?? null,
      beatPhase01: this.beat.beatPhase01(t),
      inZone: this.beat.hudInZone(t),
      beatProximity: this.beat.beatProximity(t),
      windowFrac: this.beat.hudWindowFrac(),
      ultReady: this.sim.energy >= ULTIMATE_BEAT_CHARGES,
      spearThrustCharges: this.sim.spearThrustCharges,
      samuraiSlideCharges: this.sim.samuraiSlideCharges,
      shieldHp: this.sim.shieldHp,
      latencyMs: this.audio.latencyMs,
      muted: this.audio.muted,
      onBeatFlash: !!this.sim.flash?.onBeat,
      paused: this.paused,
      combo: this.sim.stats.combo,
      maxCombo: this.sim.stats.maxCombo,
      reviveAvailable: this.sim.reviveAvailable,
      runResult,
    };
  }
}
