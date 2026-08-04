# Assumptions and approximations

The May 13, 2009 `Cave game tech test` executable was never publicly released. This file records reconstruction choices that are not asserted as confirmed historical implementation details. Required behavior remains governed by [`SPEC.md`](SPEC.md).

## Coordinate and storage model

- World coordinates are right-handed: +X east, +Y upward, and +Z south.
- A player's X/Z position is the collider center; Y is the collider's bottom.
- Each horizontal chunk stores one complete `16 × 64 × 16` byte block array.
- Lookups outside X/Z `0..255` or Y `0..63` return AIR; writes outside the finite world are rejected.
- The default deterministic terrain seed is `1337`. `?seed=` exists for testing and comparison.

## Terrain and caves

- Surface height uses deterministic restrained two-dimensional value noise and remains within Y `57..63`.
- Terrain initially fills every column from Y `0` through its surface with ROCK and leaves AIR above it.
- Caves use six deterministic curved sphere-worm tunnels plus a connected surface pit.
- Tunnel radii remain approximately `1.20..2.25` blocks.
- At least one path descends toward Y `1`; cave carving clamps its minimum Y to `1` and never changes Y `0`.
- After cave carving, the first solid block reached from the top of each column becomes GRASS only when it lies in Y `57..63`; all other solids remain ROCK.

## Player and camera

- Physics runs at a fixed 60 updates per second.
- The collider is `0.60` blocks wide/deep and `1.62` blocks tall.
- Eye height is `1.54` blocks.
- Walking speed is `4.3` blocks per second.
- Gravity is `20` blocks per second squared, terminal downward speed is `50`, and jump impulse is `7.5`.
- There is no sprinting, crouching, flying, swimming, or automatic step-up.
- Vertical field of view is 70 degrees; pitch is clamped short of straight up/down.
- Initial pitch is aimed downward so the random Y=74 browser spawn can see the first loaded chunk.

## Respawn and void

- X and Z are sampled independently from block coordinates `0..255` and centered at `n + 0.5`.
- Y is always exactly `74`.
- A fixed `?spawnSeed=` uses a 32-bit linear-congruential generator for deterministic tests; ordinary sessions choose one random 32-bit seed and retain its deterministic sequence.
- Holding R respawns once per fixed simulation update, with no cooldown.
- Respawn resets X/Y/Z velocity and grounded state while preserving camera orientation.
- No safe-spawn search occurs.
- Gravity and collision continue outside the world; crossing below Y=0 never causes damage, death, or automatic respawn.
- Only when a coordinate exceeds magnitude `10^12` is it rebased to the same-sign magnitude `10^9` to avoid long-term floating-point corruption. This remains outside the world and is not a respawn.

## Lighting and appearance

- Sunlight stores the highest opaque Y for each X/Z column.
- The highest solid block is BRIGHT and every covered solid block is DARK.
- BRIGHT texture brightness is `1.0`; DARK texture brightness is fixed at `0.28`.
- DARK geometry receives five-step black fog beginning at 4 blocks, ending at 30 blocks, with maximum strength `0.96`.
- BRIGHT outdoor geometry does not receive the aggressive cave fog.
- The clear color is exactly `#7FCCFF`.
- Grass and rock use original deterministic `16 × 16` textures with one material on every face.
- The atlas has replicated one-pixel gutters, nearest-neighbor filtering, clamped edges, and no mipmaps.

## Chunk scheduling and rendering

- Work priority uses squared horizontal chunk distance, then chunk Z, then chunk X.
- Normal mode processes at most two chunks each animation frame.
- Historical-loading mode processes one chunk every ten animation frames.
- All generated chunk meshes remain resident for the bounded 256-chunk session.
- Uploaded chunks outside the camera frustum are skipped for drawing but remain resident.
- No distance-culling radius hides part of the finite world.
- World generation, meshing, simulation, and WebGL upload remain deterministic and single-threaded.

## Browser and lifecycle behavior

- The complete public implementation uses WebGL 2 and GitHub Pages; the Java/LWJGL application remains a desktop reference package.
- Click requests browser pointer lock. Escape releases pointer lock; a second Escape while released stops the browser application and disposes resources.
- F3 diagnostics and H historical-loading mode are developer/presentation aids, not gameplay systems.
- URL seeds, DOM metadata, benchmark commands, and screenshot capture exist only for deterministic verification and packaging.

## Revision rule

An approximation may be tuned only when the reason is documented, affected tests are updated, and no required behavior or prohibited feature in `SPEC.md` changes.
