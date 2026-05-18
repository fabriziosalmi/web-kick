/**
 * AudioEngine Module
 * Manages Web Audio API context, source, and dual AnalyserNodes
 * 
 * Provides raw audio nodes — analysis is handled by AudioAnalysis module.
 * AnalyserNode config optimized for low-latency kick drum response.
 */

export class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.source = null;
        this.audioElement = null;
        this.isInitialized = false;
        
        this.analyser = null;
        this.analyserWaveform = null;
        this.fftSize = 2048;
    }

    /**
     * Initialize audio context and create source from HTML audio element
     */
    async initialize(audioElement) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioElement = audioElement;
            
            this.source = this.audioContext.createMediaElementSource(audioElement);
            
            // Frequency analyser — low smoothing for fast transient response
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.4;
            this.analyser.minDecibels = -80;
            this.analyser.maxDecibels = -10;
            
            // Waveform analyser — even lower smoothing
            this.analyserWaveform = this.audioContext.createAnalyser();
            this.analyserWaveform.fftSize = this.fftSize;
            this.analyserWaveform.smoothingTimeConstant = 0.2;
            
            this.isInitialized = true;
            console.log('AudioEngine initialized');
        } catch (error) {
            console.error('AudioEngine init error:', error);
            throw error;
        }
    }

    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    async play() {
        if (!this.isInitialized) throw new Error('AudioEngine not initialized');
        await this.resumeContext();
        await this.audioElement.play();
    }

    pause() {
        if (this.audioElement) this.audioElement.pause();
    }

    getContext() { return this.audioContext; }
    getSource() { return this.source; }
    
    getAnalysers() {
        return {
            frequency: this.analyser,
            waveform: this.analyserWaveform
        };
    }

    isReady() { return this.isInitialized; }

    dispose() {
        if (this.audioContext) this.audioContext.close();
        this.audioContext = null;
        this.source = null;
        this.audioElement = null;
        this.analyser = null;
        this.analyserWaveform = null;
        this.isInitialized = false;
    }
}
