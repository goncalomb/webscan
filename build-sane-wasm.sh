#!/bin/bash

set -eo pipefail
cd -- "$(dirname -- "$0")"

if [ ! -d public/sane-wasm ]; then
    git submodule update --init --recursive
    ./sane-wasm/build.sh --with-docker --clean
    mv sane-wasm/build public/sane-wasm
    cp sane-wasm/libsane.d.ts src/libsane-types.ts
    ./sane-wasm/build.sh --clean --no-build
fi
