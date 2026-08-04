# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The project supports GitHub Pages from `main` / repository root and through the GitHub Actions deployment of `web/`.

## Current status: Phase 9 proximity-ordered chunks

The finite world remains exactly `256 × 64 × 256`, divided into a `16 × 16` grid of horizontal chunks. Each chunk is `16 × 64 × 16` blocks.

Terrain generation, cave carving, and the compact BRIGHT/DARK sunlight cache are completed deterministically before play begins. Chunk meshing and WebGL upload are no longer performed as one blocking full-world operation. A `ChunkManager` processes unfinished chunks incrementally from the animation frame and always prioritizes the chunks nearest the player's current chunk.

Priority is ordered by:

1. squared horizontal chunk distance from the player;
2. chunk Z coordinate;
3. chunk X coordinate.

The Z-then-X tie break makes equal-distance processing deterministic.

## Processing modes

### Normal mode

Normal mode is the default. It processes at most two chunks per animation frame. Input, physics, mouse look, and rendering continue between processing batches.

### Historical-loading mode

Add `?loading=historical` to the URL or press `H` while playing. Historical mode processes one chunk every ten rendered frames, intentionally making the nearest-first loading pattern visible without sleeping or blocking the render loop.

Example:

```text
https://orscathinus.github.io/minecraft/?loading=historical
```

The player's own chunk is meshed and uploaded before the first playable frame in either mode. The remaining chunks then spread outward from the player.

## Reprioritization and refreshes

The player's chunk is recalculated from the player's X/Z position every frame. Crossing a chunk boundary rebuilds the unfinished-work priority queue around the new chunk.

Queue entries carry an epoch and revision. Reprioritization clears stale queue entries, increments the epoch, and recreates only unfinished work. Already visible chunks are not uploaded again merely because the player moved.

When voxel generation or a future block edit changes the world:

1. changed sunlight columns are recalculated;
2. affected chunks and boundary neighbors are queued as explicit refreshes;
3. the old GPU mesh for each refreshed chunk is disposed;
4. the replacement mesh is uploaded on the rendering thread.

A chunk can therefore be uploaded more than once only when a refresh provides a reason.

## Optional chunk overlay

Press `F3`, or open the page with `?debugChunks=1`, to show:

- player chunk;
- chunks queued;
- chunks meshed;
- chunks visible;
- current draw calls;
- current processing mode and frame budget.

The overlay is temporary debugging UI and does not affect world generation.

## What appears on screen

After deterministic terrain, cave, and sunlight preparation, the player appears beside a cave entrance. The player's current chunk is already visible. Nearby chunks then appear before distant chunks.

In normal mode this expansion is quick. In historical mode the user can clearly watch square chunk regions arrive outward from the player. Walking into another chunk immediately reprioritizes unfinished regions around the new position.

The original `16 × 16` grass and rock textures, exact `#7FCCFF` sky, binary cave lighting, dark-only stepped distance fog, first-person collision, gravity, and jumping remain active.

## Browser controls

- Click the canvas: capture the mouse.
- Move the mouse: look around.
- `W` / `S`: move forward / backward.
- `A` / `D`: strafe.
- `Space`: jump while grounded.
- `F3`: toggle the chunk debug overlay.
- `H`: switch normal and historical loading modes.
- `Escape`: release the mouse; press again while released to stop and release graphics resources.

## Browser development

Requirements: a WebGL 2 browser, Node.js 24 for tests, and Python 3 or another static server.

```bash
node --test web/test/*.test.mjs
node tools/generate-block-textures.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Phase 9 structure

- `web/chunk-manager.mjs`: player chunk calculation, priority queue, frame budgets, reprioritization, refreshes, and statistics.
- `web/renderer.mjs`: independently replaceable GPU meshes keyed by chunk position.
- `web/app.mjs`: per-frame chunk processing, mode switching, and debug-overlay updates.
- `web/test/chunk-manager.test.mjs`: ordering, budget, refresh, duplicate-upload, and reprioritization tests.
- `web/test/browser-smoke.sh`: real Chromium validation of normal and historical modes from both Pages entry layouts.

## Existing lighting and texture systems

Each visible face carries one binary sunlight state. BRIGHT geometry uses full texture color. DARK geometry uses fixed `0.28` brightness and heavy stepped black fog from 4 to 30 blocks. The clear color remains exactly `#7FCCFF`.

The grass and rock textures are original deterministic `16 × 16` procedural pixel art. They were not copied, traced, sampled, recolored, or derived from Minecraft, Mojang, RubyDung, or another game.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The public Phase 9 implementation uses WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Scope boundary

Phase 9 does not add infinite terrain, chunk unloading, multithreaded generation, frustum culling, torches, smooth lighting, block interaction, inventory, enemies, sound, or persistence.
