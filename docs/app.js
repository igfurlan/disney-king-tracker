/* Movies & Books Tracker — static, localStorage-backed. */
const STORE_KEY = "dk-tracker-progress-v1";
const TAB_LABELS = {
  movies: { title: "Filmes assistidos", noun: "filmes" },
  books:  { title: "Livros lidos",      noun: "livros" },
};
const COLORS = ["#ffb020", "#ff5e6c", "#7c5cff", "#34d399", "#6c8cff", "#c061ff"];
const RING_C = 327; // 2πr, r=52
const MILESTONES = [25, 50, 75, 100];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;

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
const stateOf = (id) => progress[id] || { done: false, date: "" };
const countDone = (list) => list.filter((it) => stateOf(it.id).done).length;
const pctOf = (list) => (list.length ? Math.round((countDone(list) / list.length) * 100) : 0);
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- rendering ---------- */
function applyView(list) {
  const out = list.filter((it) => {
    const st = stateOf(it.id);
    if (ui.filter === "done" && !st.done) return false;
    if (ui.filter === "todo" && st.done) return false;
    if (ui.q && !(it.title.toLowerCase().includes(ui.q) || (it.title_en || "").toLowerCase().includes(ui.q))) return false;
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
    ? `<img data-src="${it.cover}" alt="Capa de ${escapeAttr(it.title)}" loading="lazy" />` : "";
  const orig = (it.title_en && it.title_en !== it.title)
    ? `<p class="card-orig">${escapeHTML(it.title_en)}</p>` : "";
  return `
  <article class="card ${st.done ? "done" : ""}" data-id="${it.id}">
    <div class="poster">
      <button class="check" title="${st.done ? "Desmarcar" : "Marcar como concluído"}" aria-label="marcar como concluído">✓</button>
      ${cover}
    </div>
    <div class="card-body">
      <h3 class="card-title" title="${escapeAttr(it.title)}">${escapeHTML(it.title)}</h3>
      <span class="card-year">${it.year}</span>
      ${orig}
      <div class="date-row ${st.done ? "" : "hidden"}">
        <label class="date-label">Concluído em</label>
        <input type="date" value="${st.date || ""}" max="2100-12-31" aria-label="data de conclusão" />
      </div>
    </div>
  </article>`;
}

function render() {
  const grid = $("#grid");
  const list = applyView(items());
  grid.innerHTML = list.map(cardHTML).join("");
  $("#empty").hidden = list.length > 0;
  [...grid.children].forEach((card, i) => {
    card.style.animationDelay = `${Math.min(i * 22, 600)}ms`;
    const img = card.querySelector("img");
    if (img) {
      img.src = img.dataset.src;
      img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
      img.addEventListener("error", () => { img.classList.add("loaded"); img.style.opacity = .2; }, { once: true });
    }
  });
  renderProgress();
  updateFooter();
}

function updateFooter() {
  $("#footer-count").textContent = `${items().length} ${TAB_LABELS[ui.tab].noun} · ${countDone(items())} concluídos`;
}

function renderProgress() {
  const list = items();
  const total = list.length, done = countDone(list), pct = pctOf(list);
  $("#progress-title").textContent = TAB_LABELS[ui.tab].title;
  $("#progress-sub").textContent = `${done} de ${total} ${TAB_LABELS[ui.tab].noun} concluídos`;
  $("#bar-fill").style.width = pct + "%";
  $("#ring-fg").style.strokeDashoffset = RING_C * (1 - pct / 100);
  countUp($("#progress-pct"), pct);

  const groups = {};
  list.forEach((it) => {
    (groups[it.group] ||= { t: 0, d: 0 }).t++;
    if (stateOf(it.id).done) groups[it.group].d++;
  });
  $("#group-stats").innerHTML = Object.entries(groups)
    .map(([g, s]) => `<span class="gchip">${escapeHTML(g)} <b>${s.d}/${s.t}</b></span>`).join("");
}

/* ---------- animations ---------- */
function countUp(el, target) {
  const from = parseInt(el.dataset.v || "0", 10);
  el.dataset.v = target;
  if (reduce || from === target) { el.textContent = target + "%"; return; }
  const start = performance.now(), dur = 600;
  (function step(now) {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))) + "%";
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

function burst(x, y) {
  if (reduce) return;
  for (let i = 0; i < 14; i++) {
    const p = document.createElement("span");
    p.className = "particle";
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 50;
    p.style.cssText = `left:${x}px;top:${y}px;background:${COLORS[i % COLORS.length]};
      --tx:${Math.cos(a) * d}px;--ty:${Math.sin(a) * d}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

function celebrate(big) {
  if (reduce) return;
  const n = big ? 80 : 38;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "confetti-fall";
    p.style.cssText = `left:${Math.random() * 100}vw;background:${COLORS[i % COLORS.length]};
      --dur:${(1 + Math.random() * 1.3).toFixed(2)}s;--x:${(Math.random() * 140 - 70)}px;
      --rot:${Math.random() * 720}deg;animation-delay:${(Math.random() * 0.3).toFixed(2)}s`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2700);
  }
}

let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2400);
}

/* ---------- events ---------- */
function onGridClick(e) {
  const card = e.target.closest(".card");
  if (!card || !e.target.closest(".check")) return;
  const id = card.dataset.id;
  const st = stateOf(id);
  const nowDone = !st.done;
  const before = pctOf(items());

  progress[id] = { done: nowDone, date: nowDone ? (st.date || today()) : st.date };
  saveProgress();
  card.classList.toggle("done", nowDone);
  card.querySelector(".date-row").classList.toggle("hidden", !nowDone);
  const di = card.querySelector('input[type="date"]');
  if (di) di.value = progress[id].date || "";

  renderProgress();
  updateFooter();

  if (nowDone) {
    const r = e.target.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2);
    const after = pctOf(items());
    const hit = MILESTONES.find((m) => before < m && after >= m);
    if (hit) {
      celebrate(hit >= 100);
      toast(hit >= 100 ? `🏆 100% — todos os ${TAB_LABELS[ui.tab].noun} concluídos!` : `🎉 ${hit}% dos ${TAB_LABELS[ui.tab].noun}!`);
    }
  }
}

function onGridChange(e) {
  if (!e.target.matches('input[type="date"]')) return;
  const id = e.target.closest(".card").dataset.id;
  progress[id] = { done: stateOf(id).done, date: e.target.value };
  saveProgress();
  if (ui.sort === "recent") render();
}

function switchTab(tab) {
  if (tab === ui.tab) return;
  ui.tab = tab;
  document.body.dataset.tab = tab;
  document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", b.dataset.target === tab));
  if (tab === "books" && !reduce) {
    const pt = $("#page-turn");
    pt.classList.remove("flip"); void pt.offsetWidth; pt.classList.add("flip");
    setTimeout(() => pt.classList.remove("flip"), 850);
  } else {
    const g = $("#grid"); g.style.animation = "none"; void g.offsetWidth; g.style.animation = "fade .4s ease";
  }
  render();
}

/* parallax tilt + spotlight (fine pointers only) */
let tilted = null, raf;
function resetTilt(c) { if (c) { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); } }
function setupPointerFX() {
  if (reduce || !finePointer) return;
  document.body.classList.add("has-pointer");
  addEventListener("pointermove", (e) => {
    document.body.style.setProperty("--mx", e.clientX + "px");
    document.body.style.setProperty("--my", e.clientY + "px");
  }, { passive: true });

  const grid = $("#grid");
  grid.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".card");
    if (card !== tilted) { resetTilt(tilted); tilted = card; }
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      card.style.setProperty("--ry", ((px - .5) * 11).toFixed(2) + "deg");
      card.style.setProperty("--rx", ((.5 - py) * 13).toFixed(2) + "deg");
      card.style.setProperty("--sx", (px * 100).toFixed(1) + "%");
      card.style.setProperty("--sy", (py * 100).toFixed(1) + "%");
    });
  }, { passive: true });
  grid.addEventListener("pointerleave", () => { resetTilt(tilted); tilted = null; });
}

/* ---------- export / import ---------- */
function exportProgress() {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tracker-progress-${today()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast("Progresso exportado ✓");
}
function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (typeof incoming !== "object" || !incoming) throw 0;
      progress = { ...progress, ...incoming };
      saveProgress(); render();
      toast("Progresso importado ✓");
    } catch { toast("⚠︎ Não foi possível ler o arquivo"); }
  };
  reader.readAsText(file);
}

/* ---------- escapes ---------- */
function escapeHTML(s) { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function escapeAttr(s) { return escapeHTML(s).replace(/"/g, "&quot;"); }

/* ---------- init ---------- */
async function init() {
  const intro = $("#intro");
  if (reduce) intro.remove(); else setTimeout(() => intro.classList.add("gone"), 2700);

  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.target)));
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

  try { DATA = await (await fetch("data.json", { cache: "no-cache" })).json(); }
  catch { $("#grid").innerHTML = `<p class="empty">Não foi possível carregar data.json.</p>`; return; }

  render();
  setupPointerFX();
}
document.addEventListener("DOMContentLoaded", init);
