"""Tutorial training scene: empty map, background control hints, T to enter combat."""

from __future__ import annotations

from pathlib import Path

import pygame

_BUNDLED_FONT = Path(__file__).resolve().parent / "assets" / "fonts" / "NotoSansSC-Regular.otf"

_FONT_CACHE: dict[int, pygame.font.Font] = {}

TUTORIAL_HINT_LINES: tuple[str, ...] = (
    "【训练场】可自由练习，场上没有敌人。",
    "WASD / 方向键 — 移动",
    "Enter — 1 圆 r=2；2 半圆 r=3（自动锁敌）；3 锁敌子弹",
    "Shift — 滑步；3 号卡拍：1 发锁敌强化子弹（穿透）",
    "空格 — 1 范围大招；2 五秒强化；3 召唤分身（嘲讽，与你同时普攻）",
    "数字 1 / 2 / 3 — 切换主角模板（3 号：激昂 BGM 140 BPM）",
    "左下节拍条 — 白点在左右亮区或出现「拍!」时按 Enter/Shift 即强化（与判定一致）",
    "卡拍成功 5 次 — 大招就绪（1 号：范围一击；2 号：5s 强化）",
    "M — 音乐静音",
    "",
    "熟悉后按  T  进入实战",
)


def ui_font(size: int = 18) -> pygame.font.Font:
    # Cache by size: loading an 8MB CJK .otf from disk every frame was the
    # main cause of the 1-2 FPS lag on Android (4-6 loads/frame).
    cached = _FONT_CACHE.get(size)
    if cached is not None:
        return cached
    if _BUNDLED_FONT.exists():
        try:
            f = pygame.font.Font(str(_BUNDLED_FONT), size)
            _FONT_CACHE[size] = f
            return f
        except (OSError, pygame.error):
            pass
    for name in ("microsoftyahei", "simhei", "msyh", "sans-serif", "consolas"):
        path = pygame.font.match_font(name)
        if path:
            f = pygame.font.Font(path, size)
            _FONT_CACHE[size] = f
            return f
    f = pygame.font.SysFont("consolas", size)
    _FONT_CACHE[size] = f
    return f


_TOUCH_HINT_LINES: tuple[str, ...] = (
    "训练场：可自由练习，场上没有敌人",
    "左下角摇杆 — 移动",
    "右下角 普攻 按钮 — 攻击（自动锁敌，卡拍 2 倍伤害）",
    "滑步 按钮 — 滑步位移，卡拍时带强化攻击",
    "大招 按钮 — 卡拍成功 5 次后亮起，按下释放",
    "1 / 2 / 3 按钮 — 切换模板（BGM 联动 140 BPM）",
    "M 按钮 — 音乐静音",
    "左下角节拍条：白点在两侧亮区时按攻击/滑步即卡拍",
    "",
    "熟悉后按  T  进入实战",
)


# Cached tutorial panels + banner. Keyed by (touch, input_armed, screen_w).
_TUT_CACHE: dict[tuple, pygame.Surface] = {}
_TUT_BANNER_CACHE: dict[int, pygame.Surface] = {}


def draw_tutorial_hints(
    screen: pygame.Surface,
    *,
    playfield_h: int,
    input_armed: bool,
    touch: bool = False,
) -> None:
    w, _ = screen.get_size()
    key = (touch, bool(input_armed), w)
    cached = _TUT_CACHE.get(key)
    if cached is not None:
        screen.blit(cached, (12, 12))
        banner = _TUT_BANNER_CACHE.get(w)
        if banner is None:
            banner = ui_font(15).render("训练场", True, (140, 180, 220))
            _TUT_BANNER_CACHE[w] = banner
        screen.blit(banner, (w - banner.get_width() - 14, 10))
        return

    body_font = ui_font(16)
    title_font = ui_font(20)

    panel_w = min(380, w // 3 + 120)
    line_h = 22
    text_lines = list(_TOUCH_HINT_LINES if touch else TUTORIAL_HINT_LINES)
    if not touch and not input_armed:
        text_lines = ["请先点击游戏窗口以启用键盘", ""] + text_lines
    panel_h = 28 + len(text_lines) * line_h + 8

    panel = pygame.Surface((panel_w, panel_h))
    panel.fill((16, 20, 32))
    pygame.draw.rect(panel, (90, 140, 210), (0, 0, panel_w, panel_h), 1)

    title = title_font.render("操作说明", True, (170, 210, 255))
    panel.blit(title, (14, 8))
    y = 36
    for i, line in enumerate(text_lines):
        if not line:
            y += line_h // 2
            continue
        col = (255, 230, 130) if "按  T" in line else (220, 224, 235)
        if i == 0 and input_armed:
            col = (160, 210, 255)
        panel.blit(body_font.render(line, True, col), (14, y))
        y += line_h

    _TUT_CACHE[key] = panel
    screen.blit(panel, (12, 12))

    banner = ui_font(15).render("训练场", True, (140, 180, 220))
    _TUT_BANNER_CACHE[w] = banner
    screen.blit(banner, (w - banner.get_width() - 14, 10))
