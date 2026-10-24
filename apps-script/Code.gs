/**
 * ServisPro — backend Google Apps Script
 * Database: Google Sheets (container-bound atau spreadsheet yang disimpan di Script Properties)
 *
 * Jalankan setup() satu kali dari editor Apps Script, lalu deploy sebagai Web App:
 * Execute as: Me · Who has access: Anyone · URL harus berakhiran /exec.
 */

const API_VERSION = "1.0.0";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CELL_LENGTH = 49500;

const ROLES = ["owner", "teknisi", "kasir", "pramugari"];
const DEVICE_TYPES = ["hp", "laptop", "printer", "pc"];
const ORDER_STATUSES = ["masuk", "diagnosa", "menunggu", "proses", "selesai", "diambil", "batal"];
const PAYMENT_METHODS = ["cash", "transfer", "qris", "debit", "ewallet"];

const SHEET_SCHEMAS = {
  users: {
    headers: ["id", "name", "username", "passwordHash", "salt", "role", "phone", "email", "salary", "active", "createdAt", "updatedAt"],
    numbers: ["salary"],
    booleans: ["active"],
  },
  suppliers: {
    headers: ["id", "name", "contact", "phone", "email", "address", "notes", "createdAt", "updatedAt"],
  },
  customers: {
    headers: ["id", "name", "phone", "email", "address", "notes", "createdAt", "updatedAt"],
  },
  orders: {
    headers: ["id", "ticketNo", "customerId", "customerName", "customerPhone", "deviceType", "brand", "model", "serial", "accessories", "complaint", "condition", "diagnosis", "technicianId", "technicianName", "supplierId", "supplierName", "estimateCost", "partsCost", "serviceCost", "total", "status", "paymentStatus", "paymentMethod", "paidAt", "estimatedDone", "note", "createdBy", "history", "createdAt", "updatedAt", "kasAllocated", "kasAllocatedAmount"],
    numbers: ["estimateCost", "partsCost", "serviceCost", "total", "kasAllocatedAmount"],
    booleans: ["kasAllocated"],
    json: ["history"],
  },
  kas: {
    headers: ["id", "date", "type", "category", "description", "amount", "source", "orderId", "items", "reference", "createdBy", "createdAt", "updatedAt"],
    numbers: ["amount"],
    json: ["items"],
  },
  salaries: {
    headers: ["id", "period", "userId", "userName", "base", "bonus", "deduction", "total", "status", "paidAt", "note", "createdAt", "updatedAt"],
    numbers: ["base", "bonus", "deduction", "total"],
  },
  settings: {
    headers: ["key", "value"],
  },
};

// Kolom berformat teks agar nomor telepon, serial, dan nomor tiket tidak diubah Sheets.
const TEXT_COLUMNS = {
  users: ["username", "phone"],
  suppliers: ["phone"],
  customers: ["phone"],
  orders: ["ticketNo", "serial", "customerPhone"],
};

const DEFAULT_SETTINGS = {
  companyName: "ServisPro Technology",
  tagline: "Service Center HP, Laptop, Printer & PC",
  address: "Jl. Merdeka Raya No. 88, Jakarta Selatan 12345",
  phone: "0812-3456-7890",
  email: "halo@servispro.id",
  website: "servispro.id",
  logo: "",
  primaryColor: "#0d9488",
  receiptPaper: "80mm",
  receiptHeader: "Terima kasih telah mempercayakan perangkat Anda.",
  receiptFooter: "Garansi servis 30 hari. Simpan nota ini sebagai bukti klaim.",
  receiptShowLogo: true,
  receiptShowTechnician: true,
  autoPrint: false,
  printerName: "Printer Thermal Utama",
  kasAutoEnabled: true,
  kasPercent: 10,
  themeDefault: "light",
};

const WRITE_ACCESS = {
  users: ["owner"],
  suppliers: ["owner"],
  customers: ["owner", "kasir", "pramugari"],
  orders: ["owner", "teknisi", "kasir", "pramugari"],
  kas: ["owner"],
  salaries: ["owner"],
  settings: ["owner"],
};

const REMOVE_ACCESS = {
  users: ["owner"],
  suppliers: ["owner"],
  customers: ["owner", "kasir", "pramugari"],
  orders: ["owner"],
  kas: ["owner"],
  salaries: ["owner"],
};

class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ApiError";
    this.code = code || "ERROR";
  }
}

/* =====================================================
   Entry point Web App
   ===================================================== */

function doGet() {
  return jsonResponse({
    ok: true,
    data: {
      service: "ServisPro API",
      version: API_VERSION,
      message: "Gunakan POST untuk mengakses API.",
      time: new Date().toISOString(),
    },
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new ApiError("Permintaan kosong.", "BAD_REQUEST");
    }
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (error) {
      throw new ApiError("Format permintaan tidak valid.", "BAD_REQUEST");
    }
    if (!body || typeof body !== "object") {
      throw new ApiError("Format permintaan tidak valid.", "BAD_REQUEST");
    }

    const action = String(body.action || "").trim();
    let data;

    if (action === "ping") {
      const ss = getSpreadsheet();
      Object.keys(SHEET_SCHEMAS).forEach(function (table) {
        sheetFor(ss, table);
      });
      data = {
        version: API_VERSION,
        message: "Koneksi Google Sheets berhasil.",
        mode: "remote",
        spreadsheet: ss.getName(),
        time: new Date().toISOString(),
      };
    } else if (action === "login") {
      data = apiLogin(body);
    } else if (action === "bootstrap") {
      data = apiBootstrap(body);
    } else if (action === "upsert") {
      data = withScriptLock(function () { return apiUpsert(body); });
    } else if (action === "remove") {
      data = withScriptLock(function () { return apiRemove(body); });
    } else {
      throw new ApiError("Aksi tidak dikenal: " + action, "BAD_ACTION");
    }

    return jsonResponse({ ok: true, data: data });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    const isApi = error instanceof ApiError;
    return jsonResponse({
      ok: false,
      error: isApi ? error.message : "Kesalahan server: " + (error && error.message ? error.message : "tidak diketahui"),
      code: isApi ? error.code : "SERVER",
    });
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new ApiError("Server sedang sibuk. Coba lagi beberapa saat.", "BUSY");
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================
   Autentikasi & sesi
   ===================================================== */

function apiLogin(body) {
  const username = normalizeUsername(body.username);
  const password = String(body.password === undefined ? "" : body.password);

  if (!username || !password) {
    throw new ApiError("Username dan password wajib diisi.", "AUTH");
  }

  const ss = getSpreadsheet();
  const users = readTable(ss, "users");
  const user = users.filter(function (row) { return normalizeUsername(row.username) === username; })[0];

  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    Utilities.sleep(350);
    throw new ApiError("Username atau password salah.", "AUTH");
  }
  if (user.active === false) {
    throw new ApiError("Akun ini dinonaktifkan. Hubungi owner.", "AUTH");
  }

  const token = issueSession(user);
  return {
    token: token,
    user: sanitizeUser(user, user),
  };
}

function apiBootstrap(body) {
  const auth = requireSession(body);
  const raw = {
    users: auth.users,
    suppliers: readTable(auth.ss, "suppliers"),
    customers: readTable(auth.ss, "customers"),
    orders: readTable(auth.ss, "orders"),
    kas: readTable(auth.ss, "kas"),
    salaries: readTable(auth.ss, "salaries"),
    settings: readSettings(auth.ss),
  };
  return sanitizeData(raw, auth.user);
}

function requireSession(body) {
  const token = String(body.token || "").trim();
  if (!token) throw new ApiError("Sesi login berakhir. Silakan masuk kembali.", "AUTH");

  const props = PropertiesService.getScriptProperties();
  const sessionKey = "session_" + sha256Hex(token);
  const rawSession = props.getProperty(sessionKey);
  if (!rawSession) throw new ApiError("Sesi login tidak valid. Silakan masuk kembali.", "AUTH");

  let session;
  try {
    session = JSON.parse(rawSession);
  } catch (error) {
    props.deleteProperty(sessionKey);
    throw new ApiError("Sesi login tidak valid. Silakan masuk kembali.", "AUTH");
  }
  if (!session || !session.exp || Number(session.exp) <= Date.now()) {
    props.deleteProperty(sessionKey);
    throw new ApiError("Sesi login sudah kedaluwarsa. Silakan masuk kembali.", "AUTH");
  }

  const ss = getSpreadsheet();
  const users = readTable(ss, "users");
  const user = users.filter(function (row) { return row.id === session.userId; })[0];
  if (!user || user.active === false) {
    props.deleteProperty(sessionKey);
    throw new ApiError("Akun tidak aktif. Hubungi owner.", "AUTH");
  }

  return { user: user, users: users, ss: ss };
}

function issueSession(user) {
  const token = randomHex(32);
  const props = PropertiesService.getScriptProperties();
  cleanupSessions(props);
  props.setProperty("session_" + sha256Hex(token), JSON.stringify({
    userId: user.id,
    exp: Date.now() + SESSION_TTL_MS,
    createdAt: Date.now(),
  }));
  return token;
}

function cleanupSessions(props) {
  const now = Date.now();
  const keys = props.getKeys();
  keys.forEach(function (key) {
    if (key.indexOf("session_") !== 0) return;
    try {
      const session = JSON.parse(props.getProperty(key));
      if (!session || !session.exp || Number(session.exp) <= now) props.deleteProperty(key);
    } catch (error) {
      props.deleteProperty(key);
    }
  });
}

function revokeUserSessions(userId) {
  const props = PropertiesService.getScriptProperties();
  props.getKeys().forEach(function (key) {
    if (key.indexOf("session_") !== 0) return;
    try {
      const session = JSON.parse(props.getProperty(key));
      if (session && session.userId === userId) props.deleteProperty(key);
    } catch (error) {
      props.deleteProperty(key);
    }
  });
}

function sanitizeUser(user, viewer) {
  if (!user) return null;
  const base = {
    id: user.id,
    name: user.name,
    role: user.role,
    active: user.active !== false,
  };
  const isOwner = viewer && viewer.role === "owner";
  const isSelf = viewer && viewer.id === user.id;
  if (!isOwner && !isSelf) return base;
  return Object.assign(base, {
    username: user.username || "",
    phone: user.phone || "",
    email: user.email || "",
    salary: Number(user.salary) || 0,
    createdAt: user.createdAt || "",
    updatedAt: user.updatedAt || "",
  });
}

function sanitizeData(raw, viewer) {
  const user = viewer;
  return {
    me: sanitizeUser((raw.users || []).filter(function (row) { return row.id === user.id; })[0], user),
    users: (raw.users || []).map(function (row) { return sanitizeUser(row, user); }).filter(Boolean),
    suppliers: raw.suppliers || [],
    customers: raw.customers || [],
    orders: raw.orders || [],
    kas: user.role === "owner" ? (raw.kas || []) : [],
    salaries: user.role === "owner" ? (raw.salaries || []) : [],
    settings: raw.settings || {},
  };
}

/* =====================================================
   Upsert & remove
   ===================================================== */

function apiUpsert(body) {
  const auth = requireSession(body);
  const table = String(body.table || "").trim();
  const record = body.record;

  if (!SHEET_SCHEMAS[table] || table === "settings" && !record) {
    throw new ApiError("Tabel data tidak dikenal.", "BAD_TABLE");
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new ApiError("Data yang dikirim tidak valid.", "BAD_REQUEST");
  }
  assertRole(auth.user.role, WRITE_ACCESS[table], "Role Anda tidak memiliki akses mengubah data ini.");

  if (table === "users") return { record: upsertUser(auth.ss, record, auth.user) };
  if (table === "settings") return { record: upsertSettings(auth.ss, record) };
  if (table === "customers") return { record: upsertContact(auth.ss, "customers", record) };
  if (table === "suppliers") return { record: upsertContact(auth.ss, "suppliers", record) };
  if (table === "orders") return upsertOrder(auth.ss, record, auth);
  if (table === "kas") return { record: upsertKas(auth.ss, record, auth) };
  if (table === "salaries") return { record: upsertSalary(auth.ss, record, auth) };

  throw new ApiError("Tabel data tidak dikenal.", "BAD_TABLE");
}

function apiRemove(body) {
  const auth = requireSession(body);
  const table = String(body.table || "").trim();
  const id = String(body.id || "").trim();

  if (!REMOVE_ACCESS[table]) throw new ApiError("Tabel data tidak dikenal.", "BAD_TABLE");
  if (!id) throw new ApiError("ID data wajib diisi.", "BAD_REQUEST");
  assertRole(auth.user.role, REMOVE_ACCESS[table], "Role Anda tidak memiliki akses menghapus data ini.");

  if (table === "users") return removeUser(auth.ss, id, auth.user);
  if (table === "customers") return removeCustomer(auth.ss, id);
  if (table === "suppliers") return removeSupplier(auth.ss, id);
  if (table === "orders") return removeOrder(auth.ss, id);
  if (table === "kas") return removeKas(auth.ss, id);
  if (table === "salaries") return removeSalary(auth.ss, id);

  throw new ApiError("Tabel data tidak dikenal.", "BAD_TABLE");
}

function assertRole(role, allowed, message) {
  if (!allowed || allowed.indexOf(role) < 0) {
    throw new ApiError(message || "Akses ditolak.", "FORBIDDEN");
  }
}

function upsertUser(ss, record, authUser) {
  const users = readTable(ss, "users");
  const input = record;
  const now = new Date().toISOString();
  const existing = input.id ? findById(users, String(input.id)) : null;
  const name = String(input.name || "").trim();
  const username = normalizeUsername(input.username);
  const role = String(input.role || "").trim();

  if (!name) throw new ApiError("Nama pengguna wajib diisi.", "VALIDATION");
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
    throw new ApiError("Username harus 3–24 karakter: huruf kecil, angka, titik, garis bawah, atau strip.", "VALIDATION");
  }
  if (ROLES.indexOf(role) < 0) throw new ApiError("Role tidak valid.", "VALIDATION");
  if (!existing && !input.password) throw new ApiError("Password wajib diisi untuk pengguna baru.", "VALIDATION");
  if (input.password && String(input.password).length < 6) {
    throw new ApiError("Password minimal 6 karakter.", "VALIDATION");
  }

  const duplicate = users.filter(function (row) {
    return row.id !== (existing ? existing.id : "") && normalizeUsername(row.username) === username;
  })[0];
  if (duplicate) throw new ApiError("Username sudah digunakan.", "VALIDATION");

  const active = existing && input.active === undefined ? existing.active !== false : input.active !== false;
  const selfEdit = existing && existing.id === authUser.id;
  if (selfEdit && role !== existing.role) {
    throw new ApiError("Anda tidak dapat mengubah role akun sendiri. Minta owner lain melakukannya.", "FORBIDDEN");
  }
  if (selfEdit && !active) {
    throw new ApiError("Anda tidak dapat menonaktifkan akun sendiri.", "FORBIDDEN");
  }

  const removingActiveOwner = existing && existing.role === "owner" && existing.active !== false
    && (role !== "owner" || !active);
  if (removingActiveOwner) {
    const otherOwner = users.filter(function (row) {
      return row.id !== existing.id && row.role === "owner" && row.active !== false;
    }).length > 0;
    if (!otherOwner) throw new ApiError("Minimal harus ada satu akun owner yang aktif.", "VALIDATION");
  }

  const saved = {
    id: existing ? existing.id : generateId("u"),
    name: name,
    username: input.username ? String(input.username).trim().replace(/^@+/, "") : username,
    role: role,
    phone: String(input.phone || "").trim(),
    email: String(input.email || "").trim(),
    salary: Number(input.salary) || 0,
    active: active,
    createdAt: existing ? existing.createdAt : (input.createdAt || now),
    updatedAt: now,
    passwordHash: existing ? existing.passwordHash : "",
    salt: existing ? existing.salt : "",
  };

  if (input.password) {
    const passwordRecord = createPasswordRecord(String(input.password));
    saved.passwordHash = passwordRecord.hash;
    saved.salt = passwordRecord.salt;
  }

  writeRecord(ss, "users", saved);

  if (existing && (input.password || !active || existing.role !== role)) {
    revokeUserSessions(existing.id);
  }

  return sanitizeUser(saved, { id: authUser.id, role: "owner" });
}

function upsertContact(ss, table, record) {
  const rows = readTable(ss, table);
  const input = record;
  const now = new Date().toISOString();
  const existing = input.id ? findById(rows, String(input.id)) : null;
  const name = String(input.name || "").trim();
  if (!name) throw new ApiError("Nama wajib diisi.", "VALIDATION");

  const saved = {
    id: existing ? existing.id : generateId(table === "suppliers" ? "sup" : "cus"),
    name: name,
    phone: String(input.phone || "").trim(),
    email: String(input.email || "").trim(),
    address: String(input.address || "").trim(),
    notes: String(input.notes || "").trim(),
    createdAt: existing ? existing.createdAt : (input.createdAt || now),
    updatedAt: now,
  };
  if (table === "suppliers") {
    saved.contact = String(input.contact || "").trim();
  }

  writeRecord(ss, table, saved);
  return saved;
}

function upsertOrder(ss, record, auth) {
  const input = record;
  const role = auth.user.role;
  const now = new Date().toISOString();
  const orders = readTable(ss, "orders");
  const existing = input.id ? findById(orders, String(input.id)) : null;

  if (!existing && role === "teknisi") {
    throw new ApiError("Teknisi tidak dapat membuat tiket baru.", "FORBIDDEN");
  }

  if (existing && role === "teknisi") {
    if (String(existing.technicianId || "") !== String(auth.user.id)) {
      throw new ApiError("Anda hanya dapat memperbarui tiket yang ditugaskan kepada Anda.", "FORBIDDEN");
    }
    const protectedFields = [
      "ticketNo", "customerId", "deviceType", "brand", "model", "serial", "accessories",
      "complaint", "condition", "technicianId", "supplierId", "estimateCost", "partsCost",
      "serviceCost", "total", "paymentStatus", "paymentMethod", "paidAt", "estimatedDone",
      "note", "createdBy", "createdAt",
    ];
    protectedFields.forEach(function (field) {
      if (Object.prototype.hasOwnProperty.call(input, field) && !sameValue(input[field], existing[field])) {
        throw new ApiError("Teknisi hanya dapat mengubah status, diagnosa, dan riwayat servis.", "FORBIDDEN");
      }
    });
  }

  if (existing && role === "pramugari") {
    if (input.paymentStatus !== undefined && String(input.paymentStatus) !== String(existing.paymentStatus)) {
      throw new ApiError("Pembayaran hanya dapat diproses oleh kasir atau owner.", "FORBIDDEN");
    }
    if (input.paymentMethod !== undefined && String(input.paymentMethod || "") !== String(existing.paymentMethod || "")) {
      throw new ApiError("Pembayaran hanya dapat diproses oleh kasir atau owner.", "FORBIDDEN");
    }
    if (input.paidAt !== undefined && String(input.paidAt || "") !== String(existing.paidAt || "")) {
      throw new ApiError("Pembayaran hanya dapat diproses oleh kasir atau owner.", "FORBIDDEN");
    }
  }

  const customerId = String(input.customerId || (existing ? existing.customerId : "")).trim();
  if (!customerId) throw new ApiError("Pelanggan wajib dipilih.", "VALIDATION");
  const customers = readTable(ss, "customers");
  const customer = findById(customers, customerId);
  if (!customer) throw new ApiError("Pelanggan tidak ditemukan.", "VALIDATION");

  const deviceType = String(input.deviceType || (existing ? existing.deviceType : "")).trim();
  if (DEVICE_TYPES.indexOf(deviceType) < 0) throw new ApiError("Jenis perangkat tidak valid.", "VALIDATION");

  const status = String(input.status || (existing ? existing.status : "masuk")).trim();
  if (ORDER_STATUSES.indexOf(status) < 0) throw new ApiError("Status servis tidak valid.", "VALIDATION");

  const technicianId = String(input.technicianId !== undefined ? input.technicianId : (existing ? existing.technicianId : "")).trim();
  const technician = technicianId ? findById(auth.users, technicianId) : null;
  if (technicianId && !technician) throw new ApiError("Teknisi tidak ditemukan.", "VALIDATION");

  const supplierId = String(input.supplierId !== undefined ? input.supplierId : (existing ? existing.supplierId : "")).trim();
  const suppliers = supplierId ? readTable(ss, "suppliers") : [];
  const supplier = supplierId ? findById(suppliers, supplierId) : null;
  if (supplierId && !supplier) throw new ApiError("Supplier tidak ditemukan.", "VALIDATION");

  const estimateCost = nonNegativeNumber(input.estimateCost !== undefined ? input.estimateCost : (existing ? existing.estimateCost : 0));
  const partsCost = nonNegativeNumber(input.partsCost !== undefined ? input.partsCost : (existing ? existing.partsCost : 0));
  const serviceCost = nonNegativeNumber(input.serviceCost !== undefined ? input.serviceCost : (existing ? existing.serviceCost : 0));
  const total = partsCost + serviceCost;
  const brand = String(input.brand !== undefined ? input.brand : (existing ? existing.brand : "")).trim();
  const model = String(input.model !== undefined ? input.model : (existing ? existing.model : "")).trim();
  const complaint = String(input.complaint !== undefined ? input.complaint : (existing ? existing.complaint : "")).trim();
  if (!brand || !model) throw new ApiError("Merek dan model perangkat wajib diisi.", "VALIDATION");
  if (!complaint) throw new ApiError("Keluhan pelanggan wajib diisi.", "VALIDATION");

  let paymentStatus = "belum";
  let paymentMethod = "";
  let paidAt = "";
  if (!existing) {
    // Tiket baru selalu masuk sebagai belum bayar; pembayaran diproses lewat alur pembayaran.
    paymentStatus = "belum";
  } else {
    const requested = input.paymentStatus !== undefined ? input.paymentStatus : existing.paymentStatus;
    paymentStatus = requested === "lunas" ? "lunas" : "belum";
    if (paymentStatus === "lunas") {
      paymentMethod = String(input.paymentMethod !== undefined ? input.paymentMethod : (existing.paymentMethod || "cash")).trim();
      if (PAYMENT_METHODS.indexOf(paymentMethod) < 0) {
        throw new ApiError("Metode pembayaran tidak valid.", "VALIDATION");
      }
      paidAt = String(input.paidAt || (existing.paymentStatus === "lunas" ? existing.paidAt : now) || now);
      if (isNaN(new Date(paidAt).getTime())) paidAt = now;
    }
  }

  const orderId = existing ? existing.id : generateId("ord");
  const ticketNo = existing ? String(existing.ticketNo || "") : nextTicketNo(orders);
  const history = Array.isArray(input.history)
    ? input.history
    : (existing && Array.isArray(existing.history) ? existing.history : []);
  if (!existing && history.length === 0) {
    history.push({
      status: status,
      at: now,
      by: auth.user.name,
      note: input.note ? String(input.note).trim() : "Perangkat diterima dan dicatat.",
    });
  }

  const kas = readTable(ss, "kas");
  const linkedKas = kas.filter(function (entry) { return String(entry.orderId || "") === String(orderId); });
  if (existing && existing.paymentStatus === "lunas" && paymentStatus !== "lunas" && linkedKas.length > 0) {
    throw new ApiError("Tiket lunas dengan alokasi kas tidak dapat dikembalikan ke belum bayar. Hapus tiket bila perlu membatalkan.", "VALIDATION");
  }
  let kasAllocated = linkedKas.length > 0 || !!(existing && existing.kasAllocated);
  let kasAllocatedAmount = linkedKas.reduce(function (sum, entry) {
    return sum + (Number(entry.amount) || 0);
  }, 0);
  if (!kasAllocatedAmount && existing && existing.kasAllocated) {
    kasAllocatedAmount = Number(existing.kasAllocatedAmount) || 0;
  }

  const saved = {
    id: orderId,
    ticketNo: ticketNo,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone || "",
    deviceType: deviceType,
    brand: brand,
    model: model,
    serial: String(input.serial !== undefined ? input.serial : (existing ? existing.serial : "")).trim(),
    accessories: String(input.accessories !== undefined ? input.accessories : (existing ? existing.accessories : "")).trim(),
    complaint: complaint,
    condition: String(input.condition !== undefined ? input.condition : (existing ? existing.condition : "")).trim(),
    diagnosis: String(input.diagnosis !== undefined ? input.diagnosis : (existing ? existing.diagnosis : "")).trim(),
    technicianId: technician ? technician.id : "",
    technicianName: technician ? technician.name : "",
    supplierId: supplier ? supplier.id : "",
    supplierName: supplier ? supplier.name : "",
    estimateCost: estimateCost,
    partsCost: partsCost,
    serviceCost: serviceCost,
    total: total,
    status: status,
    paymentStatus: paymentStatus,
    paymentMethod: paymentMethod,
    paidAt: paidAt,
    estimatedDone: String(input.estimatedDone !== undefined ? input.estimatedDone : (existing ? existing.estimatedDone : "")),
    note: String(input.note !== undefined ? input.note : (existing ? existing.note : "")).trim(),
    createdBy: existing ? existing.createdBy : auth.user.name,
    history: history,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    kasAllocated: kasAllocated,
    kasAllocatedAmount: kasAllocatedAmount,
  };

  let autoKas = null;
  const allocation = allocationForOrder(saved, auth);
  if (paymentStatus === "lunas" && !kasAllocated && allocation > 0) {
    autoKas = {
      id: generateId("kas"),
      date: localDateOf(paidAt),
      type: "in",
      category: "Alokasi Laba",
      description: "Alokasi otomatis laba " + ticketNo,
      amount: allocation,
      source: "otomatis",
      orderId: orderId,
      items: [],
      reference: ticketNo,
      createdBy: "Sistem",
      createdAt: now,
      updatedAt: now,
    };
    // Tulis kas lebih dulu agar tidak ada tiket bertanda teralokasi tanpa catatan kas.
    writeRecord(ss, "kas", autoKas);
    saved.kasAllocated = true;
    saved.kasAllocatedAmount = allocation;
  }

  writeRecord(ss, "orders", saved);
  return { record: saved, autoKas: autoKas };
}

function upsertKas(ss, record, auth) {
  const input = record;
  const now = new Date().toISOString();
  const kas = readTable(ss, "kas");
  const existing = input.id ? findById(kas, String(input.id)) : null;

  if (existing && existing.source !== "manual") {
    throw new ApiError("Alokasi otomatis tidak dapat diubah. Perubahan mengikuti tiket terkait.", "FORBIDDEN");
  }

  if (!existing && input.source === "otomatis") {
    return syncKasAllocation(ss, input, auth, now);
  }

  const type = input.type === "in" ? "in" : "out";
  const category = String(input.category || "").trim();
  const description = String(input.description || "").trim();
  if (!category) throw new ApiError("Kategori kas wajib diisi.", "VALIDATION");
  if (!description) throw new ApiError("Keterangan kas wajib diisi.", "VALIDATION");

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length > 100) throw new ApiError("Rincian pembelian terlalu banyak (maksimal 100 baris).", "VALIDATION");
  const items = rawItems.map(function (item) {
    const name = String(item && item.name || "").trim();
    const qty = Number(item && item.qty);
    const unitPrice = Number(item && item.unitPrice);
    if (!name) throw new ApiError("Nama barang pada rincian wajib diisi.", "VALIDATION");
    if (!isFinite(qty) || qty <= 0) throw new ApiError("Qty pada rincian harus lebih dari nol.", "VALIDATION");
    if (!isFinite(unitPrice) || unitPrice < 0) throw new ApiError("Harga satuan pada rincian tidak valid.", "VALIDATION");
    return { name: name, qty: qty, unitPrice: unitPrice };
  });

  let amount = Number(input.amount) || 0;
  if (items.length) {
    const itemTotal = items.reduce(function (sum, item) { return sum + item.qty * item.unitPrice; }, 0);
    if (itemTotal > 0) amount = Math.round(itemTotal);
  }
  if (!isFinite(amount) || amount <= 0) throw new ApiError("Nominal kas harus lebih dari nol.", "VALIDATION");

  const rawDate = String(input.date || todayISO());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) throw new ApiError("Tanggal kas tidak valid.", "VALIDATION");

  const previousSigned = existing ? (existing.type === "in" ? Number(existing.amount) || 0 : -(Number(existing.amount) || 0)) : 0;
  const balance = kas.reduce(function (sum, entry) {
    return sum + (entry.type === "in" ? (Number(entry.amount) || 0) : -(Number(entry.amount) || 0));
  }, 0);
  const nextBalance = balance - previousSigned + (type === "in" ? amount : -amount);
  if (nextBalance < 0) throw new ApiError("Saldo kas tidak mencukupi untuk pengeluaran ini.", "VALIDATION");

  const saved = {
    id: existing ? existing.id : generateId("kas"),
    date: rawDate,
    type: type,
    category: category,
    description: description,
    amount: amount,
    source: "manual",
    orderId: existing ? existing.orderId || "" : "",
    items: items,
    reference: String(input.reference || "").trim(),
    createdBy: existing ? existing.createdBy : auth.user.name,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  writeRecord(ss, "kas", saved);
  return saved;
}

function syncKasAllocation(ss, input, auth, now) {
  const orderId = String(input.orderId || "").trim();
  if (!orderId) throw new ApiError("Tiket sumber alokasi wajib diisi.", "VALIDATION");

  const orders = readTable(ss, "orders");
  const order = findById(orders, orderId);
  if (!order) throw new ApiError("Tiket sumber alokasi tidak ditemukan.", "VALIDATION");
  if (order.paymentStatus !== "lunas") throw new ApiError("Alokasi hanya untuk tiket yang sudah lunas.", "VALIDATION");

  const kas = readTable(ss, "kas");
  const already = kas.some(function (entry) { return String(entry.orderId || "") === orderId; });
  if (already) throw new ApiError("Tiket ini sudah memiliki alokasi kas.", "VALIDATION");

  const amount = allocationForOrder(order, auth);
  if (amount <= 0) throw new ApiError("Laba tiket belum memenuhi syarat alokasi.", "VALIDATION");

  const autoKas = {
    id: generateId("kas"),
    date: localDateOf(order.paidAt),
    type: "in",
    category: "Alokasi Laba",
    description: "Alokasi otomatis laba " + order.ticketNo,
    amount: amount,
    source: "otomatis",
    orderId: order.id,
    items: [],
    reference: order.ticketNo,
    createdBy: "Sistem",
    createdAt: now,
    updatedAt: now,
  };
  writeRecord(ss, "kas", autoKas);

  const updatedOrder = Object.assign({}, order, {
    kasAllocated: true,
    kasAllocatedAmount: amount,
    updatedAt: now,
  });
  writeRecord(ss, "orders", updatedOrder);
  return autoKas;
}

function upsertSalary(ss, record, auth) {
  const input = record;
  const now = new Date().toISOString();
  const salaries = readTable(ss, "salaries");
  const existing = input.id ? findById(salaries, String(input.id)) : null;
  const period = String(input.period || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new ApiError("Periode gaji tidak valid.", "VALIDATION");

  const userId = String(input.userId || "").trim();
  if (!userId) throw new ApiError("Karyawan wajib dipilih.", "VALIDATION");
  const employee = findById(auth.users, userId);
  if (!employee) throw new ApiError("Karyawan tidak ditemukan.", "VALIDATION");
  const userName = employee.name;

  const duplicate = salaries.filter(function (row) {
    return row.userId === userId && row.period === period && (!existing || row.id !== existing.id);
  })[0];
  if (duplicate) throw new ApiError("Gaji untuk karyawan ini pada periode tersebut sudah ada.", "VALIDATION");

  const base = nonNegativeNumber(input.base);
  const bonus = nonNegativeNumber(input.bonus);
  const deduction = nonNegativeNumber(input.deduction);
  const total = base + bonus - deduction;
  if (total < 0) throw new ApiError("Potongan melebihi total gaji.", "VALIDATION");

  const status = input.status === "dibayar" ? "dibayar" : "belum";
  let paidAt = "";
  if (status === "dibayar") {
    paidAt = String(input.paidAt || (existing && existing.paidAt) || now);
    if (isNaN(new Date(paidAt).getTime())) paidAt = now;
  }

  const saved = {
    id: existing ? existing.id : generateId("sal"),
    period: period,
    userId: userId,
    userName: userName,
    base: base,
    bonus: bonus,
    deduction: deduction,
    total: total,
    status: status,
    paidAt: paidAt,
    note: String(input.note || "").trim(),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  writeRecord(ss, "salaries", saved);
  return saved;
}

function upsertSettings(ss, record) {
  const BOOLEAN_SETTINGS = ["kasAutoEnabled", "receiptShowLogo", "receiptShowTechnician", "autoPrint"];
  const patch = {};
  Object.keys(record).forEach(function (key) {
    if (key === "id" || key === "updatedAt") return;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(key)) {
      throw new ApiError("Nama pengaturan tidak valid: " + key, "VALIDATION");
    }
    if (key === "kasPercent") {
      const percent = Number(record[key]);
      if (!isFinite(percent) || percent < 0 || percent > 100) {
        throw new ApiError("Persentase alokasi kas harus antara 0 dan 100.", "VALIDATION");
      }
      patch[key] = Math.round(percent);
      return;
    }
    if (BOOLEAN_SETTINGS.indexOf(key) >= 0) {
      if (typeof record[key] !== "boolean") {
        throw new ApiError("Nilai pengaturan " + key + " harus berupa boolean.", "VALIDATION");
      }
      patch[key] = record[key];
      return;
    }
    if (key === "logo") {
      const logo = String(record[key] || "");
      if (logo && !/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(logo)) {
        throw new ApiError("Format logo tidak valid. Gunakan PNG, JPG, atau WEBP.", "VALIDATION");
      }
      if (logo.length > MAX_CELL_LENGTH) {
        throw new ApiError("Logo terlalu besar. Gunakan gambar yang lebih sederhana.", "VALIDATION");
      }
      patch[key] = logo;
      return;
    }
    patch[key] = record[key];
  });
  writeSettings(ss, patch);
  return readSettings(ss);
}

function removeUser(ss, id, authUser) {
  const users = readTable(ss, "users");
  const existing = findById(users, id);
  if (!existing) return { removed: false, id: id };
  if (id === authUser.id) throw new ApiError("Anda tidak dapat menghapus akun sendiri.", "FORBIDDEN");
  if (existing.role === "owner" && existing.active !== false) {
    const otherOwner = users.filter(function (row) {
      return row.id !== id && row.role === "owner" && row.active !== false;
    }).length > 0;
    if (!otherOwner) throw new ApiError("Akun owner aktif terakhir tidak dapat dihapus.", "VALIDATION");
  }
  deleteRecord(ss, "users", id);
  revokeUserSessions(id);
  return { removed: true, id: id };
}

function removeCustomer(ss, id) {
  const existing = findById(readTable(ss, "customers"), id);
  if (!existing) return { removed: false, id: id };
  const hasOrders = readTable(ss, "orders").some(function (order) { return order.customerId === id; });
  if (hasOrders) throw new ApiError("Pelanggan masih memiliki riwayat servis dan tidak dapat dihapus.", "VALIDATION");
  deleteRecord(ss, "customers", id);
  return { removed: true, id: id };
}

function removeSupplier(ss, id) {
  const existing = findById(readTable(ss, "suppliers"), id);
  if (!existing) return { removed: false, id: id };
  const hasOrders = readTable(ss, "orders").some(function (order) { return order.supplierId === id; });
  if (hasOrders) throw new ApiError("Supplier masih terkait dengan riwayat servis dan tidak dapat dihapus.", "VALIDATION");
  deleteRecord(ss, "suppliers", id);
  return { removed: true, id: id };
}

function removeOrder(ss, id) {
  const existing = findById(readTable(ss, "orders"), id);
  if (!existing) return { removed: false, id: id };
  const kas = readTable(ss, "kas");
  const linked = kas.filter(function (entry) { return String(entry.orderId || "") === String(id); });
  if (linked.length) {
    const balance = kas.reduce(function (sum, entry) {
      return sum + (entry.type === "in" ? (Number(entry.amount) || 0) : -(Number(entry.amount) || 0));
    }, 0);
    const removing = linked.reduce(function (sum, entry) {
      return sum + (entry.type === "in" ? (Number(entry.amount) || 0) : -(Number(entry.amount) || 0));
    }, 0);
    if (balance - removing < 0) {
      throw new ApiError("Alokasi kas dari tiket ini sudah terpakai. Sesuaikan pengeluaran kas sebelum menghapus tiket.", "VALIDATION");
    }
  }
  deleteRecord(ss, "orders", id);
  const kasSheet = sheetFor(ss, "kas");
  const kasHeaders = getHeaderMap(kasSheet);
  if (kasHeaders.orderId === undefined) return { removed: true, id: id };
  const lastRow = kasSheet.getLastRow();
  if (lastRow < 2) return { removed: true, id: id };
  const values = kasSheet.getRange(2, 1, lastRow - 1, kasSheet.getLastColumn()).getValues();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (String(values[index][kasHeaders.orderId] || "") === id) {
      kasSheet.deleteRow(index + 2);
    }
  }
  return { removed: true, id: id };
}

function removeKas(ss, id) {
  const kas = readTable(ss, "kas");
  const existing = findById(kas, id);
  if (!existing) return { removed: false, id: id };
  if (existing.source !== "manual") {
    throw new ApiError("Alokasi otomatis tidak dapat dihapus. Hapus tiketnya bila alokasi ingin dibatalkan.", "FORBIDDEN");
  }
  if (existing.type === "in") {
    const balance = kas.reduce(function (sum, entry) {
      return sum + (entry.type === "in" ? (Number(entry.amount) || 0) : -(Number(entry.amount) || 0));
    }, 0);
    if (balance - (Number(existing.amount) || 0) < 0) {
      throw new ApiError("Kas masuk ini sudah terpakai. Hapus atau sesuaikan pengeluaran terlebih dahulu.", "VALIDATION");
    }
  }
  deleteRecord(ss, "kas", id);
  return { removed: true, id: id };
}

function removeSalary(ss, id) {
  const existing = findById(readTable(ss, "salaries"), id);
  if (!existing) return { removed: false, id: id };
  deleteRecord(ss, "salaries", id);
  return { removed: true, id: id };
}

/* =====================================================
   Perhitungan
   ===================================================== */

function allocationForOrder(order, auth) {
  const settings = readSettings(auth.ss);
  if (settings.kasAutoEnabled === false) return 0;
  const percent = isFinite(Number(settings.kasPercent)) ? Number(settings.kasPercent) : 10;
  const profit = Math.max((Number(order.total) || 0) - (Number(order.partsCost) || 0), 0);
  return Math.round(profit * percent / 100);
}

function nextTicketNo(orders) {
  const day = Utilities.formatDate(new Date(), getTimeZone(), "yyMMdd");
  const prefix = "SVC-" + day + "-";
  let highest = 0;
  orders.forEach(function (order) {
    const match = String(order.ticketNo || "").match(/^SVC-\d{6}-(\d+)$/);
    if (match) highest = Math.max(highest, Number(match[1]) || 0);
  });
  // Simpan urutan harian agar nomor tiket yang sudah dihapus tidak dipakai ulang.
  const props = PropertiesService.getScriptProperties();
  const key = "TICKET_SEQ_" + day;
  const stored = Number(props.getProperty(key)) || 0;
  const next = Math.max(highest, stored) + 1;
  props.setProperty(key, String(next));
  return prefix + String(next).padStart(3, "0");
}

function nonNegativeNumber(value) {
  const number = Number(value);
  if (!isFinite(number) || number < 0) return 0;
  return number;
}

function localDateOf(value) {
  const date = value ? new Date(value) : new Date();
  if (isNaN(date.getTime())) return todayISO();
  return Utilities.formatDate(date, getTimeZone(), "yyyy-MM-dd");
}

function todayISO() {
  return Utilities.formatDate(new Date(), getTimeZone(), "yyyy-MM-dd");
}

function getTimeZone() {
  return Session.getScriptTimeZone() || "Asia/Jakarta";
}

function sameValue(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined || b === "";
  if (b === null || b === undefined) return a === "";
  if (typeof a === "number" && typeof b === "string") return String(a) === b;
  if (typeof a === "string" && typeof b === "number") return a === String(b);
  return String(a) === String(b);
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}

function generateId(prefix) {
  const stamp = Date.now().toString(36);
  const random = Utilities.getUuid().replace(/-/g, "").slice(0, 10);
  return prefix + "-" + stamp + "-" + random;
}

/* =====================================================
   Spreadsheet & baris data
   ===================================================== */

function getSpreadsheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    if (id) {
      try {
        ss = SpreadsheetApp.openById(id);
      } catch (error) {
        throw new ApiError("Spreadsheet database tidak dapat dibuka. Periksa izin akses script.", "SETUP");
      }
    }
  }
  if (!ss) {
    throw new ApiError("Spreadsheet database belum siap. Jalankan setup() di editor Apps Script.", "SETUP");
  }
  return ss;
}

function getOrCreateSpreadsheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  if (!ss) {
    const id = props.getProperty("SPREADSHEET_ID");
    if (id) {
      try {
        ss = SpreadsheetApp.openById(id);
      } catch (error) {
        ss = null;
      }
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create("ServisPro Database");
    props.setProperty("SPREADSHEET_ID", ss.getId());
    Logger.log("Spreadsheet baru dibuat: " + ss.getUrl());
  } else if (!props.getProperty("SPREADSHEET_ID")) {
    props.setProperty("SPREADSHEET_ID", ss.getId());
  }
  return ss;
}

function sheetFor(ss, table) {
  const sheet = ss.getSheetByName(table);
  if (!sheet) {
    throw new ApiError("Sheet '" + table + "' tidak ditemukan. Jalankan setup() di editor Apps Script.", "SETUP");
  }
  return sheet;
}

function readTable(ss, table) {
  const schema = SHEET_SCHEMAS[table];
  if (!schema) throw new ApiError("Tabel data tidak dikenal.", "BAD_TABLE");
  const sheet = sheetFor(ss, table);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) { return String(header).trim(); });
  const indexMap = {};
  headers.forEach(function (header, index) {
    if (header) indexMap[header] = index;
  });

  const rows = [];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const id = row[indexMap.id];
    if (id === "" || id === null || id === undefined) continue;
    const item = {};
    schema.headers.forEach(function (header) {
      const index = indexMap[header];
      item[header] = index === undefined ? "" : decodeCell(table, header, row[index]);
    });
    item.id = String(item.id).trim();
    rows.push(item);
  }
  return rows;
}

function decodeCell(table, header, value) {
  const schema = SHEET_SCHEMAS[table];
  if (!schema) return value;
  if (schema.json && schema.json.indexOf(header) >= 0) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  if (schema.numbers && schema.numbers.indexOf(header) >= 0) {
    const number = Number(value);
    return isFinite(number) ? number : 0;
  }
  if (schema.booleans && schema.booleans.indexOf(header) >= 0) {
    return value === true || String(value).toLowerCase() === "true" || Number(value) === 1;
  }
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Buang awalan apostrof yang ditambahkan encodeCell untuk menetralkan formula.
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

function writeRecord(ss, table, record) {
  const schema = SHEET_SCHEMAS[table];
  if (!schema) throw new ApiError("Tabel data tidak dikenal.", "BAD_TABLE");
  const sheet = sheetFor(ss, table);
  const headers = getHeaders(sheet);
  const idIndex = headers.indexOf("id");
  if (idIndex < 0) throw new ApiError("Struktur sheet '" + table + "' tidak valid: kolom id tidak ditemukan.", "SETUP");

  let rowIndex = 0;
  let existingRow = [];
  if (record.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).getValues();
      for (let index = 0; index < ids.length; index += 1) {
        if (String(ids[index][0]) === String(record.id)) {
          rowIndex = index + 2;
          break;
        }
      }
      if (rowIndex) {
        existingRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
      }
    }
  }

  const values = headers.map(function (header, columnIndex) {
    if (Object.prototype.hasOwnProperty.call(record, header)) {
      return encodeCell(table, header, record[header]);
    }
    return existingRow[columnIndex] === undefined ? "" : existingRow[columnIndex];
  });

  if (rowIndex) {
    sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
  } else {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length).setValues([values]);
  }
}

function deleteRecord(ss, table, id) {
  const sheet = sheetFor(ss, table);
  const headers = getHeaders(sheet);
  const idIndex = headers.indexOf("id");
  if (idIndex < 0) throw new ApiError("Struktur sheet '" + table + "' tidak valid.", "SETUP");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const ids = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).getValues();
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    if (String(ids[index][0]) === String(id)) {
      sheet.deleteRow(index + 2);
      return true;
    }
  }
  return false;
}

function encodeCell(table, header, value) {
  const schema = SHEET_SCHEMAS[table];
  if (schema.json && schema.json.indexOf(header) >= 0) {
    const text = JSON.stringify(Array.isArray(value) ? value : []);
    assertCellLength(text, header);
    return text;
  }
  if (schema.numbers && schema.numbers.indexOf(header) >= 0) {
    const number = Number(value);
    return isFinite(number) ? number : 0;
  }
  if (schema.booleans && schema.booleans.indexOf(header) >= 0) {
    return value === true;
  }
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  assertCellLength(text, header);
  return text.replace(/^[=+@-]/, function (character) { return "'" + character; });
}

function assertCellLength(value, header) {
  if (String(value).length > MAX_CELL_LENGTH) {
    throw new ApiError("Nilai kolom " + header + " terlalu panjang untuk Google Sheets.", "VALIDATION");
  }
}

function getHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function (header) { return String(header).trim(); });
}

function getHeaderMap(sheet) {
  const map = {};
  getHeaders(sheet).forEach(function (header, index) {
    if (header) map[header] = index;
  });
  return map;
}

function findById(rows, id) {
  const target = String(id);
  return rows.filter(function (row) { return String(row.id) === target; })[0] || null;
}

/* =====================================================
   Settings
   ===================================================== */

function readSettings(ss) {
  const settings = { id: "company" };
  const sheet = ss.getSheetByName("settings");
  if (!sheet || sheet.getLastRow() < 2) return settings;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) { return String(header).trim().toLowerCase(); });
  const keyIndex = headers.indexOf("key");
  const valueIndex = headers.indexOf("value");
  if (keyIndex < 0 || valueIndex < 0) return settings;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const key = String(values[rowIndex][keyIndex] || "").trim();
    if (!key || key === "id") continue;
    const raw = values[rowIndex][valueIndex];
    if (raw instanceof Date) {
      settings[key] = raw.toISOString();
    } else if (typeof raw !== "string") {
      settings[key] = raw;
    } else if (raw === "") {
      settings[key] = "";
    } else {
      try {
        settings[key] = JSON.parse(raw);
      } catch (error) {
        settings[key] = raw;
      }
    }
  }
  return settings;
}

function writeSettings(ss, patch) {
  const sheet = sheetFor(ss, "settings");
  const keys = Object.keys(patch);
  const headers = getHeaders(sheet);
  const keyIndex = headers.indexOf("key");
  const valueIndex = headers.indexOf("value");
  if (keyIndex < 0 || valueIndex < 0) {
    throw new ApiError("Struktur sheet settings tidak valid. Jalankan setup() kembali.", "SETUP");
  }

  const lastRow = sheet.getLastRow();
  const keyRows = lastRow >= 2
    ? sheet.getRange(2, keyIndex + 1, lastRow - 1, 1).getValues()
    : [];
  const rowMap = {};
  keyRows.forEach(function (row, index) {
    const key = String(row[0] || "").trim();
    if (key) rowMap[key] = index + 2;
  });

  keys.forEach(function (key) {
    if (key === "id") return;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(key)) {
      throw new ApiError("Nama pengaturan tidak valid: " + key, "VALIDATION");
    }
    const serialized = JSON.stringify(patch[key] === undefined ? null : patch[key]);
    assertCellLength(serialized, key);
    if (rowMap[key]) {
      sheet.getRange(rowMap[key], valueIndex + 1).setValue(serialized);
    } else {
      const row = sheet.getLastRow() + 1;
      sheet.getRange(row, keyIndex + 1).setValue(key);
      sheet.getRange(row, valueIndex + 1).setValue(serialized);
      rowMap[key] = row;
    }
  });

  const updatedAt = new Date().toISOString();
  if (rowMap.updatedAt) {
    sheet.getRange(rowMap.updatedAt, valueIndex + 1).setValue(JSON.stringify(updatedAt));
  } else {
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, keyIndex + 1).setValue("updatedAt");
    sheet.getRange(row, valueIndex + 1).setValue(JSON.stringify(updatedAt));
  }
}

/* =====================================================
   Password
   ===================================================== */

function createPasswordRecord(password) {
  const salt = randomHex(16);
  return { salt: salt, hash: hashPassword(password, salt) };
}

function hashPassword(password, salt) {
  const pepper = getPasswordPepper();
  let digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ":" + password + ":" + pepper,
    Utilities.Charset.UTF_8
  );
  for (let index = 0; index < 250; index += 1) {
    digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, digest);
  }
  return bytesToHex(digest);
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const actual = hashPassword(password, salt);
  if (actual.length !== String(expectedHash).length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) {
    mismatch |= actual.charCodeAt(index) ^ String(expectedHash).charCodeAt(index);
  }
  return mismatch === 0;
}

function getPasswordPepper() {
  const props = PropertiesService.getScriptProperties();
  let pepper = props.getProperty("PASSWORD_PEPPER");
  if (!pepper) {
    pepper = randomHex(32);
    props.setProperty("PASSWORD_PEPPER", pepper);
  }
  return pepper;
}

function randomHex(byteLength) {
  let text = "";
  while (text.length < byteLength * 2) {
    text += Utilities.getUuid().replace(/-/g, "");
  }
  return text.slice(0, byteLength * 2);
}

function sha256Hex(value) {
  return bytesToHex(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  ));
}

function bytesToHex(bytes) {
  return bytes.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return (value < 16 ? "0" : "") + value.toString(16);
  }).join("");
}

/* =====================================================
   Setup & pemulihan
   ===================================================== */

function setup() {
  const ss = getOrCreateSpreadsheet();
  ss.setSpreadsheetTimeZone("Asia/Jakarta");
  ensureSheets(ss);
  getPasswordPepper();

  const existingSettings = readSettings(ss);
  const patch = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    if (existingSettings[key] === undefined) patch[key] = DEFAULT_SETTINGS[key];
  });
  writeSettings(ss, patch);

  const users = readTable(ss, "users");
  if (!users.length) {
    const props = PropertiesService.getScriptProperties();
    const ownerUsername = normalizeUsername(props.getProperty("SETUP_OWNER_USERNAME") || "owner");
    const ownerPassword = String(props.getProperty("SETUP_OWNER_PASSWORD") || "owner123");
    const staff = [
      { id: "u-owner", name: "Owner ServisPro", username: ownerUsername, password: ownerPassword, role: "owner", salary: 0 },
      { id: "u-kasir", name: "Kasir ServisPro", username: "kasir", password: "kasir123", role: "kasir", salary: 0 },
      { id: "u-teknisi", name: "Teknisi ServisPro", username: "teknisi", password: "teknisi123", role: "teknisi", salary: 0 },
      { id: "u-pramugari", name: "Front Desk ServisPro", username: "pramugari", password: "pramugari123", role: "pramugari", salary: 0 },
    ];
    const now = new Date().toISOString();
    staff.forEach(function (account) {
      const passwordRecord = createPasswordRecord(account.password);
      writeRecord(ss, "users", {
        id: account.id,
        name: account.name,
        username: account.username,
        passwordHash: passwordRecord.hash,
        salt: passwordRecord.salt,
        role: account.role,
        phone: "",
        email: "",
        salary: account.salary,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    });
    Logger.log("Akun awal dibuat: " + staff.map(function (account) {
      return account.username + " / " + account.password;
    }).join(", "));
  }

  const activeOwners = readTable(ss, "users").filter(function (user) {
    return user.role === "owner" && user.active !== false;
  }).length;
  if (!activeOwners) {
    Logger.log("PERINGATAN: tidak ada akun owner aktif. Jalankan resetPassword() atau tambahkan owner di sheet users.");
  }

  const message = "Setup ServisPro selesai.\n"
    + "Spreadsheet: " + ss.getUrl() + "\n"
    + "Akun awal: owner / owner123, kasir / kasir123, teknisi / teknisi123, pramugari / pramugari123.\n"
    + "SEGERA ganti password default melalui Pengaturan > Akun & akses atau resetPassword().\n"
    + "Langkah berikutnya: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).";
  Logger.log(message);
  console.log(message);
  return message;
}

function ensureSheets(ss) {
  Object.keys(SHEET_SCHEMAS).forEach(function (table) {
    let sheet = ss.getSheetByName(table);
    if (!sheet) sheet = ss.insertSheet(table);
    ensureHeaders(sheet, SHEET_SCHEMAS[table].headers);
    styleHeader(sheet, SHEET_SCHEMAS[table].headers.length);
    (TEXT_COLUMNS[table] || []).forEach(function (header) {
      const index = getHeaders(sheet).indexOf(header) + 1;
      if (!index) return;
      sheet.getRange(2, index, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
    });
    if (table === "users") {
      const headers = getHeaders(sheet);
      ["passwordHash", "salt"].forEach(function (header) {
        const index = headers.indexOf(header) + 1;
        if (!index) return;
        try {
          if (!sheet.isColumnHiddenByUser(index)) sheet.hideColumns(index);
        } catch (error) {
          try { sheet.hideColumns(index); } catch (ignored) {}
        }
      });
    }
  });

  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
}

function ensureHeaders(sheet, requiredHeaders) {
  const lastColumn = sheet.getLastColumn();
  const current = lastColumn >= 1 && sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (value) { return String(value).trim(); })
    : [];
  const hasContent = current.some(function (value) { return value !== ""; });
  if (!hasContent) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return;
  }
  const missing = requiredHeaders.filter(function (header) { return current.indexOf(header) < 0; });
  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
}

function styleHeader(sheet, columnCount) {
  const range = sheet.getRange(1, 1, 1, columnCount);
  range.setFontWeight("bold").setFontColor("#ffffff").setBackground("#0d9488");
  sheet.setFrozenRows(1);
}

function resetPassword(username, passwordBaru) {
  const normalized = normalizeUsername(username);
  const password = String(passwordBaru === undefined ? "" : passwordBaru);
  if (!normalized) throw new Error("Username wajib diisi.");
  if (password.length < 6) throw new Error("Password baru minimal 6 karakter.");

  const ss = getSpreadsheet();
  const users = readTable(ss, "users");
  const user = users.filter(function (row) { return normalizeUsername(row.username) === normalized; })[0];
  if (!user) throw new Error("Username @" + normalized + " tidak ditemukan.");

  const passwordRecord = createPasswordRecord(password);
  writeRecord(ss, "users", Object.assign({}, user, {
    passwordHash: passwordRecord.hash,
    salt: passwordRecord.salt,
    updatedAt: new Date().toISOString(),
  }));
  revokeUserSessions(user.id);
  const message = "Password @" + normalized + " berhasil direset. Semua sesi pengguna tersebut telah diakhiri.";
  Logger.log(message);
  return message;
}

function revokeAllSessions() {
  const props = PropertiesService.getScriptProperties();
  let count = 0;
  props.getKeys().forEach(function (key) {
    if (key.indexOf("session_") === 0) {
      props.deleteProperty(key);
      count += 1;
    }
  });
  const message = count + " sesi dihapus. Semua pengguna harus login kembali.";
  Logger.log(message);
  return message;
}
