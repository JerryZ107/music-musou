"""Touch controls for mobile mode: virtual joystick + action buttons + utility cluster.

- Left-bottom: virtual joystick (movement, analog).
- Right-bottom: three action buttons - 普攻 (attack) / 滑步 (slide) / 大招 (ultimate).
- Center: small utility cluster - [1][2][3] template switch, [M] mute,
  and a contextual button ([T] enter combat / [R] restart).

Events: pygame FINGER* (real touch screens / PyDroid3) and MOUSE* fallback
(single-pointer testing on desktop). Multi-touch: each control binds the finger
id that pressed it, so joystick + buttons can be held simultaneously.

Finger coordinates are 0..1 fractions of the window; we map them back into the
LOGICAL surface size (letterbox-aware, works with and without pygame.SCALED).
Mouse coords are already in logical space.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import pygame

from tutorial import ui_font

_TOUCH_LOG = "/data/data/org.musou.musicmusou/files/touch.log"


def _tlog(msg: str) -> None:
    try:
        with open(_TOUCH_LOG, "a", encoding="utf-8") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass


# Cache rendered (static) button-label surfaces, keyed by (label, font_size).
# font.render for CJK glyphs is expensive; labels never change so render once.
_LABEL_CACHE: dict[tuple[str, int], pygame.Surface] = {}


def _cached_label(label: str, size: int) -> pygame.Surface:
    key = (label, size)
    surf = _LABEL_CACHE.get(key)
    if surf is None:
        surf = ui_font(size).render(label, True, COLOR_LABEL)
        _LABEL_CACHE[key] = surf
    return surf

# Overlay layout: controls are drawn on top of the playfield so the window stays
# landscape (no bottom strip). Kept for backward-compat imports.
CONTROL_STRIP_H = 0

JOYSTICK_RADIUS = 74.0
JOYSTICK_KNOB_RADIUS = 34.0
JOYSTICK_SLOP = 24.0

BTN_ATTACK_R = 52.0
BTN_SMALL_R = 42.0
CLUSTER_HALF = 26.0
CLUSTER_SMALL_HALF = 20.0

COLOR_JOYSTICK_FILL = (38, 42, 56, 120)
COLOR_JOYSTICK_BORDER = (90, 110, 150)
COLOR_JOYSTICK_ACTIVE = (120, 180, 255)
COLOR_KNOB_FILL = (70, 90, 130)
COLOR_BTN_FILL = (44, 48, 66, 150)
COLOR_BTN_BORDER = (120, 140, 180)
COLOR_BTN_HOLD_FILL = (90, 130, 200, 180)
COLOR_BTN_HOLD_BORDER = (170, 205, 255)
COLOR_LABEL = (225, 228, 235)
COLOR_READY = (255, 210, 90)
COLOR_DISABLED = (80, 84, 100)


@dataclass
class VirtualJoystick:
    """Fixed-base joystick: one bound finger, analog offset clamped to radius."""

    cx: float
    cy: float
    radius: float
    knob_radius: float
    active_finger: int | str | None = None
    offset_x: float = 0.0
    offset_y: float = 0.0
    slop: float = JOYSTICK_SLOP
    _bg_surf: pygame.Surface | None = None
    _bg_bc: int = 0

    @property
    def vector(self) -> tuple[float, float]:
        """Analog unit-ish vector (0..1 length) in screen/logical axes."""
        if not self.active:
            return (0.0, 0.0)
        d = math.hypot(self.offset_x, self.offset_y)
        if d < 1e-6:
            return (0.0, 0.0)
        max_d = max(1.0, self.radius - self.knob_radius)
        strength = min(1.0, d / max_d)
        return (self.offset_x / d * strength, self.offset_y / d * strength)

    @property
    def active(self) -> bool:
        return self.active_finger is not None

    def _hits(self, px: float, py: float) -> bool:
        return math.hypot(px - self.cx, py - self.cy) <= self.radius + self.slop

    def begin(self, finger_id: int | str, pos: tuple[float, float]) -> bool:
        if self.active:
            return False
        px, py = pos
        if not self._hits(px, py):
            return False
        self.active_finger = finger_id
        self._set_offset(px, py)
        return True

    def drag(self, finger_id: int | str, pos: tuple[float, float]) -> None:
        if finger_id != self.active_finger:
            return
        self._set_offset(*pos)

    def end(self, finger_id: int | str) -> None:
        if finger_id != self.active_finger:
            return
        self.active_finger = None
        self.offset_x = 0.0
        self.offset_y = 0.0

    def _set_offset(self, px: float, py: float) -> None:
        dx, dy = px - self.cx, py - self.cy
        max_d = max(1.0, self.radius - self.knob_radius)
        d = math.hypot(dx, dy)
        if d > max_d:
            dx, dy = dx / d * max_d, dy / d * max_d
        self.offset_x, self.offset_y = dx, dy

    def draw(self, surface: pygame.Surface) -> None:
        cx, cy = int(self.cx), int(self.cy)
        # Cache the static joystick base (only the knob moves each frame).
        if self._bg_surf is None:
            pad = 6
            bc = int(self.radius + pad)
            bg = pygame.Surface((bc * 2, bc * 2), pygame.SRCALPHA).convert_alpha()
            pygame.draw.circle(bg, COLOR_JOYSTICK_FILL, (bc, bc), int(self.radius))
            pygame.draw.circle(bg, COLOR_JOYSTICK_BORDER, (bc, bc), int(self.radius), 3)
            pygame.draw.circle(
                bg,
                (16, 20, 30, 180),
                (bc, bc),
                max(2, int(self.radius - self.knob_radius)),
                1,
            )
            self._bg_surf = bg
            self._bg_bc = bc
        surface.blit(self._bg_surf, (cx - self._bg_bc, cy - self._bg_bc))
        kx = int(cx + self.offset_x)
        ky = int(cy + self.offset_y)
        knob_border = COLOR_JOYSTICK_ACTIVE if self.active else COLOR_KNOB_FILL
        pygame.draw.circle(surface, COLOR_KNOB_FILL, (kx, ky), int(self.knob_radius))
        pygame.draw.circle(surface, knob_border, (kx, ky), int(self.knob_radius), 2)


_CIRCLE_BG_CACHE: dict[tuple, pygame.Surface] = {}


def _circle_bg(radius: int, state: str) -> pygame.Surface:
    """Pre-rendered circular button background per state (normal/held/emphasis)."""
    key = (radius, state)
    cached = _CIRCLE_BG_CACHE.get(key)
    if cached is not None:
        return cached
    pad = 4
    size = (radius + pad) * 2
    surf = pygame.Surface((size, size), pygame.SRCALPHA).convert_alpha()
    c = size // 2
    if state == "held":
        fill, border = COLOR_BTN_HOLD_FILL, COLOR_BTN_HOLD_BORDER
    elif state == "emphasis":
        fill, border = COLOR_BTN_FILL, COLOR_READY
    else:
        fill, border = COLOR_BTN_FILL, COLOR_BTN_BORDER
    pygame.draw.circle(surf, fill, (c, c), radius)
    pygame.draw.circle(surf, border, (c, c), radius, 3)
    if state == "emphasis":
        pygame.draw.circle(surf, COLOR_READY, (c, c), radius + 3, 1)
    _CIRCLE_BG_CACHE[key] = surf
    return surf


@dataclass
class ActionButton:
    """Circular press button: bound finger, held state, one-frame pressed edge."""

    label: str
    cx: float
    cy: float
    radius: float
    active_finger: int | str | None = None
    held: bool = False
    pressed_edge: bool = False
    emphasis: bool = False

    def update(self) -> None:
        self.pressed_edge = False

    def _hits(self, px: float, py: float) -> bool:
        # Square hit box (matches on-screen circle, avoids corner overlap between neighbors).
        r = self.radius + 4.0
        return abs(px - self.cx) <= r and abs(py - self.cy) <= r

    def distance_to(self, px: float, py: float) -> float:
        return math.hypot(px - self.cx, py - self.cy)

    def begin(self, finger_id: int | str, pos: tuple[float, float]) -> bool:
        if self.active_finger is not None:
            return False
        if not self._hits(*pos):
            return False
        self.active_finger = finger_id
        self.held = True
        self.pressed_edge = True
        return True

    def end(self, finger_id: int | str) -> None:
        if finger_id != self.active_finger:
            return
        self.active_finger = None
        self.held = False

    def draw(self, surface: pygame.Surface) -> None:
        cx, cy = int(self.cx), int(self.cy)
        r = int(self.radius)
        if self.held:
            state = "held"
        elif self.emphasis:
            state = "emphasis"
        else:
            state = "normal"
        bg = _circle_bg(r, state)
        surface.blit(bg, (cx - bg.get_width() // 2, cy - bg.get_height() // 2))
        text = _cached_label(self.label, max(16, r // 2))
        surface.blit(text, (cx - text.get_width() // 2, cy - text.get_height() // 2))


@dataclass
class SquareButton:
    """Small square utility button (template switch / mute / context)."""

    label: str
    cx: float
    cy: float
    half: float
    active_finger: int | str | None = None
    held: bool = False
    pressed_edge: bool = False

    def update(self) -> None:
        self.pressed_edge = False

    def _hits(self, px: float, py: float) -> bool:
        return abs(px - self.cx) <= self.half + 8.0 and abs(py - self.cy) <= self.half + 8.0

    def begin(self, finger_id: int | str, pos: tuple[float, float]) -> bool:
        if self.active_finger is not None:
            return False
        if not self._hits(*pos):
            return False
        self.active_finger = finger_id
        self.held = True
        self.pressed_edge = True
        return True

    def end(self, finger_id: int | str) -> None:
        if finger_id != self.active_finger:
            return
        self.active_finger = None
        self.held = False

    def draw(self, surface: pygame.Surface) -> None:
        cx, cy = int(self.cx), int(self.cy)
        half = int(self.half)
        state = "disabled" if not self.label else ("held" if self.held else "normal")
        bg = _square_bg(half, state)
        surface.blit(bg, (cx - half, cy - half))
        if self.label:
            text = _cached_label(self.label, 15)
            surface.blit(
                text, (cx - text.get_width() // 2, cy - text.get_height() // 2)
            )


_SQUARE_BG_CACHE: dict[tuple, pygame.Surface] = {}


def _square_bg(half: int, state: str) -> pygame.Surface:
    """Pre-rendered square button background (2 rounded rects) per state."""
    key = (half, state)
    cached = _SQUARE_BG_CACHE.get(key)
    if cached is not None:
        return cached
    size = half * 2
    surf = pygame.Surface((size, size), pygame.SRCALPHA).convert_alpha()
    rect = pygame.Rect(0, 0, size, size)
    if state == "disabled":
        fill, border = (36, 40, 52, 255), COLOR_DISABLED
    elif state == "held":
        fill, border = COLOR_BTN_HOLD_FILL, COLOR_BTN_HOLD_BORDER
    else:
        fill, border = COLOR_BTN_FILL, COLOR_BTN_BORDER
    pygame.draw.rect(surf, fill, rect, border_radius=8)
    pygame.draw.rect(surf, border, rect, 2, border_radius=8)
    _SQUARE_BG_CACHE[key] = surf
    return surf


class TouchControls:
    """Root container: routes events, owns all touch widgets, draws overlay."""

    def __init__(self, logical_size: tuple[int, int]) -> None:
        self.logical_w, self.logical_h = logical_size
        w, h = self.logical_w, self.logical_h

        # Overlay layout: joystick bottom-left, action buttons bottom-right,
        # utility cluster top-right. Positions scale with logical size.
        joy_cx = max(120.0, w * 0.13)
        joy_cy = h - max(110.0, h * 0.20)
        self.joystick = VirtualJoystick(
            joy_cx, joy_cy, JOYSTICK_RADIUS, JOYSTICK_KNOB_RADIUS
        )

        # Action buttons: clean non-overlapping L-shape on the bottom-right.
        #   普攻 (big)   bottom-right corner
        #   滑步          to the LEFT of 普攻 (same row)
        #   大招          ABOVE 普攻
        # Hit zones use radius + 10 slop, so spacing must exceed
        # (atk_r+10) + (small_r+10) to avoid 滑步 landing on 普攻.
        atk_r = BTN_ATTACK_R
        atk_cx = w - (atk_r + 30.0)
        atk_cy = h - (atk_r + 30.0)
        self.attack = ActionButton("普攻", atk_cx, atk_cy, atk_r)

        # Gap so hit-zones (r+slop) never overlap; +12px visual gap.
        min_center_gap = atk_r + BTN_SMALL_R + 10.0 + 10.0 + 12.0
        slide_cx = atk_cx - min_center_gap
        slide_cy = atk_cy
        self.slide = ActionButton("滑步", slide_cx, slide_cy, BTN_SMALL_R)

        ult_cx = atk_cx
        ult_cy = atk_cy - min_center_gap
        self.ult = ActionButton("大招", ult_cx, ult_cy, BTN_SMALL_R)

        # Template / mute / context cluster — top-right corner.
        cluster_y = max(34.0, h * 0.08)
        right = w - max(30.0, w * 0.04)
        step = CLUSTER_HALF * 2 + 6
        self.template_buttons: list[SquareButton] = [
            SquareButton(str(i), right - (2 - idx) * step, cluster_y, CLUSTER_HALF)
            for idx, i in enumerate((1, 2, 3))
        ]
        small_step = CLUSTER_SMALL_HALF * 2 + 6
        self.mute = SquareButton(
            "M", right - 2 * small_step, cluster_y + CLUSTER_HALF * 2 + 10, CLUSTER_SMALL_HALF
        )
        self.context = SquareButton(
            "T", right, cluster_y + CLUSTER_HALF * 2 + 10, CLUSTER_SMALL_HALF
        )

        self._action_buttons = [self.attack, self.slide, self.ult]
        self._buttons: list[ActionButton | SquareButton] = [
            *self._action_buttons,
            *self.template_buttons,
            self.mute,
            self.context,
        ]
        self._template_pressed: int | None = None

    # --- read-only state consumed by the game ---
    @property
    def move(self) -> tuple[float, float]:
        return self.joystick.vector

    @property
    def joystick_active(self) -> bool:
        return self.joystick.active

    @property
    def attack_held(self) -> bool:
        return self.attack.held

    @property
    def slide_held(self) -> bool:
        return self.slide.held

    @property
    def ult_held(self) -> bool:
        return self.ult.held

    @property
    def attack_pressed(self) -> bool:
        return self.attack.pressed_edge

    @property
    def slide_pressed(self) -> bool:
        return self.slide.pressed_edge

    @property
    def ult_pressed(self) -> bool:
        return self.ult.pressed_edge

    @property
    def context_pressed(self) -> bool:
        return self.context.pressed_edge

    @property
    def mute_pressed(self) -> bool:
        return self.mute.pressed_edge

    @property
    def template_requested(self) -> int | None:
        return self._template_pressed

    # --- state helpers ---
    def set_context(self, *, tutorial: bool, game_over: bool) -> None:
        if tutorial:
            self.context.label = "T"
        elif game_over:
            self.context.label = "R"
        else:
            self.context.label = ""

    def set_ult_ready(self, ready: bool) -> None:
        self.ult.emphasis = ready

    # --- coordinate mapping ---
    def _get_window_size(self) -> tuple[int, int]:
        try:
            ww, wh = pygame.display.get_window_size()
        except pygame.error:
            ww, wh = self.logical_w, self.logical_h
        # pygame.SCALED on Android often reports logical size; finger coords are
        # still relative to the physical window — use desktop size for letterbox.
        if ww <= self.logical_w or wh <= self.logical_h:
            try:
                desktops = pygame.display.get_desktop_sizes()
                if desktops:
                    ww, wh = desktops[0]
            except pygame.error:
                pass
        return (ww, wh)

    def _finger_to_logical(self, fx: float, fy: float) -> tuple[float, float]:
        """Map normalized window coords (0..1) into the logical surface."""
        lw, lh = self.logical_w, self.logical_h
        # pygame.SCALED on Android: finger 0..1 usually maps to the game surface.
        x_direct = fx * lw
        y_direct = fy * lh
        if 0.0 <= x_direct <= lw and 0.0 <= y_direct <= lh:
            return x_direct, y_direct
        ww, wh = self._get_window_size()
        if ww <= lw + 2 and wh <= lh + 2:
            return x_direct, y_direct
        scale = min(ww / lw, wh / lh)
        ox = (ww - lw * scale) / 2.0
        oy = (wh - lh * scale) / 2.0
        x = (fx * ww - ox) / scale
        y = (fy * wh - oy) / scale
        return x, y

    def _pick_action_button(self, pos: tuple[float, float]) -> ActionButton | None:
        """Nearest action button whose hit box contains pos (not attack-first)."""
        px, py = pos
        best: ActionButton | None = None
        best_d = 1e9
        for b in self._action_buttons:
            if not b._hits(px, py):
                continue
            d = b.distance_to(px, py)
            if d < best_d:
                best_d = d
                best = b
        return best

    def _route_press(self, finger_id: int | str, pos: tuple[float, float]) -> bool:
        """Bind one finger to a control."""
        px, py = pos
        _tlog(
            f"PRESS fid={finger_id} pos=({px:.0f},{py:.0f}) "
            f"joy_active={self.joystick.active}"
        )
        if px >= self.logical_w * 0.35:
            picked = self._pick_action_button(pos)
            if picked is not None:
                # Same finger may have been on the joystick; release stick so the
                # action press is not ignored while "moving".
                self.joystick.end(finger_id)
                if picked.begin(finger_id, pos):
                    _tlog(f"  -> btn={picked.label} at=({int(px)},{int(py)})")
                    print(
                        f"[musou] touch btn={picked.label} at=({int(px)},{int(py)})",
                        flush=True,
                    )
                    return True
            _tlog(f"  -> no action button picked (nearest={picked})")
        if self.joystick.begin(finger_id, pos):
            _tlog(f"  -> joystick at=({int(px)},{int(py)})")
            return True
        for b in self._buttons:
            if b.begin(finger_id, pos):
                if isinstance(b, SquareButton) and b in self.template_buttons:
                    self._template_pressed = int(b.label)
                _tlog(f"  -> square btn={b.label}")
                return True
        _tlog("  -> NOTHING")
        return False

    # --- event routing ---
    def handle_event(self, event: pygame.event.Event) -> None:
        if event.type == pygame.FINGERDOWN:
            pos = self._finger_to_logical(event.x, event.y)
            _tlog(f"FINGERDOWN fid={event.finger_id} raw=({event.x:.3f},{event.y:.3f}) -> {pos[0]:.0f},{pos[1]:.0f}")
            self._route_press(event.finger_id, pos)
        elif event.type == pygame.FINGERUP:
            fid = event.finger_id
            _tlog(f"FINGERUP fid={fid}")
            self.joystick.end(fid)
            for b in self._buttons:
                b.end(fid)
        elif event.type == pygame.FINGERMOTION:
            pos = self._finger_to_logical(event.x, event.y)
            self.joystick.drag(event.finger_id, pos)
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            pos = (float(event.pos[0]), float(event.pos[1]))
            _tlog(f"MOUSEDOWN pos={event.pos}")
            self._route_press("mouse", pos)
        elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            _tlog("MOUSEUP")
            self.joystick.end("mouse")
            for b in self._buttons:
                b.end("mouse")
        elif event.type == pygame.MOUSEMOTION:
            pos = (float(event.pos[0]), float(event.pos[1]))
            self.joystick.drag("mouse", pos)

    def update(self) -> None:
        """Clear one-frame pressed edges (after game logic consumed them)."""
        for b in self._buttons:
            b.update()
        self._template_pressed = None

    def draw(self, surface: pygame.Surface) -> None:
        self.joystick.draw(surface)
        for b in self._buttons:
            b.draw(surface)
