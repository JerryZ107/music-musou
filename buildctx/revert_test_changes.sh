#!/bin/bash
# Revert the diagnostic test changes (disabled loading screen, disabled
# hardware acceleration) so the release build matches stock p4a behavior.
set -e

DIST_JAVA=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/dists/musicmusou/src/main/java/org/kivy/android/PythonActivity.java
BOOT_JAVA=/root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/bootstraps/sdl2/build/src/main/java/org/kivy/android/PythonActivity.java
DIST_TEMPLATE=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/dists/musicmusou/templates/AndroidManifest.tmpl.xml
COMMON_TEMPLATE=/root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/bootstraps/_sdl_common/build/templates/AndroidManifest.tmpl.xml
DIST_MANIFEST=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/dists/musicmusou/src/main/AndroidManifest.xml
DIST_ROOT_MANIFEST=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/dists/musicmusou/AndroidManifest.xml

# Restore loading screen calls in PythonActivity.java (both copies).
for f in "$DIST_JAVA" "$BOOT_JAVA"; do
  sed -i '62s|.*|        this.showLoadingScreen(this.getLoadingScreen());|' "$f"
  sed -i '123s|.*|            mActivity.showLoadingScreen(getLoadingScreen());|' "$f"
done

# Restore hardware acceleration in templates and generated manifests.
for f in "$DIST_TEMPLATE" "$COMMON_TEMPLATE" "$DIST_MANIFEST" "$DIST_ROOT_MANIFEST"; do
  sed -i 's/android:hardwareAccelerated="false"/android:hardwareAccelerated="true"/' "$f"
done

echo "== verify =="
grep -n "showLoadingScreen(this.getLoadingScreen())" "$DIST_JAVA" | head -2
grep -n "hardwareAccelerated" "$DIST_TEMPLATE" "$DIST_MANIFEST"
