#!/bin/bash
P=/root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/bootstraps
echo "== styles.xml files =="
find "$P" -name "styles.xml" 2>/dev/null
echo "== grep translucent/theme =="
grep -rn "translucent\|KivySupportCutout\|Theme" "$P/_sdl_common/build/src/main/res/values/"*.xml 2>/dev/null | head -20
echo "== generated dist styles =="
D=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/dists/musicmusou
find "$D" -name "styles.xml" -o -name "themes.xml" 2>/dev/null | head -5
