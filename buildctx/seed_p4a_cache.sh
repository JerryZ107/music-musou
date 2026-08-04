#!/bin/bash
set -u
PKG=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/packages
mkdir -p "$PKG"

fetch() {
  local recipe="$1"
  local filename="$2"
  local url="$3"
  local dir="$PKG/$recipe"
  mkdir -p "$dir"
  local target="$dir/$filename"
  if [ -f "$target" ] && [ -f "$dir/.mark-$filename" ]; then
    echo "cached: $recipe/$filename"
    return 0
  fi
  echo "downloading $recipe/$filename ..."
  timeout 420 curl -sSL --retry 3 --retry-delay 2 -o "$target" --max-time 400 "$url" || { echo "FAILED: $url"; rm -f "$target"; exit 1; }
  case "$filename" in
    *.zip) magic=$(head -c 4 "$target" | od -An -tx1 | tr -d ' \n') ;;
    *)     magic=$(head -c 2 "$target" | od -An -tx1 | tr -d ' \n') ;;
  esac
  if [ "$filename" = "v1.6.37.zip" ] && [ "$magic" != "504b0304" ]; then
    echo "BAD FILE (not zip): $url"; rm -f "$target"; exit 1
  fi
  if [ "$filename" != "v1.6.37.zip" ] && [ "$magic" != "1f8b" ]; then
    echo "BAD FILE (not gzip): $url ($magic)"; rm -f "$target"; exit 1
  fi
  touch "$dir/.mark-$filename"
  echo "ok: $recipe/$filename ($(du -h "$target" | cut -f1))"
}

GH="https://ghproxy.net/https://github.com"
CO="https://codeload.github.com"

fetch openssl    openssl-3.3.1.tar.gz          "https://www.openssl.org/source/openssl-3.3.1.tar.gz"
fetch python3    v3.14.2.tar.gz                "$CO/python/cpython/tar.gz/refs/tags/v3.14.2"
fetch hostpython3 v3.14.2.tar.gz               "$CO/python/cpython/tar.gz/refs/tags/v3.14.2"
fetch pygame     2.1.0.tar.gz                  "$CO/pygame/pygame/tar.gz/refs/tags/2.1.0"
fetch libffi     v3.4.2.tar.gz                 "$CO/libffi/libffi/tar.gz/refs/tags/v3.4.2"
fetch jpeg       2.0.1.tar.gz                  "$CO/libjpeg-turbo/libjpeg-turbo/tar.gz/refs/tags/2.0.1"
fetch png        v1.6.37.zip                   "$CO/pnggroup/libpng/zip/refs/tags/v1.6.37"
fetch sqlite3    version-3.50.4.tar.gz         "$CO/sqlite/sqlite/tar.gz/refs/tags/version-3.50.4"

fetch sdl2       SDL2-2.30.11.tar.gz           "$GH/libsdl-org/SDL/releases/download/release-2.30.11/SDL2-2.30.11.tar.gz"
fetch sdl2_image SDL2_image-2.8.2.tar.gz       "$GH/libsdl-org/SDL_image/releases/download/release-2.8.2/SDL2_image-2.8.2.tar.gz"
fetch sdl2_mixer SDL2_mixer-2.6.3.tar.gz       "$GH/libsdl-org/SDL_mixer/releases/download/release-2.6.3/SDL2_mixer-2.6.3.tar.gz"
fetch sdl2_ttf   SDL2_ttf-2.22.0.tar.gz        "$GH/libsdl-org/SDL_ttf/releases/download/release-2.22.0/SDL2_ttf-2.22.0.tar.gz"

echo "-- verify sdl2 md5 --"
actual=$(md5sum "$PKG/sdl2/SDL2-2.30.11.tar.gz" | cut -d' ' -f1)
echo "actual:   $actual"
echo "expected: bea190b480f6df249db29eb3bacfe41e"
[ "$actual" = "bea190b480f6df249db29eb3bacfe41e" ] || { echo "SDL2 MD5 MISMATCH"; exit 1; }
echo "ALL SEEDED"
