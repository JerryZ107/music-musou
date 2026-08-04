#!/bin/bash
B=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/build/bootstrap_builds/sdl2/jni/SDL2_image
find "$B" -name .gitmodules -print0 2>/dev/null | while IFS= read -r -d '' f; do
  echo "==== $f ===="
  cat "$f"
done
