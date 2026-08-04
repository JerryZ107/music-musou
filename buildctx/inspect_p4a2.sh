#!/bin/bash
cd /root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/recipes
for r in jpeg png sqlite3 zlib; do
  echo "== $r =="
  grep -E "url =|sum =|version =|depends" "$r/__init__.py" 2>/dev/null | head -10
done
echo "== digests in main recipes =="
cd /root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/recipes
for r in openssl python3 pygame sdl2 sdl2_image sdl2_mixer sdl2_ttf libffi hostpython3 jpeg png sqlite3; do
  echo "-- $r --"
  grep -E "md5sum|sha1sum|sha256sum|sha512sum|blake2" "$r/__init__.py" 2>/dev/null | head -4
done
