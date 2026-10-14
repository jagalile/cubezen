# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cubezen: a static "cozy blocky lofi" background page for studying (3D voxel valley, generative piano, rain/fire ambience, pomodoro, tasks). Deployed by GitHub Pages straight from `main` (repo root) at https://jagalile.github.io/cubezen/ — pushing to `main` is deploying. Check a deploy with `gh api repos/jagalile/cubezen/pages/builds/latest`.

**Legal constraint:** everything must stay original. Never use Minecraft music, textures, logo or mobs, and keep the "Original music & art. Not affiliated with Mojang or Microsoft." notice. Don't embed hidden/audio-only YouTube players (violates YouTube API policies).

## Running

No build step, no package manager, no tests, no linter. The world uses ES modules, so it must be served:

```sh
python3 -m http.server 8931
```

Port 8765 belongs to another of the user's projects — don't use or kill it.

Preview overrides via URL: `?time=day|sunset|night|clock|cycle`, `?t=0.72` (0 = midnight, 0.5 = noon), `?season=spring|summer|autumn|winter`, `?fire=0..1`, `?critter=rabbit|birds|ducks|deer&advance=N` (spawn a visitor and fast-forward N seconds), `?shot` (sets `preserveDrawingBuffer` so the canvas can be read with `toDataURL` for headless screenshots).

## Architecture

Two independent halves talk through globals, so the UI still works if the 3D module fails to load:

- **3D world** (`js/world/*.js`, ES modules, Three.js 0.160 via import map from jsdelivr in `index.html`). `main.js` is the entry point and exposes `window.Scene` (`setRain`, `setFire`, `setTimeMode`, `setSeason`, `state`). `app.js` falls back to a stub `Scene` if it's missing.
- **Classic scripts** (`defer`, load order matters): `composer.js` → `globalThis.Composer`, `audio.js` → `window.Ambience`, `app.js` (UI wiring, localStorage keys `cubezen.prefs`, `cubezen.stats`, `cubezen.world`, `cubezen.tasks`).

World pipeline:
- `build.js` `generateWorld()` fills a voxel grid (block ids in `B`) and exports shared layout (`ground()`, `riverX(z)`, `farm`, `dock`) that `props.js` and `critters.js` use to place things. Changing terrain/river/cabin positions means checking those consumers and the camera (`CAM_POS`/`CAM_TARGET` in `main.js`).
- `textures.js` paints a procedural 8×4 atlas of 16px tiles (indices in `T`) and repaints it per season from `SEASONS` palettes; new block faces need a tile index here plus mapping in `build.js`.
- Meshes are built from the grid with face culling and baked ambient occlusion; plants/crops are separate cross-quad meshes rebuilt on season change. Props and critters are hand-built Three.js meshes with per-season visibility.
- `main.js` drives lighting by interpolating keyframes `KEYS` over the day, renders at half resolution (`PIXEL=0.5`) with pixelated upscaling, caps at 30 fps and refreshes shadows every 0.5 s. Fire visuals follow the fire volume slider (`state.fire`, smoothed `fireLevel`).

Audio pipeline:
- `composer.js` is pure JS (no audio): `Composer.compose()` returns `{name, length, events}` for one piece (mode, progression, motif, sections).
- `audio.js` synthesises piano/pad to perform those events, plus noise-based rain and fire, through a reverb and a soft limiter. Pause works by gating `musicOut` and stopping all sources registered for the current session; gains start at 0 to avoid a noise burst on init.

## Conventions

- Commits end with the Co-Authored-By / Claude-Session trailer lines; the user is fine with pushing improvements to `main`.
- Keep the README's structure and URL-parameter sections in sync when adding files or parameters.
