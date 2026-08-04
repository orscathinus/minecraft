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

## Phase 5 first-person player

The temporary free-flying debug camera is replaced by a collision-enabled first-person player. The player body is an axis-aligned bounding box exactly `0.60` blocks wide and `1.62` blocks high. The camera sits `1.54` blocks above the player’s feet, slightly below the top of the body. Pitch is clamped to ±89 degrees.

`web/player-physics.mjs` is independent of browser input and rendering. It applies gravity, terminal velocity, grounded-only jumping, and normalized horizontal movement during fixed updates. Movement is divided into collision substeps and resolved in X, Z, then Y order. Independent horizontal resolution allows diagonal movement to slide along walls rather than stopping entirely.

Collision enumerates voxel cells overlapped by the proposed player AABB and treats GRASS and ROCK as solid. AIR is non-solid. Downward Y collision establishes the grounded state; upward Y collision cancels vertical velocity at ceilings. The implementation has no crouching, sprinting, flying, swimming, or automatic step-up.

## Browser input

`web/first-person-player.mjs` owns pointer-lock and keyboard input:

- W/S move forward and backward;
- A/D strafe;
- Space queues one grounded jump;
- mouse movement adjusts yaw and pitch only while the canvas owns pointer lock;
- Escape releases pointer lock through browser behavior, while a second Escape after release closes the application.

Pending mouse movement and held keys are cleared on blur, visibility loss, and pointer-lock changes. This prevents stale mouse deltas from causing a large camera jump after focus returns.

## Rendering architecture

The finite Phase 4 world still uses 256 CPU-side chunk meshes combined into one indexed WebGL upload and one draw call. Only the view matrix changes: it now comes from the player eye position. No first-person arms, third-person body, shadow, or player mesh is rendered.

## Testing

Node tests verify AABB overlap and contact semantics, floor collision, ceiling collision, wall collision, diagonal wall sliding, grounded-to-airborne-to-grounded transitions, and identical fixed-step movement when render timestamps are supplied at 30 FPS and 144 FPS.

The Chromium smoke test loads both Pages entry points and requires Phase 5 state, WebGL 2, visible geometry, one world draw call, 256 chunks, zero WebGL errors, the exact player dimensions, a grounded player, documented controls, and no rendered player model.

## Scope boundary

Phase 5 does not add caves, block breaking, block placement, inventory, crouching, sprinting, swimming, step-up, a player model, enemies, sound, or persistence.
