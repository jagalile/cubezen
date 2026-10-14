# Cubezen

Cozy blocky lofi for study and play: a 3D voxel valley with a cabin, a campfire and a river that changes with the time of day and the seasons, with generative piano, rain and fire ambience, a pomodoro timer and a task list.

**Live:** https://jagalile.github.io/cubezen/

All art and music are original. The music is composed and synthesised live in the browser with the Web Audio API, so there are no audio files and no third-party copyright. Not affiliated with Mojang or Microsoft.

## Features

- **A living valley**: a river with a dock and a rowboat, a farm plot with seasonal crops, a cabin with a smoking chimney, a campfire, trees and flowers. A cat sleeps by the fire, and now and then a rabbit, a flock of birds, a family of ducks or a deer coming down to drink passes by.
- **Day and night**: a continuous cycle, synced to your clock or fixed at day, sunset or night, with sun, moon, stars, clouds and fireflies.
- **Seasons**: picked automatically from the date or chosen by hand. Colours, particles (petals, leaves, snow) and details of the world change; in winter the river freezes.
- **Generative music**: ever-new piano pieces, each with its own mode, motif and structure, in the spirit of calm game soundtracks.
- **Ambience**: rain and fire with their own volume; the rain and the campfire in the scene follow their sliders.
- **Pomodoro**: 25-minute focus with 5 and 15-minute breaks, a chime when time is up and a count of today's sessions.
- **Tasks**: a simple list for the session.
- **Zen mode**: hides the interface and leaves only the landscape.

Preferences, tasks and stats are saved in your browser (`localStorage`); there are no accounts and no server.

### Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play or pause the music |
| `H` | Zen mode |
| `F` | Fullscreen |

## Development

No build step and nothing to install: Three.js is loaded from a CDN through an import map. The 3D world uses ES modules, so serve the folder (opening `index.html` from disk won't load it):

```sh
python3 -m http.server 8000
```

then open http://localhost:8000.

### URL parameters

Handy for previews and screenshots:

| Parameter | Effect |
| --- | --- |
| `?time=day\|sunset\|night\|clock\|cycle` | Fix the time mode |
| `?t=0.72` | A specific time in the cycle (0 = midnight, 0.5 = noon) |
| `?season=spring\|summer\|autumn\|winter` | Fix the season |
| `?fire=0.8` | Initial campfire intensity (0 to 1) |
| `?critter=rabbit\|birds\|ducks\|deer&advance=10` | Spawn a visitor and fast-forward it N seconds |
| `?shot` | Preserve the drawing buffer so the canvas can be read (screenshots) |

### Structure

- `index.html`: interface and the Three.js import map
- `css/style.css`: pixel-art UI
- `js/app.js`: mixer, pomodoro, tasks, world panel and shortcuts
- `js/composer.js`: generative composer (modes, voicings, motifs, piece structure); pure JS, no audio
- `js/audio.js`: synthesised piano and pad that perform the composer's pieces, plus rain and fire
- `js/world/main.js`: rendering, sky, day/night lighting, seasons and particles
- `js/world/build.js`: voxel world generation and meshing with ambient occlusion
- `js/world/textures.js`: procedural 16×16 px textures, repainted each season
- `js/world/props.js`: the farm's fence, scarecrow, pumpkins and hay bales, and the dock with its rowboat
- `js/world/critters.js`: the cat, the butterflies and the visitors

## Deployment

GitHub Pages serves the `main` branch straight from the repository root.
