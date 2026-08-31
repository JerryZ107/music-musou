import { Texture } from "pixi.js";
import { WORLD_H, WORLD_W } from "../game/constants";
import { ARENAS, PLAZA, STAGE_OBSTACLES, inPlaza } from "../game/stage";
import { hash2, makeCanvas, textureFrom } from "./paint";
import type { PropKind } from "./chibiArt";

const PX = 16;

export interface StageProp {
  x: number;
  y: number;
  kind: PropKind;
}

export interface StageArt {
  texture: Texture;
  props: StageProp[];
  lamps: { x: number; y: number }[];
}

function rgba(n: number, a: number): string {
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function onRoad(x: number, y: number): boolean {
  return Math.abs(x - PLAZA.x) < 2.4 || Math.abs(y - PLAZA.y) < 2.2;
}

function inArena(x: number, y: number): boolean {
  return ARENAS.some((a) => Math.hypot(x - a.x, y - a.y) < a.r);
}

function blob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function buildStageArt(): StageArt {
  const W = WORLD_W * PX;
  const H = WORLD_H * PX;
  const { canvas, ctx } = makeCanvas(W, H);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#4eaa42");
  sky.addColorStop(1, "#2f7a34");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 1500; i++) {
    blob(
      ctx,
      hash2(i, 1) * W,
      hash2(i, 2) * H,
      14 + hash2(i, 3) * 74,
      9 + hash2(i, 4) * 48,
      hash2(i, 6) * 1.1,
      hash2(i, 5) > 0.55 ? "#63c050" : "#3d8c36",
    );
  }
  ctx.globalAlpha = 1;

  const strokeRoad = (x0: number, y0: number, x1: number, y1: number): void => {
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = "#5a4634";
    ctx.lineWidth = 5.1 * PX;
    ctx.stroke();
    ctx.strokeStyle = "#8a6e52";
    ctx.lineWidth = 3.5 * PX;
    ctx.stroke();
    ctx.strokeStyle = "#d4b892";
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.2 * PX;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  const px = PLAZA.x * PX;
  const py = PLAZA.y * PX;
  strokeRoad(0, py, W, py);
  strokeRoad(px, 0, px, H);

  blob(ctx, px, py, PLAZA.r * PX, PLAZA.r * PX * 0.88, 0.05, "#c8a878");
  blob(ctx, px - PX, py + PX * 0.6, PLAZA.r * PX * 0.55, PLAZA.r * PX * 0.42, -0.2, "#d8bc94");

  for (const a of ARENAS) {
    blob(ctx, a.x * PX, a.y * PX, a.r * PX, a.r * PX * 0.86, 0.08, rgba(a.accent, 0.2));
    blob(ctx, a.x * PX, a.y * PX, a.r * PX * 0.7, a.r * PX * 0.58, -0.12, "rgba(24, 52, 20, 0.28)");
    ctx.beginPath();
    ctx.ellipse(a.x * PX, a.y * PX, a.r * PX, a.r * PX * 0.86, 0.08, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(a.accent, 0.55);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(a.x * PX, a.y * PX, (a.r - 1.1) * PX, (a.r - 1.1) * PX * 0.86, 0.08, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(a.accent, 0.28);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo((px + a.x * PX) / 2 + 30, (py + a.y * PX) / 2 - 26, a.x * PX, a.y * PX);
    ctx.strokeStyle = "rgba(138, 110, 82, 0.4)";
    ctx.lineWidth = 2.4 * PX;
    ctx.stroke();
    ctx.strokeStyle = "rgba(212, 184, 146, 0.25)";
    ctx.lineWidth = 0.9 * PX;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(px, py, PLAZA.r * PX * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(90, 70, 52, 0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px, py, PLAZA.r * PX * 0.4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(90, 70, 52, 0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a0 = hash2(i, 77) * Math.PI * 2;
    const d0 = PLAZA.r * (0.25 + hash2(i, 78) * 0.5);
    const x0 = px + Math.cos(a0) * d0 * PX;
    const y0 = py + Math.sin(a0) * d0 * PX * 0.86;
    const x1 = px + Math.cos(a0 + 0.06) * (d0 + 1.3) * PX;
    const y1 = py + Math.sin(a0 + 0.06) * (d0 + 1.3) * PX * 0.86;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = "rgba(70, 50, 34, 0.3)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  for (let i = 0; i < 80; i++) {
    const x = hash2(i, 30) * WORLD_W;
    const y = hash2(i, 31) * WORLD_H;
    if (onRoad(x, y) || inPlaza(x, y) || inArena(x, y)) continue;
    blob(
      ctx,
      x * PX,
      y * PX,
      (1.2 + hash2(i, 32) * 2.2) * PX,
      (0.7 + hash2(i, 33) * 1.4) * PX,
      hash2(i, 34),
      hash2(i, 35) > 0.5 ? "#c2a06a" : "#9a7a48",
    );
  }

  for (let i = 0; i < 900; i++) {
    const x = hash2(i, 11) * WORLD_W;
    const y = hash2(i, 17) * WORLD_H;
    if (onRoad(x, y) || inPlaza(x, y)) continue;
    blob(
      ctx,
      x * PX,
      y * PX,
      2.6,
      1.9,
      hash2(i, 22),
      hash2(i, 21) > 0.5 ? "#e85a4a" : "#ffd24a",
    );
  }

  const hedge = (x: number, y: number, s: number): void => {
    blob(ctx, x, y, 20 * s, 13 * s, 0.2, "#246828");
    blob(ctx, x - 7 * s, y - 4 * s, 12 * s, 8 * s, -0.3, "#4ea03c");
  };
  for (let x = 0; x < W; x += 26) {
    hedge(x, 8, 1 + hash2(x, 1) * 0.4);
    hedge(x + 10, H - 8, 1 + hash2(x, 2) * 0.4);
  }
  for (let y = 0; y < H; y += 30) {
    hedge(8, y, 1 + hash2(y, 3) * 0.35);
    hedge(W - 8, y + 12, 1 + hash2(y, 4) * 0.35);
  }

  const props: StageProp[] = [{ x: PLAZA.x - 3.2, y: PLAZA.y + 2.4, kind: "camp" }];
  const lamps: { x: number; y: number }[] = [];

  for (const o of STAGE_OBSTACLES) {
    const kind: PropKind =
      o.kind === "lantern"
        ? "lamp"
        : o.kind === "pillar"
          ? "crate"
          : o.kind === "crate" || o.kind === "barrel"
            ? "crate"
            : o.kind === "grave"
              ? "grave"
              : "stone";
    props.push({ x: o.x, y: o.y, kind });
    if (o.kind === "lantern") lamps.push({ x: o.x, y: o.y });
  }

  for (let t = 10; t < WORLD_W - 10; t += 16) {
    const j = (hash2(t, 7) - 0.5) * 1.4;
    lamps.push({ x: t + 0.8, y: PLAZA.y - 2.8 + j });
    lamps.push({ x: t - 0.4, y: PLAZA.y + 2.9 - j });
    props.push({ x: t + 0.8, y: PLAZA.y - 2.8 + j, kind: "lamp" });
    props.push({ x: t - 0.4, y: PLAZA.y + 2.9 - j, kind: "lamp" });
  }

  for (let x = 3; x < WORLD_W - 3; x += 7) {
    props.push({ x, y: 2.2, kind: "tree" });
    props.push({ x: x + 2, y: WORLD_H - 2.4, kind: "tree" });
  }
  for (let y = 6; y < WORLD_H - 6; y += 8) {
    props.push({ x: 2.3, y, kind: "tree" });
    props.push({ x: WORLD_W - 2.4, y: y + 1.5, kind: "tree" });
  }

  for (const a of ARENAS) {
    for (let i = 0; i < 5; i++) {
      const ang = hash2(a.id, i + 1) * Math.PI * 2;
      const d = a.r * (0.5 + hash2(i, a.id + 8) * 0.38);
      props.push({
        x: a.x + Math.cos(ang) * d,
        y: a.y + Math.sin(ang) * d,
        kind: hash2(i, a.id) > 0.45 ? "bush" : "stone",
      });
    }
  }

  for (let i = 0; i < 36; i++) {
    const x = 4 + hash2(i, 40) * (WORLD_W - 8);
    const y = 4 + hash2(i, 41) * (WORLD_H - 8);
    if (inPlaza(x, y) || onRoad(x, y) || inArena(x, y)) continue;
    const roll = hash2(i, 42);
    props.push({ x, y, kind: roll > 0.7 ? "crate" : roll > 0.45 ? "grave" : "bush" });
  }

  for (let i = 0; i < 26; i++) {
    const x = 6 + hash2(i, 60) * (WORLD_W - 12);
    const y = 6 + hash2(i, 61) * (WORLD_H - 12);
    if (inPlaza(x, y) || onRoad(x, y) || inArena(x, y)) continue;
    props.push({ x, y, kind: "grave" });
  }

  props.push({ x: PLAZA.x + 14, y: PLAZA.y - 1.1, kind: "car" });
  props.push({ x: PLAZA.x - 18, y: PLAZA.y + 1.2, kind: "car" });

  props.sort((a, b) => a.y - b.y);
  return { texture: textureFrom(canvas), props, lamps };
}
