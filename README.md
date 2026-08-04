# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The project supports GitHub Pages from `main` / repository root and through the GitHub Actions deployment of `web/`.

## Current status: Phase 3 block and chunk system

The browser build now renders a deterministic `16 × 64 × 16` chunk backed by compact voxel data:

- `BlockType` contains only `AIR`, `GRASS`, and `ROCK`;
- each chunk uses one 16,384-byte `Uint8Array` rather than one object per block;
- world and local coordinates convert correctly across positive and negative chunk boundaries;
- missing chunks and out-of-height reads safely return AIR;
- AIR is transparent, while GRASS and ROCK are opaque;
- `ChunkMesher` emits only faces adjacent to AIR or unavailable world data;
- shared internal faces are removed, including faces across loaded chunk boundaries;
- all visible faces in the test chunk are combined into one rebuildable `ChunkMesh`;
- the renderer uploads and draws the chunk mesh once rather than drawing each block separately;
- every emitted vertex retains position, texture-coordinate, and brightness attributes.

There is still **no procedural terrain, caves, collision, player physics, breaking, or placement**.

## What appears on screen

The application opens against the light-blue `#7FCCFF` sky and displays one deterministic test chunk. The chunk contains:

- a rock floor;
- low rock perimeter walls;
- a doorway in the near wall;
- a solid rock ridge;
- a two-block-wide, three-block-high empty tunnel through the ridge;
- six grass blocks placed around the room.

The debug camera starts outside and above the doorway, looking into the chunk. Internal faces between neighboring solid blocks are absent, but all visible exterior and tunnel surfaces render with sharp grass or rock textures.

## Browser controls

- Click the canvas: capture the mouse.
- Mouse or arrow keys: rotate the debug camera.
- `W`, `A`, `S`, `D`: move.
- `Q` / `E`: move down / up.
- Hold `Shift`: move faster.
- `Escape`: release the mouse; press again to stop and release graphics resources.

## Browser development

Requirements: a WebGL 2 browser, Node.js 24 for tests, and Python 3 or another static server.

```bash
node --test web/test/*.test.mjs
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Phase 3 structure

- `web/block-type.mjs`: AIR, GRASS, and ROCK definitions.
- `web/chunk-position.mjs`: immutable integer horizontal chunk coordinates.
- `web/chunk.mjs`: compact `16 × 64 × 16` storage and index formula.
- `web/world-coordinates.mjs`: global, chunk, and local coordinate conversions.
- `web/world.mjs`: loaded-chunk registry and bounds-safe global lookup.
- `web/chunk-mesh.mjs`: CPU-side rebuildable mesh data.
- `web/chunk-mesher.mjs`: hidden-face removal and indexed mesh generation.
- `web/test-chunk.mjs`: deterministic Phase 3 room and tunnel.
- `web/renderer.mjs`: WebGL upload, one chunk draw, and GPU disposal.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The public Phase 3 implementation uses WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Project documents

- [`SPEC.md`](SPEC.md)
- [`ASSUMPTIONS.md`](ASSUMPTIONS.md)
- [`ROADMAP.md`](ROADMAP.md)
- [`WEB_TARGET.md`](WEB_TARGET.md)

## Non-goals

Mining, placement, inventory, mobs, crafting, survival systems, sound, multiplayer, and world saving remain explicitly excluded.
