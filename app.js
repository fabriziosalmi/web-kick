/**
 * MadKick — Procedural VFX Audiovisual Experience v3
 * 
 * PERF FIX: Single rAF loop. Audio analysis runs inside renderer callback.
 */

import { AudioEngine } from './modules/audioEngine.js';
import { AudioEffects } from './modules/audioEffects.js';
import { AudioAnalysis } from './modules/audioAnalysis.js';
import { VFXRenderer } from './modules/vfxRenderer.js';
import { UIManager } from './modules/uiManager.js';

class MadKickApp {
    constructor() {
        this.audioEngine = new AudioEngine();
        this.audioEffects = null;
        this.audioAnalysis = new AudioAnalysis();
        this.vfxRenderer = new VFXRenderer();
        this.uiManager = new UIManager();
        
        this.isInitialized = false;
        this.isAudioReady = false;
        this.isPlaying = false;
        this.playButton = null;
        this.audioPlayer = null;
        this.hudCounter = 0;
    }

    async initialize() {
        try {
            this.playButton = document.getElementById('playButton');
            this.audioPlayer = document.getElementById('audioPlayer');
            if (!this.playButton || !this.audioPlayer) throw new Error('DOM missing');

            const vfxCanvas = document.getElementById('vfxCanvas');
            const glitchCanvas = document.getElementById('glitchCanvas');
            this.vfxRenderer.initialize(vfxCanvas, glitchCanvas);
            
            // Single callback — audio analysis runs inside renderer loop
            this.vfxRenderer.onFrame = (dt) => this._onFrame(dt);
            this.vfxRenderer.start();

            this.uiManager.initialize(this.playButton);
            this.uiManager.setOnPlayCallback(() => this.handlePlay());
            this.uiManager.setOnPauseCallback(() => this.handlePause());
            this.setupAudioEventListeners();
            
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
        
        this.hudCounter++;
        if (this.hudCounter >= 10) {
            this.uiManager.updateHUD(data);
            this.hudCounter = 0;
        }
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
