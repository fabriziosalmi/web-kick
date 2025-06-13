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
    }

    /**
     * Inizializza il gestore dell'interfaccia utente
     * Collega gli eventi del pulsante e imposta lo stato iniziale
     * @param {HTMLElement} playButton - L'elemento pulsante play/pause
     */
    initialize(playButton) {
        this.playButton = playButton;
        this.setupEventListeners();
        this.updateButtonState();
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

        // Event listener per hover effects (opzionale per migliorare UX)
        this.playButton.addEventListener('mouseenter', () => {
            this.playButton.style.transform = 'scale(1.05)';
        });

        this.playButton.addEventListener('mouseleave', () => {
            this.playButton.style.transform = 'scale(1)';
        });
    }

    /**
     * Gestisce il toggle tra play e pause
     * Chiama i callback appropriati e aggiorna lo stato visuale
     */
    async togglePlayPause() {
        try {
            if (this.isPlaying) {
                // Passa da playing a paused
                await this.pause();
            } else {
                // Passa da paused a playing
                await this.play();
            }
        } catch (error) {
            console.error('Errore durante il toggle play/pause:', error);
            this.showError('Errore nella riproduzione audio');
        }
    }

    /**
     * Avvia la riproduzione
     * Aggiorna lo stato e chiama il callback di play se definito
     */
    async play() {
        // Chiama il callback di play se definito
        if (this.onPlayCallback) {
            await this.onPlayCallback();
        }

        // Aggiorna lo stato interno e visuale
        this.isPlaying = true;
        this.updateButtonState();
        
        console.log('Riproduzione avviata');
    }

    /**
     * Mette in pausa la riproduzione
     * Aggiorna lo stato e chiama il callback di pause se definito
     */
    async pause() {
        // Chiama il callback di pause se definito
        if (this.onPauseCallback) {
            await this.onPauseCallback();
        }

        // Aggiorna lo stato interno e visuale
        this.isPlaying = false;
        this.updateButtonState();
        
        console.log('Riproduzione messa in pausa');
    }

    /**
     * Aggiorna lo stato visuale del pulsante in base allo stato di riproduzione
     * Gestisce le classi CSS e gli attributi di accessibilità
     */
    updateButtonState() {
        if (!this.playButton) return;

        if (this.isPlaying) {
            // Stato playing: pulsante attivo con indicatore visuale
            this.playButton.classList.add('playing');
            this.playButton.classList.remove('paused');
            this.playButton.setAttribute('aria-label', 'Pause');
            this.playButton.setAttribute('title', 'Clicca per mettere in pausa');
        } else {
            // Stato paused: pulsante inattivo
            this.playButton.classList.remove('playing');
            this.playButton.classList.add('paused');
            this.playButton.setAttribute('aria-label', 'Play');
            this.playButton.setAttribute('title', 'Clicca per avviare la riproduzione');
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
        // Crea un elemento di notifica per l'errore
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #ff4444;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(errorDiv);

        // Rimuove la notifica dopo 3 secondi
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 3000);
    }

    /**
     * Forza un aggiornamento dello stato del pulsante
     * Utile per sincronizzare l'UI con stati esterni
     * @param {boolean} playing - Stato di riproduzione da impostare
     */
    setPlayingState(playing) {
        this.isPlaying = playing;
        this.updateButtonState();
    }

    /**
     * Ottiene lo stato corrente di riproduzione
     * @returns {boolean} - True se in riproduzione, false se in pausa
     */
    getPlayingState() {
        return this.isPlaying;
    }

    /**
     * Abilita o disabilita il pulsante
     * @param {boolean} enabled - True per abilitare, false per disabilitare
     */
    setButtonEnabled(enabled) {
        if (!this.playButton) return;

        this.playButton.disabled = !enabled;
        this.playButton.style.opacity = enabled ? '1' : '0.5';
        this.playButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    /**
     * Pulisce tutti gli event listeners e riferimenti
     * Importante per evitare memory leaks
     */
    dispose() {
        if (this.playButton) {
            // Rimuove tutti gli event listeners clonando il nodo
            const newButton = this.playButton.cloneNode(true);
            this.playButton.parentNode.replaceChild(newButton, this.playButton);
        }

        this.playButton = null;
        this.onPlayCallback = null;
        this.onPauseCallback = null;
        this.isPlaying = false;
    }
}
