# Cave Game Tech Test Recreation — Roadmap

## Roadmap rules

This roadmap implements [`SPEC.md`](SPEC.md) in twelve controlled phases after the Phase 0 documentation gate.

Every phase MUST:

1. inspect and preserve all working behavior from earlier phases;
2. implement only the scope listed for that phase;
3. add automated tests for non-graphical logic whenever practical;
4. run the full Gradle build and tests;
5. update `README.md` for new setup steps or controls;
6. stop before beginning the next phase.

Approximation values come from [`ASSUMPTIONS.md`](ASSUMPTIONS.md). Non-goals remain prohibited throughout all phases.

## Phase 1 — Window, OpenGL context, and application loop

### Goal

Replace the command-line-only bootstrap with the smallest stable graphical application shell.

### Implement

- GLFW initialization and shutdown.
- A resizable window using the A-34 approximation.
- An OpenGL **3.3 Core** context.
- GL capability creation and version validation.
- A basic application loop with event polling, buffer swapping, and clean shutdown.
- Framebuffer resize handling and viewport updates.
- Clear the framebuffer to exact sky color `#7FCCFF`.
- Safe Escape/window-close behavior from A-42.

### Do not implement

- camera movement;
- shaders beyond any minimal validation needed to clear the screen;
- blocks, world data, chunks, terrain, or collision.

### Validation gate

- The window opens and clears to `#7FCCFF`.
- Resize and shutdown are clean.
- Unsupported OpenGL versions produce a clear error.
- Existing tests still pass.

## Phase 2 — Input and free camera

### Goal

Create first-person camera orientation and temporary free movement without a voxel world.

### Implement

- Keyboard state collection for W, A, S, D, Space, R, and Escape.
- Captured mouse input.
- Yaw/pitch camera rotation using A-20.
- Perspective and view matrices using JOML.
- Temporary developer free movement for camera verification.
- Fixed-step timing foundation from A-11.

### Do not implement

- gravity, jumping, collision, respawning, or terrain;
- any player model;
- block interaction.

### Validation gate

- Mouse look is smooth and pitch remains clamped.
- WASD moves relative to camera yaw.
- Timing logic has deterministic non-graphical tests.
- Temporary free movement is clearly marked for later removal.

## Phase 3 — Shader pipeline and one textured cube

### Goal

Prove the complete OpenGL rendering path with one block-sized cube.

### Implement

- Shader compilation, linking, validation, and error reporting.
- Vertex array, vertex buffer, and index buffer ownership wrappers.
- One unit cube rendered with hidden back faces and depth testing.
- Original `16 × 16` placeholder grass and rock textures.
- Nearest-neighbor texture sampling.
- Model/view/projection transforms.
- A binary bright/dark shader input, demonstrated on the cube.

### Do not implement

- world storage, chunk meshes, terrain, caves, fog, or collision.

### Validation gate

- A textured cube renders correctly from all visible sides.
- No copyrighted assets are present.
- Shader/resource failures produce actionable errors.
- Resource cleanup is verified manually and structurally.

## Phase 4 — Finite block world data

### Goal

Implement the exact non-graphical world model before rendering a world.

### Implement

- `AIR`, `GRASS`, and `ROCK` block states only.
- Exact `256 × 64 × 256` finite storage.
- Bounds-safe read/write access.
- Outside-world behavior from A-03.
- Coordinate/index conversion utilities.
- Seed storage from A-04.
- A temporary deterministic test pattern in block data only.

### Do not implement

- chunks, terrain noise, caves, lighting, meshing, or player physics.

### Validation gate

Automated tests prove:

- exact dimensions and cell count;
- correct corner and boundary indexing;
- rejection of out-of-bounds writes;
- outside reads behave as air;
- no fourth block state exists.

## Phase 5 — Horizontal chunks and proximity scheduler

### Goal

Partition the finite world and establish nearest-first chunk work ordering.

### Implement

- Exact `16 × 16 × 64` chunk volumes or views.
- Exact `16 × 16` horizontal chunk grid.
- World-to-chunk and local-coordinate conversion.
- Dirty/generated/meshed lifecycle states.
- Proximity queue using A-35 deterministic ordering.
- Diagnostics for current chunk and queued order.

### Do not implement

- actual chunk mesh geometry;
- terrain or caves;
- collision or final rendering.

### Validation gate

Automated tests prove:

- all world cells map to exactly one chunk;
- edge coordinates map correctly;
- all 256 chunks are represented;
- nearest chunks are dequeued before farther chunks;
- tie ordering is deterministic.

## Phase 6 — Hidden-face chunk meshing

### Goal

Render voxel test data efficiently as chunk meshes.

### Implement

- Visible-face extraction for solid blocks adjacent to air/outside space.
- Omission of faces between solid neighbors, including across chunk boundaries.
- One opaque mesh per chunk using A-39.
- Mesh rebuild when a chunk is marked dirty.
- Main-thread GPU upload and resource replacement.
- Render the Phase 4 deterministic block pattern.

### Do not implement

- procedural terrain, caves, sunlight, fog, or player collision.

### Validation gate

Automated tests prove expected face counts for:

- one block;
- two adjacent blocks;
- a solid cube;
- blocks touching a chunk boundary.

Manual validation confirms no cracks or duplicated interior faces.

## Phase 7 — Player-relative chunk processing and debug traversal

### Goal

Make chunk creation/meshing visibly follow the player or debug camera in proximity order.

### Implement

- Connect current horizontal camera/player chunk to the scheduler.
- Process chunk work at A-36 granularity.
- Draw within A-37 render radius.
- Retain completed chunks under A-38.
- Temporary debug flight through the finite test world.
- Diagnostics that expose queue order and mesh completion.

### Do not implement

- final grounded player physics;
- procedural terrain or caves;
- final fog/lighting appearance.

### Validation gate

- Nearby chunks visibly or diagnostically mesh before distant chunks.
- Moving across chunk boundaries reprioritizes pending work.
- Work never addresses a chunk outside the 16 × 16 grid.
- No persistent stutter or resource leak appears during traversal.

## Phase 8 — Terrain and cave generation

### Goal

Replace the test pattern with deterministic Cave Game-style terrain and caves.

### Implement

- Surface height field using A-05.
- Base rock/air fill using A-06.
- Seeded cave tunnel carving using A-07 and A-08.
- Surface openings.
- Cave lower bound at Y `1` and protected Y `0` under A-09.
- Reproducible generation by seed.
- Regeneration of affected chunk meshes.

### Do not implement

- grass conversion;
- sunlight, final lighting, fog;
- player collision or respawn.

### Validation gate

Automated tests prove:

- surfaces remain in Y `57..63`;
- generation is deterministic for a seed;
- only valid block states are produced;
- Y `0` remains uncarved;
- cave air may occur at Y `1` and at the surface for known test seeds.

## Phase 9 — Sunlight and grass rules

### Goal

Implement the exact binary sunlight model and historically constrained grass placement.

### Implement

- Vertical top-down sunlight scan for every X/Z column.
- Sunlight passing through air and stopping at the first solid block.
- Per-visible-face bright/dark assignment using A-26.
- Brightness multipliers from A-27.
- Grass conversion order and eligibility from `SPEC.md` and A-10.
- Mesh rebuilds when generation/light classification changes.

### Do not implement

- torches, light spreading, smooth lighting, ambient occlusion, colored light, or day/night changes;
- final distance fog.

### Validation gate

Automated tests prove:

- open air columns remain skylit until blocked;
- no sunlight passes below the first solid block;
- grass exists only at Y `57..63`;
- grass is exposed and directly sunlit;
- dark cave blocks remain rock;
- visual output has only bright and dark face levels.

## Phase 10 — Grounded player physics, collision, and respawn

### Goal

Replace debug flight with the final first-person player behavior.

### Implement

- Player AABB from A-12 and eye height from A-13.
- Fixed-step movement, acceleration, friction, gravity, and jump approximations A-14 through A-18.
- Axis-separated collision against grass and rock.
- Grounded detection.
- WASD, Space, and mouse-look final behavior.
- Hold-R repeated respawning at random X/Z and Y `74` using A-22 through A-25.
- Non-lethal void behavior.
- Remove or disable temporary debug flight in normal builds.

### Do not implement

- mining, placement, damage, death, inventory, or any visible player model.

### Validation gate

Automated tests prove:

- the collider cannot pass through solid blocks;
- jumping requires grounded state;
- diagonal movement is normalized;
- respawn stays in valid X/Z bounds and sets Y exactly to `74`;
- respawn clears velocity;
- falling below Y `0` causes no death or automatic reset.

Manual validation confirms player height and camera placement feel coherent in two-block-high spaces.

## Phase 11 — Historical fog, visual integration, and performance

### Goal

Complete the required visual character without adding later-game features.

### Implement

- Heavy black distance fog for dark geometry using A-31.
- Later sky-colored fog for bright geometry using A-32.
- Exact flat sky clear color.
- Final texture and binary-light integration.
- Frustum culling if required for stable performance.
- Profiling and conservative buffer reuse.
- Verify chunk proximity processing during ordinary play.

### Do not implement

- a sky dome, sun, moon, clouds, weather, shadows, post-processing, menus, or graphics settings.

### Validation gate

- Distant dark cave geometry fades into black much sooner than outdoor terrain.
- Bright terrain fades toward `#7FCCFF` rather than black.
- The complete finite world remains stable during traversal.
- Performance is measured on the target development machine and obvious allocation/resource issues are removed.

## Phase 12 — Fidelity verification, cleanup, and packaging

### Goal

Prove compliance with the specification and produce a reproducible runnable build.

### Implement

- A requirement-by-requirement audit against `SPEC.md`.
- Deterministic test seeds and manual fidelity scenes.
- Removal of temporary debug behavior from normal execution.
- Final README controls and setup instructions.
- Gradle distribution packaging for supported desktop targets where practical.
- License/attribution review confirming all textures and code are original or properly licensed.
- Final automated test and build verification on Java 21.

### Do not implement

- any feature listed in the non-goals;
- convenience features that alter target behavior;
- work from a hypothetical Phase 13.

### Validation gate

- Every acceptance criterion in `SPEC.md` is checked and recorded.
- Full Gradle build and tests pass.
- A fresh user with JDK 21 and documented prerequisites can run the packaged prototype.
- The final build contains no mining, placement, inventory, mobs, crafting, survival systems, sound, multiplayer, or world saving.

## Completion rule

After Phase 12 passes, the recreation is complete for the declared target. Further work requires a new explicitly approved specification rather than silently expanding scope.
