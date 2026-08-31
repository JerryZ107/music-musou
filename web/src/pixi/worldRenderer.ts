import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import {
  ATTACK_RANGE,
  BOSS_ATTACK_RADIUS,
  BOSS_WINDUP_MS,
  MEGABOSS_ATTACK_RADIUS,
  MEGABOSS_WINDUP_MS,
  MINION_TELEGRAPH_RADIUS,
  MINION_WINDUP_MS,
  SPEAR_ARC_DEG,
  TEMPLATE2_ATTACK_RANGE,
  WORLD_H,
  WORLD_W,
} from "../game/constants";
import { cameraOrigin, samuraiShieldActive, ultBuffActive } from "../game/sim";
import type { AttackFlash, Enemy, Sim } from "../game/types";
import { ArtBank, SPRITE_SIZE, type HeroKey, type PropKind } from "./chibiArt";
import { buildStageArt, type StageProp } from "./stageMap";

type ActorNode = {
  root: Container;
  sprite: Sprite;
  frames?: Texture[];
  hp?: Graphics;
  lastHp?: number;
  flashUntil?: number;
};

function flashProgress(flash: AttackFlash, nowMs: number): number {
  const left = Math.max(0, flash.untilMs - nowMs);
  let dur = 120;
  if (flash.path) dur = 160;
  else if (flash.kind === "ult" || left > 125) dur = 200;
  return Math.max(0, Math.min(1, 1 - left / dur));
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
  private slideTrail: { x: number; y: number; until: number }[] = [];
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

  render(sim: Sim, viewW: number, viewH: number, nowMs: number): void {
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
    this.syncObstacles(sim, nowMs);
    this.syncDeaths(sim, nowMs);
    this.syncEnemies(sim, nowMs);
    this.drawEnemyTelegraphs(sim, nowMs);
    this.syncClones(sim, nowMs);
    this.syncBullets(sim);
    this.drawPlayer(sim, nowMs);
    this.drawDamagePopups(sim, nowMs);
    this.drawAirFx(sim, nowMs);
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
    const color =
      flash.kind === "line" && ultBuffActive(sim)
        ? 0xffc85a
        : flash.kind === "ult"
          ? 0xff6a3c
          : flash.onBeat
            ? 0xffe08a
            : 0x9ad4ff;
    const t = flashProgress(flash, sim.nowMs);
    const stamp = (x: number, y: number, r: number) => {
      g.ellipse(x, y + 0.14, r * 0.72, r * 0.22);
      g.fill({ color, alpha: 0.1 });
      const facing = Math.atan2(flash.facingY, flash.facingX);
      if (flash.kind === "line") {
        const len = r * t;
        const x1 = x + Math.cos(facing) * len;
        const y1 = y + Math.sin(facing) * len;
        g.moveTo(x, y);
        g.lineTo(x1, y1);
        g.stroke({ width: ultBuffActive(sim) ? 0.22 : 0.16, color, alpha: 0.72, cap: "round" });
        if (ultBuffActive(sim)) {
          g.circle(x1, y1, 0.18 * (1 - t * 0.35));
          g.fill({ color: 0xfff0a8, alpha: 0.55 });
        }
        g.moveTo(x + Math.cos(facing) * len * 0.15, y + Math.sin(facing) * len * 0.15);
        g.lineTo(x1, y1);
        g.stroke({ width: 0.08, color, alpha: 0.35, cap: "round" });
      } else if (flash.kind === "arc" || flash.kind === "semicircle") {
        const arcDeg = flash.arcDeg ?? (flash.kind === "semicircle" ? 180 : SPEAR_ARC_DEG);
        const arcRad = (arcDeg * Math.PI) / 180;
        const a0 = facing - (arcRad / 2) * t;
        const a1 = facing + (arcRad / 2) * t;
        strokeArc(g, x, y, r, a0, a1, color, 0.13, 0.55);
        strokeArc(g, x, y, r * 0.78, a0, a1, color, 0.07, 0.32);
      } else if (flash.kind === "ult") {
        const spin = facing + t * Math.PI * 2 * 1.8;
        strokeArc(g, x, y, r * (0.55 + t * 0.55), spin - 1.35, spin, color, 0.18, 0.62);
        strokeArc(g, x, y, r * (0.35 + t * 0.45), spin + 0.4, spin + 2.4, color, 0.1, 0.38);
        g.circle(x, y, r * (0.2 + t * 0.35));
        g.stroke({ width: 0.1, color: 0xfff0a8, alpha: 0.45 * (1 - t * 0.4) });
      } else {
        const spin = facing + t * Math.PI * 2;
        strokeArc(g, x, y, r, spin - 1.15, spin, color, 0.14, 0.5);
        strokeArc(g, x, y, r * 0.82, spin - 0.85, spin, color, 0.08, 0.28);
      }
    };
    if (flash.path) {
      for (const p of flash.path) stamp(p.x, p.y, flash.radius);
    } else {
      stamp(flash.x, flash.y, flash.radius);
    }
  }

  private drawExplosions(sim: Sim, nowMs: number): void {
    for (const ex of sim.explosions) {
      const left = ex.untilMs - nowMs;
      if (left <= 0) continue;
      const t = 1 - left / 240;
      const g = this.groundFx;
      const r = ex.radius * (0.35 + t * 0.85);
      g.circle(ex.x, ex.y, r);
      g.stroke({ width: 0.12, color: 0xff8844, alpha: 0.75 * (1 - t * 0.7) });
      g.circle(ex.x, ex.y, r * 0.55);
      g.fill({ color: 0xffaa44, alpha: 0.42 * (1 - t) });
      g.circle(ex.x, ex.y - 0.08, r * 0.22);
      g.fill({ color: 0xfff2c8, alpha: 0.65 * (1 - t) });
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

  private syncDeaths(sim: Sim, nowMs: number): void {
    const live = new Set(sim.enemies.map((e) => e.id));
    for (const [id, pos] of this.lastEnemyPos) {
      if (!live.has(id)) {
        this.puffs.push({ x: pos.x, y: pos.y, until: nowMs + 280 });
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
      }
      node.lastHp = e.hp;
      node.sprite.tint = nowMs < (node.flashUntil ?? 0) ? 0xff9a9a : isMegaboss ? 0xffe8c8 : 0xffffff;
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
      this.face(node.sprite, SPRITE_SIZE.clone.w, SPRITE_SIZE.clone.h, sim.player.facingX);
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
        const color = 0xff4466;
        gfx.circle(0, 0, b.r * 1.1);
        gfx.fill({ color, alpha: 0.85 });
        gfx.circle(0, 0, b.r * 0.45);
        gfx.fill({ color: 0xffaab8, alpha: 0.9 });
        gfx.moveTo(-b.r * 1.6, 0);
        gfx.lineTo(-b.r * 0.2, 0);
        gfx.stroke({ width: 0.06, color: 0xff8899, alpha: 0.55, cap: "round" });
      } else {
        const color = b.explosive ? 0xff8844 : b.enhanced ? 0x9ad4ff : 0xffe08a;
        gfx.moveTo(-b.r * 2.4, 0);
        gfx.lineTo(b.r * 1.8, -b.r * 0.55);
        gfx.lineTo(b.r * 2.8, 0);
        gfx.lineTo(b.r * 1.8, b.r * 0.55);
        gfx.closePath();
        gfx.fill(color);
        gfx.rect(-b.r * 2.2, -b.r * 0.18, b.r * 2.4, b.r * 0.36);
        gfx.fill(b.explosive ? 0xffc06a : b.enhanced ? 0xc8e8ff : 0xd4a06a);
        if (b.explosive) {
          gfx.circle(b.r * 1.2, 0, b.r * 0.55);
          gfx.fill({ color: 0xfff0a0, alpha: 0.75 });
        }
      }
      gfx.position.set(b.x, b.y);
      gfx.zIndex = b.y + 0.2;
      gfx.rotation = Math.atan2(b.uy, b.ux);
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
      node.sprite.width = SPRITE_SIZE.hero.w;
      node.sprite.height = SPRITE_SIZE.hero.h;
    }
    this.lastPlayerX = p.x;
    this.lastPlayerY = p.y;
    const sliding = sim.nowMs < sim.slideUntil;
    const bob = sliding ? 0 : Math.sin(nowMs * 0.012) * 0.04;
    const lean = sliding ? 0.13 : moving ? Math.sin(nowMs * 0.012) * 0.05 : 0;
    this.playerPose.y = bob;
    this.playerPose.scale.x = p.facingX < -0.12 ? -1 : 1;
    this.playerPose.rotation = p.facingX < -0.12 ? -lean : lean;
    if (sliding) this.slideTrail.push({ x: p.x, y: p.y, until: nowMs + 170 });
    const hurt = nowMs - sim.lastHurtMs < 180;
    const ultFx = sim.ultFxUntilMs > nowMs;
    const shielded = samuraiShieldActive(sim);
    node.sprite.tint = hurt
      ? 0xff8a8a
      : ultFx
        ? 0xffc878
        : shielded
          ? 0xb8e8ff
          : ultBuffActive(sim)
            ? 0xffe08a
            : 0xffffff;
    this.syncMelee(sim);
    node.root.position.set(p.x, p.y);
    node.root.zIndex = p.y + 0.05;
  }

  private drawShieldAura(sim: Sim, nowMs: number, g: Graphics): void {
    if (!samuraiShieldActive(sim)) return;
    const p = sim.player;
    const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.01);
    const r = 0.62 + pulse * 0.08;
    g.circle(p.x, p.y - 0.08, r);
    g.stroke({ width: 0.1, color: 0x9ad4ff, alpha: 0.35 + pulse * 0.25 });
    g.arc(p.x, p.y - 0.08, r * 0.92, nowMs * 0.004, nowMs * 0.004 + Math.PI * 1.35);
    g.stroke({ width: 0.07, color: 0xe8f8ff, alpha: 0.45 + pulse * 0.2 });
    g.circle(p.x, p.y - 0.22, 0.1 + pulse * 0.04);
    g.fill({ color: 0xc8ecff, alpha: 0.55 });
  }

  private syncMelee(sim: Sim): void {
    const melee = this.melee;
    const flash = sim.flash;
    if (sim.weaponId === 3) {
      melee.texture = this.art.bow;
      melee.visible = true;
      melee.anchor.set(0.55, 0.5);
      melee.width = 0.72;
      melee.height = 1.22;
      melee.position.set(0.32, -0.22);
      const drawing = sim.nowMs - sim.lastAttackMs < 140;
      melee.rotation = drawing ? -0.55 : -0.18;
      melee.x = drawing ? 0.22 : 0.32;
      return;
    }
    const blade = sim.weaponId === 1;
    melee.texture = blade ? this.art.blade : this.art.spear;
    melee.visible = true;
    melee.anchor.set(0.14, 0.5);
    const swinging =
      !!flash &&
      (blade
        ? flash.kind === "circle" || flash.kind === "ult"
        : flash.kind === "arc" || flash.kind === "semicircle" || flash.kind === "line");
    const len = swinging ? flash!.radius : blade ? ATTACK_RANGE : TEMPLATE2_ATTACK_RANGE;
    melee.width = blade ? len * 1.02 : len * 0.98;
    melee.height = blade ? 0.32 : 0.26;
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
        const x0 = e.x;
        const y0 = e.y;
        const x1 = x0 + Math.cos(dir) * radius * 1.7;
        const y1 = y0 + Math.sin(dir) * radius * 1.7;
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke({ width: 0.1 + t * 0.06, color: 0xffb14a, alpha: 0.35 + t * 0.3, cap: "round" });
        g.circle(x1, y1, radius * (0.35 + t * 0.3));
        g.fill({ color: 0xff6a3c, alpha: 0.12 + t * 0.12 });
        g.circle(x0, y0, radius * 0.42);
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

  private drawAirFx(sim: Sim, nowMs: number): void {
    const g = this.airFx;
    g.clear();
    this.drawShieldAura(sim, nowMs, g);
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
    for (const puff of this.puffs) {
      const t = 1 - (puff.until - nowMs) / 280;
      g.ellipse(puff.x, puff.y - 0.35 - t * 0.45, 0.28 + t * 0.4, 0.18 + t * 0.22);
      g.fill({ color: 0xf0e6c8, alpha: 0.5 * (1 - t) });
    }
    const flash = sim.flash;
    if (flash && flash.onBeat && sim.weaponId !== 3) {
      const facing = Math.atan2(flash.facingY, flash.facingX);
      const t = flashProgress(flash, sim.nowMs);
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
      g.ellipse(flash.x + Math.cos(ang) * r, flash.y + Math.sin(ang) * r, 0.16, 0.1);
      g.fill({ color: 0xfff2a8, alpha: 0.75 });
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
