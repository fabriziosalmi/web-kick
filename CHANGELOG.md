# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.6] — 2026-07-19

### Added
- Deterministic multi-impact intro: on first play, an audio-independent
  choreography of accelerating impacts (flash · expanding shockwave ring ·
  RGB strobe · fisheye punch) builds into a drop at ~2.9s. Always identical.
- Expanding shockwave-ring primitive (reused by the intro and hard hits).
- Intelligent fisheye lens distortion — sharp central focus, twisted radials,
  zoom pump. Auto-engages only on sustained-energy drops/builds and the
  hardest kicks. Toggle with key `6`.

### Removed
- Beat-synced word typography (visual direction change).

## [1.0.5] — 2026-07-19

### Added
- New `GLRenderer`: full-screen WebGL2 fragment-shader engine reusing the
  existing audio analysis, with automatic Canvas 2D fallback.
- Feedback tunnel (ping-pong FBO), kaleidoscope, radial spectrum, moiré grids.
- Acid mode: real SDF raymarched tunnel (key `2`).
- Radial laser beams gated to the click band (key `4`).
- Palette-lock: hard recolor every 16 beats (keys `P` / `0`).
- Datamosh block glitch (key `3`), RGB strobe on strong kicks (key `5`).
- Multi-pass bloom, chromatic aberration, scanlines, grain, filmic tonemap.
- Live VJ keyboard controls with on-screen status readout.
- Adaptive render-scale quality.

## [1.0.0] — [1.0.4]

- Initial releases: modular architecture, Web Audio effects chain
  (dynamic low-pass, waveshaper distortion, LFO low-shelf EQ, feedback delay,
  compressor), real-time audio analysis, and the original Canvas 2D VFX.

[1.0.6]: https://github.com/fabriziosalmi/web-kick/releases/tag/v1.0.6
[1.0.5]: https://github.com/fabriziosalmi/web-kick/releases/tag/v1.0.5
