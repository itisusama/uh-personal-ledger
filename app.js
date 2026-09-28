/* =========================================================
   Usama Hassan — Account Statement
   Plain JavaScript. Local Storage only. Markdown for backup.
   ========================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'usamaHassanAccountStatement';
  var APP_TITLE = 'Usama Hassan Account Statement';
  var FILE_BASE = 'Usama-Hassan-Account-Statement';
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  var SAMPLE_TRANSACTIONS = [
    { date: '2026-09-12', description: 'Bought groceries from XYZ store', amount: 2000, account: 'Cash', type: 'debit' },
    { date: '2026-09-13', description: 'Something', amount: 2000, account: 'Jazz Cash', type: 'debit' },
    { date: '2026-09-14', description: 'Profit from Raqmi', amount: 2000, account: 'Raqmi', type: 'credit' },
    { date: '2026-09-15', description: 'Claude Subscription done', amount: 5330, account: 'SadaPay', type: 'debit' },
    { date: '2026-09-20', description: 'Jazz cash week profit', amount: 2000, account: 'Jazz Week', type: 'credit' }
  ];

  /* =========================================================
     Utilities
     ========================================================= */

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'tx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function currentMonthKey() { return todayISO().slice(0, 7); }

  // Strict YYYY-MM-DD check that also rejects impossible dates like 2026-02-31.
  function isValidISODate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var p = s.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }

  function monthKeyOf(isoDate) { return isoDate.slice(0, 7); }

  function monthLabel(key) {
    if (key === 'all') return 'All Time';
    var p = key.split('-');
    return MONTH_NAMES[Number(p[1]) - 1] + ' ' + p[0];
  }

  function shiftMonth(key, delta) {
    var p = key.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + delta, 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  function formatDateShort(iso) {
    var p = iso.split('-');
    return Number(p[2]) + ' ' + MONTH_NAMES[Number(p[1]) - 1].slice(0, 3) + ' ' + p[0];
  }

  function formatDateLong(iso) {
    var p = iso.split('-');
    return Number(p[2]) + ' ' + MONTH_NAMES[Number(p[1]) - 1] + ' ' + p[0];
  }

  function roundMoney(n) { return Math.round(n * 100) / 100; }

  function formatNumber(n) {
    return Math.abs(roundMoney(n)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  // "2,000 PKR"
  function formatPKR(n) { return formatNumber(n) + ' PKR'; }

  // "+ 4,000 PKR" / "- 9,330 PKR" / "0 PKR"
  function formatSigned(n, compact) {
    var r = roundMoney(n);
    if (r === 0) return '0 PKR';
    var sep = compact ? '' : ' ';
    return (r > 0 ? '+' : '-') + sep + formatNumber(r) + ' PKR';
  }

  // Accepts "2,000", "2000", "2000.50", "PKR 2,000", "2,000 PKR".
  function parseAmount(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    var cleaned = value.replace(/pkr|rs\.?/gi, '').replace(/[,\s]/g, '');
    if (!/^\d+(\.\d+)?$/.test(cleaned)) return NaN;
    return Number(cleaned);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSpaces(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function $(id) { return document.getElementById(id); }

  /* =========================================================
     Storage layer
     ========================================================= */

  var storageAvailable = (function () {
    try {
      var k = '__uh_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  var transactions = [];

  function cleanTransaction(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var t = {
      id: raw.id ? String(raw.id) : generateId(),
      date: String(raw.date || ''),
      description: normalizeSpaces(raw.description),
      amount: roundMoney(parseAmount(raw.amount)),
      account: normalizeSpaces(raw.account),
      type: String(raw.type || '').toLowerCase(),
      createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString()
    };
    if (raw.updatedAt) t.updatedAt = String(raw.updatedAt);
    if (raw.sample === true) t.sample = true;
    if (!isValidISODate(t.date)) return null;
    if (!t.description || !t.account) return null;
    if (!(t.amount > 0) || !isFinite(t.amount)) return null;
    if (t.type !== 'credit' && t.type !== 'debit') return null;
    return t;
  }

  function buildSampleData() {
    var now = Date.now();
    return SAMPLE_TRANSACTIONS.map(function (s, i) {
      return {
        id: generateId(),
        date: s.date,
        description: s.description,
        amount: s.amount,
        account: s.account,
        type: s.type,
        createdAt: new Date(now + i).toISOString(),
        sample: true
      };
    });
  }

  function loadTransactions() {
    if (!storageAvailable) {
      transactions = buildSampleData();
      return transactions;
    }
    var raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }

    if (raw === null) {
      // First visit: seed demo data so the app can be tried immediately.
      transactions = buildSampleData();
      saveTransactions();
      return transactions;
    }

    try {
      var parsed = JSON.parse(raw);
      var list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.transactions) ? parsed.transactions : []);
      transactions = list.map(cleanTransaction).filter(Boolean);
    } catch (e) {
      // Keep the unreadable data aside instead of silently destroying it.
      try { window.localStorage.setItem(STORAGE_KEY + '_corrupt_' + Date.now(), raw); } catch (e2) { /* ignore */ }
      transactions = [];
      setTimeout(function () {
        showToast('Saved data could not be read. A copy was kept aside in Local Storage.', true);
      }, 300);
    }
    return transactions;
  }

  function saveTransactions() {
    if (!storageAvailable) return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, transactions: transactions }));
      return true;
    } catch (e) {
      showToast('Could not save to Local Storage. Download a Markdown backup now.', true);
      return false;
    }
  }

  function addTransaction(data) {
    var t = cleanTransaction({
      id: generateId(),
      date: data.date,
      description: data.description,
      amount: data.amount,
      account: data.account,
      type: data.type,
      createdAt: new Date().toISOString()
    });
    if (!t) return null;
    transactions.push(t);
    saveTransactions();
    return t;
  }

  function updateTransaction(id, data) {
    var idx = findIndex(id);
    if (idx === -1) return null;
    var existing = transactions[idx];
    var t = cleanTransaction({
      id: existing.id,
      date: data.date,
      description: data.description,
      amount: data.amount,
      account: data.account,
      type: data.type,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
      // Once edited, a sample entry becomes a real record: no sample flag.
    });
    if (!t) return null;
    transactions[idx] = t;
    saveTransactions();
    return t;
  }

  function deleteTransaction(id) {
    var idx = findIndex(id);
    if (idx === -1) return false;
    transactions.splice(idx, 1);
    saveTransactions();
    return true;
  }

  function replaceAllTransactions(list) {
    transactions = list.slice();
    saveTransactions();
  }

  function findIndex(id) {
    for (var i = 0; i < transactions.length; i++) {
      if (transactions[i].id === id) return i;
    }
    return -1;
  }

  function getTransaction(id) {
    var i = findIndex(id);
    return i === -1 ? null : transactions[i];
  }

  /* =========================================================
     Calculations
     ========================================================= */

  function totals(list) {
    var credit = 0, debit = 0;
    list.forEach(function (t) {
      if (t.type === 'credit') credit += t.amount; else debit += t.amount;
    });
    credit = roundMoney(credit);
    debit = roundMoney(debit);
    return { credit: credit, debit: debit, net: roundMoney(credit - debit), count: list.length };
  }

  function inMonth(list, month) {
    if (month === 'all') return list.slice();
    return list.filter(function (t) { return monthKeyOf(t.date) === month; });
  }

  function accountNames(list) {
    var map = {};
    list.forEach(function (t) {
      var key = t.account.toLowerCase();
      if (!map[key]) map[key] = t.account;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
  }

  function accountSummary(list) {
    var map = {};
    list.forEach(function (t) {
      var key = t.account.toLowerCase();
      if (!map[key]) map[key] = { name: t.account, credit: 0, debit: 0, count: 0 };
      map[key][t.type] += t.amount;
      map[key].count++;
    });
    return Object.keys(map).map(function (k) {
      var a = map[k];
      a.credit = roundMoney(a.credit);
      a.debit = roundMoney(a.debit);
      a.net = roundMoney(a.credit - a.debit);
      return a;
    }).sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }); });
  }

  function sortTransactions(list, order) {
    var dir = order === 'asc' ? 1 : -1;
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -dir : dir;
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -dir : dir;
      return 0;
    });
  }

  function monthsWithData() {
    var set = {};
    transactions.forEach(function (t) { set[monthKeyOf(t.date)] = true; });
    return Object.keys(set).sort().reverse();
  }

  /* =========================================================
     State
     ========================================================= */

  var state = {
    month: currentMonthKey(),
    account: 'all',
    type: 'all',
    search: '',
    sort: 'desc'
  };

  function initialMonth() {
    var current = currentMonthKey();
    var months = monthsWithData();
    // Open on the current month if it has records; otherwise the latest month that does.
    if (months.length === 0 || months.indexOf(current) !== -1) return current;
    return months[0];
  }

  function filteredTransactions() {
    var list = inMonth(transactions, state.month);
    if (state.account !== 'all') {
      var acc = state.account.toLowerCase();
      list = list.filter(function (t) { return t.account.toLowerCase() === acc; });
    }
    if (state.type !== 'all') {
      list = list.filter(function (t) { return t.type === state.type; });
    }
    var q = state.search.trim().toLowerCase();
    if (q) {
      list = list.filter(function (t) {
        return t.description.toLowerCase().indexOf(q) !== -1 || t.account.toLowerCase().indexOf(q) !== -1;
      });
    }
    return sortTransactions(list, state.sort);
  }

  function filtersActive() {
    return state.account !== 'all' || state.type !== 'all' || state.search.trim() !== '';
  }

  /* =========================================================
     Rendering
     ========================================================= */

  function render() {
    renderSampleBanner();
    renderMonthBar();
    renderSummary();
    renderAccountFilter();
    renderList();
    renderAccountSummary();
    renderExportScope();
  }

  function renderSampleBanner() {
    var n = transactions.filter(function (t) { return t.sample; }).length;
    $('sampleBanner').hidden = n === 0;
    if (n) {
      $('sampleBannerText').textContent = n + ' transaction' + (n === 1 ? ' is' : 's are') +
        ' marked “Sample”. They are demo entries so you can try the app. Your own entries are not affected when you clear them.';
    }
  }

  function renderMonthBar() {
    var isAll = state.month === 'all';
    $('currentMonthLabel').textContent = monthLabel(state.month);

    var prevBtn = $('prevMonthBtn');
    var nextBtn = $('nextMonthBtn');
    if (isAll) {
      prevBtn.hidden = true;
      nextBtn.hidden = true;
    } else {
      prevBtn.hidden = false;
      nextBtn.hidden = false;
      $('prevMonthLabel').textContent = monthLabel(shiftMonth(state.month, -1));
      $('nextMonthLabel').textContent = monthLabel(shiftMonth(state.month, 1));
    }

    // Month dropdown: All Time + months with data + current month + the selected month.
    var months = monthsWithData();
    [currentMonthKey(), state.month].forEach(function (m) {
      if (m !== 'all' && months.indexOf(m) === -1) months.push(m);
    });
    months.sort().reverse();

    var counts = {};
    transactions.forEach(function (t) {
      var k = monthKeyOf(t.date);
      counts[k] = (counts[k] || 0) + 1;
    });

    var html = '<option value="all">All Time (' + transactions.length + ')</option>';
    months.forEach(function (m) {
      html += '<option value="' + m + '">' + monthLabel(m) + ' (' + (counts[m] || 0) + ')</option>';
    });
    var sel = $('monthSelect');
    sel.innerHTML = html;
    sel.value = state.month;
  }

  function renderSummary() {
    var list = inMonth(transactions, state.month);
    var s = totals(list);
    var summaryEl = document.querySelector('.summary');
    var netCard = $('netCard');

    $('totalCredit').textContent = formatSigned(s.credit);
    $('totalDebit').textContent = s.debit === 0 ? '0 PKR' : '- ' + formatNumber(s.debit) + ' PKR';
    $('totalNet').textContent = formatSigned(s.net);

    netCard.classList.remove('is-plus', 'is-minus');
    summaryEl.classList.toggle('is-empty', s.count === 0);

    var verdict;
    if (s.count === 0) {
      verdict = state.month === 'all' ? 'No transactions recorded yet.' : 'No transactions in ' + monthLabel(state.month) + '.';
    } else if (s.net > 0) {
      netCard.classList.add('is-plus');
      verdict = 'You are in plus — more came in than went out.';
    } else if (s.net < 0) {
      netCard.classList.add('is-minus');
      verdict = 'You are in minus — more went out than came in.';
    } else {
      verdict = 'Even — money in equals money out.';
    }
    $('netVerdict').textContent = verdict;
  }

  function renderAccountFilter() {
    var names = accountNames(transactions);
    var sel = $('accountFilter');
    var stillExists = state.account === 'all' || names.some(function (n) { return n.toLowerCase() === state.account.toLowerCase(); });
    if (!stillExists) state.account = 'all';

    var html = '<option value="all">All accounts</option>';
    names.forEach(function (n) {
      html += '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>';
    });
    sel.innerHTML = html;
    if (state.account === 'all') {
      sel.value = 'all';
    } else {
      var match = names.filter(function (n) { return n.toLowerCase() === state.account.toLowerCase(); })[0];
      sel.value = match;
      state.account = match;
    }

    // Suggestions for the form.
    $('accountOptions').innerHTML = names.map(function (n) {
      return '<option value="' + escapeHtml(n) + '"></option>';
    }).join('');
  }

  function renderList() {
    var list = filteredTransactions();
    var monthList = inMonth(transactions, state.month);
    var body = $('txBody');
    var table = $('txTable');
    var empty = $('emptyState');

    $('resetFiltersBtn').hidden = !filtersActive();

    // Remove previous footer.
    var oldFooter = document.querySelector('.list-footer');
    if (oldFooter) oldFooter.remove();

    if (transactions.length === 0) {
      table.hidden = true;
      empty.hidden = false;
      empty.innerHTML =
        '<p class="empty-title">No transactions yet.</p>' +
        '<p class="empty-text">Start recording your money activity.</p>' +
        '<button type="button" class="btn btn-primary" data-action="add"><span aria-hidden="true">+</span> Add Transaction</button>';
      $('resultInfo').textContent = '';
      return;
    }

    if (monthList.length === 0) {
      table.hidden = true;
      empty.hidden = false;
      empty.innerHTML =
        '<p class="empty-title">No transactions for ' + escapeHtml(monthLabel(state.month)) + '.</p>' +
        '<p class="empty-text">Add one for this month, or look at another month.</p>' +
        '<button type="button" class="btn btn-primary" data-action="add"><span aria-hidden="true">+</span> Add Transaction</button> ' +
        '<button type="button" class="btn btn-ghost" data-action="all-time">View All Time</button>';
      $('resultInfo').textContent = monthLabel(state.month);
      return;
    }

    if (list.length === 0) {
      table.hidden = true;
      empty.hidden = false;
      empty.innerHTML =
        '<p class="empty-title">No matching transactions.</p>' +
        '<p class="empty-text">Nothing in ' + escapeHtml(monthLabel(state.month)) + ' matches the current filters.</p>' +
        '<button type="button" class="btn btn-outline" data-action="reset-filters">Reset filters</button>';
      $('resultInfo').textContent = '0 of ' + monthList.length + ' shown';
      return;
    }

    table.hidden = false;
    empty.hidden = true;

    body.innerHTML = list.map(function (t) {
      var sign = t.type === 'credit' ? '+ ' : '- ';
      return '<tr data-id="' + escapeHtml(t.id) + '">' +
        '<td class="tx-date">' + formatDateShort(t.date) +
          '<span class="tx-meta-account"> · ' + escapeHtml(t.account) + '</span></td>' +
        '<td class="tx-desc">' + escapeHtml(t.description) +
          (t.sample ? '<span class="badge badge-sample">Sample</span>' : '') + '</td>' +
        '<td class="tx-account">' + escapeHtml(t.account) + '</td>' +
        '<td class="tx-type"><span class="badge badge-' + t.type + '">' + (t.type === 'credit' ? 'Credit' : 'Debit') + '</span></td>' +
        '<td class="tx-amount num ' + t.type + '">' + sign + formatPKR(t.amount) + '</td>' +
        '<td class="tx-actions">' +
          '<button type="button" class="link-btn" data-action="edit" data-id="' + escapeHtml(t.id) + '" aria-label="Edit ' + escapeHtml(t.description) + '">Edit</button>' +
          '<span class="sep" aria-hidden="true">|</span>' +
          '<button type="button" class="link-btn danger" data-action="delete" data-id="' + escapeHtml(t.id) + '" aria-label="Delete ' + escapeHtml(t.description) + '">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    var count = list.length === monthList.length
      ? list.length + ' transaction' + (list.length === 1 ? '' : 's')
      : list.length + ' of ' + monthList.length + ' shown';
    $('resultInfo').textContent = count;

    // When filters narrow the list, show totals for exactly what is visible.
    if (filtersActive()) {
      var ft = totals(list);
      var footer = document.createElement('div');
      footer.className = 'list-footer';
      footer.innerHTML =
        '<span>Filtered totals</span>' +
        '<span>Credit <strong class="is-credit">' + formatPKR(ft.credit) + '</strong> · ' +
        'Debit <strong class="is-debit">' + formatPKR(ft.debit) + '</strong> · ' +
        'Net <strong class="' + (ft.net > 0 ? 'is-credit' : ft.net < 0 ? 'is-debit' : '') + '">' + formatSigned(ft.net) + '</strong></span>';
      $('listContainer').appendChild(footer);
    }
  }

  function renderAccountSummary() {
    var list = inMonth(transactions, state.month);
    var summary = accountSummary(list);
    $('accountSummaryScope').textContent = monthLabel(state.month) + ' · tap a name to filter';
    var el = $('accountSummary');

    if (summary.length === 0) {
      el.innerHTML = '<p class="account-empty">' +
        (transactions.length === 0 ? 'Accounts appear here once you add transactions.' : 'No account activity in ' + escapeHtml(monthLabel(state.month)) + '.') +
        '</p>';
      return;
    }

    el.innerHTML = summary.map(function (a) {
      var cls = a.net > 0 ? 'plus' : a.net < 0 ? 'minus' : 'zero';
      var active = state.account !== 'all' && state.account.toLowerCase() === a.name.toLowerCase();
      return '<div class="account-item' + (active ? ' is-active' : '') + '">' +
        '<div class="account-top">' +
          '<button type="button" class="account-name" data-action="filter-account" data-account="' + escapeHtml(a.name) + '">' + escapeHtml(a.name) + '</button>' +
          '<span class="account-net ' + cls + '">' + formatSigned(a.net) + '</span>' +
        '</div>' +
        '<div class="account-rows">' +
          '<span>Credit: ' + formatPKR(a.credit) + '</span>' +
          '<span>Debit: ' + formatPKR(a.debit) + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderExportScope() {
    var opt = $('exportScopeMonth');
    var sel = $('exportScope');
    if (state.month === 'all') {
      opt.hidden = true;
      opt.disabled = true;
      sel.value = 'all';
    } else {
      opt.hidden = false;
      opt.disabled = false;
      opt.textContent = 'Only ' + monthLabel(state.month);
    }
  }

  /* =========================================================
     Toast
     ========================================================= */

  var toastTimer = null;
  function showToast(message, isError) {
    var el = $('toast');
    el.textContent = message;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
    // Restart animation.
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, isError ? 5000 : 2600);
  }

  /* =========================================================
     Modals
     ========================================================= */

  var lastFocus = null;
  var openModalEl = null;
  var confirmResolver = null;

  function openModal(el) {
    lastFocus = document.activeElement;
    openModalEl = el;
    el.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal(el) {
    el.hidden = true;
    if (openModalEl === el) openModalEl = null;
    document.body.classList.remove('modal-open');
    if (lastFocus && typeof lastFocus.focus === 'function' && document.body.contains(lastFocus)) {
      lastFocus.focus();
    }
  }

  /**
   * Show a confirm/choice dialog.
   * buttons: [{ label, value, style }] — resolves with the chosen value, or null on cancel/close.
   */
  function ask(title, messageHtml, buttons) {
    return new Promise(function (resolve) {
      $('confirmTitle').textContent = title;
      $('confirmMessage').innerHTML = messageHtml;
      var actions = $('confirmActions');
      actions.innerHTML = '';
      buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ' + (b.style || 'btn-ghost');
        btn.textContent = b.label;
        btn.addEventListener('click', function () { finishAsk(b.value); });
        actions.appendChild(btn);
      });
      confirmResolver = resolve;
      openModal($('confirmModal'));
      // Focus the safe option (first button = cancel) by default.
      var first = actions.querySelector('button');
      if (first) first.focus();
    });
  }

  function finishAsk(value) {
    var r = confirmResolver;
    confirmResolver = null;
    closeModal($('confirmModal'));
    if (r) r(value);
  }

  /* =========================================================
     Transaction form
     ========================================================= */

  var form = $('txForm');

  function openForm(tx) {
    form.reset();
    clearErrors();
    $('txId').value = tx ? tx.id : '';
    $('txModalTitle').textContent = tx ? 'Edit Transaction' : 'Add Transaction';

    var defaultDate = todayISO();
    // When browsing a different month, default new entries into that month.
    if (!tx && state.month !== 'all' && state.month !== currentMonthKey()) {
      defaultDate = state.month + '-01';
    }

    $('txDate').value = tx ? tx.date : defaultDate;
    $('txDescription').value = tx ? tx.description : '';
    $('txAmount').value = tx ? formatNumber(tx.amount) : '';
    $('txAccount').value = tx ? tx.account : (state.account !== 'all' ? state.account : '');
    var typeValue = tx ? tx.type : (state.type !== 'all' ? state.type : '');
    form.querySelectorAll('input[name="txType"]').forEach(function (r) { r.checked = r.value === typeValue; });

    renderAccountChips();
    openModal($('txModal'));
    setTimeout(function () {
      (tx ? $('txDescription') : $('txDescription')).focus();
    }, 30);
  }

  function renderAccountChips() {
    var names = accountNames(transactions);
    var current = $('txAccount').value.trim().toLowerCase();
    $('accountChips').innerHTML = names.slice(0, 12).map(function (n) {
      return '<button type="button" class="chip' + (n.toLowerCase() === current ? ' is-selected' : '') +
        '" data-chip="' + escapeHtml(n) + '">' + escapeHtml(n) + '</button>';
    }).join('');
  }

  function clearErrors() {
    ['type', 'date', 'amount', 'description', 'account'].forEach(function (k) { $('err-' + k).textContent = ''; });
    form.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
  }

  function setError(field, message) {
    $('err-' + field).textContent = message;
    var target = field === 'type' ? document.querySelector('.type-toggle') : $('tx' + field.charAt(0).toUpperCase() + field.slice(1));
    if (target) target.classList.add('invalid');
  }

  function readForm() {
    var typeInput = form.querySelector('input[name="txType"]:checked');
    return {
      id: $('txId').value,
      date: $('txDate').value.trim(),
      description: normalizeSpaces($('txDescription').value),
      amountRaw: $('txAmount').value.trim(),
      account: normalizeSpaces($('txAccount').value),
      type: typeInput ? typeInput.value : ''
    };
  }

  function validateForm(d) {
    clearErrors();
    var ok = true;
    var firstInvalid = null;
    function fail(field, msg, el) {
      setError(field, msg);
      ok = false;
      if (!firstInvalid) firstInvalid = el;
    }

    if (!d.type) fail('type', 'Choose whether this is Credit (money in) or Debit (money out).', form.querySelector('input[name="txType"]'));
    if (!d.date) fail('date', 'Please pick a date.', $('txDate'));
    else if (!isValidISODate(d.date)) fail('date', 'That date doesn’t look right.', $('txDate'));

    if (!d.amountRaw) {
      fail('amount', 'Please enter an amount.', $('txAmount'));
    } else {
      var amt = parseAmount(d.amountRaw);
      if (isNaN(amt)) fail('amount', 'Use numbers only, e.g. 2000 or 2,000.', $('txAmount'));
      else if (!(amt > 0)) fail('amount', 'Amount must be greater than 0.', $('txAmount'));
      else d.amount = roundMoney(amt);
    }

    if (!d.description) fail('description', 'Add a short description so you remember what this was.', $('txDescription'));
    if (!d.account) fail('account', 'Where did this happen? e.g. Cash, SadaPay, Jazz Cash.', $('txAccount'));

    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = readForm();
    if (!validateForm(d)) return;

    // Reuse existing account spelling if it only differs by case (keeps "SadaPay" consistent).
    var existingName = accountNames(transactions).filter(function (n) { return n.toLowerCase() === d.account.toLowerCase(); })[0];
    if (existingName) d.account = existingName;

    var saved;
    if (d.id) {
      saved = updateTransaction(d.id, d);
      if (!saved) { showToast('Could not update this transaction.', true); return; }
      showToast('Transaction updated.');
    } else {
      saved = addTransaction(d);
      if (!saved) { showToast('Could not save this transaction.', true); return; }
      showToast('Transaction saved.');
    }

    // Jump to the month of the saved entry so the user sees it.
    if (state.month !== 'all' && monthKeyOf(saved.date) !== state.month) {
      state.month = monthKeyOf(saved.date);
    }
    closeModal($('txModal'));
    render();
  });

  $('txAccount').addEventListener('input', renderAccountChips);
  $('accountChips').addEventListener('click', function (e) {
    var chip = e.target.closest('[data-chip]');
    if (!chip) return;
    $('txAccount').value = chip.getAttribute('data-chip');
    $('err-account').textContent = '';
    $('txAccount').classList.remove('invalid');
    renderAccountChips();
  });

  // Clear a field's error as soon as the user fixes it.
  form.addEventListener('input', function (e) {
    var t = e.target;
    if (t.name === 'txType') {
      $('err-type').textContent = '';
      document.querySelector('.type-toggle').classList.remove('invalid');
      return;
    }
    if (t.id && t.id.indexOf('tx') === 0) {
      var key = t.id.slice(2).toLowerCase();
      var err = $('err-' + key);
      if (err) err.textContent = '';
      t.classList.remove('invalid');
    }
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'txType') {
      $('err-type').textContent = '';
      document.querySelector('.type-toggle').classList.remove('invalid');
    }
  });

  /* =========================================================
     Delete / clear
     ========================================================= */

  function confirmDelete(id) {
    var t = getTransaction(id);
    if (!t) return;
    ask('Delete transaction?',
      '<p><strong>Are you sure you want to delete this transaction?</strong></p>' +
      '<p class="confirm-detail">' + formatDateLong(t.date) + '<br>' + escapeHtml(t.description) + '<br>' +
        (t.type === 'credit' ? '+ ' : '- ') + formatPKR(t.amount) + ' · ' + escapeHtml(t.account) + ' · ' + (t.type === 'credit' ? 'Credit' : 'Debit') + '</p>' +
      '<p>This action cannot be undone unless you have a backup.</p>',
      [
        { label: 'Cancel', value: false, style: 'btn-ghost' },
        { label: 'Delete', value: true, style: 'btn-danger' }
      ]
    ).then(function (yes) {
      if (!yes) return;
      if (deleteTransaction(id)) {
        showToast('Transaction deleted.');
        render();
      }
    });
  }

  $('clearAllBtn').addEventListener('click', function () {
    if (transactions.length === 0) {
      showToast('There is nothing to clear.');
      return;
    }
    ask('Clear all data?',
      '<p><strong>This will permanently remove all transactions from this browser.</strong></p>' +
      '<p>Make sure you have downloaded a Markdown backup first.</p>' +
      '<p>' + transactions.length + ' transaction' + (transactions.length === 1 ? '' : 's') + ' will be removed. Continue?</p>',
      [
        { label: 'Cancel', value: null, style: 'btn-ghost' },
        { label: 'Download backup first', value: 'backup', style: 'btn-outline' },
        { label: 'Clear All Data', value: 'clear', style: 'btn-danger' }
      ]
    ).then(function (choice) {
      if (choice === 'backup') {
        downloadMarkdown(buildMarkdown('all'), FILE_BASE + '.md');
        showToast('Backup downloaded. Click Clear All Data again when ready.');
        return;
      }
      if (choice !== 'clear') return;
      replaceAllTransactions([]);
      state.account = 'all';
      state.type = 'all';
      state.search = '';
      $('searchInput').value = '';
      $('typeFilter').value = 'all';
      showToast('All data cleared.');
      render();
    });
  });

  $('clearSampleBtn').addEventListener('click', function () {
    var n = transactions.filter(function (t) { return t.sample; }).length;
    if (!n) return;
    ask('Clear sample data?',
      '<p>This removes the ' + n + ' demo transaction' + (n === 1 ? '' : 's') + ' marked “Sample”.</p>' +
      '<p>Your own transactions (and any sample entries you edited) stay as they are.</p>',
      [
        { label: 'Cancel', value: false, style: 'btn-ghost' },
        { label: 'Clear sample data', value: true, style: 'btn-primary' }
      ]
    ).then(function (yes) {
      if (!yes) return;
      replaceAllTransactions(transactions.filter(function (t) { return !t.sample; }));
      state.month = initialMonth();
      showToast('Sample data cleared.');
      render();
    });
  });

  /* =========================================================
     Markdown export
     ========================================================= */

  // Keep table cells on one line and escape the pipe character.
  function mdCell(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
  }

  function mdNumber(n) {
    // Plain number, no thousands separator, so it is unambiguous to read back.
    return String(roundMoney(n));
  }

  function mdSummaryLines(t) {
    return [
      '- Total Credit: ' + formatPKR(t.credit),
      '- Total Debit: ' + formatPKR(t.debit),
      '- Net: ' + formatSigned(t.net, true),
      '- Transactions: ' + t.count
    ];
  }

  function buildMarkdown(scope) {
    var month = scope === 'month' && state.month !== 'all' ? state.month : 'all';
    var list = sortTransactions(inMonth(transactions, month), 'asc');
    var now = new Date();
    var generated = formatDateLong(todayISO()) + ', ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    var lines = [];

    lines.push('# ' + APP_TITLE);
    lines.push('');
    lines.push('- Period: ' + monthLabel(month));
    lines.push('- Generated: ' + generated);
    lines.push('- Currency: PKR');
    lines.push('- Credit = money in, Debit = money out, Net = Credit - Debit');
    lines.push('');

    if (list.length === 0) {
      lines.push('_No transactions recorded' + (month === 'all' ? '' : ' for ' + monthLabel(month)) + '._');
      lines.push('');
      return lines.join('\n');
    }

    if (month === 'all') {
      lines.push('## Overall Summary');
      lines.push('');
      lines.push.apply(lines, mdSummaryLines(totals(list)));
      lines.push('');
    }

    // Account breakdown for the exported period.
    lines.push(month === 'all' ? '## Accounts' : '## Accounts — ' + monthLabel(month));
    lines.push('');
    lines.push('| Account | Credit | Debit | Net |');
    lines.push('|---|---:|---:|---:|');
    accountSummary(list).forEach(function (a) {
      lines.push('| ' + mdCell(a.name) + ' | ' + formatPKR(a.credit) + ' | ' + formatPKR(a.debit) + ' | ' + formatSigned(a.net, true) + ' |');
    });
    lines.push('');

    // One section per month, oldest first, so it reads like a statement.
    var groups = {};
    var order = [];
    list.forEach(function (t) {
      var k = monthKeyOf(t.date);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(t);
    });

    order.forEach(function (k) {
      var items = groups[k];
      lines.push('## ' + monthLabel(k));
      lines.push('');
      lines.push('### Summary');
      lines.push('');
      lines.push.apply(lines, mdSummaryLines(totals(items)));
      lines.push('');
      lines.push('### Transactions');
      lines.push('');
      lines.push('| Date | Description | Amount | Account | Type | ID |');
      lines.push('|---|---|---:|---|---|---|');
      items.forEach(function (t) {
        lines.push('| ' + t.date + ' | ' + mdCell(t.description) + ' | ' + mdNumber(t.amount) + ' | ' +
          mdCell(t.account) + ' | ' + (t.type === 'credit' ? 'Credit' : 'Debit') + ' | ' + mdCell(t.id) + ' |');
      });
      lines.push('');
    });

    lines.push('---');
    lines.push('');
    lines.push('_Amounts are in PKR. This file can be imported back into the Usama Hassan Account Statement app._');
    lines.push('');
    return lines.join('\n');
  }

  function exportFileName(scope) {
    if (scope === 'month' && state.month !== 'all') {
      return FILE_BASE + '-' + monthLabel(state.month).replace(' ', '-') + '.md';
    }
    return FILE_BASE + '.md';
  }

  function downloadMarkdown(content, filename) {
    var blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  $('downloadMdBtn').addEventListener('click', function () {
    var scope = $('exportScope').value;
    downloadMarkdown(buildMarkdown(scope), exportFileName(scope));
    showToast('Markdown downloaded: ' + exportFileName(scope));
  });

  $('copyMdBtn').addEventListener('click', function () {
    var md = buildMarkdown($('exportScope').value);
    copyText(md).then(function () {
      showToast('Markdown copied to clipboard.');
    }, function () {
      showToast('Could not copy automatically. Use Download Markdown instead.', true);
    });
  });

  /* =========================================================
     Markdown import
     ========================================================= */

  // Split a Markdown table row on pipes that are not escaped.
  function splitRow(line) {
    var s = line.trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|' && s.charAt(s.length - 2) !== '\\') s = s.slice(0, -1);
    var cells = [];
    var cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '\\' && i + 1 < s.length) {
        var next = s.charAt(i + 1);
        if (next === '|' || next === '\\') { cur += next; i++; continue; }
        cur += ch;
        continue;
      }
      if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }

  function isSeparatorRow(cells) {
    return cells.length > 0 && cells.every(function (c) { return /^:?-{2,}:?$/.test(c.replace(/\s/g, '')) || c === ''; }) &&
      cells.some(function (c) { return /-/.test(c); });
  }

  // Accepts 2026-09-14, 14/09/2026, "14 September 2026", "14 Sep 2026".
  function parseImportDate(s) {
    s = s.trim();
    if (isValidISODate(s)) return s;
    var m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (m) {
      var iso = m[3] + '-' + pad2(Number(m[2])) + '-' + pad2(Number(m[1]));
      return isValidISODate(iso) ? iso : null;
    }
    m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (m) {
      var name = m[2].toLowerCase();
      for (var i = 0; i < 12; i++) {
        var full = MONTH_NAMES[i].toLowerCase();
        if (name.length >= 3 && full.indexOf(name) === 0) {
          var iso2 = m[3] + '-' + pad2(i + 1) + '-' + pad2(Number(m[1]));
          return isValidISODate(iso2) ? iso2 : null;
        }
      }
    }
    return null;
  }

  function parseMarkdown(text) {
    var lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    var columns = null; // map of field -> index for the active transaction table
    var found = [];
    var invalid = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.charAt(0) !== '|') {
        columns = null; // table ended
        continue;
      }
      var cells = splitRow(line);
      if (isSeparatorRow(cells)) continue;

      // Header row? Detect a transaction table by its headers.
      var lower = cells.map(function (c) { return c.toLowerCase().replace(/[*_]/g, '').trim(); });
      if (lower.indexOf('date') !== -1 && lower.indexOf('description') !== -1) {
        columns = {
          date: lower.indexOf('date'),
          description: lower.indexOf('description'),
          amount: findHeader(lower, ['amount', 'amount (pkr)', 'amount pkr']),
          account: findHeader(lower, ['account', 'account / source', 'account/source', 'source']),
          type: lower.indexOf('type'),
          id: lower.indexOf('id')
        };
        if (columns.amount === -1 || columns.account === -1 || columns.type === -1) columns = null;
        continue;
      }
      if (!columns) continue;

      var raw = {
        date: parseImportDate(cells[columns.date] || ''),
        description: cells[columns.description] || '',
        amount: parseAmount(cells[columns.amount] || ''),
        account: cells[columns.account] || '',
        type: (cells[columns.type] || '').toLowerCase().trim(),
        id: columns.id !== -1 ? (cells[columns.id] || '') : ''
      };
      if (raw.type === 'cr') raw.type = 'credit';
      if (raw.type === 'dr') raw.type = 'debit';

      var t = cleanTransaction({
        id: raw.id || null,
        date: raw.date || '',
        description: raw.description,
        amount: raw.amount,
        account: raw.account,
        type: raw.type,
        createdAt: new Date(Date.now() + found.length).toISOString()
      });
      if (t) {
        if (!raw.id) t._noId = true;
        found.push(t);
      } else {
        invalid++;
      }
    }

    // Remove duplicates inside the file itself.
    var unique = [];
    var seenIds = {};
    var seenSig = {};
    var internalDupes = 0;
    found.forEach(function (t) {
      var sig = signature(t);
      var dupe = t._noId ? seenSig[sig] : seenIds[t.id];
      if (dupe) { internalDupes++; return; }
      if (!t._noId) seenIds[t.id] = true;
      seenSig[sig] = true;
      unique.push(t);
    });

    return { transactions: unique, invalid: invalid, internalDupes: internalDupes };
  }

  function findHeader(lower, names) {
    for (var i = 0; i < names.length; i++) {
      var idx = lower.indexOf(names[i]);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function signature(t) {
    return [t.date, t.description.toLowerCase(), roundMoney(t.amount), t.account.toLowerCase(), t.type].join('|');
  }

  function stripMeta(t) {
    var c = {};
    Object.keys(t).forEach(function (k) { if (k !== '_noId') c[k] = t[k]; });
    return c;
  }

  // IDs decide when the imported row has one; otherwise fall back to date+description+amount+account+type.
  function isDuplicateOf(t, ids, sigs) {
    return t._noId ? !!sigs[signature(t)] : !!ids[t.id];
  }

  function mergeTransactions(imported) {
    var ids = {};
    var sigs = {};
    transactions.forEach(function (t) { ids[t.id] = true; sigs[signature(t)] = true; });
    var added = 0, skipped = 0;
    var next = transactions.slice();
    imported.forEach(function (t) {
      if (isDuplicateOf(t, ids, sigs)) { skipped++; return; }
      var clean = stripMeta(t);
      next.push(clean);
      ids[clean.id] = true;
      sigs[signature(clean)] = true;
      added++;
    });
    replaceAllTransactions(next);
    return { added: added, skipped: skipped };
  }

  $('importMdBtn').addEventListener('click', function () {
    $('importFile').value = '';
    $('importFile').click();
  });

  $('importFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onerror = function () { showToast('Could not read that file.', true); };
    reader.onload = function () { handleImportText(String(reader.result || ''), file.name); };
    reader.readAsText(file);
  });

  function handleImportText(text, fileName) {
    var result = parseMarkdown(text);
    var list = result.transactions;
    var name = escapeHtml(fileName);

    if (list.length === 0) {
      ask('No transactions found',
        '<p>No valid transactions were found in <strong>' + name + '</strong>.</p>' +
        (result.invalid ? '<p>' + result.invalid + ' row' + (result.invalid === 1 ? ' was' : 's were') + ' skipped because of missing or invalid values.</p>' : '') +
        '<p>Import expects a Markdown table with the columns Date, Description, Amount, Account and Type (as produced by Download Markdown).</p>',
        [{ label: 'OK', value: true, style: 'btn-primary' }]
      );
      return;
    }

    var t = totals(list);
    var dates = list.map(function (x) { return x.date; }).sort();
    var range = dates[0] === dates[dates.length - 1]
      ? formatDateShort(dates[0])
      : formatDateShort(dates[0]) + ' – ' + formatDateShort(dates[dates.length - 1]);

    // Preview how many a merge would really add.
    var ids = {}, sigs = {};
    transactions.forEach(function (x) { ids[x.id] = true; sigs[signature(x)] = true; });
    var wouldSkip = list.filter(function (x) { return isDuplicateOf(x, ids, sigs); }).length;

    var notes = '';
    if (result.invalid) notes += '<p>' + result.invalid + ' row' + (result.invalid === 1 ? '' : 's') + ' skipped (invalid or incomplete).</p>';
    if (result.internalDupes) notes += '<p>' + result.internalDupes + ' duplicate row' + (result.internalDupes === 1 ? '' : 's') + ' inside the file ignored.</p>';

    var buttons = [{ label: 'Cancel', value: null, style: 'btn-ghost' }];
    if (transactions.length > 0) {
      buttons.push({ label: 'Replace Existing Data', value: 'replace', style: 'btn-danger-outline' });
      buttons.push({ label: 'Merge With Existing Data', value: 'merge', style: 'btn-primary' });
    } else {
      buttons.push({ label: 'Import', value: 'replace', style: 'btn-primary' });
    }

    ask('Import Markdown',
      '<p><strong>' + list.length + ' transaction' + (list.length === 1 ? '' : 's') + ' found</strong> in ' + name + '.</p>' +
      '<p class="confirm-detail">' + range + '<br>' +
        'Credit ' + formatPKR(t.credit) + ' · Debit ' + formatPKR(t.debit) + ' · Net ' + formatSigned(t.net) + '</p>' +
      notes +
      (transactions.length > 0
        ? '<p><strong>Replace</strong> removes the ' + transactions.length + ' transaction' + (transactions.length === 1 ? '' : 's') +
          ' currently in this browser and uses the file instead.</p>' +
          '<p><strong>Merge</strong> adds ' + (list.length - wouldSkip) + ' new transaction' + (list.length - wouldSkip === 1 ? '' : 's') +
          (wouldSkip ? ' and skips ' + wouldSkip + ' already present' : '') + '.</p>'
        : ''),
      buttons
    ).then(function (choice) {
      if (!choice) return;
      if (choice === 'replace') {
        var doReplace = function () {
          replaceAllTransactions(list.map(stripMeta));
          state.month = initialMonth();
          resetFilters(false);
          showToast('Imported ' + list.length + ' transaction' + (list.length === 1 ? '' : 's') + '. Existing data replaced.');
          render();
        };
        if (transactions.length === 0) { doReplace(); return; }
        ask('Replace existing data?',
          '<p><strong>This will permanently remove the ' + transactions.length + ' transaction' + (transactions.length === 1 ? '' : 's') +
          ' currently in this browser</strong> and replace them with the ' + list.length + ' from the file.</p>' +
          '<p>Make sure you have downloaded a Markdown backup first.</p>',
          [
            { label: 'Cancel', value: false, style: 'btn-ghost' },
            { label: 'Replace', value: true, style: 'btn-danger' }
          ]
        ).then(function (yes) { if (yes) doReplace(); });
      } else if (choice === 'merge') {
        var r = mergeTransactions(list);
        showToast('Merged: ' + r.added + ' added, ' + r.skipped + ' duplicate' + (r.skipped === 1 ? '' : 's') + ' skipped.');
        render();
      }
    });
  }

  /* =========================================================
     Navigation & filters
     ========================================================= */

  function setMonth(m) {
    state.month = m;
    render();
  }

  function resetFilters(doRender) {
    state.account = 'all';
    state.type = 'all';
    state.search = '';
    $('searchInput').value = '';
    $('typeFilter').value = 'all';
    $('accountFilter').value = 'all';
    if (doRender !== false) render();
  }

  $('prevMonthBtn').addEventListener('click', function () { setMonth(shiftMonth(state.month, -1)); });
  $('nextMonthBtn').addEventListener('click', function () { setMonth(shiftMonth(state.month, 1)); });
  $('monthSelect').addEventListener('change', function (e) { setMonth(e.target.value); });

  $('accountFilter').addEventListener('change', function (e) { state.account = e.target.value; render(); });
  $('typeFilter').addEventListener('change', function (e) { state.type = e.target.value; render(); });
  $('sortOrder').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  $('searchInput').addEventListener('input', function (e) { state.search = e.target.value; render(); });
  $('resetFiltersBtn').addEventListener('click', function () { resetFilters(); });

  // Delegated actions (buttons rendered dynamically).
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (el) {
      var action = el.getAttribute('data-action');
      if (action === 'add') openForm(null);
      else if (action === 'edit') { var tx = getTransaction(el.getAttribute('data-id')); if (tx) openForm(tx); }
      else if (action === 'delete') confirmDelete(el.getAttribute('data-id'));
      else if (action === 'all-time') setMonth('all');
      else if (action === 'reset-filters') resetFilters();
      else if (action === 'filter-account') {
        var name = el.getAttribute('data-account');
        state.account = state.account.toLowerCase() === name.toLowerCase() ? 'all' : name;
        render();
      }
      return;
    }
    var closer = e.target.closest('[data-close]');
    if (closer) {
      var modal = closer.closest('.modal');
      if (modal && modal.id === 'confirmModal') finishAsk(null);
      else if (modal) closeModal(modal);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openModalEl) {
      if (openModalEl.id === 'confirmModal') finishAsk(null);
      else closeModal(openModalEl);
    }
    // Keep keyboard focus inside the open dialog.
    if (e.key === 'Tab' && openModalEl) {
      var focusables = openModalEl.querySelectorAll('button, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])');
      var visible = Array.prototype.filter.call(focusables, function (f) { return f.offsetParent !== null || f.type === 'radio'; });
      if (!visible.length) return;
      var first = visible[0], last = visible[visible.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Stay in sync if the statement is changed in another tab.
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) {
      loadTransactions();
      render();
    }
  });

  /* =========================================================
     Start
     ========================================================= */

  if (!storageAvailable) $('storageWarning').hidden = false;
  loadTransactions();
  state.month = initialMonth();
  render();

  // Exposed for debugging from the console; not used by the UI.
  window.UHStatement = {
    loadTransactions: loadTransactions,
    saveTransactions: saveTransactions,
    addTransaction: addTransaction,
    updateTransaction: updateTransaction,
    deleteTransaction: deleteTransaction,
    buildMarkdown: buildMarkdown,
    parseMarkdown: parseMarkdown
  };
})();
