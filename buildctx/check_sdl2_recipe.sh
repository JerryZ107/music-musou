#!/bin/bash
R=/root/musicgame_build/.buildozer/android/platform/python-for-android/pythonforandroid/recipes/sdl2/__init__.py
sed -n "1,200p" "$R"
