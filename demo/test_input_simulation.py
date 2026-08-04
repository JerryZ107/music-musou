"""
Simulate keyboard via pygame.event.post (no human input).

Run:
  python demo/test_input_simulation.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pygame

sys.path.insert(0, str(Path(__file__).resolve().parent))
from input_move import KeyboardHoldState, apply_movement


def post_key_down(key: int, scancode: int) -> None:
    pygame.event.post(pygame.event.Event(pygame.KEYDOWN, key=key, scancode=scancode))


def post_key_up(key: int, scancode: int) -> None:
    pygame.event.post(pygame.event.Event(pygame.KEYUP, key=key, scancode=scancode))


def drain_keyboard(keyboard: KeyboardHoldState) -> list[str]:
    log: list[str] = []
    for event in pygame.event.get():
        if event.type == pygame.KEYDOWN:
            keyboard.key_down(event.key, event.scancode, pygame)
            log.append(f"KEYDOWN key={event.key} scancode={event.scancode}")
        elif event.type == pygame.KEYUP:
            keyboard.key_up(event.key, event.scancode, pygame)
            log.append(f"KEYUP key={event.key} scancode={event.scancode}")
    return log


def run_simulation() -> None:
    pygame.init()
    pygame.display.set_mode((320, 240))
    pygame.display.set_caption("input simulation (auto quit)")

    keyboard = KeyboardHoldState()
    px, py = 12.0, 9.0
    speed = 5.5
    dt_sec = 1.0 / 60.0

    print("=== Direct KeyboardHoldState (no pygame queue) ===")
    keyboard.key_down(pygame.K_d, pygame.KSCAN_D, pygame)
    dx, dy = keyboard.movement(pygame, pygame.key.get_pressed())
    print(f"  after key_down(K_d, KSCAN_D={pygame.KSCAN_D}): dx={dx}, dy={dy}")
    assert (dx, dy) == (1.0, 0.0), "direct key_down failed"
    keyboard.key_up(pygame.K_d, pygame.KSCAN_D, pygame)

    print("\n=== pygame.event.post KEYDOWN -> drain -> movement ===")
    keyboard = KeyboardHoldState()
    post_key_down(pygame.K_w, pygame.KSCAN_W)
    logs = drain_keyboard(keyboard)
    for line in logs:
        if line.startswith("KEY"):
            print(f"  {line}")
    dx, dy = keyboard.movement(pygame, pygame.key.get_pressed())
    print(f"  held_keys={keyboard.held_keys} held_scancodes={keyboard.held_scancodes}")
    print(f"  movement: dx={dx}, dy={dy}")
    assert (dx, dy) == (0.0, -1.0), "posted KEYDOWN W failed"

    print("\n=== 30 frames with D held via post each frame (simulate repeat) ===")
    keyboard = KeyboardHoldState()
    post_key_down(pygame.K_d, pygame.KSCAN_D)
    drain_keyboard(keyboard)
    start_x = px
    for frame in range(30):
        pygame.event.pump()
        dx, dy = keyboard.movement(pygame, pygame.key.get_pressed())
        px, py = apply_movement(px, py, dx, dy, speed, dt_sec)
        pygame.display.flip()
        pygame.time.delay(1)
    post_key_up(pygame.K_d, pygame.KSCAN_D)
    drain_keyboard(keyboard)
    print(f"  px {start_x:.4f} -> {px:.4f} (expect increase)")
    assert px > start_x + 0.5, "position did not change over 30 frames"

    print("\n=== Arrow: post LEFT scancode only ===")
    keyboard = KeyboardHoldState()
    post_key_down(pygame.K_LEFT, pygame.KSCAN_LEFT)
    drain_keyboard(keyboard)
    dx, dy = keyboard.movement(pygame, pygame.key.get_pressed())
    print(f"  K_LEFT scancode={pygame.KSCAN_LEFT} movement dx={dx}, dy={dy}")
    assert dx == -1.0, "arrow left failed"

    pygame.quit()
    print("\nAll input simulations passed.")


if __name__ == "__main__":
    run_simulation()
