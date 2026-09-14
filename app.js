/* ---------- State ---------- */
const DISCIPLINE = ["Followed plan", "Broke rule", "Revenge trade", "Hesitated"];
const MINDSET = ["Calm", "Confident", "Anxious", "FOMO", "Bored"];

let state = {
  trades: [],
  playbooks: [],
  balance: 10000
};

function load() {
  const raw = localStorage.getItem("pnl-lens-state");
  if (raw) state = JSON.parse(raw);
}
function save() {
  localStorage.setItem("pnl-lens-state", JSON.stringify(state));
}

/* ---------- CSV import ---------- */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cells = line.split(",");
    const row = {};
    headers.forEach((h, i) => row[h.trim()] = cells[i] !== undefined ? cells[i].trim() : "");
    return row;
  });
}

function importCSVText(text) {
  const rows = parseCSV(text);
  let added = 0;
  rows.forEach(r => {
    if (!r.TradeID) return;
    if (state.trades.some(t => t.tradeId === r.TradeID)) return;
    state.trades.push({
      tradeId: r.TradeID,
      symbol: r.Symbol,
      side: r.Side || r.Direction || "",
      volume: parseFloat(r.Volume || r.Lots || 0),
      openDate: r.OpenDate,
      openTime: r.OpenTime,
      closeDate: r.CloseDate,
      closeTime: r.CloseTime,
      entryPrice: parseFloat(r.EntryPrice || 0),
      exitPrice: parseFloat(r.ExitPrice || 0),
      sl: r.SL || r.StopLoss || "",
      tp: r.TP || r.TakeProfit || "",
      pips: parseFloat(r.Pips || 0),
      durationMinutes: parseInt(r.DurationMinutes || 0),
      commission: parseFloat(r.Commission || 0),
      swap: parseFloat(r.Swap || 0),
      pnl: parseFloat(r.PnL || 0),
      playbooks: r.Playbook ? r.Playbook.split(";").map(s => s.trim()).filter(Boolean) : [],
      notes: r.Notes || "",
      discipline: "",
      mindset: ""
    });
    added++;
  });
  save();
  return added;
}

function exportCSV() {
  const headers = ["TradeID","Symbol","Side","Volume","OpenDate","OpenTime","CloseDate","CloseTime","EntryPrice","ExitPrice","SL","TP","Pips","DurationMinutes","Commission","Swap","PnL","Playbook","Notes"];
  const lines = [headers.join(",")];
  state.trades.forEach(t => {
    lines.push([
      t.tradeId, t.symbol, t.side, t.volume, t.openDate, t.openTime, t.closeDate, t.closeTime,
      t.entryPrice, t.exitPrice, t.sl, t.tp, t.pips, t.durationMinutes, t.commission, t.swap, t.pnl,
      (t.playbooks || []).join(";"), (t.notes || "").replace(/,/g, ";")
    ].join(","));
  });
  downloadText(lines.join("\n"), "pnl_lens_export.csv", "text/csv");
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- Derived stats ---------- */
function computeStats(trades) {
  const closed = trades;
  const wins = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl < 0);
  const netPnl = closed.reduce((s, t) => s + t.pnl, 0);
  const winRate = closed.length ? (wins.length / closed.length * 100) : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss ? (grossProfit / grossLoss) : (grossProfit > 0 ? Infinity : 0);
  return { count: closed.length, netPnl, winRate, avgWin, avgLoss, profitFactor };
}

function fmtMoney(n) {
  const sign = n < 0 ? "-" : "+";
  return sign + "$" + Math.abs(n).toFixed(2);
}

/* ---------- Rendering: Dashboard ---------- */
function renderDashboard() {
  const s = computeStats(state.trades);
  const wrap = document.getElementById("dash-stats");
  wrap.innerHTML = statCard("Net P&L", fmtMoney(s.netPnl), s.netPnl >= 0 ? "gain" : "loss")
    + statCard("Win rate", s.winRate.toFixed(1) + "%")
    + statCard("Trades logged", s.count)
    + statCard("Profit factor", isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞");

  const recent = [...state.trades].sort((a, b) => (b.openDate || "").localeCompare(a.openDate || "")).slice(0, 6);
  const recentWrap = document.getElementById("dash-recent");
  if (!recent.length) {
    recentWrap.innerHTML = emptyState("No trades yet", "Import a CSV or log your first trade.");
  } else {
    recentWrap.innerHTML = recent.map(t => ledgerRowHTML(t)).join("");
    attachRowClicks(recentWrap);
  }
}

function statCard(label, value, cls) {
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value ${cls || ""}">${value}</div></div>`;
}

function emptyState(title, sub) {
  return `<div class="empty-state"><h3>${title}</h3><p>${sub}</p></div>`;
}

/* ---------- Rendering: Trade history ---------- */
function ledgerRowHTML(t) {
  const pbHTML = t.playbooks && t.playbooks.length
    ? t.playbooks.map(p => `<span class="pb-pill">${p}</span>`).join("")
    : `<span class="pb-pill untagged">untagged</span>`;
  return `
    <div class="ledger-row" data-id="${t.tradeId}">
      <span class="mono">${t.openDate || ""}</span>
      <span class="symbol-cell">${t.symbol}<span class="side-tag">${t.side}</span></span>
      <span class="mono">${t.volume}</span>
      <span class="tag-cell">${pbHTML}</span>
      <span class="num-cell">${t.pips >= 0 ? "+" : ""}${t.pips}</span>
      <span class="num-cell">${t.durationMinutes}m</span>
      <span class="num-cell ${t.pnl >= 0 ? "gain" : "loss"}">${fmtMoney(t.pnl)}</span>
    </div>`;
}

function attachRowClicks(container) {
  container.querySelectorAll(".ledger-row[data-id]").forEach(row => {
    row.addEventListener("click", () => openDrawer(row.dataset.id));
  });
}

function getFilteredTrades() {
  const symbol = document.getElementById("filter-symbol").value;
  const playbook = document.getElementById("filter-playbook").value;
  const outcome = document.getElementById("filter-outcome").value;
  const search = document.getElementById("filter-search").value.toLowerCase();

  return state.trades.filter(t => {
    if (symbol && t.symbol !== symbol) return false;
    if (playbook && !(t.playbooks || []).includes(playbook)) return false;
    if (outcome === "win" && t.pnl <= 0) return false;
    if (outcome === "loss" && t.pnl >= 0) return false;
    if (outcome === "untagged" && (t.playbooks || []).length) return false;
    if (search && !(t.symbol.toLowerCase().includes(search) || (t.notes || "").toLowerCase().includes(search))) return false;
    return true;
  }).sort((a, b) => (b.openDate || "").localeCompare(a.openDate || ""));
}

function renderHistory() {
  populateFilterOptions();
  const trades = getFilteredTrades();
  document.getElementById("history-count").textContent = `${state.trades.length} entries logged`;

  const head = `<div class="ledger-row head">
      <span>Date</span><span>Symbol</span><span>Vol</span><span>Playbook</span><span>Pips</span><span>Duration</span><span>P&amp;L</span>
    </div>`;

  const container = document.getElementById("ledger-table");
  if (!trades.length) {
    container.innerHTML = head + emptyState("Nothing here yet", "Import your MT5 CSV to get started.");
    return;
  }
  container.innerHTML = head + trades.map(ledgerRowHTML).join("");
  attachRowClicks(container);
}

function populateFilterOptions() {
  const symbolSel = document.getElementById("filter-symbol");
  const pbSel = document.getElementById("filter-playbook");
  const symbols = [...new Set(state.trades.map(t => t.symbol))].sort();
  const curSym = symbolSel.value;
  symbolSel.innerHTML = `<option value="">All symbols</option>` + symbols.map(s => `<option value="${s}">${s}</option>`).join("");
  symbolSel.value = curSym;

  const curPb = pbSel.value;
  pbSel.innerHTML = `<option value="">All playbooks</option>` + state.playbooks.map(p => `<option value="${p.name}">${p.name}</option>`).join("");
  pbSel.value = curPb;
}

/* ---------- Drawer (trade detail) ---------- */
let activeTradeId = null;

function openDrawer(tradeId) {
  activeTradeId = tradeId;
  const t = state.trades.find(x => x.tradeId === tradeId);
  if (!t) return;
  document.getElementById("drawer-title").textContent = `${t.symbol} · ${t.openDate}`;

  const pbChips = state.playbooks.map(p =>
    `<span class="chip ${t.playbooks.includes(p.name) ? "is-selected" : ""}" data-pb="${p.name}">${p.name}</span>`
  ).join("") || `<span class="muted small">No playbooks yet — create one on the Playbooks page.</span>`;

  const discChips = DISCIPLINE.map(d => `<span class="chip ${t.discipline === d ? "is-selected" : ""}" data-disc="${d}">${d}</span>`).join("");
  const mindChips = MINDSET.map(m => `<span class="chip ${t.mindset === m ? "is-selected" : ""}" data-mind="${m}">${m}</span>`).join("");

  document.getElementById("drawer-body").innerHTML = `
    <div class="drawer-summary">
      <div>Direction<b>${t.side}</b></div>
      <div>Volume<b>${t.volume}</b></div>
      <div>Entry<b>${t.entryPrice}</b></div>
      <div>Exit<b>${t.exitPrice}</b></div>
      <div>Pips<b>${t.pips}</b></div>
      <div>P&amp;L<b class="${t.pnl >= 0 ? "gain" : "loss"}">${fmtMoney(t.pnl)}</b></div>
    </div>

    <div class="field">
      <label>Playbook</label>
      <div class="chip-select" id="pb-chips">${pbChips}</div>
    </div>

    <div class="field">
      <label>Discipline</label>
      <div class="chip-select" id="disc-chips">${discChips}</div>
    </div>

    <div class="field">
      <label>Mindset</label>
      <div class="chip-select" id="mind-chips">${mindChips}</div>
    </div>

    <div class="field">
      <label>Notes</label>
      <textarea id="trade-notes" placeholder="What happened, what you'd repeat, what you'd change…">${t.notes || ""}</textarea>
    </div>

    <div class="drawer-actions">
      <button class="btn btn-primary" id="drawer-save">Save</button>
      <button class="btn btn-danger" id="drawer-delete">Delete trade</button>
    </div>
  `;

  document.querySelectorAll("#pb-chips .chip").forEach(c => c.addEventListener("click", () => c.classList.toggle("is-selected")));
  document.querySelectorAll("#disc-chips .chip").forEach(c => c.addEventListener("click", () => {
    document.querySelectorAll("#disc-chips .chip").forEach(x => x.classList.remove("is-selected"));
    c.classList.add("is-selected");
  }));
  document.querySelectorAll("#mind-chips .chip").forEach(c => c.addEventListener("click", () => {
    document.querySelectorAll("#mind-chips .chip").forEach(x => x.classList.remove("is-selected"));
    c.classList.add("is-selected");
  }));

  document.getElementById("drawer-save").addEventListener("click", saveDrawer);
  document.getElementById("drawer-delete").addEventListener("click", deleteActiveTrade);

  document.getElementById("drawer-backdrop").classList.add("is-open");
}

function saveDrawer() {
  const t = state.trades.find(x => x.tradeId === activeTradeId);
  if (!t) return;
  t.playbooks = [...document.querySelectorAll("#pb-chips .chip.is-selected")].map(c => c.dataset.pb);
  const disc = document.querySelector("#disc-chips .chip.is-selected");
  t.discipline = disc ? disc.dataset.disc : "";
  const mind = document.querySelector("#mind-chips .chip.is-selected");
  t.mindset = mind ? mind.dataset.mind : "";
  t.notes = document.getElementById("trade-notes").value;
  save();
  closeDrawer();
  renderAll();
}

function deleteActiveTrade() {
  state.trades = state.trades.filter(t => t.tradeId !== activeTradeId);
  save();
  closeDrawer();
  renderAll();
}

function closeDrawer() {
  document.getElementById("drawer-backdrop").classList.remove("is-open");
  activeTradeId = null;
}

/* ---------- Add trade manually ---------- */
function openAddTradeDrawer() {
  activeTradeId = null;
  document.getElementById("drawer-title").textContent = "Log a trade";
  document.getElementById("drawer-body").innerHTML = `
    <div class="field-row">
      <div class="field"><label>Symbol</label><input id="nt-symbol" placeholder="EURUSD"></div>
      <div class="field"><label>Side</label><select id="nt-side"><option>buy</option><option>sell</option></select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Volume</label><input id="nt-volume" type="number" step="0.01"></div>
      <div class="field"><label>Open date</label><input id="nt-date" type="date"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Entry price</label><input id="nt-entry" type="number" step="0.00001"></div>
      <div class="field"><label>Exit price</label><input id="nt-exit" type="number" step="0.00001"></div>
    </div>
    <div class="field"><label>P&amp;L ($)</label><input id="nt-pnl" type="number" step="0.01"></div>
    <div class="drawer-actions">
      <button class="btn btn-primary" id="nt-save">Add trade</button>
    </div>
  `;
  document.getElementById("nt-save").addEventListener("click", () => {
    const symbol = document.getElementById("nt-symbol").value.trim().toUpperCase();
    if (!symbol) { alert("Enter a symbol first"); return; }
    state.trades.push({
      tradeId: "manual-" + Date.now(),
      symbol,
      side: document.getElementById("nt-side").value,
      volume: parseFloat(document.getElementById("nt-volume").value || 0),
      openDate: document.getElementById("nt-date").value,
      openTime: "", closeDate: document.getElementById("nt-date").value, closeTime: "",
      entryPrice: parseFloat(document.getElementById("nt-entry").value || 0),
      exitPrice: parseFloat(document.getElementById("nt-exit").value || 0),
      sl: "", tp: "", pips: 0, durationMinutes: 0,
      commission: 0, swap: 0,
      pnl: parseFloat(document.getElementById("nt-pnl").value || 0),
      playbooks: [], notes: "", discipline: "", mindset: ""
    });
    save();
    closeDrawer();
    renderAll();
  });
  document.getElementById("drawer-backdrop").classList.add("is-open");
}

/* ---------- Playbooks ---------- */
function renderPlaybooks() {
  const grid = document.getElementById("playbook-grid");
  if (!state.playbooks.length) {
    grid.innerHTML = emptyState("No playbooks yet", "Create one for each setup you trade — e.g. \u2018London breakout\u2019 or \u2018EMA pullback\u2019.");
    return;
  }
  grid.innerHTML = state.playbooks.map(p => {
    const trades = state.trades.filter(t => (t.playbooks || []).includes(p.name));
    const s = computeStats(trades);
    return `
      <div class="playbook-card">
        <h3>${p.name}</h3>
        <p class="muted small">${p.rules || "No rules written yet."}</p>
        <div class="playbook-stats">
          <div>Trades<b>${s.count}</b></div>
          <div>Win rate<b>${s.count ? s.winRate.toFixed(0) + "%" : "—"}</b></div>
          <div>Net P&amp;L<b class="${s.netPnl >= 0 ? "gain" : "loss"}">${s.count ? fmtMoney(s.netPnl) : "—"}</b></div>
        </div>
      </div>`;
  }).join("");
}

function newPlaybook() {
  const name = prompt("Name this playbook (e.g. 'London breakout'):");
  if (!name) return;
  state.playbooks.push({ name: name.trim(), rules: "" });
  save();
  renderAll();
}

/* ---------- Analytics ---------- */
function renderAnalytics() {
  drawEquityCurve();

  const byPb = document.getElementById("analytics-playbook");
  if (!state.playbooks.length) {
    byPb.innerHTML = `<div class="a-row muted">No playbooks yet.</div>`;
  } else {
    byPb.innerHTML = state.playbooks.map(p => {
      const trades = state.trades.filter(t => (t.playbooks || []).includes(p.name));
      const s = computeStats(trades);
      return `<div class="a-row"><span>${p.name}</span><span class="${s.netPnl >= 0 ? "gain" : "loss"} mono">${s.count ? fmtMoney(s.netPnl) : "—"}</span></div>`;
    }).join("");
  }

  const bySym = document.getElementById("analytics-symbol");
  const symbols = [...new Set(state.trades.map(t => t.symbol))];
  if (!symbols.length) {
    bySym.innerHTML = `<div class="a-row muted">No trades yet.</div>`;
  } else {
    bySym.innerHTML = symbols.map(sym => {
      const trades = state.trades.filter(t => t.symbol === sym);
      const s = computeStats(trades);
      return `<div class="a-row"><span>${sym}</span><span class="${s.netPnl >= 0 ? "gain" : "loss"} mono">${fmtMoney(s.netPnl)}</span></div>`;
    }).join("");
  }
}

function drawEquityCurve() {
  const canvas = document.getElementById("equity-canvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.clientWidth || 600;
  const h = 220;
  canvas.width = w; canvas.height = h;
  ctx.clearRect(0, 0, w, h);

  const sorted = [...state.trades].sort((a, b) => (a.openDate || "").localeCompare(b.openDate || ""));
  let bal = state.balance;
  const points = [bal];
  sorted.forEach(t => { bal += t.pnl; points.push(bal); });

  const min = Math.min(...points), max = Math.max(...points);
  const pad = 30;
  const range = (max - min) || 1;

  ctx.strokeStyle = "#C9BFA0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - 10, h - pad);
  ctx.stroke();

  if (points.length < 2) {
    ctx.fillStyle = "#8B8A7A";
    ctx.font = "13px Inter";
    ctx.fillText("Import trades to see your equity curve", pad, h / 2);
    return;
  }

  ctx.strokeStyle = "#B8712A";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad - 20);
    const y = (h - pad) - ((p - min) / range) * (h - pad - 20);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#55564C";
  ctx.font = "11px 'IBM Plex Mono'";
  ctx.fillText("$" + min.toFixed(0), 0, h - pad + 4);
  ctx.fillText("$" + max.toFixed(0), 0, 14);
}

/* ---------- Settings ---------- */
function renderSettings() {
  document.getElementById("setting-balance").value = state.balance;
}

/* ---------- Wiring ---------- */
function renderAll() {
  renderDashboard();
  renderHistory();
  renderPlaybooks();
  renderAnalytics();
  renderSettings();
}

function switchPage(page) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.toggle("is-active", n.dataset.page === page));
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("is-active", p.id === "page-" + page));
  if (page === "analytics") drawEquityCurve();
}

document.querySelectorAll(".nav-item").forEach(n => n.addEventListener("click", () => switchPage(n.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(el => el.addEventListener("click", () => switchPage(el.dataset.goto)));

document.getElementById("drawer-close").addEventListener("click", closeDrawer);
document.getElementById("drawer-backdrop").addEventListener("click", e => { if (e.target.id === "drawer-backdrop") closeDrawer(); });

document.getElementById("btn-add").addEventListener("click", openAddTradeDrawer);
document.getElementById("btn-add-dash").addEventListener("click", openAddTradeDrawer);
document.getElementById("btn-new-playbook").addEventListener("click", newPlaybook);
document.getElementById("btn-export").addEventListener("click", exportCSV);

document.getElementById("btn-export-json").addEventListener("click", () => {
  downloadText(JSON.stringify(state, null, 2), "pnl_lens_data.json", "application/json");
});
document.getElementById("btn-clear").addEventListener("click", () => {
  if (confirm("This deletes every trade and playbook. Continue?")) {
    state = { trades: [], playbooks: [], balance: 10000 };
    save();
    renderAll();
  }
});
document.getElementById("setting-balance").addEventListener("change", e => {
  state.balance = parseFloat(e.target.value || 0);
  save();
  drawEquityCurve();
});

function wireImportButton(btnId) {
  document.getElementById(btnId).addEventListener("click", () => document.getElementById("csv-input").click());
}
wireImportButton("btn-import");
wireImportButton("btn-import-dash");

document.getElementById("csv-input").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const added = importCSVText(reader.result);
    renderAll();
    alert(`Imported ${added} trade${added === 1 ? "" : "s"}.`);
  };
  reader.readAsText(file);
  e.target.value = "";
});

["filter-symbol", "filter-playbook", "filter-outcome", "filter-search"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderHistory);
});

/* ---------- Init ---------- */
load();
renderAll();
