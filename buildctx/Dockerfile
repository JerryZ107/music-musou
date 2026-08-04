FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

# Switch apt to the Aliyun mirror (fast in China), install the full
# python-for-android host toolchain, then install Buildozer.
RUN sed -i \
        's@//.*archive.ubuntu.com@//mirrors.aliyun.com@g; s@security.ubuntu.com@mirrors.aliyun.com@g' \
        /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential ccache cmake curl file git libffi-dev libncurses-dev \
        libssl-dev libtool openjdk-17-jdk-headless pkg-config python3 python3-dev \
        python3-pip python3-venv unzip wget zip zlib1g-dev autoconf automake \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m pip install --no-cache-dir buildozer \
    && mkdir -p /app

WORKDIR /app
