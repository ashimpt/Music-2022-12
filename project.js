class WorkerProcessor {
  constructor(project, { name, id }) {
    this.project = project;
    this.name = name;
    this.id = id;
  }

  async process(resolve, inp) {
    const { name, id, project } = this;
    const pcm = [];

    const worker = await project.createWorker();

    worker.onmessage = (e) => {
      if (e.data.method) {
        if (e.data.method == "seed") {
          project.seeds[id] = e.data.seed;
        }
        if (e.data.method == "send") {
          Object.assign(project.send, e.data.send);
        }
        if (e.data.method == "pcm-end") {
          resolve(pcm);
          worker.terminate();
        }
      } else if (name == "master") {
        resolve(e.data);
        worker.terminate();
      } else pcm.push(e.data);
    };

    worker.onerror = (e) => {
      output(this.id);
      output(e.message);
      console.error("lineno " + e.lineno, e.message, e);
      resolve(true);
      worker.terminate();
    };

    if (inp.length) worker.postMessage({ method: "input", inPcm: inp });
    worker.postMessage({ method: "setup", name, id });
    worker.postMessage({ method: "render" });
  }
}

class Project {
  seeds = [];
  send = {};
  // nodeList, settings, linkWav, updateSvg
  constructor(url) {
    this.url = url;
  }

  async setup() {
    const settings = (this.settings = await this.getSettings(this.url));
    console.log(settings);
    Object.assign(this.send, settings.send);

    // create nodeList
    const nodeList = (this.nodeList = []);
    const show = () => this.updateSvg();

    for (let i = 0; i < settings.nodeList.length; i++) {
      const jsonObj = settings.nodeList[i];
      const wp = new WorkerProcessor(this, jsonObj);
      const node = new DataNode(jsonObj.name, wp.process.bind(wp));
      node.onProcessStart = node.onProcessEnd = show;
      Object.assign(node, jsonObj);
      nodeList[i] = node;
    }

    for (const node of nodeList) {
      node.inputs = node.inputs.map((v, i, a) => (a[i] = nodeList[v]));
      node.outputs = node.outputs.map((v, i, a) => (a[i] = nodeList[v]));
    }
  }
  async render() {
    console.time(emoji(0));
    await this.nodeList.at(-1).mainProcess();
    console.log({ memory: performance.memory, seeds: this.seeds });
    console.timeEnd(emoji(0));
  }

  async getSettings(url) {
    const worker = await this.createWorker();
    return await new Promise((rsl) => {
      worker.postMessage({ method: "settings", url });
      worker.onmessage = (e) => rsl(e.data);
    });
  }

  async createWorker() {
    const worker = await new Worker("worker.js");
    const { url, send } = this;
    worker.postMessage({ method: "setup", url, receive: send });
    return worker;
  }
}

function isRenderAvailable() {
  if (/⏳/.test(document.title)) return;
  document.title = "⏳" + title;
  q("audio").pause();
  return true;
}

async function openProject(url) {
  if (!isRenderAvailable()) return;

  if (url) setScoreUrl(url);
  else url = scoreUrl;

  const project = await new Project(url);
  await project.setup(url);
  outputProjectSvg(project);
  await project.render();
  project.updateSvg();
  project.linkWav(project.nodeList.at(-1).data);

  document.title = title;
}

function outputProjectSvg(project) {
  const div = create("div");
  q("#output-project").prepend(div);

  const { nodeList } = project;
  const els = [];
  const w = 20;

  const { canvas, text, line, rect } = pSvg;

  const cnv = canvas(w * nodeList.length + 150, w * nodeList.length);
  div.append(cnv);

  const linkWav = (data, str) => appendWaveLink(data, cnv, project, str);
  const updateSvg = () => {
    for (const n of nodeList) {
      els[n.id].classList.toggle("processing", n.isProcessing);
      els[n.id].classList.toggle("done", n.isEnded);
    }
  };
  project.linkWav = linkWav;
  project.updateSvg = updateSvg;

  let lastClicked = null;
  async function rerender(e) {
    if (!isRenderAvailable()) return;
    if (!lastClicked) {
      for (const n of nodeList) n.reset();
      updateSvg();
    }
    await project.render();
    linkWav(nodeList.at(-1).data, lastClicked);
    updateSvg();

    lastClicked = null;
    document.title = title;
  }

  // button
  const button = text("▶️", 0, 20);
  button.addEventListener("click", rerender);
  cnv.append(button);

  // text
  const pos0 = (i) => [(i + 1.5) * w, (i + 1.0) * w];
  const pos1 = (i) => [(i + 1.5) * w, (i + 0.5) * w];
  div.title = "\n delete: click \nrerender: shift + click\nsolo: s + click";

  for (const n of nodeList) {
    const str = `${n.id}.${n.name}` + (n.inMode ? `(${n.inMode} in)` : "");
    const s = (els[n.id] = text(str, ...pos0(n.id)));
    s.addEventListener("click", (e) => {
      if (keyboard.s) {
        if (n.name == "master") return;
        const wav = createWavFromNode(project, n);
        linkWav(wav, n.id + "-solo");
      } else {
        lastClicked = n.id + "." + n.name;
        n.reset();
        updateSvg();
        if (keyboard.Shift) rerender();
      }
    });
    cnv.append(s);
  }
  updateSvg();

  // line
  for (let i = 0; i < nodeList.length; i++) {
    const p0 = pos0(nodeList[i].id);
    const inputs = nodeList[i].outputs;
    for (let j = 0; j < inputs.length; j++) {
      const p1 = pos1(inputs[j].id);
      const l0 = line(p0[0], p0[1], p0[0], p1[1]);
      const l1 = line(p0[0], p1[1], p1[0], p1[1]);
      const re = rect(p0[0], p1[1] - 2, 2, 2);
      cnv.append(l0, l1, re);
    }
  }
}

function createWavFromNode(project, node) {
  const opt = Object.assign({}, project.settings);
  opt.amplitude = 0.89 / getPeak(node.data, Math);
  const data = new PcmToWave(opt).convert(node.data);

  function getPeak(data, { abs, max }, l = data[0].length, r = 0) {
    for (const ch of data) for (let i = l; i--; ) r = max(abs(ch[i]), r);
    return r;
  }
  return data;
}

let countWav = 0;
const emoji = (upd = 1) =>
  String.fromCodePoint(0x1f331 + (upd ? countWav++ : countWav));

function appendWaveLink(data, preEl, project, str = "") {
  str = `${emoji(1)}${str ? `[${str}]` : ""}`;
  const url = `${project.url}.wav`;

  const blob = new Blob([data], { type: "audio/wav" });
  const objectUrl = URL.createObjectURL(blob);

  const div = create("div", null, "wav");
  const a = create("a", url);
  a.href = objectUrl;
  a.download = url;

  const memo = create("div", new Date().toLocaleTimeString() + str, "memo");
  memo.contentEditable = true;

  div.append(a, memo);
  preEl.after(div);

  playWav(objectUrl);

  a.addEventListener("click", function onClick(e) {
    e.preventDefault();
    playWav(e.target.href);
    setScoreUrl(project.url);
    console.log("replay " + url + str);
  });
}
