# Brick by Brick

A complete, buildless p5.js learning website for young creators. 26 chapters build from drawing a first circle to a playable brick breaker game.

**Live site:** [rockbeta.github.io/p5brick](https://rockbeta.github.io/p5brick/)

**Repository:** [rockbeta/p5brick](https://github.com/rockbeta/p5brick)

Each chapter has a 60-second canvas animation, prerecorded English narration, captions, an editable JavaScript sketch, an isolated live p5.js preview, and three exercises with hints and running-sketch checks. Progress and drafts are stored in the current browser. Lessons are freely navigable and have distinct hash URLs.

## Run locally

Run `python3 -m http.server 4173 --directory dist` from this directory and visit `http://localhost:4173`.

No build, API keys, or server database is required to serve the site. Verification dependencies are needed only for development and CI. p5.js 1.11.11 is vendored in `dist/vendor/p5.min.js` with its license header. Fonts optionally load from Google Fonts; system fallbacks are provided.

## GitHub Pages deployment

GitHub Pages is configured to use **GitHub Actions**. Every push to `main` runs the JavaScript checks and curriculum verification suite, then publishes the contents of `dist/`. Browser script and CSS URLs include the release's commit SHA, and audio filenames include content hashes, so browsers fetch matching versions. You can also run **Deploy to GitHub Pages** manually from the repository's Actions tab.

The site uses relative asset paths and hash-based chapter links, so it works at the `/p5brick/` project URL without a build-time base-path setting. The published site is public and does not require ChatGPT or GitHub sign-in. Drafts and progress stay in the current browser; they are not synced between devices or shared with the repository.

Run `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm run check` and `pnpm test` to verify changes locally. The narration checks read the checked-in recordings and do not generate speech or download a model. Deployment details follow the official [GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Edit the course

- `dist/course.js`: all lesson copy, six 10-second narration segments per lesson, starter sketches, and 78 exercise definitions. Exercise test expressions inspect actual values and recorded p5 drawing calls inside the sandbox.
- `dist/app.js`: course navigation, syntax highlighting, sandbox runner, exercise feedback, local progress, and narrated concept diagrams.
- `dist/styles.css`: responsive layout, design system, and keyboard focus styles.
- `dist/narration.js` and `dist/audio/narration/`: generated recording metadata and 156 small MP3 recordings.
- `tools/generate-narration.mjs`: offline narration generator. After editing lesson scripts, run `pnpm narrate` to regenerate changed recordings.

The narration is **prerecorded**, with one shared script for every learner. Captions use those exact scripts. The browser preloads only the current lesson's six small MP3 files while the learner reads, then plays them through Web Audio at their natural pitch and speed. Playback does not load a speech model, start a speech worker, or generate audio on the learner's device.

Recordings are mono, 24 kHz, 64 kbps MP3s. They are generated offline with **kokoro-js 1.2.1**, the English **Kokoro-82M v1.0** quantized `q8` model, and the **Heart (`af_heart`)** voice. These names are development details and do not appear in the learner interface. The development model and its licenses/checksums are in `tools/models/kokoro/`; those files are outside the published site.

To regenerate recordings, install the pinned development dependencies and ensure `ffmpeg` is on your PATH, then run `pnpm narrate`. The generator uses the local model, validates non-silent samples, and reuses recordings when their source script and voice settings match. Generated MP3 files and their metadata are committed together. `pnpm test` verifies every recording's source fingerprint, content hash, MPEG frames, duration, and matching caption, so a script edit cannot silently ship with stale audio.

Playback supports replay, pause, restart, seeking, and mute. The current lesson's downloaded and decoded recordings are cached for smooth transitions and replay. Slow network requests show the brick-breaker warm-up after 200 ms, with a **Continue with captions** option; failed loads can be retried. No model preparation is needed. Longer sentences finish naturally, so an explainer can run slightly beyond one minute rather than cutting off or speeding up a voice.

On a first visit, learners can enter a first name or nickname for the on-page practice greeting. Spoken narration and captions are shared and do not include the learner's name. The name stays in browser-local progress and can be changed with the name button. Choosing **Maybe later** continues without a name and dismisses the first-visit prompt. Names are never sent to an audio service.

## Learner controls

Use Run code or Cmd/Ctrl+Enter. Tab inserts two spaces in the editor. Click the preview before using keyboard controls. The last eight chapters progressively add collisions, bricks, score, lives, states, particles, and levels. Click to launch the final game and move your mouse or touch to steer.

Exercise feedback checks explicit chapter goals. It is formative feedback, not a general-purpose proof that arbitrary code is correct. A previously completed exercise remains complete when experimenting with another solution. A chapter completes when all three exercises have been passed. Download sketch exports the current code for use in the [p5.js editor](https://editor.p5js.org/).

The local sketch runner is isolated in an iframe with `sandbox="allow-scripts"`; it cannot read the site's storage. Arbitrary JavaScript loops can still occupy the browser thread; reload the page if an experimental infinite loop freezes a preview. Keep loop counts small while learning.

## Reference

API behavior follows the official [p5.js reference](https://p5js.org/reference/) and [getting started tutorial](https://p5js.org/tutorials/get-started/).
