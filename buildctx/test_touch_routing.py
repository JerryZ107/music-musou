"""Simulate Android-style touch event streams against TouchControls.

Pygame on Android emits BOTH FINGER* and MOUSE* events for touches. This test
replays the streams to find the routing bug (slide->attack while moving).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "demo"))

import pygame  # noqa: E402

from touch_controls import TouchControls  # noqa: E402

LOGICAL = (896, 504)
JOY = (120.0, 394.0)
ATK = (814.0, 422.0)
SLIDE = (688.0, 422.0)
ULT = (814.0, 296.0)


def post(kind, **kw):
    pygame.event.post(pygame.event.Event(kind, **kw))


def pump(tc):
    for ev in pygame.event.get():
        tc.handle_event(ev)


def state(tc, tag):
    print(
        f"{tag}: atk={tc.attack_pressed} slide={tc.slide_pressed} "
        f"ult={tc.ult_pressed} joy={tc.joystick_active} move={tuple(round(v,2) for v in tc.move)}"
    )
    tc.update()


def scenario(name, stream):
    pygame.init()
    pygame.display.set_mode(LOGICAL)
    tc = TouchControls(LOGICAL)
    print(f"\n===== {name} =====")
    for ev in stream:
        post(**ev)
        pump(tc)
        if ev["kind"] in (pygame.FINGERDOWN, pygame.MOUSEBUTTONDOWN):
            state(tc, f"after {ev['kind']} {ev.get('finger_id', ev.get('button'))}")
    state(tc, "final")
    pygame.quit()


def fd(fid, pos):
    return dict(kind=pygame.FINGERDOWN, finger_id=fid, x=pos[0] / LOGICAL[0], y=pos[1] / LOGICAL[1])


def fm(fid, pos):
    return dict(kind=pygame.FINGERMOTION, finger_id=fid, x=pos[0] / LOGICAL[0], y=pos[1] / LOGICAL[1])


def fu(fid):
    return dict(kind=pygame.FINGERUP, finger_id=fid)


def md(pos):
    return dict(kind=pygame.MOUSEBUTTONDOWN, button=1, pos=pos)


def mm(pos):
    return dict(kind=pygame.MOUSEMOTION, pos=pos)


def mu():
    return dict(kind=pygame.MOUSEBUTTONUP, button=1, pos=(0, 0))


# Android/SDL emits FINGER* AND MOUSE* for each touch (mouse tracks primary).
scenario(
    "joystick down + slide tap (FINGER only)",
    [fd(0, JOY), fm(0, (160, 340)), fd(1, SLIDE)],
)

scenario(
    "joystick down + slide tap (FINGER + duplicate MOUSE at same pos)",
    [
        fd(0, JOY),
        md(JOY),
        fm(0, (160, 340)),
        mm((160, 340)),
        fd(1, SLIDE),
        md(SLIDE),
    ],
)

scenario(
    "joystick down + slide tap (FINGER + MOUSE reports primary finger pos)",
    [
        fd(0, JOY),
        md(JOY),
        fm(0, (160, 340)),
        mm((160, 340)),
        fd(1, SLIDE),
        md((160, 340)),
    ],
)

scenario(
    "joystick down + attack tap (FINGER + MOUSE duplicate)",
    [fd(0, JOY), md(JOY), fm(0, (160, 340)), mm((160, 340)), fd(1, ATK), md(ATK)],
)

scenario(
    "joystick down + ult tap (FINGER + MOUSE duplicate)",
    [fd(0, JOY), md(JOY), fm(0, (160, 340)), mm((160, 340)), fd(1, ULT), md(ULT)],
)
