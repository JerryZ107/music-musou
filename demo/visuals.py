"""Procedural pixel art surfaces (no external art files)."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

import pygame

from tutorial import ui_font

PLAYER_HIT_SIZE = 14


def _shade(rgb: tuple[int, int, int], delta: int) -> tuple[int, int, int]:
    return tuple(max(0, min(255, c + delta)) for c in rgb)


def _noise(x: int, y: int, seed: int = 0) -> float:
    n = x * 374761393 + y * 668265263 + seed * 982451653
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0x7FFFFFFF) / 0x7FFFFFFF


def _make_floor_tile(cell: int, variant: int) -> pygame.Surface:
    bases = [(36, 40, 58), (32, 44, 52), (42, 38, 54)]
    base = bases[variant % 3]
    s = pygame.Surface((cell, cell))
    s.fill(base)
    for py in range(0, cell, 2):
        for px in range(0, cell, 2):
            if _noise(px + variant * 11, py + variant * 7) > 0.62:
                c = _shade(base, -12 if _noise(px, py) > 0.5 else 8)
                s.set_at((px, py), c)
                if px + 1 < cell:
                    s.set_at((px + 1, py), c)
                if py + 1 < cell:
                    s.set_at((px, py + 1), c)
    if variant == 2:
        for i in range(3):
            x0 = 4 + i * 7
            pygame.draw.line(s, _shade(base, -22), (x0, cell - 4), (x0 + 5, 2), 1)
    pygame.draw.rect(s, _shade(base, -28), (0, 0, cell, cell), 1)
    highlight = pygame.Surface((cell, cell), pygame.SRCALPHA)
    highlight.fill((255, 255, 255, 12))
    s.blit(highlight, (0, 0))
    return s


def _make_player_sprite() -> pygame.Surface:
    s = pygame.Surface((PLAYER_HIT_SIZE, PLAYER_HIT_SIZE), pygame.SRCALPHA)
    g = (52, 210, 110)
    gd = _shade(g, -35)
    gl = _shade(g, 40)
    body = pygame.Rect(3, 5, 8, 8)
    pygame.draw.rect(s, gd, body, border_radius=2)
    pygame.draw.rect(s, g, body.inflate(-2, -2), border_radius=1)
    pygame.draw.rect(s, gl, (4, 6, 3, 2), border_radius=1)
    pygame.draw.circle(s, (18, 28, 22), (5, 8), 1)
    pygame.draw.circle(s, (18, 28, 22), (9, 8), 1)
    pygame.draw.rect(s, gl, (6, 3, 2, 3))
    pygame.draw.line(s, gd, (4, 13), (2, 15), 1)
    pygame.draw.line(s, gd, (10, 13), (12, 15), 1)
    return s


def _make_slime_sprite(cells: int, cell: int, colors: tuple[tuple[int, int, int], ...]) -> pygame.Surface:
    pad = 3
    w = cells * cell - pad * 2
    h = cells * cell - pad * 2
    s = pygame.Surface((w, h), pygame.SRCALPHA)
    main, dark, light = colors
    pygame.draw.ellipse(s, dark, (0, h // 5, w, h - h // 5))
    pygame.draw.ellipse(s, main, (2, h // 5 + 1, w - 4, h - h // 5 - 3))
    pygame.draw.ellipse(s, light, (w // 4, h // 3, w // 2, h // 3))
    eye_y = h // 2 - 1
    ex = w // 3
    for ox in (0, ex):
        pygame.draw.circle(s, (22, 18, 30), (ex + ox, eye_y), 2)
        pygame.draw.rect(s, (240, 250, 255), (ex + ox - 1, eye_y - 1, 2, 2))
    if cells >= 3:
        pygame.draw.polygon(
            s,
            _shade(dark, -15),
            [(w // 2 - 6, 4), (w // 2, 0), (w // 2 + 6, 4)],
        )
    return s


def _make_attack_tile(cell: int, core: tuple[int, int, int], edge: tuple[int, int, int]) -> pygame.Surface:
    s = pygame.Surface((cell, cell), pygame.SRCALPHA)
    pygame.draw.rect(s, (*edge, 90), (0, 0, cell, cell), border_radius=4)
    pygame.draw.rect(s, (*core, 55), (2, 2, cell - 4, cell - 4), border_radius=3)
    return s


def _make_hud_bar_bg(width: int, height: int) -> pygame.Surface:
    # Opaque plain rect (no per-pixel alpha) so the per-frame blit is a fast
    # memcpy instead of CPU alpha blending on the software SDL renderer.
    s = pygame.Surface((width, height))
    s.fill((12, 14, 22))
    pygame.draw.rect(s, (70, 80, 110), (0, 0, width, height), 1)
    return s


@dataclass
class VisualAssets:
    cell: int
    playfield_bg: pygame.Surface
    player: pygame.Surface
    minion: pygame.Surface
    boss: pygame.Surface
    atk_basic: pygame.Surface
    atk_beat: pygame.Surface
    atk_ult: pygame.Surface
    hud_bg: pygame.Surface
    beat_ring: pygame.Surface


def build_visual_assets(
    grid_w: int,
    grid_h: int,
    cell: int,
    *,
    hud_width: int | None = None,
) -> VisualAssets:
    floor = [_make_floor_tile(cell, v) for v in range(3)]
    pw, ph = grid_w * cell, grid_h * cell
    playfield_bg = pygame.Surface((pw, ph))
    for gx in range(grid_w):
        for gy in range(grid_h):
            v = (gx * 73856093 ^ gy * 19349663) % 3
            playfield_bg.blit(floor[v], (gx * cell, gy * cell))
    hud_w = hud_width if hud_width is not None else pw

    minion = _make_slime_sprite(
        2,
        cell,
        ((235, 200, 55), (180, 140, 30), (255, 240, 150)),
    )
    boss = _make_slime_sprite(
        3,
        cell,
        ((255, 130, 45), (190, 75, 25), (255, 190, 100)),
    )
    # Convert every surface to the display format. Without this, every blit
    # does a per-pixel format conversion + alpha blend on the software SDL
    # renderer (the main cause of the 1-13 FPS lag on Android).
    player = _make_player_sprite().convert_alpha()
    atk_basic = _make_attack_tile(cell, (180, 200, 255), (120, 160, 255)).convert_alpha()
    atk_beat = _make_attack_tile(cell, (120, 220, 255), (60, 180, 255)).convert_alpha()
    atk_ult = _make_attack_tile(cell, (255, 200, 120), (255, 120, 60)).convert_alpha()
    hud_bg = _make_hud_bar_bg(hud_w, 52).convert()
    beat_ring = _ring_surface(48).convert_alpha()
    return VisualAssets(
        cell=cell,
        playfield_bg=playfield_bg.convert(),
        player=player,
        minion=minion.convert_alpha(),
        boss=boss.convert_alpha(),
        atk_basic=atk_basic,
        atk_beat=atk_beat,
        atk_ult=atk_ult,
        hud_bg=hud_bg,
        beat_ring=beat_ring,
    )


def _ring_surface(diameter: int) -> pygame.Surface:
    s = pygame.Surface((diameter, diameter), pygame.SRCALPHA)
    c = diameter // 2
    pygame.draw.circle(s, (80, 140, 255, 55), (c, c), c - 2, 5)
    pygame.draw.circle(s, (120, 190, 255, 120), (c, c), c - 5, 3)
    pygame.draw.circle(s, (200, 240, 255, 200), (c, c), c - 10, 2)
    return s


def draw_playfield(screen: pygame.Surface, assets: VisualAssets) -> None:
    screen.blit(assets.playfield_bg, (0, 0))


def draw_enemy_sprite(
    screen: pygame.Surface,
    assets: VisualAssets,
    gx: float,
    gy: float,
    cells: int,
    is_boss: bool,
    shake: tuple[int, int] = (0, 0),
    cam: tuple[float, float] = (0.0, 0.0),
) -> None:
    spr = assets.boss if is_boss else assets.minion
    pad = 3
    sx, sy = shake
    cx, cy = cam
    x = int((gx - cx) * assets.cell) + pad + sx
    y = int((gy - cy) * assets.cell) + pad + sy
    screen.blit(spr, (x, y))


_MINION_PATCH: pygame.Surface | None = None
_BOSS_PATCH: pygame.Surface | None = None
# Full multi-cell range patch cache: key (cells, is_boss) -> surface covering
# the whole enemy footprint with fill + per-cell rounded borders baked in.
# This turns N*N per-cell blits into a SINGLE blit per enemy.
_RANGE_PATCH_CACHE: dict[tuple[int, bool], pygame.Surface] = {}


def _ensure_range_patch(cells: int, is_boss: bool, cell: int) -> pygame.Surface:
    key = (cells, is_boss)
    cached = _RANGE_PATCH_CACHE.get(key)
    if cached is not None and cached.get_width() == cells * cell:
        return cached
    inset = 2
    inner = cell - 4
    total = cells * cell
    surf = pygame.Surface((total, total), pygame.SRCALPHA).convert_alpha()
    if is_boss:
        fill = (255, 70, 45, 38)
        border = (255, 100, 60)
    else:
        fill = (255, 140, 40, 32)
        border = (255, 170, 50)
    for x in range(cells):
        for y in range(cells):
            rx, ry = x * cell + inset, y * cell + inset
            surf.fill(fill, (rx, ry, inner, inner))
            pygame.draw.rect(surf, border, (rx, ry, inner, inner), 2, border_radius=2)
    _RANGE_PATCH_CACHE[key] = surf
    return surf


def draw_enemy_attack_range(
    screen: pygame.Surface,
    assets: VisualAssets,
    gx: float,
    gy: float,
    cells: int,
    *,
    is_boss: bool,
    shake: tuple[int, int] = (0, 0),
    cam: tuple[float, float] = (0.0, 0.0),
    fill: bool = True,
) -> None:
    """Contact / melee hurt zone (matches prototype enemy_cell_rects).

    The whole footprint (all cells, fill + rounded borders) is baked into a
    single cached surface, so this is ONE blit per enemy regardless of size.
    """
    sx, sy = shake
    cam_x, cam_y = cam
    cell = assets.cell
    patch = _ensure_range_patch(cells, is_boss, cell)
    rx = int((int(gx) - cam_x) * cell + sx)
    ry = int((int(gy) - cam_y) * cell + sy)
    screen.blit(patch, (rx, ry))


def draw_player_sprite(
    screen: pygame.Surface,
    assets: VisualAssets,
    px: float,
    py: float,
    *,
    hurt_flash: bool = False,
    shake: tuple[int, int] = (0, 0),
    cam: tuple[float, float] = (0.0, 0.0),
) -> None:
    sx, sy = shake
    cam_x, cam_y = cam
    cx = int((px - cam_x) * assets.cell + assets.cell // 2 + sx)
    cy = int((py - cam_y) * assets.cell + assets.cell // 2 + sy)
    rect = assets.player.get_rect(center=(cx, cy))
    screen.blit(assets.player, rect)
    if hurt_flash:
        flash = pygame.Surface(assets.player.get_size(), pygame.SRCALPHA)
        flash.fill((255, 80, 80, 120))
        screen.blit(flash, rect)


def draw_attack_tiles(
    screen: pygame.Surface,
    assets: VisualAssets,
    *,
    ultimate: bool = False,
    on_beat: bool = False,
    shake: tuple[int, int] = (0, 0),
    cam: tuple[float, float] = (0.0, 0.0),
    center_px: float,
    center_py: float,
    radius_cells: float,
    facing: tuple[float, float] | None = None,
) -> None:
    """Attack VFX: circle or forward semicircle (when *facing* is set)."""
    sx, sy = shake
    cam_x, cam_y = cam
    cell = assets.cell
    cx = int((center_px + 0.5 - cam_x) * cell + sx)
    cy = int((center_py + 0.5 - cam_y) * cell + sy)
    r_px = max(2, int(radius_cells * cell))
    if ultimate:
        ring_c = (255, 160, 80, 220)
        fill_c = (255, 120, 60, 45)
        inner_c = (255, 200, 140, 90)
    elif on_beat:
        ring_c = (160, 230, 255, 240)
        fill_c = (100, 190, 255, 55)
        inner_c = (200, 240, 255, 100)
    else:
        ring_c = (160, 190, 255, 200)
        fill_c = (120, 160, 255, 38)
        inner_c = (180, 210, 255, 70)

    if facing is not None and (facing[0] != 0.0 or facing[1] != 0.0):
        fx, fy = facing
        pad = 6
        size = r_px * 2 + pad * 2
        mid = r_px + pad
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        base = math.atan2(fy, fx)
        pts = [(mid, mid)]
        for i in range(33):
            ang = base - math.pi / 2 + math.pi * i / 32
            pts.append((mid + math.cos(ang) * r_px, mid + math.sin(ang) * r_px))
        pygame.draw.polygon(surf, fill_c, pts)
        pygame.draw.polygon(surf, inner_c, pts, 2)
        pygame.draw.polygon(surf, ring_c[:3], pts, 2)
        nx, ny = -fy, fx
        pygame.draw.line(
            surf,
            ring_c[:3],
            (mid - nx * r_px, mid - ny * r_px),
            (mid + nx * r_px, mid + ny * r_px),
            2,
        )
        screen.blit(surf, (cx - mid, cy - mid))
        return

    ring_s = pygame.Surface((r_px * 2 + 6, r_px * 2 + 6), pygame.SRCALPHA)
    mid = r_px + 3
    pygame.draw.circle(ring_s, fill_c, (mid, mid), r_px)
    pygame.draw.circle(ring_s, inner_c, (mid, mid), max(1, r_px - 3), 2)
    pygame.draw.circle(ring_s, ring_c, (mid, mid), r_px, 2)
    screen.blit(ring_s, (cx - mid, cy - mid))


def draw_t3_clone_sprite(
    screen: pygame.Surface,
    assets: VisualAssets,
    px: float,
    py: float,
    *,
    hurt_flash: bool = False,
    shake: tuple[int, int] = (0, 0),
    cam: tuple[float, float] = (0.0, 0.0),
) -> None:
    sx, sy = shake
    cam_x, cam_y = cam
    cx = int((px - cam_x) * assets.cell + assets.cell // 2 + sx)
    cy = int((py - cam_y) * assets.cell + assets.cell // 2 + sy)
    base = assets.player.copy()
    tint = pygame.Surface(base.get_size(), pygame.SRCALPHA)
    tint.fill((80, 160, 255, 110))
    base.blit(tint, (0, 0), special_flags=pygame.BLEND_RGBA_MULT)
    rect = base.get_rect(center=(cx, cy))
    screen.blit(base, rect)
    outline = pygame.Surface((rect.width + 4, rect.height + 4), pygame.SRCALPHA)
    pygame.draw.rect(outline, (120, 200, 255, 180), outline.get_rect(), 2, border_radius=4)
    screen.blit(outline, (rect.x - 2, rect.y - 2))
    if hurt_flash:
        flash = pygame.Surface(base.get_size(), pygame.SRCALPHA)
        flash.fill((255, 80, 80, 120))
        screen.blit(flash, rect)


_BULLET_GLOW_CACHE: dict[bool, pygame.Surface] = {}


def _bullet_glow(cell: int, enhanced: bool) -> pygame.Surface:
    cached = _BULLET_GLOW_CACHE.get(enhanced)
    if cached is not None and cached.get_width() == cell + 8:
        return cached
    size = cell
    core = (90, 200, 255) if not enhanced else (140, 230, 255)
    edge = (40, 120, 220) if not enhanced else (80, 180, 255)
    glow = pygame.Surface((size + 8, size + 8), pygame.SRCALPHA)
    if enhanced:
        pygame.draw.rect(glow, (60, 160, 255, 90), (0, 0, size + 8, size + 8), border_radius=4)
    pygame.draw.rect(glow, edge, (4, 4, size, size), border_radius=3)
    pygame.draw.rect(glow, core, (5, 5, size - 2, size - 2), border_radius=2)
    _BULLET_GLOW_CACHE[enhanced] = glow
    return glow


def draw_t3_bullet(
    screen: pygame.Surface,
    *,
    cx: float,
    cy: float,
    cell: int,
    shake: tuple[int, int] = (0, 0),
    cam: tuple[float, float] = (0.0, 0.0),
    enhanced: bool = False,
) -> None:
    """1 格蓝色子弹（与主角同尺寸）。"""
    sx, sy = shake
    cam_x, cam_y = cam
    left = int((cx - 0.5 - cam_x) * cell + sx)
    top = int((cy - 0.5 - cam_y) * cell + sy)
    glow = _bullet_glow(cell, enhanced)
    screen.blit(glow, (left - 4, top - 4))


_LASER_OVERLAY: pygame.Surface | None = None


def _laser_overlay(screen: pygame.Surface) -> pygame.Surface:
    global _LASER_OVERLAY
    sw, sh = screen.get_size()
    if _LASER_OVERLAY is None or _LASER_OVERLAY.get_size() != (sw, sh):
        _LASER_OVERLAY = pygame.Surface((sw, sh), pygame.SRCALPHA)
    _LASER_OVERLAY.fill((0, 0, 0, 0))
    return _LASER_OVERLAY


def draw_laser_beam(
    screen: pygame.Surface,
    *,
    ox: float,
    oy: float,
    ux: float,
    uy: float,
    length_cells: float,
    half_width_cells: float,
    cell: int,
    shake: tuple[int, int] = (0, 0),
    cam: tuple[float, float] = (0.0, 0.0),
    enhanced: bool = False,
    ultimate: bool = False,
) -> None:
    """蓝色激光束（格坐标）。"""
    sx, sy = shake
    cam_x, cam_y = cam
    x0 = (ox - cam_x) * cell + sx
    y0 = (oy - cam_y) * cell + sy
    x1 = x0 + ux * length_cells * cell
    y1 = y0 + uy * length_cells * cell
    thick = max(3, int(half_width_cells * cell * 2))
    if ultimate:
        core = (120, 220, 255)
        glow = (60, 160, 255, 120)
        outer = (200, 250, 255, 200)
    elif enhanced:
        core = (100, 200, 255)
        glow = (40, 140, 255, 140)
        outer = (180, 235, 255, 200)
    else:
        core = (80, 160, 255)
        glow = (30, 100, 220, 90)
        outer = (140, 200, 255, 200)
    overlay = _laser_overlay(screen)
    pygame.draw.line(overlay, glow, (x0, y0), (x1, y1), thick + 8)
    pygame.draw.line(overlay, outer, (x0, y0), (x1, y1), thick + 3)
    pygame.draw.line(screen, core, (x0, y0), (x1, y1), thick)
    screen.blit(overlay, (0, 0))


def draw_ultimate_laser_rect(
    screen: pygame.Surface,
    *,
    ox: float,
    oy: float,
    fx: float,
    fy: float,
    length_cells: float,
    width_cells: float,
    cell: int,
    shake: tuple[int, int] = (0, 0),
    cam: tuple[float, float] = (0.0, 0.0),
) -> None:
    """面向矩形激光（长×宽，格）。"""
    sx, sy = shake
    cam_x, cam_y = cam
    perp_x, perp_y = -fy, fx
    half_w = width_cells * 0.5
    perp_x, perp_y = -fy, fx

    def corner(along: float, side: float) -> tuple[float, float]:
        gx = ox + fx * along + perp_x * side
        gy = oy + fy * along + perp_y * side
        return ((gx - cam_x) * cell + sx, (gy - cam_y) * cell + sy)

    pts = [
        corner(0.0, -half_w),
        corner(length_cells, -half_w),
        corner(length_cells, half_w),
        corner(0.0, half_w),
    ]
    overlay = _laser_overlay(screen)
    pygame.draw.polygon(overlay, (50, 140, 255, 70), pts)
    pygame.draw.polygon(overlay, (120, 220, 255, 160), pts, 3)
    screen.blit(overlay, (0, 0))


@dataclass
class _Particle:
    x: float
    y: float
    vx: float
    vy: float
    life: float
    max_life: float
    size: int
    color: tuple[int, int, int]


@dataclass
class _ShockRing:
    x: float
    y: float
    radius: float
    speed: float
    max_radius: float
    width: int
    color: tuple[int, int, int, int]


@dataclass
class _SlashArc:
    x: float
    y: float
    angle: float
    length: float
    life: float
    max_life: float


@dataclass
class CombatFX:
    """Short-lived VFX for beat-on attacks."""

    particles: list[_Particle] = field(default_factory=list)
    rings: list[_ShockRing] = field(default_factory=list)
    slashes: list[_SlashArc] = field(default_factory=list)
    shake_ms: int = 0
    shake_until: int = 0
    _rng: random.Random = field(default_factory=random.Random)

    def _add_beat_splash(self, px: float, py: float, cell: int) -> None:
        cx = px * cell + cell * 0.5
        cy = py * cell + cell * 0.5
        self.rings.append(_ShockRing(cx, cy, 10.0, 280.0, cell * 2.8, 4, (120, 210, 255, 200)))
        self.rings.append(_ShockRing(cx, cy, 6.0, 340.0, cell * 2.2, 2, (255, 255, 255, 160)))
        for i in range(14):
            ang = self._rng.random() * math.tau
            spd = self._rng.uniform(120, 320)
            self.particles.append(
                _Particle(
                    cx,
                    cy,
                    math.cos(ang) * spd,
                    math.sin(ang) * spd,
                    life=0.28,
                    max_life=0.28,
                    size=self._rng.randint(2, 4),
                    color=(180, 230, 255) if i % 2 else (255, 240, 180),
                )
            )
        for k in range(4):
            self.slashes.append(
                _SlashArc(
                    cx,
                    cy,
                    angle=k * math.pi / 2 + self._rng.uniform(-0.15, 0.15),
                    length=cell * 1.6,
                    life=0.14,
                    max_life=0.14,
                )
            )

    def spawn_beat_attack(self, px: float, py: float, cell: int, now_ms: int) -> None:
        self._add_beat_splash(px, py, cell)
        self.shake_ms = 110
        self.shake_until = now_ms + self.shake_ms

    def spawn_beat_attack_path(
        self, path: list[tuple[float, float]], cell: int, now_ms: int
    ) -> None:
        """Same beat-on splash VFX at every slide path point at once."""
        for px, py in path:
            self._add_beat_splash(px, py, cell)
        if path:
            self.shake_ms = 110
            self.shake_until = now_ms + self.shake_ms

    def update(self, dt_sec: float) -> None:
        for p in self.particles:
            p.life -= dt_sec
            p.x += p.vx * dt_sec
            p.y += p.vy * dt_sec
            p.vy += 420 * dt_sec
        self.particles = [p for p in self.particles if p.life > 0]

        for r in self.rings:
            r.radius += r.speed * dt_sec
        self.rings = [r for r in self.rings if r.radius < r.max_radius]

        for s in self.slashes:
            s.life -= dt_sec
        self.slashes = [s for s in self.slashes if s.life > 0]

    def shake_offset(self, now_ms: int) -> tuple[int, int]:
        if now_ms >= self.shake_until:
            return (0, 0)
        return (self._rng.randint(-2, 2), self._rng.randint(-2, 2))

    def draw(
        self,
        screen: pygame.Surface,
        shake: tuple[int, int] = (0, 0),
        cam: tuple[float, float] = (0.0, 0.0),
        cell: int = 28,
    ) -> None:
        if not self.particles and not self.rings and not self.slashes:
            return
        cam_x, cam_y = cam
        cam_px, cam_py = int(cam_x * cell), int(cam_y * cell)
        sx, sy = shake
        # Compute a tight bounding box (in screen space) of all effects so we
        # only allocate / clear / alpha-blit a small overlay instead of a
        # full-screen one (the full-screen path caused ~150ms attack hitches).
        sw, sh = screen.get_size()
        min_x = min_y = 10**9
        max_x = max_y = -10**9
        pts = []
        for r in self.rings:
            cx, cy = int(r.x + sx - cam_px), int(r.y + sy - cam_py)
            rr = int(r.radius) + 2
            pts.append(("ring", r, cx, cy))
            min_x = min(min_x, cx - rr); min_y = min(min_y, cy - rr)
            max_x = max(max_x, cx + rr); max_y = max(max_y, cy + rr)
        for s in self.slashes:
            t = s.life / s.max_life
            ex = s.x + math.cos(s.angle) * s.length * (1 - t * 0.3)
            ey = s.y + math.sin(s.angle) * s.length * (1 - t * 0.3)
            x0, y0 = int(s.x + sx - cam_px), int(s.y + sy - cam_py)
            x1, y1 = int(ex + sx - cam_px), int(ey + sy - cam_py)
            pts.append(("slash", s, x0, y0, x1, y1))
            min_x = min(min_x, x0, x1); min_y = min(min_y, y0, y1)
            max_x = max(max_x, x0, x1); max_y = max(max_y, y0, y1)
        for p in self.particles:
            t = p.life / p.max_life
            sz = max(1, int(p.size * t)) + 1
            px, py = int(p.x + sx - cam_px), int(p.y + sy - cam_py)
            pts.append(("particle", p, px, py))
            min_x = min(min_x, px - sz); min_y = min(min_y, py - sz)
            max_x = max(max_x, px + sz); max_y = max(max_y, py + sz)
        if min_x > max_x:
            return
        pad = 2
        min_x = max(0, min_x - pad); min_y = max(0, min_y - pad)
        max_x = min(sw, max_x + pad); max_y = min(sh, max_y + pad)
        ow, oh = max_x - min_x, max_y - min_y
        if ow <= 0 or oh <= 0:
            return
        overlay = pygame.Surface((ow, oh), pygame.SRCALPHA).convert_alpha()
        ox, oy = min_x, min_y
        for entry in pts:
            if entry[0] == "ring":
                _, r, cx, cy = entry
                alpha = max(0, min(255, int(r.color[3] * (1 - r.radius / r.max_radius))))
                if alpha <= 0:
                    continue
                pygame.draw.circle(overlay, (*r.color[:3], alpha), (cx - ox, cy - oy), int(r.radius), r.width)
            elif entry[0] == "slash":
                _, s, x0, y0, x1, y1 = entry
                t = s.life / s.max_life
                alpha = int(220 * t)
                width = max(1, int(3 * t))
                pygame.draw.line(overlay, (200, 240, 255, alpha), (x0 - ox, y0 - oy), (x1 - ox, y1 - oy), width)
            else:
                _, p, px, py = entry
                t = p.life / p.max_life
                alpha = int(255 * t)
                sz = max(1, int(p.size * t))
                pygame.draw.circle(overlay, (*p.color, alpha), (px - ox, py - oy), sz)
        screen.blit(overlay, (ox, oy))


def draw_playfield_with_offset(
    screen: pygame.Surface,
    assets: VisualAssets,
    shake: tuple[int, int],
    cam: tuple[float, float] = (0.0, 0.0),
    view_size: tuple[int, int] | None = None,
) -> None:
    sx, sy = shake
    cam_x, cam_y = cam
    cell = assets.cell
    if view_size is None:
        screen.blit(assets.playfield_bg, (sx - int(cam_x * cell), sy - int(cam_y * cell)))
        return
    vw, vh = view_size
    src = pygame.Rect(int(cam_x * cell), int(cam_y * cell), vw * cell, vh * cell)
    screen.blit(assets.playfield_bg, (sx, sy), src)


_VIGNETTE_STRIPS: list[pygame.Surface] = []  # top, bottom, left, right


def draw_beat_vignette(
    screen: pygame.Surface,
    playfield_h: int,
    proximity: float,
    on_beat: bool,
    t_ms: int,
) -> None:
    # Draw the beat-synced border directly on the screen with OPAQUE rects
    # (no per-pixel alpha overlay). On the device's software SDL renderer,
    # alpha blending was the single biggest cost (~15ms/frame); opaque rect
    # outlines drop this to ~1ms. Pulsing strength is conveyed via color
    # brightness instead of alpha.
    if proximity <= 0.08 and not on_beat:
        return
    pulse = 0.5 + 0.5 * math.sin(t_ms * 0.04)
    pw = screen.get_width()
    strength = max(proximity, 1.0 if on_beat else 0.0)
    border = int(5 + 10 * strength + (4 * pulse if on_beat else 0))
    b = int(60 + 140 * strength + (55 if on_beat else 0))
    col = (max(0, b - 80), min(255, b + 30), 255)
    pygame.draw.rect(screen, col, (0, 0, pw, playfield_h), border)
    if on_beat:
        cb = int(140 + 80 * pulse)
        pygame.draw.rect(
            screen, (min(255, cb + 70), min(255, cb + 40), 255),
            (border, border, pw - 2 * border, playfield_h - 2 * border),
            2,
        )


_BEAT_RING_CACHE: dict[int, pygame.Surface] = {}


def _scaled_ring(ring: pygame.Surface, size: int) -> pygame.Surface:
    cached = _BEAT_RING_CACHE.get(size)
    if cached is not None:
        return cached
    scaled = pygame.transform.scale(ring, (size, size))
    _BEAT_RING_CACHE[size] = scaled
    if len(_BEAT_RING_CACHE) > 24:
        _BEAT_RING_CACHE.pop(next(iter(_BEAT_RING_CACHE)))
    return scaled


_BEAT_HUD_ZONE: pygame.Surface | None = None
_BEAT_HUD_ZONE_R: pygame.Surface | None = None
_BEAT_HUD_GLOW: dict[int, pygame.Surface] = {}


_BEAT_HUD_BAR_BG: dict[tuple, pygame.Surface] = {}
_BEAT_HUD_BAR_OUTLINE: dict[tuple, pygame.Surface] = {}


def _bar_bg_surf(bar_x: int, bar_y: int, bar_w: int, bar_h: int) -> pygame.Surface:
    key = (bar_x, bar_y, bar_w, bar_h)
    cached = _BEAT_HUD_BAR_BG.get(key)
    if cached is not None:
        return cached
    surf = pygame.Surface((bar_w, bar_h), pygame.SRCALPHA).convert_alpha()
    pygame.draw.rect(surf, (28, 32, 48), (0, 0, bar_w, bar_h), border_radius=4)
    _BEAT_HUD_BAR_BG[key] = surf
    return surf


def _bar_outline_surf(bar_x: int, bar_y: int, bar_w: int, bar_h: int) -> pygame.Surface:
    key = (bar_x, bar_y, bar_w, bar_h)
    cached = _BEAT_HUD_BAR_OUTLINE.get(key)
    if cached is not None:
        return cached
    surf = pygame.Surface((bar_w, bar_h), pygame.SRCALPHA).convert_alpha()
    pygame.draw.rect(surf, (100, 130, 180), (0, 0, bar_w, bar_h), 1, border_radius=4)
    _BEAT_HUD_BAR_OUTLINE[key] = surf
    return surf


def draw_beat_hud_indicator(
    screen: pygame.Surface,
    assets: VisualAssets,
    x: int,
    cy: int,
    phase01: float,
    proximity: float,
    on_beat: bool,
    t_ms: int,
    *,
    judgment_width_frac: float = 0.36,
) -> None:
    """Left HUD: pulsing ring + beat meter + on-beat label."""
    global _BEAT_HUD_ZONE, _BEAT_HUD_ZONE_R
    pulse = 0.5 + 0.5 * math.sin(t_ms * 0.05)
    ring = assets.beat_ring
    scale = 0.72 + 0.38 * proximity + (0.12 * pulse if on_beat else 0.0)
    rw = ring.get_width()
    # Quantize to 4px steps so the ring-scale cache hits instead of doing a
    # fresh pygame.transform.scale every frame (proximity changes continuously).
    size = max(8, (int(rw * scale) // 4) * 4)
    scaled = _scaled_ring(ring, size)
    if on_beat:
        glow = _BEAT_HUD_GLOW.get(size)
        if glow is None:
            glow = scaled.copy()
            glow.fill((120, 200, 255, 90), special_flags=pygame.BLEND_RGBA_ADD)
            _BEAT_HUD_GLOW[size] = glow
        screen.blit(glow, (x + 6 - glow.get_width() // 2, cy - glow.get_height() // 2))
    screen.blit(scaled, (x + 6 - scaled.get_width() // 2, cy - scaled.get_height() // 2))

    bar_x, bar_y, bar_w, bar_h = x + 34, cy - 5, 118, 10
    screen.blit(_bar_bg_surf(bar_x, bar_y, bar_w, bar_h), (bar_x, bar_y))
    win_w = max(10, int(bar_w * max(0.12, min(0.85, judgment_width_frac))))
    w_frac = max(0.12, min(0.85, judgment_width_frac))
    in_zone = phase01 <= w_frac or phase01 >= (1.0 - w_frac)
    zone_a = int(80 + 120 * proximity + (80 if on_beat else 0))
    if _BEAT_HUD_ZONE is None or _BEAT_HUD_ZONE.get_size() != (win_w, bar_h):
        _BEAT_HUD_ZONE = pygame.Surface((win_w, bar_h), pygame.SRCALPHA).convert_alpha()
    if _BEAT_HUD_ZONE_R is None or _BEAT_HUD_ZONE_R.get_size() != (win_w, bar_h):
        _BEAT_HUD_ZONE_R = pygame.Surface((win_w, bar_h), pygame.SRCALPHA).convert_alpha()
    zone = _BEAT_HUD_ZONE
    zone.fill((100, 180, 255, min(255, zone_a)))
    screen.blit(zone, (bar_x, bar_y))
    zone_r = _BEAT_HUD_ZONE_R
    zone_r.fill((100, 180, 255, min(255, int(zone_a * 0.85))))
    screen.blit(zone_r, (bar_x + bar_w - win_w, bar_y))
    head_x = bar_x + int(phase01 * (bar_w - 2)) + 1
    head_col = (220, 245, 255) if on_beat or in_zone else (140, 170, 210)
    pygame.draw.circle(screen, head_col, (head_x, bar_y + bar_h // 2), 5 if on_beat else 4)
    screen.blit(_bar_outline_surf(bar_x, bar_y, bar_w, bar_h), (bar_x, bar_y))

    if on_beat:
        font = ui_font(26)
        label = font.render("拍!", True, (220, 245, 255))
        lx, ly = bar_x + bar_w + 8, cy - label.get_height() // 2
        hit = pygame.Surface((label.get_width() + 8, label.get_height() + 4), pygame.SRCALPHA)
        hit.fill((100, 180, 255, int(90 + 50 * pulse)))
        screen.blit(hit, (lx - 4, cy - hit.get_height() // 2))
        screen.blit(label, (lx, ly))


def draw_hud_panel(screen: pygame.Surface, assets: VisualAssets, y: int) -> None:
    screen.blit(assets.hud_bg, (0, y))


def draw_hp_hearts(screen: pygame.Surface, x: int, y: int, hp: int, max_hp: int) -> None:
    for i in range(max_hp):
        cx = x + i * 14
        filled = i < hp
        col = (220, 70, 90) if filled else (45, 50, 65)
        pygame.draw.circle(screen, col, (cx + 5, y + 6), 5)
        if filled:
            pygame.draw.circle(screen, (255, 150, 160), (cx + 4, y + 5), 2)


def draw_ultimate_charge_pips(
    screen: pygame.Surface,
    x: int,
    y: int,
    charges: int,
    needed: int,
    *,
    ready: bool,
) -> None:
    for i in range(needed):
        cx = x + i * 16
        filled = i < charges
        if ready and filled:
            col = (255, 200, 90)
            glow = (255, 140, 60)
        elif filled:
            col = (120, 200, 255)
            glow = (80, 160, 220)
        else:
            col = (45, 50, 65)
            glow = (35, 38, 48)
        pygame.draw.circle(screen, glow, (cx + 6, y + 6), 7)
        pygame.draw.circle(screen, col, (cx + 6, y + 6), 5)


def draw_energy_bar(screen: pygame.Surface, x: int, y: int, w: int, energy: int, max_e: int) -> None:
    pygame.draw.rect(screen, (35, 40, 55), (x, y, w, 10), border_radius=3)
    fw = int(w * energy / max_e) if max_e else 0
    if fw > 0:
        pygame.draw.rect(screen, (90, 180, 255), (x, y, fw, 10), border_radius=3)
    pygame.draw.rect(screen, (110, 130, 170), (x, y, w, 10), 1, border_radius=3)


def draw_boss_bar(
    screen: pygame.Surface, font: pygame.font.Font, boss_hp: int, boss_max: int, x: int, y: int, w: int
) -> None:
    screen.blit(font.render("BOSS", True, (255, 190, 140)), (x, y - 18))
    pygame.draw.rect(screen, (30, 28, 35), (x, y, w, 12), border_radius=4)
    frac = max(0.0, boss_hp / boss_max) if boss_max else 0
    if frac > 0:
        pygame.draw.rect(screen, (255, 120, 50), (x, y, int(w * frac), 12), border_radius=4)
    pygame.draw.rect(screen, (180, 100, 60), (x, y, w, 12), 1, border_radius=4)
