#!/bin/bash
# Copy the freshly rebuilt pygame into the dist bundle with device-friendly
# .so names (EXT_SUFFIX on the p4a target is plain ".so").
set -e

B=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a
SRC="$B/build/python-installs/musicmusou/arm64-v8a/pygame"
DEST="$B/dists/musicmusou/_python_bundle__arm64-v8a/_python_bundle/site-packages/pygame"

rm -rf "$DEST"
cp -a "$SRC" "$DEST"

find "$DEST" -name '*.cpython-311-x86_64-linux-gnu.so' -print0 | while IFS= read -r -d '' f; do
  mv "$f" "${f%.cpython-311-x86_64-linux-gnu.so}.so"
done

echo "== sample files =="
ls "$DEST" | grep '\.so$' | head -5
ls "$DEST/_sdl2" | grep '\.so$' | head -5
