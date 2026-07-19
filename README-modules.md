# MadKick - Documentazione Codice Modulare

## Panoramica

Questo documento descrive la struttura modulare rifattorizzata del progetto MadKick, un'applicazione web audio per la riproduzione di kick drum con effetti dinamici in tempo reale.

## Struttura del Progetto

```
web-kick/
├── index.html              # Pagina principale
├── styles.css              # Stili CSS
├── app.js                  # Applicazione principale (orchestratore)
├── script-legacy.js        # Versione originale (backup)
├── modules/                # Moduli del sistema
│   ├── audioEngine.js      # Motore audio (contesto + analyser)
│   ├── audioEffects.js     # Sistema di effetti
│   ├── audioAnalysis.js    # Analisi real-time (bande, onset, RMS/centroid)
│   ├── glRenderer.js       # Motore visivo WebGL2 (primario)
│   ├── vfxRenderer.js      # Renderer Canvas 2D (fallback automatico)
│   └── uiManager.js        # Gestione interfaccia utente
├── kick.mp3               # File audio
├── kick.jpg               # Immagine di sfondo
└── README-modules.md      # Questa documentazione
```

> **Nota:** dalla v1.0.5 il rendering visivo è gestito da `glRenderer.js`
> (WebGL2 a fragment shader). `vfxRenderer.js` resta come fallback Canvas 2D
> quando WebGL2 non è disponibile. `audioAnalysis.js` estrae le feature che
> pilotano entrambi i renderer. Vedi il [README](README.md) per feature e
> controlli VJ.

## Architettura Modulare

### 1. AudioEngine (`modules/audioEngine.js`)

**Responsabilità:**
- Inizializzazione del contesto Web Audio API
- Gestione del source audio dall'elemento HTML
- Controllo play/pause dell'audio
- Gestione del ciclo di vita del contesto audio

**Metodi principali:**
- `initialize(audioElement)` - Inizializza il motore audio
- `play()` - Avvia la riproduzione
- `pause()` - Mette in pausa
- `getContext()` - Restituisce il contesto audio
- `getSource()` - Restituisce il source per collegarlo agli effetti

### 2. AudioEffects (`modules/audioEffects.js`)

**Responsabilità:**
- Creazione e configurazione di tutti gli effetti audio
- Gestione della catena di effetti
- Modulazione dinamica dei parametri
- Pulizia delle risorse (intervalli, oscillatori)

**Effetti implementati:**
- **Filtro Passa-Basso Dinamico**: Modula frequenza e Q factor
- **Distorsione WaveShaper**: Curva di distorsione variabile
- **EQ Low-Shelf Modulato**: Con LFO per movimento
- **Delay con Feedback**: Tempi e feedback randomici
- **Compressore Dinamico**: Per controllo della dinamica

**Metodi principali:**
- `createEffectsChain(source)` - Crea l'intera catena di effetti
- `makeDistortionCurve(amount)` - Genera curve di distorsione custom
- `dispose()` - Pulisce risorse e intervalli

### 3. UIManager (`modules/uiManager.js`)

**Responsabilità:**
- Gestione degli eventi dell'interfaccia utente
- Controllo dello stato visuale del pulsante
- Gestione dell'accessibilità (keyboard navigation)
- Visualizzazione di errori e notifiche

**Caratteristiche:**
- Pattern callback per comunicazione con altri moduli
- Gestione stati play/pause con feedback visivo
- Supporto accessibilità (ARIA labels, keyboard events)
- Sistema di notifiche per errori

**Metodi principali:**
- `initialize(playButton)` - Configura l'interfaccia
- `setOnPlayCallback(callback)` - Imposta callback per play
- `setOnPauseCallback(callback)` - Imposta callback per pause
- `showError(message)` - Mostra notifiche di errore

### 4. App Principal (`app.js`)

**Responsabilità:**
- Orchestrazione di tutti i moduli
- Inizializzazione lazy del sistema audio
- Gestione degli errori globali
- Sincronizzazione tra UI e audio

**Caratteristiche:**
- Inizializzazione audio solo su user gesture (browser policy)
- Gestione robusta degli errori
- Debug mode per development
- Pulizia automatica delle risorse

## Vantaggi della Modularizzazione

### 1. **Separazione delle Responsabilità**
Ogni modulo ha una responsabilità specifica e ben definita:
- `AudioEngine`: Solo gestione audio di base
- `AudioEffects`: Solo creazione e gestione effetti
- `UIManager`: Solo interfaccia utente
- `App`: Solo orchestrazione

### 2. **Manutenibilità**
- Codice più leggibile e organizzato
- Facile individuazione e risoluzione di bug
- Modifiche isolate senza impatti su altri moduli
- Commentazione dettagliata per ogni funzione

### 3. **Testabilità**
- Ogni modulo può essere testato indipendentemente
- Dipendenze iniettate tramite costruttore
- Interfacce chiare tra moduli

### 4. **Riusabilità**
- Moduli possono essere riutilizzati in altri progetti
- AudioEffects può essere esteso con nuovi effetti
- UIManager è generico per qualsiasi player audio

### 5. **Estensibilità**
- Facile aggiunta di nuovi effetti in AudioEffects
- Possibilità di sostituire moduli singoli
- Architettura aperta per future funzionalità

## Dettagli Tecnici degli Effetti

### Filtro Passa-Basso Dinamico
```javascript
// Configurazione e modulazione automatica
filter.frequency: 500Hz - 5500Hz (random ogni secondo)
filter.Q: 0 - 10 (random ogni secondo)
```

### Distorsione WaveShaper
```javascript
// Curva matematica per distorsione armonica
formula: ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
oversample: 4x (anti-aliasing)
```

### EQ Low-Shelf con LFO
```javascript
// Modulazione sinusoidale del gain
frequency: 250Hz (frequenza di shelf)
LFO: 1Hz sine wave, ±5dB modulation
```

### Delay con Feedback
```javascript
// Delay molto breve per texture
delayTime: 0-5ms (random)
feedback: 0-50% (random)
```

### Compressore Dinamico
```javascript
// Configurazione per punch e consistenza
threshold: -24dB
ratio: 12:1
attack: 3ms
release: 250ms
```

## Gestione degli Errori

Il sistema implementa una gestione robusta degli errori su più livelli:

1. **Livello Modulo**: Ogni modulo gestisce i propri errori specifici
2. **Livello App**: L'orchestratore cattura errori tra moduli
3. **Livello UI**: Notifiche visive per l'utente
4. **Livello Browser**: Gestione policy audio dei browser moderni

## Browser Compatibility

Il codice utilizza:
- **ES6 Modules**: Supporto moderno richiesto
- **Web Audio API**: Chrome 34+, Firefox 25+, Safari 14.1+
- **AudioContext**: Con fallback webkitAudioContext per Safari

## Performance

Ottimizzazioni implementate:
- **Lazy Initialization**: Audio context creato solo su user gesture
- **Resource Cleanup**: Pulizia automatica di intervalli e oscillatori
- **Oversampling**: 4x per ridurre aliasing nella distorsione
- **Efficient Curves**: Curve di distorsione pre-calcolate

## Debug e Development

In modalità development (localhost), l'app è disponibile come `window.madKickApp` per debug nella console del browser.

Esempio di utilizzo:
```javascript
// Accesso ai moduli in console
window.madKickApp.audioEngine.getContext()
window.madKickApp.audioEffects.getEffect('lowPassFilter')
window.madKickApp.uiManager.getPlayingState()
```

## Migrazione dal Codice Legacy

Il file `script-legacy.js` contiene il codice originale come backup. Le principali differenze:

| Legacy | Modulare |
|--------|----------|
| Tutto in un file | Separato in 4 moduli |
| Variabili globali | Incapsulamento in classi |
| Commenti minimi | Documentazione completa |
| Gestione errori basic | Sistema robusto di error handling |
| No cleanup | Gestione automatica risorse |

## Conclusioni

La ristrutturazione modulare migliora significativamente:
- **Qualità del codice**: Organizzazione e leggibilità
- **Manutenibilità**: Modifiche isolate e sicure
- **Robustezza**: Gestione errori e pulizia risorse
- **Documentazione**: Commenti dettagliati e spiegazioni tecniche
- **Estensibilità**: Architettura aperta per future funzionalità

Il codice è ora pronto per sviluppi futuri e manutenzione a lungo termine.
