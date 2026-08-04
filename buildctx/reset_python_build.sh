#!/bin/bash
B=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a
rm -rf "$B/build/other_builds/python3"
rm -rf "$B/build/other_builds/hostpython3"
rm -rf "$B/dist"
echo "PYTHON_BUILD_RESET"
