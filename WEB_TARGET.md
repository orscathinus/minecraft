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

## Phase 10 historical spawn model

`web/spawn-controller.mjs` selects integer block coordinates X/Z `0..255`, adds `0.5` to place the player at each block center, and fixes the feet position at Y=`74`.

No terrain-height query, cave avoidance, collision search, or safe-spawn search occurs. The initial velocity is zero. The initial camera faces toward the world center and downward only to keep the random high-altitude start visually useful.

By default, the browser obtains one session-random 32-bit seed. A fixed `?spawnSeed=<integer>` query value selects a reproducible debug stream. The spawn generator is an integer 32-bit linear-congruential generator and is independent from the terrain seed.

## Held R behavior

`FirstPersonPlayer` records `KeyR` as ordinary held input. On every fixed game update it passes that state to `HistoricalSpawnController.updateHeld`.

When held, the controller:

1. chooses a new random X/Z block center;
2. calls `PlayerPhysics.respawn` with Y=74;
3. clears X/Y/Z velocity and grounded state;
4. returns before movement or gravity run for that update.

Keyboard release, window blur, page hiding, or pointer-lock release clears the held state. There is no debounce or cooldown.

## Void behavior

`World.getBlock` returns AIR outside the finite voxel bounds. Player collision therefore imposes no horizontal wall and no floor below Y=0.

`PlayerPhysics` does not clamp position to the world and does not auto-respawn after crossing Y=0. Gravity and the existing terminal falling speed continue normally. R remains available at any finite coordinate.

The chunk manager still owns only the finite 16×16 grid. Its scheduling anchor clamps an outside player's calculated chunk to the nearest finite edge chunk; this affects processing priority only and does not alter player position.

## Extreme numerical safeguard

To avoid eventual floating-point precision failure, a coordinate whose absolute magnitude exceeds `1e12` is rebased to the same-sign magnitude `1e9`.

The safeguard:

- is unreachable in ordinary play;
- does not use Y=74;
- does not increment respawn counts;
- does not return the player to the map;
- preserves velocity and continued void behavior.

There is otherwise no lower-Y clamp.

## Existing proximity processing

The world remains a finite `16 × 16` chunk grid. Each chunk covers `16 × 16` blocks horizontally and all 64 vertical layers.

A binary-heap priority queue orders unfinished work by squared horizontal distance from the player's finite-grid priority anchor. Equal distances use chunk Z and then chunk X.

- Normal mode: at most two mesh-and-upload jobs per animation frame.
- Historical mode: one job every ten frames.

All WebGL uploads remain on the rendering thread. Respawns can change the priority anchor on successive fixed updates; epoch/revision checks discard stale unfinished work without reuploading completed chunks.

## Existing lighting and assets

Chunk geometry encodes exactly two light states. BRIGHT faces use full texture color. DARK faces use fixed `0.28` brightness and heavy stepped black fog between 4 and 30 blocks. The clear color remains exactly `#7FCCFF`.

The grass and rock materials remain original deterministic `16 × 16` procedural textures with replicated atlas gutters, nearest filtering, and no mipmaps.

## Testing

Node tests verify:

- deterministic fixed-seed spawning;
- Y=74 for initial and repeated spawns;
- X/Z block-center range;
- three-axis velocity reset;
- one respawn per held fixed update and no respawn after release;
- R-style respawn from far below the map;
- continued falling below Y=0 without automatic respawn;
- horizontal departure from the finite world;
- the extreme safeguard remaining in the void.

The Chromium smoke test loads both GitHub Pages entry points with a fixed spawn seed and validates Phase 10 metadata, reproducible spawn configuration, zero automatic void respawns, no world clamps, nearest-first chunks, existing lighting/assets, visible output, and zero WebGL errors.

## Scope boundary

Phase 10 does not add health, damage, death screens, lives, checkpoints, safe-spawn searching, respawn cooldowns, infinite terrain, chunk unloading, worker-thread generation, block interaction, inventory, enemies, sound, water, lava, or persistence.
