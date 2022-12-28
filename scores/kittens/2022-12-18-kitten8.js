const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 120];
const notes = [10 / 8, 4 / 3, 3 / 2, 15 / 8, 2].map((v) => log2(0.8 * v));
const mix9 = (i, p, f = notes.at(i % 5)) => mix(f, crush(f, 1 / 9, p));
const tune = (i, p) => 100 * 2 ** (mix9(i % 5, am(p / 2)) + floor(i / 5));

function synth(data) {
  const a = 0.15;
  function syn(t0, pl, dr = 1 / 4, pp = 0.5) {
    let i0 = ceil(fs * t0);
    const fc = tune(pl, t0 / dur);
    const a0 = min(1, 400 / fc);
    const a1 = 1.0 * (100 / fc);
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * fc * t;
      const b = a * a0 * asd(t / dr) * sin(p + a1 * sin(2 * p));
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }
  for (let t = 0, i = 0; t < dur; i++, t += 1 / 8) {
    if (i % 48 > 40) continue;
    const n0 = +0 + ((i / 16) % 5);
    if (i % 16 == 0) syn(t, n0, 16 / 16);
    if (i % 48 > 32) continue;
    const n1 = +5 + ((i / +8) % 5);
    if (i % +8 == 0) syn(t, n1, +8 / 16);
    if (i % 48 > 24) continue;
    const n2 = 10 + ((i / +4) % 5);
    if (i % +4 == 0) syn(t, n2, +4 / 16);
    if (i % 48 > 16) continue;
    const n3 = floor(rnd(13, 19));
    if (t / dur < 0.5 || rnd(2) < 1 || n2 == n3) continue;
    syn(t, n3, 2 / 16);
  }
}

function delay(oup, inp) {
  for (let ch = 2; ch--; )
    for (let i = 0, t = 0, s, start; t < dur; t = ++i / fs) {
      if (!i || (i % fs == 0 && rnd(3) < 1)) {
        start = floor((i - fs / 4) / fs) * fs;
        const hi = -6 + 7 * min(1, t / dur) ** 0.5;
        s = fs / 100 / 2 ** round(rnd(-8, hi, 2));
      }
      const x = start + (i % s);
      const e = asd(i / s, 0.05, 0.05) * asd(i / fs, 0.01, 0.01);
      const fade = min(t / dur / 0.25, 1) ** 2;
      oup[ch][i] += 0.7 * fade * e * lerpArray(inp[ch], x);
    }
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) oup[ch][i] += inp[ch][i];
  }
}

new Node("synth").connect(new Node("delay", 1)).connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  seed: "random",
  secStart: 0.5,
  hzLowCut: 20,
  fade: { time: [0, 15], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -4,
  // bitsPerSample: 8,
};
