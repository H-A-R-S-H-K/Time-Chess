// sounds.ts — Web Audio API synthesized chess sounds (lichess-style)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.3,
    attack: number = 0.005,
) {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
}

function playNoise(duration: number, volume: number = 0.15) {
    const ctx = getAudioContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    // Lowpass filter for a woody thunk sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(ctx.currentTime);
}

/** Normal piece move — soft wooden thunk */
export function playMoveSound() {
    playNoise(0.08, 0.25);
    playTone(220, 0.06, 'triangle', 0.12, 0.002);
}

/** Capture — sharper, louder impact */
export function playCaptureSound() {
    playNoise(0.12, 0.4);
    playTone(180, 0.08, 'square', 0.15, 0.002);
    // Add a second hit for emphasis
    setTimeout(() => {
        playTone(140, 0.06, 'triangle', 0.1);
    }, 30);
}

/** Check — alert ding */
export function playCheckSound() {
    playTone(880, 0.12, 'sine', 0.25, 0.005);
    setTimeout(() => {
        playTone(1100, 0.15, 'sine', 0.2, 0.005);
    }, 80);
}

/** Castle — double thunk */
export function playCastleSound() {
    playNoise(0.06, 0.2);
    playTone(200, 0.05, 'triangle', 0.1);
    setTimeout(() => {
        playNoise(0.06, 0.2);
        playTone(250, 0.05, 'triangle', 0.1);
    }, 100);
}

/** Game over — resolved chord */
export function playGameEndSound() {
    playTone(330, 0.4, 'sine', 0.2, 0.01);
    setTimeout(() => playTone(415, 0.35, 'sine', 0.18, 0.01), 100);
    setTimeout(() => playTone(500, 0.5, 'sine', 0.22, 0.01), 200);
}

/** Game start — bright notification */
export function playGameStartSound() {
    playTone(523, 0.1, 'sine', 0.15, 0.005);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.15, 0.005), 80);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.2, 0.005), 160);
}

/** Promote — ascending tone */
export function playPromoteSound() {
    playTone(400, 0.08, 'sine', 0.15);
    setTimeout(() => playTone(600, 0.08, 'sine', 0.18), 60);
    setTimeout(() => playTone(800, 0.12, 'sine', 0.2), 120);
}
