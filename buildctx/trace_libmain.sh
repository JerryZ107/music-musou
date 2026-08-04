#!/bin/bash
B=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a
echo "== should_build libdir (build/libs) =="
ls -la "$B/build/libs/arm64-v8a/" 2>/dev/null | head -12
echo "== bootstrap libs =="
ls -la "$B/build/bootstrap_builds/sdl2/libs/arm64-v8a/libmain.so" 2>/dev/null || echo "bootstrap libmain MISSING"
echo "== find all libmain.so in build tree =="
find "$B/build" -name 'libmain.so' 2>/dev/null
echo "== python3 build dir (which version installed) =="
ls "$B/build/other_builds/python3/arm64-v8a__ndk_target_24/python3/android-build/android-root/lib/" 2>/dev/null | grep -E 'python3' | head -5
