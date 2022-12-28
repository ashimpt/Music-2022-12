const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 360];

const notes = [1, 9 / 8, 10 / 8, 12 / 8, 15 / 8].map((v) => log2(v));
const octNum = (n) => notes.at(n % 5) + floor(n / 5);
const oct = (n, p = 0, o = octNum(n)) => mix(o, crush(o, 1 / 5), am(p / 2));

const bpm = 100;
const fEv = [0.5, 1, 2, 4, 6, 8, 12];
const lEvList = fEv.map((f) => ceil((120 / bpm) * (fs / f)));

function arp(data) {
  function syn(pp = 0, i0 = 0, f0, dr = 1) {
    const a0 = 100 / f0;
    const fm = 2 ** oct(7, i0 / fs / dur) - 1;
    const bp = Filter.create({ type: "band", f: 4 * f0, q: 128 });
    for (let i = 0, t = 0, b = 0; t < dr; t = ++i / fs, ++i0) {
      const p0 = 2 * PI * f0 * t;
      const e0 = exp(-22 * t);
      const m1 = 2.5 * e0 * b;
      const m0 = min(1.5, 2 * a0) * exp(-t) * sin(fm * p0 + m1);
      const b0 = sin(p0 + m0);
      const b1 = 0.2 * e0 * bp(b0);
      b = min(0.333, a0) * asd(t / dr, 0.01) * (b0 + b1);
      for (let ch = 2; ch--; ) data[ch][i0] += (ch ? pp : 1 - pp) * b;
    }
  }

  const rndLenEv = (p) => lEvList.at(rnd(fEv.length) * asd(1.5 * p, 0.3, 0.3));
  const lawL = (pre, lo = 18, hi = 25, p = 4 / 24) =>
    rnd() < p || pre + 1 > hi ? round(rnd(lo, hi / 2)) : pre + 1;
  const obj = (plate, pp) => ({ lEv: 0, iNext: 0, plate, pp });
  const voices = [obj(5, 0.15), obj(10, 0.85)];
  const lUpdateBeat = lEvList[0];
  const snkHi = Hold.create({ k: exp(-0.1 / fs), l: 15 * fs });
  const bagHi = RndBag.create({ bag: [0, 1, 2, 3, 4, 5] });
  // score
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    if (!i || i % lUpdateBeat == 0) {
      for (const v of voices) v.lEv = rndLenEv(t / dur);
    }

    const hi = 20 + snkHi(i, bagHi);
    for (const v of voices) {
      if (i < v.iNext) continue;
      v.iNext += v.lEv;
      const pre = v.plate;
      v.plate = lawL(v.plate, 3, hi, 0);
      while (abs(voices[0].plate - voices[1].plate) < 2 || pre == v.plate)
        v.plate = lawL(v.plate, 3, hi, 1);
      const f0 = 50 * 2 ** oct(v.plate, t / dur);
      syn(v.pp, i, f0, v.lEv / 2 / fs);
    }
  }
}

function delay(oup, inp) {
  const dry = 0.75;
  const opt = { l: fs / 3, k: exp(-9 / fs) };
  const rtl = [Hold.create(opt), Hold.create(opt)];
  const pDelTim = ceil((120 / bpm) * (+2 / 16) * fs);
  const delTime = ceil((120 / bpm) * (17 / 16) * fs);
  const hip = [0, 0].map(() => Filter.create({ type: "high", f: 50, q: 0.7 }));
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) oup[ch][i] += 0.25 * inp[ch][i - pDelTim] || 0;
    const i0 = i - delTime;
    const lm = 2.0e-3 * fs * rtl[0](i);
    const rm = 2.0e-3 * fs * rtl[1](i);
    oup[0][i] += 0.98 * hip[0](lerpArray(oup[1], i0 - lm));
    oup[1][i] += 0.98 * hip[1](lerpArray(oup[0], i0 - rm));
  }

  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) oup[ch][i] += dry * inp[ch][i];
  }
}

function crusher(oup, inp) {
  const lop = Filter.create({ f: 1e3, q: 4, u: 1 });
  const hip = Filter.create({ type: "high", f: 200, q: 0.3 });

  const lopA = Lop.create({ k: exp(-7 / fs / 0.1) });
  const snkBC = Hold.create({ k: exp(-70 / fs), l: fs });
  const snkLP = Hold.create({ k: exp(-1 / fs), l: 4 * fs });
  const start = 0; //crush(dur / 8, 16);
  let delL, delR;
  let [tgl, iTgl, fade, fadeK] = [0, 0, 0, exp(-1 / fs / (dur / 6))];
  for (let i = ceil(start * fs), t = start; t < dur; t = ++i / fs) {
    // delay
    if (i % (6 * fs) == 0) delL = ceil(crush(rnd(0.25, 0.9), 1 / 16) * fs);
    if (i % (5 * fs) == 0) delR = ceil(crush(rnd(0.25, 0.9), 1 / 16) * fs);
    oup[0][i] += 0.9 * asd(t / 6, 0.3, 0.01) * oup[1][i - delL] || 0;
    oup[1][i] += 0.9 * asd(t / 5, 0.3, 0.01) * oup[0][i - delR] || 0;

    fade = mix(t / dur < 5 / 6 ? 1 : 0, fade, fadeK);
    const monoIn = inp[0][i - ceil(fs / 2)] + inp[1][i - ceil(fs / 4)] || 0;
    const b1 = fade * monoIn + oup[0][i] + oup[1][i];
    const b0 = crush(b1, 0.1 + 0.4 * snkBC(i));
    const b = 70e-3 * hip(lop(b0, 800 * 2 ** (-0.5 + 2.5 * snkLP(i))));
    if (tgl && abs(b) > 0.06)
      (tgl = 0), (iTgl = 0), console.log(~~(t / 60), ~~t % 60);
    // if (tgl && abs(b) > 0.1) (tgl = 0), (tglCount = 0);
    else if (iTgl++ > 2 * fs) tgl = 1;
    const a = lopA(tgl);
    for (let ch = 2; ch--; ) oup[ch][i] += a * b;
  }
}

function hi(data) {
  const a = 45e-3;
  const lopO = Lop.create({ k: exp(-2 / fs), y1: 1 });
  const lop = Filter.create({ f: 3e3 });
  const l = 4 * fs;
  let o0, f1, f2;
  const start = crush((fs * dur) / 4, l);
  const rndBag = RndBag.create({ bag: [...Array(10)].map((v, i) => i) });
  for (let i = start, t = 0, p = 0; t < dur; t = ++i / fs) {
    if (i % l == 0) {
      const n = 5 + rndBag();
      o0 = oct(n, t / dur);
      f1 = 2 ** (oct(n + 3, t / dur) - o0) - 1;
      f2 = 2 ** (oct(n - 3, t / dur) - o0) - 1;
    }
    const env = asd(i / l, 0.01, 0.1);
    const vb = 30e-3 * ((i / l) % 1) * sin(15 * (o0 + 1) * t);
    p += 2 * PI * 200 * 2 ** (lopO(o0) + vb) * (1 / fs);
    const a0 = asd(-1 / 3 + (4 / 3) * (t / dur), 0.2, 0.5) * env;
    const m = sin(p) + sin(f1 * p) / 2 + sin(f2 * p) / 2;
    const b = a * a0 * lop(sin(9 * t + 0.8 * m));
    for (let ch = 2; ch--; ) data[ch][i] += b;
    data[0][i] += 0.9 * data[1][i - 1.2 * fs] || 0;
    data[1][i] += 0.9 * data[0][i - 1.3 * fs] || 0;
  }
}

function qSynth(data) {
  const a = 4e-3;
  function syn(i0 = 0, idx, dr = 4) {
    const p0 = i0 / fs / dur;
    const a0 = p0 < 0.5 ? 0 : pot(asd(2 * p0, 1.5 / 3), -0.5);
    if (!a0) return;
    const rndLenEv = () => lEvList.at(rnd(5 * p0, fEv.length));
    const bap = Filter.create({ type: "band", f: 400, u: 1, q: 100 });
    const lop = Lop.create({ k: exp(-7 / fs / 0.1) });
    const pp = mix(0.5, (idx % 4) / 3, 0.9);
    const f0 = 50 * 2 ** oct(rnd(5), p0);
    let lEv, fc;
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      if (!i || i % lEv == 0) {
        lEv = rndLenEv();
        fc = 800 * 2 ** oct(rnd(10), p0);
      }
      const p = 2 * PI * f0 * t;
      const b0 = bap(sin(p + 50 * sin(p / 4)), lop(fc));
      const b = a * a0 * asd(t / dr, 0.1, 0.3) * b0;
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }

  for (let i0 = 0, i = 0; i0 < dur * fs; i0 += lEvList[2]) {
    syn(i0, i++);
  }

  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) data[ch][i] += 0.7 * data[ch][i - fs / 4] || 0;
  }
}

const nDel = new Node("delay", 1);
new Node("arp").connect(nDel).connect(destination);
nDel.connect(new Node("crusher", 1)).connect(destination);
new Node("hi").connect(destination);
new Node("qSynth").connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80
const setting = {
  seed: 0,
  secStart: 0.5,
  hzLowCut: 20,
  dynamics: { shape: (x) => tanh((1.0 * x) / (1 - 0.5 * (1 - x))) },
  fade: { time: [0, dur / 12], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -1,
  bitsPerSample: 8,
};
