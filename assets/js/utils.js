/* =========================================================
   ServisPro — utilitas bersama
   ========================================================= */
(function () {
  "use strict";

  const ROLE_LABELS = {
    owner: "Owner",
    teknisi: "Teknisi",
    kasir: "Kasir",
    pramugari: "Pramugari",
  };

  const ROLE_META = {
    owner: { label: "Owner", desc: "Akses penuh", icon: "shield", color: "var(--primary)" },
    kasir: { label: "Kasir", desc: "Transaksi & pelanggan", icon: "credit-card", color: "var(--info)" },
    teknisi: { label: "Teknisi", desc: "Pengerjaan servis", icon: "wrench", color: "var(--violet)" },
    pramugari: { label: "Pramugari", desc: "Front desk & penerimaan", icon: "user", color: "var(--accent)" },
  };

  const DEVICE_TYPES = {
    hp: { label: "HP / Smartphone", short: "HP", icon: "smartphone" },
    laptop: { label: "Laptop", short: "Laptop", icon: "laptop" },
    printer: { label: "Printer", short: "Printer", icon: "printer" },
    pc: { label: "PC / Komputer", short: "PC", icon: "monitor" },
  };

  const ORDER_STATUS = {
    masuk: { label: "Barang Masuk", color: "slate", chart: "#94a3b8" },
    diagnosa: { label: "Diagnosa", color: "blue", chart: "#2563eb" },
    menunggu: { label: "Menunggu Konfirmasi", color: "amber", chart: "#f59e0b" },
    proses: { label: "Pengerjaan", color: "violet", chart: "#7c3aed" },
    selesai: { label: "Selesai / Siap Diambil", color: "green", chart: "#16a34a" },
    diambil: { label: "Sudah Diambil", color: "teal", chart: "#0d9488" },
    batal: { label: "Batal", color: "red", chart: "#dc2626" },
  };

  const STATUS_FLOW = ["masuk", "diagnosa", "menunggu", "proses", "selesai", "diambil"];

  const PAYMENT_METHODS = {
    cash: { label: "Tunai", icon: "banknote" },
    transfer: { label: "Transfer Bank", icon: "landmark" },
    qris: { label: "QRIS", icon: "qr-code" },
    debit: { label: "Kartu Debit", icon: "credit-card" },
    ewallet: { label: "E-Wallet", icon: "wallet" },
  };

  const KAS_IN_CATEGORIES = ["Alokasi Laba", "Saldo Awal", "Penyesuaian"];
  const KAS_OUT_CATEGORIES = [
    "Pembelian Operasional",
    "Konsumsi",
    "Transportasi",
    "Perawatan",
    "Utilitas",
    "Lainnya",
  ];

  const MONTHS_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const MONTHS_ID_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const DAYS_ID_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  const idFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function attr(value) {
    return esc(value);
  }

  function money(value) {
    const n = Number(value) || 0;
    const sign = n < 0 ? "-" : "";
    return sign + "Rp " + idFormatter.format(Math.abs(Math.round(n)));
  }

  function num(value) {
    return idFormatter.format(Number(value) || 0);
  }

  function compactMoney(value) {
    const n = Number(value) || 0;
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    const fmt = (v) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v);
    if (abs >= 1000000000) return `${sign}Rp ${fmt(abs / 1000000000)} M`;
    if (abs >= 1000000) return `${sign}Rp ${fmt(abs / 1000000)} jt`;
    if (abs >= 1000) return `${sign}Rp ${fmt(abs / 1000)} rb`;
    return money(n);
  }

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value == null ? "" : value).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function localISODate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function todayISO() {
    return localISODate(new Date());
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const s = String(value);
    const dateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function dateOf(value) {
    if (!value) return "";
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "" : localISODate(d);
  }

  function monthOf(value) {
    return dateOf(value).slice(0, 7);
  }

  function formatDate(value, style) {
    if (!value) return "—";
    const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
      : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    if (style === "long") {
      return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (style === "month") return `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
    if (style === "numeric") return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return `${d.getDate()} ${MONTHS_ID_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return formatDate(value);
    return `${d.getDate()} ${MONTHS_ID_SHORT[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function formatShortDate(value) {
    const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
      : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.getDate()} ${MONTHS_ID_SHORT[d.getMonth()]}`;
  }

  function relativeTime(value) {
    if (!value) return "";
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return "";
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins} mnt lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
    return formatShortDate(value);
  }

  function addDays(value, days) {
    const d = parseDate(value) || new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return localISODate(d);
  }

  function daysDiff(a, b) {
    const d1 = parseDate(a);
    const d2 = parseDate(b);
    if (!d1 || !d2) return 0;
    return Math.round((d2 - d1) / 86400000);
  }

  function monthRange(month) {
    const m = month || currentMonth();
    const [y, mo] = m.split("-").map(Number);
    const last = new Date(y, mo, 0).getDate();
    return { start: `${m}-01`, end: `${m}-${pad(last)}` };
  }

  function monthLabel(month, short) {
    if (!month) return "—";
    const [y, mo] = month.split("-").map(Number);
    const label = short ? MONTHS_ID_SHORT[mo - 1] : MONTHS_ID[mo - 1];
    return short ? `${label} ${String(y).slice(2)}` : `${label} ${y}`;
  }

  function shiftMonth(month, delta) {
    const [y, m] = (month || currentMonth()).split("-").map(Number);
    const d = new Date(y, m - 1 + Number(delta || 0), 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  function lastNMonths(n, endMonth) {
    const result = [];
    const end = endMonth || currentMonth();
    for (let i = Number(n) - 1; i >= 0; i--) {
      const m = shiftMonth(end, -i);
      result.push({ value: m, label: monthLabel(m, true) });
    }
    return result;
  }

  function lastNDays(n) {
    const result = [];
    for (let i = Number(n) - 1; i >= 0; i--) {
      const date = addDays(todayISO(), -i);
      const d = parseDate(date);
      result.push({ date, label: DAYS_ID_SHORT[d.getDay()], full: `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID_SHORT[d.getMonth()]}` });
    }
    return result;
  }

  function inRange(value, start, end) {
    const date = dateOf(value);
    if (!date) return false;
    return (!start || date >= start) && (!end || date <= end);
  }

  function uid(prefix) {
    return `${prefix || "id"}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  function nextTicketNumber(orders) {
    const today = todayISO();
    const compact = today.replace(/-/g, "").slice(2);
    const prefix = `SVC-${compact}-`;
    const existing = (orders || []).filter((o) => String(o.ticketNo || "").startsWith(prefix)).length;
    return prefix + String(existing + 1).padStart(3, "0");
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function firstName(name) {
    return String(name || "").trim().split(/\s+/)[0] || "Pengguna";
  }

  function normalize(value) {
    return String(value == null ? "" : value).toLowerCase().trim();
  }

  function roleLabel(role) {
    return (ROLE_LABELS[role] || role || "—");
  }

  function roleMeta(role) {
    return ROLE_META[role] || ROLE_META.kasir;
  }

  function statusMeta(status) {
    return ORDER_STATUS[status] || ORDER_STATUS.masuk;
  }

  function paymentLabel(method) {
    return PAYMENT_METHODS[method] ? PAYMENT_METHODS[method].label : (method || "—");
  }

  function deviceMeta(type) {
    return DEVICE_TYPES[type] || DEVICE_TYPES.hp;
  }

  function isActiveOrder(order) {
    return order && !["diambil", "batal"].includes(order.status);
  }

  function orderNet(order) {
    const total = Number(order.total) || 0;
    const parts = Number(order.partsCost) || 0;
    return Math.max(total - parts, 0);
  }

  function kasAllocationFor(order, percent) {
    return Math.round(orderNet(order) * (Number(percent) || 0) / 100);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function stripHtml(value) {
    return String(value || "").replace(/<[^>]*>/g, "");
  }

  function plural(count, singular, pluralForm) {
    return Number(count) === 1 ? singular : (pluralForm || singular);
  }

  function csvEscape(value) {
    const s = String(value == null ? "" : value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function downloadCSV(filename, rows) {
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function compareDateDesc(a, b) {
    return new Date(b || 0) - new Date(a || 0);
  }

  function paidBetween(orders, start, end) {
    return (orders || []).filter((order) => order.paymentStatus === "lunas" && inRange(order.paidAt || order.createdAt, start, end));
  }

  function kasBetween(kas, start, end) {
    const list = (kas || []).filter((entry) => inRange(entry.date, start, end));
    const totalIn = list.filter((e) => e.type === "in").reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalOut = list.filter((e) => e.type === "out").reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { entries: list, totalIn, totalOut };
  }

  function kasBalance(kas) {
    return (kas || []).reduce((sum, entry) => {
      const amount = Number(entry.amount) || 0;
      return sum + (entry.type === "in" ? amount : -amount);
    }, 0);
  }

  function salaryPaidBetween(salaries, start, end) {
    return (salaries || []).filter((salary) => salary.status === "dibayar" && inRange(salary.paidAt, start, end));
  }

  function financeFor(data, start, end) {
    const orders = data.orders || [];
    const paid = paidBetween(orders, start, end);
    const revenue = paid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const parts = paid.reduce((sum, o) => sum + (Number(o.partsCost) || 0), 0);
    const gross = revenue - parts;
    const kas = kasBetween(data.kas || [], start, end);
    const salaries = salaryPaidBetween(data.salaries || [], start, end);
    const salaryTotal = salaries.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    return {
      paid,
      paidCount: paid.length,
      revenue,
      parts,
      gross,
      opex: kas.totalOut,
      kasIn: kas.totalIn,
      salaryTotal,
      salaryCount: salaries.length,
      net: gross - kas.totalOut - salaryTotal,
    };
  }

  function financeLedger(data, start, end) {
    const rows = [];
    const paid = paidBetween(data.orders || [], start, end);
    paid.forEach((order) => {
      rows.push({
        date: dateOf(order.paidAt || order.createdAt),
        sortAt: order.paidAt || order.createdAt,
        type: "income",
        label: "Pendapatan",
        description: `${order.ticketNo || "Tiket"} · ${order.customerName || "Pelanggan"}`,
        amount: Number(order.total) || 0,
      });
      if (Number(order.partsCost) > 0) {
        rows.push({
          date: dateOf(order.paidAt || order.createdAt),
          sortAt: order.paidAt || order.createdAt,
          type: "expense",
          label: "HPP",
          description: `Sparepart · ${order.ticketNo || "Tiket"} · ${order.brand || ""} ${order.model || ""}`.trim(),
          amount: -(Number(order.partsCost) || 0),
        });
      }
    });
    (data.kas || []).filter((entry) => entry.type === "out" && inRange(entry.date, start, end)).forEach((entry) => {
      rows.push({
        date: entry.date,
        sortAt: entry.date,
        type: "expense",
        label: "Operasional",
        description: `${entry.category || "Operasional"} · ${entry.description || "Pengeluaran"}`,
        amount: -(Number(entry.amount) || 0),
      });
    });
    salaryPaidBetween(data.salaries || [], start, end).forEach((salary) => {
      rows.push({
        date: dateOf(salary.paidAt),
        sortAt: salary.paidAt,
        type: "salary",
        label: "Gaji",
        description: `Gaji ${salary.userName || "Karyawan"} · ${monthLabel(salary.period)}`,
        amount: -(Number(salary.total) || 0),
      });
    });
    return rows.sort((a, b) => new Date(b.sortAt || b.date) - new Date(a.sortAt || a.date));
  }

  function activeOrders(orders) {
    return (orders || []).filter(isActiveOrder);
  }

  function statusCounts(orders) {
    const counts = {};
    Object.keys(ORDER_STATUS).forEach((key) => { counts[key] = 0; });
    (orders || []).forEach((order) => {
      if (counts[order.status] != null) counts[order.status] += 1;
    });
    return counts;
  }

  function userById(users, id) {
    return (users || []).find((u) => u.id === id) || null;
  }

  function customerById(customers, id) {
    return (customers || []).find((c) => c.id === id) || null;
  }

  function initialsAvatar(name, className) {
    return `<span class="avatar ${className || ""}">${esc(initials(name))}</span>`;
  }

  function percentage(part, total) {
    if (!total) return 0;
    return clamp(Math.round((part / total) * 100), 0, 100);
  }

  function queryString(params) {
    return Object.keys(params).filter((k) => params[k] !== "" && params[k] != null).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
  }

  function isValidPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length >= 8;
  }

  window.U = {
    ROLE_LABELS,
    ROLE_META,
    DEVICE_TYPES,
    ORDER_STATUS,
    STATUS_FLOW,
    PAYMENT_METHODS,
    KAS_IN_CATEGORIES,
    KAS_OUT_CATEGORIES,
    MONTHS_ID,
    MONTHS_ID_SHORT,
    DAYS_ID,
    DAYS_ID_SHORT,
    esc,
    attr,
    money,
    num,
    compactMoney,
    parseNumber,
    pad,
    localISODate,
    todayISO,
    nowISO,
    currentMonth,
    parseDate,
    dateOf,
    monthOf,
    formatDate,
    formatDateTime,
    formatTime,
    formatShortDate,
    relativeTime,
    addDays,
    daysDiff,
    monthRange,
    monthLabel,
    shiftMonth,
    lastNMonths,
    lastNDays,
    inRange,
    uid,
    nextTicketNumber,
    initials,
    firstName,
    normalize,
    roleLabel,
    roleMeta,
    statusMeta,
    paymentLabel,
    deviceMeta,
    isActiveOrder,
    orderNet,
    kasAllocationFor,
    clamp,
    debounce,
    clone,
    stripHtml,
    plural,
    downloadCSV,
    compareDateDesc,
    paidBetween,
    kasBetween,
    kasBalance,
    salaryPaidBetween,
    financeFor,
    financeLedger,
    activeOrders,
    statusCounts,
    userById,
    customerById,
    initialsAvatar,
    percentage,
    queryString,
    isValidEmail,
    isValidPhone,
  };
})();
