// Every sound is synthesised live with WebAudio: short oscillator blips and
// filtered noise bursts for the effects, two slow detuned oscillators for the
// ambient pad. No audio files, no network. The context is created on the
// first user gesture (browsers forbid sound before one) and stays silent in
// screenshot staging, where no gesture ever happens.

export function createAudio() {
  let context = null;
  let master = null;
  let padStarted = false;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ frequency, endFrequency, duration, type, gain, delay = 0 }) {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    }
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noise({ duration, frequency, gain, type = 'lowpass', delay = 0 }) {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  function startPad() {
    if (!context || padStarted) return;
    padStarted = true;
    const padGain = context.createGain();
    padGain.gain.value = 0.04;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const oscA = context.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 130.81;
    const oscB = context.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 196;
    oscB.detune.value = 5;
    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.016;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(padGain);
    padGain.connect(master);
    oscA.start();
    oscB.start();
    lfo.start();
  }

  return {
    /** Call from a user gesture: creates the context and starts the pad. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume();
      startPad();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master && context) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    jump() {
      tone({ frequency: 300, endFrequency: 560, duration: 0.12, type: 'triangle', gain: 0.1 });
    },
    flip() {
      tone({ frequency: 520, endFrequency: 180, duration: 0.18, type: 'sine', gain: 0.13 });
      tone({ frequency: 780, endFrequency: 260, duration: 0.18, type: 'triangle', gain: 0.06, delay: 0.03 });
    },
    land() {
      noise({ duration: 0.06, frequency: 500, gain: 0.06 });
    },
    shard(step) {
      const base = 660 + Math.min(step, 10) * 55;
      tone({ frequency: base, endFrequency: base * 1.4, duration: 0.11, type: 'sine', gain: 0.11 });
      tone({ frequency: base * 2, duration: 0.08, type: 'sine', gain: 0.05, delay: 0.04 });
    },
    key() {
      [523, 784, 1047].forEach((frequency, i) => {
        tone({ frequency, duration: 0.12, type: 'triangle', gain: 0.1, delay: i * 0.06 });
      });
    },
    door() {
      noise({ duration: 0.35, frequency: 700, gain: 0.09, type: 'bandpass' });
      tone({ frequency: 180, endFrequency: 320, duration: 0.3, type: 'sawtooth', gain: 0.05 });
    },
    checkpoint() {
      tone({ frequency: 587, duration: 0.14, type: 'sine', gain: 0.11 });
      tone({ frequency: 880, duration: 0.2, type: 'sine', gain: 0.11, delay: 0.09 });
    },
    death() {
      noise({ duration: 0.25, frequency: 800, gain: 0.16 });
      tone({ frequency: 280, endFrequency: 50, duration: 0.3, type: 'sawtooth', gain: 0.1 });
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((frequency, i) => {
        tone({ frequency, duration: 0.18, type: 'triangle', gain: 0.11, delay: i * 0.09 });
      });
    },
    uiClick() {
      tone({ frequency: 740, duration: 0.06, type: 'sine', gain: 0.09 });
    },
  };
}
