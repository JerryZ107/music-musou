#!/bin/bash
pkill -f 'buildozer[ ]android' 2>/dev/null
sleep 2
pkill -f 'pythonforandroid[.]toolchain' 2>/dev/null
sleep 2
git config --global url."https://github.com/google/skcms".insteadOf "https://skia.googlesource.com/skcms"
git config --global --get-regexp 'url\..*\.insteadof' | head
echo "GIT_MIRROR_CONFIGURED"
