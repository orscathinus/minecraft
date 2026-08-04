# Browser target amendment

## Status

The primary public build is a browser-playable WebGL 2 application hosted by GitHub Pages. The Java/LWJGL desktop application remains a Phase 1 reference target.

## Phase 11 profiling and stabilization

The finite world remains a deterministic `16 × 16` chunk grid. Terrain, caves, and binary sunlight are prepared before play. Chunk meshing and upload remain incremental and proximity ordered.

### Hot-path allocation policy

Fixed player updates use scalar collision calculations and reusable typed arrays. The browser loop reuses projection/view matrices and mutable state snapshots. Held-R uses `respawnXYZ` without creating spawn objects. DOM metadata and the optional debug overlay update every 15 frames.

Compatibility APIs that return frozen snapshots remain available for tests and tooling, but the live update/render path does not call them.

### Frustum culling

Each GPU chunk mesh stores world-space bounds. The renderer multiplies projection and view matrices into reusable storage, extracts six normalized planes, and rejects chunks whose AABB is outside any plane. Culling occurs before `drawElements`.

Uploaded meshes are not unloaded or distance-culled, preserving the finite-world appearance. Turning toward a previously hidden region renders the already resident chunks immediately.

### Resource lifecycle

A chunk refresh creates the replacement GPU mesh, removes the previous mesh totals, disposes the previous VAO/VBO/EBO, and installs the replacement. Partial upload construction is exception-safe. Renderer shutdown disposes every chunk resource, atlas texture, and shader program. Browser shutdown removes input listeners, disconnects resize observation, and cancels animation frames.

No worker threads are used. WebGL upload and disposal occur only inside the browser rendering thread.

### Processing budgets

`ChunkProcessingConfig` provides the pacing values:

- normal: `maxChunksPerFrame = 2`, `frameInterval = 1`;
- historical: `maxChunksPerFrame = 1`, `frameInterval = 10`.

No sleep or busy wait is used. Queue entries retain deterministic squared-distance, Z, then X ordering with epoch/revision stale-work rejection.

### Diagnostics and benchmark

Runtime diagnostics include generation stages, average/peak frame time, average/maximum chunk mesh time, upload time, faces, triangles, draw calls, frustum-culled chunks, peak pending chunks, block bytes, sunlight bytes, mesh bytes, and live GPU resource counts.

`node tools/benchmark-web.mjs --json` builds the deterministic world and all 256 CPU meshes, then reports total world generation, average chunk mesh duration, total visible faces, peak pending chunks, memory, triangles, and hidden-face omission.

### Existing behavior

The exact `#7FCCFF` clear color, original nearest-filtered textures, binary cave lighting, dark-only stepped fog, first-person physics, random Y=74 spawn, held-R respawn, void behavior, and historical chunk mode remain unchanged.

## Testing

Node tests cover frustum acceptance/rejection, reusable diagnostics, exact memory accounting, all previous terrain/cave/lighting/physics/chunk behavior, and deterministic mesh counts. CI runs the benchmark command and stores its JSON output in the build workspace. Chromium validates both Pages entry points plus historical mode, nonzero visible geometry, profiling metadata, frustum culling, resource counts, and zero WebGL errors.

## Scope boundary

Phase 11 adds no gameplay, modern effects, infinite terrain, chunk unloading, workers, block interaction, inventory, enemies, sound, or persistence.
