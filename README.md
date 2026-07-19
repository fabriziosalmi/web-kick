# MADKICK — Procedural VFX Audiovisual Engine

MADKICK is a browser-based audiovisual experience: an endlessly evolving **170 BPM kick drum** — continuously re-modulated through a Web Audio effects chain — drives a **WebGL2 fragment-shader engine** rendering a brutalist-rave visual in real time. Real-time frequency analysis meets generative art. No build step, no dependencies, just a static page.

## 🔈 [Kick it now!](https://fabriziosalmi.github.io/web-kick/)

![screenshot](https://github.com/fabriziosalmi/web-kick/blob/main/screenshot.jpg?raw=true)

## ✨ What it does

- **Endless evolving kick** — a 170 BPM loop pushed through a modulated chain (dynamic low-pass, waveshaper distortion, LFO-driven low-shelf EQ, feedback delay, compressor) so it never sounds twice the same.
- **WebGL2 brutalist-rave visuals** — a full-screen fragment-shader engine reacting to the audio, with an automatic **Canvas 2D fallback** when WebGL2 is unavailable.
- **Deterministic multi-impact intro** — the first ~3 seconds are a scripted, audio-independent choreography of accelerating impacts building into a drop. Always identical, always hits.
- **Live VJ controls** — switch scenes and toggle effects on the fly from the keyboard.

## 🎛️ Visual engine

Real-time audio analysis (8 logarithmic bands tuned to the kick, spectral-flux onset detection, RMS/centroid envelopes) feeds a chain of GPU passes:

| Feature | Detail |
|---|---|
| **Feedback tunnel** | Ping-pong FBO trails, kaleidoscope fold, radial spectrum, interfering moiré grids |
| **Acid mode** | Real SDF **raymarched** corrugated tunnel with volumetric neon walls |
| **Laser beams** | Radial beams gated to the click band |
| **Palette lock** | Hard full-scene recolor snapping every 16 beats (a "drop") |
| **Datamosh** | Block displacement of the previous frame on kick onset |
| **Shockwave** | Expanding impact rings (drives the intro and hard hits) |
| **Intelligent fisheye** | Sharp central focus, twisted radials, zoom pump — auto-engages **only** on sustained-energy drops/builds and the hardest kicks |
| **Post FX** | Multi-pass bloom, chromatic aberration, RGB strobe, scanlines, film grain, filmic tonemap |
| **Adaptive quality** | Render-scale auto-adjusts to hold framerate |

## ⌨️ VJ controls

Press **Play**, then drive it live:

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `1` | Feedback tunnel mode |
| `2` | Acid raymarch mode |
| `3` | Toggle datamosh |
| `4` | Toggle lasers |
| `5` | Toggle RGB strobe |
| `6` | Toggle intelligent fisheye |
| `P` | Shift palette now |
| `0` | Toggle auto palette-lock |

## 🚀 Getting started

The app uses **ES modules**, so it must be served over HTTP — opening `index.html` directly from the filesystem (`file://`) will not load the modules.

```sh
git clone https://github.com/fabriziosalmi/web-kick.git
cd web-kick
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, `php -S localhost:8000`, a Live Server extension, etc.).

### Requirements

- A modern browser with **WebGL2** and **Web Audio API** (Chrome, Firefox, Safari 15+, Edge). Without WebGL2 the visuals fall back to Canvas 2D; audio is unaffected.

## 🧱 Architecture

Vanilla JS, modular, zero third-party dependencies. See [README-modules.md](README-modules.md) for the full breakdown.

```
index.html            # markup + canvas layers + overlay UI
styles.css            # HUD, start screen, VJ readout
app.js                # orchestrator: wires audio ↔ renderer, VJ keys, intro
modules/
  audioEngine.js      # Web Audio context, source, dual analysers
  audioEffects.js     # modulated effects chain (filter, distortion, delay, ...)
  audioAnalysis.js    # bands, onset detection, RMS/centroid envelopes
  glRenderer.js       # WebGL2 fragment-shader engine (primary)
  vfxRenderer.js      # Canvas 2D renderer (automatic fallback)
  uiManager.js        # play/pause, HUD, accessibility
```

## 🛠️ Development

On `localhost` the app is exposed as `window.madKickApp` for console debugging:

```javascript
window.madKickApp.usingGL                 // true if the WebGL2 engine is active
window.madKickApp.vfxRenderer.setMode(1)  // jump to acid mode
window.madKickApp.vfxRenderer.cyclePalette()
```

## License

[MIT](LICENSE) © Fabrizio Salmi

---

*Free music for free people* 🏴‍☠️
