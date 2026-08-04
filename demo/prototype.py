"""
Music Musou — pixel prototype (Protagonist Template v0).

Green 1-cell player, circular attack radius 2 cells, beat-on 2x damage.
Slide (Shift), attack (Enter), ultimate (Space) after 5 beat-on successes.
"""

from __future__ import annotations

import math
import os
import sys
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path

import pygame

sys.path.insert(0, str(Path(__file__).resolve().parent))
from input_move import KeyboardHoldState, apply_movement
from touch_controls import CONTROL_STRIP_H, TouchControls
from demo_music import (
    DEFAULT_AUDIO_LATENCY_MS,
    MusicProfile,
    music_timeline_ms,
    play_music_profile,
    profile_for_template_key,
    toggle_music_mute,
)
from tutorial import draw_tutorial_hints, ui_font

# Cache rendered status-line surfaces (text only changes on state change).
_STATUS_TEXT_CACHE: dict[str, pygame.Surface] = {}

from visuals import (
    PLAYER_HIT_SIZE,
    CombatFX,
    VisualAssets,
    build_visual_assets,
    draw_attack_tiles,
    draw_beat_hud_indicator,
    draw_beat_vignette,
    draw_boss_bar,
    draw_enemy_sprite,
    draw_enemy_attack_range,
    draw_hp_hearts,
    draw_hud_panel,
    draw_laser_beam,
    draw_playfield_with_offset,
    draw_player_sprite,
    draw_t3_bullet,
    draw_t3_clone_sprite,
    draw_ultimate_charge_pips,
    draw_ultimate_laser_rect,
)

# --- World & viewport ---
WORLD_W, WORLD_H = 96, 72
VIEW_W, VIEW_H = 24, 18
CELL = 28
HUD = 56
SPAWN_GX = WORLD_W // 2
SPAWN_GY = WORLD_H // 2

BEAT_WINDOW_MS = 320  # 总窗宽；配合音频延迟补偿

MINION_COUNT = 48
BOSS_COUNT = 4
MINION_HP = 2
BOSS_HP = 12
SPAWN_CLEAR_RADIUS = 7
MIN_ENEMY_SPAWN_DIST = 10
PLAYER_HP = 10
PLAYER_SPEED = 5.5  # grid cells per second
MINION_SPEED = 1.8
BOSS_SPEED = 1.1
ATTACK_RANGE = 2.0  # grid cells, Euclidean / pixel circle
ATTACK_COOLDOWN_MS = 280
BASIC_ATTACK_DAMAGE = 1
CONTACT_DAMAGE = 1
CONTACT_IFRAME_MS = 500

SLIDE_DISTANCE_CELLS = 3.0  # 滑步距离（3 格）
SLIDE_DURATION_MS = 110
SLIDE_COOLDOWN_MS = 360
SLIDE_PATH_SAMPLE_CELLS = 0.55  # 路径采样（格），用于同步攻击判定/动画

TEMPLATE2_ATTACK_RANGE = 3.0
TEMPLATE_COOLDOWN_EXTRA_MS = 100
TEMPLATE2_ULT_BUFF_MS = 5000
TEMPLATE2_ULT_RADIUS_BONUS = 1.0
TEMPLATE2_ULT_DAMAGE_BONUS = 1

TEMPLATE3_BULLET_RANGE = 5.0
TEMPLATE3_BULLET_SPEED = PLAYER_SPEED * 2.0
TEMPLATE3_LOCK_RANGE = 18.0
TEMPLATE3_CLONE_HP = 5
TEMPLATE3_DAMAGE_FACTOR = 0.5

ULTIMATE_BEAT_CHARGES = 5
ULTIMATE_RANGE = 4.0
ULTIMATE_DAMAGE = BASIC_ATTACK_DAMAGE * 3

COLOR_BG = (18, 18, 24)
COLOR_GRID = (32, 32, 42)
COLOR_PLAYER = (60, 220, 90)
COLOR_MINION = (240, 210, 60)
COLOR_BOSS = (255, 140, 40)
COLOR_BEAT = (120, 180, 255)
COLOR_UI = (220, 220, 230)
COLOR_WIN = (80, 200, 120)
COLOR_LOSE = (220, 80, 80)


class Kind(Enum):
    MINION = auto()
    BOSS = auto()


@dataclass
class Enemy:
    kind: Kind
    gx: float
    gy: float
    hp: int
    max_hp: int

    @property
    def size(self) -> int:
        return 2 if self.kind == Kind.MINION else 3

    def contains(self, tx: int, ty: int) -> bool:
        s = self.size
        return self.gx <= tx < self.gx + s and self.gy <= ty < self.gy + s


class RunState(Enum):
    TUTORIAL = auto()
    PLAYING = auto()
    WIN = auto()
    LOSE = auto()


class ProtagonistTemplate(Enum):
    """1 近战圆；2 半圆强化大招；3 锁定激光。"""

    ONE = 1
    TWO = 2
    THREE = 3


@dataclass
class T3Clone:
    """3 号大招分身：固定站位、与主角同步普攻、嘲讽。"""

    gx: float
    gy: float
    hp: int = TEMPLATE3_CLONE_HP
    max_hp: int = TEMPLATE3_CLONE_HP


@dataclass
class T3Bullet:
    """3 号：1 格子弹（格坐标，中心点 x,y）。"""

    ox: float
    oy: float
    x: float
    y: float
    ux: float
    uy: float
    traveled: float
    max_range: float
    damage: int
    pierce: bool
    enhanced: bool
    hit_ids: set[int] = field(default_factory=set)
    active: bool = True


@dataclass
class LaserFlash:
    ox: float
    oy: float
    ux: float
    uy: float
    length: float
    half_w: float
    enhanced: bool
    ultimate: bool
    until_ms: int
    mode: str = "beam"  # beam | ult_rect


def player_max_hp(template: ProtagonistTemplate) -> int:
    if template == ProtagonistTemplate.TWO:
        return 8
    if template == ProtagonistTemplate.THREE:
        return 5
    return PLAYER_HP


def parse_start_template() -> ProtagonistTemplate:
    for arg in sys.argv[1:]:
        if arg.startswith("--template="):
            val = arg.split("=", 1)[1].strip()
            if val in ("3", "T3", "three"):
                return ProtagonistTemplate.THREE
            if val in ("2", "T2", "two"):
                return ProtagonistTemplate.TWO
    return ProtagonistTemplate.ONE


def attack_cooldown_ms(template: ProtagonistTemplate) -> int:
    base = ATTACK_COOLDOWN_MS
    if template == ProtagonistTemplate.TWO:
        return base + TEMPLATE_COOLDOWN_EXTRA_MS
    return base


def slide_cooldown_ms(template: ProtagonistTemplate) -> int:
    base = SLIDE_COOLDOWN_MS
    if template == ProtagonistTemplate.TWO:
        return base + TEMPLATE_COOLDOWN_EXTRA_MS
    return base


def attack_radius_cells(template: ProtagonistTemplate, ult_buff: bool) -> float:
    if template == ProtagonistTemplate.TWO:
        return TEMPLATE2_ATTACK_RANGE + (TEMPLATE2_ULT_RADIUS_BONUS if ult_buff else 0.0)
    return ATTACK_RANGE


def attack_damage(template: ProtagonistTemplate, on_beat: bool, ult_buff: bool) -> int:
    if template == ProtagonistTemplate.TWO and ult_buff:
        return 3 if on_beat else 2
    return BASIC_ATTACK_DAMAGE * (2 if on_beat else 1)


def _point_in_semicircle_px(
    cx: float, cy: float, px: float, py: float, r_px: float, fx: float, fy: float
) -> bool:
    dx, dy = px - cx, py - cy
    dist_sq = dx * dx + dy * dy
    if dist_sq > r_px * r_px:
        return False
    if dist_sq < 1e-6:
        return True
    return dx * fx + dy * fy >= 0.0


def enemy_in_semicircle(px: float, py: float, e: Enemy, r: float, fx: float, fy: float) -> bool:
    cx, cy = attack_center_px(px, py)
    r_px = r * CELL
    for rect in enemy_cell_rects(e):
        for ox in (rect.left, rect.centerx, rect.right):
            for oy in (rect.top, rect.centery, rect.bottom):
                if _point_in_semicircle_px(cx, cy, float(ox), float(oy), r_px, fx, fy):
                    return True
    return False


def enemies_in_attack_shape(
    px: float,
    py: float,
    enemies: list[Enemy],
    template: ProtagonistTemplate,
    radius: float,
    facing: tuple[float, float],
) -> list[Enemy]:
    if template == ProtagonistTemplate.TWO:
        fx, fy = facing
        if fx == 0.0 and fy == 0.0:
            fx, fy = 1.0, 0.0
        return [e for e in enemies if enemy_in_semicircle(px, py, e, radius, fx, fy)]
    return enemies_in_attack(px, py, enemies, radius)


def chebyshev(a: tuple[int, int], b: tuple[int, int]) -> int:
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]))


def _rect_intersects_circle(
    left: float, top: float, right: float, bottom: float, cx: float, cy: float, radius: float
) -> bool:
    closest_x = max(left, min(cx, right))
    closest_y = max(top, min(cy, bottom))
    return math.hypot(closest_x - cx, closest_y - cy) <= radius


def attack_center_px(px: float, py: float) -> tuple[float, float]:
    return (px + 0.5) * CELL, (py + 0.5) * CELL


def attack_tiles(px: float, py: float, r: float) -> list[tuple[int, int]]:
    """Grid cells whose pixel AABB intersects the attack circle."""
    cx, cy = attack_center_px(px, py)
    radius_px = r * CELL
    px_i, py_i = int(px), int(py)
    ri = int(math.ceil(r))
    out: list[tuple[int, int]] = []
    for tx in range(px_i - ri, px_i + ri + 1):
        for ty in range(py_i - ri, py_i + ri + 1):
            if not (0 <= tx < WORLD_W and 0 <= ty < WORLD_H):
                continue
            left, top = tx * CELL, ty * CELL
            right, bottom = left + CELL, top + CELL
            if _rect_intersects_circle(left, top, right, bottom, cx, cy, radius_px):
                out.append((tx, ty))
    return out


def enemy_in_attack_circle(px: float, py: float, e: Enemy, r: float) -> bool:
    cx, cy = attack_center_px(px, py)
    radius_px = r * CELL
    for rect in enemy_cell_rects(e):
        if _rect_intersects_circle(
            float(rect.left), float(rect.top), float(rect.right), float(rect.bottom), cx, cy, radius_px
        ):
            return True
    return False


def enemies_in_attack(px: float, py: float, enemies: list[Enemy], r: float) -> list[Enemy]:
    return [e for e in enemies if enemy_in_attack_circle(px, py, e, r)]


def enemy_in_view(e: Enemy, cam_x: float, cam_y: float, margin: int = 2) -> bool:
    s = e.size
    return not (
        e.gx + s < cam_x - margin
        or e.gx > cam_x + VIEW_W + margin
        or e.gy + s < cam_y - margin
        or e.gy > cam_y + VIEW_H + margin
    )


def nearest_boss(px: float, py: float, enemies: list[Enemy]) -> Enemy | None:
    bosses = [e for e in enemies if e.kind == Kind.BOSS]
    if not bosses:
        return None
    return min(bosses, key=lambda e: math.hypot(e.gx + e.size / 2 - px, e.gy + e.size / 2 - py))


def camera_origin(px: float, py: float) -> tuple[float, float]:
    cam_x = px + 0.5 - VIEW_W / 2
    cam_y = py + 0.5 - VIEW_H / 2
    cam_x = max(0.0, min(float(WORLD_W - VIEW_W), cam_x))
    cam_y = max(0.0, min(float(WORLD_H - VIEW_H), cam_y))
    return cam_x, cam_y


def parse_beat_latency_ms() -> float:
    for arg in sys.argv[1:]:
        if arg.startswith("--beat-latency="):
            return float(arg.split("=", 1)[1].strip())
    return DEFAULT_AUDIO_LATENCY_MS


def parse_beat_window_ms() -> int:
    for arg in sys.argv[1:]:
        if arg.startswith("--beat-window="):
            return int(arg.split("=", 1)[1].strip())
    return BEAT_WINDOW_MS


class BeatGridClock:
    """Judgment synced to explicit beat onsets (regular or irregular loop)."""

    def __init__(
        self,
        profile: MusicProfile,
        *,
        sync_to_music: bool = True,
        audio_latency_ms: float = DEFAULT_AUDIO_LATENCY_MS,
        beat_window_ms: int = BEAT_WINDOW_MS,
    ) -> None:
        self.profile = profile
        self.loop_ms = profile.loop_ms
        self.beat_times_ms = profile.beat_times_ms
        self.period_ms = profile.avg_period_ms
        self.sync_to_music = sync_to_music
        self.audio_latency_ms = audio_latency_ms
        self.beat_window_ms = beat_window_ms

    def timeline_ms(self, fallback_ms: int) -> float:
        if self.sync_to_music:
            return music_timeline_ms(fallback_ms, latency_ms=self.audio_latency_ms)
        return float(fallback_ms)

    def _t_loop(self, fallback_ms: int) -> float:
        t = self.timeline_ms(fallback_ms)
        if self.loop_ms <= 0:
            return 0.0
        return t % self.loop_ms

    def _nearest_beat_distance_ms(self, t_loop: float) -> float:
        best = self.loop_ms
        for bt in self.beat_times_ms:
            d = abs(t_loop - bt)
            d = min(d, self.loop_ms - d)
            if d < best:
                best = d
        return best

    def beat_phase01(self, fallback_ms: int) -> float:
        t = self._t_loop(fallback_ms)
        beats = self.beat_times_ms
        n = len(beats)
        if n == 0:
            return 0.0
        for i in range(n):
            start = beats[i]
            end = beats[(i + 1) % n] + (self.loop_ms if i + 1 >= n else 0.0)
            if start <= t < end:
                span = end - start
                return (t - start) / span if span > 1e-6 else 0.0
        return 0.0

    def hud_window_frac(self) -> float:
        """节拍条左右亮区宽度（与 draw_beat_hud_indicator 一致）。"""
        return max(0.18, min(0.45, self.beat_window_ms / self.period_ms))

    def hud_in_zone(self, fallback_ms: int) -> bool:
        """与节拍条「白点在亮区」完全相同的判定。"""
        p = self.beat_phase01(fallback_ms)
        w = self.hud_window_frac()
        return p <= w or p >= (1.0 - w)

    def judgment_for_combat(
        self,
        input_ms: int,
        *,
        hud_was_ok: bool,
        hud_ms: int,
        hud_grace_ms: int = 55,
    ) -> bool:
        """攻击/滑步卡拍：先按当前时刻的亮区，再认可上一帧画面上的可拍提示。"""
        if self.hud_in_zone(input_ms):
            return True
        if hud_was_ok and 0 <= input_ms - hud_ms <= hud_grace_ms:
            return True
        return False

    def on_beat(self, fallback_ms: int) -> bool:
        """与 HUD 亮区一致（保留旧名供 HUD 文案使用）。"""
        return self.hud_in_zone(fallback_ms)

    def beat_proximity(self, fallback_ms: int) -> float:
        if self.hud_in_zone(fallback_ms):
            return 1.0
        p = self.beat_phase01(fallback_ms)
        w = self.hud_window_frac()
        if p < 0.5:
            gap = max(0.0, p - w)
        else:
            gap = max(0.0, (1.0 - w) - p)
        span = max(0.06, 0.5 - w)
        return max(0.0, 1.0 - gap / span)


def make_beat_clock(
    template: ProtagonistTemplate,
    *,
    sync_to_music: bool,
    audio_latency_ms: float,
    beat_window_ms: int,
) -> BeatGridClock:
    profile = profile_for_template_key(template.value)
    return BeatGridClock(
        profile,
        sync_to_music=sync_to_music,
        audio_latency_ms=audio_latency_ms,
        beat_window_ms=beat_window_ms,
    )


def spawn_enemies() -> list[Enemy]:
    import random

    rng = random.Random(42)
    enemies: list[Enemy] = []
    occupied: set[tuple[int, int]] = set()
    spawn = (SPAWN_GX, SPAWN_GY)

    def mark_block(x: int, y: int, s: int) -> None:
        for i in range(s):
            for j in range(s):
                occupied.add((x + i, y + j))

    def block_free(x: int, y: int, s: int) -> bool:
        cells = [(x + i, y + j) for i in range(s) for j in range(s)]
        return not any(c in occupied for c in cells)

    def free_top_left(s: int, min_dist: int) -> tuple[int, int] | None:
        for _ in range(4000):
            x = rng.randint(1, WORLD_W - s - 1)
            y = rng.randint(1, WORLD_H - s - 1)
            if not block_free(x, y, s):
                continue
            if chebyshev((x, y), spawn) < min_dist:
                continue
            mark_block(x, y, s)
            return x, y
        return None

    for r in range(1, SPAWN_CLEAR_RADIUS + 1):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if max(abs(dx), abs(dy)) == r:
                    occupied.add((spawn[0] + dx, spawn[1] + dy))

    for _ in range(MINION_COUNT):
        dist = MIN_ENEMY_SPAWN_DIST + rng.randint(0, 18)
        pos = free_top_left(2, dist)
        if pos:
            enemies.append(Enemy(Kind.MINION, float(pos[0]), float(pos[1]), MINION_HP, MINION_HP))

    for i in range(BOSS_COUNT):
        dist = MIN_ENEMY_SPAWN_DIST + 12 + i * 6 + rng.randint(0, 8)
        pos = free_top_left(3, dist)
        if pos:
            enemies.append(Enemy(Kind.BOSS, float(pos[0]), float(pos[1]), BOSS_HP, BOSS_HP))
    return enemies



PLAYER_SPRITE = PLAYER_HIT_SIZE


def player_hit_rect(px: float, py: float) -> pygame.Rect:
    half = PLAYER_SPRITE // 2
    cx = int(px * CELL + CELL // 2)
    cy = int(py * CELL + CELL // 2)
    return pygame.Rect(cx - half, cy - half, PLAYER_SPRITE, PLAYER_SPRITE)


def enemy_cell_rects(e: Enemy) -> list[pygame.Rect]:
    s = e.size
    rects: list[pygame.Rect] = []
    for x in range(s):
        for y in range(s):
            rx = (int(e.gx) + x) * CELL + 2
            ry = (int(e.gy) + y) * CELL + 2
            rects.append(pygame.Rect(rx, ry, CELL - 4, CELL - 4))
    return rects


def pixel_contact(px: float, py: float, e: Enemy) -> bool:
    pr = player_hit_rect(px, py)
    return any(pr.colliderect(er) for er in enemy_cell_rects(e))


def any_pixel_contact(px: float, py: float, enemies: list[Enemy]) -> bool:
    return any(pixel_contact(px, py, e) for e in enemies)


def clamp_player(px: float, py: float) -> tuple[float, float]:
    return max(0.0, min(WORLD_W - 1.0, px)), max(0.0, min(WORLD_H - 1.0, py))


def clamp_enemy(e: Enemy) -> None:
    s = e.size
    e.gx = max(0.0, min(WORLD_W - s, e.gx))
    e.gy = max(0.0, min(WORLD_H - s, e.gy))


def move_enemies_toward(px: float, py: float, enemies: list[Enemy], dt_ms: int) -> None:
    dt = dt_ms / 1000.0
    pcx, pcy = px + 0.5, py + 0.5
    for e in enemies:
        ecx = e.gx + e.size / 2
        ecy = e.gy + e.size / 2
        dx, dy = pcx - ecx, pcy - ecy
        dist = math.hypot(dx, dy)
        if dist < 1e-3:
            continue
        spd = MINION_SPEED if e.kind == Kind.MINION else BOSS_SPEED
        step = spd * dt
        e.gx += dx / dist * step
        e.gy += dy / dist * step
        clamp_enemy(e)


def normalize_facing(dx: float, dy: float, last: tuple[float, float]) -> tuple[float, float]:
    if dx == 0.0 and dy == 0.0:
        return last
    d = math.hypot(dx, dy)
    return dx / d, dy / d


def add_beat_charge(charges: int) -> int:
    if charges >= ULTIMATE_BEAT_CHARGES:
        return charges
    return charges + 1


def lock_nearest_enemy_dir(
    px: float, py: float, enemies: list[Enemy], facing: tuple[float, float]
) -> tuple[float, float]:
    """普攻/滑步强普：朝最近敌人（无敌人时用 facing）。"""
    return t3_lock_direction(px, py, enemies, facing)


def t3_lock_direction(
    px: float, py: float, enemies: list[Enemy], facing: tuple[float, float]
) -> tuple[float, float]:
    ox, oy = px + 0.5, py + 0.5
    best: Enemy | None = None
    best_d = TEMPLATE3_LOCK_RANGE + 1.0
    for e in enemies:
        ecx = e.gx + e.size / 2
        ecy = e.gy + e.size / 2
        d = math.hypot(ecx - ox, ecy - oy)
        if d < best_d:
            best_d = d
            best = e
    if best is None:
        fx, fy = facing
        if fx == 0.0 and fy == 0.0:
            return 1.0, 0.0
        return fx, fy
    ecx = best.gx + best.size / 2
    ecy = best.gy + best.size / 2
    dx, dy = ecx - ox, ecy - oy
    d = math.hypot(dx, dy)
    if d < 1e-6:
        return facing if facing != (0.0, 0.0) else (1.0, 0.0)
    return dx / d, dy / d


def _enemy_sample_points(e: Enemy) -> list[tuple[float, float]]:
    s = e.size
    return [
        (e.gx + s / 2, e.gy + s / 2),
        (e.gx, e.gy),
        (e.gx + s, e.gy),
        (e.gx, e.gy + s),
        (e.gx + s, e.gy + s),
    ]


def _point_in_beam(
    px: float,
    py: float,
    ox: float,
    oy: float,
    ux: float,
    uy: float,
    length: float,
    half_w: float,
) -> bool:
    dx, dy = px - ox, py - oy
    along = dx * ux + dy * uy
    if along < 0.0 or along > length:
        return False
    perp = abs(dx * uy - dy * ux)
    return perp <= half_w


def enemy_in_laser_beam(
    e: Enemy,
    ox: float,
    oy: float,
    ux: float,
    uy: float,
    length: float,
    half_w: float,
) -> bool:
    margin = e.size * 0.45
    for px, py in _enemy_sample_points(e):
        if _point_in_beam(px, py, ox, oy, ux, uy, length, half_w + margin):
            return True
    return False


def enemies_hit_by_laser(
    ox: float,
    oy: float,
    ux: float,
    uy: float,
    length: float,
    half_w: float,
    enemies: list[Enemy],
    *,
    pierce: bool,
) -> list[Enemy]:
    hits = [e for e in enemies if enemy_in_laser_beam(e, ox, oy, ux, uy, length, half_w)]
    if pierce or len(hits) <= 1:
        return hits
    scored: list[tuple[float, Enemy]] = []
    for e in hits:
        ecx = e.gx + e.size / 2
        ecy = e.gy + e.size / 2
        t = (ecx - ox) * ux + (ecy - oy) * uy
        scored.append((t, e))
    scored.sort(key=lambda x: x[0])
    return [scored[0][1]]


def enemy_in_ult_laser_rect(
    e: Enemy,
    ox: float,
    oy: float,
    fx: float,
    fy: float,
    length: float,
    width: float,
) -> bool:
    half_w = width * 0.5
    margin = e.size * 0.45
    for px, py in _enemy_sample_points(e):
        dx, dy = px - ox, py - oy
        along = dx * fx + dy * fy
        if along < 0.0 or along > length:
            continue
        perp = abs(dx * fy - dy * fx)
        if perp <= half_w + margin:
            return True
    return False


def bullet_overlaps_enemy(cx: float, cy: float, e: Enemy) -> bool:
    """子弹占 1×1 格（中心 cx,cy），与敌人块 AABB 相交。"""
    bl, bt = cx - 0.5, cy - 0.5
    br, bb = cx + 0.5, cy + 0.5
    el, et = e.gx, e.gy
    er, eb = e.gx + e.size, e.gy + e.size
    return not (er <= bl or el >= br or eb <= bt or et >= bb)


def enemies_hit_by_bullet(
    cx: float, cy: float, enemies: list[Enemy], *, pierce: bool
) -> list[Enemy]:
    hits = [e for e in enemies if bullet_overlaps_enemy(cx, cy, e)]
    if pierce or len(hits) <= 1:
        return hits
    return [
        min(
            hits,
            key=lambda e: math.hypot(e.gx + e.size / 2 - cx, e.gy + e.size / 2 - cy),
        )
    ]


def t3_bullet_damage(on_beat: bool) -> int:
    full = BASIC_ATTACK_DAMAGE * (2 if on_beat else 1)
    scaled = full * TEMPLATE3_DAMAGE_FACTOR
    return max(1, int(round(scaled)))


def spawn_t3_bullet(
    px: float,
    py: float,
    enemies: list[Enemy],
    on_beat: bool,
    facing: tuple[float, float],
) -> tuple[T3Bullet, tuple[float, float]]:
    ox, oy = px + 0.5, py + 0.5
    ux, uy = t3_lock_direction(px, py, enemies, facing)
    enhanced = on_beat
    dmg = t3_bullet_damage(enhanced)
    proj = T3Bullet(
        ox=ox,
        oy=oy,
        x=ox,
        y=oy,
        ux=ux,
        uy=uy,
        traveled=0.0,
        max_range=TEMPLATE3_BULLET_RANGE,
        damage=dmg,
        pierce=enhanced,
        enhanced=enhanced,
    )
    return proj, (ux, uy)


def spawn_t3_slide_bullet(
    px: float, py: float, enemies: list[Enemy], facing: tuple[float, float]
) -> tuple[T3Bullet, tuple[float, float]]:
    """卡拍滑步：一发强化子弹，自动锁敌。"""
    proj, aim = spawn_t3_bullet(px, py, enemies, True, facing)
    return proj, aim


def update_t3_bullets(
    projectiles: list[T3Bullet],
    enemies: list[Enemy],
    dt_sec: float,
) -> tuple[list[T3Bullet], list[Enemy], RunState | None]:
    step_cap = TEMPLATE3_BULLET_SPEED * dt_sec
    for p in projectiles:
        if not p.active:
            continue
        remain = p.max_range - p.traveled
        step = min(step_cap, remain)
        if step <= 1e-6:
            p.active = False
            continue
        p.x += p.ux * step
        p.y += p.uy * step
        p.traveled += step
        hits = enemies_hit_by_bullet(p.x, p.y, enemies, pierce=p.pierce)
        for e in hits:
            eid = id(e)
            if eid in p.hit_ids:
                continue
            p.hit_ids.add(eid)
            e.hp -= p.damage
            if not p.pierce:
                p.active = False
                break
        if p.traveled >= p.max_range - 1e-6:
            p.active = False
    enemies = [e for e in enemies if e.hp > 0]
    run = RunState.WIN if not enemies else None
    alive = [p for p in projectiles if p.active]
    return alive, enemies, run


def spawn_t3_clone(px: float, py: float) -> T3Clone:
    return T3Clone(gx=px, gy=py)


def fire_t3_clone_attack(
    clone: T3Clone,
    enemies: list[Enemy],
    on_beat: bool,
) -> T3Bullet:
    bullet, _ = spawn_t3_bullet(clone.gx, clone.gy, enemies, on_beat, (1.0, 0.0))
    return bullet


def apply_normal_attack(
    px: float,
    py: float,
    enemies: list[Enemy],
    on_beat: bool,
    combat_fx: CombatFX,
    now_ms: int,
    template: ProtagonistTemplate,
    facing: tuple[float, float],
    ult_buff: bool,
) -> tuple[list[Enemy], RunState | None, int]:
    if template == ProtagonistTemplate.THREE:
        raise RuntimeError("use apply_t3_laser_attack for template 3")
    radius = attack_radius_cells(template, ult_buff)
    dmg = attack_damage(template, on_beat, ult_buff)
    hits = enemies_in_attack_shape(px, py, enemies, template, radius, facing)
    if on_beat:
        combat_fx.spawn_beat_attack(px, py, CELL, now_ms)
    for e in hits:
        e.hp -= dmg
    enemies = [e for e in enemies if e.hp > 0]
    run = RunState.WIN if not enemies else None
    mult = 2 if on_beat else 1
    return enemies, run, mult


def apply_ultimate(
    px: float,
    py: float,
    enemies: list[Enemy],
) -> tuple[list[Enemy], RunState | None]:
    hits = enemies_in_attack(px, py, enemies, ULTIMATE_RANGE)
    for e in hits:
        e.hp -= ULTIMATE_DAMAGE
    enemies = [e for e in enemies if e.hp > 0]
    run = RunState.WIN if not enemies else None
    return enemies, run


def sample_slide_path(
    x0: float, y0: float, x1: float, y1: float, step_cells: float
) -> list[tuple[float, float]]:
    dist = math.hypot(x1 - x0, y1 - y0)
    if dist < 1e-6:
        return [(x0, y0)]
    steps = max(2, int(math.ceil(dist / step_cells)) + 1)
    return [
        (x0 + (x1 - x0) * (i / (steps - 1)), y0 + (y1 - y0) * (i / (steps - 1)))
        for i in range(steps)
    ]


def apply_slide_beat_attack(
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    enemies: list[Enemy],
    combat_fx: CombatFX,
    now_ms: int,
    template: ProtagonistTemplate,
    facing: tuple[float, float],
    ult_buff: bool,
) -> tuple[list[Enemy], RunState | None, list[tuple[float, float]]]:
    """Beat-on slide: instant hit + splash at every path sample."""
    if template == ProtagonistTemplate.THREE:
        raise RuntimeError("use apply_t3_slide_radial for template 3")
    path = sample_slide_path(x0, y0, x1, y1, SLIDE_PATH_SAMPLE_CELLS)
    radius = attack_radius_cells(template, ult_buff)
    dmg = attack_damage(template, True, ult_buff)
    hit_ids: set[int] = set()
    for sx, sy in path:
        for e in enemies_in_attack_shape(sx, sy, enemies, template, radius, facing):
            eid = id(e)
            if eid in hit_ids:
                continue
            hit_ids.add(eid)
            e.hp -= dmg
    combat_fx.spawn_beat_attack_path(path, CELL, now_ms)
    enemies = [e for e in enemies if e.hp > 0]
    run = RunState.WIN if not enemies else None
    return enemies, run, path


def is_attack_key(key: int) -> bool:
    return key in (pygame.K_RETURN, pygame.K_KP_ENTER)


def is_slide_key(key: int) -> bool:
    return key in (pygame.K_LSHIFT, pygame.K_RSHIFT)


def main() -> None:
    if "--self-test" in sys.argv:
        from test_input_simulation import run_simulation

        run_simulation()
        return

    touch_mode = "--touch" in sys.argv or os.environ.get("ANDROID_ARGUMENT") is not None

    global VIEW_W, VIEW_H
    if touch_mode:
        VIEW_W, VIEW_H = 32, 16

    pygame.init()
    print("[musou] pygame.init ok", flush=True)
    protagonist_template = parse_start_template()
    beat_audio_latency_ms = parse_beat_latency_ms()
    beat_window_ms = parse_beat_window_ms()

    def start_music_for_template(tpl: ProtagonistTemplate) -> tuple[Path | None, BeatGridClock]:
        if "--no-music" in sys.argv:
            return None, make_beat_clock(
                tpl,
                sync_to_music=False,
                audio_latency_ms=beat_audio_latency_ms,
                beat_window_ms=beat_window_ms,
            )
        path = play_music_profile(profile_for_template_key(tpl.value))
        return path, make_beat_clock(
            tpl,
            sync_to_music=True,
            audio_latency_ms=beat_audio_latency_ms,
            beat_window_ms=beat_window_ms,
        )

    music_path, beat = start_music_for_template(protagonist_template)
    print(f"[musou] music ok path={music_path}", flush=True)
    pygame.display.set_caption("Music Musou — Pixel Prototype")
    w, h = VIEW_W * CELL, VIEW_H * CELL + HUD
    flags = pygame.SCALED | pygame.RESIZABLE if touch_mode else 0
    screen = pygame.display.set_mode((w, h), flags)
    print(f"[musou] set_mode ok size={screen.get_size()} flags={flags}", flush=True)
    if hasattr(pygame.key, "stop_text_input"):
        pygame.key.stop_text_input()
    clock = pygame.time.Clock()
    font = ui_font(18)

    music_muted = False
    skip_tutorial = "--skip-tutorial" in sys.argv
    ultimate_buff_until = 0
    px, py = float(SPAWN_GX), float(SPAWN_GY)
    enemies: list[Enemy] = [] if not skip_tutorial else spawn_enemies()
    player_hp = player_max_hp(protagonist_template)
    beat_charges = 0
    run = RunState.PLAYING if skip_tutorial else RunState.TUTORIAL
    last_attack_ms = -9999
    last_slide_ms = -9999
    last_hurt_ms = -9999
    slide_until = 0
    slide_from_x = slide_from_y = 0.0
    slide_to_x = slide_to_y = 0.0
    last_facing = (1.0, 0.0)
    flash_until = 0
    flash_at_px = 0.0
    flash_at_py = 0.0
    flash_radius = ATTACK_RANGE
    flash_centers: list[tuple[float, float]] | None = None
    flash_on_beat = False
    flash_ultimate = False
    flash_facing: tuple[float, float] | None = None
    laser_flashes: list[LaserFlash] = []
    t3_bullets: list[T3Bullet] = []
    t3_clone: T3Clone | None = None
    clone_last_hurt_ms = -9999
    keyboard = KeyboardHoldState()
    input_armed = touch_mode  # touch: no "click to focus"; stick always moves player
    assets = build_visual_assets(WORLD_W, WORLD_H, CELL, hud_width=VIEW_W * CELL)
    combat_fx = CombatFX()
    touch = TouchControls((w, h)) if touch_mode else None
    print("[musou] touch controls ready", flush=True)
    last_hud_beat_ok = False
    last_hud_beat_ms = -9999

    def combat_on_beat(input_ms: int) -> bool:
        return beat.judgment_for_combat(
            input_ms,
            hud_was_ok=last_hud_beat_ok,
            hud_ms=last_hud_beat_ms,
        )

    def ult_buff_active(now_ms: int) -> bool:
        return (
            protagonist_template == ProtagonistTemplate.TWO and now_ms < ultimate_buff_until
        )

    def begin_combat() -> None:
        nonlocal enemies, run, beat_charges, player_hp, last_hurt_ms
        nonlocal last_slide_ms, slide_until, last_facing, ultimate_buff_until, t3_bullets, t3_clone
        enemies = spawn_enemies()
        beat_charges = 0
        player_hp = player_max_hp(protagonist_template)
        last_hurt_ms = -9999
        last_slide_ms = -9999
        slide_until = 0
        last_facing = (1.0, 0.0)
        ultimate_buff_until = 0
        t3_bullets = []
        t3_clone = None
        run = RunState.PLAYING

    def trigger_normal_attack(now_ms: int, *, ignore_cooldown: bool = False) -> None:
        nonlocal enemies, run, beat_charges, last_attack_ms, last_facing
        nonlocal flash_until, flash_at_px, flash_at_py, flash_radius, flash_centers
        nonlocal flash_on_beat, flash_ultimate, flash_facing, laser_flashes, t3_bullets, t3_clone
        cd = attack_cooldown_ms(protagonist_template)
        if not ignore_cooldown and now_ms - last_attack_ms < cd:
            return
        last_attack_ms = now_ms
        on_beat = combat_on_beat(now_ms)
        if protagonist_template == ProtagonistTemplate.THREE:
            proj, aim = spawn_t3_bullet(px, py, enemies, on_beat, last_facing)
            last_facing = aim
            t3_bullets.append(proj)
            if t3_clone is not None and t3_clone.hp > 0:
                t3_bullets.append(fire_t3_clone_attack(t3_clone, enemies, on_beat))
            if on_beat:
                combat_fx.spawn_beat_attack(px, py, CELL, now_ms)
                beat_charges = add_beat_charge(beat_charges)
            return
        buff = ult_buff_active(now_ms)
        attack_facing = last_facing
        if protagonist_template == ProtagonistTemplate.TWO:
            attack_facing = lock_nearest_enemy_dir(px, py, enemies, last_facing)
        enemies, win, _mult = apply_normal_attack(
            px,
            py,
            enemies,
            on_beat,
            combat_fx,
            now_ms,
            protagonist_template,
            attack_facing,
            buff,
        )
        if on_beat:
            beat_charges = add_beat_charge(beat_charges)
        if win and run == RunState.PLAYING:
            run = win
        flash_centers = None
        flash_at_px, flash_at_py = px, py
        flash_radius = attack_radius_cells(protagonist_template, buff)
        flash_until = now_ms + 120
        flash_on_beat = on_beat
        flash_ultimate = False
        flash_facing = (
            attack_facing if protagonist_template == ProtagonistTemplate.TWO else None
        )

    def trigger_ultimate(now_ms: int) -> None:
        nonlocal enemies, run, beat_charges, ultimate_buff_until
        nonlocal flash_until, flash_at_px, flash_at_py, flash_radius, flash_centers
        nonlocal flash_on_beat, flash_ultimate, flash_facing, laser_flashes, t3_clone, clone_last_hurt_ms
        if beat_charges < ULTIMATE_BEAT_CHARGES:
            return
        beat_charges = 0
        flash_facing = None
        if protagonist_template == ProtagonistTemplate.THREE:
            t3_clone = spawn_t3_clone(px, py)
            clone_last_hurt_ms = -9999
            combat_fx.spawn_beat_attack(px, py, CELL, now_ms)
            flash_until = now_ms + 200
            flash_at_px, flash_at_py = px, py
            flash_on_beat = True
            flash_ultimate = True
            return
        if protagonist_template == ProtagonistTemplate.TWO:
            ultimate_buff_until = now_ms + TEMPLATE2_ULT_BUFF_MS
            combat_fx.spawn_beat_attack(px, py, CELL, now_ms)
            flash_centers = None
            flash_at_px, flash_at_py = px, py
            flash_radius = attack_radius_cells(ProtagonistTemplate.TWO, True)
            flash_until = now_ms + 200
            flash_on_beat = True
            flash_ultimate = True
            flash_facing = last_facing
            return
        enemies, win = apply_ultimate(px, py, enemies)
        if win and run == RunState.PLAYING:
            run = win
        flash_centers = None
        flash_at_px, flash_at_py = px, py
        flash_radius = ULTIMATE_RANGE
        flash_until = now_ms + 200
        flash_on_beat = False
        flash_ultimate = True

    def start_slide(now_ms: int, dir_x: float, dir_y: float) -> None:
        nonlocal px, py, slide_until, slide_from_x, slide_from_y, slide_to_x, slide_to_y
        nonlocal last_slide_ms, last_facing, enemies, run, beat_charges
        nonlocal flash_until, flash_at_px, flash_at_py, flash_radius, flash_centers
        nonlocal flash_on_beat, flash_ultimate, flash_facing, laser_flashes, t3_bullets
        scd = slide_cooldown_ms(protagonist_template)
        if now_ms < slide_until or now_ms - last_slide_ms < scd:
            return
        fx, fy = normalize_facing(dir_x, dir_y, last_facing)
        if fx == 0.0 and fy == 0.0:
            return
        last_facing = (fx, fy)
        last_slide_ms = now_ms
        slide_from_x, slide_from_y = px, py
        tx = px + fx * SLIDE_DISTANCE_CELLS
        ty = py + fy * SLIDE_DISTANCE_CELLS
        tx, ty = clamp_player(tx, ty)
        slide_to_x, slide_to_y = tx, ty
        slide_until = now_ms + SLIDE_DURATION_MS
        buff = ult_buff_active(now_ms)
        if combat_on_beat(now_ms):
            if protagonist_template == ProtagonistTemplate.THREE:
                proj, aim = spawn_t3_slide_bullet(
                    slide_from_x, slide_from_y, enemies, last_facing
                )
                last_facing = aim
                t3_bullets.append(proj)
                combat_fx.spawn_beat_attack(slide_from_x, slide_from_y, CELL, now_ms)
                beat_charges = add_beat_charge(beat_charges)
                return
            slide_aim = last_facing
            if protagonist_template == ProtagonistTemplate.TWO:
                slide_aim = lock_nearest_enemy_dir(
                    slide_from_x, slide_from_y, enemies, (fx, fy)
                )
            enemies, win, path = apply_slide_beat_attack(
                slide_from_x,
                slide_from_y,
                slide_to_x,
                slide_to_y,
                enemies,
                combat_fx,
                now_ms,
                protagonist_template,
                slide_aim,
                buff,
            )
            beat_charges = add_beat_charge(beat_charges)
            if win and run == RunState.PLAYING:
                run = win
            flash_centers = path
            flash_at_px, flash_at_py = slide_from_x, slide_from_y
            flash_radius = attack_radius_cells(protagonist_template, buff)
            flash_until = now_ms + 160
            flash_on_beat = True
            flash_ultimate = False
            flash_facing = (
                slide_aim if protagonist_template == ProtagonistTemplate.TWO else None
            )

    def switch_template(tpl: ProtagonistTemplate) -> None:
        nonlocal protagonist_template, ultimate_buff_until, player_hp
        nonlocal music_path, music_muted, beat
        protagonist_template = tpl
        ultimate_buff_until = 0
        player_hp = min(player_hp, player_max_hp(protagonist_template))
        if music_path is not None:
            music_path = play_music_profile(profile_for_template_key(tpl.value))
            music_muted = False
        beat = make_beat_clock(
            protagonist_template,
            sync_to_music=music_path is not None,
            audio_latency_ms=beat_audio_latency_ms,
            beat_window_ms=beat_window_ms,
        )

    def restart_run() -> None:
        nonlocal px, py, player_hp, beat_charges, last_hurt_ms, last_slide_ms
        nonlocal slide_until, last_facing, ultimate_buff_until
        nonlocal t3_bullets, t3_clone, clone_last_hurt_ms, keyboard
        nonlocal enemies, run, music_path, music_muted, beat
        px, py = float(SPAWN_GX), float(SPAWN_GY)
        player_hp = player_max_hp(protagonist_template)
        beat_charges = 0
        last_hurt_ms = -9999
        last_slide_ms = -9999
        slide_until = 0
        last_facing = (1.0, 0.0)
        ultimate_buff_until = 0
        t3_bullets = []
        t3_clone = None
        clone_last_hurt_ms = -9999
        keyboard = KeyboardHoldState()
        if skip_tutorial:
            enemies = spawn_enemies()
            run = RunState.PLAYING
        else:
            enemies = []
            run = RunState.TUTORIAL
        if music_path is not None:
            music_path = play_music_profile(
                profile_for_template_key(protagonist_template.value)
            )
            music_muted = False
            beat = make_beat_clock(
                protagonist_template,
                sync_to_music=True,
                audio_latency_ms=beat_audio_latency_ms,
                beat_window_ms=beat_window_ms,
            )

    frame_count = 0
    while True:
        frame_count += 1
        now = pygame.time.get_ticks()
        dt = clock.tick(60)
        if frame_count % 60 == 0:
            pass  # detailed timing printed after flip

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit(0)
            if event.type == pygame.MOUSEBUTTONDOWN:
                input_armed = True
            if event.type == pygame.WINDOWFOCUSGAINED:
                input_armed = True
            if touch_mode:
                # Real touch screens: only FINGER*. Android/SDL also emits MOUSE*
                # with pixel coords that do not match our logical layout and cause
                # ghost hits on 普攻 while moving the stick.
                if event.type in (
                    pygame.FINGERDOWN,
                    pygame.FINGERUP,
                    pygame.FINGERMOTION,
                ):
                    touch.handle_event(event)
                elif event.type in (
                    pygame.MOUSEBUTTONDOWN,
                    pygame.MOUSEBUTTONUP,
                    pygame.MOUSEMOTION,
                ):
                    # Desktop / emulator: mouse is already in logical surface coords.
                    touch.handle_event(event)
            if event.type == pygame.FINGERDOWN:
                input_armed = True
            if event.type == pygame.KEYDOWN:
                keyboard.key_down(event.key, event.scancode, pygame)
                if event.key == pygame.K_m and music_path is not None:
                    music_muted = toggle_music_mute()
                if event.key == pygame.K_1:
                    switch_template(ProtagonistTemplate.ONE)
                if event.key == pygame.K_2:
                    switch_template(ProtagonistTemplate.TWO)
                if event.key == pygame.K_3:
                    switch_template(ProtagonistTemplate.THREE)
                if music_path is not None and event.key == pygame.K_LEFTBRACKET:
                    beat_audio_latency_ms = min(400.0, beat_audio_latency_ms + 10.0)
                    beat.audio_latency_ms = beat_audio_latency_ms
                if music_path is not None and event.key == pygame.K_RIGHTBRACKET:
                    beat_audio_latency_ms = max(0.0, beat_audio_latency_ms - 10.0)
                    beat.audio_latency_ms = beat_audio_latency_ms
                if event.key == pygame.K_t and run == RunState.TUTORIAL:
                    begin_combat()
            elif event.type == pygame.KEYUP:
                keyboard.key_up(event.key, event.scancode, pygame)
            if event.type == pygame.KEYDOWN and run in (RunState.PLAYING, RunState.TUTORIAL):
                input_ms = pygame.time.get_ticks()
                if is_attack_key(event.key):
                    trigger_normal_attack(input_ms)
                elif is_slide_key(event.key):
                    sdx, sdy = 0.0, 0.0
                    if input_armed:
                        sdx, sdy = keyboard.movement(pygame, pygame.key.get_pressed())
                    start_slide(input_ms, sdx, sdy)
                elif event.key == pygame.K_SPACE:
                    trigger_ultimate(input_ms)
            if event.type == pygame.KEYDOWN and run in (RunState.WIN, RunState.LOSE):
                if event.key == pygame.K_r:
                    restart_run()

        if touch_mode:
            if touch.template_requested is not None:
                switch_template(ProtagonistTemplate(touch.template_requested))
            if touch.mute_pressed and music_path is not None:
                music_muted = toggle_music_mute()
            if touch.context_pressed:
                if run == RunState.TUTORIAL:
                    begin_combat()
                elif run in (RunState.WIN, RunState.LOSE):
                    restart_run()
            if run in (RunState.PLAYING, RunState.TUTORIAL):
                try:
                    with open("/data/data/org.musou.musicmusou/files/consume.log", "a") as _fh:
                        _fh.write(
                            f"{now} atk={touch.attack_pressed} slide={touch.slide_pressed} "
                            f"ult={touch.ult_pressed} joy={touch.joystick_active} "
                            f"move={touch.move}\n"
                        )
                except Exception:
                    pass
                if touch.attack_pressed:
                    trigger_normal_attack(now)
                elif touch.slide_pressed:
                    # elif: one physical tap must not fire attack + slide together
                    if touch.joystick_active:
                        sdx, sdy = touch.move
                    else:
                        sdx, sdy = last_facing
                    start_slide(now, sdx, sdy)
                elif touch.ult_pressed:
                    trigger_ultimate(now)

        dx = dy = 0.0
        if run in (RunState.PLAYING, RunState.TUTORIAL):
            dt_ms = max(1, dt)
            if now < slide_until:
                t = 1.0 - (slide_until - now) / SLIDE_DURATION_MS
                t = max(0.0, min(1.0, t))
                ease = 1.0 - (1.0 - t) ** 2
                px = slide_from_x + (slide_to_x - slide_from_x) * ease
                py = slide_from_y + (slide_to_y - slide_from_y) * ease
            elif input_armed:
                if touch is not None and touch.joystick_active:
                    dx, dy = touch.move
                else:
                    dx, dy = keyboard.movement(pygame, pygame.key.get_pressed())
                last_facing = normalize_facing(dx, dy, last_facing)
                if dx != 0.0 or dy != 0.0:
                    px, py = apply_movement(px, py, dx, dy, PLAYER_SPEED, dt_ms / 1000.0)
                    px, py = clamp_player(px, py)

            if run == RunState.PLAYING:
                chase_x, chase_y = px, py
                if t3_clone is not None and t3_clone.hp > 0:
                    chase_x, chase_y = t3_clone.gx, t3_clone.gy
                move_enemies_toward(chase_x, chase_y, enemies, dt_ms)
                if t3_clone is not None and t3_clone.hp > 0:
                    if (
                        any_pixel_contact(t3_clone.gx, t3_clone.gy, enemies)
                        and now - clone_last_hurt_ms >= CONTACT_IFRAME_MS
                    ):
                        clone_last_hurt_ms = now
                        t3_clone.hp -= CONTACT_DAMAGE
                        if t3_clone.hp <= 0:
                            t3_clone = None
                if t3_bullets:
                    t3_bullets, enemies, win = update_t3_bullets(
                        t3_bullets, enemies, dt_ms / 1000.0
                    )
                    if win and run == RunState.PLAYING:
                        run = win

            sliding = now < slide_until
            if (
                run == RunState.PLAYING
                and not sliding
                and any_pixel_contact(px, py, enemies)
                and now - last_hurt_ms >= CONTACT_IFRAME_MS
            ):
                last_hurt_ms = now
                player_hp -= CONTACT_DAMAGE
                if player_hp <= 0:
                    player_hp = 0
                    run = RunState.LOSE

        combat_fx.update(max(1, dt) / 1000.0)
        shake = combat_fx.shake_offset(now)
        cam = camera_origin(px, py)

        _t0 = pygame.time.get_ticks()
        screen.fill((14, 16, 24))
        draw_playfield_with_offset(
            screen, assets, shake, cam, view_size=(VIEW_W, VIEW_H)
        )

        draw_ms = pygame.time.get_ticks()
        _t_fill = draw_ms - _t0
        beat_pulse = beat.hud_in_zone(draw_ms)
        beat_near = beat.beat_proximity(draw_ms)
        last_hud_beat_ok = beat_pulse
        last_hud_beat_ms = draw_ms
        draw_beat_vignette(screen, VIEW_H * CELL, beat_near, beat_pulse, draw_ms)
        _t_vig = pygame.time.get_ticks() - draw_ms

        laser_flashes = [lf for lf in laser_flashes if now < lf.until_ms]
        for p in t3_bullets:
            draw_t3_bullet(
                screen,
                cx=p.x,
                cy=p.y,
                cell=CELL,
                shake=shake,
                cam=cam,
                enhanced=p.enhanced,
            )
        for lf in laser_flashes:
            if lf.mode == "ult_rect":
                draw_ultimate_laser_rect(
                    screen,
                    ox=lf.ox,
                    oy=lf.oy,
                    fx=lf.ux,
                    fy=lf.uy,
                    length_cells=lf.length,
                    width_cells=lf.half_w * 2.0,
                    cell=CELL,
                    shake=shake,
                    cam=cam,
                )
            else:
                draw_laser_beam(
                    screen,
                    ox=lf.ox,
                    oy=lf.oy,
                    ux=lf.ux,
                    uy=lf.uy,
                    length_cells=lf.length,
                    half_width_cells=lf.half_w,
                    cell=CELL,
                    shake=shake,
                    cam=cam,
                    enhanced=lf.enhanced,
                    ultimate=lf.ultimate,
                )

        if now < flash_until and protagonist_template != ProtagonistTemplate.THREE:
            centers = flash_centers if flash_centers else [(flash_at_px, flash_at_py)]
            for fpx, fpy in centers:
                draw_attack_tiles(
                    screen,
                    assets,
                    ultimate=flash_ultimate,
                    on_beat=flash_on_beat,
                    shake=shake,
                    cam=cam,
                    center_px=fpx,
                    center_py=fpy,
                    radius_cells=flash_radius,
                    facing=flash_facing,
                )

        combat_fx.draw(screen, shake, cam=cam, cell=CELL)

        for e in enemies:
            if not enemy_in_view(e, cam[0], cam[1]):
                continue
            is_boss = e.kind == Kind.BOSS
            # Single call: the patch now bakes fill + rounded border together,
            # so we no longer need a second fill=False pass.
            draw_enemy_attack_range(
                screen,
                assets,
                e.gx,
                e.gy,
                e.size,
                is_boss=is_boss,
                shake=shake,
                cam=cam,
                fill=True,
            )
            draw_enemy_sprite(
                screen,
                assets,
                e.gx,
                e.gy,
                e.size,
                is_boss,
                shake=shake,
                cam=cam,
            )

        hurt_flash = now - last_hurt_ms < 180
        if t3_clone is not None and t3_clone.hp > 0:
            clone_hurt = now - clone_last_hurt_ms < 180
            draw_t3_clone_sprite(
                screen,
                assets,
                t3_clone.gx,
                t3_clone.gy,
                hurt_flash=clone_hurt,
                shake=shake,
                cam=cam,
            )
        draw_player_sprite(
            screen, assets, px, py, hurt_flash=hurt_flash, shake=shake, cam=cam
        )

        draw_hud_panel(screen, assets, VIEW_H * CELL)
        draw_beat_hud_indicator(
            screen,
            assets,
            8,
            VIEW_H * CELL + HUD // 2,
            beat.beat_phase01(draw_ms),
            beat_near,
            beat_pulse,
            draw_ms,
            judgment_width_frac=beat.hud_window_frac(),
        )
        _t_hud = pygame.time.get_ticks()

        ui_y = VIEW_H * CELL + 8
        draw_hp_hearts(
            screen, 52, ui_y, player_hp, player_max_hp(protagonist_template)
        )
        ult_ready = beat_charges >= ULTIMATE_BEAT_CHARGES
        draw_ultimate_charge_pips(
            screen,
            52,
            ui_y + 20,
            beat_charges,
            ULTIMATE_BEAT_CHARGES,
            ready=ult_ready,
        )
        music_label = "off"
        if music_path is not None:
            music_label = "mute" if music_muted else "on"
        boss_left = sum(1 for e in enemies if e.kind == Kind.BOSS)
        ult_hint = "READY" if ult_ready else f"{beat_charges}/{ULTIMATE_BEAT_CHARGES}"
        tpl_label = str(protagonist_template.value)
        buff_left = max(0, (ultimate_buff_until - now) / 1000.0) if ult_buff_active(now) else 0.0
        buff_tag = f"  BUFF {buff_left:.1f}s" if buff_left > 0 else ""
        lat_hint = (
            f"  sync {int(beat_audio_latency_ms)}ms [ ]"
            if music_path is not None
            else ""
        )
        atk_k = "ATK" if touch_mode else "[Enter] atk"
        slide_k = "SLIDE" if touch_mode else "[Shift] slide"
        ult_k = "ULT" if touch_mode else "[Space] ult"
        focus_hint = "TOUCH TO PLAY" if touch_mode else "CLICK GAME TO FOCUS"
        status_line = (
            ("stick" if touch.joystick_active else "idle")
            if touch_mode
            else keyboard.last_event[:48]
        )
        if run == RunState.TUTORIAL:
            lines = [
                f"[1/2/3] 模板{tpl_label}{buff_tag}{lat_hint}  [T] 实战  {atk_k}  {slide_k}  "
                f"{ult_k} {ult_hint}  Beat {'ON' if beat_pulse else 'off'}",
                f"{focus_hint if not input_armed else status_line}",
            ]
        else:
            lines = [
                f"Tpl{tpl_label}{buff_tag}{lat_hint}  {atk_k}  {slide_k}  {ult_k} {ult_hint}  "
                f"[M] music  Beat {'ON' if beat_pulse else 'off'}  "
                f"Enemies {len(enemies)}  Boss {boss_left}",
                f"{focus_hint if not input_armed else status_line}",
            ]
        for i, text in enumerate(lines):
            surf = _STATUS_TEXT_CACHE.get(text)
            if surf is None:
                surf = font.render(text, True, COLOR_UI)
                _STATUS_TEXT_CACHE[text] = surf
            screen.blit(surf, (200, ui_y + i * 20))
        _t_text = pygame.time.get_ticks()

        boss = nearest_boss(px, py, enemies)
        if boss:
            draw_boss_bar(screen, font, boss.hp, boss.max_hp, 400, ui_y + 6, 200)

        if not input_armed and run != RunState.TUTORIAL:
            hint_text = (
                "Touch joystick to move"
                if touch_mode
                else "Click game window — then WASD / arrows"
            )
            hint = _STATUS_TEXT_CACHE.get(hint_text)
            if hint is None:
                hint = font.render(hint_text, True, (255, 230, 120))
                _STATUS_TEXT_CACHE[hint_text] = hint
            screen.blit(hint, (w // 2 - hint.get_width() // 2, VIEW_H * CELL // 2 - 10))

        if run == RunState.TUTORIAL:
            draw_tutorial_hints(
                screen,
                playfield_h=VIEW_H * CELL,
                input_armed=input_armed,
                touch=touch_mode,
            )

        if run == RunState.WIN:
            msg = font.render("Victory — all monsters cleared", True, COLOR_WIN)
            sub = font.render("Game paused  [R] restart", True, COLOR_UI)
            screen.blit(msg, (w // 2 - msg.get_width() // 2, h // 2 - 16))
            screen.blit(sub, (w // 2 - sub.get_width() // 2, h // 2 + 12))
        elif run == RunState.LOSE:
            msg = font.render("Defeat — HP reached 0", True, COLOR_LOSE)
            sub = font.render("Game paused  [R] restart", True, COLOR_UI)
            screen.blit(msg, (w // 2 - msg.get_width() // 2, h // 2 - 16))
            screen.blit(sub, (w // 2 - sub.get_width() // 2, h // 2 + 12))

        if touch is not None:
            touch.set_context(
                tutorial=run == RunState.TUTORIAL,
                game_over=run in (RunState.WIN, RunState.LOSE),
            )
            touch.set_ult_ready(ult_ready)
            touch.draw(screen)
            touch.update()

        _t1 = pygame.time.get_ticks()
        _t_hudx = _t_hud - draw_ms
        _t_textx = _t_text - _t_hud
        _t_ovlx = _t1 - _t_text
        pygame.display.flip()
        _t_flip = pygame.time.get_ticks() - _t1
        _t_draw = _t1 - draw_ms
        if frame_count % 60 == 0:
            print(
                f"[musou] fps={clock.get_fps():.1f} fill={_t_fill} vig={_t_vig} world={_t_hudx} text={_t_textx} ovl={_t_ovlx} flip={_t_flip} enemies={len(enemies)}",
                flush=True,
            )


if __name__ == "__main__":
    main()
