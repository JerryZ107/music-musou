#!/bin/bash
P=/root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/recipes/python3
echo "== patches =="
ls "$P/patches" 2>/dev/null
echo "== patch mentions of grp =="
grep -l -i grp "$P/patches"/* 2>/dev/null || echo "no grp patch"
echo "== recipe configure/disable flags =="
grep -nE "disable|enable|grp|min_api|minapi|API" "$P/__init__.py" | head -20
