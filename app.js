/**
 * MadKick — Procedural VFX Audiovisual Experience v3
 * 
 * PERF FIX: Single rAF loop. Audio analysis runs inside renderer callback.
 */

import { AudioEngine } from './modules/audioEngine.js';
import { AudioEffects } from './modules/audioEffects.js';
import { AudioAnalysis } from './modules/audioAnalysis.js';
import { VFXRenderer } from './modules/vfxRenderer.js';
import { GLRenderer } from './modules/glRenderer.js';
import { UIManager } from './modules/uiManager.js';

// Beat-synced brutalist typography — flashed on kick onset
const BEAT_WORDS = ['KICK', '170', 'RAVE', 'MADKICK', 'BASS', 'DROP', 'SUB', 'PSHH', 'BOOM', '///'];

class MadKickApp {
    constructor() {
        this.audioEngine = new AudioEngine();
        this.audioEffects = null;
        this.audioAnalysis = new AudioAnalysis();
        this.vfxRenderer = null;       // resolved in initialize() — GL or 2D fallback
        this.usingGL = false;
        this.uiManager = new UIManager();

        this.isInitialized = false;
        this.isAudioReady = false;
        this.isPlaying = false;
        this.playButton = null;
        this.audioPlayer = null;
        this.hudCounter = 0;

        // Beat typography
        this.beatType = null;
        this.beatWordIdx = 0;
        this.beatClearTimer = null;
    }

    async initialize() {
        try {
            this.playButton = document.getElementById('playButton');
            this.audioPlayer = document.getElementById('audioPlayer');
            if (!this.playButton || !this.audioPlayer) throw new Error('DOM missing');

            const vfxCanvas = document.getElementById('vfxCanvas');
            const glitchCanvas = document.getElementById('glitchCanvas');
            this.beatType = document.getElementById('beatType');

            // Prefer the WebGL2 fragment-shader engine; fall back to Canvas 2D.
            const gl = new GLRenderer();
            if (gl.initialize(vfxCanvas) && gl.isSupported()) {
                this.vfxRenderer = gl;
                this.usingGL = true;
                if (glitchCanvas) glitchCanvas.style.display = 'none'; // GL handles glitch internally
            } else {
                gl.dispose();
                this.vfxRenderer = new VFXRenderer();
                this.vfxRenderer.initialize(vfxCanvas, glitchCanvas);
            }

            // Single callback — audio analysis runs inside renderer loop
            this.vfxRenderer.onFrame = (dt) => this._onFrame(dt);
            this.vfxRenderer.start();

            this.uiManager.initialize(this.playButton);
            this.uiManager.setOnPlayCallback(() => this.handlePlay());
            this.uiManager.setOnPauseCallback(() => this.handlePause());
            this.setupAudioEventListeners();
            if (this.usingGL) this.setupVJControls();

            this.isInitialized = true;
        } catch (error) {
            console.error('Init error:', error);
            if (this.uiManager?.showError) this.uiManager.showError('Init error. Reload.');
        }
    }

    async handlePlay() {
        if (!this.isAudioReady) await this.initializeAudioSystem();
        await this.audioEngine.play();
        this.isPlaying = true;
        if (this.usingGL && !this._legendShown) {
            this._legendShown = true;
            this._showVJStatus('VJ · 1 TUNNEL · 2 ACID · 3 MOSH · 4 LASER · 5 STROBE · P/0 PALETTE');
        }
    }

    async handlePause() {
        this.audioEngine.pause();
        this.isPlaying = false;
    }

    async initializeAudioSystem() {
        this.uiManager.setButtonEnabled(false);
        try {
            await this.audioEngine.initialize(this.audioPlayer);
            
            this.audioEffects = new AudioEffects(this.audioEngine.getContext());
            const effectsOut = this.audioEffects.createEffectsChain(this.audioEngine.getSource());
            
            const ctx = this.audioEngine.getContext();
            const analysers = this.audioEngine.getAnalysers();
            effectsOut.connect(analysers.frequency);
            effectsOut.connect(analysers.waveform);
            analysers.frequency.connect(ctx.destination);
            
            this.isAudioReady = true;
        } catch (error) {
            console.error('Audio init error:', error);
            throw error;
        } finally {
            this.uiManager.setButtonEnabled(true);
        }
    }

    /** Called by renderer every frame — no separate rAF */
    _onFrame(dt) {
        if (!this.isPlaying || !this.isAudioReady) return;
        
        const data = this.audioAnalysis.process(
            this.audioEngine.getAnalysers().frequency,
            this.audioEngine.getAnalysers().waveform,
            this.audioEngine.getContext(),
            dt
        );
        
        this.vfxRenderer.updateAudioData(data);

        // Beat-synced typography — flash a word on strong kicks
        if (data.onset && data.onsetStrength > 0.45) this._flashBeatType(data.onsetStrength);

        this.hudCounter++;
        if (this.hudCounter >= 10) {
            this.uiManager.updateHUD(data);
            this.hudCounter = 0;
        }
    }

    // Live VJ keyboard controls (GL renderer only)
    setupVJControls() {
        this.vjStatus = document.getElementById('vjStatus');
        const r = this.vfxRenderer;
        const map = {
            '1': () => r.setMode(0),
            '2': () => r.setMode(1),
            '3': () => r.toggleDatamosh(),
            '4': () => r.toggleLaser(),
            '5': () => r.toggleStrobe(),
            'p': () => r.cyclePalette(),
            '0': () => r.togglePaletteAuto(),
        };
        this._vjKeyHandler = (e) => {
            const fn = map[e.key.toLowerCase()];
            if (!fn) return;
            e.preventDefault();
            this._showVJStatus(fn());
        };
        window.addEventListener('keydown', this._vjKeyHandler);
    }

    _showVJStatus(text) {
        const el = this.vjStatus;
        if (!el) return;
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(this._vjStatusTimer);
        this._vjStatusTimer = setTimeout(() => el.classList.remove('show'), 1400);
    }

    _flashBeatType(strength) {
        const el = this.beatType;
        if (!el) return;
        this.beatWordIdx = (this.beatWordIdx + 1) % BEAT_WORDS.length;
        el.textContent = BEAT_WORDS[this.beatWordIdx];
        // random slight offset + scale for kinetic feel
        const ox = (Math.random() - 0.5) * 8;
        const oy = (Math.random() - 0.5) * 8;
        const sc = 0.85 + strength * 0.5;
        el.style.setProperty('--bt-x', ox + 'vw');
        el.style.setProperty('--bt-y', oy + 'vh');
        el.style.setProperty('--bt-scale', sc);
        // restart the CSS animation
        el.classList.remove('flash');
        void el.offsetWidth; // force reflow
        el.classList.add('flash');
    }

    setupAudioEventListeners() {
        if (!this.audioPlayer) return;
        this.audioPlayer.addEventListener('play', () => this.uiManager.setPlayingState(true));
        this.audioPlayer.addEventListener('pause', () => { this.uiManager.setPlayingState(false); this.isPlaying = false; });
        this.audioPlayer.addEventListener('ended', () => { this.uiManager.setPlayingState(false); this.isPlaying = false; });
        this.audioPlayer.addEventListener('error', () => this.uiManager.showError('Audio load error'));
    }

    dispose() {
        if (this.audioEffects) this.audioEffects.dispose();
        if (this.audioEngine) this.audioEngine.dispose();
        if (this.audioAnalysis) this.audioAnalysis.dispose();
        if (this.vfxRenderer) this.vfxRenderer.dispose();
        if (this.uiManager) this.uiManager.dispose();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const app = new MadKickApp();
    try { await app.initialize(); } catch (e) { console.error('Fatal:', e); }
    window.addEventListener('beforeunload', () => app.dispose());
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.madKickApp = app;
});
