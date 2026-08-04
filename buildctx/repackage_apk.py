"""Repackage the installed APK with patched .pyc files (no rebuild needed).

Steps:
1. Read assets/private.tar from the installed APK.
2. Replace prototype/visuals/touch_controls/main .pyc entries with patched ones.
3. Write a new private.tar preserving original tar entry metadata.
4. Produce a new unsigned APK (zip) with the patched private.tar.
5. (Signing is done separately by uber-apk-signer in WSL.)
"""

from __future__ import annotations

import io
import shutil
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "buildctx"
SRC_APK = BUILD / "installed.apk"
OUT_APK = BUILD / "patched-unsigned.apk"
PYC_DIR = BUILD / "pyc"

# tar path -> local patched .pyc
REPLACEMENTS = {
    "demo/prototype.pyc": PYC_DIR / "prototype.pyc",
    "demo/visuals.pyc": PYC_DIR / "visuals.pyc",
    "demo/touch_controls.pyc": PYC_DIR / "touch_controls.pyc",
    "demo/tutorial.pyc": PYC_DIR / "tutorial.pyc",
    "demo/demo_music.pyc": PYC_DIR / "demo_music.pyc",
    "main.pyc": PYC_DIR / "main.pyc",
}


def rebuild_private_tar() -> bytes:
    with zipfile.ZipFile(SRC_APK) as z:
        src_data = z.read("assets/private.tar")
    # The original private.tar is a gzipped tar (gzip magic 1f 8b).
    # p4a's extractor expects a gzipped tar, so we must write gzip too.
    if src_data[:2] != b"\x1f\x8b":
        src_tar = tarfile.open(fileobj=io.BytesIO(src_data))
    else:
        import gzip
        src_tar = tarfile.open(fileobj=io.BytesIO(gzip.decompress(src_data)))
    out_buf = io.BytesIO()
    # Write a gzipped tar, preserving the original filename "private.tar".
    import gzip
    gz = gzip.GzipFile(filename="private.tar", mode="wb", fileobj=out_buf, mtime=0)
    out_tar = tarfile.open(fileobj=gz, mode="w")
    for member in src_tar.getmembers():
        if member.isfile() and member.name in REPLACEMENTS:
            new_data = REPLACEMENTS[member.name].read_bytes()
            member.size = len(new_data)
            member.mtime = 0
            out_tar.addfile(member, fileobj=io.BytesIO(new_data))
            print(f"  replaced {member.name} ({len(new_data)} bytes)")
        else:
            f = src_tar.extractfile(member) if member.isfile() else None
            out_tar.addfile(member, fileobj=f)
    out_tar.close()
    gz.close()
    return out_buf.getvalue()


def rebuild_apk(new_tar: bytes) -> None:
    if OUT_APK.exists():
        OUT_APK.unlink()
    with zipfile.ZipFile(SRC_APK) as zin:
        with zipfile.ZipFile(OUT_APK, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "assets/private.tar":
                    data = new_tar
                    # Preserve compression info but update size.
                    item.file_size = len(data)
                    print(f"  updated assets/private.tar ({len(data)} bytes)")
                zout.writestr(item, data)
    print(f"wrote {OUT_APK} ({OUT_APK.stat().st_size} bytes)")


def main() -> None:
    print("[1/2] rebuild private.tar")
    new_tar = rebuild_private_tar()
    print("[2/2] rebuild apk")
    rebuild_apk(new_tar)
    print("done")


if __name__ == "__main__":
    main()
