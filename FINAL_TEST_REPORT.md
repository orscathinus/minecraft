# Final test report

## Release candidate

- Project: Cave Game Tech Test Recreation
- Phase: 12 — fidelity audit and packaging
- Primary target: GitHub Pages / WebGL 2
- Reference target: Java 21 / LWJGL 3 / OpenGL
- Finite world: `256 × 64 × 256`
- Horizontal chunks: `16 × 16`, totaling 256 chunks

## Required behavior audit

| Requirement | Verification |
|---|---|
| Exact world dimensions | `WorldConfig` assertions and world tests |
| Exact chunk dimensions | `WorldConfig` assertions and chunk tests |
| AIR, GRASS, ROCK only | block-type audit and generated-world scan |
| One texture per block on all faces | texture/UV tests and mesher audit |
| Grass only at exposed sunlit Y 57..63 | terrain, cave, and sunlight tests |
| Surface caves may reach Y=1 | deterministic cave tests |
| Y=0 remains solid | full bottom-layer cave test |
| Player height 1.62 | player configuration audit and collision tests |
| WASD, Space, mouse, Escape, R | source audit and browser smoke test |
| Held R respawns every fixed update | spawn-controller tests |
| Random X/Z with Y=74 | deterministic spawn tests |
| Void does not kill or auto-respawn | below-world physics tests |
| BRIGHT/DARK only | sunlight tests and mesh attribute tests |
| Heavy black fog on DARK geometry | shader/runtime metadata checks |
| Exact sky #7FCCFF | source and browser checks |
| Nearby chunks processed first | priority-queue and browser tests |
| No rendered player model | renderer/source audit and metadata |
| No breaking or placement | executable-source scope scan |

## Scope-expansion audit

`node tools/fidelity-audit.mjs` scans executable source and fails for prohibited systems or symbols, including:

- inventory, hotbar, crafting, recipes, furnaces;
- mobs, monsters, NPCs, health, damage, hunger, armor, lives, or death screens;
- sound, music, audio engines;
- multiplayer, networking, chat, accounts, or servers;
- world save/load or browser persistence;
- block breaking, placement, or mining controllers;
- extra block states such as dirt, water, sand, ores, bedrock, wood, trees, leaves, or lava;
- shadow maps, ambient occlusion, post-processing, bloom, normal maps, or PBR.

The audit also rejects runtime calls to `setBlock` outside deterministic terrain/cave generation and the world storage implementation.

## Automated commands

```bash
node tools/fidelity-audit.mjs
node tools/benchmark-web.mjs --json
node --test web/test/*.test.mjs
./gradlew --no-daemon clean build
./gradlew --no-daemon distZip distTar
bash web/test/browser-smoke.sh
```

## Browser acceptance scenes

The release package includes screenshots captured from the actual WebGL 2 application:

- `docs/screenshots/surface.png`
- `docs/screenshots/cave.png`
- `docs/screenshots/chunk-loading.png`
- `docs/screenshots/void.png`

The capture tool uses deterministic seeds and ordinary runtime controls. It does not substitute mock geometry or add gameplay behavior.

## Performance and resource checks retained from Phase 11

- hidden faces are omitted;
- chunks outside the camera frustum are not drawn;
- unchanged chunks are not rebuilt;
- stale queue entries cannot overwrite newer meshes;
- replaced VAOs/VBOs/EBOs are deleted;
- page exit and context loss release browser graphics resources;
- normal and historical chunk budgets remain explicit;
- block arrays, sunlight cache, mesh bytes, triangles, draw calls, frame time, upload time, and mesh time are reported.

## Clean-build standard

CI checks out the pull-request merge commit into a clean GitHub-hosted runner. It then installs Java 21 and Node 24, runs the Gradle build, browser tests, fidelity audit, benchmark, screenshot capture, package creation, and Chromium smoke tests without relying on a developer working directory.

## Result interpretation

A successful Phase 12 workflow means the final package satisfies the executable specification and contains no detected prohibited systems. Historical uncertainty remains documented in `ASSUMPTIONS.md` and `KNOWN_DEVIATIONS.md` rather than being presented as confirmed original behavior.
