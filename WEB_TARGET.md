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

## Phase 9 proximity-ordered processing

The world remains a finite `16 × 16` chunk grid. Each chunk covers `16 × 16` blocks horizontally and all 64 vertical layers.

Terrain, caves, and binary sunlight are deterministic prerequisites. Once the player spawn is known, `web/chunk-manager.mjs` creates one work record for each chunk. The player's current chunk is calculated with `floor(worldCoordinate / 16)` and clamped to the finite grid.

A binary-heap priority queue orders unfinished work by squared horizontal distance from the player's chunk. Equal distances use chunk Z and then chunk X as deterministic tie breaks.

## Frame budgets

All GPU uploads remain on the rendering thread inside the animation-frame callback.

- Normal mode: at most two chunk mesh-and-upload jobs each frame.
- Historical-loading mode: one job every ten frames.

No `sleep`, busy wait, or blocking delay is inserted. Physics, input, rendering, and pointer-lock handling continue on every frame. Historical mode merely withholds processing tokens between eligible frames.

The player's own chunk is processed synchronously before the first playable frame. Remaining chunks become visible incrementally in priority order.

## Reprioritization and stale work

Crossing a chunk boundary clears and rebuilds the unfinished queue around the new player chunk. Every queue entry contains the current scheduling epoch and chunk revision. Entries from an earlier epoch or revision are ignored.

Already visible chunks remain uploaded and are not requeued because of movement. World changes create explicit refresh records. Dirty sunlight columns are rebuilt first, followed by the affected chunk meshes and any boundary neighbors.

## Renderer ownership

`web/renderer.mjs` stores one independently disposable `GpuMesh` per chunk key. Uploading a refresh constructs the replacement mesh, disposes the prior VAO/VBO/EBO for that key, and then installs the new mesh.

The renderer draws every currently visible nonempty chunk. Draw calls therefore grow as chunks become visible rather than remaining one aggregate draw call. A chunk upload never occurs from a worker thread.

## Optional overlay and modes

`F3` toggles an optional overlay containing player chunk, queued, meshed, visible, draw calls, processing mode, and budget. The same overlay can start enabled through `?debugChunks=1`.

`H` switches processing modes. Historical mode can also be selected at startup through `?loading=historical`.

## Existing lighting and assets

Chunk meshes still encode exactly two light states. BRIGHT faces use full texture color. DARK faces use fixed `0.28` brightness and heavy stepped black fog between 4 and 30 blocks. The clear color remains exactly `#7FCCFF`.

The grass and rock materials remain original deterministic `16 × 16` procedural textures with replicated atlas gutters, nearest filtering, and no mipmaps.

## Testing

Node tests verify priority ordering, deterministic ties, finite player-chunk calculation, normal and historical budgets, unfinished-work reprioritization, dirty relighting before refresh, and prevention of reasonless duplicate uploads.

The Chromium smoke test loads both GitHub Pages entry points in normal mode and also loads historical mode with the overlay enabled. It verifies visible nearby chunks, remaining queued historical work, processing metadata, original lighting and texture metadata, responsive startup, and zero WebGL errors.

## Scope boundary

Phase 9 does not add infinite terrain, chunk unloading, worker-thread generation, frustum culling, occlusion culling, smooth lighting, block interaction, inventory, enemies, sound, or persistence.
