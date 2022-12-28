const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 120];

const notes = [10 / 8, 4 / 3, 3 / 2, 15 / 8, 2].map((v) => log2(0.8 * v));
const mix9 = (i, p, f = notes.at(i % 5)) => mix(f, crush(f, 1 / 9, p));
const tune = (i, p) => 200 * 2 ** (mix9(i % 5, am(p / 2)) + floor(i / 5));

function synth(data) {
  const a = 0.3;
  function syn(i0 = 0, t0, pl = 0) {
    const f0 = tune(pl, t0 / dur);
    const f1 = tune(pl + 9, t0 / dur) / f0 - 1;
    const a0 = min(1, 400 / f0);
    const a1 = 0.7 * (200 / f0);
    const dr = mix(0.2, 1, pl / 12);
    const pp = 0.5 + [-0.5, 0.5].at(rnd(2)) * rnd(pl / 10);
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * f0 * t;
      const e = asd(t / dr, 0.01);
      const m = a1 * e * sin(f1 * p);
      const b = a * a0 * e * sin(p + m);
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }
  const bag = RndBag.create({ bag: [0, 0.1, 0.2, 0.3] });
  for (let i = 0, t = 0; t < dur; i++, t += 8) {
    for (let c = 4; c--; ) {
      const t0 = t + bag();
      syn(ceil(fs * t0), t0, ((i + 2 * c) % 10) + (round(i / 8) % 3));
    }
  }
}

function delay(oup, inp) {
  const num = 8;
  for (let i = 0, t = 0, ampY; t < dur; t = ++i / fs) {
    if (i % (8 * fs) == 0) {
      const y = rnd(0.1, 0.9);
      ampY = [y, 1 - y];
    }
    for (let c = 1; c <= num; c++) {
      const i0 = ceil(4 * fs * pot(c / num));
      const a0 = mix(ampY[0], ampY[1], c / num);
      for (let ch = 2; ch--; ) oup[ch][i] += a0 * inp[ch][i - i0] || 0;
    }
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
