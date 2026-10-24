import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

/* ---------- Apps Script service mocks ---------- */

class FakeRange {
  constructor(sheet, row, column, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const source = this.sheet.data[this.row - 1 + r] || [];
      const line = [];
      for (let c = 0; c < this.numCols; c += 1) {
        const value = source[this.column - 1 + c];
        line.push(value === undefined ? "" : value);
      }
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.numRows || values.some((row) => row.length !== this.numCols)) {
      throw new Error(`Range ${this.numRows}x${this.numCols} tidak cocok dengan ${values.length}x${values[0] ? values[0].length : 0}`);
    }
    for (let r = 0; r < this.numRows; r += 1) {
      const targetRow = this.row - 1 + r;
      while (this.sheet.data.length <= targetRow) this.sheet.data.push([]);
      for (let c = 0; c < this.numCols; c += 1) {
        this.sheet.data[targetRow][this.column - 1 + c] = values[r][c];
      }
    }
    return this;
  }
  setValue(value) {
    if (this.numRows !== 1 || this.numCols !== 1) throw new Error("setValue requires 1x1 range");
    return this.setValues([[value]]);
  }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setFontColor() { return this; }
  setBackground() { return this; }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
    this.hiddenColumns = new Set();
    this.frozenRows = 0;
  }
  getName() { return this.name; }
  getLastRow() {
    let last = 0;
    this.data.forEach((row, index) => {
      if (row && row.some((v) => v !== "" && v !== null && v !== undefined)) last = index + 1;
    });
    return last;
  }
  getLastColumn() {
    let last = 0;
    this.data.forEach((row) => {
      if (!row) return;
      let index = row.length;
      while (index > 0 && (row[index - 1] === "" || row[index - 1] === null || row[index - 1] === undefined)) index -= 1;
      last = Math.max(last, index);
    });
    return last;
  }
  getMaxRows() { return Math.max(1000, this.data.length); }
  getRange(row, column, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, column, numRows, numCols);
  }
  getDataRange() {
    const rows = Math.max(this.getLastRow(), 1);
    const cols = Math.max(this.getLastColumn(), 1);
    return new FakeRange(this, 1, 1, rows, cols);
  }
  setFrozenRows(count) { this.frozenRows = count; }
  hideColumns(index) { this.hiddenColumns.add(index); }
  isColumnHiddenByUser(index) { return this.hiddenColumns.has(index); }
  deleteRow(row) { this.data.splice(row - 1, 1); }
}

class FakeSpreadsheet {
  constructor(name, id) {
    this.name = name;
    this.id = id || "ss-" + crypto.randomUUID();
    this.sheets = [new FakeSheet("Sheet1")];
    this.timeZone = "Asia/Jakarta";
  }
  getId() { return this.id; }
  getUrl() { return "https://docs.google.com/spreadsheets/d/" + this.id; }
  getName() { return this.name; }
  getSheetByName(name) { return this.sheets.find((sheet) => sheet.name === name) || null; }
  insertSheet(name) {
    if (this.getSheetByName(name)) throw new Error("Sheet already exists: " + name);
    const sheet = new FakeSheet(name);
    this.sheets.push(sheet);
    return sheet;
  }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(sheet) { this.sheets = this.sheets.filter((item) => item !== sheet); }
  setSpreadsheetTimeZone(zone) { this.timeZone = zone; }
}

class FakeProperties {
  constructor() { this.map = new Map(); }
  getProperty(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setProperty(key, value) { this.map.set(key, String(value)); }
  getKeys() { return Array.from(this.map.keys()); }
  deleteProperty(key) { this.map.delete(key); }
}

const scriptProperties = new FakeProperties();
const logLines = [];
let activeSpreadsheet = null;
let createdSpreadsheet = null;

const SpreadsheetApp = {
  getActiveSpreadsheet() { return activeSpreadsheet; },
  create(name) {
    createdSpreadsheet = new FakeSpreadsheet(name);
    activeSpreadsheet = createdSpreadsheet;
    return createdSpreadsheet;
  },
  openById(id) {
    if (createdSpreadsheet && createdSpreadsheet.getId() === id) return createdSpreadsheet;
    throw new Error("Spreadsheet not found: " + id);
  },
};

const PropertiesService = {
  getScriptProperties() { return scriptProperties; },
};

const Utilities = {
  DigestAlgorithm: { SHA_256: "SHA_256" },
  Charset: { UTF_8: "UTF_8" },
  computeDigest(algorithm, data) {
    if (algorithm !== "SHA_256") throw new Error("Unsupported algorithm");
    let buffer;
    if (Array.isArray(data)) buffer = Buffer.from(data.map((byte) => byte & 255));
    else buffer = Buffer.from(String(data), "utf8");
    const digest = crypto.createHash("sha256").update(buffer).digest();
    return Array.from(digest).map((byte) => (byte > 127 ? byte - 256 : byte));
  },
  formatDate(date, timeZone, format) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type).value;
    const day = get("day");
    const month = get("month");
    const year = get("year");
    if (format === "yyyy-MM-dd") return `${year}-${month}-${day}`;
    if (format === "yyMMdd") return `${year.slice(-2)}${month}${day}`;
    throw new Error("Unsupported date format: " + format);
  },
  getUuid() { return crypto.randomUUID(); },
  sleep() {},
};

const Session = { getScriptTimeZone() { return "Asia/Jakarta"; } };

const ContentService = {
  MimeType: { JSON: "JSON" },
  createTextOutput(text) {
    const output = {
      text,
      mimeType: "TEXT",
      setMimeType(value) { this.mimeType = value; return this; },
      getContent() { return this.text; },
    };
    return output;
  },
};

const LockService = {
  getScriptLock() {
    return { tryLock() { return true; }, releaseLock() {} };
  },
};

const Logger = { log(...args) { logLines.push(args.join(" ")); } };
const quietConsole = {
  log() {},
  error(...args) { logLines.push("ERR " + args.join(" ")); },
  warn() {},
};

const context = vm.createContext({
  console: quietConsole,
  SpreadsheetApp,
  PropertiesService,
  Utilities,
  Session,
  ContentService,
  LockService,
  Logger,
  Buffer,
});
const code = fs.readFileSync("C:/Users/Asus/Documents/Qoder/2026-10-23/b809d9eb/apps-script/Code.gs", "utf8");
new vm.Script(code, { filename: "Code.gs" }).runInContext(context);

/* ---------- Helpers ---------- */

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function post(payload) {
  const output = context.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(output.getContent());
}
function ok(payload) {
  const response = post(payload);
  if (!response.ok) throw new Error((response.code || "ERROR") + ": " + response.error);
  return response.data;
}
function fail(payload, expectedCode) {
  const response = post(payload);
  assert(!response.ok, "Permintaan seharusnya gagal tetapi berhasil: " + JSON.stringify(payload).slice(0, 120));
  if (expectedCode) assert(response.code === expectedCode, `Kode error ${response.code}, diharapkan ${expectedCode}: ${response.error}`);
  return response;
}
function rawTable(name) {
  const sheet = activeSpreadsheet.getSheetByName(name);
  return sheet.getDataRange().getValues();
}

/* ---------- Tests ---------- */

check("setup membuat spreadsheet, sheet, akun, dan pengaturan", () => {
  assert(typeof context.setup === "function", "setup() tidak tersedia di global context");
  const message = context.setup();
  assert(/Setup ServisPro selesai/.test(message), "Pesan setup tidak sesuai: " + message);
  assert(createdSpreadsheet, "Spreadsheet tidak dibuat");
  ["users", "suppliers", "customers", "orders", "kas", "salaries", "settings"].forEach((table) => {
    assert(activeSpreadsheet.getSheetByName(table), "Sheet " + table + " tidak dibuat");
  });
  assert(!activeSpreadsheet.getSheetByName("Sheet1"), "Sheet1 default tidak dihapus");
  assert(rawTable("users").length === 5, "Jumlah pengguna awal tidak sesuai: " + rawTable("users").length);
  const settingsRows = rawTable("settings");
  const settingsObj = {};
  settingsRows.slice(1).forEach((row) => {
    if (row[0]) {
      try { settingsObj[row[0]] = JSON.parse(row[1]); } catch { settingsObj[row[0]] = row[1]; }
    }
  });
  assert(settingsObj.kasPercent === 10, "kasPercent default bukan 10");
  assert(settingsObj.companyName, "companyName default kosong");
});

check("ping memverifikasi seluruh sheet", () => {
  const data = ok({ action: "ping" });
  assert(data.mode === "remote", "mode ping bukan remote");
  assert(data.spreadsheet, "nama spreadsheet kosong");
});

check("doGet mengembalikan identitas API", () => {
  const response = JSON.parse(context.doGet().getContent());
  assert(response.ok === true && /ServisPro API/.test(response.data.service), "doGet tidak valid");
});

check("login menolak password salah", () => {
  fail({ action: "login", username: "owner", password: "salah" }, "AUTH");
});

const tokens = {};
check("login keempat role berhasil", () => {
  const accounts = [
    ["owner", "owner123"],
    ["kasir", "kasir123"],
    ["teknisi", "teknisi123"],
    ["pramugari", "pramugari123"],
  ];
  accounts.forEach(([username, password]) => {
    const data = ok({ action: "login", username, password });
    assert(data.token && data.token.length === 64, "token " + username + " tidak valid");
    assert(data.user.role === username.replace("pramugari", "pramugari"), "role " + username + " salah");
    tokens[username] = data.token;
  });
});

check("bootstrap owner tidak membocorkan hash password", () => {
  const data = ok({ action: "bootstrap", token: tokens.owner });
  assert(data.users.length === 4, "jumlah user bukan 4");
  assert(data.settings.kasPercent === 10, "settings tidak terkirim");
  assert(data.orders.length === 0 && data.kas.length === 0, "data awal tidak kosong");
  assert(!JSON.stringify(data).includes("passwordHash"), "passwordHash bocor");
  assert(data.users.every((user) => user.username), "owner tidak menerima username staf");
});

check("bootstrap non-owner menyembunyikan kas dan username staf", () => {
  const data = ok({ action: "bootstrap", token: tokens.kasir });
  assert(data.kas.length === 0 && data.salaries.length === 0, "kas/gaji bocor ke kasir");
  const other = data.users.find((user) => user.id !== data.me.id);
  assert(other && !other.username, "username staf lain bocor");
});

function bootstrap(token) {
  return ok({ action: "bootstrap", token });
}

let customer;
let supplier;
let order;
let order2;
let order3;

check("kasir membuat pelanggan dan telepon +62 tersimpan utuh", () => {
  const data = ok({
    action: "upsert", token: tokens.kasir, table: "customers",
    record: { name: "Budi Santoso", phone: "+6281234567890", email: "budi@example.com", address: "Jakarta" },
  });
  customer = data.record;
  assert(customer.id.startsWith("cus"), "ID pelanggan tidak berprefiks cus");
  const table = rawTable("customers");
  const headers = table[0];
  const raw = table.find((row) => row[0] === customer.id);
  assert(String(raw[headers.indexOf("phone")]).startsWith("'"), "formula guard telepon tidak menulis apostrof");
  const apiCustomer = bootstrap(tokens.owner).customers.find((row) => row.id === customer.id);
  assert(apiCustomer.phone === "+6281234567890", "telepon tidak kembali utuh: " + apiCustomer.phone);
});

check("owner membuat supplier", () => {
  supplier = ok({
    action: "upsert", token: tokens.owner, table: "suppliers",
    record: { name: "Sparepart Jaya", contact: "Pak Joko", phone: "021-555123", address: "Mangga Dua" },
  }).record;
  assert(supplier.id.startsWith("sup"), "ID supplier tidak valid");
});

check("kasir membuat tiket dan total dihitung server", () => {
  order = ok({
    action: "upsert", token: tokens.kasir, table: "orders",
    record: {
      customerId: customer.id, deviceType: "hp", brand: "Apple", model: "iPhone 12",
      serial: "00123", complaint: "LCD pecah", technicianId: "u-teknisi",
      estimateCost: 800000, partsCost: 200000, serviceCost: 500000, status: "masuk", note: "Antrean pagi",
    },
  }).record;
  assert(/^SVC-\d{6}-001$/.test(order.ticketNo), "Nomor tiket tidak sesuai: " + order.ticketNo);
  assert(order.total === 700000, "Total tiket salah: " + order.total);
  assert(order.paymentStatus === "belum", "Tiket baru tidak boleh langsung lunas");
  assert(order.serial === "00123", "Serial berubah");
  assert(order.technicianName === "Teknisi ServisPro", "Nama teknisi tidak disalin");
  assert(order.history.length === 1, "Riwayat awal tidak dibuat");
});

check("supplier terhubung ke tiket dan tidak dapat dihapus", () => {
  const updated = ok({ action: "upsert", token: tokens.kasir, table: "orders", record: { id: order.id, supplierId: supplier.id } }).record;
  assert(updated.supplierName === "Sparepart Jaya", "Nama supplier tidak disalin");
  order = updated;
  fail({ action: "remove", token: tokens.owner, table: "suppliers", id: supplier.id }, "VALIDATION");
});

check("pembayaran kasir membuat alokasi kas 10%", () => {
  const data = ok({
    action: "upsert", token: tokens.kasir, table: "orders",
    record: { id: order.id, paymentStatus: "lunas", paymentMethod: "cash", paidAt: new Date().toISOString() },
  });
  order = data.record;
  assert(data.autoKas, "autoKas tidak dikembalikan");
  assert(data.autoKas.amount === 50000, "Alokasi salah: " + data.autoKas.amount);
  assert(data.autoKas.orderId === order.id, "orderId autoKas salah");
  assert(order.kasAllocated === true && order.kasAllocatedAmount === 50000, "tanda alokasi tiket salah");
  const kas = bootstrap(tokens.owner).kas;
  assert(kas.length === 1 && kas[0].source === "otomatis", "Kas otomatis tidak tercatat");
  assert(bootstrap(tokens.kasir).kas.length === 0, "Kas terlihat oleh kasir");
});

check("pembayaran ulang tidak menduplikasi alokasi", () => {
  const data = ok({ action: "upsert", token: tokens.kasir, table: "orders", record: { id: order.id, paymentStatus: "lunas" } });
  assert(!data.autoKas, "autoKas duplikat dibuat");
  assert(bootstrap(tokens.owner).kas.length === 1, "Jumlah kas bertambah");
});

check("tiket lunas dengan alokasi tidak bisa dikembalikan ke belum bayar", () => {
  fail({ action: "upsert", token: tokens.kasir, table: "orders", record: { id: order.id, paymentStatus: "belum" } }, "VALIDATION");
});

check("teknisi hanya dapat memperbarui tiket yang ditugaskan", () => {
  fail({ action: "upsert", token: tokens.teknisi, table: "orders", record: { id: order.id, serviceCost: 1 } }, "FORBIDDEN");
  fail({
    action: "upsert", token: tokens.teknisi, table: "orders",
    record: { customerId: customer.id, deviceType: "hp", brand: "X", model: "Y", complaint: "Z" },
  }, "FORBIDDEN");
  const history = order.history.concat([{
    status: "proses", at: new Date().toISOString(), by: "Teknisi ServisPro", note: "Pengerjaan dimulai",
  }]);
  const updated = ok({
    action: "upsert", token: tokens.teknisi, table: "orders",
    record: { id: order.id, status: "proses", diagnosis: "Ganti LCD original", history },
  }).record;
  assert(updated.status === "proses" && updated.diagnosis === "Ganti LCD original", "Update teknisi gagal");
  assert(updated.paymentStatus === "lunas" && updated.serviceCost === 500000, "Teknisi mengubah data terlarang");
  order = updated;
  fail({ action: "upsert", token: tokens.teknisi, table: "kas", record: { type: "in", category: "X", description: "Y", amount: 1000 } }, "FORBIDDEN");
});

check("pramugari tidak dapat memproses pembayaran tetapi dapat ubah status", () => {
  order2 = ok({
    action: "upsert", token: tokens.kasir, table: "orders",
    record: {
      customerId: customer.id, deviceType: "printer", brand: "Epson", model: "L3110",
      complaint: "Head buntu", partsCost: 100000, serviceCost: 300000, status: "masuk",
    },
  }).record;
  fail({
    action: "upsert", token: tokens.pramugari, table: "orders",
    record: { id: order2.id, paymentStatus: "lunas", paymentMethod: "cash" },
  }, "FORBIDDEN");
  const updated = ok({
    action: "upsert", token: tokens.pramugari, table: "orders",
    record: { id: order2.id, status: "diagnosa" },
  }).record;
  assert(updated.status === "diagnosa", "Pramugari gagal mengubah status");
  order2 = updated;
  fail({ action: "upsert", token: tokens.teknisi, table: "orders", record: { id: order2.id, status: "proses" } }, "FORBIDDEN");
});

check("kasir melunasi tiket kedua dan alokasi 30.000", () => {
  const data = ok({
    action: "upsert", token: tokens.kasir, table: "orders",
    record: { id: order2.id, paymentStatus: "lunas", paymentMethod: "qris" },
  });
  assert(data.autoKas && data.autoKas.amount === 30000, "Alokasi tiket kedua salah: " + (data.autoKas && data.autoKas.amount));
  order2 = data.record;
});

check("kas keluar memakai rincian dan menjaga saldo tidak negatif", () => {
  const out = ok({
    action: "upsert", token: tokens.owner, table: "kas",
    record: {
      type: "out", category: "Operasional", description: "Beli kabel printer", amount: 999,
      items: [{ name: "Kabel printer", qty: 2, unitPrice: 15000 }],
    },
  }).record;
  assert(out.amount === 30000, "Nominal rincian tidak dihitung: " + out.amount);
  fail({
    action: "upsert", token: tokens.owner, table: "kas",
    record: { type: "out", category: "Operasional", description: "Meja kerja", amount: 60000 },
  }, "VALIDATION");
});

check("alokasi otomatis tidak dapat diedit atau dihapus", () => {
  const auto = bootstrap(tokens.owner).kas.find((entry) => entry.source === "otomatis");
  fail({
    action: "upsert", token: tokens.owner, table: "kas",
    record: Object.assign({}, auto, { amount: 1 }),
  }, "FORBIDDEN");
  fail({ action: "remove", token: tokens.owner, table: "kas", id: auto.id }, "FORBIDDEN");
});

check("hapus kas masuk manual ditolak bila saldo menjadi negatif", () => {
  const extra = ok({
    action: "upsert", token: tokens.owner, table: "kas",
    record: { type: "in", category: "Tambahan", description: "Dana tambahan", amount: 10000 },
  }).record;
  const spend = ok({
    action: "upsert", token: tokens.owner, table: "kas",
    record: { type: "out", category: "Operasional", description: "Servis meja", amount: 55000 },
  }).record;
  fail({ action: "remove", token: tokens.owner, table: "kas", id: extra.id }, "VALIDATION");
  ok({ action: "remove", token: tokens.owner, table: "kas", id: spend.id });
  ok({ action: "remove", token: tokens.owner, table: "kas", id: extra.id });
});

check("validasi pengaturan kas, boolean, dan logo", () => {
  fail({ action: "upsert", token: tokens.owner, table: "settings", record: { kasPercent: 150 } }, "VALIDATION");
  fail({ action: "upsert", token: tokens.owner, table: "settings", record: { kasPercent: "abc" } }, "VALIDATION");
  fail({ action: "upsert", token: tokens.owner, table: "settings", record: { kasAutoEnabled: "false" } }, "VALIDATION");
  fail({ action: "upsert", token: tokens.owner, table: "settings", record: { logo: "javascript:alert(1)" } }, "VALIDATION");
  const settings = ok({
    action: "upsert", token: tokens.owner, table: "settings",
    record: { kasPercent: 20, logo: "data:image/png;base64," + "A".repeat(100) },
  }).record;
  assert(settings.kasPercent === 20, "kasPercent tidak tersimpan");
  assert(settings.logo.startsWith("data:image/png;base64,"), "logo tidak tersimpan");
});

check("alokasi tiket baru mengikuti persentase terbaru", () => {
  order3 = ok({
    action: "upsert", token: tokens.kasir, table: "orders",
    record: {
      customerId: customer.id, deviceType: "laptop", brand: "Asus", model: "Vivobook",
      complaint: "Keyboard rusak", partsCost: 0, serviceCost: 100000, status: "masuk",
    },
  }).record;
  const data = ok({
    action: "upsert", token: tokens.kasir, table: "orders",
    record: { id: order3.id, paymentStatus: "lunas", paymentMethod: "transfer" },
  });
  assert(data.autoKas && data.autoKas.amount === 20000, "Alokasi 20% salah: " + (data.autoKas && data.autoKas.amount));
  order3 = data.record;
});

check("hapus tiket ditolak bila alokasi kasnya sudah terpakai", () => {
  ok({
    action: "upsert", token: tokens.owner, table: "kas",
    record: { type: "out", category: "Operasional", description: "Pembelian besar", amount: 55000 },
  });
  fail({ action: "remove", token: tokens.owner, table: "orders", id: order3.id }, "VALIDATION");
  const out = bootstrap(tokens.owner).kas.filter((entry) => entry.source === "manual" && entry.type === "out")
    .find((entry) => entry.description === "Pembelian besar");
  ok({ action: "remove", token: tokens.owner, table: "kas", id: out.id });
  ok({ action: "remove", token: tokens.owner, table: "orders", id: order3.id });
  const kasAfter = bootstrap(tokens.owner).kas;
  assert(!kasAfter.some((entry) => entry.orderId === order3.id), "Kas tiket tidak terhapus bersama tiket");
});

check("nomor tiket tetap unik setelah tiket dihapus", () => {
  const nextOrder = ok({
    action: "upsert", token: tokens.kasir, table: "orders",
    record: {
      customerId: customer.id, deviceType: "pc", brand: "Custom", model: "Ryzen",
      complaint: "Tidak menyala", serviceCost: 200000, status: "masuk",
    },
  }).record;
  assert(/^SVC-\d{6}-004$/.test(nextOrder.ticketNo), "Nomor tiket tidak melanjutkan urutan: " + nextOrder.ticketNo);
});

check("hapus tiket oleh kasir ditolak", () => {
  fail({ action: "remove", token: tokens.kasir, table: "orders", id: order2.id }, "FORBIDDEN");
});

check("pelanggan dengan riwayat servis tidak dapat dihapus", () => {
  fail({ action: "remove", token: tokens.owner, table: "customers", id: customer.id }, "VALIDATION");
});

check("validasi dan proteksi akun pengguna", () => {
  fail({
    action: "upsert", token: tokens.owner, table: "users",
    record: { name: "Duplikat", username: "owner", password: "abcdef", role: "kasir" },
  }, "VALIDATION");
  fail({
    action: "upsert", token: tokens.owner, table: "users",
    record: { id: "u-owner", name: "Owner ServisPro", username: "owner", role: "kasir", active: true },
  }, "FORBIDDEN");
  fail({
    action: "upsert", token: tokens.owner, table: "users",
    record: { name: "Pendek", username: "pendek", password: "123", role: "kasir" },
  }, "VALIDATION");
  fail({ action: "remove", token: tokens.owner, table: "users", id: "u-owner" }, "FORBIDDEN");
});

let kasir2;
let kasir2Token;
check("owner membuat akun baru dan mengganti role mencabut sesi lama", () => {
  kasir2 = ok({
    action: "upsert", token: tokens.owner, table: "users",
    record: { name: "Kasir Baru", username: "kasir2", password: "kasir123", role: "kasir", active: true, salary: 0 },
  }).record;
  assert(!kasir2.passwordHash && !kasir2.salt, "hash password bocor ke klien");
  kasir2Token = ok({ action: "login", username: "kasir2", password: "kasir123" }).token;
  const changed = ok({
    action: "upsert", token: tokens.owner, table: "users",
    record: Object.assign({}, kasir2, { role: "teknisi" }),
  }).record;
  assert(changed.role === "teknisi", "Role tidak berubah");
  fail({ action: "bootstrap", token: kasir2Token }, "AUTH");
});

check("gaji divalidasi, dihitung, dan hanya untuk owner", () => {
  const salary = ok({
    action: "upsert", token: tokens.owner, table: "salaries",
    record: { period: "2026-10", userId: "u-teknisi", userName: "Nama Palsu", base: 3000000, bonus: 250000, deduction: 50000, status: "dibayar" },
  }).record;
  assert(salary.userName === "Teknisi ServisPro", "Nama karyawan tidak diambil dari database");
  assert(salary.total === 3200000, "Total gaji salah: " + salary.total);
  assert(salary.paidAt, "paidAt tidak diisi");
  fail({
    action: "upsert", token: tokens.owner, table: "salaries",
    record: { period: "2026-10", userId: "u-teknisi", base: 1, status: "belum" },
  }, "VALIDATION");
  fail({
    action: "upsert", token: tokens.owner, table: "salaries",
    record: { period: "2026-13", userId: "u-teknisi", base: 1 },
  }, "VALIDATION");
  fail({
    action: "upsert", token: tokens.kasir, table: "salaries",
    record: { period: "2026-09", userId: "u-kasir", base: 1 },
  }, "FORBIDDEN");
  assert(bootstrap(tokens.kasir).salaries.length === 0, "Gaji bocor ke kasir");
});

check("hapus pelanggan tanpa riwayat berhasil dan formula dinetralkan", () => {
  const temp = ok({
    action: "upsert", token: tokens.kasir, table: "customers",
    record: { name: "=1+1", phone: "08123" },
  }).record;
  const table = rawTable("customers");
  const raw = table.find((row) => row[0] === temp.id);
  assert(String(raw[table[0].indexOf("name")]).startsWith("'="), "Nama formula tidak dinetralkan");
  const apiCustomer = bootstrap(tokens.owner).customers.find((row) => row.id === temp.id);
  assert(apiCustomer.name === "=1+1", "Nama formula tidak kembali utuh");
  ok({ action: "remove", token: tokens.owner, table: "customers", id: temp.id });
});

check("resetPassword dan revokeAllSessions bekerja", () => {
  const message = context.resetPassword("kasir2", "baru12345");
  assert(/berhasil direset/.test(message), "Pesan reset tidak sesuai");
  fail({ action: "login", username: "kasir2", password: "kasir123" }, "AUTH");
  ok({ action: "login", username: "kasir2", password: "baru12345" });
  context.revokeAllSessions();
  fail({ action: "bootstrap", token: tokens.owner }, "AUTH");
  ok({ action: "login", username: "owner", password: "owner123" });
});

check("aksi tidak dikenal dan body rusak ditolak", () => {
  fail({ action: "tidak-ada" }, "BAD_ACTION");
  const output = context.doPost({ postData: { contents: "{" } });
  const response = JSON.parse(output.getContent());
  assert(response.ok === false && response.code === "BAD_REQUEST", "Body rusak tidak ditolak");
});

console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length }, null, 2));
results.filter((r) => !r.ok).forEach((r) => console.log("FAIL:", r.name, "→", r.error));
if (results.every((r) => r.ok)) console.log("ALL TESTS PASSED");
