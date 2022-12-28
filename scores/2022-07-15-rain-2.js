const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 360];

function synth(data) {
  const a = 0.5;
  const fm = 2 ** (10 / 7) - 1;
  const f1 = 2 ** (+8 / 7);

  class Plate {
    constructor(j) {
      this.v0 = exp(-j / 2);
      this.pp = 0.5 + [0.5, -0.5].at(j % 2) * (ceil((j + 1) / 2) / 4);
      this.fc = 200 * 2 ** (floor(1.5 * (j - 3)) / 7); // 120 - 363
      this.lop = Filter.create({ f: 3e3, q: 0.7 });
    }
    process(i, t, j, v, n0) {
      const { fc, v0, pp } = this;
      const p = 2 * PI * fc * t;
      const p0 = (n0 * v0) % 1;

      // short
      const e0 = min(p0 / 0.02, exp(-33 * p0));
      const a0 = mix(v / 9, 1, 0.7);
      // const a1 = mix(v / 9, 1, 0.7);
      const m0 = 6.0 * a0 * e0 ** 2 * sin(fm * p);
      const b0 = 1.0 * a0 * e0 * mix(sin(p / 2 + m0), sin(8 * p), 0.15);

      // long
      const b2 = j < 3 ? 0 : sin((99 / j) * t + 3 * exp(-p0 / 2) * sin(f1 * p));
      const b1 = 0.12 * asd(p0, 0.2) * b2;

      const b = a * (0.1 + v / 10) * this.lop(tanh(b0) + b1);
      for (let c = 2; c--; ) data[c][i] += pan(c ? pp : 1 - pp) * b;
    }
  }

  const plates = [...Array(8)].map((v, i) => new Plate(i));

  const id = worker.id % 2;
  const durSect = dur / 3;
  for (let i = 0, t = 0, n0 = 0, v = 1, v1 = 9; t < dur; t = ++i / fs) {
    for (let j = 4; j--; ) {
      const j0 = 4 * id + j;
      plates[j0].process(i, t, j0, v, n0);
    }
    for (let ch = 2; ch--; ) data[ch][i] += 0.3 * data[ch ^ 1].at(i - fs / 25);
    n0 += v / fs;

    const t0 = t % durSect;
    if (t0 < 0.5 * durSect && t / durSect < 2) {
      v1 = 9 * (t0 / (0.5 * durSect)) ** 1.5;
      v = v1 + (v - v1) * exp(-7 / fs);
    } else {
      if (i % (6 * fs) == 0) v1 = 9 * 4 ** -(t0 / durSect) * random();
      v = v1 + (v - v1) * exp(-1 / fs);
    }
  }
}

function mud(data) {
  const a = 0.1;
  const start = (1 / 3) * dur;

  class Arp {
    bandpass = Filter.create({ type: "band", q: 500, u: 1 });
    portamento = Lop.create({ k: exp(-7 / fs / 0.01), y1: 200 });
    f = 400;
    process(i, input, bass) {
      if (!i || (i % (fs / 10) == 0 && rnd() < 0.1)) {
        const f0 = 2 ** crush(rnd(), 1 / 7);
        this.f = bass * f0;
      }
      return this.bandpass(input, this.portamento(this.f));
    }
  }

  const ars = [new Arp(), new Arp(), new Arp(), new Arp()];
  const lopAmp = Lop.create({ k: exp(-1e3 / fs) });
  const lop = Filter.create({ f: 1.5e3, q: 0.5 });
  const hip = Filter.create({ type: "high", f: 300, q: 0.7 });
  const decay = exp(-0.01 / fs);
  let t = start;
  for (let i = floor(fs * start), a0 = 0, b = 0; t < dur; t = ++i / fs) {
    if (i % (6 * fs) == 0) a0 = 1;
    else a0 *= decay;

    const p = 2 * PI * 100 * t;
    b = lopAmp(a0) * sin(22 * t + sin(p + b) + sin(p / 2));

    const b0 =
      ars[0].process(i, b, 400) +
      ars[1].process(i, b, 400) +
      ars[2].process(i, b, 800) +
      ars[3].process(i, b, 800);

    const auto = asd((t - start) / (dur - start), 0.2, 0.1);
    const b1 = a * auto * hip(lop(0.3 * tanh(b0) + b));
    for (let ch = 2; ch--; ) data[ch][i] += b1;
    for (let ch = 2; ch--; ) data[ch][i] += 0.7 * data[ch][i - fs / 3] || 0;
  }
}

function purr(data) {
  const a = 0.55;
  const start = (1 / 2) * dur;
  const f0 = [7, 7];
  const f1 = [7, 7];
  const lop = [0, 1].map(() => Filter.create({ f: 2000, q: 0.7, u: 1 }));
  function feedback(i, t, ch, pp) {
    if (i % (5 * fs) == 0) f1[ch] = 7 + 0.3 * (random() - random());
    f0[ch] = mix(f1[ch], f0[ch], exp(-0.1 / fs / 5));
    const b0 = tanh((3 + 6 * am(t / 5)) * lerpArray(data[ch], i - fs / f0[ch]));
    const b = lop[ch](b0, 2000 + 1000 * sin((1 - 2 * ch) * t));
    for (let c = 2; c--; ) data[c][i] += 0.25 * pan(c ? pp : 1 - pp) * b;
  }
  for (let i = round(fs * start), t = start, p = 0; t < dur; t = ++i / fs) {
    const fc = 5 * 5 ** ((5 / 25) * am(3 * am(t / 1.3)));
    p += 2 * PI * fc * (1 / fs);
    const b = sin(p + 22 * mix(am(t / 1.1)) * sin(3.623898318388478 * p));
    for (let ch = 2; ch--; ) data[ch][i] -= 0.15 * b;
    feedback(i, t, 0, 0.15);
    feedback(i, t, 1, 0.85);
  }
  for (let i = round(fs * start), t = start; t < dur; t = ++i / fs) {
    const a0 = a * ((t - start) / (dur - start));
    for (let c = 2; c--; ) data[c][i] *= a0;
  }
}

[new Node("synth"), new Node("synth")].connect(destination);
[new Node("mud"), new Node("purr")].connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  // seed: 1,
  secStart: 0.5,
  hzLowCut: 20,
  dynamics: { shape: (x) => tanh((1.2 * x) / (1 - 0.6 * (1 - x))) },
  fade: { time: [0, dur / 18], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -1,
  // bitsPerSample: 8,
};


//// dynamics
// const [a, m] = [1, 2]; // downward, upward
// const k = -(m - 1) / m;
// const pot = (x, k = 0) => x / (1 + (1 - x) * k); // https://electronics.stackexchange.com/questions/304692/
// const shape0 = (x) => tanh(a * pot(x, k));
// const shape1 = (x) => tanh(1.0 * x / (1 - 0.5 * (1 - x)));
