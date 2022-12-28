const title = document.title;
const isNumber = (v) => !isNaN(parseInt(v));
const q = (s) => document.querySelector(s);
const qAll = (s) => document.querySelectorAll(s);

const keyboard = {};
addEventListener("keydown", (ev) => (keyboard[ev.key] = true));
addEventListener("keyup", (ev) => (keyboard[ev.key] = false));

function create(tagName, text, className) {
  const el = document.createElement(tagName);
  if (text || text === 0) el.textContent = text;
  if (className) el.classList.add(className);
  return el;
}

let scoreUrl;
function setScoreUrl(url) {
  scoreUrl = url;
  setUrlParam("file", url);
  q("#url").value = url;
}

function setUrlParam(name, val, isToggle) {
  const url = new URL(location.href);
  const params = new URLSearchParams(url.search);
  if (!val || (isToggle && params.has(name))) params.delete(name);
  else params.set(name, val);
  url.search = params.toString();
  history.replaceState(null, null, url);
}

const setVolParam = (e) => setUrlParam("vol", e.target.volume.toFixed(2));

addEventListener("load", async function setup() {
  output("autostart=1", "#", () => setUrlParam("autostart", 1, 1));
  output("----");
  await outputScoreTree();
  output("----");

  // params
  const params = new URLSearchParams(location.search);

  if (params.has("file")) setScoreUrl(params.get("file"));
  else setScoreUrl(q("#output").querySelector("a").textContent);

  q("audio").volume = params.get("vol") || 0.666;
  if (params.has("autostart")) (q("#unload").checked = 0), openProject(); // live server

  // events
  window.onbeforeunload = () => (q("#unload").checked ? false : void 0);
  q("audio").addEventListener("volumechange", setVolParam);
  q("canvas#analyser").addEventListener("click", startAnalyser);
  q("#url").onkeyup = (e) =>
    e.key == "Enter" ? openProject(e.target.value) : 0;
  q("#url-button").onclick = (e) => openProject(q("#url").value);
  setupDropFile();
});

function outputScoreTree() {
  return fetch("scores/tree.json")
    .then((res) => res.json())
    .then((v) => parseList(v));

  function parseList(list, dir = "") {
    for (let obj of list.sort(sortFunc)) parse(obj, dir);
  }

  function sortFunc(a, b) {
    if ((a.type == "file") ^ (b.type == "file"))
      return (a.type == "file") - (b.type == "file");
    else return ("" + a.name).localeCompare(b.name);
  }

  function parse(obj, dir) {
    if (/^_/.test(obj.name)) return; // _ ignore

    if (obj.type == "file") {
      if (!/\.js$/.test(obj.name)) return; // json, sh
      const url = dir + obj.name;
      const a = output(url, "#", () => openProject(url));

      a.addEventListener("focus", () => setScoreUrl(url));
    }

    if (obj.type == "directory") {
      if (obj.name == ".") parseList(obj.contents);
      else parseList(obj.contents, dir + obj.name + "/"); // recursion
      if (!["sub", "."].includes(obj.name)) output(obj.name), output();
    }
  }
}

function output(str, url, callback) {
  const container = create("div");
  const element = create(url ? "a" : "div", str);
  if (url) element.href = url;
  if (callback) element.addEventListener("click", callback);
  container.append(element);

  q("div#output").prepend(container);
  return element;
}

let audioCtx;

function playWav(url) {
  q("source").src = url;
  q("audio").load();
  q("audio").play().catch(console.log);
}

async function setupDropFile() {
  q("audio").addEventListener("dragover", (e) => e.preventDefault());
  q("#analyser").addEventListener("dragover", (e) => e.preventDefault());

  function transfer(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    const reader = new FileReader();
    reader.addEventListener("load", (e) => {
      playWav(e.target.result);
    });
    if (file) reader.readAsDataURL(file);
  }
  q("audio").addEventListener("drop", transfer);
  q("#analyser").addEventListener("drop", transfer);
}
