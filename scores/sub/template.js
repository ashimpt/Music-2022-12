const { Lop, Filter, Hold, RndBag } = Tool;
const { mix, clip, crush, rnd, lerpArray, pot, am, asd, pan } = Func;

const [fs, dur] = [6e3, 5];

function synth0(data) {
  render(data);
}

new Node("synth0").connect(destination);

function render(data) {
  const a = 0.5;
  for (let i = 0, t = 0; t < dur; t = ++i / fs) {
    const p = 2 * PI * 400 * t;
    const e = asd(t);
    const m = e * sin(p);
    const b = a * e * sin(p + m);
    for (let ch = 2; ch--; ) data[ch][i] += b;
    for (let ch = 2; ch--; ) data[ch][i] += 0.3 * data[ch][i - fs / 3] || 0;
  }
}

// function syn(i0 = 0, fc = 200, dr = 1) {
//   const a = 0.5;
//   for (let i = 0, t = 0; t < dr; t = ++i / fs, ++i0) {
//     const p = 2 * PI * fc * t;
//     const e = asd(t);
//     const m = e * sin(2 * p);
//     const b = a * e * sin(p + m);
//     for (let ch = 2; ch--; ) data[ch][i0] += b;
//   }
// }

// for (let i = worker.id; i--; ) random();

// worker.send = { somethingToShare: 0 };
// worker.receive;

// function setup() {
//   return { somethingToShare: 1 };
// }

///////////////////////////////////////////////////////////////////////// Col 80

const setting = {
  //// worker.js
  // bitsInternal: 64,
  // numChannels: 1,
  seed: "random",

  //// master - worker-misc.js
  // secStart: 0.5,
  // hzLowCut: 20,
  // dynamics: { in: 0, ahead: 1, hold: 10, a: 0.5, r: 50 },
  // dynamics: { shape: (x) => tanh((1.0 * x) / (1 - 0.5 * (1 - x))) },
  // fade: { time: [0, dur / 24], margin: [0, 1], shape: (x) => x / (2 - x) },

  //// master - pcm-to-wave.js
  dbPeak: -1,
  // bitsPerSample: 8,
};

if (dur <= 60) {
  for (const s of "secStart,hzLowCut,dynamics,fade".split(","))
    setting[s] = void 0;
}
