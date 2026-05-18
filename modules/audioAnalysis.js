/**
 * AudioAnalysis Module — Advanced real-time audio feature extraction
 * 
 * Designed specifically for kick drum analysis (170 BPM, continuous modulation):
 * - Logarithmic frequency bands focused on sub-bass/bass range
 * - Per-band envelope followers with configurable attack/release
 * - Spectral flux onset detection (kick transient detection)
 * - Spectral centroid tracking
 * - Peak hold with decay
 * - Energy history for beat pattern detection
 */

export class AudioAnalysis {
    constructor() {
        // Envelope followers per band — attack/release in seconds
        this.envelopes = {};
        this.peaks = {};
        
        // Spectral flux for onset detection
        this.prevSpectrum = null;
        this.fluxHistory = new Float32Array(8);
        this.fluxIndex = 0;
        this.fluxThreshold = 0;
        
        // Onset state
        this.onsetDetected = false;
        this.onsetStrength = 0;
        this.lastOnsetTime = 0;
        this.onsetCooldown = 0.12; // seconds — prevents double triggers at 170 BPM (~0.353s between beats)
        
        // Energy history (for beat pattern / overall dynamics)
        this.energyHistory = new Float32Array(64);
        this.energyIndex = 0;
        
        // Band definitions — logarithmic, focused on kick range
        // Kick drum fundamental: ~40-80Hz, harmonics up to ~5kHz
        // Body: 80-200Hz, Click/attack: 2-5kHz, Air: 8-16kHz
        this.bandDefs = [
            { name: 'subLow',    lo: 20,   hi: 40,   attack: 0.005, release: 0.08  },  // Sub rumble
            { name: 'subBass',   lo: 40,   hi: 80,   attack: 0.005, release: 0.06  },  // Kick fundamental
            { name: 'bass',      lo: 80,   hi: 160,  attack: 0.008, release: 0.08  },  // Kick body
            { name: 'lowMid',    lo: 160,  hi: 350,  attack: 0.010, release: 0.10  },  // Punch
            { name: 'mid',       lo: 350,  hi: 1000, attack: 0.012, release: 0.12  },  // Tone
            { name: 'highMid',   lo: 1000, hi: 3000, attack: 0.008, release: 0.15  },  // Presence
            { name: 'click',     lo: 3000, hi: 6000, attack: 0.003, release: 0.10  },  // Kick click/attack
            { name: 'air',       lo: 6000, hi: 16000,attack: 0.005, release: 0.20  },  // Air/noise
        ];
        
        // Initialize envelopes and peaks
        for (const band of this.bandDefs) {
            this.envelopes[band.name] = 0;
            this.peaks[band.name] = 0;
        }
        
        // Combined metrics (enveloped)
        this.rmsEnvelope = 0;
        this.spectralCentroid = 0;
        
        // Output cache
        this.output = {
            bands: {},
            peaks: {},
            rms: 0,
            rmsEnvelope: 0,
            dominantFreq: 0,
            spectralCentroid: 0,
            onset: false,
            onsetStrength: 0,
            energy: 0,
            avgEnergy: 0,
            waveform: null,
            frequency: null,
            binCount: 0
        };
    }

    /**
     * Process a frame of audio data from the engine's AnalyserNodes
     * @param {AnalyserNode} freqAnalyser - Frequency domain analyser
     * @param {AnalyserNode} waveAnalyser - Time domain analyser  
     * @param {AudioContext} ctx - Audio context for sample rate
     * @param {number} dt - Delta time in seconds
     * @returns {Object} Processed audio features
     */
    process(freqAnalyser, waveAnalyser, ctx, dt) {
        const sampleRate = ctx.sampleRate;
        const binCount = freqAnalyser.frequencyBinCount;
        const nyquist = sampleRate / 2;
        
        // Reuse or allocate buffers
        if (!this._freqBuf || this._freqBuf.length !== binCount) {
            this._freqBuf = new Uint8Array(binCount);
            this._freqFloat = new Float32Array(binCount);
        }
        if (!this._waveBuf || this._waveBuf.length !== waveAnalyser.fftSize) {
            this._waveBuf = new Uint8Array(waveAnalyser.fftSize);
        }
        
        // Read raw data
        freqAnalyser.getByteFrequencyData(this._freqBuf);
        waveAnalyser.getByteTimeDomainData(this._waveBuf);
        
        // Convert frequency data to float [0,1]
        for (let i = 0; i < binCount; i++) {
            this._freqFloat[i] = this._freqBuf[i] / 255;
        }
        
        // --- Band energy extraction with envelope followers ---
        for (const band of this.bandDefs) {
            const loIdx = Math.max(0, Math.floor(band.lo / nyquist * binCount));
            const hiIdx = Math.min(binCount - 1, Math.floor(band.hi / nyquist * binCount));
            
            // Compute band energy (mean of bins in range)
            let sum = 0;
            let count = 0;
            for (let i = loIdx; i <= hiIdx; i++) {
                sum += this._freqFloat[i];
                count++;
            }
            const raw = count > 0 ? sum / count : 0;
            
            // Envelope follower: fast attack, slow release
            const current = this.envelopes[band.name];
            if (raw > current) {
                // Attack — fast rise
                this.envelopes[band.name] = current + (raw - current) * Math.min(1, dt / band.attack);
            } else {
                // Release — slow decay
                this.envelopes[band.name] = current + (raw - current) * Math.min(1, dt / band.release);
            }
            
            // Peak hold with decay
            if (raw > this.peaks[band.name]) {
                this.peaks[band.name] = raw;
            } else {
                this.peaks[band.name] *= (1 - dt * 2); // Decay peak
            }
            
            this.output.bands[band.name] = this.envelopes[band.name];
            this.output.peaks[band.name] = this.peaks[band.name];
        }
        
        // --- RMS ---
        let rmsSum = 0;
        const waveLen = this._waveBuf.length;
        for (let i = 0; i < waveLen; i++) {
            const v = (this._waveBuf[i] - 128) / 128;
            rmsSum += v * v;
        }
        const rmsRaw = Math.sqrt(rmsSum / waveLen);
        
        // RMS envelope
        if (rmsRaw > this.rmsEnvelope) {
            this.rmsEnvelope += (rmsRaw - this.rmsEnvelope) * Math.min(1, dt / 0.005);
        } else {
            this.rmsEnvelope += (rmsRaw - this.rmsEnvelope) * Math.min(1, dt / 0.08);
        }
        
        this.output.rms = rmsRaw;
        this.output.rmsEnvelope = this.rmsEnvelope;
        
        // --- Spectral centroid (only low-mid range — no point scanning highs for a kick) ---
        let weightedSum = 0;
        let totalEnergy = 0;
        const centroidLimit = Math.min(binCount, 256);
        for (let i = 0; i < centroidLimit; i++) {
            const freq = (i / binCount) * nyquist;
            weightedSum += freq * this._freqFloat[i];
            totalEnergy += this._freqFloat[i];
        }
        this.spectralCentroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;
        this.output.spectralCentroid = this.spectralCentroid;
        
        // --- Dominant frequency ---
        let maxVal = 0;
        let maxIdx = 0;
        for (let i = 1; i < binCount; i++) {
            if (this._freqFloat[i] > maxVal) {
                maxVal = this._freqFloat[i];
                maxIdx = i;
            }
        }
        this.output.dominantFreq = Math.round(maxIdx * nyquist / binCount);
        
        // --- Spectral flux onset detection ---
        this.detectOnset(dt);
        
        // --- Energy history ---
        const totalE = this.output.bands.subBass + this.output.bands.bass + this.output.bands.subLow;
        this.energyHistory[this.energyIndex] = totalE;
        this.energyIndex = (this.energyIndex + 1) % this.energyHistory.length;
        
        let avgE = 0;
        for (let i = 0; i < this.energyHistory.length; i++) avgE += this.energyHistory[i];
        avgE /= this.energyHistory.length;
        
        this.output.energy = totalE;
        this.output.avgEnergy = avgE;
        this.output.waveform = this._waveBuf;
        this.output.frequency = this._freqBuf;
        this.output.binCount = binCount;
        
        return this.output;
    }

    /**
     * Spectral flux based onset detection
     * Compares current spectrum to previous — large positive change = onset
     */
    detectOnset(dt) {
        const spec = this._freqFloat;
        const len = Math.min(spec.length, 128); // Only look at low-mid range for kick
        
        if (!this.prevSpectrum) {
            this.prevSpectrum = new Float32Array(len);
            this.prevSpectrum.set(spec.subarray(0, len));
            this.output.onset = false;
            this.output.onsetStrength = 0;
            return;
        }
        
        // Compute half-wave rectified spectral flux
        let flux = 0;
        for (let i = 0; i < len; i++) {
            const diff = spec[i] - this.prevSpectrum[i];
            if (diff > 0) flux += diff;
        }
        flux /= len;
        
        // Update flux history for adaptive threshold
        this.fluxHistory[this.fluxIndex] = flux;
        this.fluxIndex = (this.fluxIndex + 1) % this.fluxHistory.length;
        
        let avgFlux = 0;
        for (let i = 0; i < this.fluxHistory.length; i++) avgFlux += this.fluxHistory[i];
        avgFlux /= this.fluxHistory.length;
        
        this.fluxThreshold = avgFlux * 1.8 + 0.02;
        
        // Check for onset
        const now = performance.now() / 1000;
        const timeSinceLastOnset = now - this.lastOnsetTime;
        
        if (flux > this.fluxThreshold && timeSinceLastOnset > this.onsetCooldown) {
            this.onsetDetected = true;
            this.onsetStrength = Math.min(1, flux / (this.fluxThreshold + 0.01));
            this.lastOnsetTime = now;
        } else {
            this.onsetDetected = false;
            this.onsetStrength *= (1 - dt * 8);
        }
        
        this.output.onset = this.onsetDetected;
        this.output.onsetStrength = this.onsetStrength;
        
        // Store current spectrum for next frame
        this.prevSpectrum.set(spec.subarray(0, len));
    }
    
    dispose() {
        this.prevSpectrum = null;
        this._freqBuf = null;
        this._freqFloat = null;
        this._waveBuf = null;
    }
}
