#!/bin/bash
# Disable the presplash loading screen in p4a's PythonActivity (Android 16 hwui test).
set -e

DIST=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/dists/musicmusou/src/main/java/org/kivy/android/PythonActivity.java
BOOT=/root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/bootstraps/sdl2/build/src/main/java/org/kivy/android/PythonActivity.java

for f in "$DIST" "$BOOT"; do
  sed -i '62s|.*|        // this.showLoadingScreen(this.getLoadingScreen()); // disabled: Android16 hwui test|' "$f"
  sed -i '123s|.*|            // mActivity.showLoadingScreen(getLoadingScreen()); // disabled: Android16 hwui test|' "$f"
done

echo "== remaining showLoadingScreen references in dist =="
grep -n "showLoadingScreen" "$DIST" || true
