#!/bin/bash
B=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/build/bootstrap_builds/sdl2
echo "== python refs in jni/Android.mk and Application.mk =="
grep -rn "python3" "$B/jni" --include="*.mk" 2>/dev/null | head -10
echo "== libs dir =="
ls -la "$B/libs/arm64-v8a/" 2>/dev/null
echo "== obj libmain artifacts =="
ls -la "$B/obj/local/arm64-v8a/libmain.so" "$B/obj/local/arm64-v8a/objs-debug/main/" 2>/dev/null | head -12
echo "== libmain.so NEEDED (stale?) =="
readelf -d "$B/libs/arm64-v8a/libmain.so" 2>/dev/null | grep NEEDED | head -12
