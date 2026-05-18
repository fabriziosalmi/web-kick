/**
 * UIManager Module
 * Gestisce tutta l'interazione con l'interfaccia utente
 * Responsabile degli eventi del pulsante, stato visuale e feedback utente
 */

export class UIManager {
    constructor() {
        this.playButton = null;
        this.isPlaying = false;
        this.onPlayCallback = null;
        this.onPauseCallback = null;
        
        // HUD elements
        this.hudFreq = null;
        this.hudBpm = null;
        this.hudRms = null;
        this.spectrumBar = null;
        this.hudTop = null;
        this.hudBottom = null;
        this.startScreen = null;
    }

    /**
     * Inizializza il gestore dell'interfaccia utente
     * Collega gli eventi del pulsante e imposta lo stato iniziale
     * @param {HTMLElement} playButton - L'elemento pulsante play/pause
     */
    initialize(playButton) {
        this.playButton = playButton;
        
        // HUD refs
        this.hudFreq = document.getElementById('hud-freq');
        this.hudBpm = document.getElementById('hud-bpm');
        this.hudRms = document.getElementById('hud-rms');
        this.spectrumBar = document.getElementById('spectrumBar');
        this.hudTop = document.getElementById('hud-top');
        this.hudBottom = document.getElementById('hud-bottom');
        this.startScreen = document.getElementById('startScreen');
        
        this.setupEventListeners();
    }

    /**
     * Configura tutti gli event listeners per l'interfaccia
     * Gestisce click del pulsante e accessibilità keyboard
     */
    setupEventListeners() {
        if (!this.playButton) {
            console.error('PlayButton non trovato durante l\'inizializzazione UI');
            return;
        }

        // Event listener per il click del pulsante
        this.playButton.addEventListener('click', (event) => {
            event.preventDefault();
            this.togglePlayPause();
        });

        // Event listener per accessibilità keyboard (Enter e Spacebar)
        this.playButton.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.togglePlayPause();
            }
        });
        
        // Global spacebar toggle (when not focused on button)
        document.addEventListener('keydown', (event) => {
            if (event.key === ' ' && event.target === document.body) {
                event.preventDefault();
                this.togglePlayPause();
            }
        });
    }

    /**
     * Gestisce il toggle tra play e pause
     * Chiama i callback appropriati e aggiorna lo stato visuale
     */
    async togglePlayPause() {
        try {
            if (this.isPlaying) {
                await this.pause();
            } else {
                await this.play();
            }
        } catch (error) {
            console.error('Errore durante il toggle play/pause:', error);
            this.showError('Errore nella riproduzione audio');
        }
    }

    /**
     * Avvia la riproduzione
     */
    async play() {
        if (this.onPlayCallback) {
            await this.onPlayCallback();
        }

        this.isPlaying = true;
        this.updateVisualState();
        console.log('Riproduzione avviata');
    }

    /**
     * Mette in pausa la riproduzione
     */
    async pause() {
        if (this.onPauseCallback) {
            await this.onPauseCallback();
        }

        this.isPlaying = false;
        this.updateVisualState();
        console.log('Riproduzione messa in pausa');
    }

    /**
     * Update all visual states based on play/pause
     */
    updateVisualState() {
        if (!this.playButton) return;

        if (this.isPlaying) {
            this.playButton.classList.add('playing');
            this.playButton.setAttribute('aria-label', 'Pause');
            
            // Hide start screen, show HUD
            if (this.startScreen) this.startScreen.classList.add('hidden');
            if (this.hudTop) this.hudTop.classList.add('visible');
            if (this.hudBottom) this.hudBottom.classList.add('visible');
        } else {
            this.playButton.classList.remove('playing');
            this.playButton.setAttribute('aria-label', 'Play');
            
            // Show start screen, hide HUD
            if (this.startScreen) this.startScreen.classList.remove('hidden');
            if (this.hudTop) this.hudTop.classList.remove('visible');
            if (this.hudBottom) this.hudBottom.classList.remove('visible');
        }
    }

    /**
     * Update HUD with real-time audio data
     */
    updateHUD(audioData) {
        if (!audioData) return;
        
        if (this.hudFreq) {
            this.hudFreq.textContent = audioData.dominantFreq + ' Hz';
        }
        if (this.hudRms) {
            this.hudRms.textContent = audioData.rms.toFixed(3);
        }
        if (this.spectrumBar) {
            this.spectrumBar.style.transform = `scaleX(${Math.min(1, audioData.rms * 3)})`;
        }
    }

    /**
     * Imposta il callback da chiamare quando si avvia la riproduzione
     * @param {Function} callback - Funzione da chiamare al play
     */
    setOnPlayCallback(callback) {
        this.onPlayCallback = callback;
    }

    /**
     * Imposta il callback da chiamare quando si mette in pausa
     * @param {Function} callback - Funzione da chiamare al pause
     */
    setOnPauseCallback(callback) {
        this.onPauseCallback = callback;
    }

    /**
     * Mostra un messaggio di errore all'utente
     * @param {string} message - Messaggio di errore da mostrare
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 34, 68, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 1000;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 34, 68, 0.3);
            box-shadow: 0 4px 20px rgba(255, 34, 68, 0.3);
        `;

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    /**
     * Forza un aggiornamento dello stato del pulsante
     * @param {boolean} playing - Stato di riproduzione da impostare
     */
    setPlayingState(playing) {
        this.isPlaying = playing;
        this.updateVisualState();
    }

    /**
     * Ottiene lo stato corrente di riproduzione
     * @returns {boolean}
     */
    getPlayingState() {
        return this.isPlaying;
    }

    /**
     * Abilita o disabilita il pulsante
     * @param {boolean} enabled
     */
    setButtonEnabled(enabled) {
        if (!this.playButton) return;

        this.playButton.disabled = !enabled;
        this.playButton.style.opacity = enabled ? '1' : '0.5';
        this.playButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    /**
     * Pulisce tutti gli event listeners e riferimenti
     */
    dispose() {
        if (this.playButton) {
            const newButton = this.playButton.cloneNode(true);
            this.playButton.parentNode.replaceChild(newButton, this.playButton);
        }

        this.playButton = null;
        this.onPlayCallback = null;
        this.onPauseCallback = null;
        this.isPlaying = false;
    }
}
