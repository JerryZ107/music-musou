#!/bin/bash
test_url() {
  local name="$1"
  local url="$2"
  local out
  out=$(timeout 30 curl -sSL -o /dev/null -w "%{http_code} %{speed_download}B/s" --max-time 28 "$url" 2>/dev/null)
  echo "$name => $out"
}

test_url "nju-openssl"     "https://mirror.nju.edu.cn/openssl/source/openssl-3.3.1.tar.gz"
test_url "sjtug-openssl"   "https://mirrors.sjtug.sjtu.edu.cn/openssl/source/openssl-3.3.1.tar.gz"
test_url "zju-openssl"     "https://mirrors.zju.edu.cn/openssl/source/openssl-3.3.1.tar.gz"
test_url "ftp.openssl"     "https://ftp.openssl.org/source/openssl-3.3.1.tar.gz"
test_url "huawei-openssl"  "https://mirrors.huaweicloud.com/openssl/source/openssl-3.3.1.tar.gz"

echo "-- sdl2 codeload md5 check --"
tmp=$(mktemp -d)
timeout 60 curl -sSL -o "$tmp/SDL2-2.30.11.tar.gz" --max-time 55 "https://codeload.github.com/libsdl-org/SDL/tar.gz/refs/tags/release-2.30.11"
md5sum "$tmp/SDL2-2.30.11.tar.gz"
echo "expected: bea190b480f6df249db29eb3bacfe41e"
rm -rf "$tmp"
