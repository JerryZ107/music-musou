#!/bin/bash
PKG=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/packages
for entry in \
  "openssl/openssl-3.3.1.tar.gz" \
  "pygame/2.1.0.tar.gz" \
  "png/v1.6.37.zip" \
  "sqlite3/version-3.50.4.tar.gz" \
  "sdl2_image/SDL2_image-2.8.2.tar.gz" \
  "sdl2_mixer/SDL2_mixer-2.6.3.tar.gz" \
  "sdl2_ttf/SDL2_ttf-2.22.0.tar.gz"; do
  rm -f "$PKG/$entry" "$PKG/$(dirname "$entry")/.mark-$(basename "$entry")"
done
echo "-- sanity check of previously cached files --"
for f in python3/v3.14.2.tar.gz hostpython3/v3.14.2.tar.gz jpeg/2.0.1.tar.gz libffi/v3.4.2.tar.gz sdl2/SDL2-2.30.11.tar.gz; do
  printf "%s: " "$f"
  file -b "$PKG/$f" | cut -c1-45
done
