#!/bin/bash
echo "=== python3.11 ==="
which python3.11 && python3.11 --version
echo "=== java/keytool/apksigner ==="
which java keytool apksigner 2>/dev/null
echo "=== android sdk env ==="
echo "ANDROID_HOME=$ANDROID_HOME"
echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
ls -d ~/Android 2>/dev/null
ls -d /opt/android* 2>/dev/null
ls -d /mnt/d/PythonFile/musicgame/.buildozer 2>/dev/null
echo "=== buildozer android sdk ==="
ls ~/.buildozer/android_sdk 2>/dev/null | head -5
