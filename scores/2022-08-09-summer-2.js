const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 360];

const notes = [1, 9 / 8, 4 / 3, 3 / 2, 16 / 9].map((v) => log2(v));
const mp = (p) => am(p);
const mix7 = (pl, p, o = notes.at(pl % 5)) => mix(o, crush(o, 1 / 7), mp(p));
const fc = (pl, p) => 100 * 2 ** (mix7(pl, p) + floor(pl / 5));

function ore(data) {
  const a = 0.4;
  for (let i = worker.id; i--; ) random();
  const plates = [0, 2, 5, 5, 7, 7, 8, 9, 10, 10, 11, 12, 13, 14, 15, 16];
  const bagPl = RndBag.create({ bag: plates });
  const bagAmp = RndBag.create({ bag: [0.1, 0.2, 0.3, 0.6, 1] });

  function syn(i0, dr = 5) {
    const prog = i0 / fs / dur;
    const pl = bagPl();
    const f0 = fc(pl, prog);
    const f1 = fc(pl + 9, prog) / f0 - 1;
    const a1 = 0.6 * (100 / f0);
    const a0 = min(prog / 0.33, 1) ** 2 * min(1, 400 / f0) * bagAmp();
    if (prog < 0.5 / 6 || a0 < 1e-3) return;

    const pp = 0.5 + 0.5 * (-1) ** i0 * rnd(f0 / 883);
    const ep = (rnd(2) < 1 ? -1 : 1) * [0, 0, 0, 0, 0, 0.33, 1].at(rnd(7));

    for (let i = 0, t = 0, p = 0, b = 0; t < dr; t = ++i / fs, ++i0) {
      p += 2 * PI * f0 * (1 + ep / (250 * t + 10)) * (1 / fs);
      const ev = min(t / 5e-3, ((dr - t) / dr) ** 2);
      const b0 = sin(4 * p) + 0.7 * sin(4.01 * p);
      const b1 = sin(p + a1 * ev ** 3 * sin(f1 * p + 1.2 * ev * b));
      b = a * a0 * ev * (0.1 * mix(b0, b0 * b, 0.3) + b1);
      for (let ch = 2; ch--; ) data[ch][i0] += sin(1.57 * ch ? pp : 1 - pp) * b;
    }

    reverseDelay(i0 + 2 * fs, 2);
  }

  function reverseDelay(i0, dr = 2, n = 1, a = 0.9 / n) {
    const [input, output] = [data.at(rnd(2)), data.at(rnd(2))];
    const lp = Filter.create({ f: 3000 });
    for (let i = 0, t = 0, i1 = i0; t < dr; t = ++i / fs) {
      const b = min(t / 0.01, 1, (dr - t) / 0.01) * input.at(i0 - 2 * i);
      output[i1++] += a * lp(b);
    }

    if (rnd() < 0.666) reverseDelay(i0 + fs / 2, dr, ++n);
  }

  // score
  const bagOn = RndBag.create({ bag: [...Array(48)].map((v, i) => i) });
  for (let i = 0, t = 0, dt = 10, dl; t < dur; t = ++i / fs) {
    if (i % (fs / 8) == 0 && bagOn() < 2) syn(i);

    // delay
    for (let ch = 2; ch--; ) data[ch][i] += 0.25 * data[ch ^ 1].at(i - fs / 5);

    // delay
    if (i % (dt * fs) == 0) dl = ceil(fs * 3 ** crush(rnd(-1, 1.5, 0.5), 0.25));
    const a = 0.6 * min((t % dt) / 0.1, 1, (dt - (t % dt)) / 0.1);
    for (let ch = 2; ch--; ) data[ch][i] += a * data[ch ^ 1].at(i - dl);
  }
}

function wood(data) {
  const a = 0.2;
  function syn(i0, a0, fc, pp, dr = 0.25) {
    const hip = Filter.create({ type: "high", f: 50, q: 0.5 });
    const amps = [1 - pp, pp].map((v) => a * a0 * sin(0.5 * PI * v));
    for (let i = 0, t = 0, p = 0; t < dr; t = ++i / fs, ++i0) {
      const ev = min(t / 1e-3, ((dr - t) / dr) ** 2);
      p += 2 * PI * (fc * (1 + 4 / (1e3 * t + 1))) * (1 / fs);
      const m0 = (1.0 + 2.0 * a0) * ev * sin(p + ev * sin(1.692 * p));
      const s1 = 0.5 * sin(PI * fc * t);
      const b = ev * hip(sin(p + m0) + s1);
      for (let ch = 2; ch--; ) data[ch][i0] += amps[ch] * b;
    }
  }

  const am = (p, e = 1, f = 1) => (0.5 - 0.5 * cos(2 * PI * (p % 1) ** e)) ** f;
  for (let i = 4, freq = 0, phi = 0; i--; )
    for (let t = 1; t < dur - 1; t += 0.25 + 0.25 * am(t / (10 + i) + phi)) {
      const a = am(t / (15 + i / 2) + phi / 4, 2) * am(t / dur, 2);
      if (a > 0.01) syn(floor(t * fs), a, freq, am(i / 8));
      if (rnd() < 0.95) continue;
      // freq = 50 * 2 ** (floor(1.4 * rnd(0, 9)) / 8);
      freq = 0.5 * fc(floor(1.4 * rnd(0, 8)), t / dur);
      phi = rnd();
    }

  for (let i = 0, l = dur * fs; i < l; i++)
    for (let c = 2; c--; ) data[c][i] += 0.3 * data[c ^ 1][i - fs / 10] || 0;
}

function noise(data) {
  for (let i = 0, t = 0, n0 = 0, n1 = 0; t < dur; t = ++i / fs) {
    if (i % (fs / 20) == 0 && rnd(3) < 1) n0 = round(rnd(-1, 1)); // 20hz, 2bit noise
    if (i % (fs / 20) == 0 && rnd(3) < 1) n1 = round(rnd(-1, 1));
    data[0][i] += n0;
    data[1][i] += n1;
  }
}

function crack(oup, inp) {
  const a = 0.15;
  const bp0 = Filter.create({ type: "band", f: 2400, q: 8, u: 1 });
  const bp1 = Filter.create({ type: "band", f: 2400, q: 8, u: 1 });

  for (let i = 0, t = 0, f0 = 2400, f1 = 2400; t < dur; t = ++i / fs) {
    if (i % (fs / 5) == 0) {
      if (!inp[0][i]) f0 = 2400 * 2 ** rnd(-1, 1);
      if (!inp[1][i]) f1 = 2400 * 2 ** rnd(-1, 1);
    }

    oup[0][i] += a * bp0(inp[0][i], f0);
    oup[1][i] += a * bp1(inp[1][i], f1);
  }
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) oup[ch][i] *= pot(min(1, (1 - t / dur) / 0.5), 2);
  }
}

function buzz(oup, inp) {
  const a = 0.12;
  const bp = Filter.create({ type: "band", f: 400, q: 100 });
  const lop = Filter.create({ f: 1.5e3, q: 0.5 });
  const hld = Hold.create({ k: exp(-7 / fs), l: fs / 2 });
  const rndH = () => crush(0.5 + 0.5 * (random() - random()), 0.2);
  const w = 2 * PI * 100;
  for (let i = 0, t = 0, p1 = 0; t < dur; t = ++i / fs) {
    const prog = t / dur;
    const p0 = w * t;
    p1 += (w / fs) * 2 ** mix(-1, 0.3, hld(i, rndH));

    const b00 = sin(p0 + sin(p0 / 4));
    const b01 = sin(p1 + sin(p1 / 4));
    const n0 = 1.5 * prog * (random() - random()) ** 7;
    const b0 = min(1, t / 9) * bp(b00 + b01 + n0);
    const b1 = (1 - asd(prog, 0.5)) ** 2 * (inp[0][i] + inp[1][i]);

    const b = a * lop(tanh(30 * b0 + 20 * b1));
    for (let ch = 2; ch--; ) oup[ch][i] += b;
  }
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    oup[0][i] += 0.3 * oup[1][i - 0.21 * fs] || 0;
    oup[1][i] += 0.3 * oup[0][i - 0.25 * fs] || 0;
    for (let ch = 2; ch--; ) oup[ch][i] *= pot(1 - t / dur, 0.5);
  }
}

function reverb(oup, inputs) {
  const thru = 0;
  // send
  const aSend = [-30, -30, -18, -36, -24].map((v) => 10 ** (v / 20));
  const early = round(50e-3 * fs);
  for (const [idx, inp] of inputs.entries()) {
    const opt = { type: "high", f: 150, q: 0.7 };
    const hip = [0, 1].map((v) => Filter.create(opt));
    for (let i = early, t = 0; t < dur; t = ++i / fs) {
      for (let ch = 2; ch--; )
        oup[ch][i] += aSend[idx] * hip[ch](inp[ch][i - early]);
    }
  }

  // feedback delay
  const num = 8;
  // const lopF = (i) => 6e3 * exp(-0.5 * (i / (num - 1)));
  const list = [...Array(num)].map((v, i) => {
    const o = {};
    o.i = i;
    o.a = 0.5 ** ceil((i + 1) / 2);
    o.s = round(fs * 45e-3 * 1.5 ** i);
    // o.lop = Lop.create({ k: exp(-2 * PI * (lopF(i) / fs)) });
    return o;
  });

  for (let i = thru ? round(dur * fs) : 0, t = 0; t < dur; t = ++i / fs) {
    for (const el of list) {
      const sDel = i - el.s;
      if (sDel < 0) continue;
      // oup[el.i % 2][i] += el.a * el.lop(oup[(el.i + 1) % 2][sDel]);
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
const nd = (n, m) => new Node(n, m);
[nd("ore"), nd("ore"), nd("wood")].connect(nRev);
nd("noise").connect(nd("crack", 1), nd("buzz", 1)).connect(nRev);
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
