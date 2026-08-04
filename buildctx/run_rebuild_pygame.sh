#!/bin/bash
cd /root/musicgame_build
export PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
export MAKEFLAGS=-j4
exec python3 /mnt/d/PythonFile/musicgame/buildctx/rebuild_pygame.py > /root/pygame_rebuild.log 2>&1
