# Contributing to MADKICK

Thanks for your interest! MADKICK is a vanilla-JS, dependency-free
audiovisual toy. Contributions of all sizes are welcome.

## Running locally

The app uses **ES modules**, so it must be served over HTTP — opening
`index.html` from the filesystem (`file://`) will not load the modules.

```sh
git clone https://github.com/fabriziosalmi/web-kick.git
cd web-kick
python3 -m http.server 8000
# open http://localhost:8000
```

Any static server works (`npx serve`, `php -S localhost:8000`, a Live Server
extension, etc.).

## Project layout

See [README-modules.md](README-modules.md) for the full module breakdown.
Key files:

- `modules/glRenderer.js` — WebGL2 fragment-shader engine (primary visuals)
- `modules/vfxRenderer.js` — Canvas 2D fallback
- `modules/audioAnalysis.js` — real-time feature extraction feeding both
- `app.js` — orchestrator (audio ↔ renderer, VJ keys, intro)

## Making changes

1. Branch off `main`.
2. Keep it dependency-free and buildless — it must stay a static page.
3. There's no test suite; CI runs `node --check` on the JS. Please make sure
   your sources parse and the page runs (serve it and click Play).
4. Match the surrounding code style (no framework, small modules, no globals).
5. Open a PR against `main` with a clear description of the change.

## Reporting bugs / ideas

Use the issue templates. For visual changes, a screenshot or short screen
recording helps a lot.
