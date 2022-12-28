const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 120];

const notes = [5 / 8, 4 / 6, 6 / 8, 15 / 16, 1].map((v) => log2(v) + 6 / 9);
const mix9 = (i, p, pl = notes.at(i % 5)) => mix(pl, crush(pl, 1 / 9), p);
const fc = (i, t) => 200 * 2 ** (mix9(i, am(t / dur / 2)) + floor(i / 5));


function synth(data) {
  const a = 0.3;
  function syn(i0, f0, dr) {
    const a0 = min(1, 400 / f0);
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const ev = asd(t / dr, 0.01);
      const p = 2 * PI * f0 * t;
      const m = 1 * a0 * exp(-33 * t) * sin(2 * p);
      const b = a * a0 * ev * sin(p + m);
      for (let ch = 2; ch--; ) data[ch][i0] += 0.7 * b;
    }
  }
  const time = (i) => 8 * floor(i / 24) + 7 * ((i / 24) % 1) ** 1.5;
  for (let i = 0, t = 0; t < dur; t = time(++i)) {
    const i0 = floor(t * fs);
    const fIdx = 1.5 * (i % 2) + 2 + ((1 + floor(1.5 * floor(i / 24))) % 6);
    const f0 = fc(fIdx, t);
    const dr = time(i + 2) - t;
    syn(i0, f0, dr);
  }
}

function delay(oup, inp) {
  for (let i = worker.id; i--; ) random();
  const interval = 2 + 0.5 * (worker.id % 4);
  const cl = (x) => 1 - cos(PI * x);
  const lop = Filter.create({ f: 3000 });

  for (let i = 0, t = 0, j, v, iCh, oCh; t < dur; t = ++i / fs) {
    if (i % (interval * fs) == 0) {
      iCh = random() < 0.5 ? 0 : 1;
      oCh = random() < 0.5 ? 0 : 1;
      j = i - floor(fs * rnd(-12, -8));
      v = [0.25, 0.5, 1, 2].at(4 * random());
      v *= [-1, 1, 1, 1].at(mix(4, 1.5, t / dur) * random());
    }
    j += v;
    const ev = asd(t / interval, 0.01, 0.01);
    const b = lop(lerpArray(inp[iCh], j));
    oup[oCh][i] += 0.5 * cl(0.7 * (t / dur)) * ev * b;
  }
}

function decay(data) {
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    const a = min(1, (dur - t) / dur / 0.5) ** 2;
    for (let ch = 2; ch--; ) data[ch][i] *= a;
  }
}

const nSynth = new Node("synth");
const cd = () => new Node("delay", 1);
nSynth.connect(new Node("decay")).connect(destination);
nSynth.connect(cd(), cd(), cd(), cd()).connect(destination);
///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  // seed: 1,
  secStart: 0.5,
  hzLowCut: 20,
  fade: { time: [0, 1], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -4,
  // bitsPerSample: 8,
};
