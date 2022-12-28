const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 360];

function fall(data) {
  function syn(i0, dr, o = rnd(1, 4), oct1 = rnd(1, 4)) {
    if (rnd() < 0.7) syn(i0 + ceil(rnd(0.02 * fs, fs, 2)), 0.8 * dr, o, oct1);

    const legato = rnd(9) < 8 ? exp(-3 / fs / rnd(0.25, 0.5)) : exp(-0.01 / fs);
    const fm = rnd(0.333, 3, 2);
    const a0 = 0.4 * rnd(1 / dr ** 0.2);
    const a1 = 1 / fm / dr ** 0.2;
    const atk = rnd(0.05, 0.95);

    for (let i = 0, t = 0, p = 0, pp = rnd(); t < dr; t = ++i / fs) {
      if (i % (fs / 8) == 0 && rnd() < 0.2 / 8) oct1 = rnd(0.7, 4);
      o = oct1 + (o - oct1) * legato;
      const fall = 0.15 * (t / 12) ** 2;
      p += 2 * PI * 50 * 2 ** (o - fall) * (1 / fs);
      const m = a1 * (0.5 / (o + 0.5)) * sin(fm * p);
      const b = a0 * (1 / (o + 1)) * asd(t / dr, atk) * sin(p + m);
      for (let c = 2; c--; ) data[c][i0 + i] += pan(c ? pp : 1 - pp) * b;
    }
  }
  for (let t = 1; t < dur - 15; t += rnd(4, 32))
    syn(ceil(fs * t), rnd(0.5, 12));
}

function talk(data) {
  function syn(i0, dr, oct) {
    if (rnd() < 0.7) syn(i0 + ceil(rnd(0.02 * fs, fs, 2)), dr, oct);
    const fm = rnd(1, 4);
    const a0 = (1 / fm / dr ** 0.2) * (0.5 / (oct + 0.5));
    const a1 = 0.4 * rnd(0.9 / dr ** 0.2) * (1 / (oct + 1));
    const fc = 50 * 2 ** oct;
    for (let i = 0, t = 0, p = 0, pp = rnd(); t < dr; t = ++i / fs) {
      p += 2 * PI * fc * (1 / fs);
      const m = a0 * sin(fm * p);
      const b = a1 * asd(t / dr, 0.5) * sin(p + m);
      for (let c = 2; c--; ) data[c][i0 + i] += pan(c ? pp : 1 - pp) * b;
    }
  }
  for (let t = 4; t < dur - 15; t += 2 ** ceil(rnd(-4, 5, 2))) {
    const dr = rnd(2) < 1 ? 0.1 : 0.2;
    const o = rnd(2, 3);
    syn(ceil(fs * t), dr, o);
  }
}

function wind(data) {
  function syn(i0, dr) {
    const atk = rnd(0.01, 0.99, 2);
    const dcy = min(1 - atk, rnd(0.01, 0.99, 2));
    const btm = 200 * 2 ** rnd(2);
    const top = 200 * 2 ** rnd(2, 4);
    const fLfo = 2 ** rnd(-6, 2);
    const lop = Lop.create({ k: exp((-7 * 2 * fLfo) / fs) });
    const q = 2 ** rnd(5);
    const bnd = Filter.create({ q, type: "band", u: 1 });
    const a0 = 10 ** -crush(rnd(), 1 / 3);
    const pp = rnd(0.1, 0.9);
    for (let i = 0, t = 0, tgl = 0; t < dr; t = ++i / fs, ++i0) {
      if (i % ceil(fs / fLfo / 2) == 0) tgl ^= 1;
      const a = 0.01 * a0 * asd(t / dr, atk, dcy);
      const m = btm + (top - btm) * lop(tgl);
      const b = a * bnd(2 * random() - 1, m);
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }
  for (let i = 0; i < 0.1 * dur; i++) {
    syn(ceil(fs * rnd(0.5, dur - 16)), 2 ** round(rnd(-3, 3)));
  }
}

function delay(data) {
  for (let i = worker.id; i--; ) random();
  function del(data, i0, dr) {
    const ar = rnd(0.01, 2, 3);
    const d = fs * rnd(0.01, 0.3);
    const pp = rnd();
    const ch = data.at(rnd(2));
    for (let i = 0, t = 0; t < dr; t = ++i / fs) {
      const b = 0.95 * min(t / ar, 1, (dr - t) / ar) * ch.at(i0 + i - d);
      for (let c = 2; c--; ) data[c][i0 + i] += pan(c ? pp : 1 - pp) * b;
    }
  }

  for (let t = 1, dr = 2; t < dur - 15; t += dr + rnd(0, 12)) {
    dr = rnd(4, 12);
    del(data, ceil(fs * t), dr);
  }
}

const nDel = [0, 0, 0].map(() => new Node("delay"));
new Node("fall").connect(nDel[0], nDel[1], destination);
new Node("talk").connect(nDel[1], nDel[2], destination);
new Node("wind").connect(nDel[2], nDel[0], destination);
nDel.connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80
const setting = {
  seed: 0,
  hzLowCut: 20,
  dynamics: { shape: (x) => tanh((1.0 * x) / (1 - 0.5 * (1 - x))) },
  dbPeak: -1,
  bitsPerSample: 8,
};
