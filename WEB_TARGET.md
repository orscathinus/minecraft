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

## Phase 2 rendering behavior

Phase 2 adds the first reusable voxel rendering path:

- 70-degree perspective projection updated from canvas aspect ratio;
- temporary mouse, arrow-key, and free-movement debug camera;
- indexed cube geometry with counter-clockwise winding;
- depth testing and back-face culling;
- interleaved position, texture-coordinate, and brightness attributes;
- original generated `32 × 16` atlas with grass and rock `16 × 16` tiles;
- nearest-neighbor texture filtering;
- explicit VAO, VBO, EBO, texture, shader, and program disposal.

Both cubes are combined into one aggregate mesh and rendered with one draw call. The renderer accepts reusable mesh data intended for later chunk meshes rather than issuing one draw call per block.

## Testing

Node tests verify atlas bounds, half-texel inset coordinates, distinct opaque atlas pixels, vertex/index counts, valid indices, outward winding on all six faces, multi-cube aggregation, perspective resizing behavior, and view-matrix behavior.

The Chromium smoke test serves both Pages entry points, loads shader resources, creates WebGL 2, uploads the atlas and indexed mesh, performs one draw call, checks for WebGL errors, and verifies that geometry changes pixels away from the sky clear color.

## Scope boundary

Phase 2 does not add terrain, collision, caves, chunks, world generation, block interaction, or a player entity.
