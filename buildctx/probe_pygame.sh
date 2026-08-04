#!/bin/bash
CO="https://codeload.github.com"
TMP=/root/pygame_probe
rm -rf "$TMP"
mkdir -p "$TMP"

for v in 2.1.3 2.2.0 2.5.2; do
  echo "==== pygame $v ===="
  timeout 120 curl -sSL --retry 2 -o "$TMP/pg-$v.tar.gz" --max-time 110 "$CO/pygame/pygame/tar.gz/refs/tags/$v" || { echo "download failed"; continue; }
  mkdir -p "$TMP/pg-$v"
  tar xzf "$TMP/pg-$v.tar.gz" -C "$TMP/pg-$v"
  D="$TMP/pg-$v/pygame-$v"
  echo "Setup.Android.SDL2.in: $([ -f "$D/buildconfig/Setup.Android.SDL2.in" ] && echo YES || echo NO)"
  echo "longintrepr refs in src_c/_sdl2: $(grep -rl longintrepr "$D/src_c/_sdl2" 2>/dev/null | wc -l)"
  echo "longintrepr refs in src_c (top): $(grep -rl longintrepr "$D/src_c" 2>/dev/null | wc -l)"
done
