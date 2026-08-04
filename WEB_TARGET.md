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

## Phase 3 block and chunk behavior

Phase 3 adds the first finite voxel data and chunk-meshing path to the public browser target:

- exactly three block values: AIR, GRASS, and ROCK;
- one `Uint8Array` with 16,384 entries for each `16 × 64 × 16` chunk;
- immutable integer horizontal chunk positions;
- global-to-chunk, global-to-local, and local-to-global conversions that support negative coordinates;
- bounds-safe reads that return AIR for unavailable chunks and Y coordinates outside `0..63`;
- a loaded-chunk registry for neighbor lookup;
- CPU-side `ChunkMesh` data separated from WebGL upload;
- `ChunkMesher` generation of only faces adjacent to AIR or unavailable world data;
- shared-face removal within chunks and across loaded chunk borders;
- per-vertex position, texture coordinate, and brightness data;
- one indexed draw for the deterministic test chunk.

The renderer can replace its uploaded mesh, so later block edits or chunk-neighbor changes can rebuild and re-upload a chunk without changing the WebGL abstraction.

## Deterministic test chunk

The Phase 3 browser scene is deliberately authored rather than procedurally generated. It contains a rock floor, four low perimeter walls, a doorway, a rock ridge, a two-block-wide and three-block-high empty tunnel, and six grass blocks. The resulting optimized mesh contains 1,220 visible faces and is drawn once.

## Testing

Node tests verify:

- the 16,384-entry compact storage size;
- every coordinate-to-index result and uniqueness across the full chunk;
- positive and negative global/local coordinate boundaries;
- safe missing-chunk and vertical-boundary access;
- zero geometry for AIR;
- six faces for one isolated block;
- ten faces for two adjacent blocks;
- twenty-four faces for a solid `2 × 2 × 2` arrangement;
- shared-face removal across a loaded chunk boundary;
- visible boundary faces when neighboring world data is unavailable;
- the deterministic test chunk's stable 1,220-face result.

The Chromium smoke test serves both Pages entry points, creates WebGL 2, uploads the generated chunk mesh, verifies visible pixels, and requires one chunk, one draw call, 1,220 faces, and zero WebGL errors.

## Scope boundary

Phase 3 does not add procedural terrain, caves, collision, a player entity, gravity, block breaking, block placement, chunk scheduling, or world persistence.
