document.addEventListener('DOMContentLoaded', function () {
    const playButton = document.getElementById('playButton');
    const audioPlayer = document.getElementById('audioPlayer');
    let isPlaying = false;
    let audioContext;
    let source;

    // Autoplay on load
    function autoplayAudio() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        source = audioContext.createMediaElementSource(audioPlayer);
        applyAudioEffects();

        audioPlayer.play()
            .then(() => {
                // Autoplay started!
                isPlaying = true;
                playButton.classList.add('green');
                document.body.classList.add('strobe'); // Add strobe class
            })
            .catch(error => {
                // Autoplay was prevented. Show a UI element to let the user manually start playback.
                console.error("Autoplay prevented:", error);
                // Optionally, display a message on the page:
                // playButton.textContent = "Click to Play";  // Change button text to indicate manual play
            });
    }


    playButton.addEventListener('click', function () {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            source = audioContext.createMediaElementSource(audioPlayer);
            applyAudioEffects();
        }

        if (isPlaying) {
            audioPlayer.pause();
            playButton.classList.remove('green');
            document.body.classList.remove('strobe'); // Remove strobe class
        } else {
            audioPlayer.play();
            playButton.classList.add('green');
            document.body.classList.add('strobe'); // Add strobe class
        }
        isPlaying = !isPlaying;
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

            if (lowPassCounter % 4 === 0) { // Every 4 beats, do something dramatic
                frequency = Math.random() * 3000 + 1000; // Sweep down
                Q = Math.random() * 5 + 1;
            } else {
                frequency = 4000 + Math.sin(lowPassCounter * Math.PI / 2) * 1000; // Subtle wobble
                Q = 1 + Math.cos(lowPassCounter * Math.PI / 2) * 2;
            }

            lowPassFilter.frequency.setValueAtTime(frequency, audioContext.currentTime);
            lowPassFilter.Q.setValueAtTime(Q, audioContext.currentTime);
        }, lowPassInterval * 1000); // Convert to milliseconds



        const distortion = audioContext.createWaveShaper();
        distortion.curve = makeDistortionCurve(400);
        distortion.oversample = '4x';

        // Rhythmic Distortion Modulation
        const distortionInterval = lowPassInterval;
        let distortionCounter = 0;
        setInterval(() => {
            distortionCounter++;
            let amount = 400;

            if (distortionCounter % 8 === 0) { // Every 8 beats, big distortion jump
                amount = Math.random() * 800 + 200;
            } else {
                amount = 300 + Math.sin(distortionCounter * Math.PI) * 100; // Sine wave modulation
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

        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
        compressor.knee.setValueAtTime(30, audioContext.currentTime);
        compressor.ratio.setValueAtTime(12, audioContext.currentTime);
        compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
        compressor.release.setValueAtTime(0.25, audioContext.currentTime);

        source.connect(lowPassFilter);
        lowPassFilter.connect(distortion);
        distortion.connect(lowShelfEQ);
        lowShelfEQ.connect(delay);
        delay.connect(compressor);
        compressor.connect(audioContext.destination);
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

    autoplayAudio();  // Call autoplay function on load
});