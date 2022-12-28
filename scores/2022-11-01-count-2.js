const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 360];

const bury = (x, d = 0.5) => (1 / (1 - d)) * max(0, x - d);
const mix11 = (v) => 2 ** mix(log2(v), crush(log2(v), 1 / 11), 0.5);
const notes = [1, 10 / 8, 4 / 3, 12 / 8, 15 / 8].map(mix11);
const toFc = (k) => 200 * notes.at(k % 5) * 2 ** floor(k / 5);

function synth0(data) {
  const a = 0.25;
  function syn(t0, i0, k, k1, fAm = 0, dr = 8) {
    const fc = toFc(k);
    const fm = toFc(k + k1) / fc - 1;
    const a0 = min(1, 400 / fc);
    const a1 = 400 / fc / fm;
    const pp = 0.5 + [-0.5, 0.5].at(k % 2) * (k / 15);
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * fc * t;
      const ev = min(t / 0.02, max(0.1, exp(-0.7 * t)), dr - t);
      const tremolo = fAm ? mix(1, am(fAm * (t0 + t + 0.5)), min(t, 1)) : 0.7;
      const m = (0.1 + a1 * tremolo * exp(-5 * t)) * sin(fm * p);
      const b = a * a0 * tremolo * ev * sin(p + m);
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }

  function createMelody() {
    const list = [];
    const bag = [0, 0, 1, 2, 3, 3, 4, 5, 6, 7, 8, 8, 9, 10];
    const rndBag = RndBag.create({ bag });
    for (let i = round(rnd(2, 6)); i--; ) list.push(rndBag());
    list.reduce((a, b, i) => (list[i] = round(mix(b, a, exp(-0.7))))); // iir lp
    return list;
  }

  const sec = (t) => 2 - 0.5 * am(t / 30);

  const melody = [];
  const tPhrase = [];
  const notes = [];
  let fAm, kFm;
  const fAmBag = RndBag.create({ bag: [4, 3, 2.5, 0] });
  const kFmBag = RndBag.create({ bag: [6, 7, 8, 9] });
  for (let i = 0, t = 0; ; i++, t += sec(t)) {
    if (!melody.length && t > (5.5 / 6) * dur) break;
    if (!melody.length && i) t += sec(t) * rnd(2, 6);
    if (!melody.length) fAm = fAmBag();
    if (!melody.length) kFm = kFmBag();
    if (!melody.length) tPhrase.push(round(10 * t) / 10); // send
    if (!melody.length) melody.push(...createMelody());
    const i0 = ceil(fs * t);
    const k = melody.shift();
    notes.push({ i0, k }); // send
    syn(t, i0, k, kFm, fAm);
  }
  worker.send = { tPhrase, notes };
}

function delayHi(oup, inp) {
  const a = 0.35;
  const iList = worker.receive.tPhrase.map((v) => round(fs * v));
  const lop = Lop.create({ k: exp(-1 / fs) });
  const bap = [0, 0].map(() => Filter.create({ type: "band", f: 1000 }));
  let bins;
  for (let i = 0, t = 0, bin = 0; t < dur; t = ++i / fs) {
    if (!i || (i % (fs / 10) == 0 && iList.includes(i))) {
      if (!bins || !bins.length) bins = [1, 1, 0, 0].shuffle();
      bin = bins.shift();
    }

    const a0 = a * lop(bin);
    for (let ch = 2; ch--; ) oup[ch][i] += a0 * inp[ch][i - fs / 2] || 0;

    for (let ch = 2; ch--; )
      oup[ch][i] -= 0.98 * bap[ch](oup[ch ^ 1][i - 3 * fs] || 0);
  }
}

function crusher(oup, inp) {
  const a = 0.5;
  const iList = worker.receive.tPhrase.map((v) => round(fs * v));
  const bp = Filter.create({ type: "band", f: 800 });
  let depth, lSamp;
  const binBag = RndBag.create({ bag: [1, 1, 0, 0] });
  const lenBag = RndBag.create({ bag: [100, 500, 3000].map((v) => fs / v) });
  const depBag = RndBag.create({ bag: [0.1, 0.2, 0.4] });
  for (let i = 0, t = 0, toggle = 0, inpHold = 0; t < dur; t = ++i / fs) {
    if (i % (fs / 10) == 0 && iList.includes(i)) {
      toggle = binBag();
      lSamp = ceil(lenBag());
      depth = depBag();
    }
    if (!toggle) continue;
    if (i % ceil(0.9 * fs) == 0) lSamp = lSamp = ceil(lenBag());
    if (i % ceil(1.1 * fs) == 0) depth = depBag();

    inpHold = i % lSamp == 0 ? inp[0][i] + inp[1][i] : inpHold;
    const b = a * bp(crush(inpHold, depth));
    if (t < dur - 0.3) oup[0][i + fs - fs / 4] -= b;
    if (t < dur - 0.3) oup[1][i + fs - fs / 5] += b;
  }
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) oup[ch][i] += 0.3 * oup[ch ^ 1][i - fs / 2] || 0;
  }
}

function synth1(data) {
  const a = 0.07;
  const notes = worker.receive.notes;
  const bank = {};

  function syn(k, dr = 16) {
    const fc = toFc(k - 5);
    for (let i = 0, t = 0; t < dr; t = ++i / fs) {
      const p = 2 * PI * fc * t;
      const e = asd(t / dr, 0.1, 0.1);
      const m0 = sin(p) + sin(0.999 * p) + sin(1.001 * p);
      const m1 = 2 * sin(p / 2) + sin(2 * p) / 2 + sin(3 * p) / 3;
      const b = e * sin(3 * t + e * (m0 + 0.2 * m1));
      bank[k][i] = b;
    }
  }
  function play({ i0, k }, dr = 16, prog = i0 / fs / dur) {
    if (!bank[k]) (bank[k] = []), syn(k, dr);
    const a0 = a * asd(3 * prog, 0.5) ** 2;
    if (!a0) return;
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const b = a0 * bank[k][i];
      for (let ch = 2; ch--; ) data[ch][i0] += b;
    }
  }
  for (const n of notes) play(n);
}

function delay1(data) {
  const snk = Hold.create({ k: exp(-1 / fs / 4), l: fs / 4 });
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    const x = 10e-3 * snk(i) * fs * sin(t + sin(9 * t));
    for (let ch = 2; ch--; )
      data[ch][i] += 0.5 * lerpArray(data[ch], i - fs + (2 * ch - 1) * x);
  }
}

function bird(data) {
  const a = 0.15;
  function syn(i0 = 0, dr = 1, pp = rnd()) {
    const o0 = rnd(2, 3);
    const o1 = o0 + rnd(-1.5, -0.5);

    const a0 = 10 ** -rnd(2.5);
    const cr = mix(1 / 1, 1e-3, asd(i0 / fs / dur, 5 / 6));
    const lop = Lop.create({ k: exp(-150 / fs), y1: 1.5 });
    for (let i = 0, t = 0, p = 0; t < dr; t = ++i / fs, ++i0) {
      const f = 200 * 2 ** lop(crush(mix(o0, o1, t / dr), cr));
      const a1 = 200 / f;
      const e = asd(t / dr, 0.01, 0.5);
      p += 2 * PI * f * (1 / fs);
      const b = a * a0 * a1 * e * sin(p + 0.5 * a1 * sin(p / 2));
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }
  const next = (t) => (!t ? 10 : t + rnd(0.02, mix(3, 0.15, (t / dur) ** 0.5)));

  for (let i = 0, t = 0; t < dur - 5; i++) {
    t = next(t);
    const pp = rnd();
    do {
      const dr = rnd(0.2, 0.5);
      syn(ceil(fs * t), dr, pp);
      t += dr * rnd(1, 1.5);
    } while (rnd(5) < 2);
  }
}

function reverb(oup, inputs) {
  // send
  const aSend = [-6, 0, -20, -3, 0].map((v) => 10 ** (v / 20));
  const early = round(50e-3 * fs);
  for (const [idx, inp] of inputs.entries()) {
    for (let i = early, t = 0; t < dur; t = ++i / fs) {
      for (let ch = 2; ch--; ) oup[ch][i] += aSend[idx] * inp[ch][i - early];
    }
  }

  // feedback delay
  const num = 8;
  const lopF = (i) => 6e3 * exp(-2.5 * (i / (num - 1)));
  const list = [...Array(num)].map((v, i) => {
    const o = {};
    o.i = i;
    o.a = 0.5 ** ceil((i + 1) / 2);
    o.s = round(fs * 50e-3 * 1.5 ** i);
    o.lop = Lop.create({ k: exp(-2 * PI * (lopF(i) / fs)) });
    return o;
  });

  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (const el of list) {
      const sDel = i - el.s;
      if (sDel < 0) continue;
      oup[el.i % 2][i] += el.a * el.lop(oup[(el.i + 1) % 2][sDel]);
    }
  }

  // dry
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (const inp of inputs) {
      for (let ch = 2; ch--; ) oup[ch][i] += inp[ch][i];
    }
  }
}

const nSyn = new Node("synth0");
const nCru = new Node("crusher", 1);
const nDel = new Node("delayHi", 1);
const nRev = new Node("reverb", 2);
nSyn.connect(nDel).connect(nCru, nRev);
nSyn.connect(nCru, nRev);
nCru.connect(nRev);
nSyn.connect(new Node("synth1", 1)).connect(new Node("delay1")).connect(nRev);
new Node("bird").connect(nRev);
nRev.connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  // seed: 1,
  secStart: 0.5,
  hzLowCut: 20,
  dynamics: { in: -3, shape: (x) => tanh(x / (1 - 0.5 * (1 - x))) },
  fade: { time: [0, dur / 18], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -1,
  // bitsPerSample: 8,
};
