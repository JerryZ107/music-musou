#!/bin/bash
probe() {
  local name="$1"
  local url="$2"
  local tmp
  tmp=$(mktemp)
  local code
  code=$(timeout 40 curl -sSL -o "$tmp" -w "%{http_code}" --max-time 35 "$url" 2>/dev/null)
  local size
  size=$(stat -c %s "$tmp" 2>/dev/null || echo 0)
  local kind
  kind=$(file -b "$tmp" | cut -c1-40)
  echo "$name => http=$code size=$size kind=$kind"
  rm -f "$tmp"
}

probe "pygame-refs"   "https://codeload.github.com/pygame/pygame/tar.gz/refs/tags/2.1.0"
probe "png-pnggroup"  "https://codeload.github.com/pnggroup/libpng/zip/refs/tags/v1.6.37"
probe "sqlite-tags"   "https://codeload.github.com/sqlite/sqlite/tar.gz/refs/tags/version-3.50.4"
probe "openssl-gh"    "https://codeload.github.com/openssl/openssl/tar.gz/refs/tags/openssl-3.3.1"
probe "openssl-www"   "https://www.openssl.org/source/openssl-3.3.1.tar.gz"
probe "openssl-ftp"   "https://ftp.openssl.org/source/openssl-3.3.1.tar.gz"
probe "sdl2ttf-www"   "https://www.libsdl.org/projects/SDL_ttf/release/SDL2_ttf-2.22.0.tar.gz"
probe "sdl2mix-www"   "https://www.libsdl.org/projects/SDL_mixer/release/SDL2_mixer-2.6.3.tar.gz"
probe "sdl2img-www"   "https://www.libsdl.org/projects/SDL_image/release/SDL2_image-2.8.2.tar.gz"
