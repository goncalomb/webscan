#!/bin/bash

set -eo pipefail
cd -- "$(dirname -- "$0")"

# build sane-wasm
if [ ! -d public/sane-wasm ]; then
    git submodule update --init --recursive
    ./sane-wasm/build.sh --with-docker --clean
    mv sane-wasm/build public/sane-wasm
    ./sane-wasm/build.sh --clean --no-build
fi

# build app
npm run build
