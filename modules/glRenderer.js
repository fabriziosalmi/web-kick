/**
 * GLRenderer — WebGL2 fragment-shader audiovisual engine
 *
 * BRUTALIST RAVE aesthetic:
 *   - Feedback tunnel (ping-pong FBO) → infinite motion trails
 *   - Kaleidoscopic radial spectrum + moiré grids
 *   - Datamosh block displacement on kick onset
 *   - Multi-pass bloom + chromatic aberration + scanlines + grain
 *
 * Reuses the existing AudioAnalysis output 1:1. Public interface mirrors
 * VFXRenderer so app.js can swap renderers transparently.
 *
 * Audio → uniforms:
 *   uSub/uBass/uMid/uHigh/uAir  band envelopes
 *   uRms                        RMS envelope
 *   uOnset                      1.0 on kick frame else 0
 *   uFlash                      decaying kick envelope (0..1)
 *   uBeat                       integer beat counter (float)
 *   uCentroid                   normalized spectral centroid
 *   uFreq / uWave               256-wide data textures
 */

// ---- Fullscreen vertex shader (single triangle) ----
const VERT = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUv;
void main(){
  vec2 p = P[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

// ---- Scene pass: geometry + feedback tunnel / acid raymarch ----
const FRAG_SCENE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uSub, uBass, uMid, uHigh, uAir, uRms;
uniform float uOnset, uFlash, uBeat, uCentroid;
uniform float uMode;       // 0 = feedback tunnel, 1 = acid SDF raymarch
uniform float uPalIdx;     // palette-lock selector (snaps on drops)
uniform float uLaser;      // laser beams on/off
uniform float uDatamosh;   // block glitch on/off
uniform float uShockR;     // expanding shockwave radius
uniform float uShockI;     // shockwave intensity
uniform sampler2D uPrev;   // previous frame (feedback)
uniform sampler2D uFreq;   // 256x1 spectrum
uniform sampler2D uWave;   // 256x1 waveform

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Continuous family of brutalist neon palettes, parameterized by idx.
// A hard snap of idx (on a drop) reads as an abrupt full-scene recolor.
vec3 palD(float idx){
  return 0.5 + 0.45 * cos(6.28318 * (vec3(1.0, 0.7, 0.4) * idx + vec3(0.0, 0.25, 0.5)));
}
vec3 palette(float t, float idx){
  return 0.5 + 0.5 * cos(6.28318 * (t + palD(idx)));
}

// ---------- Acid mode: real SDF tunnel raymarch ----------
float sdfTunnel(vec3 q){
  vec2 c = q.xy * rot(q.z * 0.28 + uMid * 1.5);        // twist down the bore
  float d = 1.15 - length(c);                           // inside a tube
  d += 0.16 * sin(q.z * 3.0 + uTime * 2.0) * sin(atan(c.y, c.x) * 6.0 + q.z); // corrugation
  return d;
}
vec3 acidRaymarch(vec2 p){
  vec3 ro = vec3(0.0, 0.0, uTime * 2.5 + uBeat * 0.4); // fly forward, faster per beat
  vec3 rd = normalize(vec3(p * 1.15, 1.0));
  float t = 0.0, glow = 0.0;
  for (int i = 0; i < 48; i++){
    vec3 pos = ro + rd * t;
    float d = sdfTunnel(pos);
    glow += 0.020 / (0.012 + abs(d));                  // volumetric neon on the walls
    t += max(abs(d) * 0.7, 0.025);
    if (t > 22.0) break;
  }
  float z = ro.z + t;
  vec3 col = palette(z * 0.06 + uCentroid, uPalIdx) * glow * 0.035;
  col += palette(0.2 + z * 0.1, uPalIdx) * uHigh * glow * 0.015;
  col *= (0.5 + uRms * 1.2) * (0.7 + uFlash * 1.5);
  return col;
}

void main(){
  vec2 st = vUv;                                  // 0..1
  vec2 p  = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y; // centered, aspect-correct

  // ============ FEEDBACK ============
  vec2 c = st - 0.5;
  float fbAmt = uMode > 0.5 ? 0.80 : 0.90;             // lighter trails in acid mode
  float zoom = 0.978 - uBass * 0.045 - uSub * 0.02;    // suck toward center
  c *= zoom;
  c *= rot(0.010 + uMid * 0.05 + uFlash * 0.08);        // swirl, punches on kick
  vec2 fb = c + 0.5;

  // Datamosh: on kick, shove blocks of the previous frame sideways
  if (uDatamosh > 0.5 && uFlash > 0.04){
    float bs = 18.0 + hash21(vec2(floor(uBeat), 3.0)) * 40.0;
    vec2 blk = floor(gl_FragCoord.xy / bs);
    float r = hash21(blk + floor(uBeat) * 1.7);
    if (r > 0.82){
      fb += vec2((r - 0.9) * uFlash * 0.6, 0.0);
    }
  }

  vec3 prev = texture(uPrev, fb).rgb;
  prev *= (fbAmt - uRms * 0.04);                        // trail decay
  prev = max(prev - 0.006, 0.0);                        // clean fade to black

  // ============ NEW EMISSIVE GEOMETRY ============
  vec3 col = vec3(0.0);
  float rad = length(p);
  float ang = atan(p.y, p.x);

  if (uMode > 0.5){
    col += acidRaymarch(p);
  } else {
    // Kaleidoscope fold — segment count locks to musical energy
    float seg = 4.0 + floor(uMid * 8.0);
    float ka = abs(mod(ang, 6.28318 / seg) - 3.14159 / seg);

    // Radial spectrum bars (kaleido-folded)
    float fi = ka / (3.14159 / seg);                   // 0..1 within a wedge
    float amp = texture(uFreq, vec2(fi, 0.5)).r;
    float barR = 0.22 + amp * 0.55 + uSub * 0.1;
    float bar = smoothstep(0.035, 0.0, abs(rad - barR)) * (0.4 + amp * 1.6);
    col += palette(fi * 0.5 + uBeat * 0.04 + uCentroid, uPalIdx) * bar;

    // Moiré grid — two interfering lattices, warped by bass
    vec2 g = p * (7.0 + floor(uHigh * 20.0));
    g += 0.35 * vec2(sin(p.y * 6.0 + uTime * 1.3), cos(p.x * 6.0 + uTime)) * (uBass + 0.15);
    vec2 g1 = abs(fract(g) - 0.5);
    vec2 g2 = abs(fract(g * rot(0.6 + uMid) * 1.3) - 0.5);
    float grid = smoothstep(0.48, 0.5, max(g1.x, g1.y)) * smoothstep(0.48, 0.5, max(g2.x, g2.y));
    col += palette(0.6 + uTime * 0.02, uPalIdx) * grid * (0.15 + uHigh * 0.9);

    // Rotating hard bars (strobe on air/hats)
    float bars = step(0.5, fract(ang * seg * 0.5 + uTime * 0.5 + uBeat * 0.25));
    col += palette(0.15 + uBeat * 0.03, uPalIdx) * bars * smoothstep(0.9, 0.3, rad) * uAir * 1.2;

    // Core detonation on kick
    float core = smoothstep(0.5, 0.0, rad);
    col += palette(uBeat * 0.05, uPalIdx) * core * uFlash * 2.4;
    col += vec3(1.0) * smoothstep(0.08, 0.0, rad) * uFlash;

    // Waveform ripple ring
    float wv = texture(uWave, vec2(fi, 0.5)).r - 0.5;
    float wring = smoothstep(0.02, 0.0, abs(rad - 0.72 - wv * 0.18 * uRms));
    col += palette(0.42, uPalIdx) * wring * uRms * 2.0;
  }

  // ============ LASER BEAMS (both modes, gated by click band) ============
  if (uLaser > 0.5){
    float beams = 6.0;
    float la = abs(mod(ang + uTime * 0.3 + uBeat * 0.2, 6.28318 / beams) - 3.14159 / beams);
    float beam = smoothstep(0.045, 0.0, la) * smoothstep(1.15, 0.08, rad);
    col += palette(0.02 + uBeat * 0.05, uPalIdx) * beam * uHigh * (1.5 + uFlash * 3.0);
  }

  // ============ SHOCKWAVE RING (impacts / intro) ============
  if (uShockI > 0.001){
    float ring = smoothstep(0.06, 0.0, abs(rad - uShockR)) * uShockI;
    col += palette(0.1 + uBeat * 0.05, uPalIdx) * ring * 2.2;
    col += vec3(1.0) * ring * uShockI * 0.6;   // white leading edge
  }

  // ============ COMBINE ============
  vec3 outc = prev + col;

  // subtle per-pixel grain seed so the feedback never banding-freezes
  outc += (hash21(gl_FragCoord.xy + uTime) - 0.5) * 0.008;

  fragColor = vec4(max(outc, 0.0), 1.0);
}`;

// ---- Bright-pass (bloom threshold) ----
const FRAG_BRIGHT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float k = smoothstep(0.55, 0.9, l);
  fragColor = vec4(c * k, 1.0);
}`;

// ---- Separable gaussian blur ----
const FRAG_BLUR = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uDir;    // texel-sized step along one axis
void main(){
  vec3 sum = texture(uTex, vUv).rgb * 0.227027;
  sum += texture(uTex, vUv + uDir * 1.3846).rgb * 0.316216;
  sum += texture(uTex, vUv - uDir * 1.3846).rgb * 0.316216;
  sum += texture(uTex, vUv + uDir * 3.2308).rgb * 0.070270;
  sum += texture(uTex, vUv - uDir * 3.2308).rgb * 0.070270;
  fragColor = vec4(sum, 1.0);
}`;

// ---- Composite: scene + bloom + chromatic aberration + scanlines + grain + vignette ----
const FRAG_COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2  uRes;
uniform float uTime;
uniform float uFlash, uRms, uOnset;
uniform float uFisheye;  // 0..1 intelligent lens distortion, gated to drops
uniform vec3  uStrobe;   // full-frame RGB strobe, gated to strong kicks

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

void main(){
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  float r = length(d);
  float r2 = r * r;

  // === Intelligent fisheye: sharp center, distorted radials toward edges, zoom pump ===
  vec2 suv = uv;
  if (uFisheye > 0.001){
    float pump = 0.6 + 0.4 * sin(uTime * 6.0);              // zooming throb
    float bar = 1.0 + uFisheye * pump * r2 * 2.0 - uFisheye * 0.12;
    vec2 fc = d * bar;
    float sw = uFisheye * 0.35 * smoothstep(0.0, 0.65, r);  // twist the radials
    fc = rot(sw) * fc;
    suv = 0.5 + fc;
  }

  // barrel-ish chromatic aberration, stronger on kicks + fisheye + toward edges
  float ca = (0.0025 + uFlash * 0.012 + uFisheye * 0.02) * (0.4 + r2 * 2.5);
  vec2 dir = normalize(d + 1e-5);
  vec3 scene;
  scene.r = texture(uScene, suv - dir * ca).r;
  scene.g = texture(uScene, suv).g;
  scene.b = texture(uScene, suv + dir * ca).b;

  vec3 bloom = texture(uBloom, suv).rgb;
  vec3 col = scene + bloom * (1.1 + uRms * 0.8);

  // horizontal scanline tear on strong kicks
  float tear = step(0.5, hash21(vec2(floor(uv.y * 90.0), floor(uTime * 24.0))));
  col += tear * uFlash * 0.06;

  // scanlines
  float sl = 0.92 + 0.08 * sin(gl_FragCoord.y * 3.14159);
  col *= sl;

  // film grain
  col += (hash21(gl_FragCoord.xy + uTime * 60.0) - 0.5) * 0.045;

  // vignette (tightens toward center when the fisheye engages → central focus)
  col *= smoothstep(0.95, 0.25, r2);
  col *= 1.0 - uFisheye * 0.35 * smoothstep(0.2, 0.85, r);

  // full-frame RGB strobe on the hardest kicks
  col += uStrobe;

  // filmic-ish tonemap so bloom doesn't blow out flat white
  col = col / (col + vec3(0.9));
  col = pow(col, vec3(0.85));

  fragColor = vec4(col, 1.0);
}`;

export class GLRenderer {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.renderScale = 1.0;

    this.time = 0;
    this.dt = 0;
    this.lastTime = 0;
    this.frameCount = 0;

    // adaptive quality
    this.fpsHistory = new Float32Array(30);
    this.fpsIdx = 0;

    this.isRunning = false;
    this.rafId = null;
    this.onFrame = null;

    this.audio = null;

    // beat / kick state (smoothed for shaders)
    this.flash = 0;
    this.beatCount = 0;
    this.strobe = new Float32Array(3);   // gated full-frame RGB strobe

    // === VJ controls (live-toggleable) ===
    this.mode = 0;          // 0 = feedback tunnel, 1 = acid raymarch
    this.laserOn = 1;       // radial laser beams
    this.datamoshOn = 1;    // block glitch on kick
    this.strobeOn = 1;      // full-frame RGB strobe
    this.paletteAuto = 1;   // auto palette-lock changes on drops
    this.palIdx = 0;        // current palette selector (smoothed toward target)
    this.palTarget = 0;     // target palette selector

    // Intelligent fisheye — only engages on drops/builds and hard kicks
    this.fisheyeAuto = 1;
    this.fisheye = 0;       // 0..1 current distortion amount
    this.energySlow = 0;    // slow RMS baseline for drop detection

    // Expanding shockwave ring (impacts)
    this.shockR = 0;        // current radius
    this.shockI = 0;        // current intensity (decays)

    // Deterministic intro choreography (runs on first play, audio-independent)
    this.introTime = -1;    // <0 = inactive
    this.introIdx = 0;
    // Accelerating hits building into a drop at ~2.9s. [time, strength]
    this.introHits = [
      [0.00, 1.00], [0.70, 0.45], [1.25, 0.55], [1.70, 0.65],
      [2.05, 0.72], [2.35, 0.80], [2.58, 0.88], [2.76, 0.94], [2.90, 1.00],
    ];

    // GL objects
    this.programs = {};
    this.fbos = {};
    this.vao = null;
    this.freqTex = null;
    this.waveTex = null;
    this._freqPixels = new Uint8Array(256);
    this._wavePixels = new Uint8Array(256);

    this.supported = false;
  }

  initialize(canvas /*, glitchCanvas (unused) */) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false,
      stencil: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance', desynchronized: true,
    });
    if (!gl) { this.supported = false; return false; }
    this.gl = gl;
    this.supported = true;

    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    // Compile programs
    this.programs.scene = this._program(VERT, FRAG_SCENE);
    this.programs.bright = this._program(VERT, FRAG_BRIGHT);
    this.programs.blur = this._program(VERT, FRAG_BLUR);
    this.programs.composite = this._program(VERT, FRAG_COMPOSITE);

    // Fullscreen triangle VAO (attribute-less; positions live in the shader)
    this.vao = gl.createVertexArray();

    // Audio data textures
    this.freqTex = this._dataTex(256);
    this.waveTex = this._dataTex(256);

    this.resize();

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    return true;
  }

  isSupported() { return this.supported; }

  _program(vsrc, fsrc) {
    const gl = this.gl;
    const vs = this._shader(gl.VERTEX_SHADER, vsrc);
    const fs = this._shader(gl.FRAGMENT_SHADER, fsrc);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(p));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    // cache uniform locations lazily via a proxy map
    p._u = {};
    return p;
  }

  _shader(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(s) + '\n' + src);
    }
    return s;
  }

  _u(prog, name) {
    let loc = prog._u[name];
    if (loc === undefined) { loc = this.gl.getUniformLocation(prog, name); prog._u[name] = loc; }
    return loc;
  }

  _dataTex(w) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, 1, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  _makeFBO(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex, w, h };
  }

  resize() {
    const gl = this.gl;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const pw = Math.floor(this.width * this.dpr * this.renderScale);
    const ph = Math.floor(this.height * this.dpr * this.renderScale);

    this.canvas.width = pw;
    this.canvas.height = ph;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    // (re)allocate FBOs
    this._disposeFBOs();
    this.fbos.sceneA = this._makeFBO(pw, ph);
    this.fbos.sceneB = this._makeFBO(pw, ph);
    const bw = Math.max(1, pw >> 2), bh = Math.max(1, ph >> 2);
    this.fbos.bright = this._makeFBO(bw, bh);
    this.fbos.blurA = this._makeFBO(bw, bh);
    this.fbos.blurB = this._makeFBO(bw, bh);
    this._pingPong = 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this._loop();
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  updateAudioData(d) { this.audio = d; }

  _uploadAudioTextures() {
    const gl = this.gl;
    const a = this.audio;
    if (!a || !a.frequency) return;

    // Downsample the (typically 1024-bin) spectrum into 256 texels
    const freq = a.frequency;
    const fn = freq.length;
    const fp = this._freqPixels;
    for (let i = 0; i < 256; i++) {
      // emphasize low end (kick) with a mild log-ish map
      const t = i / 255;
      const idx = ((t * t * 0.6 + t * 0.4) * (fn - 1)) | 0;
      fp[i] = freq[idx];
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.freqTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RED, gl.UNSIGNED_BYTE, fp);

    if (a.waveform) {
      const wave = a.waveform;
      const wn = wave.length;
      const wp = this._wavePixels;
      const stepW = wn / 256;
      for (let i = 0; i < 256; i++) wp[i] = wave[(i * stepW) | 0];
      gl.bindTexture(gl.TEXTURE_2D, this.waveTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RED, gl.UNSIGNED_BYTE, wp);
    }
  }

  _loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    this.dt = Math.min((now - this.lastTime) * 0.001, 0.05);
    this.lastTime = now;
    this.time += this.dt;
    this.frameCount++;

    if (this.onFrame) this.onFrame(this.dt);   // audio analysis runs here

    this._adaptQuality();
    this._updateIntro();
    this._updateBeat();
    this._updateFisheye();
    this._updateShock();
    this._uploadAudioTextures();
    this._render();

    this.rafId = requestAnimationFrame(() => this._loop());
  }

  _updateBeat() {
    const a = this.audio;
    if (a && a.onset) {
      this.flash = Math.max(this.flash, a.onsetStrength);
      this.beatCount++;
      // Palette lock: snap to a new palette every 16 beats (a "drop")
      if (this.paletteAuto && this.beatCount % 16 === 0) {
        this.palTarget += 0.27 + (this.beatCount % 7) * 0.03;
      }
      // Strong kicks trigger a short RGB strobe that alternates hue per beat
      if (this.strobeOn && a.onsetStrength > 0.7) {
        const cols = [[1, 1, 1], [0.2, 1, 1], [1, 0.2, 0.9]];
        const c = cols[this.beatCount % 3];
        const s = (a.onsetStrength - 0.7) * 0.55;
        this.strobe[0] = c[0] * s; this.strobe[1] = c[1] * s; this.strobe[2] = c[2] * s;
      }
    }
    this.flash *= 0.86;
    this.strobe[0] *= 0.5; this.strobe[1] *= 0.5; this.strobe[2] *= 0.5;
    // Fast lerp = near-hard cut on palette change
    this.palIdx += (this.palTarget - this.palIdx) * 0.30;
  }

  // Fire one deterministic impact (reuses flash / strobe / shockwave / fisheye)
  _impact(s) {
    this.flash = Math.max(this.flash, s);
    this.shockR = 0.02;
    this.shockI = Math.max(this.shockI, s);
    this.fisheye = Math.max(this.fisheye, s * 0.7);
    if (s > 0.6) {
      const cols = [[1, 1, 1], [0.2, 1, 1], [1, 0.2, 0.9]];
      const c = cols[this.introIdx % 3];
      const a = (s - 0.6) * 0.7;
      this.strobe[0] = c[0] * a; this.strobe[1] = c[1] * a; this.strobe[2] = c[2] * a;
    }
  }

  // Deterministic intro — start on first play, always identical
  startIntro() { this.introTime = 0; this.introIdx = 0; }

  _updateIntro() {
    if (this.introTime < 0) return;
    this.introTime += this.dt;
    const hits = this.introHits;
    while (this.introIdx < hits.length && this.introTime >= hits[this.introIdx][0]) {
      this._impact(hits[this.introIdx][1]);
      this.introIdx++;
    }
    if (this.introTime > 3.4) this.introTime = -1; // done
  }

  _updateFisheye() {
    if (!this.fisheyeAuto) { this.fisheye += (0 - this.fisheye) * 0.1; return; }
    const a = this.audio;
    const rms = a ? (a.rmsEnvelope || 0) : 0;
    const sub = a && a.bands ? (a.bands.subBass || 0) : 0;
    this.energySlow += (rms - this.energySlow) * 0.02;      // slow baseline
    const drop = Math.max(0, rms - this.energySlow - 0.10) * 3.5; // sustained-energy surge
    let target = Math.min(1, drop + sub * 0.35);
    if (a && a.onset && a.onsetStrength > 0.85) target = Math.max(target, 0.6);
    const k = target > this.fisheye ? 0.22 : 0.05;          // fast in, slow out
    this.fisheye += (target - this.fisheye) * k;
  }

  _updateShock() {
    if (this.shockI <= 0.001) { this.shockI = 0; return; }
    this.shockR += this.dt * 2.6;         // expand outward
    this.shockI *= 0.90;                  // fade
    if (this.shockR > 1.7) this.shockI = 0;
  }

  // === VJ control API (driven by keyboard in app.js) ===
  setMode(m) { this.mode = m ? 1 : 0; return this.mode ? 'ACID RAYMARCH' : 'FEEDBACK TUNNEL'; }
  toggleDatamosh() { this.datamoshOn ^= 1; return 'DATAMOSH ' + (this.datamoshOn ? 'ON' : 'OFF'); }
  toggleLaser() { this.laserOn ^= 1; return 'LASERS ' + (this.laserOn ? 'ON' : 'OFF'); }
  toggleStrobe() { this.strobeOn ^= 1; return 'STROBE ' + (this.strobeOn ? 'ON' : 'OFF'); }
  toggleFisheye() { this.fisheyeAuto ^= 1; return 'FISHEYE ' + (this.fisheyeAuto ? 'AUTO' : 'OFF'); }
  cyclePalette() { this.palTarget += 0.31; return 'PALETTE SHIFT'; }
  togglePaletteAuto() { this.paletteAuto ^= 1; return 'PALETTE-LOCK ' + (this.paletteAuto ? 'AUTO' : 'FROZEN'); }

  _adaptQuality() {
    if (this.dt > 0) {
      this.fpsHistory[this.fpsIdx] = 1 / this.dt;
      this.fpsIdx = (this.fpsIdx + 1) % 30;
    }
    if ((this.frameCount & 63) === 0) {
      let avg = 0;
      for (let i = 0; i < 30; i++) avg += this.fpsHistory[i];
      avg /= 30;
      let changed = false;
      if (avg < 45 && this.renderScale > 0.6) { this.renderScale = Math.max(0.6, this.renderScale - 0.15); changed = true; }
      else if (avg > 57 && this.renderScale < 1.0) { this.renderScale = Math.min(1.0, this.renderScale + 0.1); changed = true; }
      if (changed) this.resize();
    }
  }

  _setAudioUniforms(prog) {
    const gl = this.gl;
    const a = this.audio;
    const b = a ? a.bands : null;
    gl.uniform1f(this._u(prog, 'uTime'), this.time);
    gl.uniform1f(this._u(prog, 'uSub'), b ? (b.subBass || 0) : 0);
    gl.uniform1f(this._u(prog, 'uBass'), b ? (b.bass || 0) : 0);
    gl.uniform1f(this._u(prog, 'uMid'), b ? (b.mid || 0) : 0);
    gl.uniform1f(this._u(prog, 'uHigh'), b ? (b.click || 0) : 0);
    gl.uniform1f(this._u(prog, 'uAir'), b ? (b.air || 0) : 0);
    gl.uniform1f(this._u(prog, 'uRms'), a ? (a.rmsEnvelope || 0) : 0);
    gl.uniform1f(this._u(prog, 'uOnset'), a && a.onset ? 1 : 0);
    gl.uniform1f(this._u(prog, 'uFlash'), this.flash);
    gl.uniform1f(this._u(prog, 'uBeat'), this.beatCount);
    gl.uniform1f(this._u(prog, 'uCentroid'), a ? Math.min(1, (a.spectralCentroid || 0) / 4000) : 0);
    gl.uniform1f(this._u(prog, 'uMode'), this.mode);
    gl.uniform1f(this._u(prog, 'uPalIdx'), this.palIdx);
    gl.uniform1f(this._u(prog, 'uLaser'), this.laserOn);
    gl.uniform1f(this._u(prog, 'uDatamosh'), this.datamoshOn);
    gl.uniform1f(this._u(prog, 'uShockR'), this.shockR);
    gl.uniform1f(this._u(prog, 'uShockI'), this.shockI);
  }

  _drawTo(fbo) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo ? fbo.fb : null);
    const w = fbo ? fbo.w : this.canvas.width;
    const h = fbo ? fbo.h : this.canvas.height;
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _render() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    const scene = this._pingPong === 0 ? this.fbos.sceneA : this.fbos.sceneB;
    const prev = this._pingPong === 0 ? this.fbos.sceneB : this.fbos.sceneA;
    this._pingPong ^= 1;

    // ---- 1. SCENE (reads prev feedback, writes to scene) ----
    const sp = this.programs.scene;
    gl.useProgram(sp);
    gl.uniform2f(this._u(sp, 'uRes'), scene.w, scene.h);
    this._setAudioUniforms(sp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prev.tex);
    gl.uniform1i(this._u(sp, 'uPrev'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.freqTex);
    gl.uniform1i(this._u(sp, 'uFreq'), 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.waveTex);
    gl.uniform1i(this._u(sp, 'uWave'), 2);
    this._drawTo(scene);

    // ---- 2. BRIGHT PASS (scene → bright, quarter res) ----
    const bp = this.programs.bright;
    gl.useProgram(bp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(this._u(bp, 'uTex'), 0);
    this._drawTo(this.fbos.bright);

    // ---- 3. BLUR (two separable iterations) ----
    const blp = this.programs.blur;
    gl.useProgram(blp);
    const bw = this.fbos.bright.w, bh = this.fbos.bright.h;
    let src = this.fbos.bright;
    for (let it = 0; it < 2; it++) {
      // horizontal
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this._u(blp, 'uTex'), 0);
      gl.uniform2f(this._u(blp, 'uDir'), 1.0 / bw, 0.0);
      this._drawTo(this.fbos.blurA);
      // vertical
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.fbos.blurA.tex);
      gl.uniform2f(this._u(blp, 'uDir'), 0.0, 1.0 / bh);
      this._drawTo(this.fbos.blurB);
      src = this.fbos.blurB;
    }

    // ---- 4. COMPOSITE → screen ----
    const cp = this.programs.composite;
    gl.useProgram(cp);
    gl.uniform2f(this._u(cp, 'uRes'), this.canvas.width, this.canvas.height);
    gl.uniform1f(this._u(cp, 'uTime'), this.time);
    gl.uniform1f(this._u(cp, 'uFlash'), this.flash);
    gl.uniform1f(this._u(cp, 'uRms'), this.audio ? (this.audio.rmsEnvelope || 0) : 0);
    gl.uniform1f(this._u(cp, 'uOnset'), this.audio && this.audio.onset ? 1 : 0);
    gl.uniform1f(this._u(cp, 'uFisheye'), this.fisheye);
    gl.uniform3f(this._u(cp, 'uStrobe'), this.strobe[0], this.strobe[1], this.strobe[2]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.uniform1i(this._u(cp, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.fbos.blurB.tex);
    gl.uniform1i(this._u(cp, 'uBloom'), 1);
    this._drawTo(null);
  }

  _disposeFBOs() {
    const gl = this.gl;
    for (const k in this.fbos) {
      const f = this.fbos[k];
      if (f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
    }
    this.fbos = {};
  }

  dispose() {
    this.stop();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (!this.gl) return;
    const gl = this.gl;
    this._disposeFBOs();
    for (const k in this.programs) gl.deleteProgram(this.programs[k]);
    if (this.freqTex) gl.deleteTexture(this.freqTex);
    if (this.waveTex) gl.deleteTexture(this.waveTex);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.programs = {};
  }
}
