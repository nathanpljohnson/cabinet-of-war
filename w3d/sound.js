/* Sound, synthesised (no audio files). The world: wind that swells and falls, fire crackle by distance, a far-off drum
   near the camp, bells on the hour, hoofbeats. The papers: a quill while you write, wax cracking when you break a seal.
   And a sparse score — a plucked keyboard in the manner of the 1740s, phrases with long silences between, softer at
   night, swelling when letters come. Starts on the first user gesture (browser autoplay rules). */
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
// D minor and its relatives, voiced as broken chords; a phrase is one progression
const PROG = [[[50, 57, 62, 65], [55, 58, 62, 67], [57, 61, 64, 69], [50, 57, 62, 65]], [[46, 53, 58, 62], [55, 58, 62, 67], [52, 57, 61, 64], [50, 57, 62, 65]], [[53, 57, 60, 65], [46, 53, 58, 62], [45, 52, 57, 61], [50, 57, 62, 65]]];
export function createSound() {
  let ctx = null, master, sfx, music, wind, windF, fireG, drumT = 0, on = false, nextPhrase = 4, night = false;
  function noiseBuf(sec, k = 1) { const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * k; return b; }
  function start() {
    if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = .9; sfx.connect(master);
    const rev = ctx.createConvolver(), rl = ctx.sampleRate * 2.2, rb = ctx.createBuffer(2, rl, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = rb.getChannelData(c); for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3); } rev.buffer = rb;
    music = ctx.createGain(); music.gain.value = .5; const wet = ctx.createGain(); wet.gain.value = .35; music.connect(master); music.connect(rev).connect(wet).connect(master);
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = .997 * b0 + w * .029; b1 = .985 * b1 + w * .032; b2 = .95 * b2 + w * .048; d[i] = (b0 + b1 + b2) * .35; }
    wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true; windF = ctx.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 500;
    const wg = ctx.createGain(); wg.gain.value = .45; wind.connect(windF).connect(wg).connect(master); wind.start();
    fireG = ctx.createGain(); fireG.gain.value = 0; fireG.connect(master);
  }
  // a plucked string: bright attack, quick decay, a little detune — harpsichord by night or day
  function pluck(n, when, vel = .18, len = 1.4) {
    const f = midi(n), g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(night ? 1800 : 4200, when); lp.frequency.exponentialRampToValueAtTime(night ? 500 : 900, when + len);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vel, when + .004); g.gain.exponentialRampToValueAtTime(.0008, when + len);
    for (const [type, det] of [['sawtooth', 0], ['square', 3]]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; const og = ctx.createGain(); og.gain.value = type === 'square' ? .35 : 1; o.connect(og).connect(lp); o.start(when); o.stop(when + len + .05); }
    lp.connect(g).connect(music);
  }
  function phrase(swell) {
    const prog = PROG[Math.floor(Math.random() * PROG.length)], beat = night ? .62 : .46; let t = ctx.currentTime + .1;
    for (const ch of prog) { pluck(ch[0] - 12, t, .16, 2.6); const order = Math.random() < .5 ? [1, 2, 3, 2, 1, 2, 3, 2] : [1, 2, 3, 1, 3, 2, 1, 2];
      order.forEach((k, i) => { if (night && i % 2) return; pluck(ch[k] + (i === 2 && Math.random() < .3 ? 12 : 0), t + i * beat / 2, .1 + Math.random() * .04, 1.2); }); t += beat * 4; }
    if (swell) for (const n of prog[0].slice(1)) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = midi(n); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(.05, ctx.currentTime + 2); g.gain.linearRampToValueAtTime(0, ctx.currentTime + 7); o.connect(g).connect(music); o.start(); o.stop(ctx.currentTime + 7.2); }
    nextPhrase = prog.length * beat * 4 + (night ? 40 : 25) + Math.random() * 30;
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
    letters: () => { if (!night) { nextPhrase = 0; } phrase(true); },
    page: () => burst(ctx.currentTime, .18, 1800, .6, .06),
  };
  return {
    set enabled(v) { on = v; if (v) { start(); ctx.resume(); } if (master) master.gain.setTargetAtTime(v ? .4 : 0, ctx.currentTime, .4); },
    get enabled() { return on; },
    gesture() { if (on) { start(); ctx.resume(); master.gain.setTargetAtTime(.4, ctx.currentTime, .4); } },
    cue(name, arg) { if (ctx && on && CUES[name]) CUES[name](arg); },
    // dFire: metres to the nearest fire; dCamp: metres to the camp; quiet: map view; opts.night: after dark
    update(dt, t, dFire, dCamp, quiet, opts = {}) {
      if (!ctx || !on) return; night = !!opts.night;
      windF.frequency.setTargetAtTime(380 + 260 * (Math.sin(t * .13) * .5 + .5) + 120 * Math.sin(t * .51), ctx.currentTime, .5);
      master.gain.setTargetAtTime(quiet ? .14 : .4, ctx.currentTime, .6);
      const fg = Math.max(0, 1 - dFire / 26); fireG.gain.setTargetAtTime(fg * .9, ctx.currentTime, .3);
      if (fg > 0 && Math.random() < dt * 9) crackle();
      drumT -= dt; if (!night && dCamp < 300 && drumT <= 0) { const g = .12 * Math.max(0, 1 - dCamp / 300); for (let i = 0; i < 6; i++) thump(110, 50, g * (i % 3 === 0 ? 1.3 : .8), ctx.currentTime + i * .26); drumT = 9 + Math.random() * 8; }
      if ((nextPhrase -= dt) <= 0) phrase(false);
    },
  };
}
