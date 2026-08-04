# Browser target amendment

## Status

The primary public build is a browser-playable application hosted by GitHub Pages. Where delivery requirements conflict with desktop-only assumptions in `SPEC.md` or `ROADMAP.md`, this document governs the browser target. The Java/LWJGL desktop application remains a reference target.

## Browser technology

- HTML5 and JavaScript modules;
- WebGL 2 and GLSL ES 3.00 resource shaders;
- `requestAnimationFrame` rendering;
- fixed 60-updates-per-second simulation timing;
- no server-side runtime.

The browser build lives in `web/`. A root `index.html` loads the same modules for branch-based GitHub Pages.

## Phase 4 finite world generation

The public target now generates one deterministic finite world with exact dimensions X/Z `0..255` and Y `0..63`. It contains a `16 × 16` horizontal grid of 256 chunks, each covering the full 64-block height.

`web/world-config.mjs` is the authoritative source for all world dimensions, chunk counts, the Y=57 through Y=63 natural-surface band, and the default seed. World reads outside the finite box return AIR; writes outside it are rejected; chunks outside the 16×16 grid cannot be registered.

`SeededTerrainGenerator` blends two smooth low-frequency value-noise layers. ROCK fills each column from Y=0 through its generated height. Only the highest sky-exposed solid block becomes GRASS, and blocks above remain AIR. The bottom layer is therefore completely solid. No biome selection or decorative systems participate.

The asynchronous browser path yields between batches and reports generation and meshing progress through the status overlay and console. The synchronous path supports deterministic Node tests.

## Rendering architecture

Each loaded chunk is meshed separately through `ChunkMesher`, preserving hidden-face removal across loaded chunk borders. `world-mesh.mjs` then combines all 256 CPU-side chunk meshes into one indexed mesh for a single GPU upload and one draw call. This does not change the rebuildable chunk-mesh abstraction needed by later phases.

The debug camera starts just beyond the southern world edge and looks inward. Its increased flight speed makes the 256-block-wide world practical to inspect. The projection far plane is 512 blocks.

## Seed selection

The default seed is `1337`. An integer `seed` query parameter overrides it. For example, `?seed=42` creates a different deterministic landscape while reusing `?seed=42` recreates the same one.

## Testing

Node tests verify exact bounds and chunk counts, deterministic same-seed heights, visibly different sampled heights for another seed, the permitted block set, one exposed grass cap per column, the 57–63 terrain range, a solid ROCK bottom layer, rejected out-of-bounds writes, and aggregation of all 256 chunk meshes.

The Chromium smoke test loads both Pages entry points and requires WebGL 2, Phase 4 state, one draw call, 256 chunks, the exact default-seed face count, finite-world metadata, visible geometry, and zero WebGL errors.

## Scope boundary

Phase 4 does not add caves, water, trees, ores, sand, dirt, bedrock, structures, decorations, collision, a player body, gravity, jumping, block interaction, or persistence.
