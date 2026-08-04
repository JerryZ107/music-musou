#!/bin/bash
F=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/build/other_builds/python3/arm64-v8a__ndk_target_24/python3/Modules/grpmodule.c
grep -n "API 26\|__ANDROID" "$F" | head -6
echo "---- lines 1..40 ----"
sed -n "1,40p" "$F"
echo "---- lines 290..305 ----"
sed -n "290,305p" "$F"
