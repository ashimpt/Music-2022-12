const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 360];

const oct0 = [1, 8 / 7, 4 / 3, 3 / 2, 7 / 4].map((v) => log2(v));
const mix5 = (i, p, o = oct0.at(i % 5)) => mix(o, crush(o, 0.2), am(3 * p));
const fc = (i, t = 0) => 100 * 2 ** (mix5(i, t / dur) + floor(i / 5));

const autoAmpH = (t) => pot(clip(1.5 * asd(t / dur, 0.5)));

function ore(data) {
  const a = 0.3;
  const bagA = RndBag.create({ bag: [0.03, 0.1, 0.3, 1] });
  function syn(i0, note = rnd(0, 16), dr = 7) {
    const t0 = i0 / fs;
    const fc0 = fc(note, t0);
    const pp = 0.5 + [-0.5, 0.5].rnd() * rnd(fc0 / 800) ** 0.5;
    const fm0 = fc(note + round(rnd(6, 8)), t0) / fc0 - 1;
    const fm1 = fc(note + round(rnd(1, 3)), t0) / fc0 - 1;
    const a0 = bagA();
    const a1 = 2 * min(1, 200 / fc0) * min(2, 0.3 / a0);
    const a2 = a * (1 - 0.3 * autoAmpH(t0)) * min(1, 300 / fc0) * a0;
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * fc0 * t;
      const e0 = asd(t / dr, 1e-3);
      const m1 = exp(-9 * t) * sin(fm1 * p);
      const m0 = a1 * e0 * exp(-0.5 * t) * sin(fm0 * p + m1);
      const b = a2 * e0 * sin(p + m0);
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }

  const wkr = worker.id % 2;
  if (wkr) random(); // for seeds

  // seq
  const t0 = 4;
  for (let i = 0; i * t0 < dur - 9; i++) {
    const i0 = crush((i * t0 + rnd(t0 - 1.5)) * fs, fs / 5);
    syn(!i ? 0 : i0);
  }

  //delay
  const del0 = ceil((3 - wkr - 1e-3) * fs);
  const del1 = ceil((3 - wkr - 2e-3 * wkr) * fs);
  const [ph0, ph1] = [wkr ? 51 : 43, wkr ? 53 : 41];
  const high0 = Filter.create({ type: "high", f: 200, q: 0.3 });
  const high1 = Filter.create({ type: "high", f: 200, q: 0.3 });
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    const m0 = 0.8e-3 * fs * am(2 * ph0 * am(t / ph0));
    const m1 = 0.8e-3 * fs * am(2 * ph1 * am(t / ph1));
    data[0][i] += 0.98 * high0(lerpArray(data[0], i - del0 - m0));
    data[1][i] += 0.98 * high1(lerpArray(data[1], i - del1 - m1));
  }
}

function h2o(data) {
  const a = 0.18;
  function syn(n, i0, t0) {
    const phase = am(t0 / dur) ** 3;
    const a1 = autoAmpH(t0);

    if (a1 == 0) return;
    const a0 = a1 * mix(10 ** -rnd(), 0.4, 0.7 * phase);
    i0 = ceil(mix(i0, crush(i0, fs / 5), phase));
    const dr = mix(rnd(0.02, 0.16), 0.3, phase);
    const fc2 = fc(10 + round(rnd(2)), t0);
    const fc0 = mix(rnd(200, +400), fc2, phase);
    const fc1 = mix(rnd(600, 1600), fc2, phase);
    const fm = mix(rnd(0.5, 2), 2, phase);
    const pp0 = mix(round(rnd()), rnd(), 0.1);
    const pp = mix(pp0, 0.5, 0.5 * phase);
    const bandpass = Filter.create({ type: "band", u: 1 });
    for (let i = 0, t = 0, p = 0; t < dr; t = ++i / fs, ++i0) {
      const f = mix(fc0, fc1, (t / dr) ** 3);
      p += 2 * PI * 0.5 * f * (1 / fs);
      const e0 = am(t / dr);
      const b0 = sin(p + (1 + phase) * sin(fm * p));
      const b = a * a0 * e0 * bandpass(b0, f);
      for (let c = 2; c--; ) data[c][i0] += pan(c ? pp : 1 - pp) * b;
    }
  }

  const next = (t) => rnd(0.03, 0.1) * (1 + 7 * am(t / dur + 0.5));
  for (let t = 0, n = 0; t < dur - 9; t += next(t)) syn(n++, ceil(fs * t), t);

  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) data[ch][i] += 0.8 * data[ch][i - 9 * fs] || 0;
    data[0][i] += 0.15 * data[1][i - 0.052 * fs] || 0;
    data[1][i] += 0.15 * data[0][i - 0.051 * fs] || 0;
  }
}

function air(data) {
  const a = 0.3;

  function syn(i0, t0, dr = rnd(3, 6)) {
    function fc0(t = 0, t1 = 0) {
      const n = 5 + (t0 % 7) - 5 * (t / dr) + crush(4 * am(t0 + t1), 2);
      return fc(crush(n, 1.2), t0 + dr);
    }
    const lop = Lop.create({ k: exp(-99 / fs), y1: fc0() });
    const bp = Filter.create({ type: "band", q: 750, u: 1 });
    const a1 = min(1, (dur - t0) / dur / 0.333);
    const panStart = rnd();
    const speed = rnd(0.2, 0.5);
    for (let i = 0, t = 0, f0; t < dr; t = ++i / fs, ++i0) {
      if (i % (fs / 10) == 0 && dr - t > 0.2) f0 = fc0(t, speed * t);
      const a0 = a * a1 * asd(t / dr, 0.01, 0.1);
      const f1 = lop(f0);

      const b1 = 60e-3 * min(1, 400 / f1) * bp(2 * random() - 1, lop(f1));
      const b = a0 * tanh(b1);
      const pp = am(t / 5 + panStart);
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }

  // score
  const bag = RndBag.create({ bag: [15, 30, 45] });
  for (let t = 30; t < dur; t += bag()) syn(ceil(fs * t), t);

  // delay
  function createDelayObj() {
    const d = [1, 2, 3, 4].rnd();
    const l = [2, 3, 4, 5].rnd() * fs;
    return { ds: fs / d, a: 0.9 * cbrt(1 / d), l, i0: 0 };
  }
  const dObjs = [createDelayObj(), createDelayObj()];

  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) {
      if (dObjs[ch].i0++ == dObjs[ch].l) dObjs[ch] = createDelayObj();
      const { ds, a, l, i0 } = dObjs[ch];
      data[ch][i] += a * asd(i0 / l, 0.05, 0.05) * data[ch ^ 1][i - ds] || 0;
    }
  }
}

function feu(data) {
  const a = 0.25e-3;
  const num = 4;
  const { 0: L, 1: R } = data;
  for (let j = num; j--; ) {
    let i0 = ceil(fs * dur * rnd(+0, 0.2));
    let i1 = ceil(fs * dur * rnd(0.8, +1));
    const dr = (i1 - i0) / fs;
    const lop = Filter.create({ u: 1, q: 16 });
    for (let i = 0, t = 0, p = 0, f; t < dr; t = ++i / fs) {
      if (i % fs == 0) f = fc(15 - j, t);
      p += 2 * PI * f * (1 / fs);
      const p0 = p + 3 * am((2 + j / 9) * t);
      const m = (1 - 0.9 * am((7 + j / 8) * t)) * sin(2.98 * p0);
      const a = asd(t / dr, 0.1, 0.1);
      const fLop = 800 + 1600 * asd(t / (9 + j), 0.1);
      L[i0++] += a * lop(sin(p0 + m), fLop);
    }
  }

  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    R[i] = L[i] = a * L[i];
    L[i] += 0.95 * R[i - 5 * fs] || 0;
    R[i] += 0.95 * L[i - 4 * fs] || 0;
  }
}

function reverb(oup, inputs) {
  const thru = 0;
  // send
  const aSend = [-18, -18, -12, -9, -24].map((v) => 10 ** (v / 20));
  const early = round(50e-3 * fs);
  for (const [idx, inp] of inputs.entries()) {
    const opt = { type: "high", f: 200, q: 0.7 };
    const hip = [0, 1].map((v) => Filter.create(opt));
    for (let i = early, t = 0; t < dur; t = ++i / fs) {
      for (let ch = 2; ch--; )
        oup[ch][i] += aSend[idx] * hip[ch](inp[ch][i - early]);
    }
  }

  // feedback delay
  const num = 8;
  const list = [...Array(num)].map((v, i) => {
    const o = {};
    o.i = i;
    o.a = 0.5 ** ceil((i + 1) / 2);
    o.s = round(fs * 51e-3 * 1.5 ** i);
    return o;
  });

  for (let i = thru ? round(dur * fs) : 0, t = 0; t < dur; t = ++i / fs) {
    for (const el of list) {
      const sDel = i - el.s;
      if (sDel < 0) continue;
      oup[el.i % 2][i] += el.a * oup[(el.i + 1) % 2][sDel];
    }
  }

  // dry
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (const inp of inputs) {
      for (let ch = 2; ch--; ) oup[ch][i] += inp[ch][i];
    }
  }
}

const nRev = new Node("reverb", 2);
[new Node("ore"), new Node("ore")].connect(nRev);
[new Node("h2o"), new Node("air"), new Node("feu")].connect(nRev);
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
