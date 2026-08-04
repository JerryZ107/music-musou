#!/bin/bash
cd /root/musicgame_build
rm -f /root/build_log.txt
printf 'y\n' > /root/buildozer_yes.txt
export MAKEFLAGS=-j4
export PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
exec buildozer android debug < /root/buildozer_yes.txt > /root/build_log.txt 2>&1
