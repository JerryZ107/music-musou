"""
Movement key test (no full game).

1) Automated: simulate pressed keys -> movement_vector fields (stdout).
2) Interactive: window shows get_pressed vs held-set vs position (needs focus).

Run:
  python demo/test_movement_keys.py
  python demo/test_movement_keys.py --auto-only
"""

from __future__ import annotations

import sys
from pathlib import Path

import pygame

sys.path.insert(0, str(Path(__file__).resolve().parent))
from input_move import (
    KeyboardHoldState,
    apply_movement,
    movement_vector_from_held,
    movement_vector_from_pressed,
    movement_vector_from_scancodes,
    poll_movement_vector,
    simulate_pressed_keys,
    _key_pressed,
)

KEY_NAMES = ("w", "a", "s", "d", "up", "down", "left", "right")


def run_auto_tests() -> None:
    k = pygame
    cases = [
        ((), (0.0, 0.0)),
        (("w",), (0.0, -1.0)),
        (("s",), (0.0, 1.0)),
        (("a",), (-1.0, 0.0)),
        (("d",), (1.0, 0.0)),
        (("w", "d"), (1.0, -1.0)),
    ]
    print("=== Simulated pygame.key.get_pressed() -> movement_vector ===")
    all_ok = True
    for names, expected in cases:
        keys = simulate_pressed_keys(k, *names)
        dx, dy = movement_vector_from_pressed(keys, k)
        ok = (dx, dy) == expected
        all_ok = all_ok and ok
        codes = []
        for n in names:
            code = getattr(k, f"K_{n}" if len(n) == 1 else f"K_{n.upper()}")
            codes.append((n, code))
        print(
            f"  keys={list(names)!s:20} codes={codes} "
            f"-> dx={dx}, dy={dy}  expect={expected}  {'OK' if ok else 'FAIL'}"
        )

    print("\n=== Simulated scancode held set -> movement_vector ===")
    scan_cases = [
        ({pygame.KSCAN_W}, (0.0, -1.0)),
        ({pygame.KSCAN_A, pygame.KSCAN_S}, (-1.0, 1.0)),
        ({pygame.KSCAN_LEFT}, (-1.0, 0.0)),
    ]
    for held, expected in scan_cases:
        dx, dy = movement_vector_from_scancodes(held, pygame)
        ok = (dx, dy) == expected
        all_ok = all_ok and ok
        print(f"  scancodes={held} -> dx={dx}, dy={dy} expect={expected} {'OK' if ok else 'FAIL'}")

    print("\n=== Simulated held-key set -> movement_vector ===")
    held_cases = [
        (set(), (0.0, 0.0)),
        ({pygame.K_w}, (0.0, -1.0)),
        ({pygame.K_a, pygame.K_s}, (-1.0, 1.0)),
        ({pygame.K_LEFT}, (-1.0, 0.0)),
        ({pygame.K_UP}, (0.0, -1.0)),
    ]
    for held, expected in held_cases:
        dx, dy = movement_vector_from_held(held, k)
        ok = (dx, dy) == expected
        all_ok = all_ok and ok
        print(f"  held={held} -> dx={dx}, dy={dy} expect={expected} {'OK' if ok else 'FAIL'}")

    px, py = 10.0, 10.0
    dx, dy = 1.0, 0.0
    nx, ny = apply_movement(px, py, dx, dy, speed=5.5, dt_sec=1.0 / 60.0)
    print(f"\n=== apply_movement sample (d held, 1 frame @60fps) ===")
    print(f"  ({px},{py}) + vector({dx},{dy}) -> ({nx:.4f},{ny:.4f})")

    if not all_ok:
        sys.exit(1)
    print("\nAll automated movement-key tests passed.")


def run_interactive() -> None:
    pygame.init()
    w, h = 640, 520
    screen = pygame.display.set_mode((w, h))
    if hasattr(pygame.key, "stop_text_input"):
        pygame.key.stop_text_input()
    font = pygame.font.SysFont("consolas", 16)
    pygame.display.set_caption("Movement Key Test — click window, hold WASD")
    input_armed = False
    clock = pygame.time.Clock()
    kb = KeyboardHoldState()
    px, py = 20.0, 15.0
    speed = 5.5

    while True:
        dt_ms = clock.tick(60)
        dt_sec = dt_ms / 1000.0

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return
            if event.type == pygame.MOUSEBUTTONDOWN:
                input_armed = True
            if event.type == pygame.WINDOWFOCUSGAINED:
                input_armed = True
            if event.type == pygame.KEYDOWN:
                kb.key_down(event.key, event.scancode, pygame)
                if event.key == pygame.K_ESCAPE:
                    pygame.quit()
                    return
            if event.type == pygame.KEYUP:
                kb.key_up(event.key, event.scancode, pygame)

        pressed = pygame.key.get_pressed()
        dx, dy = kb.movement(pygame, pressed) if input_armed else (0.0, 0.0)
        dx_h, dy_h = movement_vector_from_held(kb.held_keys, pygame)
        dx_s, dy_s = movement_vector_from_scancodes(kb.held_scancodes, pygame)
        dx_p, dy_p = movement_vector_from_pressed(pressed, pygame)
        if dx != 0.0 or dy != 0.0:
            px, py = apply_movement(px, py, dx, dy, speed, dt_sec)
            px = max(0.0, min(39.0, px))
            py = max(0.0, min(29.0, py))

        screen.fill((20, 20, 30))
        pygame.draw.circle(screen, (80, 220, 100), (int(px * 16), int(py * 16)), 10)

        lines = [
            "Click this window first. Hold WASD / arrows. ESC quit.",
            f"input_armed={input_armed}  last={kb.last_event}",
            f"player grid pos: ({px:.2f}, {py:.2f})",
            f"held keys: {sorted(kb.held_keys)}",
            f"held scancodes: {sorted(kb.held_scancodes)}",
            f"poll movement: dx={dx}, dy={dy}",
            f"from scancodes: dx={dx_s}, dy={dy_s}",
            f"from keys: dx={dx_h}, dy={dy_h}",
            f"from get_pressed (WASD): dx={dx_p}, dy={dy_p}",
            "",
            "Per-key get_pressed():",
        ]
        for name in KEY_NAMES:
            if len(name) == 1:
                code = getattr(pygame, f"K_{name}")
            else:
                code = getattr(pygame, f"K_{name.upper()}")
            lines.append(
                f"  {name:5} key={code} pressed={_key_pressed(pressed, code)}  "
                f"in_held={code in kb.held_keys}"
            )
        scan_map = [
            ("w", pygame.KSCAN_W),
            ("a", pygame.KSCAN_A),
            ("s", pygame.KSCAN_S),
            ("d", pygame.KSCAN_D),
            ("left", pygame.KSCAN_LEFT),
            ("up", pygame.KSCAN_UP),
        ]
        lines.append("")
        lines.append("Scancodes in held_scancodes:")
        for name, sc in scan_map:
            lines.append(f"  {name:5} scan={sc} active={sc in kb.held_scancodes}")

        y = 8
        for line in lines:
            if y > h - 20:
                break
            screen.blit(font.render(line, True, (220, 220, 230)), (8, y))
            y += 18

        pygame.display.flip()


def main() -> None:
    pygame.init()
    run_auto_tests()
    if "--auto-only" in sys.argv:
        return
    print("\nOpening interactive test window...\n")
    run_interactive()


if __name__ == "__main__":
    main()
