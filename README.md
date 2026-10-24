# ServisPro — Aplikasi Manajemen Service Center

Aplikasi web statis untuk mengelola servis HP, laptop, printer, dan PC. Mendukung empat role (Owner, Teknisi, Kasir, Pramugari/Front Desk), laporan keuangan, kas kecil otomatis, nota thermal, serta database Google Sheets melalui Google Apps Script.

Aplikasi dapat langsung dipakai tanpa build tool. Backend cloud disediakan di `apps-script/Code.gs`, sedangkan mode demo berjalan sepenuhnya di browser menggunakan `localStorage`.

> Status: kode aplikasi dan backend siap. Deployment ke GitHub Pages dan Google Apps Script belum dilakukan dari lingkungan ini karena memerlukan akun/izin pemilik. Langkah deployment ada di bawah.

---

## 1. Fitur

### Role & akses

| Modul | Owner | Teknisi | Kasir | Pramugari |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Tiket servis (lihat) | ✓ | ✓ | ✓ | ✓ |
| Buat / edit tiket | ✓ | — | ✓ | ✓ |
| Update status, diagnosa, riwayat | ✓ | ✓ (tiket sendiri) | ✓ | ✓ |
| Pembayaran tiket | ✓ | — | ✓ | — |
| Hapus tiket | ✓ | — | — | — |
| Pelanggan | ✓ | lihat | ✓ | ✓ |
| Supplier | ✓ | — | — | — |
| Laporan transaksi | ✓ | — | ✓ | — |
| Laporan keuangan | ✓ | — | — | — |
| Laporan gaji | ✓ | — | — | — |
| Kas kecil | ✓ | — | — | — |
| Pengaturan & akun | ✓ | — | — | — |

Role `owner` selalu memiliki seluruh izin. Pembatasan juga diterapkan di backend, bukan hanya di tampilan.

### Menu utama

- **Dashboard** — KPI pendapatan, laba, tiket aktif, saldo kas, antrean servis, dan aktivitas terbaru.
- **Tiket servis** — input barang, data pelanggan/perangkat, teknisi, supplier, estimasi, biaya jasa/sparepart, status servis, pembayaran, cetak nota.
- **Pelanggan** — pencarian, tambah/edit, riwayat servis, proteksi hapus bila masih punya tiket.
- **Supplier** — data pemasok sparepart, proteksi hapus bila masih terkait tiket.
- **Laporan** — transaksi, keuangan (pendapatan, HPP, laba, pengeluaran, gaji), dan gaji karyawan; filter bulan/rentang tanggal serta ekspor CSV.
- **Kas kecil** — saldo, kas masuk/keluar manual dengan rincian pembelian, alokasi otomatis dari laba tiket, sinkronisasi, ekspor CSV.
- **Pengaturan** — kelola akun dan role, profil perusahaan + logo, tema warna/mode gelap, format nota 58/80 mm, preferensi printer, koneksi database.

### Perhitungan kas otomatis

Alokasi otomatis dihitung dari **laba tiket**:

```
laba tiket = total tiket (jasa + sparepart) − HPP sparepart
alokasi    = laba tiket × persentase (default 10%)
```

Nilai persentase diatur di **Kas Kecil → Atur alokasi** (0–100). Alokasi dibuat sekali per tiket saat tiket berstatus **lunas**, tidak dihitung ulang ketika persentase diubah, dan tidak dapat diedit/dihapus manual — hapus tiketnya bila ingin membatalkan alokasi.

---

## 2. Struktur proyek

```
.
├── index.html
├── assets/
│   ├── css/app.css
│   └── js/
│       ├── utils.js
│       ├── ui.js
│       ├── data.js          # LocalDB, RemoteDB, seed demo
│       ├── app.js           # shell, login, RBAC, navigasi
│       └── pages/           # dashboard, orders, contacts, reports, pettycash, settings
├── apps-script/
│   ├── Code.gs              # backend Google Apps Script
│   └── appsscript.json      # manifest Web App
├── tools/
│   └── backend-selftest.mjs # uji backend dengan mock Apps Script
└── README.md
```

Tidak ada proses build. Cukup unggah seluruh file statis ke hosting. Folder `tools/` tidak dipakai aplikasi dan boleh tidak diunggah.

---

## 3. Menjalankan mode demo lokal

Cara paling mudah:

```bash
cd path/ke/proyek
python -m http.server 8080
```

Buka `http://localhost:8080`.

Alternatif: ekstensi Live Server di VS Code, atau npm `npx serve .`.

Akun demo:

| Username | Password | Role |
|---|---|---|
| `owner` | `owner123` | Owner |
| `kasir` | `kasir123` | Kasir |
| `teknisi` | `teknisi123` | Teknisi |
| `pramugari` | `pramugari123` | Pramugari |

Data demo disimpan di `localStorage` browser. Reset lewat **Pengaturan → Integrasi → Reset data demo**. Data demo **tidak** berpindah otomatis ke Google Sheets.

---

## 4. Menyiapkan database Google Sheets

### 4.1 Buat spreadsheet dan project Apps Script

1. Buka [Google Sheets](https://sheets.new), buat spreadsheet baru (misalnya `ServisPro Database`).
2. Pilih **Extensions → Apps Script**.
3. Hapus isi `Code.gs` bawaan, tempel seluruh isi [`apps-script/Code.gs`](apps-script/Code.gs).
4. Buka **Project Settings**, aktifkan **Show "appsscript.json" manifest file in editor**.
5. Buka `appsscript.json`, ganti isinya dengan [`apps-script/appsscript.json`](apps-script/appsscript.json).
6. Simpan project.

Alternatif standalone: buat project di [script.new](https://script.new) lalu tempel kode dan manifest. Saat `setup()` dijalankan, backend membuat spreadsheet baru otomatis dan menyimpan ID-nya di Script Properties.

### 4.2 Jalankan setup()

1. Di editor Apps Script, pilih fungsi `setup()`.
2. Klik **Run**, setujui permintaan izin (akses spreadsheet).
3. Buka **Execution log**. `setup()` akan:
   - membuat spreadsheet (bila standalone) atau memakai spreadsheet aktif;
   - membuat sheet `users`, `suppliers`, `customers`, `orders`, `kas`, `salaries`, `settings`;
   - menulis header, format kolom teks, dan pengaturan default;
   - membuat akun awal `owner/owner123`, `kasir/kasir123`, `teknisi/teknisi123`, `pramugari/pramugari123`;
   - menampilkan URL spreadsheet dan akun awal di log.

`setup()` bersifat idempotent: aman dijalankan ulang, sheet dan akun yang sudah ada tidak diduplikasi. Jika spreadsheet tidak terdeteksi, jalankan ulang dari spreadsheet yang benar atau atur Script Property `SPREADSHEET_ID` dengan ID spreadsheet.

### 4.3 Deploy Web App

1. Klik **Deploy → New deployment**.
2. Pilih **Web app**.
3. Isi:
   - **Description:** `ServisPro API v1`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` (wajib, karena login ditangani aplikasi; jangan pilih "Anyone with Google account").
4. Klik **Deploy**, lalu salin URL yang berakhiran `/exec`.

Uji cepat di browser: buka URL `/exec` — harus muncul JSON `"service": "ServisPro API"`.

> Setiap kali `Code.gs` diubah, buat versi baru: **Deploy → Manage deployments → Edit → Version: New version → Deploy**. URL `/exec` tetap sama.

### 4.4 Hubungkan aplikasi

1. Buka aplikasi (lokal atau GitHub Pages).
2. Pada halaman login, klik **Hubungkan Google Sheets** di bagian bawah.
3. Tempel URL `/exec`, klik **Uji & simpan**.
4. Setelah aplikasi memuat ulang, login dengan akun cloud (bukan akun demo).
5. **Segera ganti password default** melalui **Pengaturan → Akun & akses**.

URL database disimpan di `localStorage` per browser/perangkat. Setiap perangkat baru perlu menghubungkan URL sekali lagi, lalu login.

### 4.5 Lupa password / darurat

Di editor Apps Script, jalankan salah satu fungsi:

```js
resetPassword("owner", "passwordBaruMinimal6");
revokeAllSessions();
```

`resetPassword` juga mengakhiri semua sesi pengguna tersebut. Fungsi mengembalikan pesan yang tampil di execution log.

---

## 5. Deploy ke GitHub Pages

```bash
cd path/ke/proyek
git init
git add index.html assets README.md apps-script
git commit -m "Aplikasi ServisPro siap deploy"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Lalu di GitHub:

1. Buka **Settings → Pages**.
2. **Build and deployment → Source:** `Deploy from a branch`.
3. Pilih branch `main`, folder `/ (root)`, klik **Save**.
4. Tunggu hingga URL `https://USERNAME.github.io/NAMA-REPO/` aktif.

Aplikasi memakai hash routing (`#/orders`, `#/reports`, dst.), sehingga tidak memerlukan konfigurasi rewrite. Folder `apps-script/` tidak mengganggu hosting dan aman ikut terunggah — file itu tidak berisi kredensial; password pepper dan session disimpan di Script Properties Google, bukan di repo.

Jangan mengunggah file backup spreadsheet, ekspor data pelanggan, atau dokumen berisi password ke repo publik.

---

## 6. Skema database

Sheet dibuat otomatis oleh `setup()`:

| Sheet | Isi penting |
|---|---|
| `users` | id, nama, username, hash password + salt (kolom disembunyikan), role, telepon, email, gaji, status aktif |
| `customers` | id, nama, telepon, email, alamat, catatan |
| `suppliers` | id, nama, kontak, telepon, email, alamat, catatan |
| `orders` | tiket, pelanggan, perangkat, keluhan, teknisi, supplier, biaya, status, pembayaran, riwayat (JSON), alokasi kas |
| `kas` | tanggal, tipe masuk/keluar, kategori, keterangan, nominal, sumber, rincian pembelian (JSON), referensi tiket |
| `salaries` | periode, karyawan, gaji pokok, bonus, potongan, total, status bayar |
| `settings` | key/value JSON: profil perusahaan, logo, tema, nota, aturan kas |

Catatan:

- Nomor tiket dibuat di server dengan format `SVC-YYMMDD-NNN`.
- ID memakai prefiks `u`, `cus`, `sup`, `ord`, `kas`, `sal`.
- Kolom JSON menyimpan `orders.history` dan `kas.items`.
- Batas satu sel Google Sheets sekitar 50.000 karakter. Backend menolak nilai yang terlalu panjang (mis. logo atau riwayat ekstrem).
- Kolom telepon, serial, dan nomor tiket diformat sebagai teks agar angka nol di depan dan tanda `+` tidak hilang.
- HPP sparepart (`partsCost`) adalah biaya; `serviceCost` adalah jasa. Total tiket = keduanya.

### Menguji backend tanpa Google

Tersedia self-test yang memalsukan layanan Apps Script (Spreadsheet, Properties, Utilities) sehingga alur backend dapat diuji tanpa kredensial:

```bash
node tools/backend-selftest.mjs
```

Self-test membuat database in-memory, menjalankan `setup()`, lalu menguji login, pembatasan role, pembuatan tiket, pembayaran, alokasi kas, validasi saldo, pengaturan, gaji, reset password, dan pencabutan sesi. Hasil yang diharapkan: `ALL TESTS PASSED`. Ini bukan pengganti uji pada deployment Google sungguhan.

### Kontrak API

Semua request adalah `POST` dengan body JSON dan `Content-Type: text/plain;charset=utf-8` untuk menghindari preflight CORS.

| Action | Autentikasi | Keterangan |
|---|---|---|
| `ping` | — | Cek spreadsheet dan seluruh sheet tersedia |
| `login` | — | `{ username, password }` → token + user |
| `bootstrap` | token | Ambil seluruh data yang boleh dilihat role |
| `upsert` | token | `{ table, record }` |
| `remove` | token | `{ table, id }` |

Respons sukses: `{ "ok": true, "data": ... }`. Respons gagal: `{ "ok": false, "error": "...", "code": "..." }`.

---

## 7. Keamanan

- Password disimpan sebagai hash SHA-256 berulang (250 putaran) dengan salt acak dan pepper server-side di Script Properties.
- Session token acak 64 karakter hex, disimpan sebagai hash di Script Properties, berlaku 30 hari.
- Backend memuat ulang role dari sheet pada setiap request; akun nonaktif langsung ditolak.
- Perubahan password, role, atau status aktif mencabut seluruh sesi pengguna tersebut.
- Teknisi hanya dapat mengubah status, diagnosa, dan riwayat tiket yang ditugaskan kepadanya. Kasir/pramugari tidak dapat menghapus tiket; pramugari tidak dapat memproses pembayaran.
- Penulisan data memakai `LockService` untuk mengurangi race condition.
- Data `kas` dan `salaries` hanya dikirim ke owner.
- Formula injection dinetralkan saat menulis teks ke Sheets.
- Jangan membagikan akses edit spreadsheet/Apps Script ke staf. Staf cukup memakai aplikasi.
- Deploy Web App harus `Execute as: Me` + akses `Anyone`; autentikasi dilakukan aplikasi, bukan akun Google pengunjung.

Keterbatasan yang perlu diketahui:

- Ini bukan realtime multi-user. Perubahan baru terlihat setelah login ulang, refresh, atau aksi reload data.
- Seluruh data dimuat saat bootstrap. Cocok untuk skala service center kecil–menengah, bukan ribuan tiket aktif.
- Nota dicetak melalui dialog print browser, bukan driver printer langsung.
- Belum ada lampiran foto perangkat; hanya logo perusahaan yang disimpan.
- Token disimpan di `localStorage`; gunakan HTTPS (GitHub Pages sudah HTTPS) dan perangkat yang tepercaya.

---

## 8. Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| `Sheet 'users' tidak ditemukan` | `setup()` belum dijalankan di spreadsheet yang benar. Jalankan ulang. |
| `Akses Web App dibatasi` | Deployment belum `Anyone`, atau URL bukan `/exec`. Deploy ulang. |
| `Respon server tidak valid` | URL salah (mis. `/dev`), project belum di-deploy versi baru, atau halaman login Google muncul. Pastikan akses `Anyone`. |
| `Sesi login berakhir` | Token kedaluwarsa/dicabut (password berubah, akun dinonaktifkan). Login ulang. |
| Data cloud tidak berubah | Klik **Uji koneksi** di Pengaturan → Integrasi; pastikan internet aktif dan URL `/exec` benar. |
| Perubahan kode tidak berlaku | Apps Script memakai versi deployment lama. Buat **New version** pada deployment. |
| `Saldo kas tidak mencukupi` | Pengeluaran melebihi saldo. Tambah kas masuk atau koreksi nominal. |
| `Alokasi otomatis tidak dapat dihapus` | Hapus tiket sumber sebagai owner, atau biarkan catatan tetap ada. |
| Logo ditolak | File terlalu besar/format bukan PNG-JPG-WEBP. Kompres gambar (maks. 5 MB sebelum kompresi, hasil akhir < 49 KB). |
| Tiket tidak dapat dihapus | Alokasi kas dari tiket sudah terpakai sehingga saldo akan negatif. Kurangi/hapus pengeluaran terkait terlebih dahulu. |
| Lupa password owner | Jalankan `resetPassword("owner", "passwordBaru")` di editor Apps Script. |
| Waktu tiket tidak sesuai | Atur timezone project Apps Script ke `Asia/Jakarta` (sudah disetel di manifest) dan spreadsheet ke zona waktu yang sama. |

### Backup

- File → **Make a copy** pada spreadsheet secara berkala.
- Gunakan **File → Version history** untuk memulihkan data.
- Simpan salinan `Code.gs` di repo ini setiap kali ada perubahan backend.
- Untuk pindah database, salin spreadsheet lalu sesuaikan Script Property `SPREADSHEET_ID`.

---

## 9. Checklist sebelum dipakai produksi

- [ ] `setup()` dijalankan dan semua sheet terbentuk.
- [ ] Web App di-deploy dengan akses `Anyone` dan URL `/exec` diuji.
- [ ] Aplikasi di GitHub Pages dapat login ke database cloud.
- [ ] Seluruh password default sudah diganti.
- [ ] Akun staf dibuat dengan role yang benar; akun demo/tidak terpakai dinonaktifkan.
- [ ] Profil perusahaan, logo, tema, format nota, dan aturan kas sudah diatur.
- [ ] Backup spreadsheet pertama dibuat.
- [ ] Owner mencoba alur: tiket baru → pengerjaan teknisi → lunas kasir → kas otomatis → laporan.
