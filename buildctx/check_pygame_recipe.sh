#!/bin/bash
P=/root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/recipes/pygame
echo "== recipe head =="
sed -n "1,90p" "$P/__init__.py"
echo "== patches =="
ls "$P/patches" 2>/dev/null
