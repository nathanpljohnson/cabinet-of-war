/* Ambient sound, synthesised (no audio files): wind that swells and falls, fire crackle by distance,
   a far-off drum near the camp. Starts on the first user gesture (browser autoplay rules). */
export function createSound() {
  let ctx = null, master, wind, windF, fireG, drumT = 0, on = false;
  function start() {
    if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = .997 * b0 + w * .029; b1 = .985 * b1 + w * .032; b2 = .95 * b2 + w * .048; d[i] = (b0 + b1 + b2) * .35; }
    wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true; windF = ctx.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 500;
    const wg = ctx.createGain(); wg.gain.value = .5; wind.connect(windF).connect(wg).connect(master); wind.start();
    fireG = ctx.createGain(); fireG.gain.value = 0; fireG.connect(master);
  }
  function crackle() { const n = ctx.createBufferSource(), b = ctx.createBuffer(1, 800, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < 800; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 90); n.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 2500; n.connect(f).connect(fireG); n.start(); }
  function drum(g) { const o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + .18); e.gain.setValueAtTime(g, ctx.currentTime); e.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .3); o.connect(e).connect(master); o.start(); o.stop(ctx.currentTime + .32); }
  return {
    set enabled(v) { on = v; if (v) { start(); ctx.resume(); } if (master) master.gain.setTargetAtTime(v ? .32 : 0, ctx.currentTime, .4); },
    get enabled() { return on; },
    gesture() { if (on) { start(); ctx.resume(); master.gain.setTargetAtTime(.32, ctx.currentTime, .4); } },
    // dFire: metres to the nearest fire; dCamp: metres to the camp; quiet: papers open / map view
    update(dt, t, dFire, dCamp, quiet) {
      if (!ctx || !on) return;
      windF.frequency.setTargetAtTime(380 + 260 * (Math.sin(t * .13) * .5 + .5) + 120 * Math.sin(t * .51), ctx.currentTime, .5);
      master.gain.setTargetAtTime(quiet ? .1 : .32, ctx.currentTime, .6);
      const fg = Math.max(0, 1 - dFire / 26); fireG.gain.setTargetAtTime(fg * .9, ctx.currentTime, .3);
      if (fg > 0 && Math.random() < dt * 9) crackle();
      drumT -= dt; if (dCamp < 300 && drumT <= 0) { const g = .12 * Math.max(0, 1 - dCamp / 300); for (let i = 0; i < 6; i++) setTimeout(() => ctx && drum(g * (i % 3 === 0 ? 1.3 : .8)), i * 260); drumT = 9 + Math.random() * 8; }
    },
  };
}
