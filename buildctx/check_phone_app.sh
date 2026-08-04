#!/bin/bash
adb="/mnt/d/PythonFile/musicgame/platform-tools/adb.exe"
"$adb" shell "run-as org.musou.musicmusou ls files/app/" 
"$adb" shell "run-as org.musou.musicmusou ls files/app/demo/"
"$adb" shell "run-as org.musou.musicmusou ls files/app/_python_bundle/ | head -5"
