# Browser target amendment

## Status

This document records the approved change from a desktop-only delivery plan to a browser-playable public build hosted by GitHub Pages.

Where deployment requirements conflict with the earlier desktop-only assumptions in `SPEC.md` or `ROADMAP.md`, this document governs the public browser target. The Java/LWJGL desktop application remains in the repository as a working reference target and is not removed.

## Primary public target

The primary publicly accessible build is a static browser application served by GitHub Pages.

Browser technology:

- HTML5;
- modern JavaScript modules;
- WebGL 2 for rendering;
- `requestAnimationFrame` for display-synchronized rendering;
- a fixed 60-updates-per-second simulation loop;
- no server-side runtime.

The browser build lives in `web/` and is deployed at the repository's GitHub Pages project URL.

## Relationship to the desktop target

The desktop target continues to use:

- Java 21;
- Gradle;
- LWJGL 3;
- OpenGL 3.3 Core.

The browser cannot load LWJGL native libraries or create a desktop GLFW window. Its rendering backend therefore uses WebGL 2 directly. Shared game rules and algorithms should remain platform-neutral whenever practical, while window creation, input collection, timing integration, and graphics calls remain platform-specific.

## Phase 1 browser behavior

The browser target mirrors the completed Phase 1 application foundation:

- a resizable full-page rendering surface;
- clear color `#7FCCFF`;
- rendering synchronized through `requestAnimationFrame`;
- fixed updates at 60 updates per second;
- frame-delta clamping and bounded catch-up updates;
- careful resize handling for browser zoom and high-density displays;
- WebGL version and renderer logging;
- visible startup failure reporting;
- clean animation-loop shutdown.

Pressing Escape stops the browser application. Browser security generally prevents an ordinary webpage from closing its own tab, so the page displays a stopped message and asks the user to close the tab or reload.

## Development commands

Run browser logic tests:

```bash
node --test web/test/*.test.mjs
```

Serve the browser build locally:

```bash
python3 -m http.server 8000 --directory web
```

Then open `http://localhost:8000`.

## GitHub Pages deployment

`.github/workflows/pages.yml` validates the browser modules, packages `web/`, and deploys it through GitHub Pages whenever `main` changes.

The repository must have **Settings → Pages → Source → GitHub Actions** selected. This is a one-time repository setting rather than a source-code setting.

## Scope

This amendment changes the delivery platform only. It does not add terrain, blocks, a player, camera controls, or later gameplay systems.
