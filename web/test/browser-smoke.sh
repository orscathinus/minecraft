#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
BASE_URL="http://127.0.0.1:${PORT}"
ROOT_DOM_OUTPUT="$(mktemp)"
WEB_DOM_OUTPUT="$(mktemp)"
HISTORICAL_DOM_OUTPUT="$(mktemp)"
SERVER_LOG="$(mktemp)"

cleanup() {
    if [[ -n "${SERVER_PID:-}" ]]; then kill "${SERVER_PID}" 2>/dev/null || true; fi
    rm -f "${ROOT_DOM_OUTPUT}" "${WEB_DOM_OUTPUT}" "${HISTORICAL_DOM_OUTPUT}" "${SERVER_LOG}"
}
trap cleanup EXIT

python3 -m http.server "${PORT}" --bind 127.0.0.1 --directory . >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!
for _ in {1..30}; do
    if curl --fail --silent "${BASE_URL}/index.html" >/dev/null; then break; fi
    sleep 0.2
done
for path in \
    index.html \
    web/index.html \
    web/chunk-manager.mjs \
    web/chunk-mesher.mjs \
    web/renderer.mjs \
    web/block-textures.mjs \
    web/atlas.mjs \
    web/pixel-texture-sampling.mjs \
    web/texture-runtime-metadata.mjs \
    web/sunlight.mjs \
    web/shaders/block.vert.glsl \
    web/shaders/block.frag.glsl; do
    curl --fail --silent "${BASE_URL}/${path}" >/dev/null
done

BROWSER=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "${candidate}" >/dev/null 2>&1; then BROWSER="${candidate}"; break; fi
done
if [[ -z "${BROWSER}" ]]; then
    echo "No supported Chromium-based browser was found." >&2
    exit 1
fi

assert_dom() {
    local pattern="$1"
    local output="$2"
    if ! grep -q "${pattern}" "${output}"; then
        echo "Missing expected DOM pattern: ${pattern}" >&2
        cat "${output}" >&2
        exit 1
    fi
}

attribute_value() {
    local name="$1"
    local output="$2"
    grep -o "data-${name}=\"[^\"]*\"" "${output}" | tail -1 | sed -E "s/data-${name}=\"([^\"]*)\"/\1/"
}

run_chromium() {
    local url="$1"
    local output="$2"
    local budget="$3"
    "${BROWSER}" \
        --headless=new \
        --no-sandbox \
        --disable-dev-shm-usage \
        --ignore-gpu-blocklist \
        --enable-webgl \
        --use-angle=swiftshader \
        --enable-unsafe-swiftshader \
        --virtual-time-budget="${budget}" \
        --dump-dom \
        "${url}" >"${output}"
}

assert_shared_state() {
    local output="$1"
    assert_dom 'Cave Game Tech Test Recreation · Phase 9' "${output}"
    assert_dom 'data-app-state="running"' "${output}"
    assert_dom 'data-webgl="2"' "${output}"
    assert_dom 'data-phase="9"' "${output}"
    assert_dom 'data-texture-phase="7"' "${output}"
    assert_dom 'data-texture-version="phase-7-original-v1"' "${output}"
    assert_dom 'data-texture-size="16"' "${output}"
    assert_dom 'data-texture-assets="original-procedural"' "${output}"
    assert_dom 'data-atlas-gutter="1"' "${output}"
    assert_dom 'data-texture-filtering="nearest"' "${output}"
    assert_dom 'data-texture-mipmaps="false"' "${output}"
    assert_dom 'data-lighting-model="binary-column-sunlight"' "${output}"
    assert_dom 'data-lighting-states="2"' "${output}"
    assert_dom 'data-bright-brightness="1.00"' "${output}"
    assert_dom 'data-dark-brightness="0.28"' "${output}"
    assert_dom 'data-dark-fog="black-stepped-distance"' "${output}"
    assert_dom 'data-dark-fog-start="4.0"' "${output}"
    assert_dom 'data-dark-fog-end="30.0"' "${output}"
    assert_dom 'data-bright-fog="none"' "${output}"
    assert_dom 'data-fragment-world-raycasts="0"' "${output}"
    assert_dom 'data-sky-color="#7FCCFF"' "${output}"
    assert_dom 'data-bright-faces="[1-9][0-9]*"' "${output}"
    assert_dom 'data-dark-faces="[1-9][0-9]*"' "${output}"
    assert_dom 'data-draw-calls="[1-9][0-9]*"' "${output}"
    assert_dom 'data-gl-errors="0"' "${output}"
    assert_dom 'data-geometry="visible"' "${output}"
    assert_dom 'data-chunk-count="256"' "${output}"
    assert_dom 'data-chunk-priority="squared-horizontal-distance"' "${output}"
    assert_dom 'data-chunk-tie-break="z-then-x"' "${output}"
    assert_dom 'data-stale-work-policy="epoch-reprioritize"' "${output}"
    assert_dom 'data-unnecessary-duplicate-uploads="0"' "${output}"
    assert_dom 'data-world-bounds="0-255,0-63,0-255"' "${output}"
    assert_dom 'data-terrain-range="57-63"' "${output}"
    assert_dom 'data-actual-terrain-range="58-62"' "${output}"
    assert_dom 'data-seed="1337"' "${output}"
    assert_dom 'data-cave-algorithm="seeded-sphere-worms"' "${output}"
    assert_dom 'data-cave-carved-blocks="4171"' "${output}"
    assert_dom 'data-cave-minimum-y="1"' "${output}"
    assert_dom 'data-cave-surface-openings="81"' "${output}"
    assert_dom 'data-cave-affected-chunks="33"' "${output}"
    assert_dom 'data-cave-bottom-solid="true"' "${output}"
    assert_dom 'data-player-width="0.60"' "${output}"
    assert_dom 'data-player-height="1.62"' "${output}"
    assert_dom 'data-player-eye-height="1.54"' "${output}"
    assert_dom 'data-player-grounded="true"' "${output}"
    assert_dom 'data-player-model="none"' "${output}"
    assert_dom 'data-controls="wasd-space-mouse-f3-h"' "${output}"

    local player_chunk first_chunk
    player_chunk="$(attribute_value player-chunk "${output}")"
    first_chunk="$(attribute_value first-visible-chunk "${output}")"
    if [[ -z "${player_chunk}" || "${player_chunk}" != "${first_chunk}" ]]; then
        echo "Nearest chunk was not made visible first: player=${player_chunk}, first=${first_chunk}" >&2
        cat "${output}" >&2
        exit 1
    fi
}

assert_normal_mode() {
    local output="$1"
    assert_dom 'data-chunk-processing-mode="normal"' "${output}"
    assert_dom 'data-chunk-max-per-frame="2"' "${output}"
    assert_dom 'data-chunk-frame-interval="1"' "${output}"
    assert_dom 'data-chunks-queued="0"' "${output}"
    assert_dom 'data-chunks-meshed="256"' "${output}"
    assert_dom 'data-chunks-visible="256"' "${output}"
    assert_dom 'data-chunk-loading-complete="true"' "${output}"
    assert_dom 'data-chunk-uploads="256"' "${output}"
    assert_dom 'data-world-faces="204158"' "${output}"
}

assert_historical_mode() {
    local output="$1"
    assert_dom 'data-chunk-processing-mode="historical"' "${output}"
    assert_dom 'data-chunk-max-per-frame="1"' "${output}"
    assert_dom 'data-chunk-frame-interval="10"' "${output}"
    assert_dom 'data-chunks-queued="[1-9][0-9]*"' "${output}"
    assert_dom 'data-chunks-meshed="[1-9][0-9]*"' "${output}"
    assert_dom 'data-chunks-visible="[1-9][0-9]*"' "${output}"
    assert_dom 'data-chunk-loading-complete="false"' "${output}"
    assert_dom 'CHUNK PROCESSING' "${output}"
    assert_dom 'Mode: historical' "${output}"
}

run_chromium "${BASE_URL}/" "${ROOT_DOM_OUTPUT}" 45000
assert_shared_state "${ROOT_DOM_OUTPUT}"
assert_normal_mode "${ROOT_DOM_OUTPUT}"

run_chromium "${BASE_URL}/web/" "${WEB_DOM_OUTPUT}" 45000
assert_shared_state "${WEB_DOM_OUTPUT}"
assert_normal_mode "${WEB_DOM_OUTPUT}"

run_chromium "${BASE_URL}/?loading=historical&debugChunks=1" "${HISTORICAL_DOM_OUTPUT}" 8000
assert_shared_state "${HISTORICAL_DOM_OUTPUT}"
assert_historical_mode "${HISTORICAL_DOM_OUTPUT}"

echo "Phase 9 normal and historical proximity chunk smoke tests passed."
