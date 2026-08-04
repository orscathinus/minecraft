# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

**https://orscathinus.github.io/minecraft/**

The public implementation uses WebGL 2 and runs from GitHub Pages with no server-side runtime.

## Current status: Phase 11 profiling and stabilization

Phase 11 keeps the complete Phase 10 feature set and corrects performance and resource-management problems without adding gameplay. The deterministic `256 × 64 × 256` world, caves, BRIGHT/DARK lighting, original textures, proximity loading, random Y=74 spawning, held-R respawning, and unrestricted void behavior remain unchanged.

### Runtime stabilization

- Player collision and movement use reusable typed arrays and scalar collision bounds instead of allocating AABBs and result objects every fixed update.
- Projection and view matrices are reused.
- Held-R respawning uses a no-allocation fixed-update path.
- Chunk, player, renderer, spawn, and diagnostics snapshots are written into caller-owned reusable objects.
- DOM diagnostics are refreshed every 15 frames rather than rebuilt every frame.
- Unchanged chunks remain resident and are never rebuilt merely because the player moves.
- Chunk queue epoch and revision checks continue preventing stale work from replacing a newer mesh.

### Frustum culling

Every uploaded chunk retains an AABB covering its `16 × 64 × 16` block region. Six camera-frustum planes are calculated once per rendered frame. Chunks entirely outside the camera view remain uploaded but issue no draw call and contribute no rendered triangles until the camera turns back toward them.

No distance culling is used, so the complete finite-world appearance is preserved.

### Resource ownership

Each visible chunk owns one VAO, one vertex buffer, and one index buffer. Refresh upload follows a replace-then-dispose policy, and partial GPU construction failures dispose every resource that was successfully created. Page exit, application close, and WebGL context loss release chunk meshes, the atlas texture, shader program, listeners, observers, and scheduled animation frames.

The browser target uses no worker thread. World generation, deterministic mesh construction, GPU upload, simulation, and rendering remain single-threaded; all WebGL calls occur on the rendering thread.

## Processing modes

Configuration is retained in `ChunkProcessingConfig`:

- **Normal:** at most 2 chunk mesh/upload jobs every rendered frame.
- **Historical:** 1 chunk job every 10 rendered frames.

Historical mode remains available with `?loading=historical` or the `H` key. It uses frame budgets rather than `sleep`, so input and rendering remain responsive.

## Diagnostics

Press `F3`, or use `?debugChunks=1`, to show:

- player chunk and position;
- queued and visible chunks;
- drawn and frustum-culled chunks;
- rendered triangles;
- average and peak frame time;
- average chunk-mesh time;
- current GPU mesh memory;
- processing mode and respawn count.

The browser also records generation, cave, sunlight, mesh, upload, frame, triangle, draw-call, pending-work, and memory counters as document data attributes for automated validation.

## Benchmark command

Run the deterministic diagnostic benchmark with Node.js 24:

```bash
node tools/benchmark-web.mjs
node tools/benchmark-web.mjs --json
node tools/benchmark-web.mjs --seed 42 --json
```

It records:

- total world-generation duration;
- terrain, cave, and sunlight durations;
- average and maximum chunk-mesh duration;
- total visible faces and triangles;
- peak pending chunks;
- exact block-array and sunlight-cache bytes;
- generated chunk-mesh bytes;
- whether hidden faces were omitted.

Timing values depend on the machine, while deterministic counts remain stable for a fixed seed.

## What appears on screen

After terrain, caves, and sunlight are prepared, the player appears above a random X/Z block with feet at exactly Y=74. The spawn chunk is visible first, nearby chunks continue loading in proximity order, and the player falls toward the terrain.

The scene looks the same as Phase 10, but turning the camera no longer renders chunks that are completely behind or outside the view. In normal mode the playable view appears quickly and surrounding chunks fill in without freezing controls. Historical mode still makes the nearest-first square expansion clearly visible.

The exact `#7FCCFF` sky, crisp original `16 × 16` grass and rock textures, bright surface, dim fogged caves, collision, jumping, held-R teleports, and continuing void fall all remain active. No modern visual effects were added.

## Controls

- Click: capture the mouse.
- Mouse: look around.
- `W` / `S`: move forward / backward.
- `A` / `D`: strafe.
- `Space`: jump while grounded.
- Hold `R`: respawn every fixed game update.
- `F3`: toggle diagnostics.
- `H`: switch normal and historical chunk loading.
- `Escape`: release the mouse; press again while released to stop and release resources.

## Original texture ownership

The `16 × 16` grass and rock textures were designed from scratch for this repository as deterministic procedural pixel art. They were not copied, sampled, traced, recolored, or derived from Minecraft, Mojang, RubyDung, or another game.

`web/block-textures.mjs` is the authoritative pixel source. The atlas uses replicated one-pixel gutters, `NEAREST` filtering, `CLAMP_TO_EDGE`, and no mipmaps.

## Browser development

```bash
node --test web/test/*.test.mjs
node tools/benchmark-web.mjs --json
python3 -m http.server 8000
```

Open `http://localhost:8000/` or `http://localhost:8000/web/`.

## Phase 11 structure

- `web/performance-diagnostics.mjs`: bounded frame history and reusable runtime diagnostics.
- `web/benchmark.mjs`: deterministic world and mesh benchmark core.
- `tools/benchmark-web.mjs`: human-readable or JSON diagnostics command.
- `web/renderer.mjs`: frustum culling, cached counters, upload timings, and leak-safe GPU ownership.
- `web/chunk-manager.mjs`: mesh timings, peak pending work, explicit budgets, and no-result hot path.
- `web/player-physics.mjs`: scalar allocation-free fixed-update movement and reusable view matrix.
- `web/first-person-player.mjs`: reusable input state and snapshots.
- `web/test/performance-diagnostics.test.mjs`: diagnostics-memory and frustum tests.
- `web/test/browser-smoke.sh`: real Chromium validation for both GitHub Pages layouts and historical mode.

## Desktop reference build

The Java/LWJGL desktop target remains a Phase 1 reference shell. The complete public implementation uses WebGL 2 because GitHub Pages cannot execute native LWJGL code.

```bash
./gradlew build
./gradlew test
./gradlew run
```

## Scope boundary

Phase 11 does not add health, damage, death screens, lives, checkpoints, safe-spawn searching, cooldowns, infinite terrain, chunk unloading, new blocks, block interaction, inventory, enemies, sound, water, lava, modern lighting, shadows, or persistence.
