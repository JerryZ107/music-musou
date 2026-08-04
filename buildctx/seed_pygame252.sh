#!/bin/bash
PKG=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/packages/pygame
mkdir -p "$PKG"
rm -f "$PKG/2.1.0.tar.gz" "$PKG/.mark-2.1.0.tar.gz" "$PKG/2.5.2.tar.gz" "$PKG/.mark-2.5.2.tar.gz"
cp /root/pygame_probe/pg-2.5.2.tar.gz "$PKG/2.5.2.tar.gz"
magic=$(head -c 2 "$PKG/2.5.2.tar.gz" | od -An -tx1 | tr -d ' \n')
[ "$magic" = "1f8b" ] || { echo "BAD FILE"; exit 1; }
touch "$PKG/.mark-2.5.2.tar.gz"
echo "seeded $(du -h "$PKG/2.5.2.tar.gz" | cut -f1)"
