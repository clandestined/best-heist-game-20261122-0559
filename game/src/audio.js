// Tiny synthesised sound effects: no audio files, no network, just the
// Web Audio API. The context is created on the first user gesture, so the
// game stays silent until the player starts it.

export function createAudio() {
  let context = null;
  let alarmOsc = null;
  let alarmGain = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, seconds, type, volume, when = 0, slideTo = null) {
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  return {
    /** Call from any user gesture so later sounds are allowed to play. */
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.12);
      tone(990, 0.12, 'sine', 0.1, 0.07);
    },
    coin() {
      tone(1200, 0.05, 'triangle', 0.1);
      tone(900, 0.08, 'triangle', 0.08, 0.05);
    },
    crack() {
      tone(220, 0.1, 'square', 0.06);
      tone(330, 0.1, 'square', 0.06, 0.09);
      tone(440, 0.14, 'square', 0.06, 0.18);
    },
    vaultOpen() {
      tone(523, 0.12, 'sine', 0.12);
      tone(659, 0.12, 'sine', 0.12, 0.1);
      tone(784, 0.2, 'sine', 0.12, 0.2);
    },
    spotted() {
      tone(880, 0.12, 'sawtooth', 0.07, 0, 620);
    },
    busted() {
      tone(392, 0.18, 'sawtooth', 0.12, 0, 196);
      tone(311, 0.22, 'sawtooth', 0.12, 0.16, 155);
      tone(233, 0.4, 'sawtooth', 0.12, 0.36, 110);
    },
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.18, 'sine', 0.12, i * 0.11));
    },
    /** A low pulsing drone while the alarm is high; call every frame. */
    alarmDrone(level) {
      const ctx = ensure();
      if (!ctx) return;
      if (level < 0.35) {
        if (alarmOsc) {
          try { alarmOsc.stop(); } catch { /* already stopped */ }
          alarmOsc = null;
          alarmGain = null;
        }
        return;
      }
      if (!alarmOsc) {
        alarmOsc = ctx.createOscillator();
        alarmGain = ctx.createGain();
        alarmOsc.type = 'sine';
        alarmOsc.frequency.setValueAtTime(55, ctx.currentTime);
        alarmGain.gain.setValueAtTime(0.0, ctx.currentTime);
        alarmOsc.connect(alarmGain);
        alarmGain.connect(ctx.destination);
        alarmOsc.start();
      }
      const pulse = 0.03 + 0.05 * level * (0.5 + 0.5 * Math.sin(ctx.currentTime * 6));
      alarmGain.gain.setTargetAtTime(pulse, ctx.currentTime, 0.05);
      alarmOsc.frequency.setTargetAtTime(55 + 40 * level, ctx.currentTime, 0.1);
    },
  };
}
