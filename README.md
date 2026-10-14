# Cubezen

Cozy blocky lofi for study & play: a pixel-art campfire scene with generative piano, rain and fire ambience, a pomodoro timer and a task list.

All art and music are original. The music is generated live in the browser with the Web Audio API, so there are no audio files and no third-party copyright. Not affiliated with Mojang or Microsoft.

## Run

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Shortcuts: `Space` play/pause · `H` zen mode · `F` fullscreen.

## Structure

- `js/scene.js`: 320×180 canvas scene, scaled up with `image-rendering: pixelated`
- `js/audio.js`: generative piano, rain and campfire synthesis
- `js/app.js`: mixer, pomodoro, tasks and shortcuts (state saved in `localStorage`)
- `css/style.css`: pixel UI
