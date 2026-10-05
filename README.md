# MUSTIONO COMPUTER — POS Kasir & Servis

Aplikasi kasir (POS) & servis dengan arsitektur:

- **Tampilan (HTML/JS)** → di-host gratis di **GitHub Pages**
- **Database & backend** → **Google Sheets + Google Apps Script** (API JSON)

---

## Isi Folder

| File | Fungsi |
|---|---|
| `index.html` | Aplikasi utama — **upload ke GitHub** |
| `chart.umd.min.js` | Grafik dashboard (offline, ada cadangan CDN) |
| `html5-qrcode.min.js` | Scan barcode pakai kamera (offline, ada cadangan CDN) |
| `logo.png` | Logo tampilan |
| `Code.gs` | Backend — **tempel ke editor Apps Script** |
| `appsscript.json` | Manifest Apps Script |

---

## BAGIAN 1 — Pasang Backend (Google Sheets + Apps Script)

1. Buka [Google Drive](https://drive.google.com) → **New → Google Sheets**, beri nama mis. `MUSTIONO POS Database`.
   *(Sudah punya spreadsheet aplikasi lama? Pakai itu saja — datanya tetap terbaca.)*
2. Menu **Extensions → Apps Script**.
3. Hapus isi `Code.gs` bawaan, lalu **tempel seluruh isi `Code.gs`** dari folder ini.
4. Buka **Project Settings** (ikon gerigi ⚙) → centang **"Show 'appsscript.json' manifest file in editor"** → kembali ke **Editor** → buka `appsscript.json` → ganti isinya dengan file `appsscript.json` dari folder ini.
5. Simpan (**Ctrl+S**). Di toolbar pilih fungsi **`initializeDatabase`** → **Run**.
   - Muncul izin akses: **Review permissions → pilih akun → Advanced → Go to … (unsafe) → Allow**.
   - Fungsi ini otomatis membuat semua sheet, akun default **superadmin / admin123**, dan 2 cabang contoh.
6. **Deploy → New deployment** → pilih tipe **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** ← **WAJIB** (kalau tidak, aplikasi GitHub tidak bisa akses)
   - Klik **Deploy** → **salin URL yang berakhiran `/exec`**

> **Update backend nanti:** setelah mengubah `Code.gs`, jangan deploy baru dari nol — buka **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy**. URL `/exec` tetap sama.

---

## BAGIAN 2 — Upload Tampilan ke GitHub Pages

1. Buat akun [GitHub](https://github.com) (kalau belum) → **New repository**, mis. `mustiono-pos` (boleh Public).
2. Di halaman repo: **Add file → Upload files** → upload ke-4 file ini:
   - `index.html`
   - `chart.umd.min.js`
   - `html5-qrcode.min.js`
   - `logo.png`
3. **Commit changes**.
4. Masuk **Settings → Pages** → *Source*: **Deploy from a branch** → *Branch*: **main** + **/ (root)** → **Save**.
5. Tunggu 1–2 menit. Situs jadi di:
   `https://<username-github>.github.io/<nama-repo>/`

---

## BAGIAN 3 — Menghubungkan Aplikasi dengan Server

1. Buka situs GitHub Pages Anda.
2. Di halaman login, klik tulisan kecil **"Server: …"** di bawah tombol **MASUK**.
3. **Tempel URL `/exec`** dari Bagian 1 → OK.
4. Login: **superadmin / admin123** → segera ganti password di menu **Setting Akun**.

URL server tersimpan di perangkat itu saja (localStorage). Kalau ingin URL permanen untuk semua pengguna, isi variabel `DEFAULT_API_URL` di baris atas file `index.html`.

---

## Tips & Catatan

- **Pesan "Tidak bisa menghubungi server"** → biasanya akses Web App belum diset **Anyone**, atau URL bukan yang berakhiran `/exec`.
- **Scan kamera** → perlu situs HTTPS (GitHub Pages sudah HTTPS otomatis) dan izin kamera browser.
- **Printer** → mode *dialog print browser* mendukung semua printer; mode Bluetooth/Serial (thermal) perlu Chrome di HP/Laptop.
- **Printer Bluetooth (mode langsung)** → perangkat terakhir **disimpan otomatis**, cetak berikutnya langsung terkirim tanpa pilih ulang. Ganti perangkat lewat tombol **"Ganti printer"** di jendela cetak.
- **Keamanan URL server** → di halaman login URL ditampilkan **tersensor** (contoh: `…/s/AKfycbTE••••••••qrst/exec`). Saat mengganti koneksi, kotak input selalu **kosong** — URL lama tidak pernah ditampilkan; kosongkan lalu OK untuk menghapus koneksi.
- **Update tampilan** → upload ulang `index.html` ke GitHub (Commit) — tanpa perlu deploy ulang Apps Script.
- **Ganti password default & tambah kasir** lewat menu **Setting Akun**.
