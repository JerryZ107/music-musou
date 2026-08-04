#!/bin/bash
grep -n "android:name=\"org.kivy\|activity android" \
  /root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/dists/musicmusou/src/main/AndroidManifest.xml | head -4
cp /root/musicgame_build/bin/musicmusou-0.1.0-arm64-v8a-debug.apk /mnt/d/PythonFile/musicgame/bin/
echo COPIED
