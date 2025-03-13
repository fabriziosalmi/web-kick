document.addEventListener('DOMContentLoaded', function () {
    const playButton = document.getElementById('playButton');
    const audioPlayer = document.getElementById('audioPlayer');
    let isPlaying = false;
    let audioContext;
    let source;
    let reverb;
    let isReverbLoaded = false; // Track reverb loading status

    // Function to start audio and visual effects
    function startEffects() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            source = audioContext.createMediaElementSource(audioPlayer);
            applyAudioEffects();
        }

        // Apply reverb effect when starting
        if (isReverbLoaded) {
            applyReverbEffect();
        }
        //console.log(isPlaying);
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
        }, lowPassInterval * 1000); // Convert to milliseconds


        const distortion = audioContext.createWaveShaper();
        distortion.curve = makeDistortionCurve(100); // Keep distortion levels low.
        distortion.oversample = '4x';

        // Rhythmic Distortion Modulation
        const distortionInterval = lowPassInterval;
        let distortionCounter = 0;
        setInterval(() => {
            distortionCounter++;
            let amount = 100;

            // Increase distortion on downbeat
            if (distortionCounter % 4 === 1) {
                amount = Math.random() * 300 + 100; // Stronger distortion
            }
            else if (distortionCounter % 2 === 1){
                 amount = Math.random() * 150 + 50;
            }
            else {
                amount = 75 + Math.sin(distortionCounter * Math.PI) * 25; // Sine wave modulation
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
        feedback.connect(delay);

        // Connect nodes
        source.connect(lowPassFilter);
        lowPassFilter.connect(distortion);
        distortion.connect(lowShelfEQ);
        lowShelfEQ.connect(delay);
        delay.connect(audioContext.destination);
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

        request.onload = function () {
            audioContext.decodeAudioData(request.response, function (buffer) {
                reverbBuffer = buffer;
                reverb = audioContext.createConvolver();
                reverb.buffer = buffer;
                isReverbLoaded = true; // Flag reverb as loaded
                //console.log(reverb);
            }, function (e) { console.log("Error decoding file" + e); });
        }
        request.send();
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    loadReverb();
    startEffects(); // Autoplay after reverb is loaded
});