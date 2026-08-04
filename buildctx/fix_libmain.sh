#!/bin/bash
B=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a
rm -f "$B/build/bootstrap_builds/sdl2/libs/arm64-v8a/libmain.so"
rm -f "$B/build/bootstrap_builds/sdl2/obj/local/arm64-v8a/libmain.so"
rm -rf "$B/dists"
echo "LIBMAIN_AND_DISTS_REMOVED"
