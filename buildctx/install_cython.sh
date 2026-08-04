#!/bin/bash
HP=/root/musicgame_build/.buildozer/android/platform/build-arm64-v8a/build/other_builds/hostpython3/desktop/hostpython3/native-build/root/usr/local/bin/python
"$HP" -m pip install -i https://mirrors.aliyun.com/pypi/simple/ 'Cython==3.0.11' 2>&1 | tail -2
"$HP" -c "import cython; print('cython', cython.__version__)"
