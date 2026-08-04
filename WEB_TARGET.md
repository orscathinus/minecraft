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

## Phase 6 deterministic caves

`web/cave-generator.mjs` runs after finite terrain generation and before any chunk mesh is built. It uses six seeded, curved random walks composed of overlapping spheres. Radius remains restrained between approximately 1.20 and 2.25 blocks. Two tunnels share a pit and several begin at or break through the upper grass surface. One descending tunnel is guaranteed to approach Y=1.

Carving only changes existing GRASS or ROCK to AIR. The sphere bounds clamp their minimum Y to 1, so Y=0 remains solid. The generator adds no water, lava, ores, dungeons, ravines, aquifers, biomes, or new block types.

After carving, every column is rescanned from the sky downward. Only the first solid block may become GRASS, and only when it is within Y=57 through Y=63. All other surviving grass is converted to ROCK, preventing grass on cave walls or deep cave floors without direct vertical sunlight.

## Chunk invalidation and meshing

`World.setBlock` marks the edited chunk dirty. When an edited block lies at local X or Z coordinate 0 or 15, the corresponding loaded neighboring chunk is also marked dirty. The cave result exposes all affected chunk positions for later selective rebuilds.

The initial browser load still meshes all 256 chunks after cave carving and combines them into one indexed WebGL upload. Cross-chunk neighbor lookup suppresses duplicate internal faces while preserving faces exposed by tunnels crossing chunk boundaries.

## Player and cave presentation

The Phase 5 collision-enabled player remains exactly 0.60 blocks wide and 1.62 blocks high, with an eye height of 1.54 blocks. AIR remains passable and GRASS/ROCK remain solid, allowing the player to walk or fall into the generated caves.

At startup, the browser finds the substantial surface cave opening nearest the world center, chooses a safe grass spawn nearby, and faces the player toward the entrance. No player model is rendered.

## Testing

Node tests verify deterministic cave output, seed variation, Y=0 preservation, a selected seed reaching Y=1, valid block types, direct-sunlight grass rules, dirty-chunk propagation across a chunk boundary, and seam-aware chunk meshing.

The Chromium smoke test loads both Pages entry points and requires Phase 6 state, WebGL 2, visible cave-aware geometry, one draw call, 256 chunks, the expected default-seed cave statistics, a solid bottom layer, a grounded first-person player, and zero WebGL errors.

## Scope boundary

Phase 6 does not add modern ravines, aquifers, water, lava, ores, dungeons, biomes, block interaction, inventory, enemies, sound, or persistence.
