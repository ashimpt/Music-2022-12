const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 120];

const notes = [10 / 8, 4 / 3, 12 / 8, 15 / 8, 2].map((v) => log2(0.8 * v));
const mix9 = (i, p, o = notes.at(i % 5)) => mix(o, crush(o, 1 / 9), p);
const fc = (i, t = 0) => 200 * 2 ** (mix9(i, 1 - am(t / dur)) + floor(i / 5));

const mods = [9, 11, 13, 11, 9];
const numSects = mods.length;
const durSect = dur / numSects;

function synth(data) {
  const a = 0.3;
  function syn(i0 = 0, pl, f0 = 200, dr = 0.3) {
    const pp = 0.5 + [-0.5, 0.5].at(pl % 2) * (pl / 14);
    const a0 = min(1, 400 / f0);
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * f0 * t;
      const e = asd(t / dr, 0.01);
      const b = a * e * a0 * sin(p + 0.7 * e * a0 * sin(2 * p));
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }

  let sect = 0;

  const secPerNote = (p) => 60 / 4 / mix(50, 150, am((2 / 3) * p + 1 / 3));
  const melody = (i, t, pl = i % mods[sect]) => [i % 4 ? 0 : fc(pl, t), pl];
  const melRnd = (t, pl = floor(rnd(10, 15))) => [fc(pl, t), pl];

  for (let i = 0, t = 0, table = []; t < dur - 5; i++) {
    const prog = t / dur;
    const progSect = (numSects * prog) % 1;

    if (sect != floor(numSects * prog)) (i = 0), (table.length = 0);
    sect = floor(numSects * prog);

    if (table.length == 0) {
      const l = 10;
      const threshold = floor(0.5 * l * progSect ** 2);
      for (let j = l; j--; ) table[j] = j < threshold;
      while (table[0]) table.shuffle();
    }

    if (t % durSect < durSect - 2) {
      const [f0, pl0] = melody(i, t);
      const [f1, pl1] = table.shift() ? melRnd(t) : [0, 0];
      if (f0) syn(ceil(fs * t), pl0, f0);
      if (f1 && f0 != f1) syn(ceil(fs * (t + 5e-3)), pl1, f1, 0.6);
    }
    t += secPerNote(progSect);
  }
}

function delay(oup, inp) {
  const tDel = [];
  function del(oup, i0, dr, c) {
    if (!tDel.length) for (let i = 4; i--; ) tDel.push(0.15 + 0.05 * i);
    const d = ceil(fs * tDel.shuffle().shift());
    const ch = inp.at(c % 2);
    const pp = c % 2 ? 0.2 : 0.8;
    const hp = Filter.create({ type: "high", f: 400, q: 0.45 });
    const a0 = min(1, dr / 4);
    for (let i = 0, t = 0; t < dr; t = ++i / fs) {
      const a1 = a0 * asd(t / dr, 0.97);
      const x = i0 + i - d;
      const b = a1 * hp(ch.at(x) + 3.5 * oup[c % 2].at(x));
      for (let c = 2; c--; ) oup[c][i0 + i] += pan(c ? pp : 1 - pp) * b;
    }
  }

  for (let sect = 0, c = 0; sect < numSects; sect++)
    for (let t = 4, dr; t < durSect - 2; t += max(4, dr - 1)) {
      dr = min(rnd(4, 8), max(0, durSect - 1.5 - t));
      if (dr > 1) del(oup, ceil(fs * (t + sect * durSect)), dr, c++);
    }

  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) oup[ch][i] *= 1.7;
    for (let ch = 2; ch--; ) oup[ch][i] += inp[ch][i];
  }
}

new Node("synth").connect(new Node("delay", 1)).connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  // seed: 1,
  secStart: 0.5,
  hzLowCut: 20,
  fade: { time: [0, 1], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -4,
  // bitsPerSample: 8,
};
