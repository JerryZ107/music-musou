#!/bin/bash
D=/root/.gradle/wrapper/dists/gradle-8.14.3-all/h9bud5ffjflfoe91ghcb596uv
mkdir -p "$D"
pkill -f 'buildozer[ ]android' 2>/dev/null
sleep 2
pkill -f 'pythonforandroid[.]toolchain' 2>/dev/null
sleep 2
rm -f "$D/gradle-8.14.3-all.zip.part" "$D/gradle-8.14.3-all.zip.lck"
if [ ! -s "$D/gradle-8.14.3-all.zip" ]; then
  echo "downloading gradle from huaweicloud ..."
  timeout 600 curl -sSL --retry 3 -o "$D/gradle-8.14.3-all.zip" --max-time 580 \
    https://mirrors.huaweicloud.com/gradle/gradle-8.14.3-all.zip || { echo FAILED; exit 1; }
fi
ls -la "$D/gradle-8.14.3-all.zip"
unzip -tq "$D/gradle-8.14.3-all.zip" >/dev/null 2>&1 && echo ZIP_OK || echo ZIP_BAD
