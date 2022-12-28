const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 120];

const notes0 = [10 / 8, 4 / 3, 3 / 2, 15 / 8, 2].map((v) => log2(0.8 * v));
const mix9 = (i, p, f = notes0.at(i % 5)) => mix(f, crush(f, 1 / 9), p);
const tune = (i, t) => 200 * 2 ** (mix9(i, am(t / dur / 2)) + floor(i / 5));

function synth(data) {
  const a = 0.5;
  data[2] = new Float32Array(dur * fs);
  function syn(i0 = 0, k, dr = 0.2) {
    const fc = tune(-1 + k, i0 / fs);
    const fm = tune(+8 + k, i0 / fs) / fc - 1;
    const a0 = min(1, 400 / fc);
    const pp = mix(0.5, (k + 3) / (14 + 3), 0.5);
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * fc * t;
      const e = asd(t / dr, 0.01);
      const m0 = a0 * e * sin(fm * p);
      const b0 = a * a0 * e * sin(1 * p + 0.6 * m0);
      const b1 = a * a0 * e * sin(2 * p + 0.3 * m0);
      data[2][i0 + fs / 20] += 0.5 * b1;
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b0;
    }
  }

  const repBag = RndBag.create({ bag: [2, 2, 2, 3, 3] });
  for (let i = 0, t = 0; t < dur; i++, t += 3.4) {
    if (i % 6 >= 4) continue;
    const k = (7 * i) % 15;
    for (let n = repBag(), j = n; j--; ) {
      const i0 = ceil((t + (0.4 / n) * j) * fs);
      syn(i0, k + (k < 8 ? j : -j), 1.5 * (0.4 / n));
    }
  }
}

function delay(oup, { 0: inp }) {
  // lo wet
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    oup[0][i] += 0.7 * inp[1][i - 1 * fs] || 0;
    oup[1][i] += 0.7 * inp[0][i - 2 * fs] || 0;

    for (let ch = 2; ch--; ) oup[ch][i] += 0.7 * oup[ch][i - 2 * fs] || 0;
  }

  // hi wet
  const hiWet = [0, 0].map(() => new Float32Array(fs * dur));
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    const a = am(t / dur / 2);
    hiWet[1][i] += 1.2 * a * inp[2][i - 2.4 * fs] || 0;
    hiWet[0][i] += 1.2 * a * inp[2][i - 4.8 * fs] || 0;
    for (let ch = 2; ch--; ) hiWet[ch][i] += 0.7 * hiWet[ch][i - 4.8 * fs] || 0;
  }

  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) oup[ch][i] += inp[ch][i] + inp[2][i]; // dry
    for (let ch = 2; ch--; ) oup[ch][i] += hiWet[ch][i]; // hi wet
  }
}

new Node("synth").connect(new Node("delay", 2)).connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80
const setting = {
  seed: "random",
  secStart: 0.5,
  hzLowCut: 20,
  fade: { time: [0, 15], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -4,
  // bitsPerSample: 8,
};
