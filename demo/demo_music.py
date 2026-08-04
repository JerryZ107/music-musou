"""Demo loop music (stdlib WAV) + pygame.mixer playback."""

from __future__ import annotations

import math
import struct
import wave
from dataclasses import dataclass
from pathlib import Path

import pygame

DEFAULT_BPM = 120.0
# pygame.mixer.music.get_pos() 往往早于扬声器实际出声，卡拍判定需减去该延迟（可用 [ ] 微调）
DEFAULT_AUDIO_LATENCY_MS = 130.0
DEMO_WAV_NAME = "musou_loop.wav"
DEMO_T2_WAV_NAME = "musou_loop_t2.wav"
DEMO_T3_WAV_NAME = "musou_loop_t3.wav"
GENERATOR_ID_T1 = "musou_loop_v3"
GENERATOR_ID_T2 = "musou_loop_t2_ode_joy_v1"
GENERATOR_ID_T3 = "musou_loop_t3_hero_v1"
TEMPLATE3_BPM = 140.0


def demo_wav_path(name: str = DEMO_WAV_NAME) -> Path:
    return Path(__file__).resolve().parent / "assets" / name


def _generator_stamp_path(path: Path) -> Path:
    return path.with_suffix(path.suffix + ".gen")


def _beat_grid_from_intervals(intervals_ms: tuple[int, ...]) -> tuple[tuple[float, ...], float]:
    """One onset per interval; loop length = sum(intervals)."""
    times: list[float] = []
    acc = 0.0
    for iv in intervals_ms:
        times.append(acc)
        acc += float(iv)
    return tuple(times), acc


def _regular_beat_grid(bpm: float, bars: int = 8, beats_per_bar: int = 4) -> tuple[tuple[float, ...], float]:
    period = 60_000.0 / bpm
    n = bars * beats_per_bar
    intervals = (int(round(period)),) * n
    return _beat_grid_from_intervals(intervals)


@dataclass(frozen=True)
class MusicProfile:
    """Gameplay beat grid + asset id (1 号电音 loop，2 号古典主题 loop)."""

    template_key: int
    wav_name: str
    generator_id: str
    beat_times_ms: tuple[float, ...]
    loop_ms: float
    bpm_label: float

    @property
    def beat_count(self) -> int:
        return len(self.beat_times_ms)

    @property
    def avg_period_ms(self) -> float:
        return self.loop_ms / max(1, self.beat_count)


# 1 号：120 BPM × 8 小节，与 musou_loop.wav 一致
_T1_GRID = _regular_beat_grid(DEFAULT_BPM, bars=8, beats_per_bar=4)
PROFILE_TEMPLATE1 = MusicProfile(
    template_key=1,
    wav_name=DEMO_WAV_NAME,
    generator_id=GENERATOR_ID_T1,
    beat_times_ms=_T1_GRID[0],
    loop_ms=_T1_GRID[1],
    bpm_label=DEFAULT_BPM,
)

def _midi_to_hz(midi: int) -> float:
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


@dataclass(frozen=True)
class ScoreNote:
    """midi note, start/duration in quarter-note beats from loop start."""

    midi: int
    start_beat: float
    dur_beats: float
    velocity: float = 1.0
    kind: str = "melody"  # melody | bass | harmony


def _build_ode_to_joy_loop() -> tuple[tuple[ScoreNote, ...], float, float, tuple[float, ...]]:
    """
    贝多芬《第九交响曲》「欢乐颂」主题（公有领域），简化两乐句循环。
    C 大调，4/4；拍点 = 每个旋律四分音符起音（含附点与切分）。
    """
    bpm = 84.0
    beat_ms = 60_000.0 / bpm

    # 主题 + 重复一遍，第二遍尾音收束到 C 便于循环
    melody_beats: tuple[tuple[int, float, float], ...] = (
        # 乐句 A
        (64, 0.0, 1.0),
        (64, 1.0, 1.0),
        (65, 2.0, 1.0),
        (67, 3.0, 1.0),
        (67, 4.0, 1.0),
        (65, 5.0, 1.0),
        (64, 6.0, 1.0),
        (62, 7.0, 1.0),
        (60, 8.0, 1.0),
        (60, 9.0, 1.0),
        (62, 10.0, 1.0),
        (64, 11.0, 1.0),
        (64, 12.0, 1.5),
        (62, 13.5, 0.5),
        (62, 14.0, 2.0),
        # 乐句 B（略作变化）
        (64, 16.0, 1.0),
        (64, 17.0, 1.0),
        (65, 18.0, 1.0),
        (67, 19.0, 1.0),
        (67, 20.0, 1.0),
        (65, 21.0, 1.0),
        (64, 22.0, 1.0),
        (62, 23.0, 1.0),
        (60, 24.0, 1.0),
        (60, 25.0, 1.0),
        (62, 26.0, 1.0),
        (64, 27.0, 1.0),
        (62, 28.0, 1.0),
        (60, 29.0, 1.0),
        (60, 30.0, 2.0),
    )

    bass_roots: tuple[tuple[int, float, float], ...] = (
        (48, 0.0, 4.0),
        (43, 4.0, 4.0),
        (48, 8.0, 4.0),
        (43, 12.0, 4.0),
        (48, 16.0, 4.0),
        (43, 20.0, 4.0),
        (48, 24.0, 4.0),
        (43, 28.0, 4.0),
    )

    harmony: tuple[tuple[int, float, float], ...] = (
        (60, 0.0, 2.0),
        (67, 2.0, 2.0),
        (65, 4.0, 2.0),
        (64, 6.0, 2.0),
        (60, 8.0, 2.0),
        (67, 10.0, 2.0),
        (65, 12.0, 2.0),
        (64, 14.0, 2.0),
        (60, 16.0, 2.0),
        (67, 18.0, 2.0),
        (65, 20.0, 2.0),
        (64, 22.0, 2.0),
        (60, 24.0, 2.0),
        (67, 26.0, 2.0),
        (65, 28.0, 2.0),
        (60, 30.0, 2.0),
    )

    loop_beats = 32.0
    loop_ms = loop_beats * beat_ms

    notes: list[ScoreNote] = []
    for m, s, d in melody_beats:
        notes.append(ScoreNote(m, s, d, 0.95, "melody"))
    for m, s, d in bass_roots:
        notes.append(ScoreNote(m, s, d, 0.42, "bass"))
    for m, s, d in harmony:
        notes.append(ScoreNote(m, s, d, 0.22, "harmony"))

    beat_starts: list[float] = []
    for _m, s, d in melody_beats:
        beat_starts.append(s * beat_ms)
        if abs(d - 1.5) < 0.01:
            beat_starts.append((s + 1.0) * beat_ms)
    beat_times = tuple(sorted({round(x, 2) for x in beat_starts}))

    return tuple(notes), loop_ms, bpm, beat_times


_ODE_NOTES, _ODE_LOOP_MS, _ODE_BPM, _ODE_BEAT_TIMES = _build_ode_to_joy_loop()
PROFILE_TEMPLATE2 = MusicProfile(
    template_key=2,
    wav_name=DEMO_T2_WAV_NAME,
    generator_id=GENERATOR_ID_T2,
    beat_times_ms=_ODE_BEAT_TIMES,
    loop_ms=_ODE_LOOP_MS,
    bpm_label=_ODE_BPM,
)

_T3_GRID = _regular_beat_grid(TEMPLATE3_BPM, bars=8, beats_per_bar=4)
PROFILE_TEMPLATE3 = MusicProfile(
    template_key=3,
    wav_name=DEMO_T3_WAV_NAME,
    generator_id=GENERATOR_ID_T3,
    beat_times_ms=_T3_GRID[0],
    loop_ms=_T3_GRID[1],
    bpm_label=TEMPLATE3_BPM,
)


def profile_for_template_key(template_key: int) -> MusicProfile:
    if template_key == 2:
        return PROFILE_TEMPLATE2
    if template_key == 3:
        return PROFILE_TEMPLATE3
    return PROFILE_TEMPLATE1


def _env_decay(phase: float, length: float) -> float:
    if phase >= length or length <= 0:
        return 0.0
    return (1.0 - phase / length) ** 1.6


def generate_demo_loop_wav(path: Path, bpm: float = DEFAULT_BPM, bars: int = 8) -> None:
    """4/4 action loop: drums, bass, pad, lead — seamless at *bars* (模板 1)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = 44100
    beat_sec = 60.0 / bpm
    beats = bars * 4
    total_samples = int(round(sample_rate * beat_sec * beats))
    loop_sec = total_samples / sample_rate

    roots_hz = [110.0, 87.31, 130.81, 98.0]
    chord_triads = [
        (110.0, 138.59, 164.81),
        (87.31, 110.0, 130.81),
        (130.81, 164.81, 196.0),
        (98.0, 123.47, 146.83),
    ]

    def noise(i: int) -> float:
        return ((i * 1103515245 + 12345) & 0x7FFFFFFF) / 0x7FFFFFFF * 2.0 - 1.0

    pent = [220.0, 261.63, 293.66, 329.63, 392.0]
    melody_pattern = [0, 2, 4, 2, 1, 2, 0, -1, 2, 4, 3, 2, 1, 0, -1, -1]

    frames = bytearray()
    for i in range(total_samples):
        t = i / sample_rate
        beat_f = t / beat_sec
        beat_idx = int(beat_f) % beats
        beat_phase = beat_f % 1.0
        bar_idx = beat_idx // 4
        chord_idx = (bar_idx // 2) % 4

        kick = 0.0
        if beat_idx % 4 == 0 or (bars >= 4 and beat_idx % 8 == 6):
            if beat_phase < 0.1:
                env = _env_decay(beat_phase, 0.1)
                kick = 0.62 * math.sin(2 * math.pi * 55 * beat_phase) * env

        snare = 0.0
        if beat_idx % 4 in (1, 3) and beat_phase < 0.08:
            env = _env_decay(beat_phase, 0.08)
            snare = 0.42 * noise(i) * env

        hat = 0.0
        eighth = beat_phase < 0.04 or (0.45 < beat_phase < 0.49)
        if eighth:
            hat = 0.11 * noise(i + 3) * (0.7 if beat_idx % 2 else 1.0)

        root = roots_hz[chord_idx]
        bass_env = 0.85 + 0.15 * math.sin(2 * math.pi * t * 2)
        bass = 0.2 * math.sin(2 * math.pi * root * t) * bass_env
        if beat_phase < 0.05:
            bass += 0.12 * math.sin(2 * math.pi * root * 0.5 * t) * _env_decay(beat_phase, 0.05)

        pad = 0.0
        for freq in chord_triads[chord_idx]:
            pad += 0.045 * math.sin(2 * math.pi * freq * t)
        bar_phase = (beat_idx % 4 + beat_phase) / 4.0
        pad *= 0.55 + 0.45 * math.sin(math.pi * bar_phase)

        lead = 0.0
        step = int(beat_f * 2) % len(melody_pattern)
        note_i = melody_pattern[step]
        if note_i >= 0 and beat_phase < 0.42:
            freq = pent[note_i % len(pent)]
            env = _env_decay(beat_phase, 0.42) * (0.35 + 0.65 * (1.0 - beat_phase / 0.42))
            lead = 0.14 * math.sin(2 * math.pi * freq * t) * env
            lead += 0.06 * math.sin(2 * math.pi * freq * 2 * t) * env

        sample = kick + snare + hat + bass + pad + lead
        sample = math.tanh(sample * 1.15)
        frames.extend(struct.pack("<h", int(sample * 32767 * 0.82)))

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(frames)

    stamp = _generator_stamp_path(path)
    stamp.write_text(
        f"{GENERATOR_ID_T1}\nbpm={bpm}\nbars={bars}\nsec={loop_sec:.4f}\n",
        encoding="utf-8",
    )


def _piano_tone(abs_t: float, t0: float, freq: float, dur_sec: float, vel: float) -> float:
    """简易钢琴：多谐波 + 指数衰减。"""
    phase = abs_t - t0
    if phase < 0.0 or phase > dur_sec:
        return 0.0
    attack = 0.004
    if phase < attack:
        env = phase / attack
    else:
        env = math.exp(-3.2 * (phase - attack) / max(0.08, dur_sec * 0.55))
    w = 2.0 * math.pi * freq * phase
    body = (
        math.sin(w) * 1.0
        + math.sin(2.0 * w) * 0.35
        + math.sin(3.0 * w) * 0.12
        + math.sin(4.0 * w) * 0.05
    )
    return vel * body * env


def generate_template3_loop_wav(path: Path, bpm: float = TEMPLATE3_BPM, bars: int = 8) -> None:
    """激昂战斗 loop：重鼓 + 上升合成器 + 铜管式 lead（模板 3）。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = 44100
    beat_sec = 60.0 / bpm
    beats = bars * 4
    total_samples = int(round(sample_rate * beat_sec * beats))
    loop_sec = total_samples / sample_rate

    def noise(i: int) -> float:
        return ((i * 1103515245 + 4242) & 0x7FFFFFFF) / 0x7FFFFFFF * 2.0 - 1.0

    roots = [82.41, 98.0, 110.0, 87.31]
    lead_notes = [329.63, 392.0, 440.0, 523.25, 493.88, 440.0, 392.0, 329.63]

    frames = bytearray()
    for i in range(total_samples):
        t = i / sample_rate
        beat_f = t / beat_sec
        beat_idx = int(beat_f) % beats
        beat_phase = beat_f % 1.0
        bar = beat_idx // 4

        kick = 0.0
        if beat_idx % 4 == 0 or beat_idx % 4 == 2:
            if beat_phase < 0.12:
                env = _env_decay(beat_phase, 0.12)
                kick = 0.72 * math.sin(2 * math.pi * 50 * beat_phase) * env

        snare = 0.0
        if beat_idx % 4 in (1, 3) and beat_phase < 0.09:
            snare = 0.48 * noise(i) * _env_decay(beat_phase, 0.09)

        hat = 0.0
        if beat_phase < 0.035 or (0.22 < beat_phase < 0.26) or (0.48 < beat_phase < 0.52):
            hat = 0.13 * noise(i + 1)

        root = roots[bar % 4]
        bass = 0.26 * math.sin(2 * math.pi * root * t)
        if beat_phase < 0.06:
            bass += 0.18 * math.sin(2 * math.pi * root * 0.5 * t) * _env_decay(beat_phase, 0.06)

        stab = 0.0
        if beat_idx % 2 == 0 and beat_phase < 0.18:
            f = lead_notes[(beat_idx // 2) % len(lead_notes)]
            env = _env_decay(beat_phase, 0.18)
            stab = 0.2 * math.sin(2 * math.pi * f * t) * env
            stab += 0.1 * math.sin(2 * math.pi * f * 2 * t) * env

        riser = 0.0
        bar_phase = (beat_idx % 4 + beat_phase) / 4.0
        if bar_phase > 0.75:
            riser = 0.08 * math.sin(2 * math.pi * (440 + 180 * (bar_phase - 0.75) / 0.25) * t)

        sample = kick + snare + hat + bass + stab + riser
        sample = math.tanh(sample * 1.2)
        frames.extend(struct.pack("<h", int(sample * 32767 * 0.84)))

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(frames)

    stamp = _generator_stamp_path(path)
    stamp.write_text(
        f"{GENERATOR_ID_T3}\nbpm={bpm}\nbars={bars}\nsec={loop_sec:.4f}\n",
        encoding="utf-8",
    )


def generate_template2_loop_wav(path: Path, profile: MusicProfile = PROFILE_TEMPLATE2) -> None:
    """贝多芬《欢乐颂》主题 — 合成钢琴 + 低音 + 轻和声，无鼓。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = 44100
    loop_ms = profile.loop_ms
    loop_sec = loop_ms / 1000.0
    total_samples = int(round(sample_rate * loop_sec))
    beat_sec = loop_sec / 32.0
    notes = _ODE_NOTES

    def mix_at(t: float) -> float:
        t_loop = t % loop_sec
        out = 0.0
        for note in notes:
            start = note.start_beat * beat_sec
            dur = note.dur_beats * beat_sec
            if t_loop < start or t_loop >= start + dur:
                continue
            t0 = t - (t_loop - start)
            freq = _midi_to_hz(note.midi)
            out += _piano_tone(t, t0, freq, dur, note.velocity)
        return out

    frames = bytearray()
    for i in range(total_samples):
        t = i / sample_rate
        sample = mix_at(t)
        sample = math.tanh(sample * 1.05) * 0.88
        frames.extend(struct.pack("<h", int(sample * 32767 * 0.82)))

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(frames)

    stamp = _generator_stamp_path(path)
    stamp.write_text(
        f"{profile.generator_id}\nloop_ms={loop_ms:.2f}\nbeats={len(profile.beat_times_ms)}\n",
        encoding="utf-8",
    )


def _needs_regenerate(path: Path, generator_id: str) -> bool:
    if not path.is_file():
        return True
    stamp = _generator_stamp_path(path)
    if not stamp.is_file():
        return True
    first = stamp.read_text(encoding="utf-8").splitlines()[0].strip()
    return first != generator_id


def ensure_profile_wav(profile: MusicProfile) -> Path:
    path = demo_wav_path(profile.wav_name)
    # On Android the prebuilt .wav is bundled without a .gen stamp; trust an
    # existing non-empty wav instead of regenerating (synthesis freezes the app
    # for several seconds on every template switch).
    if path.is_file() and path.stat().st_size > 1000:
        return path
    if _needs_regenerate(path, profile.generator_id):
        if profile.template_key == 2:
            generate_template2_loop_wav(path, profile)
        elif profile.template_key == 3:
            generate_template3_loop_wav(path, bpm=profile.bpm_label)
        elif profile.template_key == 1:
            generate_demo_loop_wav(path, bpm=profile.bpm_label)
        else:
            generate_demo_loop_wav(path, bpm=profile.bpm_label)
    return path


def init_mixer() -> None:
    if not pygame.mixer.get_init():
        pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=256)


_music_epoch_ms: int | None = None


def play_music_profile(profile: MusicProfile, loop: int = -1) -> Path:
    global _music_epoch_ms
    init_mixer()
    path = ensure_profile_wav(profile)
    pygame.mixer.music.load(str(path))
    pygame.mixer.music.set_volume(0.55)
    pygame.mixer.music.play(loop)
    _music_epoch_ms = pygame.time.get_ticks()
    return path


def play_demo_music(bpm: float = DEFAULT_BPM, loop: int = -1) -> Path:
    """Legacy entry: template-1 loop."""
    _ = bpm
    return play_music_profile(PROFILE_TEMPLATE1, loop=loop)


def music_timeline_ms(
    fallback_ms: int, *, latency_ms: float = DEFAULT_AUDIO_LATENCY_MS
) -> float:
    """
    卡拍判定用时间轴（毫秒）。扬声器晚于 get_pos()，故减去 latency_ms。
    """
    if not pygame.mixer.get_init():
        return float(fallback_ms)
    pos = pygame.mixer.music.get_pos()
    if pos >= 0:
        return max(0.0, float(pos) - latency_ms)
    if _music_epoch_ms is not None:
        return max(0.0, float(fallback_ms - _music_epoch_ms) - latency_ms)
    return float(fallback_ms)


def music_time_ms(fallback_ms: int) -> int:
    """未补偿的播放位置（调试用）。"""
    return int(music_timeline_ms(fallback_ms, latency_ms=0.0))


def toggle_music_mute() -> bool:
    """Toggle mute; returns True if now muted."""
    muted = pygame.mixer.music.get_volume() < 0.01
    pygame.mixer.music.set_volume(0.0 if not muted else 0.55)
    return not muted


def stop_music() -> None:
    if pygame.mixer.get_init():
        pygame.mixer.music.stop()
