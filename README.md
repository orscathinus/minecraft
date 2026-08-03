# Cave Game Tech Test Recreation

A small, historically inspired recreation project targeting the feel and technical scope of the May 13, 2009 **Cave Game Tech Test**.

This repository is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Current status: Phase 0 specification complete

Phase 0 defines the target before game implementation begins:

- [`SPEC.md`](SPEC.md): required behavior, acceptance criteria, and explicit non-goals;
- [`ASSUMPTIONS.md`](ASSUMPTIONS.md): numbered approximation choices for undocumented details;
- [`ROADMAP.md`](ROADMAP.md): implementation phases 1 through 12 and their validation gates.

The repository still contains only the pre-Phase 0 Java bootstrap. There is **no game window, renderer, voxel world, terrain, input handling, or gameplay yet**. No Java source files were created or modified during Phase 0.

## Requirements

- JDK 21
- Gradle 9.6.1

The project currently uses an installed Gradle distribution rather than a committed Gradle Wrapper. GitHub Actions installs and pins Gradle 9.6.1 before running the build.

## Build and test

```bash
gradle clean build
```

Run tests only:

```bash
gradle test
```

Run the non-graphical bootstrap entry point:

```bash
gradle run
```

The program reports the detected desktop platform and the LWJGL native classifier that later phases will use.

## Controls

None yet. Phase 0 is documentation-only and does not create a graphical window or gameplay input.

The final target controls specified for later phases are WASD movement, Space to jump, mouse look, and repeated respawning while R is held.

## Supported desktop targets

The build currently selects LWJGL native libraries for:

- Windows x64 and ARM64;
- Linux x64 and ARM64;
- macOS x64 and ARM64.

## Non-goals

The project explicitly excludes mining, block placement, inventory, mobs, crafting, survival systems, sound, multiplayer, world saving, and modern Minecraft mechanics. See [`SPEC.md`](SPEC.md#12-non-goals) for the authoritative list.
