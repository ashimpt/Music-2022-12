class Analyser {
  audioCtx;
  canvasCtx;
  analyser;
  dataArray;
  freqInterval;
  fftSize = 2 ** 11;
  mode = 1;
  zoom = 1.5;
  constructor(canvasEl, audioCtx_) {
    const ctx = (this.audioCtx = audioCtx_ || new AudioContext());
    const analyser = (this.analyser = ctx.createAnalyser());
    analyser.fftSize = this.fftSize;
    analyser.connect(ctx.destination);
    this.dataArray = new Uint8Array(this.fftSize / 2);
    this.freqInterval = ctx.sampleRate / this.fftSize;
    this.setupCanvas(canvasEl);
  }
  connectAudioElement(audioEl) {
    const source = this.audioCtx.createMediaElementSource(audioEl);
    source.connect(this.analyser);
    audioEl.addEventListener("pause", this.stopLoop);
    audioEl.addEventListener("playing", () => {
      if (this.mode != 2) this.startLoop();
    });
    if (!audioEl.paused) this.startLoop();
  }
  setupCanvas(canvasEl) {
    const ctx = (this.canvasCtx = canvasEl.getContext("2d"));
    ctx.canvas.addEventListener("click", () => {
      this.mode = ++this.mode % 3;
      this.mode < 2 ? this.startLoop() : this.stopLoop();
    });
    ctx.fillText("setup finished", 10, 10);
  }
  animId = null;
  frameCount = 0;
  stopRect = () => this.canvasCtx.fillRect(10, 10, 5, 5);
  startLoop = () => (this.stopLoop(), this.loop());
  stopLoop = () => (cancelAnimationFrame(this.animId), this.stopRect());
  loop = () => ((this.animId = requestAnimationFrame(this.loop)), this.draw());
  draw = () => {
    const ctx = this.canvasCtx;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const l = Math.floor(this.dataArray.length / this.zoom);
    if (this.mode == 0) this.drawTime(ctx, w, h, l, this.dataArray);
    else this.drawFreq(ctx, w, h, l, this.dataArray);
    if (this.mode == 2) ctx.fillColor("white"), ctx.fillText("stop", 10.1);
    // ctx.fillText(Math.floor(this.frameCount++ / 60), 10, 10);
  };
  drawTime(ctx, w, h, l, array) {
    this.analyser.getByteTimeDomainData(array);
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, h / 2, w, 1);
    for (let i = 0, s = w / l + 1; i < l; i++) {
      const d = array[i];
      ctx.fillRect((i / l) * w, (1 - d / 256) * h, s, s);
    }
  }
  #freqBG = null;
  drawFreq(ctx, w, h, l, array) {
    if (this.#freqBG) ctx.drawImage(this.#freqBG, 0, 0);
    else this.#drawFreqBackGround(ctx, w, h, l);
    this.analyser.getByteFrequencyData(array);
    ctx.fillStyle = "#fff";
    for (let i = 1; i < l; i++) {
      const x = Math.log2(i) / Math.log2(l);
      const y = (1 - array[i] / 256) * h;
      ctx.fillRect(Math.round(x * w), y, 1, h - y);
    }
  }
  #drawFreqBackGround(ctx, w, h, l) {
    const { log2, round, random } = Math;
    const idx = (hz) => hz / this.freqInterval;
    const hzToX = (hz) => round(w * (log2(idx(hz)) / log2(l)));

    ctx.fillStyle = ["#330", "#033", "#303"].at(3 * random()); // bg
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#666"; // octave line
    for (let oct = -2; oct < 9; oct++) {
      ctx.fillRect(hzToX(100 * 2 ** oct), 0, 1, h);
    }
    ctx.fillStyle = "tan";
    for (const hz of [10, 100, 1e3, 1e4]) {
      ctx.fillRect(hzToX(hz), 0, 1, h);

      for (let i = 1, l = hz == 1e3 ? 19 : 9; i <= l; i++) {
        ctx.fillRect(hzToX(hz * i), h / 2 - 2, 1, 4);
      }
    }
    this.#freqBG = new Image();
    this.#freqBG.src = ctx.canvas.toDataURL();
  }
}

let analyser;
function startAnalyser() {
  if (analyser) return;
  if (!audioCtx) audioCtx = new AudioContext();
  analyser = new Analyser(q("canvas#analyser"), audioCtx);
  analyser.connectAudioElement(q("audio"));
  q("canvas#analyser").removeEventListener("click", startAnalyser);
}
