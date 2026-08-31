import { Texture } from "pixi.js";
import { capsule, makeCanvas, oval, OUTLINE, shade, shadow, textureFrom } from "./paint";
import type { WeaponId } from "../game/types";

export type HeroKey = `hero-${WeaponId}`;
export type ZombieKey = `zombie-${0 | 1 | 2 | 3}`;
export type BossKey = `boss-${0 | 1}`;
export type MegaBossKey = "megaboss";
export type PropKind = "tree" | "lamp" | "stone" | "car" | "bush" | "camp" | "crate" | "grave";

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, iris = "#1a120e"): void {
  shade(ctx, x, y, r, r * 1.15, "#fffef6", "#e8dcc8", OUTLINE, 3);
  oval(ctx, x + r * 0.16, y + r * 0.1, r * 0.4, r * 0.48, iris);
  oval(ctx, x + r * 0.34, y - r * 0.18, r * 0.16, r * 0.18, "#ffffff");
}

function drawSamurai(ctx: CanvasRenderingContext2D, w: number, h: number, pose: 0 | 1 | 2 = 0): void {
  const gx = w / 2;
  const gy = h * 0.9;
  shadow(ctx, gx, gy, 34, 12);
  const ironL = "#8a9098";
  const ironD = "#3a4048";
  const goldL = "#f0d078";
  const goldD = "#b07818";
  const skinL = "#e8b090";
  const skinD = "#c47858";
  const step = pose === 0 ? 0 : pose === 1 ? 3.4 : -3.4;
  const arm = pose === 0 ? 0 : pose === 1 ? -2.6 : 2.6;
  const footY = pose === 0 ? 0 : pose === 1 ? 0.8 : -0.6;
  shade(ctx, gx - 16 + step, gy - 8 + footY, 12, 8, ironL, ironD, OUTLINE, 4);
  shade(ctx, gx + 16 - step, gy - 8 - footY, 12, 8, ironL, ironD, OUTLINE, 4);
  shade(ctx, gx, gy - 28, 30, 14, "#5a4030", "#2a1810", OUTLINE, 4);
  shade(ctx, gx - 18, gy - 30, 8, 12, ironL, ironD, OUTLINE, 3);
  shade(ctx, gx + 18, gy - 30, 8, 12, ironL, ironD, OUTLINE, 3);
  shade(ctx, gx, gy - 58, 28, 30, ironL, ironD, OUTLINE, 5);
  shade(ctx, gx, gy - 52, 18, 10, goldL, goldD);
  oval(ctx, gx - 10, gy - 62, 3, 3, goldL, OUTLINE, 2);
  oval(ctx, gx + 10, gy - 62, 3, 3, goldL, OUTLINE, 2);
  shade(ctx, gx - 34 - arm, gy - 62, 12, 16, ironL, ironD, OUTLINE, 4);
  shade(ctx, gx + 34 + arm, gy - 60, 12, 16, ironL, ironD, OUTLINE, 4);
  shade(ctx, gx - 28 - arm * 0.6, gy - 48, 9, 13, skinL, skinD, OUTLINE, 3);
  shade(ctx, gx + 30 + arm * 0.6, gy - 46, 9, 13, skinL, skinD, OUTLINE, 3);
  shade(ctx, gx, gy - 96, 30, 26, ironL, ironD, OUTLINE, 5);
  shade(ctx, gx, gy - 118, 22, 14, ironD, "#1a1e24", OUTLINE, 4);
  capsule(ctx, gx - 22, gy - 124, gx - 8, gy - 108, 3.2, goldL, OUTLINE, 2);
  capsule(ctx, gx + 22, gy - 124, gx + 8, gy - 108, 3.2, goldL, OUTLINE, 2);
  shade(ctx, gx, gy - 128, 7, 8, goldL, goldD, OUTLINE, 2);
  shade(ctx, gx, gy - 82, 18, 10, "#4a3830", "#2a1c16", OUTLINE, 3);
  oval(ctx, gx - 8, gy - 98, 5, 4.2, "#1a120e");
  oval(ctx, gx + 10, gy - 96, 5, 4.2, "#1a120e");
  oval(ctx, gx - 6, gy - 99, 1.6, 1.6, "#fff6e0");
  oval(ctx, gx + 12, gy - 97, 1.6, 1.6, "#fff6e0");
}

function drawSpearman(ctx: CanvasRenderingContext2D, w: number, h: number, pose: 0 | 1 | 2 = 0): void {
  const gx = w / 2;
  const gy = h * 0.9;
  shadow(ctx, gx, gy, 32, 11);
  const robeL = "#4ec4c0";
  const robeD = "#1a6a72";
  const skinL = "#f0c4a4";
  const skinD = "#d09070";
  const hairL = "#2a1c14";
  const hairD = "#0e0806";
  const step = pose === 0 ? 0 : pose === 1 ? 3 : -3;
  const arm = pose === 0 ? 0 : pose === 1 ? -2.4 : 2.4;
  const footY = pose === 0 ? 0 : pose === 1 ? 0.7 : -0.5;
  shade(ctx, gx - 12 + step, gy - 8 + footY, 10, 7, "#3a2a22", "#1a120e", OUTLINE, 4);
  shade(ctx, gx + 12 - step, gy - 8 - footY, 10, 7, "#3a2a22", "#1a120e", OUTLINE, 4);
  shade(ctx, gx, gy - 40, 26, 34, robeL, robeD, OUTLINE, 5);
  shade(ctx, gx - 8, gy - 36, 8, 22, "#7ee0d8", robeL);
  shade(ctx, gx + 10, gy - 38, 7, 20, "#2a8a88", robeD);
  shade(ctx, gx, gy - 22, 22, 8, "#c45c48", "#8a2818", OUTLINE, 3);
  shade(ctx, gx - 30 - arm, gy - 48, 12, 18, robeL, robeD, OUTLINE, 4);
  shade(ctx, gx + 30 + arm, gy - 46, 12, 18, robeL, robeD, OUTLINE, 4);
  shade(ctx, gx - 30 - arm * 0.6, gy - 36, 8, 10, skinL, skinD, OUTLINE, 3);
  shade(ctx, gx + 30 + arm * 0.6, gy - 34, 8, 10, skinL, skinD, OUTLINE, 3);
  shade(ctx, gx, gy - 8, 20, 10, robeD, "#0e4048", OUTLINE, 3);
  shade(ctx, gx - 16, gy - 70, 14, 36, hairL, hairD, OUTLINE, 4);
  shade(ctx, gx + 20, gy - 64, 12, 42, hairL, hairD, OUTLINE, 4);
  shade(ctx, gx + 6, gy - 40, 10, 28, hairL, hairD);
  shade(ctx, gx, gy - 92, 28, 26, skinL, skinD, OUTLINE, 5);
  shade(ctx, gx - 6, gy - 108, 18, 16, hairL, hairD, OUTLINE, 4);
  shade(ctx, gx + 16, gy - 104, 16, 14, hairL, hairD, OUTLINE, 3);
  shade(ctx, gx + 2, gy - 118, 10, 10, hairL, hairD, OUTLINE, 3);
  capsule(ctx, gx + 18, gy - 112, gx + 8, gy - 96, 3, "#c45c48", OUTLINE, 2);
  eye(ctx, gx - 10, gy - 94, 7.5);
  eye(ctx, gx + 12, gy - 92, 7.5);
  oval(ctx, gx, gy - 78, 6, 3.2, "#c47868");
  ctx.beginPath();
  ctx.arc(gx, gy - 80, 7, 0.25, Math.PI - 0.25);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.6;
  ctx.stroke();
}

function drawElf(ctx: CanvasRenderingContext2D, w: number, h: number, ghost: boolean, pose: 0 | 1 | 2 = 0): void {
  const gx = w / 2;
  const gy = h * 0.9;
  shadow(ctx, gx, gy, 30, 11);
  const skinL = ghost ? "#d8f6ff" : "#f4dcc0";
  const skinD = ghost ? "#8fd4ea" : "#d4a888";
  const hairL = ghost ? "#c8f4ff" : "#f0e6c4";
  const hairD = ghost ? "#7ec8e0" : "#c4b078";
  const clothL = ghost ? "#9ee4ff" : "#6bc48a";
  const clothD = ghost ? "#5aaed0" : "#2e7a4a";
  const step = pose === 0 ? 0 : pose === 1 ? 2.8 : -2.8;
  const arm = pose === 0 ? 0 : pose === 1 ? -2.2 : 2.2;
  const footY = pose === 0 ? 0 : pose === 1 ? 0.6 : -0.5;
  shade(ctx, gx - 11 + step, gy - 8 + footY, 9, 7, "#4a382c", "#2a1c14", OUTLINE, 4);
  shade(ctx, gx + 11 - step, gy - 8 - footY, 9, 7, "#4a382c", "#2a1c14", OUTLINE, 4);
  shade(ctx, gx, gy - 36, 22, 28, clothL, clothD, OUTLINE, 5);
  shade(ctx, gx, gy - 42, 16, 10, "#e8d090", "#b08a40");
  shade(ctx, gx - 22 - arm, gy - 48, 11, 14, clothD, "#1e5a38", OUTLINE, 4);
  shade(ctx, gx + 24 + arm, gy - 46, 10, 13, clothL, clothD, OUTLINE, 4);
  shade(ctx, gx - 24 - arm * 0.6, gy - 40, 7, 9, skinL, skinD, OUTLINE, 3);
  shade(ctx, gx + 26 + arm * 0.6, gy - 38, 7, 9, skinL, skinD, OUTLINE, 3);
  shade(ctx, gx + 20, gy - 58, 8, 14, "#8a5a32", "#5a3818", OUTLINE, 3);
  oval(ctx, gx + 20, gy - 70, 5, 7, "#c49058", OUTLINE, 2);
  shade(ctx, gx - 36, gy - 88, 10, 16, skinL, skinD, OUTLINE, 3);
  shade(ctx, gx + 36, gy - 86, 10, 16, skinL, skinD, OUTLINE, 3);
  oval(ctx, gx - 42, gy - 96, 4, 6, skinL, OUTLINE, 2);
  oval(ctx, gx + 42, gy - 94, 4, 6, skinL, OUTLINE, 2);
  shade(ctx, gx, gy - 88, 26, 24, skinL, skinD, OUTLINE, 5);
  shade(ctx, gx - 8, gy - 108, 16, 16, hairL, hairD, OUTLINE, 4);
  shade(ctx, gx + 14, gy - 102, 14, 18, hairL, hairD, OUTLINE, 4);
  shade(ctx, gx + 4, gy - 118, 10, 10, hairL, hairD, OUTLINE, 3);
  shade(ctx, gx + 18, gy - 70, 8, 28, hairL, hairD, OUTLINE, 3);
  eye(ctx, gx - 9, gy - 90, 8, ghost ? "#1a4a58" : "#3a7a38");
  eye(ctx, gx + 12, gy - 88, 8, ghost ? "#1a4a58" : "#3a7a38");
  oval(ctx, gx, gy - 74, 5, 3, "#e8a090");
  ctx.beginPath();
  ctx.arc(gx, gy - 76, 6, 0.3, Math.PI - 0.3);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  oval(ctx, gx - 18, gy - 78, 3, 3, "#e8c56b", OUTLINE, 2);
}

function drawBow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const x = w * 0.55;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x, 18);
  ctx.quadraticCurveTo(18, h / 2, x, h - 18);
  ctx.stroke();
  ctx.strokeStyle = "#8a5a32";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, 20);
  ctx.quadraticCurveTo(24, h / 2, x, h - 20);
  ctx.stroke();
  ctx.strokeStyle = "#e8dcc8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 22);
  ctx.lineTo(x, h - 22);
  ctx.stroke();
  shade(ctx, x, h / 2, 8, 14, "#c4a06a", "#6a4430", OUTLINE, 3);
  ctx.strokeStyle = "#d8e0ea";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - 2, 22);
  ctx.lineTo(w - 16, h / 2);
  ctx.lineTo(x - 2, h - 22);
  ctx.stroke();
}

function drawZombie(ctx: CanvasRenderingContext2D, w: number, h: number, variant: number, pose: 0 | 1 | 2 = 0): void {
  const gx = w / 2;
  const gy = h * 0.9;
  shadow(ctx, gx, gy, 36, 12);
  const skins: [string, string][] = [
    ["#b6dc7a", "#739c48"],
    ["#9eccb0", "#628a78"],
    ["#d2d080", "#8a9a48"],
    ["#98cc84", "#5e8a4a"],
  ];
  const shirts: [string, string][] = [
    ["#6a88a8", "#3d556e"],
    ["#b0b4bc", "#6e727a"],
    ["#f6dde4", "#d8a8b4"],
    ["#e8a05a", "#b06828"],
  ];
  const [sL, sD] = skins[variant]!;
  const [cL, cD] = shirts[variant]!;
  const step = pose === 0 ? 0 : pose === 1 ? 3.2 : -3.2;
  const arm = pose === 0 ? 0 : pose === 1 ? -2.4 : 2.4;
  const footY = pose === 0 ? 0 : pose === 1 ? 0.7 : -0.5;
  shade(ctx, gx - 14 + step, gy - 10 + footY, 11, 7, "#4a3a2c", "#2a2018", OUTLINE, 4);
  shade(ctx, gx + 15 - step, gy - 10 - footY, 11, 7, "#4a3a2c", "#2a2018", OUTLINE, 4);
  shade(ctx, gx, gy - 40, 26, 28, cL, cD, OUTLINE, 5);
  shade(ctx, gx - 28 - arm, gy - 34, 10, 12, sL, sD, OUTLINE, 4);
  shade(ctx, gx + 28 + arm, gy - 32, 10, 12, sL, sD, OUTLINE, 4);
  shade(ctx, gx, gy - 78, 38, 36, sL, sD, OUTLINE, 6);
  if (variant === 1) {
    capsule(ctx, gx, gy - 22, gx, gy - 4, 4, "#c45c4a", OUTLINE, 3);
    shade(ctx, gx, gy - 86, 24, 8, "#3a4048", "#1a1e24", OUTLINE, 3);
  }
  if (variant === 2) {
    shade(ctx, gx, gy - 108, 26, 12, "#fff6f8", "#e8c8d0", OUTLINE, 4);
    oval(ctx, gx, gy - 118, 7, 7, "#ff8aa0", OUTLINE, 3);
  }
  if (variant === 3) {
    shade(ctx, gx, gy - 112, 16, 14, "#f0b04a", "#d07818", OUTLINE, 4);
    shade(ctx, gx, gy - 124, 10, 12, "#f8c86a", "#e09028", OUTLINE, 3);
  }
  shade(ctx, gx - 13, gy - 80, 10, 12, "#f4f0dc", "#d8d0b0", OUTLINE, 3);
  shade(ctx, gx + 15, gy - 78, 8, 9, "#f4f0dc", "#d8d0b0", OUTLINE, 3);
  oval(ctx, gx - 11, gy - 79, 3.6, 4.4, "#1a120e");
  oval(ctx, gx + 16, gy - 77, 2.8, 3.4, "#1a120e");
  ctx.beginPath();
  ctx.moveTo(gx - 10, gy - 62);
  ctx.quadraticCurveTo(gx + 2, gy - 52, gx + 14, gy - 62);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  oval(ctx, gx + 7, gy - 60, 3, 4, "#efe8cc", OUTLINE, 2);
}

function drawBoss(ctx: CanvasRenderingContext2D, w: number, h: number, variant: number): void {
  const gx = w / 2;
  const gy = h * 0.9;
  shadow(ctx, gx, gy, 50, 16);
  const skinL = variant === 0 ? "#a8d068" : "#7ec4a8";
  const skinD = variant === 0 ? "#6a9438" : "#4a8870";
  shade(ctx, gx - 22, gy - 12, 15, 9, "#4a382c", "#2a1c14", OUTLINE, 5);
  shade(ctx, gx + 24, gy - 12, 15, 9, "#4a382c", "#2a1c14", OUTLINE, 5);
  shade(ctx, gx, gy - 50, 54, 44, variant === 0 ? "#e07048" : "#5a6578", variant === 0 ? "#a03820" : "#2e3644", OUTLINE, 6);
  shade(ctx, gx, gy - 46, 34, 20, variant === 0 ? "#f4e6cc" : "#4a5260", variant === 0 ? "#d0b088" : "#2a3038");
  shade(ctx, gx - 44, gy - 42, 13, 15, skinL, skinD, OUTLINE, 5);
  shade(ctx, gx + 46, gy - 40, 13, 15, skinL, skinD, OUTLINE, 5);
  shade(ctx, gx, gy - 98, 48, 44, skinL, skinD, OUTLINE, 7);
  if (variant === 0) {
    shade(ctx, gx, gy - 128, 30, 16, "#a05028", "#6a2810", OUTLINE, 5);
    oval(ctx, gx, gy - 138, 9, 8, "#e8c56b", OUTLINE, 4);
  } else {
    shade(ctx, gx, gy - 124, 36, 18, "#e04040", "#8a1818", OUTLINE, 5);
    shade(ctx, gx, gy - 116, 32, 8, "#3a3a40", "#121214", OUTLINE, 4);
  }
  shade(ctx, gx - 15, gy - 102, 12, 14, "#fff6e4", "#e8d8b0", OUTLINE, 4);
  shade(ctx, gx + 17, gy - 100, 11, 13, "#fff6e4", "#e8d8b0", OUTLINE, 4);
  oval(ctx, gx - 13, gy - 101, 4.6, 5.6, "#1a120e");
  oval(ctx, gx + 18, gy - 99, 4.2, 5.2, "#1a120e");
  ctx.beginPath();
  ctx.arc(gx, gy - 82, 13, 0.15, Math.PI - 0.1);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawMegaBoss(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gx = w / 2;
  const gy = h * 0.9;
  shadow(ctx, gx, gy, 62, 20);
  const skinL = "#b8e878";
  const skinD = "#6a9438";
  shade(ctx, gx - 28, gy - 14, 18, 11, "#3a2818", "#1a1008", OUTLINE, 6);
  shade(ctx, gx + 30, gy - 14, 18, 11, "#3a2818", "#1a1008", OUTLINE, 6);
  shade(ctx, gx, gy - 58, 64, 52, "#5a2878", "#2a1048", OUTLINE, 7);
  shade(ctx, gx, gy - 52, 40, 24, "#e8c56b", "#a07828", OUTLINE, 5);
  shade(ctx, gx - 54, gy - 48, 16, 18, skinL, skinD, OUTLINE, 6);
  shade(ctx, gx + 56, gy - 46, 16, 18, skinL, skinD, OUTLINE, 6);
  shade(ctx, gx, gy - 112, 56, 52, skinL, skinD, OUTLINE, 8);
  shade(ctx, gx, gy - 148, 38, 20, "#e8c56b", "#a07828", OUTLINE, 6);
  shade(ctx, gx - 22, gy - 156, 10, 14, "#ffe08a", "#c8a040", OUTLINE, 4);
  shade(ctx, gx, gy - 162, 10, 16, "#ffe08a", "#c8a040", OUTLINE, 4);
  shade(ctx, gx + 22, gy - 156, 10, 14, "#ffe08a", "#c8a040", OUTLINE, 4);
  oval(ctx, gx, gy - 170, 10, 9, "#fff6c8", OUTLINE, 4);
  shade(ctx, gx - 18, gy - 118, 14, 16, "#fff6e4", "#e8d8b0", OUTLINE, 4);
  shade(ctx, gx + 20, gy - 116, 13, 15, "#fff6e4", "#e8d8b0", OUTLINE, 4);
  oval(ctx, gx - 16, gy - 117, 5.2, 6.2, "#ff4040");
  oval(ctx, gx + 21, gy - 115, 4.8, 5.8, "#ff4040");
  ctx.beginPath();
  ctx.arc(gx, gy - 96, 16, 0.1, Math.PI - 0.08);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gx - 8, gy - 88);
  ctx.lineTo(gx + 2, gy - 78);
  ctx.lineTo(gx + 12, gy - 88);
  ctx.strokeStyle = "#2a1048";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawTree(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gx = w / 2;
  const gy = h * 0.92;
  shadow(ctx, gx, gy, 28, 10);
  capsule(ctx, gx, gy - 8, gx, gy - 58, 8, "#8a5a32", OUTLINE, 5);
  shade(ctx, gx, gy - 84, 40, 34, "#6bc85a", "#2e7a32", OUTLINE, 6);
  shade(ctx, gx - 18, gy - 74, 24, 20, "#7ed86a", "#3d8a38", OUTLINE, 4);
  shade(ctx, gx + 16, gy - 96, 22, 18, "#8ae078", "#4a9a40");
  oval(ctx, gx + 10, gy - 104, 6, 6, "#e85a4a", OUTLINE, 3);
  oval(ctx, gx - 20, gy - 90, 5, 5, "#ffb14a", OUTLINE, 3);
}

function drawLamp(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gx = w / 2;
  const gy = h * 0.92;
  shadow(ctx, gx, gy, 14, 6);
  capsule(ctx, gx, gy - 6, gx, gy - 92, 5, "#6a717c", OUTLINE, 4);
  shade(ctx, gx, gy - 104, 17, 17, "#fff0a8", "#e0a040", OUTLINE, 4);
  oval(ctx, gx - 4, gy - 108, 5, 5, "#fffbeb");
}

function drawStone(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gx = w / 2;
  const gy = h * 0.88;
  shadow(ctx, gx, gy, 18, 7);
  shade(ctx, gx, gy - 22, 20, 16, "#c8c2b4", "#8a8478", OUTLINE, 5);
  shade(ctx, gx - 8, gy - 28, 10, 8, "#d8d2c4", "#9a9488");
}

function drawCar(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gx = w / 2;
  const gy = h * 0.78;
  shadow(ctx, gx, gy + 18, 38, 12);
  shade(ctx, gx - 24, gy + 16, 9, 9, "#3a3a42", "#1a1a20", OUTLINE, 4);
  shade(ctx, gx + 24, gy + 16, 9, 9, "#3a3a42", "#1a1a20", OUTLINE, 4);
  shade(ctx, gx, gy, 40, 18, "#7ed2ea", "#3a88a8", OUTLINE, 5);
  shade(ctx, gx, gy - 16, 22, 14, "#eef8ff", "#9cc8dc", OUTLINE, 4);
  oval(ctx, gx + 28, gy - 2, 4, 4, "#ffe08a");
}

function drawBush(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gx = w / 2;
  const gy = h * 0.86;
  shadow(ctx, gx, gy, 20, 8);
  shade(ctx, gx, gy - 16, 26, 18, "#5cb24a", "#2e7a32", OUTLINE, 5);
  shade(ctx, gx - 12, gy - 10, 14, 12, "#6ec85a", "#3d8a38");
  oval(ctx, gx + 8, gy - 22, 6, 6, "#e85a4a", OUTLINE, 3);
}

function drawCamp(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gx = w / 2;
  const gy = h * 0.88;
  shadow(ctx, gx, gy, 30, 11);
  shade(ctx, gx, gy - 28, 36, 22, "#f0d078", "#c48a28", OUTLINE, 5);
  shade(ctx, gx, gy - 42, 22, 16, "#ffe08a", "#d4a040", OUTLINE, 4);
  shade(ctx, gx, gy - 10, 28, 8, "#8a5a32", "#5a3818", OUTLINE, 4);
}

function drawBarrel(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gx = w / 2;
  const gy = h * 0.86;
  shadow(ctx, gx, gy, 16, 6);
  shade(ctx, gx, gy - 18, 18, 22, "#d4a06a", "#8a5a32", OUTLINE, 5);
  oval(ctx, gx, gy - 36, 16, 6, "#c49058", OUTLINE, 3);
  oval(ctx, gx, gy - 18, 17, 5, "rgba(80,40,16,0.25)");
}

function drawBlade(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const y = h / 2;
  const g = ctx.createLinearGradient(40, 0, w - 8, 0);
  g.addColorStop(0, "#e8eef6");
  g.addColorStop(0.4, "#f8fbff");
  g.addColorStop(1, "#8a98aa");
  ctx.beginPath();
  ctx.moveTo(50, y - 9);
  ctx.quadraticCurveTo(w * 0.52, y - 16, w - 22, y - 3);
  ctx.lineTo(w - 8, y);
  ctx.lineTo(w - 22, y + 4);
  ctx.quadraticCurveTo(w * 0.52, y + 11, 50, y + 9);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(58, y - 3);
  ctx.quadraticCurveTo(w * 0.55, y - 7, w - 36, y - 0.5);
  ctx.strokeStyle = "rgba(255,255,255,0.88)";
  ctx.lineWidth = 2.2;
  ctx.stroke();
  shade(ctx, 42, y, 15, 15, "#f0d078", "#b07818", OUTLINE, 3);
  capsule(ctx, 10, y, 38, y, 7, "#6a4430", OUTLINE, 3);
  shade(ctx, 14, y + 10, 5, 8, "#c45c4a", "#8a2818", OUTLINE, 2);
}

function drawSpear(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const y = h / 2;
  capsule(ctx, 14, y, w - 78, y, 4.5, "#8a5a32", OUTLINE, 3);
  ctx.beginPath();
  ctx.moveTo(w - 92, y - 5);
  ctx.lineTo(w - 78, y - 11);
  ctx.lineTo(w - 8, y);
  ctx.lineTo(w - 78, y + 11);
  ctx.lineTo(w - 92, y + 5);
  ctx.closePath();
  const g = ctx.createLinearGradient(w - 90, 0, w - 8, 0);
  g.addColorStop(0, "#d8e0ea");
  g.addColorStop(1, "#7a889a");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.stroke();
  shade(ctx, 22, y, 7, 7, "#c4a06a", "#6a4430", OUTLINE, 3);
  shade(ctx, w - 86, y, 8, 8, "#d4b36a", "#8a6a28", OUTLINE, 2);
}

function drawGrave(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gx = w / 2;
  const gy = h * 0.88;
  shadow(ctx, gx, gy, 18, 7);
  shade(ctx, gx, gy - 24, 20, 26, "#a8a4a0", "#6e6a68", OUTLINE, 5);
  shade(ctx, gx, gy - 42, 16, 14, "#b8b4b0", "#787470", OUTLINE, 4);
  ctx.beginPath();
  ctx.moveTo(gx - 7, gy - 34);
  ctx.lineTo(gx, gy - 44);
  ctx.lineTo(gx + 7, gy - 34);
  ctx.closePath();
  ctx.fillStyle = "#c8c4c0";
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.stroke();
  oval(ctx, gx - 5, gy - 28, 1.8, 2.4, "#4e4a48");
  oval(ctx, gx + 5, gy - 28, 1.8, 2.4, "#4e4a48");
  shade(ctx, gx - 14, gy - 10, 9, 6, "#6e8a4a", "#3e5a2a", OUTLINE, 3);
  shade(ctx, gx + 14, gy - 12, 9, 6, "#6e8a4a", "#3e5a2a", OUTLINE, 3);
}

function bake(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Texture {
  const { canvas, ctx } = makeCanvas(w, h);
  paint(ctx, w, h);
  return textureFrom(canvas);
}

export class ArtBank {
  readonly hero: Record<HeroKey, Texture[]>;
  readonly zombie: Record<ZombieKey, Texture[]>;
  readonly boss: Record<BossKey, Texture>;
  readonly megaboss: Texture;
  readonly clone: Texture;
  readonly blade: Texture;
  readonly spear: Texture;
  readonly bow: Texture;
  readonly props: Record<PropKind, Texture>;
  private all: Texture[];

  constructor() {
    const samurai = [0, 1, 2].map((pose) =>
      bake(200, 250, (c, w, h) => drawSamurai(c, w, h, pose as 0 | 1 | 2)),
    );
    const spearman = [0, 1, 2].map((pose) =>
      bake(200, 250, (c, w, h) => drawSpearman(c, w, h, pose as 0 | 1 | 2)),
    );
    const archer = [0, 1, 2].map((pose) =>
      bake(200, 250, (c, w, h) => drawElf(c, w, h, false, pose as 0 | 1 | 2)),
    );
    this.hero = { "hero-1": samurai, "hero-2": spearman, "hero-3": archer };
    this.clone = bake(200, 250, (c, w, h) => drawElf(c, w, h, true, 0));
    this.zombie = {
      "zombie-0": [0, 1, 2].map((pose) => bake(160, 200, (c, w, h) => drawZombie(c, w, h, 0, pose as 0 | 1 | 2))),
      "zombie-1": [0, 1, 2].map((pose) => bake(160, 200, (c, w, h) => drawZombie(c, w, h, 1, pose as 0 | 1 | 2))),
      "zombie-2": [0, 1, 2].map((pose) => bake(160, 200, (c, w, h) => drawZombie(c, w, h, 2, pose as 0 | 1 | 2))),
      "zombie-3": [0, 1, 2].map((pose) => bake(160, 200, (c, w, h) => drawZombie(c, w, h, 3, pose as 0 | 1 | 2))),
    };
    this.boss = {
      "boss-0": bake(200, 250, (c, w, h) => drawBoss(c, w, h, 0)),
      "boss-1": bake(200, 250, (c, w, h) => drawBoss(c, w, h, 1)),
    };
    this.megaboss = bake(240, 300, drawMegaBoss);
    this.blade = bake(340, 72, drawBlade);
    this.spear = bake(380, 64, drawSpear);
    this.bow = bake(120, 220, drawBow);
    this.props = {
      tree: bake(140, 180, drawTree),
      lamp: bake(72, 170, drawLamp),
      stone: bake(90, 80, drawStone),
      car: bake(160, 110, drawCar),
      bush: bake(100, 80, drawBush),
      camp: bake(140, 110, drawCamp),
      crate: bake(90, 80, drawBarrel),
      grave: bake(100, 110, drawGrave),
    };
    this.all = [
      ...samurai,
      ...spearman,
      ...archer,
      this.clone,
      ...Object.values(this.zombie).flat(),
      ...Object.values(this.boss),
      this.megaboss,
      this.blade,
      this.spear,
      this.bow,
      ...Object.values(this.props),
    ];
  }

  destroy(): void {
    for (const t of this.all) t.destroy(true);
  }
}

export const SPRITE_SIZE = {
  hero: { w: 1.28, h: 1.68 },
  minion: { w: 1.58, h: 1.98 },
  boss: { w: 2.5, h: 3.1 },
  megaboss: { w: 3.15, h: 3.85 },
  clone: { w: 1.22, h: 1.6 },
  tree: { w: 2.2, h: 2.9 },
  lamp: { w: 0.72, h: 2.2 },
  stone: { w: 0.95, h: 0.85 },
  car: { w: 2.2, h: 1.45 },
  bush: { w: 1.18, h: 0.92 },
  camp: { w: 1.65, h: 1.28 },
  crate: { w: 0.9, h: 0.82 },
  grave: { w: 1.0, h: 1.15 },
} as const;
