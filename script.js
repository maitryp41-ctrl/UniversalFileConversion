/* SUFC prototype – Practical 9
   Real in-browser conversion: JPG/PNG/WEBP <-> each other, image -> PDF.
   Everything else is simulated and downloads a demo text file. */
"use strict";

const MAX_MB = 50;

// Conversion compatibility matrix: input extension -> allowed outputs
const MATRIX = {
  jpg:  { direct: ["png", "webp", "pdf"], advanced: ["mp3"] },
  jpeg: { direct: ["png", "webp", "pdf"], advanced: ["mp3"] },
  png:  { direct: ["jpg", "webp", "pdf"], advanced: ["mp3"] },
  webp: { direct: ["jpg", "png", "pdf"],  advanced: ["mp3"] },
  docx: { direct: ["pdf"], advanced: [] },
  pdf:  { direct: ["txt", "jpg", "png"], advanced: ["mp3"] },
  txt:  { direct: ["pdf"], advanced: [] },
  csv:  { direct: ["xlsx"], advanced: [] },
  xlsx: { direct: ["csv"], advanced: [] },
  wav:  { direct: ["mp3"], advanced: [] },
  mp3:  { direct: ["wav"], advanced: ["docx"] },
  mp4:  { direct: ["mp3", "gif", "avi", "mkv", "webm"], advanced: ["docx"] },
  zip:  { direct: [], advanced: ["pdf"] }
};
const IMAGES = ["jpg", "jpeg", "png", "webp"];
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const TYPE_NAME = {
  pdf: "PDF Document", jpg: "JPEG Image", jpeg: "JPEG Image", png: "PNG Image", webp: "WEBP Image", docx: "Word Document",
  txt: "Text File", csv: "CSV File", xlsx: "Excel Workbook", wav: "WAV Audio", mp3: "MP3 Audio", mp4: "MP4 Video",
  gif: "GIF Image", avi: "AVI Video", mkv: "MKV Video", webm: "WEBM Video", zip: "ZIP Archive"
};
const COLORS = { pdf: "#e8231a", jpg: "#8a2be2", jpeg: "#8a2be2", png: "#e8231a", webp: "#8a2be2", docx: "#1677f2", txt: "#1677f2",
  csv: "#12a150", xlsx: "#12a150", wav: "#8a2be2", mp3: "#8a2be2", mp4: "#e8860c", gif: "#12a150", avi: "#e8860c", mkv: "#e8860c", webm: "#e8860c", zip: "#6b7a99" };
const SUB = { // extra label under an option
  "pdf>mp3": "(Text-to-Speech)", "jpg>mp3": "(OCR + Text-to-Speech)", "jpeg>mp3": "(OCR + Text-to-Speech)",
  "png>mp3": "(OCR + Text-to-Speech)", "webp>mp3": "(OCR + Text-to-Speech)",
  "mp3>docx": "(Speech-to-Text)", "mp4>docx": "(Speech-to-Text + OCR)", "zip>pdf": "(Extract and combine)"
};

const STEPS = {
  toMp3:    src => [`Extracting text from ${src}...`, "Generating speech...", "Creating MP3 file...", "Finalizing..."],
  mp3Docx:  () => ["Transcribing speech...", "Building transcript...", "Creating DOCX file...", "Finalizing..."],
  videoDocx:() => ["Extracting audio...", "Speech-to-text...", "Reading text from frames (OCR)...", "Combining information...", "Creating DOCX file..."],
  zipPdf:   () => ["Extracting archive...", "Identifying files...", "Converting supported files...", "Combining into one PDF..."],
  direct:   () => ["Reading file...", "Converting...", "Finalizing..."]
};

const $ = id => document.getElementById(id);
const state = { file: null, ext: "", target: "", adv: false, tab: "direct", outUrl: null };

/* ---------- Icons ---------- */
function docSvg(label, color) {
  return `<svg viewBox="0 0 44 52" aria-hidden="true"><path d="M4 4a4 4 0 014-4h20l12 12v36a4 4 0 01-4 4H8a4 4 0 01-4-4z" fill="${color}"/><path d="M28 0l12 12H32a4 4 0 01-4-4z" fill="#fff" opacity=".45"/><text x="22" y="38" text-anchor="middle" font-family="Inter,Arial" font-weight="700" font-size="12" fill="#fff">${label}</text></svg>`;
}
function bigIcon(ext) {
  const c = COLORS[ext] || "#1677f2";
  return `<div class="ficon" style="background:${c}1f">${docSvg(ext.toUpperCase().slice(0, 4), c)}</div>`;
}

/* ---------- Screens ---------- */
function show(name) {
  ["screenUpload", "screenSelect", "screenProgress", "screenDone"].forEach(s => { $(s).hidden = s !== name; });
  $("navHome").classList.toggle("on", name === "screenUpload");
}
$("navHome").addEventListener("click", () => { if (!$("screenProgress").hidden) return; reset(); });
$("navAbout").addEventListener("click", () => $("aboutDlg").showModal());
$("navHelp").addEventListener("click", () => $("helpDlg").showModal());
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

/* ---------- Upload and validation ---------- */
const dz = $("dropzone");
["dragenter", "dragover"].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", ev => handleFile(ev.dataTransfer.files[0]));
dz.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); $("fileInput").click(); } });
$("fileInput").addEventListener("change", ev => handleFile(ev.target.files[0]));

function fmtSize(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function handleFile(file) {
  const err = $("uploadError");
  err.hidden = true;
  if (!file) return;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const fail = msg => { err.textContent = msg; err.hidden = false; };
  if (!MATRIX[ext]) return fail(`".${ext}" files are not supported. Supported: ${Object.keys(MATRIX).join(", ")}.`);
  if (file.size === 0) return fail("This file is empty. Choose a file with content.");
  if (file.size > MAX_MB * 1048576) return fail(`This file is ${fmtSize(file.size)}. The limit is ${MAX_MB} MB.`);
  state.file = file; state.ext = ext; state.target = ""; state.adv = false;
  renderSelect();
  show("screenSelect");
}

/* ---------- Format selection (screens 2 and 5) ---------- */
function renderSelect() {
  const { file, ext } = state;
  $("fileIcon").innerHTML = bigIcon(ext);
  $("fileName").textContent = file.name;
  $("fileType").textContent = "Type: " + (TYPE_NAME[ext] || ext.toUpperCase());
  $("fileSize").textContent = "Size: " + fmtSize(file.size);
  const m = MATRIX[ext];
  $("tabDirect").disabled = !m.direct.length;
  $("tabAdv").disabled = !m.advanced.length;
  setTab(m.direct.length ? "direct" : "advanced");
}
function setTab(tab) {
  state.tab = tab; state.target = ""; state.adv = tab === "advanced";
  $("tabDirect").classList.toggle("on", tab === "direct");
  $("tabAdv").classList.toggle("on", tab === "advanced");
  $("tabDirect").setAttribute("aria-selected", tab === "direct");
  $("tabAdv").setAttribute("aria-selected", tab === "advanced");
  $("convertBtn").textContent = tab === "direct" ? "Start Conversion →" : "Convert →";
  const list = MATRIX[state.ext][tab === "direct" ? "direct" : "advanced"];
  const box = $("options");
  box.innerHTML = list.length ? "" : '<p class="empty">No output formats in this tab for this file type.</p>';
  list.forEach(fmt => {
    const key = `${state.ext}>${fmt}`;
    const src = state.ext === "jpeg" ? "JPG" : state.ext.toUpperCase();
    const word = IMAGES.includes(state.ext) && state.adv ? "Image" : src;
    const d = document.createElement("div");
    d.className = "opt";
    d.innerHTML = `<input type="radio" name="fmt" id="o_${fmt}" value="${fmt}">
      <label for="o_${fmt}">${docSvg(fmt.toUpperCase().slice(0, 4), COLORS[fmt] || "#1677f2").replace("<svg", '<svg class="mini"')}
      <span>${word} → ${fmt.toUpperCase()}${SUB[key] ? `<small>${SUB[key]}</small>` : ""}</span></label>`;
    d.querySelector("input").addEventListener("change", () => pick(fmt));
    box.appendChild(d);
  });
  updateNote(); 
  $("convertBtn").disabled = true;
  $("selHint").hidden = false;
}
$("tabDirect").addEventListener("click", () => setTab("direct"));
$("tabAdv").addEventListener("click", () => setTab("advanced"));

function noteFor() {
  const { ext, target, adv } = state;
  if (!adv || !target) return "";
  if (target === "mp3") {
    const what = ext === "pdf" ? "PDF" : "image";
    return `Audio conversion is available only when readable text can be extracted from the ${what} using OCR. The generated audio may not reproduce the original content or meaning perfectly if the text is unclear, handwritten, distorted or not in a supported language.`;
  }
  if (target === "docx") return "The transcript depends on audio quality and on how clearly any on-screen text appears. It may contain recognition errors, so review it before relying on it.";
  return "";
}
function updateNote() {
  const t = noteFor();
  $("noteText").textContent = t;
  $("noteBox").hidden = !t;
  $("selGrid").classList.toggle("two", !!t);
}
function pick(fmt) {
  state.target = fmt;
  updateNote();
  $("convertBtn").disabled = false;
  $("selHint").hidden = true;
}
$("removeBtn").addEventListener("click", reset);
$("againBtn").addEventListener("click", reset);

/* ---------- Conversion controller (screen 3) ---------- */
$("convertBtn").addEventListener("click", startConversion);

function stepList() {
  const { ext, target, adv } = state;
  if (adv && target === "mp3") return STEPS.toMp3(ext === "pdf" ? "PDF" : "image (OCR)");
  if (adv && target === "docx") return (ext === "mp4" ? STEPS.videoDocx : STEPS.mp3Docx)();
  if (adv && target === "pdf" && ext === "zip") return STEPS.zipPdf();
  return STEPS.direct();
}
const srcLabel = () => state.ext === "jpeg" ? "JPG" : state.ext.toUpperCase();

async function startConversion() {
  const steps = stepList();
  $("progTitle").textContent = `Converting... ${srcLabel()} → ${state.target.toUpperCase()}`;
  const ol = $("steps");
  ol.innerHTML = steps.map(s => `<li>${s}</li>`).join("");
  setProgress(0);
  show("screenProgress");

  const work = realConvert().catch(e => ({ error: e.message })); // real work runs while the status plays

  const items = ol.children;
  for (let i = 0; i < steps.length; i++) {
    items[i].className = "active";
    const slice = 100 / steps.length;
    for (let p = 0; p < 10; p++) { await sleep(70); setProgress(i * slice + (p + 1) * slice / 10); }
    items[i].className = "done";
  }
  const result = await work;
  if (result.error) { alert("Conversion failed: " + result.error); show("screenSelect"); return; }
  finish(result);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function setProgress(v) {
  v = Math.min(100, Math.round(v));
  $("barFill").style.width = v + "%";
  $("pct").textContent = v + "%";
  document.querySelector(".bar").setAttribute("aria-valuenow", v);
}

/* ---------- Real conversions (images only) ---------- */
function realConvert() {
  const { file, ext, target, adv } = state;
  if (IMAGES.includes(ext) && !adv && (target in MIME || target === "pdf")) return imageConvert(file, target);
  return Promise.resolve({ demo: true });
}
async function imageConvert(file, target) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext("2d");
  if (target === "jpg" || target === "pdf") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); } // JPEG has no alpha
  ctx.drawImage(bmp, 0, 0);
  const toBlob = (mime, q) => new Promise(res => c.toBlob(res, mime, q));
  if (target === "pdf") {
    const jpg = new Uint8Array(await (await toBlob("image/jpeg", 0.92)).arrayBuffer());
    return { blob: imageToPdf(jpg, c.width, c.height) };
  }
  const blob = await toBlob(MIME[target], 0.92);
  if (!blob || blob.type !== MIME[target]) throw new Error(`This browser cannot export ${target.toUpperCase()}.`);
  return { blob };
}
// Minimal single-page PDF containing one JPEG
function imageToPdf(jpg, w, h) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const add = d => { const u = typeof d === "string" ? enc.encode(d) : d; parts.push(u); len += u.length; };
  const obj = (n, body) => { offs[n] = len; add(`${n} 0 obj\n`); add(body); add("\nendobj\n"); };
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  add("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offs[4] = len;
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
  add(jpg); add("\nendstream\nendobj\n");
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  add("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) add(String(offs[i]).padStart(10, "0") + " 00000 n \n");
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}

/* ---------- Completed screen (4) ---------- */
function toolName() {
  const { ext, adv } = state;
  if (adv) return "OCR, speech recognition or text-to-speech";
  if (ext === "docx") return "LibreOffice";
  if (["mp3", "wav", "mp4"].includes(ext)) return "FFmpeg";
  if (["csv", "xlsx"].includes(ext)) return "pandas and openpyxl";
  return "PyMuPDF and Pillow";
}
function finish(result) {
  const base = state.file.name.replace(/\.[^.]+$/, "");
  const outName = `${base}.${state.target}`;
  let blob, size, note = "";
  if (result.blob) { blob = result.blob; size = blob.size; }
  else {
    blob = new Blob([`SUFC prototype demo\nInput: ${state.file.name}\nTarget: ${outName}\nThis conversion is simulated. The full system would run ${toolName()} on the server.\n`], { type: "text/plain" });
    size = Math.max(1024, Math.round(state.file.size * 0.6));
    note = "Prototype notice: this conversion is simulated, so the download is a demo text file.";
  }
  if (state.outUrl) URL.revokeObjectURL(state.outUrl);
  state.outUrl = URL.createObjectURL(blob);
  $("outIcon").innerHTML = bigIcon(state.target);
  $("outName").textContent = outName;
  $("outType").textContent = TYPE_NAME[state.target] || state.target.toUpperCase();
  $("outSize").textContent = fmtSize(size);
  $("outNote").textContent = note;
  const dl = $("downloadBtn");
  dl.href = state.outUrl;
  dl.download = result.blob ? outName : outName + ".demo.txt";
  saveHistory(state.file.name, outName, size);
  show("screenDone");
}
function reset() {
  state.file = null; state.target = ""; $("fileInput").value = "";
  renderHistory();
  show("screenUpload");
}

/* ---------- Conversion history (localStorage) ---------- */
const KEY = "sufc_history";
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
function saveHistory(from, to, size) {
  const h = loadHistory();
  h.unshift({ from, to, size, at: new Date().toLocaleString() });
  try { localStorage.setItem(KEY, JSON.stringify(h.slice(0, 20))); } catch {}
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function renderHistory() {
  const h = loadHistory();
  $("historyPanel").hidden = !h.length;
  $("historyList").innerHTML = h.slice(0, 5).map(x => `<li>${esc(x.from)} → ${esc(x.to)} (${fmtSize(x.size)}) · ${esc(x.at)}</li>`).join("");
}
$("clearHistory").addEventListener("click", () => { try { localStorage.removeItem(KEY); } catch {} renderHistory(); });
renderHistory();
show("screenUpload");
