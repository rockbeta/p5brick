# Brick by Brick

A complete, buildless p5.js learning website for young creators. 26 chapters build from drawing a first circle to a playable brick breaker game.

**Live site:** [rockbeta.github.io/p5brick](https://rockbeta.github.io/p5brick/)

**Repository:** [rockbeta/p5brick](https://github.com/rockbeta/p5brick)

Each chapter has a 60-second canvas animation, browser-synthesized English narration, captions, an editable JavaScript sketch, an isolated live p5.js preview, and three exercises with hints and running-sketch checks. Progress and drafts are stored in the current browser. Lessons are freely navigable and have distinct hash URLs.

## Run locally

Run `python3 -m http.server 4173 --directory dist` from this directory and visit `http://localhost:4173`.

No build, API keys, or server database is required to serve the site. Verification dependencies are needed only for development and CI. p5.js 1.11.11 is vendored in `dist/vendor/p5.min.js` with its license header. Fonts optionally load from Google Fonts; system fallbacks are provided.

## GitHub Pages deployment

GitHub Pages is configured to use **GitHub Actions**. Every push to `main` runs the JavaScript checks and curriculum verification suite, then publishes the contents of `dist/`. Browser asset URLs include the release's commit SHA so browsers fetch matching JavaScript, CSS, and narration worker versions. You can also run **Deploy to GitHub Pages** manually from the repository's Actions tab.

The site uses relative asset paths and hash-based chapter links, so it works at the `/p5brick/` project URL without a build-time base-path setting. The published site is public and does not require ChatGPT or GitHub sign-in. Drafts and progress stay in the current browser; they are not synced between devices or shared with the repository.

Run `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm run check` and `pnpm test` to verify changes locally. The real voice smoke test reads the checked-in model files and does not download another model. Deployment details follow the official [GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Edit the course

- `dist/course.js`: all lesson copy, six 10-second narration segments per lesson, starter sketches, and 78 exercise definitions. Exercise test expressions inspect actual values and recorded p5 drawing calls inside the sandbox.
- `dist/app.js`: course navigation, syntax highlighting, sandbox runner, exercise feedback, local progress, and narrated concept diagrams.
- `dist/styles.css`: responsive layout, design system, and keyboard focus styles.

The explanations use **kokoro-js 1.2.1**, the latest official stable JavaScript package checked for this implementation, with the current official stable English model **Kokoro-82M v1.0**, the quantized `q8` model, and the **Heart (`af_heart`)** voice. The v1.1 model is Chinese-specific, rather than a newer English release. Package and model versions are separate.

Speech is generated at 24 kHz in a Web Worker. The model, voice, JavaScript, and exactly matching ONNX WebAssembly runtime are hosted with the site. The first voice load is approximately **120 MB**; the browser caches it for subsequent visits. No OS speech service, cloud speech API, or server is required. Names and narration stay on the learner's device. Model provenance and SHA-256 checksums are in `dist/models/kokoro/manifest.json`; third-party licenses are included with the assets.

Playback supports repeated replay, pause, restart, seeking, and mute. Pausing stops the audio source; resuming uses its sample position. Loading leaves the editor and controls responsive. The next sentence is prepared while the current sentence plays. Finished speech is played at its natural pitch and speed. Longer sentences are allowed to finish, so an explainer can run slightly beyond one minute rather than cutting off or speeding up a voice.

While narration downloads or renders, the explainer shows a playful brick-breaker warm-up with live voice-loading feedback and a **Continue with captions** option. The lesson timeline waits for speech to start, then the lesson diagram returns automatically. The warm-up uses local SVG and CSS, adds no downloads, and respects reduced-motion preferences. A synthesis job that exceeds 60 seconds terminates its worker so Play can retry with a fresh instance; downloads allow up to three minutes without progress.

Verification checks all curriculum exercises, simulates three complete playback cycles, validates every model file's checksum, generates representative real Kokoro speech and personalized greetings, and tests actual audio buffers plus cancellation. The browser integration is also checked for non-silent Web Audio output, rather than relying on a speech-service status flag.

On a first visit, learners can enter a first name or nickname. Tutorial narration and captions greet them by name at the beginning of each chapter. The name is stored with their existing browser-local progress and can be changed using the name button in the top bar. Choosing **Maybe later** continues without a name and dismisses the first-visit prompt. Names and spoken text stay in the browser and are never sent to a speech service.

## Learner controls

Use Run code or Cmd/Ctrl+Enter. Tab inserts two spaces in the editor. Click the preview before using keyboard controls. The last eight chapters progressively add collisions, bricks, score, lives, states, particles, and levels. Click to launch the final game and move your mouse or touch to steer.

Exercise feedback checks explicit chapter goals. It is formative feedback, not a general-purpose proof that arbitrary code is correct. A previously completed exercise remains complete when experimenting with another solution. A chapter completes when all three exercises have been passed. Download sketch exports the current code for use in the [p5.js editor](https://editor.p5js.org/).

The local sketch runner is isolated in an iframe with `sandbox="allow-scripts"`; it cannot read the site's storage. Arbitrary JavaScript loops can still occupy the browser thread; reload the page if an experimental infinite loop freezes a preview. Keep loop counts small while learning.

## Reference

API behavior follows the official [p5.js reference](https://p5js.org/reference/) and [getting started tutorial](https://p5js.org/tutorials/get-started/).
