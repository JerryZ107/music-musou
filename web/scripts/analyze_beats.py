"""Analyze an audio file and emit beat/onset times for MusicProfile."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import librosa
import numpy as np
from scipy.signal import butter, sosfilt

# 主拍分析窗：每窗内取一次「最高升调」作为候选拍点。
PITCH_RISE_WINDOW_MS = 670
# 用前 N 秒窗内升调峰值的平均值作阈值，筛掉弱拍。
PITCH_RISE_CALIB_SEC = 30.0


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
    sos = butter(4, [35, 220], btype="band", fs=sr, output="sos")
    y_bass = sosfilt(sos, y)
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


def _obvious_beats(
    y: np.ndarray,
    sr: int,
    bpm_hint: float | None = None,
) -> tuple[float, np.ndarray, float]:
    """
    「比较明显的拍」= 清晰升降调小包的顶点（不问音量、不问鼓）。
    包络 = |半音升降| ∪ 谐波频谱通量；用滞回找出连续小包，取每包 argmax。
    """
    hop = 512
    y_harm, _y_perc = librosa.effects.hpss(y, margin=2.0)

    f0, voiced_flag, _ = librosa.pyin(
        y_harm,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
        frame_length=2048,
        hop_length=hop,
    )
    f0 = np.asarray(f0, dtype=np.float64)
    voiced = np.asarray(voiced_flag, dtype=bool) & np.isfinite(f0) & (f0 > 0)

    both = voiced.copy()
    both[1:] = voiced[1:] & voiced[:-1]
    ratio = np.ones_like(f0)
    ratio[1:] = np.where(both[1:], f0[1:] / np.maximum(f0[:-1], 1e-8), 1.0)
    semis = np.abs(12.0 * np.log2(np.maximum(ratio, 1e-8)))
    pitch_move = np.where(both, semis, 0.0)
    pitch_move[0] = 0.0

    flux = librosa.onset.onset_strength(y=y_harm, sr=sr, hop_length=hop, aggregate=np.median)
    if len(flux) < len(pitch_move):
        flux = np.pad(flux, (0, len(pitch_move) - len(flux)))
    else:
        flux = flux[: len(pitch_move)]

    # 各自按自身 95 分位归一，避免「大声段」抬高阈值淹没小声拨弦
    def _norm95(x: np.ndarray) -> np.ndarray:
        p = float(np.percentile(x, 95)) + 1e-8
        return x / p

    packet = np.maximum(_norm95(pitch_move), 0.85 * _norm95(flux))
    if len(packet) >= 5:
        packet = np.convolve(packet, np.array([0.08, 0.18, 0.48, 0.18, 0.08]), mode="same")

    # 局部自适应：滚动中位，突出「相对周围清晰」的小包（小声段也能成包）
    win = max(8, int(round(0.6 * sr / hop)))  # ~0.6s
    if win % 2 == 0:
        win += 1
    kernel = np.ones(win, dtype=np.float64) / win
    local_mean = np.convolve(packet, kernel, mode="same")
    contrast = packet - local_mean

    # 滞回成包：进入高阈、落到低阈结束；每包取顶点
    hi = float(np.percentile(contrast, 70))
    lo = float(np.percentile(contrast, 45))
    hi = max(0.02, hi)
    lo = max(0.008, min(lo, hi * 0.55))

    picks_f: list[int] = []
    in_pack = False
    start = 0
    for i, c in enumerate(contrast):
        if not in_pack and c >= hi:
            in_pack = True
            start = i
        elif in_pack and c <= lo:
            seg = packet[start : i + 1]
            if len(seg) >= 2:
                peak = start + int(np.argmax(seg))
                # 包要有一点「尖」：顶点高于包内中位
                if packet[peak] >= float(np.median(seg)) * 1.05:
                    picks_f.append(peak)
            in_pack = False
    if in_pack:
        seg = packet[start:]
        if len(seg) >= 2:
            picks_f.append(start + int(np.argmax(seg)))

    # 最短间隔去重（同包双峰）
    min_gap_f = max(1, int(round(0.25 * sr / hop)))
    filtered: list[int] = []
    for f in picks_f:
        if not filtered or f - filtered[-1] >= min_gap_f:
            filtered.append(f)
        elif packet[f] > packet[filtered[-1]]:
            filtered[-1] = f

    times = librosa.frames_to_time(np.asarray(filtered, dtype=np.int32), sr=sr, hop_length=hop)
    beat_times = np.asarray([float(t) for t in times], dtype=np.float64)
    if len(beat_times) >= 2:
        med = float(np.median(np.diff(beat_times)))
        bpm = 60.0 / med if med > 1e-6 else 120.0
    else:
        bpm = float(bpm_hint) if bpm_hint else 120.0
    return float(bpm), beat_times, float(hi)


def _pitch_rise_beats(
    y: np.ndarray,
    sr: int,
    window_ms: float = PITCH_RISE_WINDOW_MS,
    calib_sec: float = PITCH_RISE_CALIB_SEC,
) -> tuple[float, np.ndarray, float]:
    """
    按音调升降取拍：
    1) 非重叠 window_ms 窗内取升调最强帧为候选；
    2) 取前 calib_sec 秒候选峰值的平均值作阈值；
    3) 整曲只保留峰值 > 该平均值的拍点。
    返回 (bpm, beat_times, threshold)。
    """
    y_harm, _y_perc = librosa.effects.hpss(y, margin=2.0)
    f0, voiced_flag, _ = librosa.pyin(
        y_harm,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
        frame_length=2048,
    )
    times = librosa.times_like(f0, sr=sr, hop_length=512)
    f0 = np.asarray(f0, dtype=np.float64)
    voiced = np.asarray(voiced_flag, dtype=bool) & np.isfinite(f0) & (f0 > 0)

    valid = voiced.copy()
    valid[1:] = voiced[1:] & voiced[:-1]
    ratio = np.ones_like(f0)
    ratio[1:] = np.where(valid[1:], f0[1:] / np.maximum(f0[:-1], 1e-8), 1.0)
    semis = 12.0 * np.log2(np.maximum(ratio, 1e-8))
    rise = np.where(semis > 0, semis, 0.0)
    rise[0] = 0.0

    rms = librosa.feature.rms(y=y_harm, frame_length=2048, hop_length=512)[0]
    if len(rms) < len(f0):
        rms = np.pad(rms, (0, len(f0) - len(rms)))
    elif len(rms) > len(f0):
        rms = rms[: len(f0)]
    rms_rise = np.maximum(0.0, np.diff(rms, prepend=rms[0]))
    rms_rise = rms_rise / (float(np.percentile(rms_rise, 95)) + 1e-8)

    score = rise + 0.35 * rms_rise
    if len(score) >= 3:
        kernel = np.array([0.15, 0.7, 0.15], dtype=np.float64)
        score = np.convolve(score, kernel, mode="same")

    duration = len(y) / sr
    window_s = window_ms / 1000.0
    candidates: list[tuple[float, float]] = []  # (time_s, peak_score)
    t0 = 0.0
    while t0 < duration - 0.05:
        t1 = min(t0 + window_s, duration)
        mask = (times >= t0) & (times < t1)
        if not np.any(mask):
            t0 += window_s
            continue
        local = score[mask]
        idx_local = int(np.argmax(local))
        idx = np.flatnonzero(mask)[idx_local]
        candidates.append((float(times[idx]), float(local[idx_local])))
        t0 += window_s

    if not candidates:
        return 60.0 / window_s, np.asarray([], dtype=np.float64), 0.0

    calib = [s for t, s in candidates if t < calib_sec]
    if not calib:
        # 前 30s 几乎无候选时退回全体平均
        calib = [s for _, s in candidates]
    threshold = float(np.mean(calib))

    picks = [t for t, s in candidates if s > threshold]
    # 若筛得太狠（少于 8 个），略降到「≥ 均值」保底
    if len(picks) < 8:
        picks = [t for t, s in candidates if s >= threshold]

    beat_times = np.asarray(picks, dtype=np.float64)
    if len(beat_times) >= 2:
        gaps = np.diff(beat_times)
        med = float(np.median(gaps))
        bpm = 60.0 / med if med > 1e-6 else 120.0
    else:
        bpm = 60.0 / window_s
    return bpm, beat_times, threshold


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
      obvious — 清晰升降调小包的顶点（与音量/鼓点无关，推荐）
      pitch_rise — 0.67s 窗最高升调；前 30s 峰值均值作阈值筛拍
    """
    y, sr = librosa.load(path, sr=22050, mono=True)
    duration_ms = int(round(len(y) / sr * 1000))

    rise_threshold: float | None = None
    if mode == "obvious":
        bpm, beat_times, rise_threshold = _obvious_beats(y, sr, bpm_hint)
    elif mode == "pitch_rise":
        bpm, beat_times, rise_threshold = _pitch_rise_beats(y, sr, PITCH_RISE_WINDOW_MS)
    elif mode == "bass_drums":
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
    deduped: list[int] = []
    for t in beat_ms:
        if 0 <= t < duration_ms and (not deduped or t - deduped[-1] >= 80):
            deduped.append(t)
    beat_ms = deduped

    out: dict = {
        "bpm": round(bpm, 2),
        "durationMs": duration_ms,
        "beatOffsetMs": beat_offset_ms,
        "mode": mode,
        "beatCount": len(beat_ms),
        "beatTimesMs": beat_ms,
    }
    if mode == "pitch_rise":
        out["windowMs"] = PITCH_RISE_WINDOW_MS
        out["calibSec"] = PITCH_RISE_CALIB_SEC
        if rise_threshold is not None:
            out["riseThreshold"] = round(float(rise_threshold), 4)
    elif mode == "obvious" and rise_threshold is not None:
        out["onsetThreshold"] = round(float(rise_threshold), 4)
    return out


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
            "[quarter|half|downbeat|bass_drums|obvious|pitch_rise]",
            file=sys.stderr,
        )
        sys.exit(1)
    data = analyze(src, hint, mode=mode)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(data, indent=2), encoding="utf-8")
    meta = {k: data[k] for k in ("bpm", "durationMs", "beatOffsetMs", "mode", "beatCount") if k in data}
    for k in ("windowMs", "calibSec", "riseThreshold", "onsetThreshold"):
        if k in data:
            meta[k] = data[k]
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    main()
