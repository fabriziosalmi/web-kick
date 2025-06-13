/**
 * MadKick Audio Player - Main Application
 * 
 * Applicazione web audio per la riproduzione di kick drum con effetti dinamici.
 * Utilizza Web Audio API per applicare effetti in tempo reale tra cui:
 * - Filtro passa-basso dinamico
 * - Distorsione waveshaper
 * - EQ low-shelf modulato
 * - Delay con feedback
 * - Compressore dinamico
 * 
 * Architettura modulare:
 * - AudioEngine: Gestione del contesto audio e source
 * - AudioEffects: Creazione e gestione degli effetti
 * - UIManager: Gestione dell'interfaccia utente
 */

import { AudioEngine } from './modules/audioEngine.js';
import { AudioEffects } from './modules/audioEffects.js';
import { UIManager } from './modules/uiManager.js';

/**
 * Classe principale dell'applicazione MadKick
 * Orchestrano la comunicazione tra i vari moduli
 */
class MadKickApp {
    constructor() {
        // Inizializza i moduli principali
        this.audioEngine = new AudioEngine();
        this.audioEffects = null; // Sarà inizializzato dopo il contesto audio
        this.uiManager = new UIManager();
        
        // Stato dell'applicazione
        this.isInitialized = false;
        this.isAudioReady = false;
        
        // Riferimenti agli elementi DOM
        this.playButton = null;
        this.audioPlayer = null;
    }

    /**
     * Inizializza l'applicazione
     * Configura tutti i moduli e collega gli event handlers
     */
    async initialize() {
        try {
            console.log('Inizializzazione MadKick App...');
            
            // Ottiene i riferimenti agli elementi DOM
            this.playButton = document.getElementById('playButton');
            this.audioPlayer = document.getElementById('audioPlayer');
            
            if (!this.playButton || !this.audioPlayer) {
                throw new Error('Elementi DOM richiesti non trovati');
            }

            // Inizializza il gestore dell'interfaccia utente
            this.uiManager.initialize(this.playButton);
            
            // Configura i callback dell'UI per gestire play/pause
            this.uiManager.setOnPlayCallback(() => this.handlePlay());
            this.uiManager.setOnPauseCallback(() => this.handlePause());
            
            // Aggiunge listener per eventi audio nativi per sincronizzazione
            this.setupAudioEventListeners();
            
            this.isInitialized = true;
            console.log('MadKick App inizializzata con successo');
            
        } catch (error) {
            console.error('Errore durante l\'inizializzazione:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Gestisce l'avvio della riproduzione audio
     * Inizializza il motore audio e gli effetti al primo play
     */
    async handlePlay() {
        try {
            // Inizializzazione lazy del motore audio (richiesta da user gesture)
            if (!this.isAudioReady) {
                await this.initializeAudioSystem();
            }
            
            // Avvia la riproduzione
            await this.audioEngine.play();
            
        } catch (error) {
            console.error('Errore durante la riproduzione:', error);
            throw error; // Rilancia per permettere al UI manager di gestire l'errore
        }
    }

    /**
     * Gestisce la pausa della riproduzione
     */
    async handlePause() {
        try {
            this.audioEngine.pause();
        } catch (error) {
            console.error('Errore durante la pausa:', error);
            throw error;
        }
    }

    /**
     * Inizializzazione lazy del sistema audio
     * Viene chiamata solo al primo play per rispettare le policy dei browser
     */
    async initializeAudioSystem() {
        console.log('Inizializzazione sistema audio...');
        
        // Disabilita temporaneamente il pulsante durante l'inizializzazione
        this.uiManager.setButtonEnabled(false);
        
        try {
            // Inizializza il motore audio
            await this.audioEngine.initialize(this.audioPlayer);
            
            // Crea il sistema di effetti
            this.audioEffects = new AudioEffects(this.audioEngine.getContext());
            
            // Crea la catena di effetti e collega alla destinazione
            const effectsOutput = this.audioEffects.createEffectsChain(this.audioEngine.getSource());
            effectsOutput.connect(this.audioEngine.getContext().destination);
            
            this.isAudioReady = true;
            console.log('Sistema audio inizializzato e effetti applicati');
            
        } catch (error) {
            console.error('Errore nell\'inizializzazione del sistema audio:', error);
            throw error;
        } finally {
            // Riabilita il pulsante
            this.uiManager.setButtonEnabled(true);
        }
    }

    /**
     * Configura i listener per gli eventi audio nativi
     * Mantiene sincronizzato lo stato UI con lo stato reale dell'audio
     */
    setupAudioEventListeners() {
        if (!this.audioPlayer) return;

        // Sincronizza UI quando l'audio viene avviato
        this.audioPlayer.addEventListener('play', () => {
            this.uiManager.setPlayingState(true);
        });

        // Sincronizza UI quando l'audio viene messo in pausa
        this.audioPlayer.addEventListener('pause', () => {
            this.uiManager.setPlayingState(false);
        });

        // Gestisce la fine naturale dell'audio (se non in loop)
        this.audioPlayer.addEventListener('ended', () => {
            this.uiManager.setPlayingState(false);
        });

        // Gestisce errori di caricamento dell'audio
        this.audioPlayer.addEventListener('error', (event) => {
            console.error('Errore nel caricamento audio:', event);
            this.uiManager.showError('Errore nel caricamento del file audio');
        });

        // Mostra quando l'audio è pronto per la riproduzione
        this.audioPlayer.addEventListener('canplaythrough', () => {
            console.log('File audio caricato e pronto per la riproduzione');
        });
    }

    /**
     * Gestisce gli errori di inizializzazione dell'applicazione
     * @param {Error} error - L'errore verificatosi
     */
    handleInitializationError(error) {
        console.error('Errore critico nell\'inizializzazione:', error);
        
        // Mostra un messaggio di errore all'utente
        const errorMessage = 'Errore nell\'inizializzazione dell\'applicazione. Ricarica la pagina.';
        
        // Crea un elemento di errore se l'UI manager non è disponibile
        if (this.uiManager && this.uiManager.showError) {
            this.uiManager.showError(errorMessage);
        } else {
            alert(errorMessage);
        }
    }

    /**
     * Pulizia delle risorse dell'applicazione
     * Importante per evitare memory leaks
     */
    dispose() {
        console.log('Pulizia risorse MadKick App...');
        
        // Pulisce i moduli
        if (this.audioEffects) {
            this.audioEffects.dispose();
        }
        
        if (this.audioEngine) {
            this.audioEngine.dispose();
        }
        
        if (this.uiManager) {
            this.uiManager.dispose();
        }
        
        // Reset dello stato
        this.isInitialized = false;
        this.isAudioReady = false;
        this.playButton = null;
        this.audioPlayer = null;
    }
}

/**
 * Punto di ingresso dell'applicazione
 * Inizializza l'app quando il DOM è completamente caricato
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM caricato, avvio MadKick App...');
    
    // Crea e inizializza l'applicazione
    const app = new MadKickApp();
    
    try {
        await app.initialize();
    } catch (error) {
        console.error('Errore fatale durante l\'avvio dell\'applicazione:', error);
    }
    
    // Pulizia delle risorse quando la pagina viene chiusa
    window.addEventListener('beforeunload', () => {
        app.dispose();
    });
    
    // Esporta l'istanza dell'app per debug (solo in development)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.madKickApp = app;
        console.log('App disponibile come window.madKickApp per debug');
    }
});
