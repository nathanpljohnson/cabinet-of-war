/* Sound, synthesised (no audio files). The world: wind that swells and falls, fire crackle by distance, a far-off drum
   near the camp, bells on the hour, hoofbeats. The papers: a quill while you write, wax cracking when you break a seal.
   No music (it was removed: the player found it annoying). Starts on the first user gesture (browser autoplay rules). */
export function createSound() {
  let ctx = null, master, sfx, wind, windF, windG, rainG, fireG, drumT = 0, on = false, night = false, vol = 1, quietNow = false;
  const level = () => (quietNow ? .14 : .4) * vol; // the player's volume over the scene's own level
  function noiseBuf(sec, k = 1) { const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * k; return b; }
  function start() {
    if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = .9; sfx.connect(master);
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = .997 * b0 + w * .029; b1 = .985 * b1 + w * .032; b2 = .95 * b2 + w * .048; d[i] = (b0 + b1 + b2) * .35; }
    wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true; windF = ctx.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 500;
    windG = ctx.createGain(); windG.gain.value = .45; wind.connect(windF).connect(windG).connect(master); wind.start();
    const rain = ctx.createBufferSource(); rain.buffer = noiseBuf(2); rain.loop = true; const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2200; rainG = ctx.createGain(); rainG.gain.value = 0; rain.connect(rf).connect(rainG).connect(master); rain.start();
    fireG = ctx.createGain(); fireG.gain.value = 0; fireG.connect(master);
  }
  function crackle() { const n = ctx.createBufferSource(), b = ctx.createBuffer(1, 800, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < 800; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 90); n.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 2500; n.connect(f).connect(fireG); n.start(); }
  function thump(f0, f1, g, when, len = .3) { const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(f1, when + len * .6); e.gain.setValueAtTime(g, when); e.gain.exponentialRampToValueAtTime(.001, when + len); o.connect(e).connect(sfx); o.start(when); o.stop(when + len + .02); }
  function burst(when, len, freq, q, g, type = 'bandpass') { const n = ctx.createBufferSource(); n.buffer = noiseBuf(len); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const e = ctx.createGain(); e.gain.setValueAtTime(g, when); e.gain.exponentialRampToValueAtTime(.001, when + len); n.connect(f).connect(e).connect(sfx); n.start(when); }
  function bell(when, g) { for (const [r, a, d] of [[1, 1, 4], [2.76, .5, 2.4], [5.4, .25, 1.2], [.5, .6, 5]]) { const o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.value = 392 * r; e.gain.setValueAtTime(g * a, when); e.gain.exponentialRampToValueAtTime(.0005, when + d); o.connect(e).connect(sfx); o.start(when); o.stop(when + d); } }
  const CUES = {
    quill: () => { const t = ctx.currentTime; for (let i = 0; i < 3; i++) burst(t + i * .07 + Math.random() * .03, .05, 4200 + Math.random() * 1500, 3, .05); },
    seal: () => { const t = ctx.currentTime; burst(t, .06, 2600, 1.2, .35, 'highpass'); thump(180, 90, .25, t, .12); burst(t + .05, .03, 5000, 2, .12); },
    bell: n => { const t = ctx.currentTime; for (let i = 0; i < Math.min(n, 12); i++) bell(t + i * 2.1, .09); },
    hoof: sec => { const t = ctx.currentTime; for (let k = 0; k < sec / .55; k++) for (const o of [0, .11, .2]) thump(120, 70, .14, t + k * .55 + o, .12); },
    letters: () => burst(ctx.currentTime, .18, 1800, .6, .06), // the rustle of the post, no music
    page: () => burst(ctx.currentTime, .18, 1800, .6, .06),
    // thunder after a flash: a crack if near, then a long low roll (delay in seconds: further off, later and softer)
    thunder: (delay = 2) => { const t = ctx.currentTime + delay, g = Math.max(.25, 1 - delay / 6); if (delay < 1.6) burst(t, .35, 900, .8, .5 * g, 'lowpass');
      const n = ctx.createBufferSource(); n.buffer = noiseBuf(5); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; const e = ctx.createGain();
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1.1 * g, t + .25); e.gain.exponentialRampToValueAtTime(.4 * g, t + 1.4); e.gain.exponentialRampToValueAtTime(.001, t + 4.8); n.connect(f).connect(e).connect(sfx); n.start(t); n.stop(t + 5); },
  };
  return {
    set enabled(v) { on = v; if (v) { start(); ctx.resume(); } if (master) master.gain.setTargetAtTime(v ? level() : 0, ctx.currentTime, .4); },
    // volume: 0…1 of its usual level
    set volume(v) { vol = v; if (master && on) master.gain.setTargetAtTime(level(), ctx.currentTime, .1); },
    get enabled() { return on; },
    gesture() { if (on) { start(); ctx.resume(); master.gain.setTargetAtTime(level(), ctx.currentTime, .4); } },
    cue(name, arg) { if (ctx && on && CUES[name]) CUES[name](arg); },
    // dFire: metres to the nearest fire; dCamp: metres to the camp; quiet: map view; opts.night: after dark
    update(dt, t, dFire, dCamp, quiet, opts = {}) {
      if (!ctx || !on) return; night = !!opts.night;
      const wk = opts.wind ?? .35; windF.frequency.setTargetAtTime((380 + 260 * (Math.sin(t * .13) * .5 + .5) + 120 * Math.sin(t * .51)) * (.8 + wk * .7), ctx.currentTime, .5);
      windG.gain.setTargetAtTime(.3 + wk * .45, ctx.currentTime, .8); rainG.gain.setTargetAtTime(opts.rain ? .09 : 0, ctx.currentTime, 1.2);
      quietNow = !!quiet; master.gain.setTargetAtTime(level(), ctx.currentTime, .6);
      const fg = Math.max(0, 1 - dFire / 26); fireG.gain.setTargetAtTime(fg * .9, ctx.currentTime, .3);
      if (fg > 0 && Math.random() < dt * 9) crackle();
      drumT -= dt; if (!night && dCamp < 300 && drumT <= 0) { const g = .12 * Math.max(0, 1 - dCamp / 300); for (let i = 0; i < 6; i++) thump(110, 50, g * (i % 3 === 0 ? 1.3 : .8), ctx.currentTime + i * .26); drumT = 9 + Math.random() * 8; }
    },
  };
}
