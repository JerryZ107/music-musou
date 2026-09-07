"""Analyze an audio file and emit beat/onset times for MusicProfile."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np
from scipy.signal import butter, sosfilt


def _pick_strided_beats(beat_times: np.ndarray, bpm: float, stride: int, beats_per_bar: int = 4) -> np.ndarray:
    """从 beat_track 结果里按 stride 抽稀，stride=4 为小节强拍，stride=2 为半小节。"""
    if stride <= 1 or len(beat_times) < stride:
        return beat_times
    best_phase = 0
    best_score = -1.0
    for phase in range(min(stride, beats_per_bar)):
        idx = np.arange(phase, len(beat_times), stride)
        if len(idx) < 2:
            continue
        gaps = np.diff(beat_times[idx])
        score = -float(np.std(gaps))
        if score > best_score:
            best_score = score
            best_phase = phase
    return beat_times[np.arange(best_phase, len(beat_times), stride)]


def _pick_downbeats(beat_times: np.ndarray, bpm: float, beats_per_bar: int = 4) -> np.ndarray:
    return _pick_strided_beats(beat_times, bpm, beats_per_bar, beats_per_bar)


def _bass_drums_onset_envelope(y: np.ndarray, sr: int) -> np.ndarray:
    """分离打击乐 + 低音频段，合并 onset 强度（跟鼓/贝斯走，弱化旋律）。"""
    _y_harm, y_perc = librosa.effects.hpss(y, margin=2.4)
    # 贝斯/底鼓：约 35–220 Hz
    sos = butter(4, [35, 220], btype="band", fs=sr, output="sos")
    y_bass = sosfilt(sos, y)
    # 军鼓/镲：打击分量里再取中低频鼓点
    sos_kick = butter(4, [35, 180], btype="band", fs=sr, output="sos")
    y_kick = sosfilt(sos_kick, y_perc)
    sos_snare = butter(4, [180, 2800], btype="band", fs=sr, output="sos")
    y_snare = sosfilt(sos_snare, y_perc)

    env_kick = librosa.onset.onset_strength(y=y_kick, sr=sr, aggregate=np.median)
    env_bass = librosa.onset.onset_strength(y=y_bass, sr=sr, aggregate=np.median)
    env_snare = librosa.onset.onset_strength(y=y_snare, sr=sr, aggregate=np.median)
    env_perc = librosa.onset.onset_strength(y=y_perc, sr=sr, aggregate=np.median)

    def norm(x: np.ndarray) -> np.ndarray:
        peak = float(np.max(x))
        return x / (peak + 1e-8)

    env_kick = norm(env_kick)
    env_bass = norm(env_bass)
    env_snare = norm(env_snare)
    env_perc = norm(env_perc)

    # 底鼓/贝斯权重略高，军鼓补充反拍
    combined = np.maximum(env_kick * 1.0, env_bass * 0.92)
    combined = np.maximum(combined, env_snare * 0.72)
    combined = np.maximum(combined, env_perc * 0.45)
    return combined


def _beat_track_from_envelope(
    onset_env: np.ndarray,
    sr: int,
    y: np.ndarray,
    bpm_hint: float | None,
) -> tuple[float, np.ndarray]:
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env,
        y=y,
        sr=sr,
        bpm=bpm_hint,
        units="frames",
        tightness=120,
        trim=False,
    )
    bpm = float(np.atleast_1d(tempo)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    return bpm, beat_times


def analyze(
    path: str,
    bpm_hint: float | None = None,
    *,
    mode: str = "quarter",
) -> dict:
    """
    mode:
      quarter — 全频段 beat_track 四分拍
      half — 每 2 拍留 1 拍
      downbeat — 每小节第一拍
      bass_drums — 贝斯 + 鼓频段 beat_track，保留全部节奏拍点
    """
    y, sr = librosa.load(path, sr=22050, mono=True)
    duration_ms = int(round(len(y) / sr * 1000))

    if mode == "bass_drums":
        onset_env = _bass_drums_onset_envelope(y, sr)
        bpm, beat_times = _beat_track_from_envelope(onset_env, sr, y, bpm_hint)
    else:
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, aggregate=np.median)
        bpm, beat_times = _beat_track_from_envelope(onset_env, sr, y, bpm_hint)

        if mode == "downbeat":
            beat_times = _pick_downbeats(beat_times, bpm, 4)
        elif mode == "half":
            beat_times = _pick_strided_beats(beat_times, bpm, 2, 4)
        elif mode != "quarter":
            raise ValueError(f"unknown mode: {mode}")

    beat_offset_ms = int(round(float(beat_times[0]) * 1000)) if len(beat_times) else 0
    beat_times = beat_times[beat_times >= 0.05]

    beat_ms = [int(round(float(t) * 1000)) for t in beat_times]
    beat_ms = [t for t in beat_ms if 0 <= t < duration_ms]

    return {
        "bpm": round(bpm, 2),
        "durationMs": duration_ms,
        "beatOffsetMs": beat_offset_ms,
        "mode": mode,
        "beatCount": len(beat_ms),
        "beatTimesMs": beat_ms,
    }


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else ""
    out = sys.argv[2] if len(sys.argv) > 2 else ""
    hint: float | None = None
    mode = "quarter"
    if len(sys.argv) > 3:
        try:
            hint = float(sys.argv[3])
            if len(sys.argv) > 4:
                mode = sys.argv[4]
        except ValueError:
            mode = sys.argv[3]
    if not src or not out:
        print(
            "usage: analyze_beats.py <input.mp3> <output.json> [bpm_hint] "
            "[quarter|half|downbeat|bass_drums]",
            file=sys.stderr,
        )
        sys.exit(1)
    data = analyze(src, hint, mode=mode)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {k: data[k] for k in ("bpm", "durationMs", "beatOffsetMs", "mode", "beatCount")},
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
