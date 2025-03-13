document.addEventListener('DOMContentLoaded', function () {
    const playButton = document.getElementById('playButton');
    const audioPlayer = document.getElementById('audioPlayer');
    let isPlaying = false;
    let audioContext;
    let source;
    let reverb;
    let isReverbLoaded = false; // Track reverb loading status
    let flanger, phaser;
    let isFlangerEnabled = false, isPhaserEnabled = false;
    let bandPassFilter; // Add Bandpass Filter

    // Function to start audio and visual effects
    function startEffects() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            source = audioContext.createMediaElementSource(audioPlayer);
            applyAudioEffects();
        }

        // Check and resume AudioContext if needed
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext resumed');
            });
        }

        // Apply reverb effect when starting
        if (isReverbLoaded) {
            applyReverbEffect();
        }

        audioPlayer.play()
            .then(() => {
                isPlaying = true;
                playButton.classList.add('playing'); // Changed from 'green' to 'playing'
            })
            .catch(error => {
                console.error("Playback failed:", error);
            });
    }

    // Function to stop audio and visual effects
    function stopEffects() {
        audioPlayer.pause();
        isPlaying = false;
        playButton.classList.remove('playing'); // Changed from 'green' to 'playing'
    }

    // Event listener for the play button
    playButton.addEventListener('click', function () {
        if (isPlaying) {
            stopEffects();
        } else {
            startEffects();
        }

        // Create AudioContext on first user interaction
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            source = audioContext.createMediaElementSource(audioPlayer);
            applyAudioEffects();
            loadReverb();
        }
        startEffects();
    });

    function applyAudioEffects() {
        const lowPassFilter = audioContext.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.frequency.setValueAtTime(5000, audioContext.currentTime);
        lowPassFilter.Q.setValueAtTime(1, audioContext.currentTime);

        // Rhythmic LowPass Filter Modulation
        const lowPassInterval = 60 / 170; // Beat length in seconds at 170 BPM
        let lowPassCounter = 0;
        setInterval(() => {
            lowPassCounter++;
            let frequency = 5000;
            let Q = 1;

            // Emphasize downbeats
            if (lowPassCounter % 4 === 1) {
                // Stronger downbeat effect
                frequency = Math.random() * 2500 + 500;  // wider range, lower frequencies
                Q = Math.random() * 6 + 2;    // High Resonance
            } else if (lowPassCounter % 2 === 1) { // On the other beats
                frequency = Math.random() * 1500 + 2500;
                Q = Math.random() * 3 + 1;
            }
            else {
                frequency = 4000 + Math.sin(lowPassCounter * Math.PI / 2) * 1000; // Subtle wobble
                Q = 1 + Math.cos(lowPassCounter * Math.PI / 2) * 2;
            }

            lowPassFilter.frequency.setValueAtTime(frequency, audioContext.currentTime);
            lowPassFilter.Q.setValueAtTime(Q, audioContext.currentTime);
        }, lowPassInterval * 1000);

        const distortion = audioContext.createWaveShaper();
        distortion.curve = makeDistortionCurve(400); // Increased default distortion
        distortion.oversample = '4x';

        // Rhythmic Distortion Modulation
        const distortionInterval = lowPassInterval;
        let distortionCounter = 0;
        setInterval(() => {
            distortionCounter++;
            let amount = 400;

            // Increase distortion on downbeat
            if (distortionCounter % 4 === 1) {
                amount = Math.random() * 600 + 200; // More extreme distortion
            }
            else if (distortionCounter % 2 === 1) {
                amount = Math.random() * 300 + 100; // Medium
            }
            else {
                amount = 200 + Math.sin(distortionCounter * Math.PI) * 100; // Sine wave modulation
            }
            distortion.curve = makeDistortionCurve(amount);
        }, distortionInterval * 1000);

        const lowShelfEQ = audioContext.createBiquadFilter();
        lowShelfEQ.type = 'lowshelf';
        lowShelfEQ.frequency.setValueAtTime(250, audioContext.currentTime);

        // LFO for Low Shelf EQ
        const lfo = audioContext.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(2, audioContext.currentTime); // Faster LFO
        const lfoGain = audioContext.createGain();
        lfoGain.gain.setValueAtTime(5, audioContext.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(lowShelfEQ.gain);
        lfo.start();

        const delay = audioContext.createDelay();
        delay.delayTime.setValueAtTime(Math.random() * 0.005, audioContext.currentTime);
        const feedback = audioContext.createGain();
        feedback.gain.setValueAtTime(Math.random() * 0.5, audioContext.currentTime);
        delay.connect(feedback);
        delay.connect(delay);

        // Flanger setup
        flanger = audioContext.createDelay();
        flanger.delayTime.value = 0.005; // Initial delay
        const flangerLFO = audioContext.createOscillator();
        flangerLFO.type = 'sine';
        flangerLFO.frequency.value = 0.5; // LFO speed
        const flangerGain = audioContext.createGain();
        flangerGain.gain.value = 0.002; // LFO depth
        flangerLFO.connect(flangerGain);
        flangerGain.connect(flanger.delayTime);
        flangerLFO.start();

        // Phaser setup (using a BiquadFilter)
        phaser = audioContext.createBiquadFilter();
        phaser.type = 'allpass';
        phaser.frequency.value = 500; // Initial phaser frequency
        const phaserLFO = audioContext.createOscillator();
        phaserLFO.type = 'sine';
        phaserLFO.frequency.value = 0.3; // LFO speed
        const phaserGain = audioContext.createGain();
        phaserGain.gain.value = 400; // LFO depth
        phaserLFO.connect(phaserGain);
        phaserGain.connect(phaser.frequency);
        phaserLFO.start();

        // Bandpass filter setup
        bandPassFilter = audioContext.createBiquadFilter();
        bandPassFilter.type = 'bandpass';
        bandPassFilter.frequency.value = 1000; // Initial frequency
        bandPassFilter.Q.value = 2; // Initial Q

        // 170BPM Interval
        const interval = 60 / 170 * 1000;

        setInterval(() => {
            // Randomly engage or disengage flanger and phaser
            if (Math.random() < 0.05) { // 5% chance for flanger/phaser
                isFlangerEnabled = !isFlangerEnabled;
            }
            if (Math.random() < 0.05) {
                isPhaserEnabled = !isPhaserEnabled;
            }
            // 5% chance for engaging bandpass
            if (Math.random() < 0.05) { // rare
                bandPassFilter.frequency.setValueAtTime(Math.random() * 2000 + 500, audioContext.currentTime); // Random cutoff
                bandPassFilter.Q.setValueAtTime(Math.random() * 4 + 1, audioContext.currentTime); // Moderate resonance
            } else {
                bandPassFilter.frequency.setValueAtTime(1000, audioContext.currentTime); // Reset bandpass
                bandPassFilter.Q.setValueAtTime(2, audioContext.currentTime);
            }
        }, interval);

        // Connect nodes

        let currentSource = source;

        currentSource = source.connect(lowPassFilter);
        currentSource = lowPassFilter.connect(distortion);
        currentSource = distortion.connect(lowShelfEQ);
        currentSource = lowShelfEQ.connect(delay);

        //Conditionally connect flanger/phaser
        currentSource = delay.connect(bandPassFilter);

        if (isFlangerEnabled) {
            bandPassFilter.connect(flanger);
            flanger.connect(audioContext.destination);
        }
        if (isPhaserEnabled) {
            bandPassFilter.connect(phaser);
            phaser.connect(audioContext.destination);
        }
        bandPassFilter.connect(audioContext.destination);
    }

    // Reverb effect code
    function applyReverbEffect() {
        if (reverb) {
            source.connect(reverb);
            reverb.connect(audioContext.destination);
        }
    }

    function makeDistortionCurve(amount) {
        let k = amount,
            n_samples = 44100,
            curve = new Float32Array(n_samples),
            deg = Math.PI / 180,
            i = 0,
            x;
        for (; i < n_samples; ++i) {
            x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }


    var reverbBuffer;

    function loadReverb() {
        var request = new XMLHttpRequest();
        request.open('GET', 'https://mdn.github.io/webaudio-examples/audio-api/convolver/impulse-responses/hm2_livingroom.wav', true);
        request.responseType = 'arraybuffer';
        request.setRequestHeader('Content-Type', 'audio/wav');

        request.onload = function () {
            audioContext.decodeAudioData(request.response, function (buffer) {
                reverbBuffer = buffer;
                reverb = audioContext.createConvolver();
                reverb.buffer = buffer;
                isReverbLoaded = true; // Flag reverb as loaded
            }, function (e) { console.log("Error decoding file" + e); });
        }
        request.send();
    }
});