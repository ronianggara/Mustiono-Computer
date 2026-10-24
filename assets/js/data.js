/* =========================================================
   ServisPro — data layer
   Mode demo: localStorage. Mode cloud: Google Apps Script + Sheets.
   ========================================================= */
(function () {
  "use strict";

  const KEYS = {
    db: "servispro_db_v1",
    api: "servispro_api_url_v1",
    token: "servispro_token_v1",
    session: "servispro_session_v1",
    appearance: "servispro_appearance_v1",
  };

  const DB_VERSION = 1;

  const DEFAULT_SETTINGS = {
    id: "company",
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
    updatedAt: "",
  };

  function blankData() {
    return {
      users: [],
      suppliers: [],
      customers: [],
      orders: [],
      kas: [],
      salaries: [],
      settings: { ...DEFAULT_SETTINGS },
    };
  }

  function mergeSettings(settings) {
    return { ...DEFAULT_SETTINGS, ...(settings || {}) };
  }

  function isoAt(daysAgo, time) {
    const date = U.addDays(U.todayISO(), -Number(daysAgo || 0));
    const [h, m] = String(time || "09:00").split(":").map(Number);
    return new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).toISOString();
  }

  function ticketFor(daysAgo, seq) {
    const date = U.addDays(U.todayISO(), -Number(daysAgo || 0));
    return `SVC-${date.slice(2).replace(/-/g, "")}-${String(seq).padStart(3, "0")}`;
  }

  function createSeed() {
    const now = U.nowISO();
    const today = U.todayISO();
    const thisMonth = U.currentMonth();
    const prevMonth = U.shiftMonth(thisMonth, -1);
    const prevRange = U.monthRange(prevMonth);

    const settings = mergeSettings({
      id: "company",
      updatedAt: now,
    });

    const users = [
      {
        id: "u-owner", name: "Budi Santoso", username: "owner", password: "owner123",
        role: "owner", phone: "0812-1111-2200", email: "budi@servispro.id",
        salary: 0, active: true, createdAt: isoAt(300, "09:00"), updatedAt: now,
      },
      {
        id: "u-kasir", name: "Siti Rahma", username: "kasir", password: "kasir123",
        role: "kasir", phone: "0812-1111-2201", email: "siti@servispro.id",
        salary: 3200000, active: true, createdAt: isoAt(260, "09:00"), updatedAt: now,
      },
      {
        id: "u-tech1", name: "Andi Pratama", username: "teknisi", password: "teknisi123",
        role: "teknisi", phone: "0812-1111-2202", email: "andi@servispro.id",
        salary: 3500000, active: true, createdAt: isoAt(250, "09:00"), updatedAt: now,
      },
      {
        id: "u-tech2", name: "Rizky Kurniawan", username: "rizky", password: "teknisi123",
        role: "teknisi", phone: "0812-1111-2203", email: "rizky@servispro.id",
        salary: 3000000, active: true, createdAt: isoAt(180, "09:00"), updatedAt: now,
      },
      {
        id: "u-front", name: "Dewi Lestari", username: "pramugari", password: "pramugari123",
        role: "pramugari", phone: "0812-1111-2204", email: "dewi@servispro.id",
        salary: 2800000, active: true, createdAt: isoAt(150, "09:00"), updatedAt: now,
      },
    ];

    const suppliers = [
      {
        id: "sup-01", name: "CV Sumber Komputer", contact: "Rudi Hartono",
        phone: "021-555-0188", email: "sales@sumberkomputer.id",
        address: "Mangga Dua Mall Lt. 3 No. 21, Jakarta Utara",
        notes: "Sparepart laptop & PC. Termin 14 hari untuk pembelian di atas Rp 2 juta.",
        createdAt: isoAt(240, "10:00"), updatedAt: now,
      },
      {
        id: "sup-02", name: "Toko Gadget Central", contact: "Fenny",
        phone: "0813-8899-1122", email: "fenny@gadgetcentral.id",
        address: "ITC Roxy Mas Lt. 2 No. 105, Jakarta Pusat",
        notes: "Sparepart HP original dan OEM. Stok LCD iPhone & Samsung lengkap.",
        createdAt: isoAt(220, "10:30"), updatedAt: now,
      },
      {
        id: "sup-03", name: "PT Prima Printer", contact: "Hendra Wijaya",
        phone: "021-744-0022", email: "order@primaprinter.co.id",
        address: "Jl. Panjang Arteri No. 17, Jakarta Barat",
        notes: "Tinta, head printer, dan sparepart Epson/Canon.",
        createdAt: isoAt(200, "11:00"), updatedAt: now,
      },
      {
        id: "sup-04", name: "Eternal Tools Supply", contact: "Mega",
        phone: "0812-9090-4455", email: "mega@eternaltools.id",
        address: "Rawamangun, Jakarta Timur",
        notes: "Peralatan servis, obeng presisi, dan consumable bengkel.",
        createdAt: isoAt(150, "09:30"), updatedAt: now,
      },
    ];

    const customers = [
      {
        id: "cus-01", name: "Rina Wijaya", phone: "0812-3344-5566", email: "rina.wijaya@email.com",
        address: "Jl. Kebon Jeruk Raya No. 12, Jakarta Barat", notes: "Pelanggan langganan, sering servis laptop.",
        createdAt: isoAt(190, "10:00"), updatedAt: now,
      },
      {
        id: "cus-02", name: "Hendra Gunawan", phone: "0813-7788-9900", email: "hendra.g@email.com",
        address: "Jl. Fatmawati No. 44, Jakarta Selatan", notes: "",
        createdAt: isoAt(140, "11:00"), updatedAt: now,
      },
      {
        id: "cus-03", name: "Maya Putri", phone: "0857-2211-3344", email: "maya.putri@email.com",
        address: "Kemang Raya No. 9, Jakarta Selatan", notes: "Lebih nyaman dihubungi via WhatsApp.",
        createdAt: isoAt(120, "14:00"), updatedAt: now,
      },
      {
        id: "cus-04", name: "Fajar Nugroho", phone: "0821-9988-1122", email: "fajar.n@email.com",
        address: "Jl. Senopati No. 31, Jakarta Selatan", notes: "",
        createdAt: isoAt(100, "09:30"), updatedAt: now,
      },
      {
        id: "cus-05", name: "Lina Marlina", phone: "0819-7766-5544", email: "lina.m@email.com",
        address: "Jl. Panglima Polim IX No. 7, Jakarta Selatan", notes: "",
        createdAt: isoAt(95, "13:00"), updatedAt: now,
      },
      {
        id: "cus-06", name: "Agus Setiawan", phone: "0811-1234-5566", email: "agus.s@email.com",
        address: "Jl. Wijaya II No. 18, Jakarta Selatan", notes: "Minta garansi ditulis di nota.",
        createdAt: isoAt(80, "10:15"), updatedAt: now,
      },
      {
        id: "cus-07", name: "PT Karya Digital", phone: "021-722-3344", email: "it@karyadigital.co.id",
        address: "Gedung Cyber 2, Jl. HR Rasuna Said, Jakarta Selatan",
        notes: "Klien korporat. Semua servis gunakan PO dan invoice resmi.",
        createdAt: isoAt(75, "09:00"), updatedAt: now,
      },
      {
        id: "cus-08", name: "Sari Dewi", phone: "0812-5566-7788", email: "sari.dewi@email.com",
        address: "Jl. Bangka VIII No. 5, Jakarta Selatan", notes: "",
        createdAt: isoAt(60, "11:30"), updatedAt: now,
      },
      {
        id: "cus-09", name: "Dedi Kurniawan", phone: "0877-3344-2211", email: "dedi.k@email.com",
        address: "Jl. Pela Mampang No. 19, Jakarta Selatan", notes: "Walk-in hari ini.",
        createdAt: isoAt(0, "09:35"), updatedAt: now,
      },
      {
        id: "cus-10", name: "Bambang Hartono", phone: "0813-4444-8899", email: "bambang.h@email.com",
        address: "Jl. Cipete Raya No. 2, Jakarta Selatan", notes: "",
        createdAt: isoAt(45, "10:00"), updatedAt: now,
      },
      {
        id: "cus-11", name: "Nur Aini", phone: "0856-7788-2233", email: "nur.aini@email.com",
        address: "Jl. Ampera Raya No. 10, Jakarta Selatan", notes: "",
        createdAt: isoAt(38, "15:00"), updatedAt: now,
      },
      {
        id: "cus-12", name: "Intan Permata", phone: "0821-1122-9090", email: "intan.p@email.com",
        address: "Jl. Bumi Manti No. 3, Jakarta Selatan", notes: "",
        createdAt: isoAt(0, "10:05"), updatedAt: now,
      },
    ];

    const ordersRaw = [
      {
        id: "ord-1001", daysAgo: 0, seq: 1, customerId: "cus-01", deviceType: "hp",
        brand: "Apple", model: "iPhone 12", serial: "FFD9H2X1Q1GQ", accessories: "Casing, SIM tray",
        complaint: "Layar blank namun perangkat masih bergetar saat dinyalakan.",
        condition: "Body mulus, terdapat retak halus di sudut kanan layar.",
        diagnosis: "IC display bermasalah, perlu penggantian LCD original.",
        technicianId: "u-tech1", supplierId: "sup-02", estimateCost: 900000,
        partsCost: 650000, serviceCost: 300000, status: "diambil", paymentStatus: "lunas",
        paymentMethod: "cash", paidDaysAgo: 0, paidTime: "11:20", createdTime: "08:30",
        estimatedDone: today, note: "Pelanggan setuju perbaikan via WhatsApp.",
        createdBy: "Dewi Lestari",
      },
      {
        id: "ord-1002", daysAgo: 0, seq: 2, customerId: "cus-09", deviceType: "pc",
        brand: "Rakit Sendiri", model: "Custom i5-10400", serial: "PC-RK-0923",
        accessories: "Kabel power",
        complaint: "PC tidak mau menyala, tidak ada respons saat tombol power ditekan.",
        condition: "Casing bersih, belum dibuka.",
        diagnosis: "", technicianId: "u-tech2", supplierId: "", estimateCost: 350000,
        partsCost: 0, serviceCost: 0, status: "masuk", paymentStatus: "belum",
        createdAtTime: "09:40", estimatedDone: U.addDays(today, 2),
        note: "Perlu cek PSU dan motherboard.", createdBy: "Dewi Lestari",
      },
      {
        id: "ord-1003", daysAgo: 0, seq: 3, customerId: "cus-03", deviceType: "printer",
        brand: "Epson", model: "L3110", serial: "X6N7102931", accessories: "Kabel USB, adaptor",
        complaint: "Hasil cetak bergaris dan warna tidak keluar sejak tinta diganti.",
        condition: "Ada tumpahan tinta di area head.",
        diagnosis: "", technicianId: "u-tech1", supplierId: "sup-03", estimateCost: 250000,
        partsCost: 0, serviceCost: 0, status: "diagnosa", paymentStatus: "belum",
        createdAtTime: "10:20", estimatedDone: today,
        note: "Head perlu dibersihkan dan dicek tekanan udara.", createdBy: "Siti Rahma",
      },
      {
        id: "ord-1004", daysAgo: 1, seq: 1, customerId: "cus-02", deviceType: "laptop",
        brand: "ASUS", model: "ROG Strix G15", serial: "ASN-G15-8821", accessories: "Charger, tas",
        complaint: "Beberapa tombol keyboard tidak berfungsi setelah kena minuman.",
        condition: "Ada sisa cairan lengket di area keyboard.",
        diagnosis: "Keyboard membrane rusak, perlu penggantian unit.",
        technicianId: "u-tech2", supplierId: "sup-01", estimateCost: 500000,
        partsCost: 180000, serviceCost: 250000, status: "proses", paymentStatus: "belum",
        createdAtTime: "13:15", estimatedDone: U.addDays(today, 1),
        note: "Menunggu konfirmasi biaya dari pelanggan.", createdBy: "Siti Rahma",
      },
      {
        id: "ord-1005", daysAgo: 1, seq: 2, customerId: "cus-05", deviceType: "laptop",
        brand: "Lenovo", model: "IdeaPad Slim 3", serial: "LEN-IP3-3302", accessories: "Charger",
        complaint: "Laptop hanya hidup saat terhubung charger, baterai tidak mengisi.",
        condition: "Baterai mengembung ringan.",
        diagnosis: "Baterai sudah aus, penggantian baterai baru.",
        technicianId: "u-tech1", supplierId: "sup-01", estimateCost: 650000,
        partsCost: 450000, serviceCost: 150000, status: "diambil", paymentStatus: "lunas",
        paymentMethod: "transfer", paidDaysAgo: 1, paidTime: "16:00", createdTime: "09:10",
        estimatedDone: today, note: "Garansi baterai 1 bulan.", createdBy: "Dewi Lestari",
      },
      {
        id: "ord-1006", daysAgo: 0, seq: 4, customerId: "cus-06", deviceType: "hp",
        brand: "Samsung", model: "Galaxy A52", serial: "SM-A52-7712", accessories: "Casing",
        complaint: "Layar pecah setelah terjatuh, touchscreen tidak responsif.",
        condition: "Layar retak parah, body lecet.",
        diagnosis: "Penggantian LCD assembly.",
        technicianId: "u-tech1", supplierId: "sup-02", estimateCost: 1200000,
        partsCost: 800000, serviceCost: 350000, status: "selesai", paymentStatus: "lunas",
        paymentMethod: "cash", paidDaysAgo: 0, paidTime: "13:05", createdTime: "10:45",
        estimatedDone: today, note: "Sudah lunas, perangkat menunggu diambil.",
        createdBy: "Dewi Lestari",
      },
      {
        id: "ord-1007", daysAgo: 3, seq: 1, customerId: "cus-07", deviceType: "printer",
        brand: "Canon", model: "imageRUNNER 2206", serial: "CN-IR2206-441", accessories: "Kabel power",
        complaint: "Printer sering paper jam dan hasil cetak kotor.",
        condition: "Unit di kantor klien, dilakukan maintenance on-site.",
        diagnosis: "Roller kertas aus, dibersihkan dan disetel ulang.",
        technicianId: "u-tech2", supplierId: "sup-03", estimateCost: 800000,
        partsCost: 0, serviceCost: 750000, status: "diambil", paymentStatus: "lunas",
        paymentMethod: "transfer", paidDaysAgo: 3, paidTime: "15:30", createdTime: "09:00",
        estimatedDone: today, note: "Servis on-site, sudah selesai dan diambil pelanggan.",
        createdBy: "Siti Rahma",
      },
      {
        id: "ord-1008", daysAgo: 6, seq: 1, customerId: "cus-01", deviceType: "laptop",
        brand: "Acer", model: "Aspire 5", serial: "ACR-A5-9921", accessories: "Charger",
        complaint: "Laptop sangat lambat saat membuka aplikasi dan menyimpan file.",
        condition: "Sistem masih berjalan normal, kapasitas disk hampir penuh.",
        diagnosis: "Upgrade SSD NVMe 512GB dan clone sistem.",
        technicianId: "u-tech2", supplierId: "sup-01", estimateCost: 800000,
        partsCost: 550000, serviceCost: 200000, status: "diambil", paymentStatus: "lunas",
        paymentMethod: "cash", paidDaysAgo: 6, paidTime: "14:10", createdTime: "09:20",
        estimatedDone: U.addDays(today, -5), note: "Pelanggan minta data tetap utuh.",
        createdBy: "Dewi Lestari",
      },
      {
        id: "ord-1009", daysAgo: 2, seq: 1, customerId: "cus-02", deviceType: "hp",
        brand: "Xiaomi", model: "Redmi Note 10", serial: "MI-RN10-5541", accessories: "Casing",
        complaint: "Baterai cepat habis dan perangkat sering mati sendiri.",
        condition: "Body mulus, baterai terdeteksi health 68%.",
        diagnosis: "Penggantian baterai original.",
        technicianId: "u-tech1", supplierId: "sup-02", estimateCost: 350000,
        partsCost: 150000, serviceCost: 150000, status: "diambil", paymentStatus: "lunas",
        paymentMethod: "cash", paidDaysAgo: 2, paidTime: "17:20", createdTime: "11:30",
        estimatedDone: U.addDays(today, -1), note: "", createdBy: "Siti Rahma",
      },
      {
        id: "ord-1010", daysAgo: 4, seq: 1, customerId: "cus-03", deviceType: "laptop",
        brand: "HP", model: "Pavilion 14", serial: "HP-PV14-2201", accessories: "Charger",
        complaint: "Laptop lemot dan kipas berisik.",
        condition: "Debu tebal pada bagian ventilasi.",
        diagnosis: "Perlu cleaning dan upgrade RAM. Pelanggan menunda perbaikan.",
        technicianId: "u-tech1", supplierId: "", estimateCost: 300000,
        partsCost: 0, serviceCost: 0, status: "batal", paymentStatus: "belum",
        createdAtTime: "15:00", estimatedDone: U.addDays(today, -2),
        note: "Pelanggan membatalkan servis karena akan membeli perangkat baru.",
        createdBy: "Dewi Lestari",
      },
      {
        id: "ord-1011", daysAgo: 5, seq: 1, customerId: "cus-08", deviceType: "pc",
        brand: "Rakit Sendiri", model: "Ryzen 5 5600G", serial: "PC-RZ-1102", accessories: "Kabel power, HDMI",
        complaint: "PC sering blue screen saat digunakan untuk desain.",
        condition: "RAM terpasang dua keping, salah satu tidak terdeteksi.",
        diagnosis: "Penggantian RAM 16GB dan pembersihan sistem.",
        technicianId: "u-tech2", supplierId: "sup-01", estimateCost: 1250000,
        partsCost: 500000, serviceCost: 600000, status: "diambil", paymentStatus: "lunas",
        paymentMethod: "qris", paidDaysAgo: 5, paidTime: "12:45", createdTime: "08:45",
        estimatedDone: U.addDays(today, -4), note: "Sudah dites stres 2 jam, stabil.",
        createdBy: "Siti Rahma",
      },
      {
        id: "ord-1012", daysAgo: 0, seq: 5, customerId: "cus-04", deviceType: "pc",
        brand: "Rakit Sendiri", model: "Intel i3-9100F", serial: "PC-FJ-7721", accessories: "Kabel power",
        complaint: "Monitor tidak menampilkan gambar meski PC menyala.",
        condition: "Fan berputar, tidak ada bunyi beep.",
        diagnosis: "", technicianId: "u-tech2", supplierId: "", estimateCost: 400000,
        partsCost: 0, serviceCost: 0, status: "menunggu", paymentStatus: "belum",
        createdAtTime: "11:10", estimatedDone: U.addDays(today, 2),
        note: "Menunggu persetujuan cek VGA dan RAM.", createdBy: "Dewi Lestari",
      },
      {
        id: "ord-1013", daysAgo: 8, seq: 1, customerId: "cus-10", deviceType: "laptop",
        brand: "Dell", model: "Latitude 5420", serial: "DELL-5420-118", accessories: "Charger",
        complaint: "Laptop tidak dapat terhubung ke WiFi kantor.",
        condition: "Driver WiFi bermasalah setelah update Windows.",
        diagnosis: "Instalasi ulang driver dan reset konfigurasi jaringan.",
        technicianId: "u-tech1", supplierId: "", estimateCost: 300000,
        partsCost: 300000, serviceCost: 250000, status: "diambil", paymentStatus: "lunas",
        paymentMethod: "transfer", paidDaysAgo: 8, paidTime: "16:40", createdTime: "13:20",
        estimatedDone: U.addDays(today, -7), note: "", createdBy: "Siti Rahma",
      },
      {
        id: "ord-1014", daysAgo: 12, seq: 1, customerId: "cus-11", deviceType: "hp",
        brand: "OPPO", model: "Reno 6", serial: "OP-R6-9901", accessories: "Charger, casing",
        complaint: "Kamera belakang buram dan tidak bisa fokus.",
        condition: "Lensa kamera tergores.",
        diagnosis: "Penggantian modul kamera belakang.",
        technicianId: "u-tech1", supplierId: "sup-02", estimateCost: 450000,
        partsCost: 220000, serviceCost: 180000, status: "diambil", paymentStatus: "lunas",
        paymentMethod: "cash", paidDaysAgo: 12, paidTime: "11:15", createdTime: "09:40",
        estimatedDone: U.addDays(today, -11), note: "", createdBy: "Dewi Lestari",
      },
      {
        id: "ord-1015", daysAgo: 1, seq: 3, customerId: "cus-04", deviceType: "printer",
        brand: "Canon", model: "PIXMA G2010", serial: "CN-G2010-662", accessories: "Kabel power",
        complaint: "Printer tidak mengeluarkan tinta hitam.",
        condition: "Tabung tinta hitam terisi namun tersumbat.",
        diagnosis: "Pembersihan head dan penggantian selang tinta.",
        technicianId: "u-tech1", supplierId: "sup-03", estimateCost: 350000,
        partsCost: 120000, serviceCost: 200000, status: "selesai", paymentStatus: "belum",
        createdAtTime: "14:30", estimatedDone: today,
        note: "Sudah selesai, pelanggan akan membayar saat mengambil.", createdBy: "Siti Rahma",
      },
      {
        id: "ord-1016", daysAgo: 0, seq: 6, customerId: "cus-12", deviceType: "laptop",
        brand: "HP", model: "Envy 13", serial: "HP-ENVY-119", accessories: "Charger, sleeve",
        complaint: "Layar berkedip saat kecerahan dinaikkan.",
        condition: "Fleksibel layar perlu dicek.",
        diagnosis: "", technicianId: "", supplierId: "", estimateCost: 300000,
        partsCost: 0, serviceCost: 0, status: "masuk", paymentStatus: "belum",
        createdAtTime: "10:05", estimatedDone: U.addDays(today, 2),
        note: "Belum mendapat teknisi.", createdBy: "Dewi Lestari",
      },
    ];

    const statusNotes = {
      masuk: "Perangkat diterima dan dicatat oleh front desk.",
      diagnosa: "Pemeriksaan awal oleh teknisi dimulai.",
      menunggu: "Estimasi biaya menunggu konfirmasi pelanggan.",
      proses: "Pengerjaan perbaikan sedang berlangsung.",
      selesai: "Pengerjaan selesai dan perangkat siap diambil.",
      diambil: "Perangkat telah diserahkan kepada pelanggan.",
      batal: "Servis dibatalkan oleh pelanggan.",
    };

    const orders = ordersRaw.map((raw) => {
      const createdTime = raw.createdTime || raw.createdAtTime || "09:00";
      const createdAt = isoAt(raw.daysAgo, createdTime);
      const tech = users.find((u) => u.id === raw.technicianId);
      const customer = customers.find((c) => c.id === raw.customerId);
      const supplier = suppliers.find((s) => s.id === raw.supplierId);
      const total = (Number(raw.partsCost) || 0) + (Number(raw.serviceCost) || 0);
      const base = new Date(createdAt);
      const flow = raw.status === "batal"
        ? ["masuk", "diagnosa", "batal"]
        : U.STATUS_FLOW.slice(0, U.STATUS_FLOW.indexOf(raw.status) + 1);
      const history = flow.map((status, index) => {
        const at = new Date(base.getTime() + index * 42 * 60000).toISOString();
        const by = ["diagnosa", "proses", "selesai"].includes(status) && tech
          ? tech.name
          : (raw.createdBy || "Front Desk");
        return {
          status,
          at,
          by,
          note: status === "diagnosa" && raw.diagnosis ? raw.diagnosis : statusNotes[status],
        };
      });
      const paidAt = raw.paymentStatus === "lunas"
        ? isoAt(raw.paidDaysAgo != null ? raw.paidDaysAgo : raw.daysAgo, raw.paidTime || "14:00")
        : "";
      return {
        id: raw.id,
        ticketNo: ticketFor(raw.daysAgo, raw.seq),
        customerId: raw.customerId,
        customerName: customer ? customer.name : "Pelanggan",
        customerPhone: customer ? customer.phone : "",
        deviceType: raw.deviceType,
        brand: raw.brand,
        model: raw.model,
        serial: raw.serial || "",
        accessories: raw.accessories || "",
        complaint: raw.complaint || "",
        condition: raw.condition || "",
        diagnosis: raw.diagnosis || "",
        technicianId: raw.technicianId || "",
        technicianName: tech ? tech.name : "",
        supplierId: raw.supplierId || "",
        supplierName: supplier ? supplier.name : "",
        estimateCost: Number(raw.estimateCost) || 0,
        partsCost: Number(raw.partsCost) || 0,
        serviceCost: Number(raw.serviceCost) || 0,
        total,
        status: raw.status,
        paymentStatus: raw.paymentStatus,
        paymentMethod: raw.paymentMethod || "",
        paidAt,
        estimatedDone: raw.estimatedDone || "",
        note: raw.note || "",
        history,
        createdAt,
        createdBy: raw.createdBy || "Front Desk",
        updatedAt: history.length ? history[history.length - 1].at : createdAt,
        kasAllocated: false,
        kasAllocatedAmount: 0,
      };
    });

    const kas = [
      {
        id: "kas-001", date: U.monthRange(thisMonth).start, type: "in",
        category: "Saldo Awal", description: "Saldo awal kas kecil periode berjalan",
        amount: 500000, source: "manual", orderId: "", items: [], reference: "Kasir",
        createdBy: "Budi Santoso", createdAt: isoAt(20, "08:00"),
      },
    ];

    const paidOrders = orders.filter((o) => o.paymentStatus === "lunas");
    if (settings.kasAutoEnabled) {
      paidOrders.forEach((order, index) => {
        const amount = U.kasAllocationFor(order, settings.kasPercent);
        if (amount <= 0) return;
        order.kasAllocated = true;
        order.kasAllocatedAmount = amount;
        kas.push({
          id: `kas-auto-${index + 1}`,
          date: U.dateOf(order.paidAt),
          type: "in",
          category: "Alokasi Laba",
          description: `Alokasi otomatis laba ${order.ticketNo}`,
          amount,
          source: "otomatis",
          orderId: order.id,
          items: [],
          reference: order.ticketNo,
          createdBy: "Sistem",
          createdAt: order.paidAt,
        });
      });
    }

    kas.push(
      {
        id: "kas-002", date: U.addDays(today, -5), type: "out",
        category: "Pembelian Operasional", description: "Pembelian toolset obeng presisi",
        amount: 120000, source: "manual", orderId: "",
        items: [{ name: "Obeng presisi 25 in 1", qty: 1, unitPrice: 120000 }],
        reference: "Nota ET-1029", createdBy: "Budi Santoso", createdAt: isoAt(5, "10:20"),
      },
      {
        id: "kas-003", date: U.addDays(today, -3), type: "out",
        category: "Pembelian Operasional", description: "Pembelian tinta & kertas nota",
        amount: 85000, source: "manual", orderId: "",
        items: [
          { name: "Tinta Epson 003 hitam", qty: 2, unitPrice: 30000 },
          { name: "Kertas struk 80mm", qty: 1, unitPrice: 25000 },
        ],
        reference: "Nota PP-8821", createdBy: "Budi Santoso", createdAt: isoAt(3, "11:35"),
      },
      {
        id: "kas-004", date: U.addDays(today, -2), type: "out",
        category: "Konsumsi", description: "Kopi & snack rapat tim",
        amount: 45000, source: "manual", orderId: "", items: [],
        reference: "", createdBy: "Budi Santoso", createdAt: isoAt(2, "16:10"),
      },
      {
        id: "kas-005", date: U.addDays(today, -1), type: "out",
        category: "Transportasi", description: "Ongkos kirim sparepart dari supplier",
        amount: 30000, source: "manual", orderId: "", items: [],
        reference: "", createdBy: "Budi Santoso", createdAt: isoAt(1, "09:50"),
      }
    );

    const salaryBase = users.filter((u) => u.role !== "owner" && Number(u.salary) > 0);
    const salaries = [];
    salaryBase.forEach((user, index) => {
      salaries.push({
        id: `sal-prev-${index + 1}`,
        period: prevMonth,
        userId: user.id,
        userName: user.name,
        base: Number(user.salary),
        bonus: 0,
        deduction: 0,
        total: Number(user.salary),
        status: "dibayar",
        paidAt: isoAt(U.daysDiff(prevRange.end, today), "10:00"),
        note: "Gaji bulanan",
        createdAt: isoAt(20, "09:00"),
        updatedAt: now,
      });
    });
    salaryBase.forEach((user, index) => {
      salaries.push({
        id: `sal-now-${index + 1}`,
        period: thisMonth,
        userId: user.id,
        userName: user.name,
        base: Number(user.salary),
        bonus: 0,
        deduction: 0,
        total: Number(user.salary),
        status: "belum",
        paidAt: "",
        note: "Gaji bulanan",
        createdAt: isoAt(10, "09:00"),
        updatedAt: now,
      });
    });

    return {
      version: DB_VERSION,
      seededAt: now,
      users,
      suppliers,
      customers,
      orders,
      kas,
      salaries,
      settings,
    };
  }

  function sanitizeUser(user, viewer) {
    if (!user) return null;
    const isOwner = viewer && viewer.role === "owner";
    const isSelf = viewer && viewer.id === user.id;
    const base = {
      id: user.id,
      name: user.name,
      role: user.role,
      active: user.active !== false,
    };
    if (isOwner) {
      return {
        ...base,
        username: user.username,
        phone: user.phone || "",
        email: user.email || "",
        salary: Number(user.salary) || 0,
        createdAt: user.createdAt || "",
        updatedAt: user.updatedAt || "",
      };
    }
    if (isSelf) {
      return {
        ...base,
        username: user.username,
        phone: user.phone || "",
        email: user.email || "",
        salary: Number(user.salary) || 0,
        createdAt: user.createdAt || "",
      };
    }
    return base;
  }

  function sanitizeData(raw, viewer) {
    return {
      me: sanitizeUser((raw.users || []).find((u) => u.id === (viewer && viewer.id)), viewer),
      users: (raw.users || []).map((u) => sanitizeUser(u, viewer)).filter(Boolean),
      suppliers: U.clone(raw.suppliers || []),
      customers: U.clone(raw.customers || []),
      orders: U.clone(raw.orders || []),
      kas: viewer && viewer.role === "owner" ? U.clone(raw.kas || []) : [],
      salaries: viewer && viewer.role === "owner" ? U.clone(raw.salaries || []) : [],
      settings: mergeSettings(raw.settings),
    };
  }

  class LocalDB {
    constructor() {
      this.mode = "local";
      this.lastAutoKas = null;
      this._ensure();
    }

    _ensure() {
      const raw = localStorage.getItem(KEYS.db);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === DB_VERSION) return;
        } catch (err) {
          console.warn("Data demo rusak, membuat ulang.", err);
        }
      }
      this._write(createSeed());
    }

    _read() {
      const raw = localStorage.getItem(KEYS.db);
      if (!raw) {
        this._write(createSeed());
        return JSON.parse(localStorage.getItem(KEYS.db));
      }
      return JSON.parse(raw);
    }

    _write(data) {
      localStorage.setItem(KEYS.db, JSON.stringify(data));
    }

    async login(username, password) {
      const raw = this._read();
      const user = raw.users.find((u) => U.normalize(u.username) === U.normalize(username));
      if (!user) throw new Error("Username tidak ditemukan.");
      if (user.active === false) throw new Error("Akun ini sedang dinonaktifkan. Hubungi owner.");
      if (String(user.password || "") !== String(password || "")) throw new Error("Password salah. Silakan coba lagi.");
      return sanitizeUser(user, user);
    }

    async resume(savedUser) {
      if (!savedUser || !savedUser.id) return null;
      const raw = this._read();
      const user = raw.users.find((u) => u.id === savedUser.id);
      if (!user || user.active === false) return null;
      return sanitizeUser(user, user);
    }

    async bootstrap(user) {
      if (!user) throw new Error("Sesi login tidak ditemukan.");
      const raw = this._read();
      const actual = raw.users.find((u) => u.id === user.id);
      if (!actual || actual.active === false) throw new Error("Akun tidak aktif.");
      return sanitizeData(raw, actual);
    }

    async upsert(table, record) {
      const raw = this._read();
      const now = U.nowISO();
      const input = U.clone(record || {});
      this.lastAutoKas = null;

      if (table === "settings") {
        raw.settings = mergeSettings({
          ...raw.settings,
          ...input,
          id: "company",
          updatedAt: now,
        });
        this._write(raw);
        return U.clone(raw.settings);
      }

      if (!Array.isArray(raw[table])) throw new Error("Tabel data tidak dikenal: " + table);
      const index = raw[table].findIndex((row) => row.id === input.id);
      const existing = index >= 0 ? raw[table][index] : null;

      if (table === "users") {
        const username = U.normalize(input.username);
        if (!input.name || !String(input.name).trim()) throw new Error("Nama pengguna wajib diisi.");
        if (!username) throw new Error("Username wajib diisi.");
        if (!["owner", "teknisi", "kasir", "pramugari"].includes(input.role)) throw new Error("Role tidak valid.");
        const duplicate = raw.users.find((u) => U.normalize(u.username) === username && u.id !== input.id);
        if (duplicate) throw new Error("Username sudah digunakan.");
        if (!existing && !input.password) throw new Error("Password wajib diisi untuk pengguna baru.");
        if (!input.id) input.id = U.uid("u");
        if (!input.password) delete input.password;
        input.username = String(input.username).trim();
        input.name = String(input.name).trim();
        input.email = String(input.email || "").trim();
        input.phone = String(input.phone || "").trim();
        input.active = input.active !== false;
        input.salary = Number(input.salary) || 0;
        input.createdAt = existing ? existing.createdAt : now;
        input.updatedAt = now;
        if (existing) {
          input.password = input.password || existing.password;
          raw.users[index] = { ...existing, ...input };
        } else {
          raw.users.push(input);
        }
        const activeOwners = raw.users.filter((u) => u.role === "owner" && u.active !== false).length;
        if (!activeOwners) {
          if (existing) raw.users[index] = existing;
          else raw.users.pop();
          throw new Error("Minimal harus ada satu akun owner yang aktif.");
        }
        this._write(raw);
        const saved = raw.users.find((u) => u.id === input.id);
        return sanitizeUser(saved, { id: saved.id, role: "owner" });
      }

      if (table === "orders") {
        if (!input.customerId) throw new Error("Pelanggan wajib dipilih.");
        if (!["hp", "laptop", "printer", "pc"].includes(input.deviceType)) throw new Error("Jenis perangkat tidak valid.");
        input.id = input.id || U.uid("ord");
        input.ticketNo = input.ticketNo || U.nextTicketNumber(raw.orders);
        input.partsCost = Number(input.partsCost) || 0;
        input.serviceCost = Number(input.serviceCost) || 0;
        input.estimateCost = Number(input.estimateCost) || 0;
        input.total = input.partsCost + input.serviceCost;
        input.paymentStatus = input.paymentStatus === "lunas" ? "lunas" : "belum";
        input.history = Array.isArray(input.history) ? input.history : [];
        input.createdAt = existing ? existing.createdAt : (input.createdAt || now);
        input.updatedAt = now;
        input.kasAllocated = !!(existing && existing.kasAllocated);
        input.kasAllocatedAmount = Number(existing && existing.kasAllocatedAmount) || 0;
        if (input.paymentStatus === "lunas" && !input.paidAt) input.paidAt = now;
        if (input.paymentStatus !== "lunas") {
          input.paidAt = "";
          input.paymentMethod = "";
        }
        const customer = raw.customers.find((c) => c.id === input.customerId);
        if (customer) {
          input.customerName = customer.name;
          input.customerPhone = customer.phone;
        }
        const tech = raw.users.find((u) => u.id === input.technicianId);
        input.technicianName = tech ? tech.name : "";
        const supplier = raw.suppliers.find((s) => s.id === input.supplierId);
        input.supplierName = supplier ? supplier.name : "";
        if (input.id && !existing && !input.id.startsWith("ord-")) input.id = U.uid("ord");

        const alreadyAllocated = (raw.kas || []).some((entry) => entry.orderId === input.id);
        if (input.paymentStatus === "lunas" && !input.kasAllocated && !alreadyAllocated && raw.settings.kasAutoEnabled) {
          const amount = U.kasAllocationFor(input, raw.settings.kasPercent);
          if (amount > 0) {
            const autoKas = {
              id: U.uid("kas"),
              date: U.dateOf(input.paidAt),
              type: "in",
              category: "Alokasi Laba",
              description: `Alokasi otomatis laba ${input.ticketNo}`,
              amount,
              source: "otomatis",
              orderId: input.id,
              items: [],
              reference: input.ticketNo,
              createdBy: "Sistem",
              createdAt: now,
            };
            raw.kas.push(autoKas);
            input.kasAllocated = true;
            input.kasAllocatedAmount = amount;
            this.lastAutoKas = U.clone(autoKas);
          }
        }

        if (index >= 0) raw.orders[index] = { ...existing, ...input };
        else raw.orders.push(input);
        this._write(raw);
        const saved = raw.orders.find((o) => o.id === input.id);
        const result = U.clone(saved);
        if (this.lastAutoKas) result.__autoKas = U.clone(this.lastAutoKas);
        return result;
      }

      if (table === "kas") {
        input.id = input.id || U.uid("kas");
        input.amount = Number(input.amount) || 0;
        input.type = input.type === "in" ? "in" : "out";
        input.items = Array.isArray(input.items) ? input.items : [];
        input.date = input.date || U.todayISO();
        input.createdAt = existing ? existing.createdAt : (input.createdAt || now);
        input.updatedAt = now;
        if (input.amount <= 0) throw new Error("Nominal kas harus lebih dari nol.");
        if (index >= 0) raw.kas[index] = { ...existing, ...input };
        else raw.kas.push(input);
        this._write(raw);
        return U.clone(raw.kas.find((k) => k.id === input.id));
      }

      if (table === "salaries") {
        input.id = input.id || U.uid("sal");
        input.base = Number(input.base) || 0;
        input.bonus = Number(input.bonus) || 0;
        input.deduction = Number(input.deduction) || 0;
        input.total = input.base + input.bonus - input.deduction;
        input.status = input.status === "dibayar" ? "dibayar" : "belum";
        if (input.status === "dibayar" && !input.paidAt) input.paidAt = now;
        if (input.status !== "dibayar") input.paidAt = "";
        input.createdAt = existing ? existing.createdAt : (input.createdAt || now);
        input.updatedAt = now;
        if (index >= 0) raw.salaries[index] = { ...existing, ...input };
        else raw.salaries.push(input);
        this._write(raw);
        return U.clone(raw.salaries.find((s) => s.id === input.id));
      }

      // suppliers & customers
      input.id = input.id || U.uid(table === "suppliers" ? "sup" : "cus");
      input.name = String(input.name || "").trim();
      if (!input.name) throw new Error("Nama wajib diisi.");
      input.updatedAt = now;
      input.createdAt = existing ? existing.createdAt : (input.createdAt || now);
      if (index >= 0) raw[table][index] = { ...existing, ...input };
      else raw[table].push(input);
      this._write(raw);
      return U.clone(raw[table].find((row) => row.id === input.id));
    }

    async remove(table, id) {
      const raw = this._read();
      if (!Array.isArray(raw[table])) throw new Error("Tabel tidak dikenal.");
      if (table === "users") {
        const user = raw.users.find((u) => u.id === id);
        if (!user) return true;
        const remainingOwners = raw.users.filter((u) => u.id !== id && u.role === "owner" && u.active !== false).length;
        if (user.role === "owner" && user.active !== false && remainingOwners === 0) {
          throw new Error("Akun owner aktif terakhir tidak dapat dihapus.");
        }
        raw.users = raw.users.filter((u) => u.id !== id);
      } else if (table === "customers") {
        const hasOrders = raw.orders.some((o) => o.customerId === id);
        if (hasOrders) throw new Error("Pelanggan masih memiliki riwayat servis dan tidak dapat dihapus.");
        raw.customers = raw.customers.filter((c) => c.id !== id);
      } else if (table === "suppliers") {
        const hasOrders = raw.orders.some((o) => o.supplierId === id);
        if (hasOrders) throw new Error("Supplier masih terkait dengan riwayat servis dan tidak dapat dihapus.");
        raw.suppliers = raw.suppliers.filter((s) => s.id !== id);
      } else if (table === "orders") {
        raw.orders = raw.orders.filter((o) => o.id !== id);
        raw.kas = (raw.kas || []).filter((k) => k.orderId !== id);
      } else if (table === "kas") {
        raw.kas = raw.kas.filter((k) => k.id !== id);
      } else {
        raw[table] = (raw[table] || []).filter((row) => row.id !== id);
      }
      this._write(raw);
      return true;
    }

    async resetDemo() {
      localStorage.removeItem(KEYS.db);
      this._write(createSeed());
      return true;
    }

    async testConnection() {
      return { mode: "local", ok: true, message: "Mode demo lokal aktif di perangkat ini." };
    }
  }

  class RemoteDB {
    constructor(url) {
      this.mode = "remote";
      this.url = String(url || "").trim();
      this.token = localStorage.getItem(KEYS.token) || "";
      this.lastAutoKas = null;
    }

    async _request(payload) {
      if (!this.url) throw new Error("URL Web App Google Apps Script belum diatur.");
      let response;
      try {
        response = await fetch(this.url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
          redirect: "follow",
        });
      } catch (err) {
        throw new Error("Tidak dapat menghubungi database. Periksa koneksi internet dan URL Web App.");
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        if (/accounts\.google\.com|login/i.test(text)) {
          throw new Error("Akses Web App dibatasi. Deploy ulang Apps Script dengan akses 'Siapa saja'.");
        }
        throw new Error("Respon server tidak valid. Pastikan URL adalah Web App Apps Script versi /exec.");
      }
      if (!data || data.ok !== true) {
        const message = (data && data.error) || "Permintaan ke database gagal.";
        const error = new Error(message);
        error.code = data && data.code;
        if (error.code === "AUTH") {
          this.token = "";
          localStorage.removeItem(KEYS.token);
        }
        throw error;
      }
      return data.data;
    }

    async login(username, password) {
      const data = await this._request({ action: "login", username, password });
      if (!data || !data.token || !data.user) throw new Error("Respon login tidak lengkap.");
      this.token = data.token;
      localStorage.setItem(KEYS.token, data.token);
      return data.user;
    }

    async resume() {
      if (!this.token) return null;
      try {
        const data = await this._request({ action: "bootstrap", token: this.token });
        return data.me || null;
      } catch (err) {
        if (err.code === "AUTH") return null;
        throw err;
      }
    }

    async bootstrap(user) {
      if (!this.token) throw new Error("Sesi login berakhir. Silakan masuk kembali.");
      return this._request({ action: "bootstrap", token: this.token });
    }

    async upsert(table, record) {
      this.lastAutoKas = null;
      const savingRecord = U.clone(record || {});
      if (table === "users" && !savingRecord.password) delete savingRecord.password;
      const data = await this._request({
        action: "upsert",
        token: this.token,
        table,
        record: savingRecord,
      });
      const result = data && data.record ? data.record : data;
      if (data && data.autoKas) {
        this.lastAutoKas = data.autoKas;
        result.__autoKas = data.autoKas;
      }
      return result;
    }

    async remove(table, id) {
      await this._request({ action: "remove", token: this.token, table, id });
      return true;
    }

    async resetDemo() {
      throw new Error("Reset data hanya tersedia pada mode demo lokal.");
    }

    async testConnection() {
      const data = await this._request({ action: "ping" });
      return { mode: "remote", ok: true, message: (data && data.message) || "Koneksi Google Sheets berhasil." };
    }

    logout() {
      this.token = "";
      localStorage.removeItem(KEYS.token);
    }
  }

  function getApiUrl() {
    return localStorage.getItem(KEYS.api) || "";
  }

  function setApiUrl(url) {
    if (url) localStorage.setItem(KEYS.api, String(url).trim());
    else localStorage.removeItem(KEYS.api);
    localStorage.removeItem(KEYS.token);
  }

  function createDB() {
    const url = getApiUrl();
    return url ? new RemoteDB(url) : new LocalDB();
  }

  function getSavedSession() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.session) || "null");
    } catch (err) {
      return null;
    }
  }

  function saveSession(user) {
    localStorage.setItem(KEYS.session, JSON.stringify({
      id: user.id,
      name: user.name,
      role: user.role,
      username: user.username || "",
    }));
  }

  function clearSession() {
    localStorage.removeItem(KEYS.session);
  }

  function getAppearance() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEYS.appearance) || "null");
      if (saved && saved.mode) return saved;
    } catch (err) {
      // abaikan data preferensi yang rusak
    }
    return { mode: "", primary: "" };
  }

  function saveAppearance(appearance) {
    localStorage.setItem(KEYS.appearance, JSON.stringify(appearance));
  }

  window.SPData = {
    KEYS,
    DEFAULT_SETTINGS,
    blankData,
    mergeSettings,
    createSeed,
    LocalDB,
    RemoteDB,
    createDB,
    getApiUrl,
    setApiUrl,
    getSavedSession,
    saveSession,
    clearSession,
    getAppearance,
    saveAppearance,
  };
})();
