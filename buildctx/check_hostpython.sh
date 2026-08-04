#!/bin/bash
echo "== hostpython3 recipe =="
grep -nE "version|get_python|depends" /root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/recipes/hostpython3/__init__.py | head -15
echo "== python3 recipe version logic =="
grep -nE "version|versioned_url" /root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/recipes/python3/__init__.py | head -10
