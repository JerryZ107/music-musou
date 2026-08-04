#!/bin/bash
cd /root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/recipes
for r in openssl python3 pygame sdl2 sdl2_image sdl2_mixer sdl2_ttf libffi zlib hostpython3; do
  echo "== $r =="
  grep -E "url =|sum =|version =|depends" "$r/__init__.py" 2>/dev/null | head -8
done
