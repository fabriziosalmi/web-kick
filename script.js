document.addEventListener('DOMContentLoaded', function () {
    const playButton = document.getElementById('playButton');
    const audioPlayer = document.getElementById('audioPlayer');
    let isPlaying = false;
    let audioContext;
    let source;

    playButton.addEventListener('click', function () {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            source = audioContext.createMediaElementSource(audioPlayer);
            applyAudioEffects();
        }

        if (isPlaying) {
            audioPlayer.pause();
            playButton.classList.remove('green');
        } else {
            audioPlayer.play();
            playButton.classList.add('green');
        }
        isPlaying = !isPlaying;
    });

    function applyAudioEffects() {
        const lowPassFilter = audioContext.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.frequency.setValueAtTime(5000, audioContext.currentTime);
        lowPassFilter.Q.setValueAtTime(1, audioContext.currentTime);

        setInterval(() => {
            lowPassFilter.frequency.setValueAtTime(Math.random() * 5000 + 500, audioContext.currentTime);
            lowPassFilter.Q.setValueAtTime(Math.random() * 10, audioContext.currentTime);
        }, 1000);

        const distortion = audioContext.createWaveShaper();
        distortion.curve = makeDistortionCurve(400);
        distortion.oversample = '4x';

        setInterval(() => {
            distortion.curve = makeDistortionCurve(Math.random() * 1000);
        }, 1000);

        const lowShelfEQ = audioContext.createBiquadFilter();
        lowShelfEQ.type = 'lowshelf';
        lowShelfEQ.frequency.setValueAtTime(250, audioContext.currentTime);
        const lfo = audioContext.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(1, audioContext.currentTime);
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
});

