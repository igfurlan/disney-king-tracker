/* Movies & Books Tracker — static, localStorage-backed. */
const STORE_KEY = "dk-tracker-progress-v1";
const TAB_LABELS = {
  movies: { title: "Films watched", noun: "films", emoji: "🎬" },
  books:  { title: "Books read",    noun: "books", emoji: "📚" },
};

let DATA = { movies: [], books: [] };
let progress = loadProgress();
const ui = { tab: "movies", filter: "all", sort: "year-asc", q: "" };

/* ---------- storage ---------- */
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}
function saveProgress() { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); }

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const items = () => DATA[ui.tab] || [];
function stateOf(id) { return progress[id] || { done: false, date: "" }; }

/* ---------- rendering ---------- */
function applyView(list) {
  let out = list.filter((it) => {
    const st = stateOf(it.id);
    if (ui.filter === "done" && !st.done) return false;
    if (ui.filter === "todo" && st.done) return false;
    if (ui.q && !it.title.toLowerCase().includes(ui.q)) return false;
    return true;
  });
  const cmp = {
    "year-asc": (a, b) => a.year - b.year || a.title.localeCompare(b.title),
    "year-desc": (a, b) => b.year - a.year || a.title.localeCompare(b.title),
    "title-asc": (a, b) => a.title.localeCompare(b.title),
    "recent": (a, b) => (stateOf(b.id).date || "").localeCompare(stateOf(a.id).date || ""),
  }[ui.sort];
  return out.sort(cmp);
}

function cardHTML(it) {
  const st = stateOf(it.id);
  const cover = it.cover
    ? `<img data-src="${it.cover}" alt="${escapeAttr(it.title)} cover" loading="lazy" />`
    : "";
  return `
  <article class="card ${st.done ? "done" : ""}" data-id="${it.id}">
    <div class="poster">
      <span class="year-badge">${it.year}</span>
      <button class="check" title="Mark as ${st.done ? "not done" : "done"}" aria-label="toggle done">✓</button>
      ${cover}
    </div>
    <div class="card-body">
      <h3 class="card-title" title="${escapeAttr(it.title)}">${escapeHTML(it.title)}</h3>
      <span class="chip">${escapeHTML(it.group)}</span>
      <div class="date-row ${st.done ? "" : "hidden"}">
        <input type="date" value="${st.date || ""}" max="2100-12-31" aria-label="date finished" />
      </div>
    </div>
  </article>`;
}

function render() {
  const list = applyView(items());
  const grid = $("#grid");
  grid.innerHTML = list.map(cardHTML).join("");
  $("#empty").hidden = list.length > 0;

  // stagger entrance + lazy image fade-in
  [...grid.children].forEach((card, i) => {
    card.style.animationDelay = `${Math.min(i * 22, 600)}ms`;
    const img = card.querySelector("img");
    if (img) {
      img.src = img.dataset.src;
      img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
      img.addEventListener("error", () => { img.classList.add("loaded"); img.style.opacity = .25; }, { once: true });
    }
  });
  renderProgress();
  $("#footer-count").textContent =
    `${items().length} ${TAB_LABELS[ui.tab].noun} · ${countDone(items())} done`;
}

function countDone(list) { return list.filter((it) => stateOf(it.id).done).length; }

function renderProgress() {
  const list = items();
  const total = list.length;
  const done = countDone(list);
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("#progress-title").textContent = TAB_LABELS[ui.tab].title;
  $("#progress-sub").textContent = `${done} of ${total} ${TAB_LABELS[ui.tab].noun} complete`;
  $("#bar-fill").style.width = pct + "%";
  countUp($("#progress-pct"), pct);

  // per-group breakdown
  const groups = {};
  list.forEach((it) => {
    groups[it.group] = groups[it.group] || { t: 0, d: 0 };
    groups[it.group].t++;
    if (stateOf(it.id).done) groups[it.group].d++;
  });
  $("#group-stats").innerHTML = Object.entries(groups)
    .map(([g, s]) => `<span class="gchip">${escapeHTML(g)} <b>${s.d}/${s.t}</b></span>`)
    .join("");
}

/* ---------- animations ---------- */
function countUp(el, target) {
  const from = parseInt(el.dataset.v || "0", 10);
  if (from === target) { el.textContent = target + "%"; return; }
  const start = performance.now(), dur = 600;
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (target - from) * eased) + "%";
    if (p < 1) requestAnimationFrame(step);
    else el.dataset.v = target;
  }
  el.dataset.v = target;
  requestAnimationFrame(step);
}

function burst(x, y) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#ffb020", "#ff5e6c", "#7c5cff", "#34d399", "#6c8cff"];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 50;
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};
      --tx:${Math.cos(a) * d}px;--ty:${Math.sin(a) * d}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- events ---------- */
function onGridClick(e) {
  const card = e.target.closest(".card");
  if (!card) return;
  const id = card.dataset.id;
  if (e.target.closest(".check")) {
    const st = stateOf(id);
    const nowDone = !st.done;
    progress[id] = { done: nowDone, date: nowDone ? (st.date || today()) : st.date };
    saveProgress();
    card.classList.toggle("done", nowDone);
    card.querySelector(".date-row").classList.toggle("hidden", !nowDone);
    const dateInput = card.querySelector('input[type="date"]');
    if (dateInput) dateInput.value = progress[id].date || "";
    if (nowDone) {
      const r = e.target.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2);
    }
    renderProgress();
    $("#footer-count").textContent = `${items().length} ${TAB_LABELS[ui.tab].noun} · ${countDone(items())} done`;
  }
}
function onGridChange(e) {
  if (e.target.matches('input[type="date"]')) {
    const id = e.target.closest(".card").dataset.id;
    const st = stateOf(id);
    progress[id] = { done: st.done, date: e.target.value };
    saveProgress();
    if (ui.sort === "recent") render();
  }
}
function today() { return new Date().toISOString().slice(0, 10); }

function switchTab(tab) {
  ui.tab = tab;
  document.body.dataset.tab = tab;
  document.querySelectorAll(".tab").forEach((b) =>
    b.setAttribute("aria-selected", b.dataset.target === tab));
  $("#grid").style.animation = "none"; void $("#grid").offsetWidth;
  $("#grid").style.animation = "fade .4s ease";
  render();
}

/* ---------- export / import ---------- */
function exportProgress() {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tracker-progress-${today()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast("Progress exported ✓");
}
function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (typeof incoming !== "object") throw 0;
      progress = { ...progress, ...incoming };
      saveProgress(); render();
      toast("Progress imported ✓");
    } catch { toast("⚠︎ Couldn't read that file"); }
  };
  reader.readAsText(file);
}

/* ---------- escapes ---------- */
function escapeHTML(s) { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function escapeAttr(s) { return escapeHTML(s).replace(/"/g, "&quot;"); }

/* ---------- init ---------- */
async function init() {
  document.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", () => switchTab(b.dataset.target)));
  $("#grid").addEventListener("click", onGridClick);
  $("#grid").addEventListener("change", onGridChange);
  $("#search").addEventListener("input", (e) => { ui.q = e.target.value.trim().toLowerCase(); render(); });
  $("#sort").addEventListener("change", (e) => { ui.sort = e.target.value; render(); });
  $("#filter").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    ui.filter = b.dataset.filter;
    $("#filter").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    render();
  });
  $("#export").addEventListener("click", exportProgress);
  $("#import-file").addEventListener("change", (e) => e.target.files[0] && importProgress(e.target.files[0]));

  try {
    DATA = await (await fetch("data.json", { cache: "no-cache" })).json();
  } catch {
    $("#grid").innerHTML = `<p class="empty">Couldn't load data.json.</p>`;
    return;
  }
  render();
}
document.addEventListener("DOMContentLoaded", init);
