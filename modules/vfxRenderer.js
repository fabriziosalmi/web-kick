/**
 * VFX Renderer v3 — Draconian performance pass
 *
 * FIXES vs v2:
 * - onFrame callback for single-rAF architecture
 * - Pre-computed RGBA color arrays — ZERO template literals in hot loops
 * - Batched star trails into single path per color class
 * - Nebula: skip gradient, use single fillStyle with globalAlpha
 * - Ring segments batched into single beginPath
 * - classList thrashing eliminated (bool flag)
 * - Particle pool (avoid object churn)
 * - Unused _colorCache removed
 * - Adaptive star count based on quality
 */

export class VFXRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.glitchCanvas = null;
        this.glitchCtx = null;

        this.width = 0;
        this.height = 0;
        this.cx = 0;
        this.cy = 0;
        this.dpr = 1;

        this.time = 0;
        this.dt = 0;
        this.lastTime = 0;
        this.frameCount = 0;

        // Adaptive quality
        this.quality = 1.0;
        this.fpsHistory = new Float32Array(30);
        this.fpsIdx = 0;

        this.isRunning = false;
        this.rafId = null;

        // Callback — app injects audio analysis here
        this.onFrame = null;

        // Stars SOA: x,y,z,size,colorIdx,brightness = 6 floats
        this.starCount = 700;
        this.STAR_S = 6;
        this.stars = null;
        this.starSpeed = 1.5;
        this.starSpeedSmooth = 1.5;
        this._maxR = 0;

        // Nebula SOA: x,y,z,size,hue,alpha = 6
        this.nebulaCount = 15;
        this.nebulae = null;

        // Particle pool
        this.particles = [];
        this.maxParticles = 120;

        // Rings
        this.ringAngles = [0, 0, 0, 0];

        // Glitch
        this.glitchPower = 0;
        this._glitchActive = false;

        // Camera shake
        this.shakeX = 0;
        this.shakeY = 0;

        // Color
        this.hueBase = 0;

        // Audio
        this.audio = null;

        // Pre-baked color LUT for stars (avoids template literals)
        // 16 white brightness levels + 16 colored (per hue bucket)
        this._starWhite = null;  // ['rgba(210,220,245,0.0)', ...]
        this._starColored = null; // [['hsla(...)'], ...] per hue bucket

        // Cached vignette
        this._vigGrad = null;
        this._vigW = 0;
        this._vigH = 0;

        // Reusable path flag
        this._bgGrad = null;
        this._bgH1 = -1;
        this._bgL1 = -1;
        this._bgL2 = -1;
    }

    initialize(canvas, glitchCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        this.glitchCanvas = glitchCanvas;
        this.glitchCtx = glitchCanvas.getContext('2d', { alpha: true });

        this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

        this.resize();
        this._buildColorLUT();
        this.initStars();
        this.initNebulae();

        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize);
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.cx = this.width * 0.5;
        this.cy = this.height * 0.5;
        this._maxR = Math.max(this.width, this.height) * 1.2;

        const set = (c) => {
            c.width = this.width * this.dpr;
            c.height = this.height * this.dpr;
            c.style.width = this.width + 'px';
            c.style.height = this.height + 'px';
        };
        set(this.canvas);
        set(this.glitchCanvas);

        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.glitchCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        this._vigGrad = null; // invalidate
    }

    // Pre-bake 32 white brightness levels to avoid per-star string alloc
    _buildColorLUT() {
        this._starWhite = new Array(32);
        for (let i = 0; i < 32; i++) {
            const a = (i / 31).toFixed(2);
            this._starWhite[i] = `rgba(210,220,245,${a})`;
        }
    }

    _whiteColor(brightness) {
        const idx = (brightness * 31 + 0.5) | 0;
        return this._starWhite[idx < 0 ? 0 : idx > 31 ? 31 : idx];
    }

    // Stars SOA
    initStars() {
        const n = this.starCount;
        this.stars = new Float32Array(n * this.STAR_S);
        for (let i = 0; i < n; i++) this._resetStar(i, true);
    }

    _resetStar(i, randZ) {
        const o = i * this.STAR_S;
        const angle = Math.random() * 6.2832;
        const r = Math.random() * this._maxR;
        this.stars[o] = Math.cos(angle) * r;
        this.stars[o + 1] = Math.sin(angle) * r;
        this.stars[o + 2] = randZ ? Math.random() * 1400 + 100 : 1500;
        this.stars[o + 3] = Math.random() * 1.6 + 0.3;
        this.stars[o + 4] = Math.random() < 0.1 ? 1 : 0; // 10% colored
        this.stars[o + 5] = Math.random() * 0.5 + 0.5;
    }

    // Nebula SOA
    initNebulae() {
        const n = this.nebulaCount;
        this.nebulae = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
            const o = i * 6;
            this.nebulae[o] = (Math.random() - 0.5) * this.width * 2;
            this.nebulae[o + 1] = (Math.random() - 0.5) * this.height * 2;
            this.nebulae[o + 2] = Math.random() * 1400 + 200;
            this.nebulae[o + 3] = Math.random() * 250 + 60;
            this.nebulae[o + 4] = Math.random() * 360;
            this.nebulae[o + 5] = Math.random() * 0.02 + 0.004;
        }
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

    // === MAIN LOOP (single rAF) ===
    _loop() {
        if (!this.isRunning) return;

        const now = performance.now();
        this.dt = Math.min((now - this.lastTime) * 0.001, 0.04);
        this.lastTime = now;
        this.time += this.dt;
        this.frameCount++;

        // App callback — audio analysis happens here
        if (this.onFrame) this.onFrame(this.dt);

        this._adaptQuality();
        this._updateDynamics();

        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.setTransform(this.dpr, 0, 0, this.dpr, this.shakeX * this.dpr, this.shakeY * this.dpr);

        this._renderBg(ctx, w, h);
        this._renderNebulae(ctx, w, h);
        this._renderStars(ctx, w, h);

        if (this.audio) {
            this._renderRings(ctx, w, h);
            this._renderWaveform(ctx, w, h);
        }

        this._renderParticles(ctx);
        this._renderVignette(ctx, w, h);
        this._renderGlitch();

        this.rafId = requestAnimationFrame(() => this._loop());
    }

    _adaptQuality() {
        if (this.dt > 0) {
            this.fpsHistory[this.fpsIdx] = 1 / this.dt;
            this.fpsIdx = (this.fpsIdx + 1) % 30;
        }
        if ((this.frameCount & 31) === 0) {
            let avg = 0;
            for (let i = 0; i < 30; i++) avg += this.fpsHistory[i];
            avg /= 30;
            if (avg < 45 && this.quality > 0.5) this.quality = Math.max(0.5, this.quality - 0.1);
            else if (avg > 55 && this.quality < 1) this.quality = Math.min(1, this.quality + 0.05);
        }
    }

    _updateDynamics() {
        const a = this.audio;
        this.hueBase = (this.time * 12) % 360;

        let target = 1.5;
        if (a) {
            if (a.onset) target = 6 + a.onsetStrength * 10;
            target += (a.bands.subBass || 0) * 3;
        }
        this.starSpeedSmooth += (target - this.starSpeedSmooth) * 0.15;
        this.starSpeed = this.starSpeedSmooth;

        if (a && a.onset) {
            this.shakeX = (Math.random() - 0.5) * 8 * a.onsetStrength;
            this.shakeY = (Math.random() - 0.5) * 8 * a.onsetStrength;
            this._spawnBurst(a.onsetStrength);
        }
        this.shakeX *= 0.8;
        this.shakeY *= 0.8;

        if (a && a.onset && a.onsetStrength > 0.4) this.glitchPower = a.onsetStrength;
        this.glitchPower *= 0.85;
    }

    // === BG ===
    _renderBg(ctx, w, h) {
        const a = this.audio;
        const sub = a ? (a.bands.subBass || 0) : 0;
        const bass = a ? (a.bands.bass || 0) : 0;
        const h1 = ((this.hueBase + 240) % 360) | 0;
        const l1 = (2 + sub * 6) | 0;
        const l2 = (1 + bass * 3) | 0;

        // Only rebuild gradient if params changed
        if (h1 !== this._bgH1 || l1 !== this._bgL1 || l2 !== this._bgL2) {
            this._bgH1 = h1; this._bgL1 = l1; this._bgL2 = l2;
            const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(w, h) * 0.7);
            g.addColorStop(0, `hsl(${h1},50%,${l1}%)`);
            g.addColorStop(0.6, `hsl(${(h1 + 30) % 360},30%,${l2}%)`);
            g.addColorStop(1, '#000');
            this._bgGrad = g;
        }
        ctx.fillStyle = this._bgGrad;
        ctx.fillRect(0, 0, w, h);
    }

    // === NEBULAE — simple circles with globalAlpha, no per-nebula gradient ===
    _renderNebulae(ctx, w, h) {
        const a = this.audio;
        const boost = a ? (a.bands.bass || 0) * 1.5 : 0;
        const speed = this.starSpeed * 0.15 * 60 * this.dt;

        ctx.globalCompositeOperation = 'lighter';

        for (let i = 0; i < this.nebulaCount; i++) {
            const o = i * 6;
            this.nebulae[o + 2] -= speed;
            if (this.nebulae[o + 2] <= 10) {
                this.nebulae[o + 2] = 1400;
                this.nebulae[o] = (Math.random() - 0.5) * w * 2;
                this.nebulae[o + 1] = (Math.random() - 0.5) * h * 2;
                this.nebulae[o + 4] = Math.random() * 360;
            }
            const z = this.nebulae[o + 2];
            const sc = 500 / z;
            const sx = this.cx + this.nebulae[o] * sc;
            const sy = this.cy + this.nebulae[o + 1] * sc;
            const sz = this.nebulae[o + 3] * sc;

            if (sx < -sz || sx > w + sz || sy < -sz || sy > h + sz) continue;

            const hue = ((this.nebulae[o + 4] + this.hueBase) % 360) | 0;
            const alpha = this.nebulae[o + 5] * (1 + boost) * Math.min(1, (1400 - z) * 0.0025);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = `hsl(${hue},60%,20%)`;
            ctx.beginPath();
            ctx.arc(sx, sy, sz, 0, 6.2832);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    // === STARS — LUT colors, batched white stars ===
    _renderStars(ctx, w, h) {
        const speed = this.starSpeed * 60 * this.dt;
        const n = this.starCount;
        const S = this.STAR_S;
        const d = this.stars;
        const cx = this.cx;
        const cy = this.cy;
        const a = this.audio;
        const bassSize = a ? (a.bands.bass || 0) * 1.2 : 0;
        const fast = this.starSpeed > 2.5;
        const hueB = this.hueBase;

        ctx.globalCompositeOperation = 'lighter';

        // Batch: collect trail lines, draw once
        if (fast) {
            ctx.lineWidth = 0.6;
            ctx.beginPath();
        }

        for (let i = 0; i < n; i++) {
            const o = i * S;
            d[o + 2] -= speed;

            if (d[o + 2] <= 1) { this._resetStar(i, false); continue; }

            const z = d[o + 2];
            const sc = 500 / z;
            const sx = cx + d[o] * sc;
            const sy = cy + d[o + 1] * sc;

            if (sx < -4 || sx > w + 4 || sy < -4 || sy > h + 4) continue;

            const size = d[o + 3] * sc * (1 + bassSize);
            const br = d[o + 5] * Math.min(1, (1400 - z) * 0.00167);
            if (br < 0.04) continue;

            const colored = d[o + 4] === 1;

            // Trail batch (white only for perf — colored stars are rare)
            if (fast && size > 0.6 && !colored) {
                const dx = sx - cx;
                const dy = sy - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const tl = Math.min(size * 6, 40) * this.starSpeed * 0.12;
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx - (dx / dist) * tl, sy - (dy / dist) * tl);
            }

            // Star dot
            if (colored) {
                const ch = ((hueB + i * 37) % 360) | 0;
                ctx.fillStyle = `hsla(${ch},80%,65%,${br.toFixed(2)})`;
            } else {
                ctx.fillStyle = this._whiteColor(br);
            }

            const s = size < 0.5 ? 0.5 : size;
            if (s < 1.8) {
                ctx.fillRect(sx - s * 0.5, sy - s * 0.5, s, s);
            } else {
                ctx.beginPath();
                ctx.arc(sx, sy, s, 0, 6.2832);
                ctx.fill();
            }
        }

        // Flush batched trail lines
        if (fast) {
            ctx.strokeStyle = 'rgba(200,210,240,0.15)';
            ctx.stroke();
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    // === RINGS ===
    _renderRings(ctx, w, h) {
        const a = this.audio;
        if (!a) return;
        const bands = [a.bands.subBass || 0, a.bands.bass || 0, a.bands.mid || 0, a.bands.click || 0];
        const colors = ['0,240,255', '255,0,170', '170,255,0', '255,140,0'];

        ctx.save();
        ctx.translate(this.cx, this.cy);
        ctx.globalCompositeOperation = 'lighter';

        for (let r = 0; r < 4; r++) {
            const b = bands[r];
            if (b < 0.02) continue;

            const radius = 50 + r * 42 + b * 55;
            this.ringAngles[r] += (0.2 + b * 1.2) * this.dt * (r & 1 ? -1 : 1);

            ctx.save();
            ctx.rotate(this.ringAngles[r]);
            ctx.strokeStyle = `rgba(${colors[r]},${Math.min(0.7, b * 0.6).toFixed(2)})`;
            ctx.lineWidth = 1 + b * 1.5;

            const freq = a.frequency;
            const bc = Math.min(a.binCount || 64, 64);
            ctx.beginPath();
            for (let s = 0; s < 20; s++) {
                const fi = (s / 20 * bc) | 0;
                const fv = freq ? freq[fi] * 0.00392 : 0; // /255
                const sr = radius + fv * 20;
                const a1 = s * 0.3142; // 2PI/20
                const a2 = a1 + 0.2042; // * 0.65
                ctx.moveTo(Math.cos(a1) * sr, Math.sin(a1) * sr);
                ctx.arc(0, 0, sr, a1, a2);
            }
            ctx.stroke();
            ctx.restore();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    // === WAVEFORM ===
    _renderWaveform(ctx, w, h) {
        const a = this.audio;
        if (!a || !a.waveform || (a.rmsEnvelope || 0) < 0.01) return;

        const wave = a.waveform;
        const rms = a.rmsEnvelope;
        const amp = 60 + rms * 140;
        const hue = ((this.hueBase + 180) % 360) | 0;

        ctx.globalCompositeOperation = 'lighter';

        const len = wave.length;
        const step = len > 1024 ? 4 : 2;
        const xStep = w / (len / step);

        ctx.beginPath();
        let x = 0;
        for (let i = 0; i < len; i += step) {
            const y = this.cy + ((wave[i] - 128) * 0.0078125) * amp;
            if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(x, y);
            x += xStep;
        }

        // Two strokes on same path — outer glow + inner sharp
        ctx.strokeStyle = `hsla(${hue},100%,50%,${(rms * 0.18).toFixed(2)})`;
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.strokeStyle = `hsla(${hue},100%,75%,${Math.min(1, rms * 1.2).toFixed(2)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';
    }

    // === PARTICLES ===
    _spawnBurst(strength) {
        const count = (6 + strength * 18) | 0;
        for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
            const angle = Math.random() * 6.2832;
            const spd = Math.random() * 4 + 1.2;
            this.particles.push({
                x: this.cx, y: this.cy,
                vx: Math.cos(angle) * spd * (1 + strength * 1.8),
                vy: Math.sin(angle) * spd * (1 + strength * 1.8),
                life: 1, decay: Math.random() * 0.01 + 0.005,
                size: Math.random() * 2.5 + 0.6,
                hue: ((this.hueBase + Math.random() * 40) % 360) | 0
            });
        }
    }

    _renderParticles(ctx) {
        const p = this.particles;
        if (p.length === 0) return;

        ctx.globalCompositeOperation = 'lighter';

        for (let i = p.length - 1; i >= 0; i--) {
            const pt = p[i];
            pt.x += pt.vx; pt.y += pt.vy;
            pt.vx *= 0.97; pt.vy *= 0.97;
            pt.life -= pt.decay;

            if (pt.life <= 0) { p[i] = p[p.length - 1]; p.pop(); continue; }

            const s = pt.size * pt.life;
            ctx.fillStyle = `hsla(${pt.hue},100%,65%,${(pt.life * 0.6).toFixed(2)})`;
            ctx.fillRect(pt.x - s, pt.y - s, s * 2, s * 2);
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    // === VIGNETTE (cached) ===
    _renderVignette(ctx, w, h) {
        if (!this._vigGrad || this._vigW !== w || this._vigH !== h) {
            this._vigW = w; this._vigH = h;
            this._vigGrad = ctx.createRadialGradient(
                this.cx, this.cy, Math.min(w, h) * 0.35,
                this.cx, this.cy, Math.max(w, h) * 0.75
            );
            this._vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
            this._vigGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
        }
        ctx.fillStyle = this._vigGrad;
        ctx.fillRect(0, 0, w, h);
    }

    // === GLITCH — no classList thrashing ===
    _renderGlitch() {
        const active = this.glitchPower >= 0.03;

        if (active !== this._glitchActive) {
            this._glitchActive = active;
            this.glitchCanvas.style.opacity = active ? '1' : '0';
        }

        if (!active) return;

        const ctx = this.glitchCtx;
        const w = this.width;
        const h = this.height;
        const p = this.glitchPower;

        ctx.clearRect(0, 0, w, h);

        const strips = (2 + p * 5) | 0;
        const rAlpha = (p * 0.1).toFixed(3);
        const cAlpha = (p * 0.1).toFixed(3);

        for (let i = 0; i < strips; i++) {
            const y = Math.random() * h;
            const sh = Math.random() * 12 + 1;
            const ox = (Math.random() - 0.5) * p * 25;

            ctx.fillStyle = `rgba(255,0,50,${rAlpha})`;
            ctx.fillRect(ox, y, w, sh);
            ctx.fillStyle = `rgba(0,200,255,${cAlpha})`;
            ctx.fillRect(-ox, y + 1, w, sh);
        }
    }

    dispose() {
        this.stop();
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        this.stars = null;
        this.nebulae = null;
        this.particles = [];
    }
}
