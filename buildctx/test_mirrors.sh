#!/bin/bash
test_url() {
  local name="$1"
  local url="$2"
  local out
  out=$(timeout 25 curl -sSL -o /dev/null -w "%{http_code} %{speed_download}B/s" --max-time 22 "$url" 2>/dev/null)
  echo "$name => $out"
}

test_url "codeload-cpython"  "https://codeload.github.com/python/cpython/tar.gz/refs/tags/v3.14.2"
test_url "codeload-sdl2"     "https://codeload.github.com/libsdl-org/SDL/tar.gz/refs/tags/release-2.30.11"
test_url "ghfast-sdl2"       "https://ghfast.top/https://github.com/libsdl-org/SDL/releases/download/release-2.30.11/SDL2-2.30.11.tar.gz"
test_url "ghproxy-sdl2"      "https://gh-proxy.com/https://github.com/libsdl-org/SDL/releases/download/release-2.30.11/SDL2-2.30.11.tar.gz"
test_url "ghproxy.net-sdl2"  "https://ghproxy.net/https://github.com/libsdl-org/SDL/releases/download/release-2.30.11/SDL2-2.30.11.tar.gz"
test_url "mirror.ghproxy-sdl2" "https://mirror.ghproxy.com/https://github.com/libsdl-org/SDL/releases/download/release-2.30.11/SDL2-2.30.11.tar.gz"
test_url "huawei-openssl"    "https://mirrors.huaweicloud.com/openssl/source/openssl-3.3.1.tar.gz"
test_url "ustc-openssl"      "https://mirrors.ustc.edu.cn/openssl/source/openssl-3.3.1.tar.gz"
