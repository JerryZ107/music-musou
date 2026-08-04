#!/bin/bash
TMP=/root/libmain_check
rm -rf "$TMP"
mkdir -p "$TMP"
cd "$TMP"
unzip -o -q /root/musicgame_build/bin/musicmusou-0.1.0-arm64-v8a-debug.apk lib/arm64-v8a/libmain.so
echo "== bin APK libmain.so NEEDED =="
readelf -d lib/arm64-v8a/libmain.so | grep NEEDED
