import { Texture } from "pixi.js";

export const OUTLINE = "#2a1c14";

export function hash2(x: number, y: number, s = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function makeCanvas(w: number, h: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  return { canvas, ctx };
}

export function textureFrom(canvas: HTMLCanvasElement): Texture {
  return Texture.from(canvas, true);
}

export function oval(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string | CanvasGradient,
  stroke?: string,
  lw = 5,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function shade(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  light: string,
  dark: string,
  stroke?: string,
  lw = 5,
): void {
  const g = ctx.createRadialGradient(x - rx * 0.32, y - ry * 0.38, rx * 0.08, x, y + ry * 0.1, rx);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  oval(ctx, x, y, rx, ry, g, stroke, lw);
}

export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = "rgba(28, 18, 10, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function capsule(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  fill: string | CanvasGradient,
  stroke?: string,
  lw = 4,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d;
  const ny = dx / d;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * r, y0 + ny * r);
  ctx.lineTo(x1 + nx * r, y1 + ny * r);
  ctx.arc(x1, y1, r, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI);
  ctx.lineTo(x0 - nx * r, y0 - ny * r);
  ctx.arc(x0, y0, r, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}
