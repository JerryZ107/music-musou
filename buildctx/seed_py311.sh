#!/bin/bash
PKG=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/packages
CO="https://codeload.github.com"

for recipe in python3 hostpython3; do
  dir="$PKG/$recipe"
  mkdir -p "$dir"
  rm -f "$dir/v3.11.9.tar.gz" "$dir/.mark-v3.11.9.tar.gz"
  echo "downloading $recipe/v3.11.9.tar.gz ..."
  timeout 300 curl -sSL --retry 3 -o "$dir/v3.11.9.tar.gz" --max-time 280 "$CO/python/cpython/tar.gz/refs/tags/v3.11.9" || exit 1
  magic=$(head -c 2 "$dir/v3.11.9.tar.gz" | od -An -tx1 | tr -d ' \n')
  if [ "$magic" != "1f8b" ]; then echo "BAD FILE"; exit 1; fi
  touch "$dir/.mark-v3.11.9.tar.gz"
  echo "ok: $(du -h "$dir/v3.11.9.tar.gz" | cut -f1)"
done
