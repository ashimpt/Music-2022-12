const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [12e3, 120];

const notes = [5 / 8, 4 / 6, 6 / 8, 15 / 16, 1].map((v) => log2(v) + 6 / 9);
const mix9 = (i, p, pl = notes.at(i % 5)) => mix(pl, crush(pl, 1 / 9), p);
const fc = (i, t) => 200 * 2 ** (mix9(i, t / dur) + floor(i / 5));
const fb = (t) => mix(1.8, 0.5, (t / dur) ** 2);

function synth(data) {
  const a = 0.25;
  function syn(i0, k0, f0, dr = 0.7) {
    const a0 = min(1, 400 / f0);
    const a1 = a0 * min(1, (1 - i0 / fs / dur) / 0.33);
    const f1 = fc(k0 + 9, i0 / fs) / f0 - 1;
    for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
      const p = 2 * PI * f0 * t;
      const e0 = asd(t / dr, 0.01);
      const m = a0 * exp(-11 * t) * sin(f1 * p);
      const b = a * a1 * e0 * sin(p + m);
      for (let ch = 2; ch--; ) data[ch][i0] += 0.7 * b;
    }
  }

  for (let i = 0, t = 0; t < dur; t += 1 / fb(t), ++i) {
    if (i % 13 > 3) continue;
    for (let n = 1 + (floor(i / 26) % 4), j = n; j--; ) {
      const i0 = floor(((1 / fb(t) / n) * j + t) * fs);
      const k0 = 3 + 2 * j + (i % 2) + ((i / 13) % 4);
      syn(i0, k0, fc(k0, t), 2 / fb(t));
    }
  }
}

function delay(outputs, inputs) {
  const [gateUp, gateDn] = [500e-3, 50e-3].map((v) => exp(-1 / fs / v));
  let toggle = 0;
  let hold = 0;
  for (let i = 0, t = 0, a = 0, c = 0; t < dur; t = ++i / fs) {
    if (abs(inputs[0][i]) > 0.1) {
      toggle = 1;
      hold = (3.5 / fb(t)) * fs;
      c = 0;
    } else if (c++ > hold) toggle = 0;

    a = mix(toggle, a, toggle ? gateUp : gateDn);

    const inA = 0.39 * a;
    const ouA = 0.97 * a;

    outputs[0][i] += inA * +inputs[1][i - ceil(0.211 * fs)] || 0;
    outputs[1][i] += inA * +inputs[0][i - ceil(0.212 * fs)] || 0;
    outputs[0][i] += ouA * outputs[1][i - ceil(0.164 * fs)] || 0;
    outputs[1][i] += ouA * outputs[0][i - ceil(0.161 * fs)] || 0;
  }
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    for (let ch = 2; ch--; ) outputs[ch][i] += inputs[ch][i];
  }
}
new Node("synth").connect(new Node("delay", 1)).connect(destination);

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  seed: "random",
  secStart: 0.5,
  hzLowCut: 20,
  fade: { time: [0, 1], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -4,
  // bitsPerSample: 8,
};
