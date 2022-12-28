const [fs, dur] = [6e3, 5];

function render(data) {
  const a = 0.5;
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    const p = 2 * PI * 400 * t;
    const e = exp(-t);
    const b = a * e * sin(p + e * sin(p));
    for (let ch = 2; ch--; ) data[ch][i] += b;
    for (let ch = 2; ch--; ) data[ch][i] += 0.3 * data[ch][i - fs] || 0;
  }
}

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  seed: "random",
  // secStart: 0.5,
  // hzLowCut: 20,
  // dynamics: { shape: (x) => tanh((1.0 * x) / (1 - 0.5 * (1 - x))) },
  // fade: { time: [0, dur / 24], margin: [0, 1], shape: (x) => x / (2 - x) },
  dbPeak: -1,
  // bitsPerSample: 8,
};
