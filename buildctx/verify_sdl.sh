#!/bin/bash
cd /root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/packages
for f in sdl2_image/SDL2_image-2.8.2.tar.gz sdl2_mixer/SDL2_mixer-2.6.3.tar.gz sdl2_ttf/SDL2_ttf-2.22.0.tar.gz; do
  echo "== $f =="
  file "$f"
  tar tzf "$f" 2>/dev/null | head -2
done
