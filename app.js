(function(){
  "use strict";

  // ---------- Constants ----------
  const STORAGE_KEY = "ledger_expenses_v1";
  const BUDGET_KEY = "ledger_budget_v1";

  const CATEGORY_COLORS = {
    Housing: "#e8b96b",
    Food: "#a3e635",
    Transport: "#7c8cf8",
    Utilities: "#60a5fa",
    Entertainment: "#f472b6",
    Health: "#34d399",
    Shopping: "#fb923c",
    Other: "#9ca3af"
  };

  // ---------- Pure helper functions (unit-testable) ----------
  function monthKey(dateStr){
    return dateStr.slice(0,7);
  }

  function filterByMonth(expenses, ymKey){
    return expenses.filter(e => monthKey(e.date) === ymKey);
  }

  function computeSummary(monthExpenses){
    const total = monthExpenses.reduce((s,e)=> s + e.amount, 0);
    const count = monthExpenses.length;
    const avg = count ? total/count : 0;
    const byCategory = {};
    monthExpenses.forEach(e=>{
      byCategory[e.category] = (byCategory[e.category]||0) + e.amount;
    });
    let topCategory = null, topAmt = -1;
    Object.entries(byCategory).forEach(([cat,amt])=>{
      if(amt > topAmt){ topAmt = amt; topCategory = cat; }
    });
    return { total, count, avg, byCategory, topCategory, topAmt };
  }

  function shiftMonth(ymKey, delta){
    const [y,m] = ymKey.split('-').map(Number);
    const d = new Date(Date.UTC(y, m-1+delta, 1));
    const yy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth()+1).padStart(2,'0');
    return `${yy}-${mm}`;
  }

  function toCSV(monthExpenses){
    const header = "Date,Category,Note,Amount";
    const escape = (s) => `"${String(s).replace(/"/g,'""')}"`;
    const rows = monthExpenses
      .slice()
      .sort((a,b)=> a.date.localeCompare(b.date))
      .map(e => [e.date, escape(e.category), escape(e.note||""), e.amount.toFixed(2)].join(","));
    return [header, ...rows].join("\n");
  }

  function todayISO(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function formatMonthLabel(ymKey){
    const [y,m] = ymKey.split('-').map(Number);
    const d = new Date(Date.UTC(y, m-1, 1));
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  function formatMoney(n){
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatDayShort(dateStr){
    const [y,m,d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m-1, d));
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function uid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }

  // ---------- State ----------
  let expenses = [];
  let budget = null;
  let currentMonth = monthKey(todayISO());
  let editingId = null;

  // ---------- Persistence ----------
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      expenses = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(expenses)) expenses = [];
    }catch(e){
      expenses = [];
    }
    try{
      const b = localStorage.getItem(BUDGET_KEY);
      budget = b !== null ? parseFloat(b) : null;
      if(budget !== null && (isNaN(budget) || budget <= 0)) budget = null;
    }catch(e){
      budget = null;
    }
  }

  function saveExpenses(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    }catch(e){
      showToast("Couldn't save — storage may be full.");
    }
  }

  function saveBudget(){
    try{
      if(budget === null){
        localStorage.removeItem(BUDGET_KEY);
      } else {
        localStorage.setItem(BUDGET_KEY, String(budget));
      }
    }catch(e){ /* non-fatal */ }
  }

  // ---------- DOM refs ----------
  const el = {
    monthLabel: document.getElementById("month-label"),
    prevMonth: document.getElementById("prev-month"),
    nextMonth: document.getElementById("next-month"),
    jumpToday: document.getElementById("jump-today"),
    totalAmt: document.getElementById("total-amt"),
    txCount: document.getElementById("tx-count"),
    avgAmt: document.getElementById("avg-amt"),
    budgetRow: document.getElementById("budget-row"),
    budgetSpent: document.getElementById("budget-spent"),
    budgetTotal: document.getElementById("budget-total"),
    budgetFill: document.getElementById("budget-fill"),
    noBudgetNote: document.getElementById("no-budget-note"),
    setBudgetLink: document.getElementById("set-budget-link"),
    categoryBreakdown: document.getElementById("category-breakdown"),
    cbRows: document.getElementById("cb-rows"),
    form: document.getElementById("expense-form"),
    fAmount: document.getElementById("f-amount"),
    fDate: document.getElementById("f-date"),
    fCategory: document.getElementById("f-category"),
    fNote: document.getElementById("f-note"),
    formError: document.getElementById("form-error"),
    formTitle: document.getElementById("form-title"),
    submitBtn: document.getElementById("submit-btn"),
    cancelEditBtn: document.getElementById("cancel-edit-btn"),
    txList: document.getElementById("tx-list"),
    emptyState: document.getElementById("empty-state"),
    exportCsvBtn: document.getElementById("export-csv-btn"),
    clearMonthBtn: document.getElementById("clear-month-btn"),
    settingsBtn: document.getElementById("settings-btn"),
    settingsOverlay: document.getElementById("settings-overlay"),
    closeSettings: document.getElementById("close-settings"),
    sBudget: document.getElementById("s-budget"),
    saveBudgetBtn: document.getElementById("save-budget-btn"),
    clearBudgetBtn: document.getElementById("clear-budget-btn"),
    toast: document.getElementById("toast")
  };

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg){
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> el.toast.classList.remove("show"), 2200);
  }

  // ---------- Rendering ----------
  function render(){
    el.monthLabel.textContent = formatMonthLabel(currentMonth);

    const monthExpenses = filterByMonth(expenses, currentMonth);
    const summary = computeSummary(monthExpenses);

    el.totalAmt.textContent = formatMoney(summary.total);
    el.txCount.textContent = String(summary.count);
    el.avgAmt.textContent = formatMoney(summary.avg);

    // Budget
    if(budget && budget > 0){
      el.budgetRow.style.display = "";
      el.noBudgetNote.style.display = "none";
      const pct = Math.min(100, (summary.total / budget) * 100);
      el.budgetFill.style.width = pct + "%";
      el.budgetFill.classList.remove("warn","bad");
      if(summary.total > budget) el.budgetFill.classList.add("bad");
      else if(summary.total / budget > 0.8) el.budgetFill.classList.add("warn");
      el.budgetSpent.textContent = formatMoney(summary.total);
      el.budgetTotal.textContent = formatMoney(budget);
    } else {
      el.budgetRow.style.display = "none";
      el.noBudgetNote.style.display = "";
    }

    // Category breakdown
    const cats = Object.entries(summary.byCategory).sort((a,b)=> b[1]-a[1]);
    if(cats.length > 0){
      el.categoryBreakdown.style.display = "";
      el.cbRows.innerHTML = "";
      const maxAmt = cats[0][1];
      cats.forEach(([cat, amt])=>{
        const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
        const row = document.createElement("div");
        row.className = "cb-row";
        row.innerHTML = `
          <span class="cb-dot" style="background:${color}"></span>
          <span class="cb-name">${escapeHtml(cat)}</span>
          <span class="cb-track"><span class="cb-fill" style="width:${(amt/maxAmt)*100}%; background:${color}"></span></span>
          <span class="cb-amt">${formatMoney(amt)}</span>
        `;
        el.cbRows.appendChild(row);
      });
    } else {
      el.categoryBreakdown.style.display = "none";
    }

    // Transaction list
    el.txList.innerHTML = "";
    if(monthExpenses.length === 0){
      el.emptyState.style.display = "";
    } else {
      el.emptyState.style.display = "none";
      const sorted = monthExpenses.slice().sort((a,b)=> b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
      sorted.forEach(exp=>{
        const color = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other;
        const li = document.createElement("li");
        li.className = "tx-item";
        li.dataset.id = exp.id;
        li.innerHTML = `
          <span class="tx-date">${formatDayShort(exp.date)}</span>
          <span class="tx-dot" style="background:${color}"></span>
          <span class="tx-main">
            <div class="tx-cat">${escapeHtml(exp.category)}</div>
            ${exp.note ? `<div class="tx-note">${escapeHtml(exp.note)}</div>` : ""}
          </span>
          <span class="tx-amt">${formatMoney(exp.amount)}</span>
          <button class="tx-del" aria-label="Delete">✕</button>
        `;
        li.querySelector(".tx-main").addEventListener("click", ()=> startEdit(exp.id));
        li.querySelector(".tx-amt").addEventListener("click", ()=> startEdit(exp.id));
        li.querySelector(".tx-del").addEventListener("click", (ev)=>{
          ev.stopPropagation();
          deleteExpense(exp.id);
        });
        el.txList.appendChild(li);
      });
    }
  }

  function escapeHtml(str){
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---------- Actions ----------
  function addOrUpdateExpense(data){
    if(editingId){
      const idx = expenses.findIndex(e=> e.id === editingId);
      if(idx !== -1){
        expenses[idx] = { ...expenses[idx], ...data };
      }
      editingId = null;
    } else {
      expenses.push({ id: uid(), createdAt: Date.now(), ...data });
    }
    saveExpenses();
  }

  function deleteExpense(id){
    if(!window.confirm("Delete this expense?")) return;
    expenses = expenses.filter(e=> e.id !== id);
    saveExpenses();
    render();
    showToast("Expense deleted.");
  }

  function startEdit(id){
    const exp = expenses.find(e=> e.id === id);
    if(!exp) return;
    editingId = id;
    el.fAmount.value = exp.amount;
    el.fDate.value = exp.date;
    el.fCategory.value = exp.category;
    el.fNote.value = exp.note || "";
    el.formTitle.textContent = "Edit Expense";
    el.submitBtn.textContent = "Save Changes";
    el.cancelEditBtn.style.display = "";
    el.formError.textContent = "";
    el.fAmount.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit(){
    editingId = null;
    el.form.reset();
    el.fDate.value = todayISO();
    el.formTitle.textContent = "Add Expense";
    el.submitBtn.textContent = "Add Expense";
    el.cancelEditBtn.style.display = "none";
    el.formError.textContent = "";
  }

  function handleSubmit(ev){
    ev.preventDefault();
    const amount = parseFloat(el.fAmount.value);
    const date = el.fDate.value;
    const category = el.fCategory.value;
    const note = el.fNote.value.trim().slice(0,60);

    if(isNaN(amount) || amount <= 0){
      el.formError.textContent = "Enter a valid amount greater than 0.";
      return;
    }
    if(!date){
      el.formError.textContent = "Pick a date.";
      return;
    }
    el.formError.textContent = "";

    const wasEditing = !!editingId;
    addOrUpdateExpense({ amount: Math.round(amount*100)/100, date, category, note });

    const targetMonth = monthKey(date);
    if(targetMonth !== currentMonth){
      currentMonth = targetMonth;
    }

    cancelEdit();
    render();
    showToast(wasEditing ? "Expense updated." : "Expense added.");
  }

  function exportCSV(){
    const monthExpenses = filterByMonth(expenses, currentMonth);
    if(monthExpenses.length === 0){
      showToast("Nothing to export for this month.");
      return;
    }
    const csv = toCSV(monthExpenses);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger-${currentMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  }

  function clearMonth(){
    const monthExpenses = filterByMonth(expenses, currentMonth);
    if(monthExpenses.length === 0){
      showToast("This month is already empty.");
      return;
    }
    if(!window.confirm(`Delete all ${monthExpenses.length} expense(s) for ${formatMonthLabel(currentMonth)}?`)) return;
    expenses = expenses.filter(e=> monthKey(e.date) !== currentMonth);
    saveExpenses();
    render();
    showToast("Month cleared.");
  }

  // ---------- Settings sheet ----------
  function openSettings(){
    el.sBudget.value = budget !== null ? budget : "";
    el.settingsOverlay.classList.add("show");
  }
  function closeSettingsSheet(){
    el.settingsOverlay.classList.remove("show");
  }
  function handleSaveBudget(){
    const val = parseFloat(el.sBudget.value);
    if(isNaN(val) || val <= 0){
      showToast("Enter a valid budget amount.");
      return;
    }
    budget = Math.round(val*100)/100;
    saveBudget();
    closeSettingsSheet();
    render();
    showToast("Budget saved.");
  }
  function handleClearBudget(){
    budget = null;
    saveBudget();
    closeSettingsSheet();
    render();
    showToast("Budget removed.");
  }

  // ---------- Wire up events ----------
  function init(){
    loadState();
    el.fDate.value = todayISO();

    el.prevMonth.addEventListener("click", ()=>{ currentMonth = shiftMonth(currentMonth, -1); render(); });
    el.nextMonth.addEventListener("click", ()=>{ currentMonth = shiftMonth(currentMonth, 1); render(); });
    el.jumpToday.addEventListener("click", ()=>{ currentMonth = monthKey(todayISO()); render(); });

    el.form.addEventListener("submit", handleSubmit);
    el.cancelEditBtn.addEventListener("click", ()=>{ cancelEdit(); });

    el.exportCsvBtn.addEventListener("click", exportCSV);
    el.clearMonthBtn.addEventListener("click", clearMonth);

    el.settingsBtn.addEventListener("click", openSettings);
    el.closeSettings.addEventListener("click", closeSettingsSheet);
    el.settingsOverlay.addEventListener("click", (ev)=>{
      if(ev.target === el.settingsOverlay) closeSettingsSheet();
    });
    el.setBudgetLink.addEventListener("click", openSettings);
    el.saveBudgetBtn.addEventListener("click", handleSaveBudget);
    el.clearBudgetBtn.addEventListener("click", handleClearBudget);

    render();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ---------- Service worker registration ----------
  if("serviceWorker" in navigator){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("service-worker.js").catch(()=>{ /* non-fatal, e.g. unsupported context */ });
    });
  }

  // Expose for testing hooks (harmless in production; not part of any public API)
  window.__ledgerTestHooks = { monthKey, filterByMonth, computeSummary, shiftMonth, toCSV, formatMoney };
})();
