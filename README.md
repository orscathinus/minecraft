# Cave Game Tech Test Recreation

A small, historically inspired recreation targeting the technical scope of the May 13, 2009 **Cave Game Tech Test**.

This is an independent educational recreation. It is not affiliated with Mojang or Microsoft, and it does not include copyrighted Minecraft textures, sounds, source code, or other assets.

## Play in a browser

The primary public build is designed for GitHub Pages:

**https://orscathinus.github.io/minecraft/**

The repository owner must enable the deployment source once under:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

After that setting is enabled, every relevant push to `main` automatically validates and deploys the browser build from `web/`.

## Current status: browser-enabled Phase 1 foundation

The browser build currently provides:

- a full-window WebGL 2 canvas;
- the documented sky clear color `#7FCCFF`;
- display-synchronized rendering through `requestAnimationFrame`;
- fixed simulation updates at 60 updates per second;
- bounded catch-up behavior after pauses or inactive tabs;
- browser zoom, resize, and high-density-display handling;
- WebGL version and renderer logging;
- visible startup error reporting.

There are still **no blocks, terrain, player, camera movement, textures, or gameplay**. The current visible result is a flat light-blue screen.

Pressing `Escape` stops the browser application. Webpages are normally not permitted to close their own tabs, so close the tab or reload the page afterward.

## Browser development

Requirements:

- a current browser with WebGL 2 enabled;
- Node.js 24 for automated browser-logic tests;
- Python 3 or another static HTTP server for local preview.

Run the browser tests:

```bash
node --test web/test/*.test.mjs
```

Serve the browser build locally:

```bash
python3 -m http.server 8000 --directory web
```

Then open `http://localhost:8000`.

The browser architecture and its relationship to the desktop build are documented in [`WEB_TARGET.md`](WEB_TARGET.md).

## Desktop reference build

The existing Java/LWJGL desktop target remains available as a working reference implementation of Phase 1.

Requirements:

- a desktop computer with OpenGL 3.3 Core support;
- JDK 21.

Build and test on macOS or Linux:

```bash
./gradlew build
./gradlew test
```

Run the desktop target:

```bash
./gradlew run
```

Windows equivalents:

```bat
gradlew.bat build
gradlew.bat test
gradlew.bat run
```

The checked-in Gradle launchers pin Gradle 9.6.1. The first invocation downloads the official wrapper bootstrap, verifies its SHA-256 checksum, and then downloads the pinned Gradle distribution.

## Project documents

- [`SPEC.md`](SPEC.md): historical target behavior and non-goals.
- [`ASSUMPTIONS.md`](ASSUMPTIONS.md): conservative approximation choices.
- [`ROADMAP.md`](ROADMAP.md): implementation phases 1 through 12.
- [`WEB_TARGET.md`](WEB_TARGET.md): browser delivery amendment.

## Supported targets

Browser target:

- current desktop browsers with WebGL 2;
- current mobile browsers where WebGL 2 and sufficient resources are available.

Desktop reference target:

- Windows x64 and ARM64;
- Linux x64 and ARM64;
- macOS x64 and ARM64.

## Non-goals

The project explicitly excludes mining, block placement, inventory, mobs, crafting, survival systems, sound, multiplayer, world saving, and modern Minecraft mechanics. See [`SPEC.md`](SPEC.md#12-non-goals) for the authoritative list.
