import { Application } from "pixi.js";
import { TrackPlayer } from "./audio";
import { BeatGridClock } from "./beatClock";
import {
  BEAT_RING_WINDOW_MS,
  BEAT_WINDOW_MS,
  ULTIMATE_BEAT_CHARGES,
  VIEW_H_DESKTOP,
  VIEW_H_TOUCH,
  VIEW_W_DESKTOP,
  VIEW_W_TOUCH,
} from "./constants";
import { beginCombat, createSim, doAttack, doSlide, doUltimate, forfeitRevive as forfeitReviveSim, isReviveHolding, nearestBoss, restartRun, reviveGraceRemainingMs, reviveHoldRemainingMs, reviveRun, stepSim, switchWeapon } from "./sim";
import { beatSkillTierAt } from "./beatSkill";
import { computeRunResult } from "./runResult";
import { TRACKS } from "./tracks";
import type { HudSnapshot, RunResult, Sim, TrackId, LevelId, WeaponId, BeatCue } from "./types";
import { WorldRenderer } from "../pixi/worldRenderer";

export interface RuntimeConfig {
  levelId: LevelId;
  trackId: TrackId;
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
  private hudWasCombat = false;
  private hudMs = 0;
  private reported: RunResult | null = null;
  private lastHudEmit = 0;
  private paused = false;

  private consumedAttackBeatSlots = new Set<string>();
  private consumedSlideBeatSlots = new Set<string>();
  /** 普攻/滑步打点痕迹（音频时间轴毫秒）。 */
  private inputMarks: { absMs: number; onBeat: boolean }[] = [];
  private audioKick: Promise<void> | null = null;

  constructor(cfg: RuntimeConfig) {
    this.viewW = cfg.touch ? VIEW_W_TOUCH : VIEW_W_DESKTOP;
    this.viewH = cfg.touch ? VIEW_H_TOUCH : VIEW_H_DESKTOP;
    this.sim = createSim({
      levelId: cfg.levelId,
      trackId: cfg.trackId,
      weaponId: cfg.weaponId,
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
      this.syncBeatToAudio(this.sim.trackId);
    } catch {
      /* 浏览器可能拦截自动播放；首次按键后仍可 [M] 再试 */
    }
    if (this.dead) return;
    app.ticker.add(() => this.loop());
    this.emitHud(true);
  }

  /** 横屏壳层生效后补一次尺寸同步（resizeTo 首帧可能量错）。 */
  syncCanvasSize(): void {
    const app = this.app;
    const host = app?.canvas.parentElement;
    if (!app || !host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 1 || h < 1) return;
    app.renderer.resize(w, h);
  }

  destroy(): void {
    this.dead = true;
    this.audioKick = null;
    this.audio.dispose();
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
    if (this.dead) return;
    // 已在播或正在启动：只 resume，绝不并行开新轨
    if (this.audio.isBusy) {
      void this.audio.unlock();
      return;
    }
    if (this.audioKick) return;
    this.audioKick = (async () => {
      try {
        await this.audio.unlock();
        if (this.dead) return;
        if (this.audio.isBusy) return;
        await this.audio.play(this.sim.trackId);
        if (!this.dead) this.syncBeatToAudio(this.sim.trackId);
      } catch {
        /* autoplay */
      } finally {
        this.audioKick = null;
      }
    })();
  }

  switchWeapon(id: WeaponId): void {
    switchWeapon(this.sim, id);
  }

  startCombat(): void {
    this.kickAudio();
    if (this.sim.run === "tutorial") beginCombat(this.sim);
  }

  /** 在用户手势回调里调用，尽量恢复 BGM。 */
  ensureAudioPlaying(): void {
    this.kickAudio();
  }

  restart(tutorial: boolean): void {
    this.reported = null;
    this.consumedAttackBeatSlots.clear();
    this.consumedSlideBeatSlots.clear();
    this.inputMarks = [];
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

  private onBeatNow(kind: "attack" | "slide"): boolean {
    const t = this.audio.timelineMs(this.sim.nowMs);
    if (!this.beat.judgmentForCombat(t, this.hudWasCombat, this.hudMs)) return false;
    const consumed = kind === "attack" ? this.consumedAttackBeatSlots : this.consumedSlideBeatSlots;
    const slot = this.beat.beatSlotKey(t, consumed);
    if (consumed.has(slot)) return false;
    return true;
  }

  private consumeBeatSlot(kind: "attack" | "slide"): void {
    const t = this.audio.timelineMs(this.sim.nowMs);
    const consumed = kind === "attack" ? this.consumedAttackBeatSlots : this.consumedSlideBeatSlots;
    const slot = this.beat.beatSlotKey(t, consumed);
    consumed.add(slot);
  }

  private recordInputMark(kind: "attack" | "slide", onBeat: boolean): void {
    const absMs = this.audio.timelineMs(this.sim.nowMs);
    this.inputMarks.push({ absMs, onBeat });
    const keepFrom = absMs - BEAT_RING_WINDOW_MS - 1500;
    while (this.inputMarks.length > 0 && this.inputMarks[0]!.absMs < keepFrom) {
      this.inputMarks.shift();
    }
    if (this.inputMarks.length > 64) {
      this.inputMarks.splice(0, this.inputMarks.length - 64);
    }

    const half = this.beat.beatWindowMs / 2;
    const offset = this.beat.beatOffsetMs(absMs);
    const beatAbs = absMs - offset;
    const zoneLo = beatAbs - half;
    const zoneHi = beatAbs + half;
    console.log(
      `[beat-hit] ${kind} 打点=${absMs.toFixed(1)}ms 最近拍=${beatAbs.toFixed(1)}ms 判定=[${zoneLo.toFixed(1)}, ${zoneHi.toFixed(1)}]ms 偏移=${offset >= 0 ? "+" : ""}${offset.toFixed(1)}ms 强普=${onBeat ? "是" : "否"}`,
    );
  }

  private syncBeatToAudio(trackId: TrackId): void {
    if (!this.audio.isUsingAudioFile(trackId)) return;
    const audioMs = this.audio.bufferDurationMs(trackId);
    if (audioMs) this.beat.syncToAudioDuration(audioMs);
  }

  private beatCue(timelineMs: number): BeatCue {
    return {
      phase01: this.beat.beatPhase01(timelineMs),
      inZone: this.beat.hudInZone(timelineMs),
      inSilverZone: this.beat.hudInSilverZone(timelineMs),
      inCombatZone: this.beat.combatBeatZone(timelineMs),
      proximity: this.beat.beatProximity(timelineMs),
      windowFrac: this.beat.hudWindowFrac(),
      silverPreFrac: this.beat.hudSilverPreFrac(),
      timelineMs,
      periodMs: this.beat.periodMs,
      loopMs: this.beat.loopMs,
      beatTimesMs: this.beat.beatTimesMs,
      beatWindowMs: this.beat.beatWindowMs,
      inputMarks: this.inputMarks,
    };
  }

  private loop(): void {
    if (this.dead || !this.app || !this.world) return;
    if (this.paused) {
      const drawT = this.audio.timelineMs(this.sim.nowMs);
      this.world.render(this.sim, this.viewW, this.viewH, this.sim.nowMs, this.beatCue(drawT));
      this.emitHud(false);
      return;
    }
    const dt = this.app.ticker.deltaMS;
    const holding = isReviveHolding(this.sim);
    if (holding) {
      this.queuedAttack = false;
      this.queuedSlide = false;
      this.queuedUlt = false;
    } else {
      if (this.queuedAttack) {
        const onBeat = this.onBeatNow("attack");
        const skill =
          onBeat && (this.sim.weaponId === 1 || this.sim.weaponId === 3)
            ? beatSkillTierAt(
                this.beat.beatSkillTiers,
                this.beat.beatSlotKey(
                  this.audio.timelineMs(this.sim.nowMs),
                  this.consumedAttackBeatSlots,
                ),
              )
            : null;
        if (doAttack(this.sim, onBeat, skill)) {
          this.recordInputMark("attack", onBeat);
          if (onBeat) this.consumeBeatSlot("attack");
        }
        this.queuedAttack = false;
      }
      if (this.queuedSlide) {
        const onBeat = this.onBeatNow("slide");
        const skill =
          onBeat && (this.sim.weaponId === 1 || this.sim.weaponId === 3)
            ? beatSkillTierAt(
                this.beat.beatSkillTiers,
                this.beat.beatSlotKey(
                  this.audio.timelineMs(this.sim.nowMs),
                  this.consumedSlideBeatSlots,
                ),
              )
            : null;
        if (doSlide(this.sim, onBeat, this.moveX, this.moveY, skill)) {
          this.recordInputMark("slide", onBeat);
          if (onBeat) this.consumeBeatSlot("slide");
        }
        this.queuedSlide = false;
      }
      if (this.queuedUlt) {
        doUltimate(this.sim);
        this.queuedUlt = false;
      }
    }
    stepSim(this.sim, dt, holding ? 0 : this.moveX, holding ? 0 : this.moveY);
    const drawT = this.audio.timelineMs(this.sim.nowMs);
    this.hudWasCombat = this.beat.combatBeatZone(drawT);
    this.hudMs = drawT;
    this.world.render(this.sim, this.viewW, this.viewH, this.sim.nowMs, this.beatCue(drawT));
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
      trackId: this.sim.trackId,
      levelId: this.sim.levelId,
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
      inSilverZone: this.beat.hudInSilverZone(t),
      inCombatZone: this.beat.combatBeatZone(t),
      beatProximity: this.beat.beatProximity(t),
      windowFrac: this.beat.hudWindowFrac(),
      silverPreFrac: this.beat.hudSilverPreFrac(),
      beatCount: this.beat.beatTimesMs.length,
      timelineMs: t,
      loopMs: this.beat.loopMs,
      beatTimesMs: this.beat.beatTimesMs,
      beatSkillTiers: this.beat.beatSkillTiers,
      inputMarks: this.inputMarks,
      ultReady: this.sim.energy >= ULTIMATE_BEAT_CHARGES,
      ultBuffRemainingMs: Math.max(0, this.sim.ultBuffUntilMs - this.sim.nowMs),
      spearUltAttacksLeft: this.sim.spearUltAttacksLeft,
      spearAtkSpeedStacks: this.sim.spearAtkSpeedStacks,
      shieldHp: this.sim.shieldHp,
      orbitSwordCount: this.sim.orbitSwords.length,
      latencyMs: this.audio.latencyMs,
      muted: this.audio.muted,
      onBeatFlash: !!this.sim.flash?.onBeat,
      paused: this.paused,
      combo: this.sim.stats.combo,
      maxCombo: this.sim.stats.maxCombo,
      reviveAvailable: this.sim.reviveAvailable,
      reviveHoldMs: reviveHoldRemainingMs(this.sim),
      reviveGraceMs: reviveGraceRemainingMs(this.sim),
      runResult,
    };
  }
}
