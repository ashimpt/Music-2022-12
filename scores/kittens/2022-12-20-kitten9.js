const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 120];
const notes = [10 / 8, 4 / 3, 3 / 2, 15 / 8, 2].map((v) => log2(0.8 * v));
const mix9 = (i, p, f = notes.at(i % 5)) => mix(f, crush(f, 1 / 9, p));
const tune = (i, p) => 100 * 2 ** (mix9(i % 5, am(p / 2)) + floor(i / 5));

function synth(data) {
  const a = 0.15;
  function syn(i0 = 0, t0 = 0, pl = 0, dr = 1) {
    const fc = tune(pl, t0 / dur);
    const fm = tune(pl + 9, t0 / dur) / fc - 1;
    const a0 = min(1, 400 / fc);
    const a1 = 0.7 * (100 / fc);
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * fc * t;
      const b = a * a0 * asd(t / dr) * sin(p + a1 * sin(fm * p));
      for (let ch = 2; ch--; ) data[ch][i0] += b;
    }
  }
  for (let i = 0, t = 0; t < dur; i++) {
    const o = i % 3;
    syn(ceil(fs * t), t, 5 * o + (i % 5) + (round(i / 23) % 2));
    if (i % 8 == 7) t += mix(2, 3, t / dur);
    else {
      t += mix(0.2, 0.3, t / dur);
      if (i < 7 && rnd(9) < 1) i++;
    }
  }
}

function delay(oup, inp) {
  for (let i = worker.id; i--; ) random();
  const a = 0.7;
  const lopV = Lop.create({ k: exp(-1 / fs), y1: 0.5 });
  const lopF = Filter.create({ f: 3e3 });
  const hipF = Filter.create({ f: 100, type: "high" });

  const ch = worker.id % 2;
  let [i, i0, t, start] = [0, 0, 0, 0];
  for (let dr = fs, v = 1, a0 = 1; t < dur; t = ++i / fs) {
    const v0 = lopV(v);
    i0 += v0;
    if (i0 > dr) {
      i0 = 0;
      if (rnd(9) < 1) dr = fs * [1, 2, 4].rnd();
      if (rnd(3) < 1) start = i - dr;
      if (rnd(2 + log2(v)) < 1) v = 2 ** round(rnd(-2, 2));
      a0 = min(1, 1 / v0);
    }
    const x = start + i0;
    const fade = min(t / dur / 0.25, 1) ** 2;
    const a1 = a * fade * a0 * asd(i0 / dr, 0.01, 0.01);
    oup[ch][i] += a1 * hipF(lopF(lerpArray(inp[ch], x)));
  }
}

const nSyn = new Node("synth");
nSyn.connect(destination);
nSyn.connect(new Node("delay", 1), new Node("delay", 1)).connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  seed: "random",
  secStart: 0.5,
  hzLowCut: 20,
  fade: { time: [0, 15], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -4,
  // bitsPerSample: 8,
};
