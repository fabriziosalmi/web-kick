/**
 * AudioEffects Module
 * Gestisce tutti gli effetti audio applicati al segnale
 * Include filtri, distorsione, delay, compressione e modulazioni
 */

export class AudioEffects {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.effectsChain = [];
        this.modulationIntervals = [];
        // Pre-allocate distortion curve buffer (reused)
        this._curveSamples = 4096;
        this._curveBuffer = new Float32Array(this._curveSamples);
    }

    /**
     * Crea e configura la catena completa di effetti audio
     * @param {MediaElementAudioSourceNode} source - Il source audio da processare
     * @returns {AudioNode} - L'ultimo nodo della catena di effetti
     */
    createEffectsChain(source) {
        // Crea tutti gli effetti in sequenza
        const lowPassFilter = this.createDynamicLowPassFilter();
        const distortion = this.createDynamicDistortion();
        const lowShelfEQ = this.createModulatedLowShelfEQ();
        const delay = this.createRandomDelay();
        const compressor = this.createCompressor();

        // Collega la catena di effetti in serie
        source.connect(lowPassFilter);
        lowPassFilter.connect(distortion);
        distortion.connect(lowShelfEQ);
        lowShelfEQ.connect(delay);
        delay.connect(compressor);

        // Salva i riferimenti per eventuali controlli futuri
        this.effectsChain = {
            lowPassFilter,
            distortion,
            lowShelfEQ,
            delay,
            compressor
        };

        return compressor; // Restituisce l'ultimo nodo per collegarlo alla destinazione
    }

    /**
     * Crea un filtro passa-basso con modulazione dinamica randomica
     * Varia frequenza di taglio e Q factor ogni secondo per creare movimento nel suono
     * @returns {BiquadFilterNode}
     */
    createDynamicLowPassFilter() {
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        
        // Impostazioni iniziali del filtro
        filter.frequency.setValueAtTime(5000, this.audioContext.currentTime); // Frequenza di taglio a 5kHz
        filter.Q.setValueAtTime(1, this.audioContext.currentTime); // Q factor moderato
        
        // Modulazione randomica della frequenza e Q ogni secondo
        const modulationInterval = setInterval(() => {
            // Frequenza random tra 500Hz e 5.5kHz per variare il carattere del suono
            const randomFreq = Math.random() * 5000 + 500;
            filter.frequency.setValueAtTime(randomFreq, this.audioContext.currentTime);
            
            // Q factor random tra 0 e 10 per variare la risonanza
            const randomQ = Math.random() * 10;
            filter.Q.setValueAtTime(randomQ, this.audioContext.currentTime);
        }, 1000);
        
        this.modulationIntervals.push(modulationInterval);
        return filter;
    }

    /**
     * Crea un effetto di distorsione waveshaper con curva dinamica
     * La curva di distorsione cambia randomicamente per variare l'intensità dell'effetto
     * @returns {WaveShaperNode}
     */
    createDynamicDistortion() {
        const distortion = this.audioContext.createWaveShaper();
        
        // Configurazione iniziale della distorsione
        distortion.curve = this.makeDistortionCurve(400); // Distorsione moderata iniziale
        distortion.oversample = '4x'; // Oversampling 4x per ridurre aliasing
        
        // Modulazione dinamica della curva di distorsione
        const modulationInterval = setInterval(() => {
            // Amount random tra 0 e 1000 per variare l'intensità della distorsione
            const randomAmount = Math.random() * 1000;
            distortion.curve = this.makeDistortionCurve(randomAmount);
        }, 1000);
        
        this.modulationIntervals.push(modulationInterval);
        return distortion;
    }

    /**
     * Crea un equalizzatore low-shelf con modulazione LFO
     * Un oscillatore a bassa frequenza modula il gain per creare movimento
     * @returns {BiquadFilterNode}
     */
    createModulatedLowShelfEQ() {
        const lowShelfEQ = this.audioContext.createBiquadFilter();
        lowShelfEQ.type = 'lowshelf';
        lowShelfEQ.frequency.setValueAtTime(250, this.audioContext.currentTime); // Frequenza di shelf a 250Hz
        
        // Crea un LFO (Low Frequency Oscillator) per modulare il gain
        const lfo = this.audioContext.createOscillator();
        lfo.type = 'sine'; // Forma d'onda sinusoidale per modulazione smooth
        lfo.frequency.setValueAtTime(1, this.audioContext.currentTime); // 1Hz = un ciclo al secondo
        
        // Gain node per controllare l'intensità della modulazione
        const lfoGain = this.audioContext.createGain();
        lfoGain.gain.setValueAtTime(5, this.audioContext.currentTime); // Ampiezza di modulazione ±5dB
        
        // Collega LFO → Gain → EQ Gain per creare la modulazione
        lfo.connect(lfoGain);
        lfoGain.connect(lowShelfEQ.gain);
        lfo.start(); // Avvia l'oscillatore
        
        return lowShelfEQ;
    }

    /**
     * Crea un delay con feedback randomico
     * Tempo di delay e feedback variano per creare texture sonore interessanti
     * @returns {DelayNode}
     */
    createRandomDelay() {
        const delay = this.audioContext.createDelay();
        const feedback = this.audioContext.createGain();
        
        // Configurazione iniziale del delay
        delay.delayTime.setValueAtTime(Math.random() * 0.005, this.audioContext.currentTime); // Delay molto breve (0-5ms)
        feedback.gain.setValueAtTime(Math.random() * 0.5, this.audioContext.currentTime); // Feedback moderato
        
        // Crea il loop di feedback: delay → feedback → delay
        delay.connect(feedback);
        feedback.connect(delay);
        
        return delay;
    }

    /**
     * Crea un compressore dinamico per controllare la dinamica del segnale
     * Essenziale per mantenere un livello consistente e punch nel suono
     * @returns {DynamicsCompressorNode}
     */
    createCompressor() {
        const compressor = this.audioContext.createDynamicsCompressor();
        
        // Configurazione del compressore per un suono punch e consistente
        compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime); // Soglia a -24dB
        compressor.knee.setValueAtTime(30, this.audioContext.currentTime); // Knee morbido di 30dB
        compressor.ratio.setValueAtTime(12, this.audioContext.currentTime); // Ratio alto per compressione intensa
        compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime); // Attack veloce (3ms)
        compressor.release.setValueAtTime(0.25, this.audioContext.currentTime); // Release medio (250ms)
        
        return compressor;
    }

    /**
     * Genera una curva di distorsione custom per il WaveShaperNode
     * Utilizza una formula matematica per creare distorsione armonica
     * @param {number} amount - Intensità della distorsione (0-1000+)
     * @returns {Float32Array} - Array contenente la curva di distorsione
     */
    makeDistortionCurve(amount) {
        const k = amount;
        const n = this._curveSamples;
        const curve = this._curveBuffer;
        const deg = Math.PI / 180;
        const inv = 2 / n;
        
        for (let i = 0; i < n; i++) {
            const x = i * inv - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * (x < 0 ? -x : x));
        }
        
        return curve;
    }

    /**
     * Pulisce tutti gli intervalli di modulazione per evitare memory leaks
     */
    dispose() {
        // Ferma tutti gli intervalli di modulazione
        this.modulationIntervals.forEach(interval => {
            clearInterval(interval);
        });
        this.modulationIntervals = [];
        
        // Pulisce i riferimenti agli effetti
        this.effectsChain = [];
    }

    /**
     * Ottiene un riferimento specifico a un effetto della catena
     * @param {string} effectName - Nome dell'effetto da ottenere
     * @returns {AudioNode|null}
     */
    getEffect(effectName) {
        return this.effectsChain[effectName] || null;
    }
}
