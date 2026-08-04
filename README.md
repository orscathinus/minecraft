# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The project supports GitHub Pages from `main` / repository root and through the GitHub Actions deployment of `web/`.

## Current status: Phase 4 finite world generation

The browser build generates and renders one deterministic finite world with these exact dimensions:

- X: `0..255`;
- Y: `0..63`;
- Z: `0..255`;
- `16 × 16` horizontal chunks;
- 256 chunks total;
- each chunk spans the complete 64-block height.

The default seed is `1337`. Add an integer query parameter to generate another world, for example `?seed=42`. The same seed always recreates the same terrain.

Terrain uses two blended low-frequency value-noise layers. Natural column heights remain within Y=57 through Y=63. ROCK fills every column from Y=0 through its surface height, the highest exposed block becomes GRASS, and everything above it remains AIR. No biome logic, trees, water, ores, sand, dirt, bedrock, structures, or decoration are present.

Generation and chunk-meshing progress are displayed on the loading screen and logged to the browser console. All 256 CPU-side chunk meshes are combined into one indexed world mesh for one WebGL draw call.

## What appears on screen

After the loading percentages complete, the application opens above the southern edge of a large primitive rolling landscape. The terrain is mostly green grass across the top with exposed gray rock down the finite outer walls. The world ends sharply at X/Z 0 and 255, so flying beyond an edge reveals the finite rectangular land mass surrounded by the light-blue `#7FCCFF` sky.

The default seed produces gentle, rough variations across the upper world layers rather than modern Minecraft mountains or biome transitions. Texture pixels remain sharp.

## Browser controls

- Click the canvas: capture the mouse.
- Mouse or arrow keys: look around.
- `W`, `A`, `S`, `D`: fly horizontally.
- `Q` / `E`: move down / up.
- Hold `Shift`: fly faster.
- `Escape`: release the mouse; press again to stop and release graphics resources.

## Browser development

Requirements: a WebGL 2 browser, Node.js 24 for tests, and Python 3 or another static server.

```bash
node --test web/test/*.test.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Phase 4 structure

- `web/world-config.mjs`: authoritative finite dimensions and surface range.
- `web/terrain-generator.mjs`: seeded low-frequency value-noise terrain.
- `web/world.mjs`: bounds-enforced chunk storage and block access.
- `web/chunk-mesher.mjs`: per-chunk hidden-face generation.
- `web/world-mesh.mjs`: aggregation of 256 chunk meshes into one indexed upload.
- `web/app.mjs`: loading progress, seed selection, camera, and rendering lifecycle.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The public Phase 4 implementation uses WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Scope boundary

Phase 4 does not add caves, collision, a player entity, gravity, jumping, block breaking, block placement, world saving, water, trees, ores, structures, or modern Minecraft biome systems.
