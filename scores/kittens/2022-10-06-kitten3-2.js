const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 120];

const mf = (t) => 1 - (1 - t / dur) ** 3;
const notes = [5 / 4, 4 / 3, 3 / 2, 15 / 8, 2].map((v) => log2(v) - 3 / 9);
const mix9 = (n, t, o = notes.at(n % 5)) => mix(o, crush(o, 1 / 9), mf(t));
const fc = (n, t = 0) => 200 * 2 ** (mix9(n, t) + floor(n / 5));

function synth(data) {
  const a = 0.25;
  function syn(i0, k, a0 = 1, dr = 1) {
    const fc0 = fc(k, i0 / fs);
    const fm = fc(k + 9, i0 / fs) / fc0 - 1;
    const pp = 0.5 + [-0.5, 0.5][k % 2] * (k / 14); //k : 0 to 14
    const a1 = min(1, 400 / fc0);
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * fc0 * t;
      const e = asd(t / dr, 0.01);
      const m = 0.4 * a0 * a1 * e * sin(fm * p);
      const b = a * a0 * a1 * e * sin(p + m);
      for (let ch = 2; ch--; ) data[ch][i0] += pan(ch ? pp : 1 - pp) * b;
    }
  }

  for (let i = 0, t = 0; ; i++) {
    if (i % 61 > 5) continue;
    t = 0.2 * i + 0.5 * am(i / 61 / 5);
    if (t > dur - 15) break;
    const k = (3 * (i - 1)) % 10;
    syn(ceil(fs * t), k + 5, 1);
    syn(ceil(fs * (t + 0.01)), k + 3, 0.5);
  }
}
function delay(data) {
  const options = { type: "band", f: 400, q: 2, u: 1 };
  const bap = [0, 0].map(() => Filter.create(options));
  // const noise = () => 30e-3 * (random() - random());
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    const b = am(2.5 * am(t / 30));
    const f0 = 200 * 2 ** (3 * b);
    for (let ch = 2; ch--; )
      data[ch][i] += 1.0 * bap[ch]((data[ch][i - fs] || 0) , f0);
  }
}

new Node("synth").connect(new Node("delay")).connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80
const setting = {
  seed: "random",
  secStart: 0.5,
  hzLowCut: 20,
  fade: { time: [0, 15], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -4,
  // bitsPerSample: 8,
};
