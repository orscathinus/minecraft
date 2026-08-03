# Cave Game Tech Test Recreation — Engineering Specification

## 1. Purpose and scope

This document is the authoritative engineering specification for a historically inspired recreation of the **May 13, 2009 Cave Game Tech Test**.

The target is a small first-person voxel prototype, not a recreation of later Minecraft versions. Required behavior in this document takes precedence over implementation convenience. Details not documented by the historical target are isolated in [`ASSUMPTIONS.md`](ASSUMPTIONS.md) and are explicitly labeled as approximations.

Phase 0 is documentation only. It must not add or alter Java source files.

## 2. Requirement language

- **MUST**: required for the recreation to satisfy this specification.
- **MUST NOT**: explicitly prohibited.
- **SHOULD**: preferred unless a measured technical reason requires otherwise.
- **Approximation**: a conservative reconstruction choice, recorded in `ASSUMPTIONS.md`, that may be revised without changing the documented historical target.

## 3. Coordinate and world model

### 3.1 World dimensions

The world MUST be finite and contain exactly:

- **256 blocks** along X;
- **64 blocks** along Y;
- **256 blocks** along Z.

The valid block-coordinate ranges MUST be:

- X: `0` through `255`;
- Y: `0` through `63`;
- Z: `0` through `255`.

Player coordinates MAY exist above, below, or horizontally outside the block volume. The exact coordinate convention is an approximation defined in `ASSUMPTIONS.md`.

### 3.2 Block states

Every in-world block cell MUST contain exactly one of these states:

- `AIR`
- `GRASS`
- `ROCK`

No additional block states are permitted in the target implementation.

`AIR` MUST be non-solid and non-rendered. `GRASS` and `ROCK` MUST be solid and collision-producing.

### 3.3 Horizontal chunks

The world MUST be divided horizontally into chunks that are:

- **16 blocks wide** along X;
- **16 blocks deep** along Z.

The world therefore contains exactly **16 × 16 = 256 horizontal chunks**.

Each horizontal chunk MUST cover the full 64-block world height unless a later implementation detail changes storage internally without changing observable behavior.

## 4. Terrain and caves

### 4.1 Terrain composition

Generated terrain MUST use only `AIR`, `GRASS`, and `ROCK`.

Solid terrain MUST principally consist of `ROCK`. `GRASS` MUST only replace eligible exposed surface blocks under the rules below.

### 4.2 Grass eligibility

A block MAY be `GRASS` only when all of the following are true:

1. the block is solid terrain that would otherwise be `ROCK`;
2. it lies within the upper seven block layers of the world, Y `57` through `63` inclusive;
3. the cell directly above it is `AIR`, or the block is at Y `63` and open to the sky boundary;
4. sunlight reaches the block vertically from the top of the map without passing through another solid block.

A block that fails any one of these conditions MUST be `ROCK` rather than `GRASS`.

Grass and rock MUST each use one texture on every face of that block. A grass block therefore MUST NOT have a separate dirt side or bottom texture.

### 4.3 Cave extent

Caves MAY open directly onto the terrain surface.

Cave carving MAY extend downward to the **second-lowest stone layer**, interpreted as Y `1`. Cave generation MUST NOT carve the lowest layer at Y `0`.

Caves MUST remain within the finite X/Z world bounds. The specific cave-generation algorithm and tuning are approximations defined in `ASSUMPTIONS.md`.

## 5. Player and camera

### 5.1 Representation

The game MUST use a first-person camera.

The player MUST NOT have a rendered body, hands, shadow, third-person model, or visible held item.

### 5.2 Player size

The player collision height MUST be approximately **1.62 blocks**.

The collision width, eye height, and other collider details are approximations defined in `ASSUMPTIONS.md`.

### 5.3 Movement controls

The controls MUST be:

- `W`: move forward relative to camera yaw;
- `S`: move backward relative to camera yaw;
- `A`: move left relative to camera yaw;
- `D`: move right relative to camera yaw;
- `Space`: jump when grounded;
- mouse movement: rotate camera yaw and pitch;
- hold `R`: repeatedly respawn.

There MUST be no sprinting, crouching, flying, swimming, or other player movement mode in the target behavior. A temporary developer-only flight mode MAY exist during an intermediate roadmap phase but MUST be absent or inaccessible in the final build.

### 5.4 Collision and jumping

The player MUST collide with `GRASS` and `ROCK` and pass through `AIR`.

The player MUST not move through solid terrain under ordinary movement.

Jumping MUST only begin while grounded. Movement speed, gravity, jump impulse, air control, and collision details are approximations defined in `ASSUMPTIONS.md`.

### 5.5 Block interaction

The player MUST NOT break blocks.

The player MUST NOT place blocks.

Mouse buttons and keyboard controls MUST NOT provide any block-editing behavior.

## 6. Respawning and the void

### 6.1 Respawn command

Pressing and holding `R` MUST repeatedly select a new random valid X/Z position and set the player's Y position to exactly **74**.

A valid respawn X/Z position MUST lie within the finite world footprint. The exact sampling, centering, safety checks, and repeat interval are approximations defined in `ASSUMPTIONS.md`.

Respawning MUST reset the player's vertical velocity so the player begins falling from Y `74` rather than preserving prior downward or upward momentum.

### 6.2 Void behavior

Falling below the world MUST NOT kill, damage, automatically respawn, or otherwise reset the player.

Outside the finite block volume, absent blocks MUST behave as `AIR` for collision purposes. The player MAY continue falling indefinitely until the user holds `R` or closes the program.

## 7. Lighting

### 7.1 Two-level lighting model

Lighting MUST have only two meaningful visible states:

- **bright**
- **dark**

The implementation MUST NOT introduce smooth torchlight, colored light, ambient occlusion, time-of-day lighting, dynamic shadows, or a many-level light propagation system.

### 7.2 Sunlight propagation

Sunlight MUST originate above Y `63` and travel vertically downward in each X/Z column.

Sunlight MUST pass through `AIR`.

The first solid block encountered blocks further downward sunlight in that column. Cells and visible faces that are not reached by this direct skylight MUST be treated as dark.

The exact mesh-light assignment and numeric brightness multipliers are approximations defined in `ASSUMPTIONS.md`, but the result MUST still read clearly as a binary bright/dark distinction.

## 8. Rendering and appearance

### 8.1 Graphics target

The implementation MUST use:

- Java 21;
- Gradle;
- LWJGL 3;
- OpenGL 3.3 Core;
- JOML;
- JUnit for automated non-graphical tests.

It MUST NOT use a general-purpose game engine.

### 8.2 Block textures

`GRASS` and `ROCK` MUST use original project-created placeholder textures rather than copyrighted Minecraft assets.

Each block type MUST use the same texture on all six faces. Texture filtering and texture resolution are approximations defined in `ASSUMPTIONS.md`.

### 8.3 Sky

The clear sky color MUST be exactly hexadecimal **`#7FCCFF`**, corresponding to 8-bit RGB `(127, 204, 255)` before any framebuffer color-space conversion.

The target MUST NOT add a sun, moon, clouds, stars, weather, or a day/night cycle.

### 8.4 Fog

Dark geometry MUST receive a heavy black distance-fog effect.

The fog MUST become stronger with camera distance and blend dark geometry toward black. Exact start distance, end distance, curve, and treatment of bright geometry are approximations defined in `ASSUMPTIONS.md`.

The final visual result MUST make distant cave interiors and other dark blocks disappear into black substantially sooner than bright outdoor terrain disappears into the sky.

### 8.5 Face visibility

Faces between two solid blocks SHOULD NOT be emitted into render meshes. Only faces adjacent to `AIR` or outside the world volume SHOULD be rendered.

This is an implementation requirement for a practical voxel renderer and does not change the target's visible behavior.

## 9. Chunk generation, meshing, and ordering

Chunks MUST be generated and/or meshed in proximity order around the player's current horizontal position.

The scheduling order MUST prioritize the nearest chunk before farther chunks. Equal-distance ties MAY be deterministic under an approximation defined in `ASSUMPTIONS.md`.

Distance ordering SHOULD be based on horizontal chunk distance; vertical distance is irrelevant because chunks span the complete world height.

Chunk work MUST remain bounded to the finite 16 × 16 chunk grid. Render distance, caching, and whether completed distant chunks remain resident are approximations defined in `ASSUMPTIONS.md`.

## 10. Determinism and testability

World generation SHOULD accept a seed so terrain and cave output can be reproduced in tests, even if the user interface does not expose seed selection.

Automated tests SHOULD cover non-graphical behavior whenever practical, including:

- world bounds and indexing;
- exact world and chunk dimensions;
- permitted block states;
- grass eligibility;
- cave-carving lower bound;
- sunlight-column propagation;
- chunk proximity ordering;
- collision and grounded-state logic;
- respawn coordinate constraints.

Rendering behavior that cannot be reliably unit tested MUST be checked through deterministic debug scenes or documented manual acceptance checks.

## 11. Acceptance criteria

The final recreation satisfies this specification only when all of the following are true:

1. The world contains exactly `256 × 64 × 256` addressable block cells.
2. Horizontal chunks are exactly `16 × 16`, producing a `16 × 16` chunk grid.
3. No block state other than `AIR`, `GRASS`, and `ROCK` exists.
4. Grass appears only on directly sunlit exposed terrain in Y `57..63`.
5. Grass and rock each use one original texture on every face.
6. Caves can open at the surface and may reach Y `1`, but never carve Y `0`.
7. The player is first-person, approximately 1.62 blocks tall, and has no rendered model.
8. WASD, Space, mouse look, and repeated hold-R respawning behave as specified.
9. No block breaking or placement is possible.
10. Falling below the world does not kill or automatically reset the player.
11. Lighting visibly resolves to bright or dark only, with sunlight traveling downward through air.
12. Dark distant blocks are heavily fogged toward black.
13. The sky clears to exactly `#7FCCFF`.
14. Chunk generation or meshing visibly/diagnostically prioritizes nearby chunks.
15. The automated build and test suite pass on Java 21.
16. None of the non-goals below are present.

## 12. Non-goals

The following are explicitly outside the project scope and MUST NOT be implemented:

- mining or block breaking;
- block placement;
- an inventory, hotbar, items, or equipment;
- mobs, animals, monsters, or non-player characters;
- crafting, recipes, furnaces, or resource progression;
- survival systems, including health, damage, hunger, armor, drowning, or death;
- sound effects, music, or an audio engine;
- multiplayer, networking, accounts, chat, or servers;
- world saving, loading, serialization, or persistent player state;
- modern Minecraft mechanics, content, user interface, or assets.

## 13. Change control

A required behavior in this document may be changed only through an explicit specification revision. Approximation values may be tuned in `ASSUMPTIONS.md` as implementation evidence improves, provided the required behavior and non-goals remain intact.
