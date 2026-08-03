# Cave Game Tech Test Recreation

A small, historically inspired recreation project targeting the feel and technical scope of the May 13, 2009 **Cave Game Tech Test**.

This repository is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Current status: pre-Phase 0 bootstrap

This phase establishes the project foundation only:

- Java 21 application structure;
- Gradle build configuration;
- LWJGL 3 core, GLFW, and OpenGL dependencies;
- JOML math dependency;
- JUnit test support;
- desktop runtime/native classification;
- automated GitHub Actions build and tests.

There is **no window, renderer, voxel world, input handling, or gameplay yet**. Those belong to later phases.

## Requirements

- JDK 21
- Gradle 9.6.1 or newer in the Gradle 9.x line

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

None. This phase intentionally creates no graphical window and accepts no gameplay input.

## Supported desktop targets

The build currently selects LWJGL native libraries for:

- Windows x64 and ARM64;
- Linux x64 and ARM64;
- macOS x64 and ARM64.

## Scope boundaries

The project does not yet implement mining, block placement, mobs, crafting, inventory, health, hunger, sound, multiplayer, saving, or modern Minecraft mechanics.
