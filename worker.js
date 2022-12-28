const worker = {
  // { url, name, id, receive })
  inPcm: null,
};

onmessage = ({ data }) => {
  ({
    settings: () => worker.postSettings(data),
    input: () => (worker.inPcm = data.inPcm),
    setup: () => Object.assign(worker, data),
    render: () => {
      worker.render(worker);
    },
  }[data.method]());
};

worker.postSettings = ({ url }) => {
  importScripts("scores/" + url);
  setting.sampleRate = fs;
  setting.duration = dur;
  if (!setting.numChannels) setting.numChannels = 2;

  // nodeList
  if (!destination.inputs.length) new Node("render").connect(destination);
  const nodeList = destination.getAll();

  for (let i = 0; i < nodeList.length; i++) nodeList[i].id = i;

  for (const node of nodeList) {
    node.inputs = node.inputs.map((v, i, a) => (a[i] = v.id));
    node.outputs = node.outputs.map((v, i, a) => (a[i] = v.id));
  }

  setting.nodeList = nodeList;

  // share
  if (typeof setup != "undefined") {
    setting.send = setup();
  }

  postMessage(JSON.parse(JSON.stringify(setting)));
};

worker.render = ({ name, id, inPcm, master }) => {
  if (typeof fs == "undefined") importScripts("scores/" + worker.url);

  const fArray = setting.bitsInternal == 32 ? Float32Array : Float64Array;
  const numCh = setting.numChannels || 2;
  const node = destination.getAll()[id] || {};
  const chData = [];
  const inputData = [];

  if (node.inMode == "sum") worker.sum(inputData, inPcm, numCh);
  else if (node.inMode == "raw") inputData.push(...inPcm);
  else worker.sum(chData, inPcm, numCh);

  if (!chData[0]) for (let i = numCh; i--; ) chData[i] = new fArray(fs * dur);

  const renderFunc = name == "master" ? master : self[name];
  let seedLog = null;
  if (renderFunc != master) seedLog = worker.setSeed(setting.seed, id);
  if (seedLog && (seedLog.seed || seedLog.rndSeed)) {
    postMessage({ method: "seed", seed: seedLog.seed || seedLog.rndSeed });
  }

  try {
    const t = Date.now();
    renderFunc(chData, inputData);
    console.log((Date.now() - t) / 1e3, id + " " + name, seedLog);
  } catch (e) {
    console.error(name, e);
  }

  if (worker.send) postMessage({ method: "send", send: worker.send });
  if (renderFunc == master) worker.postWav(chData, numCh);
  else worker.postPcm(chData);
};

worker.sum = (output, inputs, numChs) => {
  if (!inputs) return;
  for (let ch = numChs; ch--; ) output[ch] = inputs[0][ch];
  for (let j = 1; j < inputs.length; j++) {
    const inp = inputs[j];
    for (let ch = numChs; ch--; ) {
      for (let i = inp[ch].length; i--; ) output[ch][i] += inp[ch][i];
    }
  }
};

worker.setSeed = (seed, idx) => {
  if (Array.isArray(seed)) seed = seed[idx] || 0;
  if (seed == "random") seed = 0;
  if (isNaN(parseInt(seed))) return null;

  if (typeof Misc == "undefined") importScripts("worker-misc.js");
  const result = Misc.setSeed(seed);
  random = Misc.xorShift;
  if (seed == 0) return { rndSeed: result };
  else return { seed };
};

worker.postPcm = (chData) => {
  for (const ch of chData) postMessage(ch, [ch.buffer]);
  postMessage({ method: "pcm-end" });
  chData.length = 0;
};

worker.postWav = (chData, numChannels) => {
  if (typeof PcmToWave == "undefined") importScripts("pcm-to-wave.js");

  const opt = { sampleRate: fs, duration: dur, numChannels };
  if (setting.bitsPerSample) opt.bitsPerSample = setting.bitsPerSample;
  console.log("pcm to wave in - ");
  opt.amplifier = Misc.getNormalizationAmp(chData, setting.dbPeak);

  const uint8Array = new PcmToWave(opt).convert(chData);

  postMessage(uint8Array, [uint8Array.buffer]);
};

worker.master = (chData) => {
  if (typeof Misc == "undefined") importScripts("worker-misc.js");

  const { hzLowCut, qLowCut, secStart, dynamics, fade } = setting;

  if (hzLowCut > 0) {
    for (let ch of chData) Misc.biquadHigh(ch, fs, hzLowCut, qLowCut);
  }

  if (secStart) {
    for (let ch of chData) Misc.moveStartPoint(ch, fs, secStart);
  }

  if (dynamics) {
    console.log("dynamics in - ");
    const amp = Misc.getNormalizationAmp(chData, 0);
    Misc.dynamics(chData, fs, amp, dynamics);
  }

  if (fade) {
    for (let ch of chData) Misc.fade(ch, fs, fade);
  }
};

(function setupGlobal() {
  for (const n of Object.getOwnPropertyNames(Math)) self[n] = Math[n];

  function connect(...nodes) {
    for (const n0 of this) for (const n1 of nodes) n0.connect(n1);
    return nodes;
  }
  Object.defineProperty(Array.prototype, "connect", { value: connect });

  function randomChoice() {
    return this.at(this.length * random());
  }
  Object.defineProperty(Array.prototype, "rnd", { value: randomChoice });

  function shuffleArray() {
    for (let i = 0, l = this.length; i < l; i++) {
      const o = floor(l * random());
      [this[i], this[o]] = [this[o], this[i]];
    }
    return this;
  }
  Object.defineProperty(Array.prototype, "shuffle", { value: shuffleArray });
})();

class Node {
  constructor(name, inMode) {
    this.name = name;
    this.inMode = [0, "sum", "raw"][inMode] || inMode;
  }
  inputs = [];
  outputs = [];
  connect(...nodes) {
    for (const node of nodes) {
      if (this.outputs.includes(node)) throw new Error("connection");
      if (this.inputs.includes(node)) throw new Error("connection");
      node.inputs.push(this);
      this.outputs.push(node);
    }
    return nodes;
  }
  getAll(prop = "inputs") {
    const result = [];
    for (const p of this[prop]) result.push(...p.getAll(prop));
    result.push(this);
    return result.filter((e, i) => result.findIndex((g) => e == g) == i);
  }
}

const destination = new Node("master");

const Func = {
  mix: (a, b = 1, ratio = 0.5) => a + (b - a) * ratio,
  clip: (x, lo = 0, hi = 1) => max(lo, min(hi, x)),
  crush: (a, b = 0.5) => round(a / b) * b,
  pot: (x, k = 1) => x / (1 + (1 - x) * k),
  pan: (x) => x / (0.4 + 0.6 * x),
  am: (turn) => 0.5 - 0.5 * cos(2 * PI * turn),
  asd: (x, a = 0.01, d = 1 - a) => min((x % 1) / a, 1, (1 - (x % 1)) / d),
  rnd: (lo = 1, hi = 0, e = 1) => lo + (hi - lo) * random() ** e,
  rndTriangular: (med = 0.5, r = random()) =>
    r < med ? sqrt(r / med) * med : 1 - sqrt((1 - r) / (1 - med)) * (1 - med),
  lerpArray(d, x) {
    const fx = floor(x);
    const d0 = d[fx];
    return d0 + (d[fx + 1] - d0) * (x - fx) || 0;
  },
};

class Tool {
  static Abstract = class {
    static create(options) {
      const instance = new this();
      if (options) Object.assign(instance, options);
      if (options && options.instance)
        return { instance, process: instance.process };
      return instance.process;
    }
  };
  static XorShift = class extends this.Abstract {
    state = new Uint32Array([1]);
    process = () => {
      this.state[0] ^= this.state[0] << 13;
      this.state[0] ^= this.state[0] >>> 17;
      this.state[0] ^= this.state[0] << 5;
      return this.state[0] / 0x100000000; // 2 ** 32
    };
  };
  static RndBag = class extends this.Abstract {
    bag = [0, 1];
    currentBag = [];
    process = () => {
      if (!this.currentBag.length)
        this.currentBag.push(...structuredClone(this.bag).shuffle());
      return this.currentBag.shift();
    };
  };
  static Lop = class extends this.Abstract {
    k = exp(-1 / fs);
    y1 = 0;
    process = (inp) => (this.y1 = inp + (this.y1 - inp) * this.k);
  };
  static BiquadFilter = class extends this.Abstract {
    x1 = 0;
    x2 = 0;
    y1 = 0;
    y2 = 0;
    process = (x0) => {
      const { b0, b1, b2, a0, a1, a2 } = this;
      const { x1, x2, y1, y2 } = this;
      const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      [this.x1, this.x2, this.y1, this.y2] = [x0, x1, y0, y1];
      return y0;
    };
    low = (f, q) => {
      const w0 = 2 * PI * (f / fs);
      const cosW0 = cos(w0);
      const a = sin(w0) / (2 * q);
      const b1 = (this.b1 = 1 - cosW0);
      this.b2 = this.b0 = b1 / 2;
      this.a0 = 1 + a;
      this.a1 = -2 * cosW0;
      this.a2 = 1 - a;
    };
    high = (f, q) => {
      const w0 = 2 * PI * (f / fs);
      const cosW0 = cos(w0);
      const a = sin(w0) / (2 * q);
      const b1 = (this.b1 = -1 - cosW0);
      this.b2 = this.b0 = -b1 / 2;
      this.a0 = 1 + a;
      this.a1 = -2 * cosW0;
      this.a2 = 1 - a;
    };
    band = (f, q) => {
      const w0 = 2 * PI * (f / fs);
      const sinW0 = sin(w0);
      const a = sinW0 / (2 * q);
      this.b2 = -(this.b0 = sinW0 / 2);
      this.b1 = 0;
      this.a0 = 1 + a;
      this.a1 = -2 * cos(w0);
      this.a2 = 1 - a;
    };
  };
  static Filter = {
    create: ({ type = "low", f = 800, q = 1, u = false } = {}) => {
      const instance = new Tool.BiquadFilter();
      const [update, process] = [instance[type], instance.process];

      if (!u) return update(f, q), process;
      else
        return (inp, f0 = f, q0 = q) => {
          update(f0, q0);
          return process(inp);
        };
    },
  };
  static Hold = class extends this.Abstract {
    k = exp(-1 / fs);
    l = fs;
    x = 0;
    y1 = 0;
    process = (i, func = random) => {
      if (i % this.l == 0) this.x = func();
      const { x, y1, k } = this;
      return (this.y1 = x + (y1 - x) * k);
    };
  };
}
