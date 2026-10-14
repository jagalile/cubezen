# Cubezen

Cozy blocky lofi for study & play: a 3D voxel valley with a cabin and campfire, a day/night cycle and seasons, generative piano, rain and fire ambience, a pomodoro timer and a task list.

All art and music are original. The music is generated live in the browser with the Web Audio API, so there are no audio files and no third-party copyright. Not affiliated with Mojang or Microsoft.

## Run

No build step, but the 3D world uses ES modules, so serve the folder (opening `index.html` from disk won't load it):

```sh
python3 -m http.server 8000
```

Shortcuts: `Space` play/pause · `H` zen mode · `F` fullscreen.

URL overrides for previews: `?time=day|sunset|night|clock|cycle`, `?t=0.72` (0 = midnight, 0.5 = noon), `?season=spring|summer|autumn|winter`, `?critter=rabbit|birds|ducks|deer&advance=10` (spawn a visitor and fast-forward it).

## Structure

- `js/world/main.js`: Three.js renderer, sky, lighting keyframes for the day/night cycle, seasons, particles (petals, leaves, snow, rain, fireflies, smoke)
- `js/world/build.js`: voxel world generation (terrain, river, cabin, trees, plants), face-culled meshing with ambient occlusion, distant mountains
- `js/world/textures.js`: procedural 16×16 pixel textures, repainted per season
- `js/world/critters.js`: a cat asleep by the fire, butterflies, and an occasional visitor (rabbit, birds, ducks, deer)
- `js/composer.js`: generative composer (modes, voicings, motifs, piece structure); pure JS, no audio
- `js/audio.js`: synthesised piano and pad that perform the composer's pieces, plus rain and campfire
- `js/app.js`: mixer, pomodoro, tasks and shortcuts (state saved in `localStorage`)
- `css/style.css`: pixel UI
