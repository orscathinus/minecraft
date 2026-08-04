# Known deviations from the May 13, 2009 Cave Game Tech Test

The original `Cave game tech test` build was never publicly released. This project is therefore a historically constrained recreation, not a byte-for-byte restoration. The following deviations are intentional, documented, and limited to areas where the surviving evidence is incomplete or where a web delivery target requires a different implementation.

## Platform and delivery

- The public build uses HTML, JavaScript modules, WebGL 2, and GitHub Pages. The historical build used desktop Java/LWJGL/OpenGL.
- The Java 21/LWJGL desktop project in this repository remains a small reference target; the complete playable implementation is the browser target.
- Browser pointer-lock and Escape behavior are modern platform necessities rather than documented historical behavior.

## World generation

- The exact historical terrain and cave algorithms are unavailable. This project uses deterministic restrained value-noise terrain and seeded sphere-worm tunnels.
- Cave density, tunnel radius, tunnel curvature, and entrance placement are approximations.
- The default seed `1337` is a reproducibility choice, not a historical seed.
- Grass is recalculated after cave carving using the required direct vertical sunlight and Y `57..63` rules. The exact historical update order is unknown.

## Player simulation

- The documented player height is preserved at `1.62`, but width `0.60`, eye height `1.54`, walking speed, gravity, jump impulse, collision stepping, and mouse sensitivity are approximations.
- The initial camera points downward toward the spawn chunk so the browser build presents visible terrain immediately from Y `74`.
- Respawn X/Z values are sampled as centers of blocks `0..255`; the exact historical coordinate centering and random generator are unknown.
- A fixed `?spawnSeed=` debug option exists only for deterministic testing.
- The extreme-coordinate rebase at magnitudes above `10^12` is a technical floating-point safeguard that remains in the void and never acts as death or respawn.

## Rendering

- The original textures are not redistributed. Grass and rock use original deterministic 16×16 project-created textures.
- Texture-atlas gutters, nearest-neighbor sampling, and disabled mipmaps are implementation safeguards for crisp browser rendering.
- The exact historical brightness multipliers and fog curve are unknown. The recreation uses full BRIGHT texture color, fixed `0.28` DARK brightness, and five-step black fog from 4 to 30 blocks.
- Chunk frustum culling and retained GPU meshes are performance implementation details. They do not change the finite world or the proximity order in which unfinished chunks are processed.
- Normal mode intentionally completes work as quickly as practical. The optional historical-loading mode makes the documented slow nearby-first loading visible without forcing every normal launch to take about 20 seconds.

## Diagnostics and packaging

- F3 diagnostics, URL query parameters, automated browser metadata, benchmark commands, screenshots, and Gradle distributions are development and packaging aids. They do not add gameplay.
- No claim is made that measured timing on a modern browser or CI runner matches 2009 hardware.
