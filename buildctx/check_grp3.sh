#!/bin/bash
F=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/build/other_builds/python3/arm64-v8a__ndk_target_24/python3/Modules/grpmodule.c
sed -n "255,335p" "$F"
