// audio.js — all-procedural WebAudio sound: an engine hum that follows speed,
// a two-tone siren that swells with the nearest VBPD unit, gunshots, collision
// thuds, UI blips, a cash register cha-ching and a slow ambient pad loop.
// Nothing is sampled; the context unlocks on the player's first gesture.

export function createAudio(S) {
  let ac = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  let padNodes = [];

  function ensure() {
    if (ac) return true;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      // Engine: sawtooth through a lowpass, gain driven per-frame.
      engineOsc = ac.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ac.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ac.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ac.destination);
      engineOsc.start();
      // Siren: square wave with an LFO flipping its pitch.
      sirenOsc = ac.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 800;
      sirenLfo = ac.createOscillator();
      sirenLfo.frequency.value = 0.7;
      const lfoGain = ac.createGain();
      lfoGain.gain.value = 130;
      sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
      sirenGain = ac.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(ac.destination);
      sirenOsc.start();
      sirenLfo.start();
      // Ambient pad: two detuned triangles on a slow breathing gain.
      const padGain = ac.createGain();
      padGain.gain.value = 0.028;
      const lfo = ac.createOscillator();
      lfo.frequency.value = 0.05;
      const lfoG = ac.createGain();
      lfoG.gain.value = 0.014;
      lfo.connect(lfoG).connect(padGain.gain);
      for (const f of [110, 164.8, 220]) {
        const o = ac.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.connect(padGain);
        o.start();
        padNodes.push(o);
      }
      padGain.connect(ac.destination);
      lfo.start();
      return true;
    } catch { return false; }
  }

  function noiseBurst(vol, freq, dur) {
    if (!ac || S.muted) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
  }

  function tone(freq, vol, dur, type = 'sine', when = 0) {
    if (!ac || S.muted) return;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ac.createGain();
    const t0 = ac.currentTime + when;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  return {
    unlock() { if (window.__MF_HEADLESS) return; if (ensure() && ac.state === 'suspended') ac.resume(); },
    engine(ratio, on) {
      if (!ac) return;
      const target = on && !S.muted ? 0.05 + ratio * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ac.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + ratio * 165, ac.currentTime, 0.06);
      engineFilter.frequency.setTargetAtTime(280 + ratio * 900, ac.currentTime, 0.1);
    },
    engineStart() { tone(70, 0.12, 0.35, 'sawtooth'); tone(98, 0.1, 0.3, 'sawtooth', 0.08); },
    siren(nearest) {
      if (!ac) return;
      const v = !S.muted && nearest < 90 ? Math.max(0, 0.055 * (1 - nearest / 90)) : 0;
      sirenGain.gain.setTargetAtTime(v, ac.currentTime, 0.15);
    },
    gunshot(vol = 0.5) { noiseBurst(S.muted ? 0 : vol, 2600, 0.13); },
    thud(v = 0.5) { noiseBurst(S.muted ? 0 : v, 300, 0.22); },
    blip() { tone(880, 0.08, 0.09); tone(1318, 0.07, 0.12, 'sine', 0.07); },
    cash() { tone(1568, 0.07, 0.1); tone(2093, 0.08, 0.16, 'sine', 0.08); },
    setMuted(m) {
      if (!ac) return;
      if (m) { engineGain.gain.value = 0; sirenGain.gain.value = 0; }
    },
  };
}
