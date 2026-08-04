"""Minimal pygame-on-Android smoke test with file-based logging.

Used only to isolate the startup crash: logs each step to a file inside the
app's private storage so we can read progress after the process dies.
"""

import os
import time

LOG_PATH = "/data/data/org.musou.musicmusou/files/debug.log"
ERR_PATH = "/data/data/org.musou.musicmusou/files/stderr.log"

# Capture native-level stderr (Python fatal errors, SDL errors, etc.).
try:
    err_fd = os.open(ERR_PATH, os.O_WRONLY | os.O_CREAT | os.O_APPEND)
    os.dup2(err_fd, 2)
except Exception:
    pass


def log(msg: str) -> None:
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(f"{time.time():.3f} {msg}\n")
    except Exception as exc:  # noqa: BLE001 - never let logging kill startup
        print(f"[minitest] log failed: {exc}", flush=True)


def main() -> None:
    log("start")
    print("[minitest] start", flush=True)

    import importlib

    for mod in ("pygame.base", "pygame.constants", "pygame.rect", "pygame"):
        log(f"importing {mod}")
        try:
            importlib.import_module(mod)
            log(f"imported {mod}")
        except BaseException as exc:  # noqa: BLE001
            log(f"import {mod} EXCEPTION: {exc!r}")
            return

    import pygame

    log("pygame imported")
    try:
        pygame.init()
        log("pygame.init done")
        log(f"mixer_init={pygame.mixer.get_init()} display_init={pygame.display.get_init()}")
    except Exception as exc:  # noqa: BLE001
        log(f"pygame.init EXCEPTION: {exc!r}")
        log(f"SDL error: {pygame.get_error()!r}")
        return

    # Pause here so we can observe the process state before set_mode.
    log("sleeping 10s before set_mode")
    for i in range(10):
        time.sleep(1)
        log(f"pre-set_mode tick {i}")

    try:
        screen = pygame.display.set_mode((800, 480))
        log(f"set_mode done size={screen.get_size()}")
    except Exception as exc:  # noqa: BLE001
        log(f"set_mode EXCEPTION: {exc!r}")
        log(f"SDL error: {pygame.get_error()!r}")
        return

    for frame in range(600):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                log("quit via event")
                return
        screen.fill((20, 30, 60))
        pygame.display.flip()
        if frame % 60 == 0:
            log(f"loop alive frame={frame}")
    pygame.quit()
    log("quit normal")


if __name__ == "__main__":
    main()
