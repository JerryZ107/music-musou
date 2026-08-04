#!/bin/bash
P=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/build/python-installs/musicmusou/arm64-v8a/pygame
S="$P/surface.cpython-311-x86_64-linux-gnu.so"
echo "== file =="
file "$S"
echo "== alphablit_alpha_sse2_argb_surf_alpha symbol =="
nm -D "$S" 2>/dev/null | grep 'alphablit_alpha_sse2_argb_surf_alpha'
echo "== pg_has_avx2 symbol =="
nm -D "$S" 2>/dev/null | grep 'pg_has_avx2'
echo "== undefined sse2/neon refs =="
nm -D "$S" 2>/dev/null | grep ' U .*\(sse2\|neon\)' | head -5
echo "== _sdl2 dir =="
ls "$P/_sdl2/" | head
file "$P/_sdl2/sdl2.cpython-311-x86_64-linux-gnu.so"
