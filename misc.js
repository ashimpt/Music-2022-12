class Node {
  constructor(name) {
    this.name = name;
  }
  inputs = [];
  outputs = [];
  connect(...others) {
    for (const other of others) {
      other.inputs.push(this);
      this.outputs.push(other);
    }
    return others[0];
  }
  getAll(prop = "inputs") {
    const result = [];
    for (const p of this[prop]) result.push(...p.getAll(prop));
    result.push(this);
    return result.filter((e, i) => result.findIndex((g) => e == g) == i);
  }
}

class DataNode extends Node {
  constructor(name, processFunc) {
    super(name);
    if (processFunc) this.process = processFunc;
  }

  onProcessStart = () => void 0;
  onProcessEnd = () => void 0;
  isStarted = 0;
  isProcessing = 0;
  isEnded = 0;
  resolveFuncs = [];
  data = null;
  async mainProcess(resolve = () => 0) {
    if (this.isEnded) resolve();
    else this.resolveFuncs.push(resolve);
    if (this.isStarted) return;

    this.isStarted = 1;

    let inputsData = [];
    if (this.inputs.length) {
      await new Promise(this.processInputs.bind(this));
      for (const inp of this.inputs) inputsData.push(inp.data);
    }

    this.isProcessing = 1;
    this.onProcessStart();
    // await new Promise((r) => setTimeout(r, 1e3)); // take some deep breaths
    this.data = await new Promise((r) => this.process(r, inputsData));
    this.isProcessing = 0;
    this.isEnded = 1;
    this.onProcessEnd();
    for (const rsl of this.resolveFuncs) rsl();
  }

  async processInputs(resolve) {
    const list = this.inputs.map((e) => new Promise((r) => e.mainProcess(r)));
    Promise.allSettled(list).then(resolve);
  }

  // process = (rsl, inputs) => rsl(inputs[0]);

  reset() {
    this.isStarted = 0;
    this.isEnded = 0;
    this.resolveFuncs.length = 0;
    this.data = null;
    for (const o of this.outputs) o.reset();
  }
}

const pSvg = {};
pSvg.canvas = (width = 100, height = 50) => {
  const elem = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  elem.setAttributeNS(null, "viewBox", "0 0 " + width + " " + height);
  elem.setAttributeNS(null, "width", width);
  elem.setAttributeNS(null, "height", height);
  return elem;
};

pSvg.text = (str = "name", x = 5, y = 5) => {
  const elem = document.createElementNS("http://www.w3.org/2000/svg", "text");
  elem.append(document.createTextNode(str));
  elem.setAttributeNS(null, "x", x);
  elem.setAttributeNS(null, "y", y);
  return elem;
};

pSvg.line = (x1, y1, x2, y2) => {
  const elem = document.createElementNS("http://www.w3.org/2000/svg", "line");
  elem.setAttributeNS(null, "x1", x1);
  elem.setAttributeNS(null, "y1", y1);
  elem.setAttributeNS(null, "x2", x2);
  elem.setAttributeNS(null, "y2", y2);
  return elem;
};

pSvg.rect = (x, y, width, height) => {
  const elem = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  elem.setAttributeNS(null, "x", x);
  elem.setAttributeNS(null, "y", y);
  elem.setAttributeNS(null, "width", width);
  elem.setAttributeNS(null, "height", height);
  return elem;
};
