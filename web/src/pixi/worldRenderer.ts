import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import {
  BOSS_ATTACK_RADIUS,
  BOSS_WINDUP_MS,
  MEGABOSS_ATTACK_RADIUS,
  MEGABOSS_WINDUP_MS,
  MINION_TELEGRAPH_RADIUS,
  MINION_WINDUP_MS,
  SAMURAI_MODEL_SCALE,
  ARCHER_MODEL_SCALE,
  ATTACK_RANGE,
  SAMURAI_TORNADO_DURATION_MS,
  SAMURAI_TORNADO_SPIN_RAD_PER_MS,
  SPEAR_ARC_DEG,
  SPEAR_MODEL_SCALE,
  WORLD_H,
  WORLD_W,
} from "../game/constants";
import { cameraOrigin, attackRadius, isReviveInvulnerable, ultBuffActive } from "../game/sim";
import type { AttackFlash, BeatCue, Enemy, Sim } from "../game/types";
import { ArtBank, SPRITE_SIZE, type HeroKey, type PropKind } from "./chibiArt";
import { buildStageArt, type StageProp } from "./stageMap";

/** 烘焙贴图刀尖/锚点（与 chibiArt drawBlade/drawSpear 一致）。 */
const MELEE_ANCHOR_X = 0.14;
const BLADE_TIP_TEXTURE_X = 332 / 340;
const SPEAR_TIP_TEXTURE_X = 372 / 380;

/** 将世界攻击半径换算为未缩放前的武器 sprite 宽度，使刀尖/枪尖贴合判定圈。 */
function meleeSpriteWidth(
  worldRange: number,
  modelScale: number,
  tipTextureX: number,
  gripOffset: number,
): number {
  const tipFromAnchor = tipTextureX - MELEE_ANCHOR_X;
  const localReach = worldRange / modelScale - gripOffset;
  return Math.max(0.35, localReach / tipFromAnchor);
}

type ActorNode = {
  root: Container;
  sprite: Sprite;
  frames?: Texture[];
  hp?: Graphics;
  lastHp?: number;
  flashUntil?: number;
};

function flashProgress(flash: AttackFlash, nowMs: number): number {
  let dur = 120;
  if (flash.path && flash.path.length >= 2) {
    // 冲刺刀光：严格按 start→until，覆盖整段位移
    const startMs = flash.startMs ?? nowMs;
    const total = Math.max(1, flash.untilMs - startMs);
    return Math.max(0, Math.min(1, (nowMs - startMs) / total));
  }
  if (flash.path) dur = 160;
  else if (flash.kind === "ult" || flash.untilMs - nowMs > 125) dur = 200;
  const startMs = flash.startMs ?? flash.untilMs - dur;
  const total = Math.max(1, flash.untilMs - startMs);
  return Math.max(0, Math.min(1, (nowMs - startMs) / total));
}

/** 冲刺刀光：进度 t 时刀光中心（优先跟角色，否则起点→终点插值）。 */
function flashTravelPoint(sim: Sim, flash: AttackFlash, t: number): { x: number; y: number } {
  if (flash.path && flash.path.length >= 2) {
    // 冲刺中紧跟角色，避免线性插值跟不上缓动位移
    if (sim.nowMs < sim.slideUntil) {
      return { x: sim.player.x, y: sim.player.y };
    }
    const a = flash.path[0]!;
    const b = flash.path[flash.path.length - 1]!;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return { x: flash.x, y: flash.y };
}

function strokeArc(
  g: Graphics,
  x: number,
  y: number,
  r: number,
  a0: number,
  a1: number,
  color: number,
  width: number,
  alpha: number,
): void {
  g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
  g.arc(x, y, r, a0, a1);
  g.stroke({ width, color, alpha, cap: "round" });
}

export class WorldRenderer {
  readonly world = new Container();
  private ground = new Sprite();
  private glow = new Graphics();
  private groundFx = new Graphics();
  private objects = new Container();
  private airFx = new Graphics();
  private popupLayer = new Container();
  private art: ArtBank;
  private stageTexDestroy: () => void;
  private enemyNodes = new Map<number, ActorNode>();
  private cloneNodes = new Map<number, ActorNode>();
  private bulletGfx = new Map<number, Graphics>();
  private orbitSwordGfx = new Map<number, Container>();
  private tornadoGfx = new Map<number, Graphics>();
  private propSprites: Sprite[] = [];
  private obstaclePropLinks: { obstacleId: number; sprite: Sprite }[] = [];
  private destructibleSprites = new Map<number, Sprite>();
  private obstacleLinksReady = false;
  private playerNode: ActorNode;
  private playerPose: Container;
  private melee: Sprite;
  private lastEnemyPos = new Map<number, { x: number; y: number; kind: Enemy["kind"] }>();
  private puffs: { x: number; y: number; until: number }[] = [];
  private sparks: { x: number; y: number; until: number }[] = [];
  private starBits: { x: number; y: number; vx: number; vy: number; until: number; born: number }[] = [];
  private pinkSplats: { x: number; y: number; vx: number; vy: number; until: number; born: number; size: number }[] = [];
  private slideTrail: { x: number; y: number; until: number }[] = [];
  private lastSparkleFlashKey = "";
  private lamps: { x: number; y: number }[] = [];
  private popupTexts = new Map<number, Text>();
  private lastPlayerX = WORLD_W / 2;
  private lastPlayerY = WORLD_H / 2;
  private lastCell = 1;
  private ready = false;

  constructor(private app: Application) {
    this.art = new ArtBank();
    const stage = buildStageArt();
    this.stageTexDestroy = () => stage.texture.destroy(true);
    this.ground.texture = stage.texture;
    this.ground.width = WORLD_W;
    this.ground.height = WORLD_H;
    this.lamps = stage.lamps;
    this.objects.sortableChildren = true;
    this.world.addChild(this.ground, this.glow, this.groundFx, this.objects, this.airFx, this.popupLayer);
    this.app.stage.addChild(this.world);

    this.playerNode = this.makeActor(this.art.hero["hero-1"][0]!, SPRITE_SIZE.hero.w, SPRITE_SIZE.hero.h, this.art.hero["hero-1"]);
    this.playerPose = new Container();
    this.playerNode.root.removeChild(this.playerNode.sprite);
    this.playerPose.addChild(this.playerNode.sprite);
    this.melee = new Sprite(this.art.blade);
    this.melee.anchor.set(0.14, 0.5);
    this.playerPose.addChild(this.melee);
    this.playerNode.root.addChild(this.playerPose);
    this.objects.addChild(this.playerNode.root);
    this.placeProps(stage.props);
    this.ready = true;
  }

  render(sim: Sim, viewW: number, viewH: number, nowMs: number, beatCue?: BeatCue): void {
    if (!this.ready) return;
    const { width, height } = this.app.renderer;
    const cell = Math.min(width / viewW, height / viewH);
    this.lastCell = cell;
    const cam = cameraOrigin(sim.player.x, sim.player.y, viewW, viewH);
    const ox = (width - viewW * cell) / 2;
    const oy = (height - viewH * cell) / 2;
    const sh = sim.shake;
    const sx = sh ? Math.sin(nowMs * 0.05) * sh : 0;
    const sy = sh ? Math.cos(nowMs * 0.063) * sh : 0;
    this.world.scale.set(cell);
    this.world.position.set(ox - cam.x * cell + sx, oy - cam.y * cell + sy);

    this.drawLamps(nowMs);
    this.drawGroundFx(sim);
    this.drawExplosions(sim, nowMs);
    this.drawShockWaves(sim);
    this.syncObstacles(sim, nowMs);
    this.syncDeaths(sim, nowMs);
    this.syncEnemies(sim, nowMs);
    this.drawEnemyTelegraphs(sim, nowMs);
    this.syncClones(sim, nowMs);
    this.syncBullets(sim);
    this.syncOrbitSwords(sim, nowMs);
    this.syncTornados(sim, nowMs);
    this.drawPlayer(sim, nowMs);
    this.drawDamagePopups(sim, nowMs);
    this.drawAirFx(sim, nowMs, viewW, viewH, beatCue);
  }

  private drawDamagePopups(sim: Sim, nowMs: number): void {
    const live = new Set(sim.damagePopups.map((p) => p.id));
    for (const [id, node] of this.popupTexts) {
      if (!live.has(id)) {
        node.destroy();
        this.popupTexts.delete(id);
      }
    }
    const inv = 1 / Math.max(this.lastCell, 1e-6);
    const lifeMs = 420;
    for (const p of sim.damagePopups) {
      let node = this.popupTexts.get(p.id);
      if (!node) {
        node = new Text({
          text: p.crit ? `${p.amount}!` : String(p.amount),
          style: {
            fontFamily: "Consolas, monospace",
            fontSize: p.crit ? 11 : 9,
            fontWeight: "600",
            fill: p.crit ? 0xffe878 : 0xfff0e0,
            stroke: { color: 0x2a1c14, width: 2 },
          },
        });
        node.anchor.set(0.5, 0.5);
        this.popupLayer.addChild(node);
        this.popupTexts.set(p.id, node);
      }
      const t = 1 - (p.untilMs - nowMs) / lifeMs;
      node.position.set(p.x, p.y - t * 0.28);
      node.alpha = Math.max(0, 1 - t * 0.92);
      node.scale.set(inv);
    }
  }

  private placeProps(props: StageProp[]): void {
    for (const p of props) {
      const tex = this.art.props[p.kind];
      const size = SPRITE_SIZE[p.kind as PropKind];
      const s = new Sprite(tex);
      s.anchor.set(0.5, 0.9);
      s.width = size.w;
      s.height = size.h;
      s.position.set(p.x, p.y);
      s.zIndex = p.y;
      this.objects.addChild(s);
      this.propSprites.push(s);
    }
  }

  private makeActor(tex: Texture, w: number, h: number, frames?: Texture[]): ActorNode {
    const root = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.88);
    sprite.width = w;
    sprite.height = h;
    root.addChild(sprite);
    return { root, sprite, frames };
  }

  private face(sprite: Sprite, w: number, h: number, facingX: number): void {
    sprite.width = w;
    sprite.height = h;
    sprite.scale.x = Math.abs(sprite.scale.x) * (facingX < -0.12 ? -1 : 1);
  }

  private drawLamps(nowMs: number): void {
    const g = this.glow;
    g.clear();
    const pulse = 0.16 + 0.09 * (0.5 + 0.5 * Math.sin(nowMs * 0.004));
    for (const lamp of this.lamps) {
      g.ellipse(lamp.x, lamp.y - 0.12, 1.25, 0.85);
      g.fill({ color: 0xffe08a, alpha: pulse });
    }
  }

  private drawGroundFx(sim: Sim): void {
    const g = this.groundFx;
    g.clear();
    const flash = sim.flash;
    if (!flash) return;
    if (sim.weaponId === 3 && flash.kind === "circle") return;
    const enhanced = flash.onBeat;
    const samuraiBlue = sim.weaponId === 1;
    const color =
      flash.kind === "line" && ultBuffActive(sim)
        ? 0xffc85a
        : flash.kind === "ult"
          ? 0xff6a3c
          : samuraiBlue
            ? enhanced
              ? 0xb8e8ff
              : 0x7ec8ff
            : enhanced
              ? 0xffe08a
              : 0x9ad4ff;
    const hot = samuraiBlue ? (enhanced ? 0xe8f6ff : color) : enhanced ? 0xfff6c8 : color;
    const t = flashProgress(flash, sim.nowMs);
    const stamp = (x: number, y: number, r: number) => {
      if (enhanced) {
        g.ellipse(x, y + 0.14, r * 0.92, r * 0.32);
        g.fill({
          color: samuraiBlue ? 0x6ab4ff : 0xffb14a,
          alpha: 0.16 * (1 - t * 0.35),
        });
        g.circle(x, y, r * (0.55 + t * 0.5));
        g.stroke({ width: 0.14, color: hot, alpha: 0.42 * (1 - t * 0.5) });
        g.circle(x, y, r * (0.28 + t * 0.35));
        g.stroke({ width: 0.07, color: 0xffffff, alpha: 0.28 * (1 - t * 0.4) });
      } else {
        g.ellipse(x, y + 0.14, r * 0.72, r * 0.22);
        g.fill({ color, alpha: 0.1 });
      }
      const facing = Math.atan2(flash.facingY, flash.facingX);
      if (flash.kind === "line") {
        const len = r * t;
        const x1 = x + Math.cos(facing) * len;
        const y1 = y + Math.sin(facing) * len;
        const wMain = ultBuffActive(sim) ? 0.28 : enhanced ? 0.26 : 0.16;
        g.moveTo(x, y);
        g.lineTo(x1, y1);
        g.stroke({ width: wMain, color, alpha: enhanced ? 0.88 : 0.72, cap: "round" });
        if (enhanced || ultBuffActive(sim)) {
          g.moveTo(x, y);
          g.lineTo(x1, y1);
          g.stroke({ width: wMain * 1.55, color: hot, alpha: 0.28, cap: "round" });
          g.circle(x1, y1, (enhanced ? 0.28 : 0.18) * (1 - t * 0.35));
          g.fill({ color: samuraiBlue ? 0xd8f0ff : 0xfff0a8, alpha: enhanced ? 0.72 : 0.55 });
          if (enhanced) {
            g.circle(x1, y1, 0.12 * (1 - t * 0.2));
            g.fill({ color: 0xffffff, alpha: 0.85 });
          }
        }
        g.moveTo(x + Math.cos(facing) * len * 0.15, y + Math.sin(facing) * len * 0.15);
        g.lineTo(x1, y1);
        g.stroke({ width: enhanced ? 0.12 : 0.08, color, alpha: enhanced ? 0.5 : 0.35, cap: "round" });
      } else if (flash.kind === "arc" || flash.kind === "semicircle") {
        const arcDeg = flash.arcDeg ?? (flash.kind === "semicircle" ? 180 : SPEAR_ARC_DEG);
        const arcRad = (arcDeg * Math.PI) / 180;
        const a0 = facing - (arcRad / 2) * t;
        const a1 = facing + (arcRad / 2) * t;
        if (enhanced) {
          // 扇面填充，强普更厚实
          g.moveTo(x, y);
          g.arc(x, y, r * 0.96, a0, a1);
          g.closePath();
          g.fill({ color: 0xffb14a, alpha: 0.22 * (1 - t * 0.3) });
          strokeArc(g, x, y, r, a0, a1, hot, 0.22, 0.82);
          strokeArc(g, x, y, r * 0.86, a0, a1, color, 0.14, 0.62);
          strokeArc(g, x, y, r * 0.7, a0, a1, 0xffffff, 0.08, 0.4);
        } else {
          strokeArc(g, x, y, r, a0, a1, color, 0.13, 0.55);
          strokeArc(g, x, y, r * 0.78, a0, a1, color, 0.07, 0.32);
        }
      } else if (flash.kind === "ult") {
        const spin = facing + t * Math.PI * 2 * 1.8;
        strokeArc(g, x, y, r * (0.55 + t * 0.55), spin - 1.35, spin, color, 0.18, 0.62);
        strokeArc(g, x, y, r * (0.35 + t * 0.45), spin + 0.4, spin + 2.4, color, 0.1, 0.38);
        g.circle(x, y, r * (0.2 + t * 0.35));
        g.stroke({ width: 0.1, color: 0xfff0a8, alpha: 0.45 * (1 - t * 0.4) });
      } else if (enhanced) {
        const spin = facing + t * Math.PI * 2;
        g.moveTo(x, y);
        g.arc(x, y, r * 0.95, spin - 1.45, spin + 0.15);
        g.closePath();
        g.fill({
          color: samuraiBlue ? 0x5aa8ff : 0xffb14a,
          alpha: 0.2 * (1 - t * 0.25),
        });
        strokeArc(g, x, y, r, spin - 1.35, spin + 0.08, hot, 0.24, 0.85);
        strokeArc(g, x, y, r * 0.88, spin - 1.15, spin, color, 0.16, 0.7);
        strokeArc(g, x, y, r * 0.72, spin - 0.95, spin - 0.05, 0xffffff, 0.09, 0.45);
        g.circle(x + Math.cos(spin) * r * 0.9, y + Math.sin(spin) * r * 0.9, 0.22 * (1 - t * 0.3));
        g.fill({ color: hot, alpha: 0.75 });
      } else {
        const spin = facing + t * Math.PI * 2;
        strokeArc(g, x, y, r, spin - 1.15, spin, color, 0.14, 0.5);
        strokeArc(g, x, y, r * 0.82, spin - 0.85, spin, color, 0.08, 0.28);
      }
    };
    if (flash.path && flash.path.length >= 2) {
      const pos = flashTravelPoint(sim, flash, t);
      stamp(pos.x, pos.y, flash.radius);
    } else if (flash.path) {
      for (const p of flash.path) stamp(p.x, p.y, flash.radius);
    } else {
      stamp(flash.x, flash.y, flash.radius);
    }
  }

  private drawExplosions(sim: Sim, nowMs: number): void {
    for (const ex of sim.explosions) {
      const left = ex.untilMs - nowMs;
      if (left <= 0) continue;
      const life = ex.enhanced ? 280 : 240;
      const t = 1 - left / life;
      const g = this.groundFx;
      const r = ex.radius * (0.35 + t * 0.85) * (ex.enhanced ? 1.12 : 1);
      if (ex.enhanced) {
        g.circle(ex.x, ex.y, r * 1.15);
        g.stroke({ width: 0.18, color: 0xffe08a, alpha: 0.55 * (1 - t * 0.65) });
        g.circle(ex.x, ex.y, r);
        g.stroke({ width: 0.14, color: 0xff8844, alpha: 0.85 * (1 - t * 0.7) });
        g.circle(ex.x, ex.y, r * 0.62);
        g.fill({ color: 0xffaa44, alpha: 0.5 * (1 - t) });
        g.circle(ex.x, ex.y - 0.08, r * 0.3);
        g.fill({ color: 0xfff2c8, alpha: 0.78 * (1 - t) });
        g.circle(ex.x, ex.y - 0.1, r * 0.14);
        g.fill({ color: 0xffffff, alpha: 0.7 * (1 - t) });
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + t * 0.8;
          const len = r * (0.55 + t * 0.35);
          g.moveTo(ex.x, ex.y);
          g.lineTo(ex.x + Math.cos(ang) * len, ex.y + Math.sin(ang) * len);
          g.stroke({ width: 0.07, color: 0xfff0a8, alpha: 0.4 * (1 - t), cap: "round" });
        }
      } else {
        g.circle(ex.x, ex.y, r);
        g.stroke({ width: 0.12, color: 0xff8844, alpha: 0.75 * (1 - t * 0.7) });
        g.circle(ex.x, ex.y, r * 0.55);
        g.fill({ color: 0xffaa44, alpha: 0.42 * (1 - t) });
        g.circle(ex.x, ex.y - 0.08, r * 0.22);
        g.fill({ color: 0xfff2c8, alpha: 0.65 * (1 - t) });
      }
    }
  }

  private drawShockWaves(sim: Sim): void {
    const g = this.groundFx;
    for (const w of sim.shockWaves) {
      if (!w.active || w.radius <= 0.05) continue;
      const life = 1 - w.radius / Math.max(w.maxRadius, 1e-6);
      const alpha = 0.25 + life * 0.45;
      g.circle(w.x, w.y, w.radius);
      g.stroke({ width: 0.22, color: 0xc8a8ff, alpha });
      g.circle(w.x, w.y, w.radius * 0.92);
      g.stroke({ width: 0.1, color: 0xfff2a8, alpha: alpha * 0.85 });
      const jag = 10;
      for (let i = 0; i < jag; i++) {
        const a0 = (i / jag) * Math.PI * 2;
        const a1 = a0 + Math.PI / jag;
        const r0 = w.radius * 0.78;
        const r1 = w.radius * 1.02;
        g.moveTo(w.x + Math.cos(a0) * r0, w.y + Math.sin(a0) * r0);
        g.lineTo(w.x + Math.cos(a1) * r1, w.y + Math.sin(a1) * r1);
        g.stroke({ width: 0.06, color: 0xe8d4ff, alpha: alpha * 0.7, cap: "round" });
      }
    }
  }

  private propKindForObstacle(kind: string): PropKind {
    if (kind === "lantern") return "lamp";
    if (kind === "grave") return "grave";
    if (kind === "crate" || kind === "barrel") return "crate";
    if (kind === "pillar") return "crate";
    return "stone";
  }

  private linkObstacleProps(sim: Sim): void {
    if (this.obstacleLinksReady) return;
    for (const o of sim.obstacles) {
      if (!o.destructible) continue;
      let best: Sprite | null = null;
      let bestD = 0.45;
      for (const spr of this.propSprites) {
        const d = Math.hypot(spr.x - o.x, spr.y - o.y);
        if (d < bestD) {
          bestD = d;
          best = spr;
        }
      }
      if (best) this.obstaclePropLinks.push({ obstacleId: o.id, sprite: best });
    }
    this.obstacleLinksReady = true;
  }

  private syncObstacles(sim: Sim, nowMs: number): void {
    this.linkObstacleProps(sim);
    for (const link of this.obstaclePropLinks) {
      const o = sim.obstacles.find((x) => x.id === link.obstacleId);
      if (!o || (o.destructible && (o.hp ?? 0) <= 0)) {
        if (link.sprite.visible) {
          link.sprite.visible = false;
          this.puffs.push({ x: link.sprite.x, y: link.sprite.y, until: nowMs + 360 });
          this.sparks.push({ x: link.sprite.x, y: link.sprite.y, until: nowMs + 220 });
        }
      } else if (o.maxHp && o.hp != null && o.hp < o.maxHp) {
        link.sprite.alpha = 0.55 + 0.45 * (o.hp / o.maxHp);
        link.sprite.rotation = Math.sin(nowMs * 0.02 + o.id) * 0.04;
      }
    }
    for (const o of sim.obstacles) {
      if (!o.destructible || (o.hp ?? 0) <= 0) continue;
      if (this.obstaclePropLinks.some((l) => l.obstacleId === o.id)) continue;
      let spr = this.destructibleSprites.get(o.id);
      if (!spr) {
        const kind = this.propKindForObstacle(o.kind);
        const size = SPRITE_SIZE[kind as PropKind];
        spr = new Sprite(this.art.props[kind]);
        spr.anchor.set(0.5, 0.9);
        spr.width = size.w;
        spr.height = size.h;
        spr.position.set(o.x, o.y);
        spr.zIndex = o.y;
        this.objects.addChild(spr);
        this.destructibleSprites.set(o.id, spr);
      }
      spr.visible = true;
      spr.alpha = o.maxHp && o.hp != null ? 0.55 + 0.45 * (o.hp / o.maxHp) : 1;
      spr.position.set(o.x, o.y);
      spr.zIndex = o.y;
    }
    for (const [id, spr] of this.destructibleSprites) {
      const o = sim.obstacles.find((x) => x.id === id);
      if (!o || (o.destructible && (o.hp ?? 0) <= 0)) {
        spr.visible = false;
      }
    }
    for (const br of sim.propBreaks) {
      const left = br.untilMs - nowMs;
      if (left <= 0) continue;
      const t = 1 - left / 340;
      const g = this.groundFx;
      const spread = 0.25 + t * 0.55;
      g.rect(br.x - spread, br.y - spread * 0.35, spread * 2, spread * 0.7);
      g.fill({ color: 0x8a6e52, alpha: 0.35 * (1 - t) });
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + t;
        g.moveTo(br.x, br.y);
        g.lineTo(br.x + Math.cos(ang) * spread, br.y + Math.sin(ang) * spread * 0.5);
        g.stroke({ width: 0.06, color: 0xd4b892, alpha: 0.4 * (1 - t), cap: "round" });
      }
    }
  }

  private spawnSamuraiHitSplash(x: number, y: number, nowMs: number, count = 12): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 3) * 0.27;
      const speed = 1.6 + (i % 5) * 0.55;
      this.pinkSplats.push({
        x: x + Math.cos(a) * 0.08,
        y: y - 0.15 + Math.sin(a) * 0.08,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 0.8,
        until: nowMs + 280 + (i % 4) * 35,
        born: nowMs,
        size: 0.07 + (i % 3) * 0.025,
      });
    }
  }

  private syncDeaths(sim: Sim, nowMs: number): void {
    const live = new Set(sim.enemies.map((e) => e.id));
    for (const [id, pos] of this.lastEnemyPos) {
      if (!live.has(id)) {
        this.puffs.push({ x: pos.x, y: pos.y, until: nowMs + 280 });
        if (sim.weaponId === 1) this.spawnSamuraiHitSplash(pos.x, pos.y, nowMs, 16);
        this.lastEnemyPos.delete(id);
      }
    }
    this.puffs = this.puffs.filter((p) => nowMs < p.until);
  }

  private syncEnemies(sim: Sim, nowMs: number): void {
    const live = new Set(sim.enemies.map((e) => e.id));
    for (const [id, node] of this.enemyNodes) {
      if (!live.has(id)) {
        node.root.destroy({ children: true });
        this.enemyNodes.delete(id);
      }
    }
    for (const e of sim.enemies) {
      let node = this.enemyNodes.get(e.id);
      const isMegaboss = e.kind === "megaboss";
      const isBoss = e.kind === "boss" || isMegaboss;
      const size = isMegaboss ? SPRITE_SIZE.megaboss : isBoss ? SPRITE_SIZE.boss : SPRITE_SIZE.minion;
      const zombieFrames = isMegaboss || isBoss ? undefined : this.art.zombie[`zombie-${(e.id % 4) as 0 | 1 | 2 | 3}`];
      if (!node) {
        const tex = isMegaboss
          ? this.art.megaboss
          : isBoss
            ? this.art.boss[e.id % 2 === 0 ? "boss-0" : "boss-1"]
            : zombieFrames![0]!;
        node = this.makeActor(tex, size.w, size.h, zombieFrames);
        if (isBoss) {
          node.hp = new Graphics();
          node.root.addChild(node.hp);
        }
        this.enemyNodes.set(e.id, node);
        this.objects.addChild(node.root);
      }
      const prev = this.lastEnemyPos.get(e.id);
      this.face(node.sprite, size.w, size.h, sim.player.x - e.x);
      const bob = Math.sin(nowMs * 0.008 + e.id) * 0.045;
      node.sprite.y = bob;
      const moving = prev ? Math.hypot(e.x - prev.x, e.y - prev.y) > 0.002 : false;
      if (node.frames && !isBoss) {
        const frame = moving ? 1 + (Math.floor(nowMs / 110) % 2) : 0;
        node.sprite.texture = node.frames[frame]!;
        this.face(node.sprite, size.w, size.h, sim.player.x - e.x);
      }
      if (node.lastHp != null && e.hp < node.lastHp) {
        node.flashUntil = nowMs + 180;
        this.sparks.push({ x: e.x, y: e.y, until: nowMs + 180 });
        if (sim.weaponId === 1) this.spawnSamuraiHitSplash(e.x, e.y, nowMs);
      }
      node.lastHp = e.hp;
      const slowed = nowMs < (e.slowUntilMs ?? 0);
      const stunned = nowMs < (e.stunUntilMs ?? 0);
      node.sprite.tint =
        nowMs < (node.flashUntil ?? 0)
          ? 0xff9a9a
          : stunned
            ? 0xe8d4ff
            : slowed
              ? 0xa8d0f0
              : isMegaboss
                ? 0xffe8c8
                : 0xffffff;
      node.sprite.rotation = moving ? Math.sin(nowMs * 0.02 + e.id) * 0.05 : 0;
      node.root.position.set(e.x, e.y);
      node.root.zIndex = e.y;
      this.lastEnemyPos.set(e.id, { x: e.x, y: e.y, kind: e.kind });
      if (node.hp) {
        const frac = e.hp / e.maxHp;
        node.hp.clear();
        node.hp.ellipse(0, -size.h * 0.9, 0.72, 0.09);
        node.hp.fill({ color: 0x3a2018, alpha: 0.8 });
        node.hp.ellipse(0, -size.h * 0.9, 0.66 * frac, 0.06);
        node.hp.fill(frac > 0.45 ? 0x7ec86a : 0xff6b6b);
      }
    }
  }

  private syncClones(sim: Sim, nowMs: number): void {
    const live = new Set(sim.clones.map((c) => c.id));
    for (const [id, node] of this.cloneNodes) {
      if (!live.has(id)) {
        node.root.destroy({ children: true });
        this.cloneNodes.delete(id);
      }
    }
    for (const c of sim.clones) {
      let node = this.cloneNodes.get(c.id);
      if (!node) {
        node = this.makeActor(this.art.clone, SPRITE_SIZE.clone.w, SPRITE_SIZE.clone.h);
        node.sprite.alpha = 0.88;
        this.cloneNodes.set(c.id, node);
        this.objects.addChild(node.root);
        this.puffs.push({ x: c.x, y: c.y, until: nowMs + 420 });
        this.sparks.push({ x: c.x, y: c.y, until: nowMs + 320 });
      }
      const cloneScale = ARCHER_MODEL_SCALE * (SPRITE_SIZE.hero.w / SPRITE_SIZE.clone.w);
      this.face(
        node.sprite,
        SPRITE_SIZE.clone.w * cloneScale,
        SPRITE_SIZE.clone.h * cloneScale,
        sim.player.facingX,
      );
      node.sprite.y = Math.sin(nowMs * 0.01 + c.id) * 0.06;
      node.sprite.tint = nowMs - c.lastHurtMs < 180 ? 0xffaaaa : 0xffffff;
      node.root.position.set(c.x, c.y);
      node.root.zIndex = c.y;
    }
  }

  private syncBullets(sim: Sim): void {
    const live = new Set(sim.bullets.map((b) => b.id));
    for (const [id, gfx] of this.bulletGfx) {
      if (!live.has(id)) {
        gfx.destroy();
        this.bulletGfx.delete(id);
      }
    }
    for (const b of sim.bullets) {
      let gfx = this.bulletGfx.get(b.id);
      if (!gfx) {
        gfx = new Graphics();
        this.bulletGfx.set(b.id, gfx);
        this.objects.addChild(gfx);
      }
      gfx.clear();
      if (b.team === "enemy") {
        gfx.visible = true;
        const color = 0xff4466;
        gfx.circle(0, 0, b.r * 1.1);
        gfx.fill({ color, alpha: 0.85 });
        gfx.circle(0, 0, b.r * 0.45);
        gfx.fill({ color: 0xffaab8, alpha: 0.9 });
        gfx.moveTo(-b.r * 1.6, 0);
        gfx.lineTo(-b.r * 0.2, 0);
        gfx.stroke({ width: 0.06, color: 0xff8899, alpha: 0.55, cap: "round" });
      } else if (b.style === "swordWave") {
        if (b.wakeAtMs !== undefined && sim.nowMs < b.wakeAtMs) {
          gfx.visible = false;
          continue;
        }
        gfx.visible = true;
        const halfW = Math.min(b.r, 5);
        const outer = halfW * 0.95;
        const inner = halfW * 0.52;
        // 朝飞行方向开口的蓝色半月
        gfx.moveTo(0, -outer);
        gfx.arc(0, 0, outer, -Math.PI / 2, Math.PI / 2);
        gfx.arc(outer * 0.28, 0, inner, Math.PI / 2, -Math.PI / 2, true);
        gfx.closePath();
        gfx.fill({ color: 0x6ab8ff, alpha: 0.55 });
        gfx.moveTo(0, -outer * 0.92);
        gfx.arc(0, 0, outer * 0.92, -Math.PI / 2, Math.PI / 2);
        gfx.stroke({ width: 0.18, color: 0xb8e8ff, alpha: 0.9, cap: "round" });
        gfx.moveTo(outer * 0.05, -outer * 0.55);
        gfx.arc(0, 0, outer * 0.72, -Math.PI / 2.4, Math.PI / 2.4);
        gfx.stroke({ width: 0.08, color: 0xffffff, alpha: 0.75, cap: "round" });
      } else if (b.style === "lightningBolt") {
        gfx.visible = true;
        const core = 0xfff2a8;
        const edge = 0xffcc44;
        const len = b.r * 1.15;
        const w = b.r * 0.28;
        gfx.moveTo(-len, 0);
        gfx.lineTo(-len * 0.2, -w);
        gfx.lineTo(len, 0);
        gfx.lineTo(-len * 0.2, w);
        gfx.closePath();
        gfx.fill({ color: edge, alpha: 0.88 });
        gfx.moveTo(-len * 0.85, 0);
        gfx.lineTo(len * 0.9, 0);
        gfx.stroke({ width: Math.max(0.12, b.r * 0.18), color: core, alpha: 0.95, cap: "round" });
        gfx.circle(len * 0.45, 0, b.r * 0.42);
        gfx.fill({ color: 0xffffff, alpha: 0.85 });
        gfx.circle(0, 0, b.r * 0.55);
        gfx.stroke({ width: 0.1, color: 0xe8d4ff, alpha: 0.55 });
      } else {
        gfx.visible = true;
        const ice = b.style === "iceArrow";
        const blue = ice ? 0x7ec8ff : 0x9ad4ff;
        const blueShaft = ice ? 0xe8f8ff : 0xc8e8ff;
        const color = ice ? 0x6ab8ff : b.explosive ? 0xff8844 : blue;
        const shaft = ice ? blueShaft : b.explosive ? 0xffc06a : blueShaft;
        // 普攻蓝箭更细；卡拍爆裂箭保持粗实；寒冰箭偏青白
        const thin = !b.explosive;
        const headW = b.r * (thin ? 0.16 : 0.32);
        const headL = b.r * (thin ? 1.75 : 1.55);
        const tailL = b.r * (thin ? 1.85 : 1.65);
        const shaftH = b.r * (thin ? 0.07 : 0.2);
        gfx.moveTo(-tailL, 0);
        gfx.lineTo(headL, -headW);
        gfx.lineTo(headL + b.r * (thin ? 0.22 : 0.35), 0);
        gfx.lineTo(headL, headW);
        gfx.closePath();
        gfx.fill(color);
        gfx.rect(-tailL, -shaftH * 0.5, tailL + headL * 0.7, shaftH);
        gfx.fill(shaft);
        if (ice) {
          gfx.circle(headL * 0.5, 0, b.r * 0.32);
          gfx.fill({ color: 0xffffff, alpha: 0.7 });
        } else if (b.explosive) {
          gfx.circle(headL * 0.55, 0, b.r * 0.38);
          gfx.fill({ color: 0xfff0a0, alpha: 0.75 });
        } else if (b.enhanced) {
          gfx.moveTo(-tailL * 0.85, 0);
          gfx.lineTo(headL + b.r * 0.2, 0);
          gfx.stroke({ width: 0.04, color: 0xe8f4ff, alpha: 0.7, cap: "round" });
        }
      }
      gfx.position.set(b.x, b.y);
      gfx.zIndex = b.y + 0.2;
      gfx.rotation = Math.atan2(b.uy, b.ux);
    }
  }

  private syncOrbitSwords(sim: Sim, nowMs: number): void {
    const live = new Set(sim.orbitSwords.map((s) => s.id));
    for (const [id, root] of this.orbitSwordGfx) {
      if (!live.has(id)) {
        root.destroy({ children: true });
        this.orbitSwordGfx.delete(id);
      }
    }
    const modelScale = SAMURAI_MODEL_SCALE;
    // 手上武士刀尺寸的 2 倍
    const orbitScale = modelScale * 2;
    const grip = 0.33;
    const localW = meleeSpriteWidth(ATTACK_RANGE, modelScale, BLADE_TIP_TEXTURE_X, grip);
    const localH = 0.32 / modelScale;
    for (const s of sim.orbitSwords) {
      let root = this.orbitSwordGfx.get(s.id);
      if (!root) {
        root = new Container();
        const spr = new Sprite(this.art.blade);
        spr.anchor.set(MELEE_ANCHOR_X, 0.5);
        spr.width = localW;
        spr.height = localH;
        root.addChild(spr);
        root.scale.set(orbitScale);
        this.orbitSwordGfx.set(s.id, root);
        this.objects.addChild(root);
      }
      const spr = root.children[0] as Sprite;
      spr.width = localW;
      spr.height = localH;
      const life = Math.max(0.35, Math.min(1, (s.untilMs - nowMs) / 8000));
      const pulse = 0.9 + 0.1 * Math.sin(nowMs * 0.02 + s.id);
      root.alpha = 0.9 * life * pulse;
      root.position.set(s.x, s.y);
      root.zIndex = s.y + 0.35;
      root.rotation = s.angle + Math.PI / 2;
      root.scale.set(orbitScale);
    }
  }

  private syncTornados(sim: Sim, nowMs: number): void {
    const live = new Set(sim.tornados.map((t) => t.id));
    for (const [id, gfx] of this.tornadoGfx) {
      if (!live.has(id)) {
        gfx.destroy();
        this.tornadoGfx.delete(id);
      }
    }
    for (const t of sim.tornados) {
      let gfx = this.tornadoGfx.get(t.id);
      if (!gfx) {
        gfx = new Graphics();
        this.tornadoGfx.set(t.id, gfx);
        this.objects.addChild(gfx);
      }
      gfx.clear();
      const spin = nowMs * SAMURAI_TORNADO_SPIN_RAD_PER_MS + t.id;
      const r = t.r;
      const h = r * (t.seeking ? 0.55 : 1.15);
      gfx.ellipse(0, 0.08, r * 1.15, r * 0.35);
      gfx.fill({ color: 0x4a90ff, alpha: 0.22 });
      for (let i = 0; i < 3; i++) {
        const a0 = spin + (i / 3) * Math.PI * 2;
        const a1 = a0 + 1.4;
        gfx.moveTo(Math.cos(a0) * r * 0.25, -h * 0.15);
        gfx.arc(0, -h * 0.05, r * (0.65 + i * 0.12), a0, a1);
        gfx.stroke({ width: 0.1 + i * 0.03, color: i === 1 ? 0xe8f4ff : 0x7ec8ff, alpha: 0.75 - i * 0.12 });
      }
      gfx.ellipse(0, -h * 0.55, r * 0.45, r * 0.18);
      gfx.fill({ color: 0xffffff, alpha: 0.35 });
      if (!t.seeking) {
        const life = Math.max(0, Math.min(1, (t.untilMs - nowMs) / SAMURAI_TORNADO_DURATION_MS));
        gfx.circle(0, 0, r * (0.9 + (1 - life) * 0.2));
        gfx.stroke({ width: 0.08, color: 0xb8e8ff, alpha: 0.45 * life });
      }
      gfx.position.set(t.x, t.y);
      gfx.zIndex = t.y + 0.4;
    }
  }

  private drawPlayer(sim: Sim, nowMs: number): void {
    const p = sim.player;
    const node = this.playerNode;
    const key: HeroKey = `hero-${sim.weaponId}`;
    const frames = this.art.hero[key];
    const moving = Math.hypot(p.x - this.lastPlayerX, p.y - this.lastPlayerY) > 0.002;
    const frame = moving ? 1 + (Math.floor(nowMs / 95) % 2) : 0;
    const tex = frames[frame]!;
    if (node.sprite.texture !== tex) {
      node.sprite.texture = tex;
    }
    node.sprite.width = SPRITE_SIZE.hero.w;
    node.sprite.height = SPRITE_SIZE.hero.h;
    this.lastPlayerX = p.x;
    this.lastPlayerY = p.y;
    const sliding = sim.nowMs < sim.slideUntil;
    const bob = sliding ? 0 : Math.sin(nowMs * 0.012) * 0.04;
    const lean = sliding ? 0.13 : moving ? Math.sin(nowMs * 0.012) * 0.05 : 0;
    this.playerPose.y = bob;
    const modelScale =
      sim.weaponId === 1
        ? SAMURAI_MODEL_SCALE
        : sim.weaponId === 2
          ? SPEAR_MODEL_SCALE
          : ARCHER_MODEL_SCALE;
    const flip = p.facingX < -0.12 ? -1 : 1;
    this.playerPose.scale.set(flip * modelScale, modelScale);
    this.playerPose.rotation = p.facingX < -0.12 ? -lean : lean;
    if (sliding) this.slideTrail.push({ x: p.x, y: p.y, until: nowMs + 170 });
    const hurt = nowMs - sim.lastHurtMs < 180;
    const reviveGrace = isReviveInvulnerable(sim);
    const ultFx = sim.ultFxUntilMs > nowMs;
    node.sprite.tint = hurt
      ? 0xff8a8a
      : reviveGrace
        ? 0xc8f0ff
        : ultFx
          ? 0xffc878
          : ultBuffActive(sim)
            ? 0xffe08a
            : 0xffffff;
    node.sprite.alpha = reviveGrace ? (Math.floor(nowMs / 80) % 2 === 0 ? 0.55 : 0.95) : 1;
    this.syncMelee(sim);
    node.root.position.set(p.x, p.y);
    node.root.zIndex = p.y + 0.05;
  }

  /**
   * 节拍进度已改回顶端条状 HUD；场景内不再画圆环。
   */
  private drawBeatCue(
    _sim: Sim,
    _nowMs: number,
    _viewW: number,
    _viewH: number,
    _cue: BeatCue | undefined,
    _g: Graphics,
  ): void {
    /* no-op */
  }

  private syncMelee(sim: Sim): void {
    const melee = this.melee;
    const flash = sim.flash;
    if (sim.weaponId === 3) {
      melee.texture = this.art.bow;
      melee.visible = true;
      melee.anchor.set(0.55, 0.5);
      melee.width = 0.72 / ARCHER_MODEL_SCALE;
      melee.height = 1.22 / ARCHER_MODEL_SCALE;
      melee.position.set(0.32, -0.22);
      const drawing = sim.nowMs - sim.lastAttackMs < 140;
      melee.rotation = drawing ? -0.55 : -0.18;
      melee.x = drawing ? 0.22 : 0.32;
      return;
    }
    const blade = sim.weaponId === 1;
    const modelScale = blade ? SAMURAI_MODEL_SCALE : SPEAR_MODEL_SCALE;
    melee.texture = blade ? this.art.blade : this.art.spear;
    melee.visible = true;
    melee.anchor.set(MELEE_ANCHOR_X, 0.5);
    const swinging =
      !!flash &&
      (blade
        ? flash.kind === "circle" || flash.kind === "ult"
        : flash.kind === "arc" || flash.kind === "semicircle" || flash.kind === "line");
    const range = blade
      ? ATTACK_RANGE
      : swinging
        ? flash!.radius
        : attackRadius(sim.weaponId, ultBuffActive(sim));
    const grip = swinging ? (blade ? 0.12 : 0.1) : blade ? 0.33 : 0.22;
    const tipX = blade ? BLADE_TIP_TEXTURE_X : SPEAR_TIP_TEXTURE_X;
    melee.width = meleeSpriteWidth(range, modelScale, tipX, grip);
    melee.height = (blade ? 0.32 : 0.26) / modelScale;
    if (swinging && flash) {
      melee.position.set(0.04, -0.1);
      const t = flashProgress(flash, sim.nowMs);
      if (flash.kind === "line") {
        const facing = Math.atan2(flash.facingY, flash.facingX);
        melee.rotation = facing;
        melee.x = 0.04 + t * flash.radius * 0.35;
      } else if (blade) {
        melee.rotation = t * Math.PI * 2 * (flash.kind === "ult" ? 1.35 : 1) - 0.35;
      } else {
        const arcDeg = flash.arcDeg ?? SPEAR_ARC_DEG;
        const half = (arcDeg * Math.PI) / 180 / 2;
        const facing = Math.atan2(flash.facingY, flash.facingX);
        melee.rotation = facing - half + t * arcDeg * (Math.PI / 180);
      }
    } else {
      melee.position.set(blade ? 0.08 : 0.14, blade ? -0.32 : -0.16);
      melee.rotation = blade ? -2.18 : -0.22;
    }
  }

  private drawEnemyTelegraphs(sim: Sim, nowMs: number): void {
    const g = this.groundFx;
    for (const e of sim.enemies) {
      const windup = e.windupUntil ?? 0;
      if (windup <= 0 || nowMs >= (e.strikeUntil ?? 0)) continue;
      const kind = e.kind;
      const windupMs =
        e.attackKind === "lunge"
          ? MINION_WINDUP_MS
          : kind === "minion"
            ? MINION_WINDUP_MS
            : kind === "boss"
              ? BOSS_WINDUP_MS
              : MEGABOSS_WINDUP_MS;
      const t = Math.max(0, Math.min(1, 1 - (windup - nowMs) / windupMs));
      const radius =
        e.attackRadius ??
        (kind === "minion" ? MINION_TELEGRAPH_RADIUS : kind === "boss" ? BOSS_ATTACK_RADIUS : MEGABOSS_ATTACK_RADIUS);
      if (e.attackKind === "lunge") {
        const dir = Math.atan2(e.attackY ?? 0, e.attackX ?? 1);
        const x0 = e.lungeFromX ?? e.x;
        const y0 = e.lungeFromY ?? e.y;
        const x1 = e.lungeToX ?? x0 + Math.cos(dir) * (e.lungeDist ?? radius * 1.2);
        const y1 = e.lungeToY ?? y0 + Math.sin(dir) * (e.lungeDist ?? radius * 1.2);
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke({ width: 0.1 + t * 0.06, color: 0xffb14a, alpha: 0.35 + t * 0.3, cap: "round" });
        g.circle(x1, y1, radius);
        g.stroke({ width: 0.08 + t * 0.04, color: 0xff6a3c, alpha: 0.35 + t * 0.25 });
        g.circle(x1, y1, radius * 0.55);
        g.fill({ color: 0xff6a3c, alpha: 0.1 + t * 0.1 });
        g.circle(x0, y0, e.r * 0.55);
        g.fill({ color: 0xffe08a, alpha: 0.14 + t * 0.1 });
      } else {
        g.circle(e.x, e.y, radius);
        g.fill({ color: 0xff5533, alpha: 0.1 + t * 0.1 });
        g.circle(e.x, e.y, radius);
        g.stroke({ width: 0.12, color: 0xff8a4a, alpha: 0.4 + t * 0.35 });
        g.circle(e.x, e.y, radius * (0.55 + t * 0.25));
        g.stroke({ width: 0.07, color: 0xffe08a, alpha: 0.3 + t * 0.3 });
        if ((kind === "boss" || kind === "megaboss") && t > 0.45) {
          const n = kind === "megaboss" ? 8 : 5;
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + nowMs * 0.002;
            const bx = e.x + Math.cos(ang) * (0.35 + t * 0.5);
            const by = e.y + Math.sin(ang) * (0.35 + t * 0.5);
            g.circle(bx, by, 0.08 + t * 0.05);
            g.fill({ color: 0xff4466, alpha: 0.35 + t * 0.25 });
          }
        }
      }
    }
  }

  private drawAirFx(sim: Sim, nowMs: number, viewW: number, viewH: number, beatCue?: BeatCue): void {
    const g = this.airFx;
    g.clear();
    this.drawBeatCue(sim, nowMs, viewW, viewH, beatCue, g);
    if (sim.ultFxUntilMs > nowMs) {
      const t = 1 - (sim.ultFxUntilMs - nowMs) / 560;
      const p = sim.player;
      const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.018);
      const r = 0.9 + t * 2.2 + pulse * 0.25;
      g.circle(p.x, p.y - 0.1, r);
      g.stroke({ width: 0.12, color: 0xff6a3c, alpha: 0.35 * (1 - t * 0.6) });
      g.circle(p.x, p.y - 0.1, r * 0.55);
      g.stroke({ width: 0.08, color: 0xffe08a, alpha: 0.45 * (1 - t * 0.5) });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + nowMs * 0.005;
        g.moveTo(p.x, p.y - 0.1);
        g.lineTo(p.x + Math.cos(ang) * r * 0.85, p.y - 0.1 + Math.sin(ang) * r * 0.85);
        g.stroke({ width: 0.05, color: 0xfff0a8, alpha: 0.28 * (1 - t), cap: "round" });
      }
    }
    for (const trail of this.slideTrail) {
      const t = 1 - (trail.until - nowMs) / 170;
      if (t <= 0 || t > 1) continue;
      g.ellipse(trail.x, trail.y - 0.1 - t * 0.15, 0.16 + t * 0.2, 0.08 + t * 0.1);
      g.fill({ color: 0x9ad4ff, alpha: 0.22 * (1 - t) });
    }
    this.slideTrail = this.slideTrail.filter((t) => nowMs < t.until);
    for (const s of this.sparks) {
      const t = 1 - (s.until - nowMs) / 180;
      if (t <= 0 || t > 1) continue;
      const r = 0.1 + t * 0.22;
      g.circle(s.x, s.y, r);
      g.fill({ color: 0xfff2a8, alpha: 0.7 * (1 - t) });
      g.circle(s.x, s.y, r * 0.55);
      g.fill({ color: 0xffffff, alpha: 0.8 * (1 - t) });
    }
    this.sparks = this.sparks.filter((s) => nowMs < s.until);
    for (const bit of this.pinkSplats) {
      const life = Math.max(0, Math.min(1, (bit.until - nowMs) / Math.max(1, bit.until - bit.born)));
      const age = (nowMs - bit.born) / 1000;
      const x = bit.x + bit.vx * age;
      const y = bit.y + bit.vy * age + age * age * 2.2;
      const r = bit.size * (0.75 + (1 - life) * 0.9);
      g.circle(x, y, r * 1.35);
      g.fill({ color: 0x5aa8ff, alpha: 0.35 * life });
      g.circle(x, y, r);
      g.fill({ color: 0x9ad4ff, alpha: 0.85 * life });
      g.circle(x, y, r * 0.45);
      g.fill({ color: 0xe8f6ff, alpha: 0.95 * life });
    }
    this.pinkSplats = this.pinkSplats.filter((s) => nowMs < s.until);
    for (const pop of sim.swordWavePops) {
      const left = pop.untilMs - nowMs;
      if (left <= 0) continue;
      const lifeMs = 280;
      const t = 1 - left / lifeMs;
      const fade = 1 - t;
      g.circle(pop.x, pop.y, 0.35 + t * 0.85);
      g.stroke({ width: 0.12, color: 0x7ec8ff, alpha: 0.55 * fade });
      g.circle(pop.x, pop.y, 0.2 + t * 0.45);
      g.fill({ color: 0xb8e8ff, alpha: 0.4 * fade });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 0.8;
        const len = 0.35 + t * 0.7;
        g.moveTo(pop.x, pop.y);
        g.lineTo(pop.x + Math.cos(a) * len, pop.y + Math.sin(a) * len * 0.7);
        g.stroke({ width: 0.06, color: 0xe8f6ff, alpha: 0.65 * fade, cap: "round" });
      }
      g.circle(pop.x, pop.y, 0.1);
      g.fill({ color: 0xffffff, alpha: 0.85 * fade });
    }
    for (const puff of this.puffs) {
      const t = 1 - (puff.until - nowMs) / 280;
      g.ellipse(puff.x, puff.y - 0.35 - t * 0.45, 0.28 + t * 0.4, 0.18 + t * 0.22);
      g.fill({ color: 0xf0e6c8, alpha: 0.5 * (1 - t) });
    }
    const flash = sim.flash;
    if (flash?.sparkle) {
      const key = `${flash.startMs ?? 0}:${flash.untilMs}:${flash.x.toFixed(2)}`;
      if (key !== this.lastSparkleFlashKey) {
        this.lastSparkleFlashKey = key;
        const origin = flashTravelPoint(sim, flash, 0.35);
        const base = Math.atan2(flash.facingY, flash.facingX);
        for (let i = 0; i < 14; i++) {
          const a = base + (i / 14) * Math.PI * 2 + (i % 3) * 0.2;
          const speed = 2.2 + (i % 5) * 0.55;
          this.starBits.push({
            x: origin.x + Math.cos(a) * flash.radius * 0.25,
            y: origin.y + Math.sin(a) * flash.radius * 0.25,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            until: nowMs + 420 + (i % 4) * 40,
            born: nowMs,
          });
        }
      }
    } else if (!flash) {
      this.lastSparkleFlashKey = "";
    }
    for (const star of this.starBits) {
      const life = Math.max(0, Math.min(1, (star.until - nowMs) / Math.max(1, star.until - star.born)));
      const age = (nowMs - star.born) / 1000;
      const x = star.x + star.vx * age;
      const y = star.y + star.vy * age;
      const s = 0.08 + (1 - life) * 0.12;
      g.moveTo(x, y - s);
      g.lineTo(x + s * 0.28, y - s * 0.28);
      g.lineTo(x + s, y);
      g.lineTo(x + s * 0.28, y + s * 0.28);
      g.lineTo(x, y + s);
      g.lineTo(x - s * 0.28, y + s * 0.28);
      g.lineTo(x - s, y);
      g.lineTo(x - s * 0.28, y - s * 0.28);
      g.closePath();
      g.fill({ color: 0xfff6c8, alpha: 0.85 * life });
      g.circle(x, y, s * 0.28);
      g.fill({ color: 0xffffff, alpha: 0.95 * life });
    }
    this.starBits = this.starBits.filter((s) => nowMs < s.until);
    if (flash && flash.onBeat && sim.weaponId !== 3) {
      const facing = Math.atan2(flash.facingY, flash.facingX);
      const t = flashProgress(flash, sim.nowMs);
      const origin = flashTravelPoint(sim, flash, t);
      const ang =
        flash.kind === "line"
          ? Math.atan2(flash.facingY, flash.facingX)
          : flash.kind === "arc" || flash.kind === "semicircle"
            ? Math.atan2(flash.facingY, flash.facingX) -
              ((flash.arcDeg ?? (flash.kind === "semicircle" ? 180 : SPEAR_ARC_DEG)) * Math.PI) /
                180 /
                2 +
              t *
                ((flash.arcDeg ?? (flash.kind === "semicircle" ? 180 : SPEAR_ARC_DEG)) * Math.PI) /
                180
            : facing + t * Math.PI * 2;
      const r = flash.radius * 0.92;
      const tipX = origin.x + Math.cos(ang) * r;
      const tipY = origin.y + Math.sin(ang) * r;
      const tipWarm = sim.weaponId === 1;
      g.ellipse(tipX, tipY, 0.28, 0.18);
      g.fill({ color: tipWarm ? 0x5aa8ff : 0xffb14a, alpha: 0.35 });
      g.ellipse(tipX, tipY, 0.2, 0.13);
      g.fill({ color: tipWarm ? 0xd8f0ff : 0xfff2a8, alpha: 0.85 });
      g.circle(tipX, tipY, 0.09);
      g.fill({ color: 0xffffff, alpha: 0.9 });
      for (let i = 0; i < 5; i++) {
        const a = ang + (i - 2) * 0.35;
        const len = 0.35 + (1 - t) * 0.25;
        g.moveTo(tipX, tipY);
        g.lineTo(tipX + Math.cos(a) * len, tipY + Math.sin(a) * len);
        g.stroke({
          width: 0.05,
          color: tipWarm ? 0x9ad4ff : 0xffe08a,
          alpha: 0.45 * (1 - t * 0.4),
          cap: "round",
        });
      }
    }
  }

  destroy(): void {
    for (const node of this.popupTexts.values()) node.destroy();
    this.popupTexts.clear();
    this.art.destroy();
    this.stageTexDestroy();
    this.world.destroy({ children: true });
  }
}
