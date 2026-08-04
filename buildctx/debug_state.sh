#!/bin/bash
B=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a
echo "== python3 build dir =="
ls "$B/build/other_builds/python3/arm64-v8a__ndk_target_24/" 2>/dev/null | head
ls "$B/build/other_builds/python3/arm64-v8a__ndk_target_24/python3" 2>/dev/null | head -8
echo "== hostpython3 build dir =="
ls "$B/build/other_builds/hostpython3/desktop/" 2>/dev/null | head
echo "== log order check (lines 5100-5170 first python3.14 ref) =="
tr '\r' '\n' < /root/build_log.txt | grep -v stty | sed -n '5095,5175p' | grep -nE 'Unpacking|make|install|cp |mv |python3\.1|Configure|running' | head -20
