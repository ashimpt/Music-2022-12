const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 120];

const notes = [10 / 8, 4 / 3, 3 / 2, 15 / 8, 2].map((v) => log2(0.8 * v));
const mix9 = (i, p, f = notes.at(i % 5)) => mix(f, crush(f, 1 / 9, p));
const tune = (i, p) => 200 * 2 ** (mix9(i % 5, am(p / 2)) + floor(i / 5));

function synth(data) {
  const a = 0.3;
  function syn(i0, t0, k, dr = 1) {
    const fc = tune(k - 1, t0 / dur);
    const a0 = min(1, 400 / fc);
    const pp = 1 - mix(0.5, k / 16, 0.5);
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * fc * t;
      const e = asd(t / dr);
      const b = a * a0 * e * sin(p + 0.5 * a0 * e * sin(1.985 * p));
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }

  for (let i = 0, t = 0, interval; ; i++, t += interval) {
    const k = (7 * i) % 17;
    if (i % 6 == 0) interval = 0.25 * 2 ** rnd(-0.5, 0.5, mix(0.5, 2, t / dur));
    if (i && i % +6 == 0) t += 6 * interval;
    if (i && i % 12 == 0) t += 6 * interval;
    if (i && i % 18 == 0) t += 6 * interval;
    if (i && i % 24 == 0) t += 6 * interval;
    if (i % 6 == 0 && t > dur - 5) break;
    syn(ceil(fs * t), t, k);
  }
}

function delay(data) {
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    const x = 10e-3 * fs * sin(2 * t + sin(1.5 * t));
    for (let ch = 2; ch--; )
      data[ch][i] += 0.7 * lerpArray(data[ch], i - fs + (2 * ch - 1) * x);
  }
}

new Node("synth").connect(new Node("delay")).connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  // seed: 1,
  secStart: 0.5,
  hzLowCut: 20,
  fade: { time: [0, 15], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -4,
  // bitsPerSample: 8,
};
