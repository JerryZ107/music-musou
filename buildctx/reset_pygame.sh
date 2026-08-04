#!/bin/bash
B=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a
rm -rf "$B/build/other_builds/pygame"
rm -rf "$B/dist"
echo "PYGAME_BUILD_RESET"
