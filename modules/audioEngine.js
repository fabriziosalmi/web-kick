/**
 * AudioEngine Module
 * Gestisce l'inizializzazione e il controllo del contesto audio Web Audio API
 * Responsabile della creazione e gestione del source audio principale
 */

export class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.source = null;
        this.audioElement = null;
        this.isInitialized = false;
    }

    /**
     * Inizializza il contesto audio e crea il source dall'elemento audio HTML
     * @param {HTMLAudioElement} audioElement - L'elemento audio HTML
     * @returns {Promise<void>}
     */
    async initialize(audioElement) {
        try {
            // Crea il contesto audio con compatibilità cross-browser
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioElement = audioElement;
            
            // Crea il source dal media element per collegarlo alla catena di effetti
            this.source = this.audioContext.createMediaElementSource(audioElement);
            
            this.isInitialized = true;
            console.log('AudioEngine inizializzato con successo');
        } catch (error) {
            console.error('Errore nell\'inizializzazione dell\'AudioEngine:', error);
            throw error;
        }
    }

    /**
     * Riprende il contesto audio se è in stato sospeso (richiesto da alcuni browser)
     * @returns {Promise<void>}
     */
    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Avvia la riproduzione dell'audio
     * @returns {Promise<void>}
     */
    async play() {
        if (!this.isInitialized) {
            throw new Error('AudioEngine non inizializzato');
        }
        
        await this.resumeContext();
        await this.audioElement.play();
    }

    /**
     * Mette in pausa la riproduzione dell'audio
     */
    pause() {
        if (this.audioElement) {
            this.audioElement.pause();
        }
    }

    /**
     * Ottiene il contesto audio corrente
     * @returns {AudioContext|null}
     */
    getContext() {
        return this.audioContext;
    }

    /**
     * Ottiene il source audio per collegarlo agli effetti
     * @returns {MediaElementAudioSourceNode|null}
     */
    getSource() {
        return this.source;
    }

    /**
     * Verifica se l'engine è inizializzato
     * @returns {boolean}
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Pulisce le risorse e chiude il contesto audio
     */
    dispose() {
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.audioContext = null;
        this.source = null;
        this.audioElement = null;
        this.isInitialized = false;
    }
}
