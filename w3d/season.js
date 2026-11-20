/* The season, the sun and moon, and the look of each kind of weather: one place for the walking world, the battlefield and
   the tests. Pure (no DOM, no three.js). Dates are 'YYYY-MM-DD'; hours are local solar time. */

// the season by the calendar; snow on the ground (from the weather) is decided by the caller
export function seasonOf(date) {
  const m = +date.slice(5, 7); return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}
// how far through its season a day is (0 at the start, 1 at the end): spring greens up, autumn turns and thins
export function seasonPhase(date) { const m = +date.slice(5, 7), d = +date.slice(8, 10); return Math.min(1, (((m + 9) % 3) * 30 + d) / 91); }

// broadleaf crowns by season (fir is evergreen); spring has blossom on a few, late autumn mostly bare
export const LEAVES = {
  spring: [0x9ac25a, 0xa8cc62, 0x8ab84e, 0xb4d26c, 0x86b04a, 0x9cc45e, 0xa2c866],
  summer: [0x4f7a2e, 0x5a8434, 0x47702a, 0x628c3a, 0x55803a, 0x4c7630, 0x5e8838],
  autumn: [0x6f8f3a, 0x8a9a3c, 0xc9a23a, 0xd98a2b, 0xb8562a, 0x9fae4a, 0xe0b54a],
  winter: [0x6e5e4e, 0x7a6a58, 0x625446],
};
export const BLOSSOM = [0xf4ecee, 0xf2d6dc, 0xf8f2ea];
export const BARE = LEAVES.winter;
// a crown for a day of the year: blossom on some trees in spring, the bare share growing through late autumn
export function leafColour(date, rnd, season = seasonOf(date)) {
  const s = season, p = seasonOf(date) === s ? seasonPhase(date) : .5, L = LEAVES[s], pick = a => a[Math.floor(rnd() * a.length)];
  if (s === 'spring' && p > .2 && p < .55 && rnd() < .12) return pick(BLOSSOM);
  if (s === 'autumn' && rnd() < Math.max(0, p - .55) * 1.6) return pick(BARE);
  if (s === 'autumn' && p < .25 && rnd() < .5) return pick(LEAVES.summer);
  return pick(L);
}
// the open country: grass and the arable fields as they stand in each season (young corn, ripe grain and stubble, plough)
export const COUNTRY = {
  spring: { grass: [0x86b04a, 0xa4c260, 0x6e9a3c], fields: [0x8fb04e, 0x7e5c3e, 0xa2c05c, 0x9a7a52] },
  summer: { grass: [0x86a040, 0xb8b058, 0x6a8a36], fields: [0xd8b860, 0xc8a24a, 0x8ea24c, 0xe2c870] },
  autumn: { grass: [0x94a046, 0xc4b25c, 0x76863e], fields: [0xc6ad66, 0x7e5c3e, 0x8ea24c, 0xb59a58] },
  winter: { grass: [0x8a8a5a, 0xa49a6a, 0x6e7048], fields: [0x9a8a64, 0x6e5640, 0x8a8a5a, 0x8e7c5c] },
};

/* ---------- the sun and the moon ---------- */
const RAD = Math.PI / 180;
const dayOfYear = date => { const d = new Date(date + 'T12:00:00Z'); return Math.round((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1; };
const declination = date => -23.44 * Math.cos(2 * Math.PI / 365 * (dayOfYear(date) + 10)) * RAD;
// sunrise and sunset (solar hours) at a latitude in degrees
export function sunTimes(date, lat = 48.2) {
  const c = -Math.tan(lat * RAD) * Math.tan(declination(date)), w = Math.acos(Math.max(-1, Math.min(1, c))) / RAD / 15;
  return { rise: 12 - w, set: 12 + w, length: 2 * w };
}
// the sun's direction for an hour: x east, y up, z south (unit vector)
export function sunVector(date, hour, lat = 48.2) {
  const d = declination(date), H = (hour - 12) * 15 * RAD, p = lat * RAD;
  const alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(p) - Math.tan(d) * Math.cos(p)); // from south, west positive
  return { x: -Math.sin(az) * Math.cos(alt), y: Math.sin(alt), z: Math.cos(az) * Math.cos(alt), alt: alt / RAD };
}
// the moon's age as a fraction of the synodic month (0 new, .5 full), from a known new moon (6 Jan 2000, 18:14 UTC)
export function moonPhase(date) {
  const days = (Date.parse(date + 'T12:00:00Z') - Date.UTC(2000, 0, 6, 18, 14)) / 864e5, s = 29.530588853;
  return ((days % s) + s) % s / s;
}
// where the moon stands at an hour: it trails the sun by its age (a full moon rises at sunset)
export const moonVector = (date, hour, lat = 48.2) => sunVector(date, hour - moonPhase(date) * 24.84, lat);

/* ---------- the weather ---------- */
// sun, sunColour, sky light, sky top, horizon, fog colour, fog near, far; cloud cover 0–1, cloud shade (0 white … 1 slate),
// wind 0–1.5, wet ground 0–1, rime 0–1, precipitation, lightning
export const LOOK = {
  clear: { sun: 3.8, sunC: 0xffcf96, hemi: 1.05, top: 0x5b8fd6, hor: 0xf3dcb4, fog: 0xe8d4b2, near: 110, far: 1500, cover: .15, shade: 0, wind: .35, wet: 0, rime: 0 },
  haze: { sun: 2.9, sunC: 0xffd8a8, hemi: 1.25, top: 0x7aa0d0, hor: 0xf0dcc0, fog: 0xe6d6bc, near: 60, far: 900, cover: .3, shade: .05, wind: .25, wet: 0, rime: 0 },
  overcast: { sun: 1.6, sunC: 0xe8e4dc, hemi: 1.85, top: 0x8e98a6, hor: 0xcfccc4, fog: 0xc4c0b8, near: 80, far: 950, cover: .95, shade: .55, wind: .5, wet: .1, rime: 0 },
  mist: { sun: 1.4, sunC: 0xf0e8dc, hemi: 1.8, top: 0xb8bcc0, hor: 0xdcdad2, fog: 0xd6d4cc, near: 30, far: 380, cover: .7, shade: .15, wind: .1, wet: .25, rime: 0 },
  frost: { sun: 3.4, sunC: 0xfff0dc, hemi: 1.2, top: 0x6a9ad8, hor: 0xe8e8ec, fog: 0xdfe4ea, near: 90, far: 1300, cover: .1, shade: 0, wind: .15, wet: 0, rime: 1 },
  rain: { sun: 1.4, sunC: 0xdcdcd8, hemi: 1.85, top: 0x7e8894, hor: 0xc4c6c4, fog: 0xb8bcbc, near: 40, far: 520, cover: 1, shade: .55, wind: .7, wet: 1, rime: 0, precip: 'rain' },
  thaw: { sun: 1.9, sunC: 0xe6e2da, hemi: 1.75, top: 0x8a96a4, hor: 0xd2d0c8, fog: 0xc8c6be, near: 60, far: 700, cover: .85, shade: .45, wind: .45, wet: .85, rime: 0, mud: true },
  snow: { sun: 1.5, sunC: 0xf0f0f4, hemi: 1.95, top: 0xb0b8c4, hor: 0xe6e8ec, fog: 0xdfe2e6, near: 30, far: 420, cover: 1, shade: .3, wind: .4, wet: 0, rime: 0, precip: 'snow' },
  storm: { sun: 1.25, sunC: 0xc8ccd0, hemi: 1.8, top: 0x5e6876, hor: 0xaeb2b6, fog: 0xa2a6ac, near: 35, far: 460, cover: 1, shade: .75, wind: 1.5, wet: 1, rime: 0, precip: 'rain' },
  thunder: { sun: 1.2, sunC: 0xc4c4cc, hemi: 1.75, top: 0x4e5666, hor: 0xa4a8b0, fog: 0x989ca6, near: 40, far: 520, cover: 1, shade: .9, wind: 1.1, wet: 1, rime: 0, precip: 'rain', lightning: true },
};
export const lookOf = w => LOOK[w] || LOOK.clear;
