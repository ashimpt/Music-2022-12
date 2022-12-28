const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 360];

function synth0(data) {
  for (let i = worker.id; i--; ) random();

  const a = 0.3;
  const bagD = RndBag.create({ bag: [2, 2, 4, 4, 8, 8, 1e3, 1e3] });
  function syn(i0, t0, dr = rnd(10, 20)) {
    const fc = 100 * 2 ** crush(rnd(4), 1 / 19);
    const a0 = min(1, 400 / fc);
    const a1 = 10 ** ([0, -5, -10, -15].rnd() / 20);
    const pp = 0.5 + [-0.5, 0.5].at(worker.id % 2) * rnd(log2(fc / 100) / 4);
    const f1 = rnd(4) < 1 ? 0 : rnd(3, 5);
    const hld = Hold.create({ k: exp(-56 / fs), l: fs / 10 });
    const lop = Filter.create({ f: 3000 });
    const smp = [1, 4, 9, 16].rnd();
    const dep = 1 / bagD();
    const a2 = 10 ** (rnd(-20, -6) / 20);
    const auto = clip(asd(t0 / dur, 1 / 3, 1 / 6), 1e-6, 1);
    const a3 = a * auto * a0 * a1;
    if (a3 < 1e-3) return;

    for (let i = 0, t = 0, b1 = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * fc * t;
      const e = am(t / dr);
      const m0 = !f1 ? 1 : am(f1 * dr * am(t / dr / 2));
      const m = (200 / fc) * e * m0 * sin(2 * p);
      const b0 = a3 * e * sin(p + m);
      if (i % smp == 0) b1 = crush(b0, dep * a3);
      const b = b0 - a2 * hld(i) * lop(b1);
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }
  for (let t = 0; t < 0.95 * dur; t += 20) {
    const i0 = fs * crush(t + (!t ? 0 : rnd(10)), 0.25);
    syn(i0, t);
  }

  const del = 7 + (worker.id % 2);
  const hold = [0, 0].map(() => Hold.create({ k: exp(-99 / fs), l: fs / 20 }));
  const lops = [0, 0].map(() => Filter.create({ f: 1500, q: 2 }));
  const fnc = () => 1.0 * 10 ** -rnd(5);
  let v = [1, 1];
  let x = [0, 0];

  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    // amp delay
    const a0 = 1.5 * mix(0.5, 1, asd(t / dur, 2 / 3));
    for (let ch = 2; ch--; )
      data[ch][i] += a0 * hold[ch](i, fnc) * data[ch ^ 1][i - del * fs] || 0;

    // pitch delay
    if (i % (2 * fs) == 0 && rnd(3) < 1) {
      v = [0, 1].map(() => 2 ** (round(rnd(-5, 5)) / 19));
      x = [i, i];
    }

    const a1 = 0.6 * asd(t / dur, 2 / 3) * asd(t / 2, 0.01, 0.01);
    for (let ch = 2; ch--; ) {
      x[ch] -= v[ch];
      data[ch][i] += a1 * lops[ch](lerpArray(data[ch], x[ch]));
    }
  }
}

function tree(data) {
  const a = 0.1;
  function syn(i0 = 0, t0, pl = 0, dr = 1, pp = 0.5, recur) {
    const fc = 800 * 2 ** (pl / 19);
    const fm = (fc * 2 ** ((19 + recur) / 19)) / fc - 1;
    const a0 = min(1, 400 / fc) * sqrt(1 / recur);
    const auto = min(1, (1 - t0 / dur) / 0.333) ** 2;
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * fc * t;
      const e0 = min(t / 0.01, max(0.3, exp(-t)), (dr - t) / 0.01);
      const e1 = min(t / t ** t, (dr - t) / 0.1);
      const m = 0.3 * e1 * sin(fm * p);
      const b = a * auto * a0 * e0 * sin(p + m);
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }
  function branch(t = 0, pl = 0, pp = 0.5, recur = 1) {
    const bag = RndBag.create({ bag: [...Array(7)].map((v, i) => i - 2) });
    const mel = [...Array(4)].map(() => round(pl + bag()));
    for (let j = 4; j--; ) {
      const t0 = t + (0.4 / recur) * j;
      const dr = crush(rnd(4, 8));
      const pl0 = pl + mel[j];
      const pp0 = clip(pp + rnd(-0.2, 0.2));
      if (recur > 4) continue;
      if (pl0 < -19 || pl0 > 19) continue;
      if (t0 + dr > dur - 9) continue;
      if (rnd(mix(2, 4, t / dur)) < 1) continue;
      syn(round(fs * t0), t, pl0, dr, pp, recur);
      branch(t0 + dr, pl0, pp0, recur + 1);
    }
  }

  for (let t = 0; t < dur; t += 30) branch(t);
}

[new Node("synth0"), new Node("synth0"), new Node("tree")].connect(destination);

// function render(data) {
//   const a = 0.5;
//   for (let i = 0, t = 0; t < dur; t = ++i / fs) {
//     const p = 2 * PI * 400 * t;
//     const e = asd(t);
//     const m = e * sin(2 * p);
//     const b = a * e * sin(p + m);
//     for (let ch = 2; ch--; ) data[ch][i] += b;
//     for (let ch = 2; ch--; ) data[ch][i] += 0.3 * data[ch][i - fs / 3] || 0;
//   }
// }

// function syn(i0 = 0, fc = 200, dr = 1) {
//   const a = 0.5;
//   for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
//     const p = 2 * PI * fc * t;
//     const e = asd(t / dr);
//     const m = e * sin(2 * p);
//     const b = a * e * sin(p + m);
//     for (let ch = 2; ch--; ) data[ch][i0] += b;
//   }
// }

// worker.send = { somethingToShare: 0 };
// worker.receive;

// function setup() {
//   // use SeedRandom
//   return { somethingToShare: 1 };
// }

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  seed: "random",
  secStart: 0.5,
  hzLowCut: 20,
  dynamics: { shape: (x) => tanh((1.0 * x) / (1 - 0.5 * (1 - x))) },
  fade: { time: [0, dur / 24], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -1,
  // bitsPerSample: 8,
};

if (dur <= 60) {
  for (const s of "secStart,hzLowCut,dynamics,fade".split(","))
    setting[s] = void 0;
}
