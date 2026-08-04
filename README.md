# Cave Game Tech Test Recreation

A small, historically inspired recreation project targeting the feel and technical scope of the May 13, 2009 **Cave Game Tech Test**.

This repository is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Current status: Phase 1 application foundation complete

Phase 1 provides the desktop application shell:

- a resizable `1280 × 720` GLFW window;
- an OpenGL 3.3 Core context;
- VSync enabled by default;
- the documented sky clear color `#7FCCFF`;
- a fixed 60-updates-per-second simulation clock;
- rendering that runs independently of fixed updates;
- bounded catch-up behavior after a pause or window move;
- Escape and native window-close shutdown;
- startup logging for the OpenGL version and renderer;
- clean GLFW, callback, window, and OpenGL-context cleanup.

There are still **no blocks, terrain, player, camera movement, textures, or gameplay**. See [`ROADMAP.md`](ROADMAP.md) for later phases.

The historical target and reconstruction boundaries are documented in:

- [`SPEC.md`](SPEC.md)
- [`ASSUMPTIONS.md`](ASSUMPTIONS.md)
- [`ROADMAP.md`](ROADMAP.md)

## Requirements

- A desktop computer with OpenGL 3.3 Core support
- JDK 21

The checked-in `gradlew` and `gradlew.bat` launchers pin Gradle 9.6.1. On the first invocation, the launcher downloads the official Gradle wrapper bootstrap and verifies its SHA-256 checksum before using it. Gradle then downloads and caches the pinned distribution.

## Build and test

macOS or Linux:

```bash
./gradlew build
./gradlew test
```

Windows Command Prompt or PowerShell:

```bat
gradlew.bat build
gradlew.bat test
```

## Run

macOS or Linux:

```bash
./gradlew run
```

Windows:

```bat
gradlew.bat run
```

On macOS, the Gradle application configuration automatically adds the `-XstartOnFirstThread` JVM option required by GLFW.

## What appears on screen

Running the application opens a resizable window titled **Cave Game Tech Test Recreation**. The entire client area is a flat light-blue sky color (`#7FCCFF`). There are no blocks, menus, text, crosshair, or player model yet.

Resize the window normally. The OpenGL viewport follows the framebuffer size, so resizing should not crash the application or leave an incorrectly sized rendering area.

## Controls

- `Escape`: close the application.
- Window close button: close the application.

No movement or gameplay controls are active in Phase 1.

## GitHub Pages limitation

This Phase 1 application is a native Java/LWJGL desktop program. GitHub Pages serves static web files and cannot execute this JVM/OpenGL application inside a browser.

GitHub Pages may later host a project website, documentation, screenshots, and links to downloadable desktop builds. A browser-playable edition would require a separate WebGL/WebAssembly port and is outside the current specification.

## Supported desktop targets

The build selects LWJGL native libraries for:

- Windows x64 and ARM64;
- Linux x64 and ARM64;
- macOS x64 and ARM64.

## Non-goals

The project explicitly excludes mining, block placement, inventory, mobs, crafting, survival systems, sound, multiplayer, world saving, and modern Minecraft mechanics. See [`SPEC.md`](SPEC.md#12-non-goals) for the authoritative list.
