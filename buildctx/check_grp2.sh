#!/bin/bash
F=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/build/other_builds/python3/arm64-v8a__ndk_target_24/python3/Modules/grpmodule.c
echo "== head =="
sed -n "1,30p" "$F"
echo "== grp_getgrall guard area =="
grep -n "HAVE_GETGRENT\|getgrall" "$F" | head -10
