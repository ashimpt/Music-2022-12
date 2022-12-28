class Misc {
  static xorState = new Uint32Array([1]);
  static xorShift = () => {
    this.xorState[0] ^= this.xorState[0] << 13;
    this.xorState[0] ^= this.xorState[0] >>> 17;
    this.xorState[0] ^= this.xorState[0] << 5;
    return this.xorState[0] / 0x100000000; // 2 ** 32
  };
  static #randSeed = () => Math.ceil(1 + 0xfffffffe * Math.random());
  // Math.random "inclusive of 0, but not 1"
  static setSeed = (seed) => (this.xorState[0] = seed || this.#randSeed()); // not 0

  static moveStartPoint(data, fs, sec) {
    if (!sec) return;
    const s = Math.floor(sec * fs);
    if (s > 0) for (let i = data.length; i--; ) data[i] = data[i - s] || 0;
    else throw new Error("TODO:");
  }

  static biquadHigh(data, fs, fc = 20, q = 1) {
    const w0 = (2 * Math.PI * fc) / fs;
    const cosW0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const [a0, a1, a2] = [1 + alpha, -2 * cosW0, 1 - alpha];
    const [b0, b1, b2] = [(1 + cosW0) / 2, -1 - cosW0, (1 + cosW0) / 2];
    let [x1, x2, y1, y2] = [0, 0, 0, 0];
    for (let i = 0, l = data.length; i < l; i++) {
      const x = data[i];
      const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      [x1, x2, y1, y2] = [x, x1, y, y1];
      data[i] = y;
    }
  }

  static fade(data, fs, { time, margin, shape } = {}) {
    if (!time) time = [];
    if (!margin) margin = [];
    if (!Array.isArray(time)) time = [time, time];
    if (!Array.isArray(margin)) margin = [margin, margin];
    const l0 = fs * time[0] || 0;
    const l1 = fs * time[1] || 0;
    const m0 = Math.round(margin[0] * fs) || 0;
    const m1 = Math.round(margin[1] * fs) || 0;
    let shape0, shape1;
    if (Array.isArray(shape)) [shape0, shape1] = shape;
    else shape0 = shape1 = shape || ((x) => x ** 2);

    const end = data.length - 1;
    for (let i = 0; i < l0; i++) data[m0 + i] *= shape0(i / l0);
    for (let i = 0; i < l1; i++) data[end - m1 - i] *= shape1(i / l1);
    for (let i = 0; i < m0; i++) data[i] = 0;
    for (let i = 0; i < m1; i++) data[end - i] = 0;
  }

  static db = (amp) => 20 * Math.log10(amp);
  static getNormalizationAmp(buffers, dbTarget) {
    if (dbTarget === undefined) dbTarget = 0;
    else if (isNaN(dbTarget)) return 1;
    const target = Math.min(1, 10 ** (dbTarget / 20));
    const peak = this.#getPeakAmp(buffers, dbTarget);
    console.log("TP target", dbTarget, "diff", this.db(peak) - dbTarget);
    return target / peak;
  }

  static #getPeakAmp(buffers) {
    const [peaks, rms] = [[], []];
    for (const [ch, buffer] of buffers.entries()) {
      let [peak, sqSum] = [0, 0];
      for (let i = buffer.length; i--; ) {
        const v = buffer[i];
        peak = peak < v ? v : peak < -v ? -v : peak;
        sqSum += v * v;
      }
      peaks[ch] = peak;
      rms[ch] = this.db((sqSum / buffer.length) ** 0.5);
    }

    console.log("A peak", peaks.map((v) => v.toFixed(3)).join(", "));
    console.log("dB RMS", rms.map((v) => v.toFixed(3)).join(", "));
    return Math.max(...peaks);
  }

  static setVal = (n, def) => (isNaN(parseInt(n)) ? def : n);

  static dynamics(data, fs, normalizeAmp, settings) {
    const dbIn = settings.in || 0;
    const aheadTime = this.setVal(settings.ahead, 1) * 1e-3;
    const holdTime = this.setVal(settings.hold, 10) * 1e-3;
    const attackTime = this.setVal(settings.a, 0.5) * 1e-3;
    const releaseTime = this.setVal(settings.r, 50) * 1e-3;
    const shape = settings.shape || Math.tanh;

    if ([0, false].includes(settings.n)) normalizeAmp = 1;

    const aheadLength = Math.floor(aheadTime * fs);
    function lookAhead(i, l, ch) {
      if (i + aheadLength < l) return ch[i + aheadLength];
      else return 0;
    }

    const hDown = 3;
    const hLength = Math.floor(fs * (holdTime / hDown)) || 1;
    const holder = [];
    let hVal, hCount;
    function hold(input, i) {
      if (input <= hVal) {
        hCount = 0;
        return (hVal = input); // reset
      }

      if (i % hDown != 0) return hVal; // down sampling

      holder[hCount++ % hLength] = input;
      if (hCount < hLength) return hVal; // hold

      hVal = holder[0];
      for (let j = 1; j < hLength; j++) {
        const v = holder[j];
        if (v < hVal) hVal = v;
      }
      return hVal; // shift
    }

    // https://www.musicdsp.org/en/latest/Effects/169-compressor.html
    const att = +attackTime == 0 ? 0 : Math.exp(-1 / fs / attackTime);
    const rel = releaseTime == 0 ? 0 : Math.exp(-1 / fs / releaseTime);
    function envelop(gain, target) {
      const theta = target < gain ? att : rel;
      return (1 - theta) * target + theta * gain;
    }

    let gain, shaperGain, holdGain;
    function process(i, l, amp, ch) {
      const input = amp * Math.abs(lookAhead(i, l, ch)) || 1e-5;
      shaperGain = shape(input) / input;
      holdGain = hold(shaperGain, i);
      gain = envelop(gain, holdGain);
      return gain;
    }

    const len = data[0].length;
    const amp = normalizeAmp * 10 ** (dbIn / 20);
    for (let ch of data) {
      gain = 1;
      hCount = 0;
      hVal = Infinity;
      for (let i = 0; i < len; i++) ch[i] *= amp * process(i, len, amp, ch);
    }
  }
}
