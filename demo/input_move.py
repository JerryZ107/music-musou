"""Movement input: shared logic for tests and prototype."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Protocol, Sequence


class KeyIndices(Protocol):
    K_a: int
    K_d: int
    K_w: int
    K_s: int
    K_LEFT: int
    K_RIGHT: int
    K_UP: int
    K_DOWN: int


class ScancodeIndices(Protocol):
    KSCAN_A: int
    KSCAN_D: int
    KSCAN_W: int
    KSCAN_S: int
    KSCAN_LEFT: int
    KSCAN_RIGHT: int
    KSCAN_UP: int
    KSCAN_DOWN: int


def _key_pressed(keys: Sequence[bool], code: int) -> bool:
    if code < 0 or code >= len(keys):
        return False
    return bool(keys[code])


def movement_vector_from_scancodes(held: set[int], s: ScancodeIndices) -> tuple[float, float]:
    dx = dy = 0.0
    if s.KSCAN_A in held or s.KSCAN_LEFT in held:
        dx -= 1.0
    if s.KSCAN_D in held or s.KSCAN_RIGHT in held:
        dx += 1.0
    if s.KSCAN_W in held or s.KSCAN_UP in held:
        dy -= 1.0
    if s.KSCAN_S in held or s.KSCAN_DOWN in held:
        dy += 1.0
    return dx, dy


def movement_vector_from_pressed(keys: Sequence[bool], k: KeyIndices) -> tuple[float, float]:
    dx = dy = 0.0
    if _key_pressed(keys, k.K_a):
        dx -= 1.0
    if _key_pressed(keys, k.K_d):
        dx += 1.0
    if _key_pressed(keys, k.K_w):
        dy -= 1.0
    if _key_pressed(keys, k.K_s):
        dy += 1.0
    return dx, dy


def movement_vector_from_held(held: set[int], k: KeyIndices) -> tuple[float, float]:
    dx = dy = 0.0
    if k.K_a in held or k.K_LEFT in held:
        dx -= 1.0
    if k.K_d in held or k.K_RIGHT in held:
        dx += 1.0
    if k.K_w in held or k.K_UP in held:
        dy -= 1.0
    if k.K_s in held or k.K_DOWN in held:
        dy += 1.0
    return dx, dy


def poll_movement_vector(
    held_scancodes: set[int],
    held_keys: set[int],
    pressed: Sequence[bool],
    pg: KeyIndices,
) -> tuple[float, float]:
    """Scancode set → key set → get_pressed (WASD only)."""
    dx, dy = movement_vector_from_scancodes(held_scancodes, pg)
    if dx != 0.0 or dy != 0.0:
        return dx, dy
    dx, dy = movement_vector_from_held(held_keys, pg)
    if dx != 0.0 or dy != 0.0:
        return dx, dy
    return movement_vector_from_pressed(pressed, pg)


@dataclass
class KeyboardHoldState:
    held_keys: set[int] = field(default_factory=set)
    held_scancodes: set[int] = field(default_factory=set)
    last_event: str = ""

    def _register_scancode(self, pg: ScancodeIndices, key: int, scancode: int) -> None:
        if scancode:
            self.held_scancodes.add(scancode)
            return
        key_to_scan = {
            getattr(pg, "K_w", -1): pg.KSCAN_W,
            getattr(pg, "K_a", -1): pg.KSCAN_A,
            getattr(pg, "K_s", -1): pg.KSCAN_S,
            getattr(pg, "K_d", -1): pg.KSCAN_D,
            getattr(pg, "K_LEFT", -1): pg.KSCAN_LEFT,
            getattr(pg, "K_RIGHT", -1): pg.KSCAN_RIGHT,
            getattr(pg, "K_UP", -1): pg.KSCAN_UP,
            getattr(pg, "K_DOWN", -1): pg.KSCAN_DOWN,
        }
        scan = key_to_scan.get(key)
        if scan is not None:
            self.held_scancodes.add(scan)

    def key_down(self, key: int, scancode: int, pg: KeyIndices | None = None) -> None:
        self.held_keys.add(key)
        if pg is not None:
            self._register_scancode(pg, key, scancode)
        elif scancode:
            self.held_scancodes.add(scancode)
        self.last_event = f"down key={key} scan={scancode}"

    def key_up(self, key: int, scancode: int, pg: KeyIndices | None = None) -> None:
        self.held_keys.discard(key)
        if scancode:
            self.held_scancodes.discard(scancode)
        elif pg is not None:
            key_to_scan = {
                getattr(pg, "K_w", -1): pg.KSCAN_W,
                getattr(pg, "K_a", -1): pg.KSCAN_A,
                getattr(pg, "K_s", -1): pg.KSCAN_S,
                getattr(pg, "K_d", -1): pg.KSCAN_D,
                getattr(pg, "K_LEFT", -1): pg.KSCAN_LEFT,
                getattr(pg, "K_RIGHT", -1): pg.KSCAN_RIGHT,
                getattr(pg, "K_UP", -1): pg.KSCAN_UP,
                getattr(pg, "K_DOWN", -1): pg.KSCAN_DOWN,
            }
            scan = key_to_scan.get(key)
            if scan is not None:
                self.held_scancodes.discard(scan)
        self.last_event = f"up key={key} scan={scancode}"

    def movement(self, pg: KeyIndices, pressed: Sequence[bool]) -> tuple[float, float]:
        return poll_movement_vector(self.held_scancodes, self.held_keys, pressed, pg)


def apply_movement(
    px: float, py: float, dx: float, dy: float, speed: float, dt_sec: float
) -> tuple[float, float]:
    if dx == 0.0 and dy == 0.0:
        return px, py
    length = math.hypot(dx, dy)
    step = speed * dt_sec
    return px + dx / length * step, py + dy / length * step


def simulate_pressed_keys(k: KeyIndices, *names: str) -> list[bool]:
    keys = [False] * 512
    for name in names:
        if name in ("left", "right", "up", "down"):
            raise ValueError(f"use scancode/held tests for arrow {name!r}")
        attr = f"K_{name.lower()}"
        code = getattr(k, attr)
        keys[code] = True
    return keys
