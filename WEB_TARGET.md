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

## Phase 8 binary sunlight

The lighting model has exactly two meaningful states: BRIGHT and DARK. `web/sunlight.mjs` scans each X/Z column downward from Y=63 and records the first opaque block. AIR allows the scan to continue. The first GRASS or ROCK block is BRIGHT; every opaque block below it is DARK.

The sunlight cache is an `Int8Array` with one entry per X/Z column, using 65,536 bytes for the complete 256 × 256 horizontal world. It stores the highest opaque Y coordinate or `-1` for an empty column.

## Relighting and mesh rebuilding

`World.setBlock` marks the edited X/Z column dirty in addition to its chunk. Boundary edits continue to invalidate neighboring chunks. `SunlightModel.rebuildDirtyColumns` rescans only changed columns, and `rebuildDirtyChunkMeshes` performs relighting before rebuilding affected chunk geometry.

The initial load runs terrain generation, cave carving, full sunlight calculation, and then chunk meshing. The binary state is written into the sixth float of every visible vertex. The fragment shader performs no voxel lookup or world-sized raycast.

## Dark cave rendering

The vertex shader passes the binary state and view-space distance. The fragment shader applies exactly one full brightness and one fixed dim brightness:

- BRIGHT: `1.00` texture brightness;
- DARK: `0.28` texture brightness.

Only DARK geometry receives black distance fog. The fog begins at 4 blocks, ends at 30 blocks, has five deliberately crude steps, and reaches 0.96 strength. BRIGHT geometry receives no aggressive cave fog. The clear color remains exactly `#7FCCFF`.

There is no smooth-light gradient between blocks, ambient occlusion, dynamic shadow, day/night cycle, torch light, colored light, or sideways light flood fill.

## Existing systems

The finite seeded terrain, sphere-worm caves, seam-aware chunk meshing, original 16 × 16 grass and rock textures, first-person collision, gravity, and jumping remain active. The complete world still uses one aggregate indexed WebGL draw call.

## Testing

Node tests verify unobstructed sunlight, AIR transmission, roof blocking, Y=63 behavior, vertically exposed cave openings, binary vertex values, BRIGHT/DARK face counts, dirty-column relighting, and mesh rebuilding order.

The Chromium smoke test loads both GitHub Pages entry points and requires Phase 8 state, the original texture metadata, exact `#7FCCFF` sky metadata, two lighting states, fixed dark brightness, dark-only stepped fog, nonzero BRIGHT and DARK geometry, no fragment world raycasts, visible geometry, one draw call, and zero WebGL errors.

## Scope boundary

Phase 8 does not add torches, colored or propagated block light, smooth lighting, dynamic shadows, ambient occlusion, day/night cycles, additional blocks, block interaction, inventory, enemies, sound, or persistence.
