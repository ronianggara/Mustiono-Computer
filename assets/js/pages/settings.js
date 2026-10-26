/* Pengaturan — akun, perusahaan, tampilan, nota, dan integrasi */
(function () {
  "use strict";

  const TABS = [
    { id: "akun", label: "Akun & akses", icon: "users" },
    { id: "perusahaan", label: "Profil perusahaan", icon: "building" },
    { id: "tampilan", label: "Tampilan", icon: "palette" },
    { id: "nota", label: "Nota & printer", icon: "printer" },
    { id: "integrasi", label: "Integrasi", icon: "database" },
  ];

  const ROLE_ORDER = { owner: 0, kasir: 1, teknisi: 2, pramugari: 3 };
  const COLOR_PRESETS = ["#0d9488", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#475569"];
  const ROLE_OPTIONS = ["owner", "kasir", "teknisi", "pramugari"];

  function activeTab() {
    const saved = App.state.filters.settings.tab;
    return TABS.some((tab) => tab.id === saved) ? saved : "akun";
  }

  function requireOwner(permission, message) {
    if (!App.can(permission || "manageSettings")) {
      UI.warning("Akses dibatasi", message || "Hanya owner yang dapat mengubah pengaturan ini.");
      return false;
    }
    return true;
  }

  function summaryCard(label, iconName, value, foot, tone) {
    return `<div class="summary-card ${tone || ""}"><span>${UI.icon(iconName, 13)} ${U.esc(label)}</span><strong>${value}</strong><small>${U.esc(foot)}</small></div>`;
  }

  /* =====================================================
     Akun & akses
     ===================================================== */

  function openUserForm(user) {
    if (!requireOwner("manageUsers", "Hanya owner yang dapat mengelola akun.")) return;
    const isEdit = !!user;
    const isSelf = !!user && App.user && user.id === App.user.id;
    const u = user || {};
    UI.openModal({
      title: isEdit ? "Edit akun" : "Tambah akun",
      subtitle: isEdit ? `Perbarui akses dan data ${user.name}.` : "Buat akun baru untuk anggota tim.",
      iconName: isEdit ? "user" : "user-plus",
      size: "md",
      body: `<form id="userForm" novalidate>
        <div class="form-grid">
          <label class="field span-2"><span class="field-label">Nama lengkap <span class="required">*</span></span>
            <input class="input" name="name" value="${U.esc(u.name || "")}" placeholder="Nama anggota tim" required>
          </label>
          <label class="field"><span class="field-label">Username <span class="required">*</span></span>
            <input class="input" name="username" value="${U.esc(u.username || "")}" placeholder="cth. budi" autocomplete="off" required>
            <span class="helper-text">Huruf, angka, titik, garis bawah, atau strip (3–24 karakter).</span>
          </label>
          <label class="field"><span class="field-label">Role akses <span class="required">*</span></span>
            <select class="select" name="role" ${isSelf ? "disabled" : ""}>
              ${ROLE_OPTIONS.map((role) => `<option value="${role}" ${(u.role || "pramugari") === role ? "selected" : ""}>${U.esc(U.roleMeta(role).label)} — ${U.esc(U.roleMeta(role).desc)}</option>`).join("")}
            </select>
            <span class="helper-text" id="userRoleHint">${U.esc(U.roleMeta(u.role || "pramugari").desc)}</span>
          </label>
          <label class="field"><span class="field-label">Password ${isEdit ? "" : '<span class="required">*</span>'}</span>
            <input class="input" name="password" type="password" autocomplete="new-password" placeholder="${isEdit ? "Kosongkan jika tidak diganti" : "Minimal 6 karakter"}">
            <span class="helper-text">${isEdit ? "Isi hanya jika password ingin diubah." : "Minimal 6 karakter."}</span>
          </label>
          <label class="field"><span class="field-label">Nomor telepon</span>
            <input class="input" name="phone" inputmode="tel" value="${U.esc(u.phone || "")}" placeholder="08xx-xxxx-xxxx">
          </label>
          <label class="field"><span class="field-label">Email</span>
            <input class="input" name="email" type="email" value="${U.esc(u.email || "")}" placeholder="nama@email.com">
          </label>
          <label class="field"><span class="field-label">Gaji pokok bulanan</span>
            <div class="input-with-prefix"><span>Rp</span><input class="input" name="salary" inputmode="numeric" value="${Number(u.salary) > 0 ? U.num(u.salary).replace(/\./g, "") : ""}" placeholder="0"></div>
            <span class="helper-text">Dipakai untuk membuat komponen gaji di laporan.</span>
          </label>
          <div class="field">
            <span class="field-label">Status akun</span>
            <label class="check-row"><input type="checkbox" name="active" ${u.active === false ? "" : "checked"} ${isSelf ? "disabled" : ""}> <span>Aktif dan dapat masuk</span></label>
            <span class="helper-text">${isSelf ? "Akun yang sedang digunakan tidak dapat dinonaktifkan." : "Akun nonaktif tetap tersimpan beserta riwayatnya."}</span>
          </div>
        </div>
        ${isSelf ? `<div class="alert alert-info mt-3" style="margin-bottom:0">${UI.icon("info", 17)} <span>Anda sedang mengedit akun sendiri. Role dan status akun aktif dilindungi agar sesi ini tidak terkunci.</span></div>` : ""}
      </form>`,
      footer: `<button type="button" class="button button-secondary" data-close>Batal</button>
        <button type="submit" form="userForm" class="button button-primary" id="saveUserBtn">${UI.icon("save", 15)} ${isEdit ? "Simpan perubahan" : "Buat akun"}</button>`,
      onMount: (overlay) => {
        const form = overlay.querySelector("#userForm");
        const roleInput = form.elements.role;
        const roleHint = overlay.querySelector("#userRoleHint");
        if (roleInput && roleHint) {
          roleInput.addEventListener("change", () => {
            roleHint.textContent = U.roleMeta(roleInput.value).desc;
          });
        }
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const btn = overlay.querySelector("#saveUserBtn");
          const name = form.elements.name.value.trim();
          const username = form.elements.username.value.trim().toLowerCase();
          const password = form.elements.password.value;
          const phone = form.elements.phone.value.trim();
          const email = form.elements.email.value.trim();
          const salary = Math.max(0, Math.round(U.parseNumber(form.elements.salary.value)));
          const active = isSelf ? true : form.elements.active.checked;
          const role = isSelf && user ? user.role : roleInput.value;
          if (!name) return UI.warning("Nama wajib diisi", "Masukkan nama lengkap anggota tim.");
          if (!/^[a-z0-9._-]{3,24}$/.test(username)) return UI.warning("Username tidak valid", "Gunakan 3–24 karakter: huruf, angka, titik, garis bawah, atau strip.");
          if (!isEdit && password.length < 6) return UI.warning("Password terlalu pendek", "Minimal 6 karakter untuk akun baru.");
          if (password && password.length < 6) return UI.warning("Password terlalu pendek", "Minimal 6 karakter.");
          if (phone && !U.isValidPhone(phone)) return UI.warning("Nomor tidak valid", "Masukkan minimal 8 digit nomor telepon.");
          if (email && !U.isValidEmail(email)) return UI.warning("Email tidak valid", "Periksa kembali format email.");
          if (isSelf && user && !active) return UI.warning("Tidak dapat menonaktifkan diri", "Akun yang sedang digunakan harus tetap aktif.");
          UI.setLoading(btn, true, "Menyimpan…");
          try {
            const record = {
              ...(user || {}),
              name,
              username,
              role,
              phone,
              email,
              salary,
              active,
            };
            if (password) record.password = password;
            await App.db.upsert("users", record);
            await App.reload();
            UI.closeOverlay();
            UI.success(isEdit ? "Akun diperbarui" : "Akun dibuat", `${name} · ${U.roleMeta(role).label}`);
            App.refreshPage();
          } catch (err) {
            UI.setLoading(btn, false);
            App.handleError(err);
          }
        });
      },
    });
  }

  async function toggleUser(user) {
    if (!requireOwner("manageUsers", "Hanya owner yang dapat mengelola akun.")) return;
    if (!user) return;
    if (App.user && user.id === App.user.id) {
      return UI.warning("Tidak dapat menonaktifkan diri", "Akun yang sedang digunakan harus tetap aktif.");
    }
    const nextActive = user.active === false;
    const ok = await UI.confirm({
      title: nextActive ? "Aktifkan akun?" : "Nonaktifkan akun?",
      heading: `${nextActive ? "Aktifkan" : "Nonaktifkan"} ${user.name}?`,
      message: nextActive
        ? "Pengguna dapat kembali masuk dan mengakses menu sesuai role-nya."
        : "Pengguna tidak dapat masuk sampai akun diaktifkan kembali. Riwayat servis dan data lain tetap tersimpan.",
      confirmText: nextActive ? "Aktifkan akun" : "Nonaktifkan",
      danger: !nextActive,
      iconName: nextActive ? "check-circle" : "lock",
    });
    if (!ok) return;
    try {
      await App.db.upsert("users", { ...user, active: nextActive });
      await App.reload();
      UI.success(nextActive ? "Akun diaktifkan" : "Akun dinonaktifkan", user.name);
      App.refreshPage();
    } catch (err) {
      App.handleError(err);
    }
  }

  async function deleteUser(user) {
    if (!requireOwner("manageUsers", "Hanya owner yang dapat menghapus akun.")) return;
    if (!user) return;
    if (App.user && user.id === App.user.id) {
      return UI.warning("Tidak dapat menghapus diri", "Akun yang sedang digunakan tidak dapat dihapus.");
    }
    const activeTasks = (App.data.orders || []).filter((order) => order.technicianId === user.id && U.isActiveOrder(order)).length;
    const ok = await UI.confirm({
      title: "Hapus akun?",
      heading: `Hapus ${user.name}?`,
      message: `Akun <strong>@${U.esc(user.username || "")}</strong> akan dihapus permanen. Riwayat servis tetap menyimpan nama teknisi sebagai catatan.`,
      detail: activeTasks ? `<span style="color:var(--warning)">${activeTasks} tugas aktif masih ditugaskan ke akun ini. Pindahkan tugas terlebih dahulu agar operasional tidak terhenti.</span>` : "",
      confirmText: "Hapus akun",
    });
    if (!ok) return;
    try {
      await App.db.remove("users", user.id);
      await App.reload();
      UI.success("Akun dihapus", `${user.name} tidak lagi memiliki akses.`);
      App.refreshPage();
    } catch (err) {
      App.handleError(err);
    }
  }

  function renderAccounts() {
    const users = [...(App.data.users || [])].sort((a, b) => {
      const roleCompare = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
      if (roleCompare) return roleCompare;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    const active = users.filter((user) => user.active !== false);
    const techs = active.filter((user) => user.role === "teknisi").length;
    const payroll = active.filter((user) => user.role !== "owner").reduce((sum, user) => sum + (Number(user.salary) || 0), 0);
    const owners = active.filter((user) => user.role === "owner").length;
    const rows = users.map((user) => {
      const isSelf = App.user && user.id === App.user.id;
      const tasks = (App.data.orders || []).filter((order) => order.technicianId === user.id && U.isActiveOrder(order)).length;
      return `<tr>
        <td><div class="table-user">${UI.avatar(user.name)}<div class="table-user-copy"><strong>${U.esc(user.name)}${isSelf ? ' <span class="badge badge-primary" style="font-size:8px;padding:1px 5px">Anda</span>' : ""}</strong><span>@${U.esc(user.username || "")}</span></div></div></td>
        <td>${UI.roleBadge(user.role)}</td>
        <td><span class="cell-primary" style="font-size:11px">${U.esc(user.phone || "—")}</span><span class="cell-sub">${U.esc(user.email || "Email belum diisi")}</span></td>
        <td>${user.role === "owner" ? '<span style="color:var(--muted);font-size:10px">Tidak diatur</span>' : `<span class="cell-money">${U.money(user.salary)}</span><span class="cell-sub">per bulan</span>`}</td>
        <td><span class="status-pill ${user.active === false ? "status-slate" : "status-green"}">${user.active === false ? "Nonaktif" : "Aktif"}</span>${tasks ? `<span class="cell-sub">${tasks} tugas aktif</span>` : ""}</td>
        <td class="cell-actions"><span class="row-actions">
          <button type="button" class="row-action primary" data-act="user.edit" data-id="${U.esc(user.id)}" title="Edit akun">${UI.icon("pencil", 14)}</button>
          ${isSelf ? '<span class="badge badge-neutral" style="font-size:8px">Sesi ini</span>' : `<button type="button" class="row-action" data-act="user.toggle" data-id="${U.esc(user.id)}" title="${user.active === false ? "Aktifkan" : "Nonaktifkan"}">${UI.icon(user.active === false ? "check-circle" : "toggle-left", 14)}</button>
            <button type="button" class="row-action danger" data-act="user.delete" data-id="${U.esc(user.id)}" title="Hapus akun">${UI.icon("trash", 14)}</button>`}
        </span></td>
      </tr>`;
    }).join("");

    return `<div class="report-summary">
      ${summaryCard("Total akun", "users", `${U.num(users.length)} <small style="font-size:10px;color:var(--muted);font-family:var(--font-sans);letter-spacing:0">pengguna</small>`, `${owners} owner aktif`)}
      ${summaryCard("Akun aktif", "check-circle", U.num(active.length), `${users.length - active.length} akun nonaktif`, "positive")}
      ${summaryCard("Teknisi", "wrench", U.num(techs), "Siap mengerjakan servis")}
      ${summaryCard("Payroll bulanan", "wallet", U.money(payroll), "Total gaji pokok tim", "highlight")}
    </div>
    <div class="settings-card">
      <div class="settings-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div><h3>Tim & hak akses</h3><p>Kelola akun, role, status, dan skema gaji. Hanya owner yang dapat mengubah data akun.</p></div>
        <button type="button" class="button button-primary button-sm" data-act="user.add">${UI.icon("user-plus", 14)} Tambah akun</button>
      </div>
      <div class="table-wrap"><table class="data-table" style="min-width:760px">
        <thead><tr><th>Pengguna</th><th>Role</th><th>Kontak</th><th>Gaji pokok</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="table-footer"><span>${U.num(users.length)} akun · ${U.num(active.length)} aktif</span><span>Perubahan role diterapkan saat pengguna memuat ulang aplikasi</span></div>
    </div>
    <div class="printer-note">${UI.icon("shield-check", 15)}<p><strong>Owner memiliki akses penuh.</strong> Teknisi hanya melihat tugas dan data operasional, kasir mengelola pembayaran, dan front desk menangani penerimaan barang serta pelanggan.</p></div>`;
  }

  /* =====================================================
     Profil perusahaan
     ===================================================== */

  function imageToLogo(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("File belum dipilih."));
      if (!/^image\//.test(file.type || "")) return reject(new Error("File harus berupa gambar PNG, JPG, atau WEBP."));
      if (file.size > 5 * 1024 * 1024) return reject(new Error("Ukuran file terlalu besar. Maksimal 5 MB."));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Gambar tidak dapat dibaca. Coba file lain."));
        img.onload = () => {
          const size = 180;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size, size);
          const scale = Math.min(size / img.width, size / img.height);
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          ctx.drawImage(img, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
          let data = canvas.toDataURL("image/jpeg", 0.84);
          if (data.length > 45000) data = canvas.toDataURL("image/jpeg", 0.62);
          if (data.length > 49000) return reject(new Error("Logo masih terlalu besar setelah dikompres. Gunakan gambar yang lebih sederhana."));
          resolve(data);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderCompany() {
    const settings = App.settings;
    return `<div class="settings-card">
      <form id="companyForm" novalidate>
        <div class="settings-head"><h3>Profil perusahaan</h3><p>Identitas ini tampil di sidebar, nota, dan halaman aplikasi.</p></div>
        <div class="settings-body">
          <div class="settings-grid-2">
            <div class="form-grid">
              <label class="field span-2"><span class="field-label">Nama perusahaan <span class="required">*</span></span>
                <input class="input" name="companyName" value="${U.esc(settings.companyName || "")}" placeholder="Nama usaha" required>
              </label>
              <label class="field span-2"><span class="field-label">Tagline</span>
                <input class="input" name="tagline" value="${U.esc(settings.tagline || "")}" placeholder="cth. Service Center HP, Laptop & Printer">
              </label>
              <label class="field"><span class="field-label">Nomor telepon</span>
                <input class="input" name="phone" inputmode="tel" value="${U.esc(settings.phone || "")}" placeholder="0812-xxxx-xxxx">
              </label>
              <label class="field"><span class="field-label">Email</span>
                <input class="input" name="email" type="email" value="${U.esc(settings.email || "")}" placeholder="halo@perusahaan.id">
              </label>
              <label class="field span-2"><span class="field-label">Website</span>
                <input class="input" name="website" value="${U.esc(settings.website || "")}" placeholder="perusahaan.id">
              </label>
              <label class="field span-2"><span class="field-label">Alamat lengkap</span>
                <textarea class="textarea" name="address" style="min-height:78px" placeholder="Alamat toko / service center">${U.esc(settings.address || "")}</textarea>
              </label>
            </div>
            <div>
              <div class="field">
                <span class="field-label">Logo perusahaan</span>
                <div class="avatar-upload">
                  <span class="logo-preview" id="logoPreview">${settings.logo ? `<img src="${U.esc(settings.logo)}" alt="Logo perusahaan">` : UI.icon("image", 25)}</span>
                  <div class="upload-actions">
                    <label for="logoFile">Unggah logo</label>
                    <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp">
                    <span>PNG / JPG · otomatis dikompres 180×180</span>
                    <button type="button" class="link-button" id="removeLogoBtn" style="text-align:left;font-size:10.5px;color:var(--danger);${settings.logo ? "" : "display:none"}">Hapus logo</button>
                  </div>
                </div>
                <span class="helper-text" id="logoUploadStatus">Logo tampil di sidebar dan nota.</span>
              </div>
              <div class="printer-note" style="margin-top:16px">${UI.icon("info", 15)}<p>Gunakan logo persegi dengan latar sederhana. Logo disimpan sebagai gambar terkompresi agar tetap ringan di Google Sheets.</p></div>
            </div>
          </div>
        </div>
        <div class="settings-foot">
          <span class="foot-left">Terakhir diperbarui ${U.esc(settings.updatedAt ? U.formatDateTime(settings.updatedAt) : "—")}</span>
          <button type="submit" class="button button-primary" id="saveCompanyBtn">${UI.icon("save", 15)} Simpan profil</button>
        </div>
      </form>
    </div>`;
  }

  /* =====================================================
     Tampilan
     ===================================================== */

  function renderAppearance() {
    const appearance = App.state.appearance || {};
    const mode = appearance.mode || "light";
    const primary = (appearance.primary || App.settings.primaryColor || "#0d9488").toLowerCase();
    const modes = [
      { id: "light", label: "Terang", hint: "Nyaman untuk ruangan terang", preview: "light" },
      { id: "dark", label: "Gelap", hint: "Mengurangi silau malam", preview: "dark" },
      { id: "system", label: "Ikuti sistem", hint: "Mengikuti perangkat", preview: "system" },
    ];
    return `<div class="settings-card">
      <div class="settings-head"><h3>Mode tampilan</h3><p>Pilih tema terang, gelap, atau ikuti pengaturan perangkat.</p></div>
      <div class="settings-body">
        <div class="theme-options">
          ${modes.map((item) => `<button type="button" class="theme-option ${mode === item.id ? "active" : ""}" data-act="settings.theme" data-mode="${item.id}">
            <span class="theme-option-preview ${item.preview}"><span class="theme-preview-bar"></span><span class="theme-preview-lines ${item.preview === "dark" ? "dark" : ""}"><i></i><i></i><i></i></span></span>
            <span class="theme-option-label"><strong>${item.label}</strong><span>${item.hint}</span></span>
          </button>`).join("")}
        </div>
      </div>
    </div>

    <div class="settings-card" style="margin-top:16px">
      <div class="settings-head"><h3>Warna aksen</h3><p>Warna utama untuk tombol, grafik, ikon aktif, dan sorotan antarmuka.</p></div>
      <div class="settings-body">
        <div class="settings-grid-2">
          <div>
            <div class="color-swatches">
              ${COLOR_PRESETS.map((color) => `<button type="button" class="color-swatch ${primary === color ? "active" : ""}" style="background:${color}" data-act="settings.color" data-color="${color}" title="${color}" aria-label="Pilih warna ${color}">${primary === color ? UI.icon("check", 14) : ""}</button>`).join("")}
              <span class="custom-color-wrap">
                <label for="customColor">Warna lain</label>
                <input class="custom-color-input" id="customColor" type="color" value="${/^#[0-9a-f]{6}$/.test(primary) ? primary : "#0d9488"}">
                <button type="button" class="button button-secondary button-sm" id="applyCustomColor">Terapkan</button>
              </span>
            </div>
            <div class="helper-text mt-2">Perubahan langsung diterapkan pada perangkat ini. Simpan sebagai default agar pengguna baru mengikuti tema yang sama.</div>
          </div>
          <div class="settings-preview" aria-hidden="true">
            <div class="settings-preview-top"><i></i><i></i><i></i><span>${U.esc(App.settings.companyName || "ServisPro")}</span></div>
            <div class="settings-preview-body">
              <div class="settings-preview-side"><i></i><i class="active"></i><i></i><i></i></div>
              <div class="settings-preview-main">
                <div class="settings-preview-kpis"><i></i><i></i><i></i></div>
                <div class="settings-preview-chart">${[36, 55, 44, 72, 63, 86, 52].map((height) => `<i style="height:${height}%"></i>`).join("")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="settings-foot">
        <span class="foot-left">Mode aktif: <strong style="color:var(--text-2)">${U.esc(mode === "system" ? "Ikuti sistem" : mode === "dark" ? "Gelap" : "Terang")}</strong></span>
        <button type="button" class="button button-secondary" data-act="settings.resetTheme">${UI.icon("refresh", 14)} Warna perusahaan</button>
        <button type="button" class="button button-primary" data-act="settings.saveTheme">${UI.icon("save", 15)} Jadikan default perusahaan</button>
      </div>
    </div>`;
  }

  /* =====================================================
     Nota & printer
     ===================================================== */

  function sampleReceiptOrder() {
    const now = U.nowISO();
    return {
      ticketNo: "SVC-PREVIEW-001",
      createdAt: now,
      paidAt: now,
      customerName: "Andi Pratama",
      deviceType: "laptop",
      brand: "Asus",
      model: "ROG Strix G15",
      complaint: "Keyboard tidak berfungsi",
      technicianName: "Rizky Maulana",
      status: "selesai",
      paymentStatus: "lunas",
      paymentMethod: "cash",
      serviceCost: 150000,
      partsCost: 250000,
      total: 400000,
    };
  }

  function readNotaForm(form) {
    return {
      receiptPaper: form.elements.receiptPaper.value === "58mm" ? "58mm" : "80mm",
      printerName: form.elements.printerName.value.trim(),
      receiptHeader: form.elements.receiptHeader.value.trim(),
      receiptFooter: form.elements.receiptFooter.value.trim(),
      receiptShowLogo: form.elements.receiptShowLogo.checked,
      receiptShowTechnician: form.elements.receiptShowTechnician.checked,
      autoPrint: form.elements.autoPrint.checked,
    };
  }

  function renderReceiptSettings() {
    const settings = App.settings;
    return `<div class="settings-card">
      <form id="notaForm" novalidate>
        <div class="settings-head"><h3>Nota & printer</h3><p>Atur ukuran kertas, isi nota, dan perilaku cetak setelah pembayaran.</p></div>
        <div class="settings-body">
          <div class="receipt-settings-grid">
            <div class="form-grid">
              <label class="field"><span class="field-label">Ukuran kertas</span>
                <select class="select" name="receiptPaper">
                  <option value="80mm" ${settings.receiptPaper !== "58mm" ? "selected" : ""}>Thermal 80 mm</option>
                  <option value="58mm" ${settings.receiptPaper === "58mm" ? "selected" : ""}>Thermal 58 mm</option>
                </select>
              </label>
              <label class="field"><span class="field-label">Nama printer</span>
                <input class="input" name="printerName" value="${U.esc(settings.printerName || "")}" placeholder="cth. Printer Thermal Kasir">
                <span class="helper-text">Nama internal; pemilihan printer ada di dialog cetak browser.</span>
              </label>
              <label class="field span-2"><span class="field-label">Ucapan terima kasih</span>
                <textarea class="textarea" name="receiptHeader" style="min-height:66px" placeholder="Terima kasih atas kepercayaan Anda.">${U.esc(settings.receiptHeader || "")}</textarea>
              </label>
              <label class="field span-2"><span class="field-label">Catatan tambahan</span>
                <textarea class="textarea" name="receiptFooter" style="min-height:66px" placeholder="Garansi servis 30 hari.">${U.esc(settings.receiptFooter || "")}</textarea>
              </label>
              <div class="field span-2">
                <span class="field-label">Elemen nota</span>
                <label class="check-row"><input type="checkbox" name="receiptShowLogo" ${settings.receiptShowLogo !== false ? "checked" : ""}> <span>Tampilkan logo perusahaan${settings.logo ? "" : " (logo belum diatur)"}</span></label>
                <label class="check-row"><input type="checkbox" name="receiptShowTechnician" ${settings.receiptShowTechnician !== false ? "checked" : ""}> <span>Tampilkan nama teknisi</span></label>
                <label class="check-row"><input type="checkbox" name="autoPrint" ${settings.autoPrint ? "checked" : ""}> <span>Sarankan cetak otomatis setelah pembayaran lunas</span></label>
              </div>
            </div>
            <div>
              <div class="field-label-row" style="margin-bottom:7px"><span class="field-label" style="margin:0">Pratinjau nota</span><span class="badge badge-neutral">${settings.receiptPaper === "58mm" ? "58 mm" : "80 mm"}</span></div>
              <div class="receipt-preview-panel">${UI.receiptHTML(sampleReceiptOrder(), settings)}</div>
              <span class="helper-text">Pratinjau mengikuti pengaturan tersimpan. Gunakan tombol preview untuk menguji perubahan.</span>
            </div>
          </div>
          <div class="printer-note">${UI.icon("printer", 15)}<p><strong>Tips cetak thermal:</strong> pilih printer yang benar di dialog cetak, atur margin minimum, matikan header dan footer browser, lalu simpan sebagai default bila tersedia.</p></div>
        </div>
        <div class="settings-foot">
          <button type="button" class="button button-secondary" id="previewNotaBtn">${UI.icon("eye", 15)} Preview &amp; cetak</button>
          <button type="submit" class="button button-primary" id="saveNotaBtn">${UI.icon("save", 15)} Simpan pengaturan</button>
        </div>
      </form>
    </div>`;
  }

  /* =====================================================
     Integrasi
     ===================================================== */

  function renderIntegration() {
    const remote = App.db.mode === "remote";
    const apiUrl = SPData.getApiUrl();
    let host = "Google Apps Script";
    if (remote && apiUrl) {
      try { host = new URL(apiUrl).hostname; } catch (err) { /* biarkan label default */ }
    }
    return `<div class="settings-card">
      <div class="settings-head"><h3>Database aplikasi</h3><p>Gunakan mode demo lokal atau hubungkan Google Sheets melalui Apps Script.</p></div>
      <div class="settings-body">
        <div class="integration-status">
          <span class="integration-status-icon ${remote ? "success" : ""}">${UI.icon(remote ? "cloud" : "database", 17)}</span>
          <div class="integration-status-copy"><strong>${remote ? "Mode Google Sheets aktif" : "Mode demo lokal"}</strong><span>${remote ? U.esc(apiUrl) : "Data tersimpan di browser perangkat ini."}</span></div>
          <span class="badge ${remote ? "badge-success" : "badge-neutral"}">${remote ? "Cloud" : "Demo"}</span>
        </div>
        <div class="mt-3" style="display:flex;gap:8px;flex-wrap:wrap">
          ${remote
            ? `<button type="button" class="button button-secondary" data-act="settings.test">${UI.icon("refresh", 14)} Uji koneksi</button>
               <button type="button" class="button button-primary" data-act="settings.connect">${UI.icon("link", 15)} Kelola koneksi</button>`
            : `<button type="button" class="button button-primary" data-act="settings.connect">${UI.icon("cloud", 15)} Hubungkan Google Sheets</button>
               <button type="button" class="button button-secondary" data-act="settings.test">${UI.icon("refresh", 14)} Cek mode data</button>`}
        </div>
        <div class="printer-note">${UI.icon("info", 15)}<p>${remote
          ? `Data operasional disimpan di spreadsheet melalui <strong>${U.esc(host)}</strong>. Setiap perubahan dikirim ke Apps Script dan memerlukan koneksi internet.`
          : "Data demo tidak berpindah otomatis ke Google Sheets. Setelah terhubung, aplikasi akan memuat data dari spreadsheet dan meminta login akun cloud."}</p></div>
      </div>
    </div>

    <div class="settings-card" style="margin-top:16px">
      <div class="settings-head"><h3>Panduan koneksi Google Sheets</h3><p>Ikuti langkah berikut satu kali untuk menyiapkan database cloud.</p></div>
      <div class="settings-body">
        <div class="setup-steps">
          <div class="setup-step"><span class="setup-step-num">1</span><div class="setup-step-copy"><strong>Buat spreadsheet baru</strong><p>Buka Google Sheets, buat file database, lalu pilih <code>Extensions → Apps Script</code>.</p></div></div>
          <div class="setup-step"><span class="setup-step-num">2</span><div class="setup-step-copy"><strong>Tempel backend ServisPro</strong><p>Salin isi <code>apps-script/Code.gs</code> ke editor Apps Script, lalu simpan.</p></div></div>
          <div class="setup-step"><span class="setup-step-num">3</span><div class="setup-step-copy"><strong>Jalankan setup()</strong><p>Jalankan fungsi <code>setup()</code> satu kali untuk membuat sheet, data awal, dan akun owner.</p></div></div>
          <div class="setup-step"><span class="setup-step-num">4</span><div class="setup-step-copy"><strong>Deploy Web App</strong><p>Pilih <code>Deploy → New deployment → Web app</code>. Execute as <code>Me</code>, akses <code>Anyone</code>.</p></div></div>
          <div class="setup-step"><span class="setup-step-num">5</span><div class="setup-step-copy"><strong>Hubungkan aplikasi</strong><p>Salin URL yang berakhiran <code>/exec</code>, tekan Hubungkan Google Sheets, lalu uji koneksi.</p></div></div>
        </div>
        <div class="code-block"><code>https://script.google.com/macros/s/&lt;DEPLOYMENT_ID&gt;/exec</code><button type="button" class="code-copy" id="copyEndpointHint">contoh</button></div>
      </div>
    </div>

    <div class="danger-zone">
      <h4>${UI.icon("alert-triangle", 14)} Zona berbahaya</h4>
      <p>${remote ? "Reset data hanya tersedia pada mode demo lokal. Data Google Sheets tidak dapat direset dari aplikasi." : "Reset akan menghapus seluruh perubahan lokal dan memuat kembali data contoh bawaan."}</p>
      ${remote ? "" : `<button type="button" class="button button-danger-soft button-sm" data-act="settings.resetDemo">${UI.icon("rotate", 14)} Reset data demo</button>`}
    </div>`;
  }

  /* =====================================================
     Mount per tab
     ===================================================== */

  function mountCompany() {
    const form = document.querySelector("#companyForm");
    if (!form) return;
    let logoData = App.settings.logo || "";
    const preview = document.querySelector("#logoPreview");
    const status = document.querySelector("#logoUploadStatus");
    const removeBtn = document.querySelector("#removeLogoBtn");
    const fileInput = document.querySelector("#logoFile");

    const paintLogo = () => {
      if (preview) preview.innerHTML = logoData ? `<img src="${U.esc(logoData)}" alt="Logo perusahaan">` : UI.icon("image", 25);
      if (removeBtn) removeBtn.style.display = logoData ? "" : "none";
    };

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        logoData = "";
        paintLogo();
        if (status) status.textContent = "Logo akan dihapus saat profil disimpan.";
        if (fileInput) fileInput.value = "";
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (status) status.textContent = "Memproses logo…";
        try {
          logoData = await imageToLogo(file);
          paintLogo();
          if (status) status.textContent = `Logo siap disimpan · sekitar ${Math.max(1, Math.round(logoData.length / 1024))} KB.`;
        } catch (err) {
          fileInput.value = "";
          if (status) status.textContent = "Logo tampil di sidebar dan nota.";
          UI.error("Gagal memuat logo", err.message);
        }
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const btn = document.querySelector("#saveCompanyBtn");
      const companyName = form.elements.companyName.value.trim();
      const phone = form.elements.phone.value.trim();
      const email = form.elements.email.value.trim();
      if (!companyName) return UI.warning("Nama perusahaan wajib diisi", "Masukkan nama usaha yang tampil di aplikasi.");
      if (phone && !U.isValidPhone(phone)) return UI.warning("Nomor tidak valid", "Masukkan minimal 8 digit nomor telepon.");
      if (email && !U.isValidEmail(email)) return UI.warning("Email tidak valid", "Periksa kembali format email perusahaan.");
      UI.setLoading(btn, true, "Menyimpan…");
      try {
        await App.saveSettings({
          companyName,
          tagline: form.elements.tagline.value.trim(),
          phone,
          email,
          website: form.elements.website.value.trim(),
          address: form.elements.address.value.trim(),
          logo: logoData,
        });
        UI.success("Profil perusahaan disimpan", "Identitas baru langsung diterapkan di aplikasi dan nota.");
        App.refreshPage();
      } catch (err) {
        UI.setLoading(btn, false);
        App.handleError(err);
      }
    });
  }

  function mountAppearance() {
    const input = document.querySelector("#customColor");
    const apply = document.querySelector("#applyCustomColor");
    if (!input || !apply) return;
    apply.addEventListener("click", () => {
      const color = String(input.value || "").toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(color)) return UI.warning("Warna tidak valid", "Pilih warna menggunakan pemilih warna.");
      App.setAppearance({ primary: color });
    });
  }

  function mountNota() {
    const form = document.querySelector("#notaForm");
    if (!form) return;
    const previewBtn = document.querySelector("#previewNotaBtn");
    if (previewBtn) {
      previewBtn.addEventListener("click", () => {
        const values = readNotaForm(form);
        UI.showReceiptModal(sampleReceiptOrder(), { ...App.settings, ...values });
      });
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const btn = document.querySelector("#saveNotaBtn");
      const values = readNotaForm(form);
      UI.setLoading(btn, true, "Menyimpan…");
      try {
        await App.saveSettings(values);
        UI.success("Pengaturan nota disimpan", `Format ${values.receiptPaper === "58mm" ? "58 mm" : "80 mm"} siap digunakan.`);
        App.refreshPage();
      } catch (err) {
        UI.setLoading(btn, false);
        App.handleError(err);
      }
    });
  }

  async function testConnection(el) {
    if (!requireOwner()) return;
    UI.setLoading(el, true, "Menguji…");
    try {
      const result = await App.db.testConnection();
      UI.success("Koneksi berhasil", result.message);
    } catch (err) {
      App.handleError(err);
    } finally {
      UI.setLoading(el, false);
    }
  }

  async function resetDemo() {
    if (!requireOwner()) return;
    if (App.db.mode === "remote") return UI.warning("Tidak tersedia", "Reset data demo hanya tersedia pada mode lokal.");
    const ok = await UI.confirm({
      title: "Reset data demo?",
      heading: "Kembalikan data contoh?",
      message: "Seluruh pelanggan, tiket, kas, dan perubahan pengaturan lokal akan dihapus lalu diganti data contoh bawaan. Tindakan ini tidak dapat dibatalkan.",
      confirmText: "Reset data demo",
    });
    if (!ok) return;
    try {
      await App.db.resetDemo();
      SPData.clearSession();
      UI.success("Data demo direset", "Memuat ulang aplikasi…");
      setTimeout(() => location.reload(), 550);
    } catch (err) {
      App.handleError(err);
    }
  }

  /* =====================================================
     Halaman
     ===================================================== */

  App.registerPage("settings", {
    label: "Pengaturan",
    navLabel: "Pengaturan",
    group: "Sistem",
    icon: "settings",
    render() {
      if (!App.can("manageSettings")) {
        return UI.pageHead({ kicker: "Sistem", title: "Akses dibatasi", subtitle: "Halaman pengaturan hanya dapat dibuka oleh owner." });
      }
      const tab = activeTab();
      let content = "";
      if (tab === "akun") content = renderAccounts();
      else if (tab === "perusahaan") content = renderCompany();
      else if (tab === "tampilan") content = renderAppearance();
      else if (tab === "nota") content = renderReceiptSettings();
      else content = renderIntegration();

      const nav = TABS.map((item) => `<button type="button" class="${tab === item.id ? "active" : ""}" data-act="settings.tab" data-tab="${item.id}">${UI.icon(item.icon, 16)} <span>${U.esc(item.label)}</span></button>`).join("");

      return `${UI.pageHead({
        kicker: "Sistem",
        title: "Pengaturan",
        subtitle: "Kelola akun tim, identitas perusahaan, tampilan, nota, dan koneksi database.",
        actions: `<span class="badge ${App.db.mode === "remote" ? "badge-success" : "badge-neutral"}">${UI.icon(App.db.mode === "remote" ? "cloud" : "database", 12)} ${App.db.mode === "remote" ? "Google Sheets" : "Demo lokal"}</span>`,
      })}
      <div class="settings-layout">
        <nav class="settings-nav" aria-label="Bagian pengaturan">${nav}</nav>
        <div class="settings-content">${content}</div>
      </div>`;
    },
    mount() {
      const tab = activeTab();
      if (tab === "perusahaan") mountCompany();
      else if (tab === "tampilan") mountAppearance();
      else if (tab === "nota") mountNota();
      const copyHint = document.querySelector("#copyEndpointHint");
      if (copyHint) {
        copyHint.addEventListener("click", () => UI.info("Contoh format URL", "URL asli didapat dari hasil deploy Web App Apps Script dan selalu berakhiran /exec."));
      }
    },
  });

  App.registerActions({
    "settings.tab": (data) => {
      if (!TABS.some((tab) => tab.id === data.tab)) return;
      App.state.filters.settings.tab = data.tab;
      App.renderPage();
    },
    "user.add": () => openUserForm(null),
    "user.edit": (data) => {
      const user = (App.data.users || []).find((row) => row.id === data.id);
      if (user) openUserForm(user);
    },
    "user.toggle": (data) => {
      const user = (App.data.users || []).find((row) => row.id === data.id);
      if (user) toggleUser(user);
    },
    "user.delete": (data) => {
      const user = (App.data.users || []).find((row) => row.id === data.id);
      if (user) deleteUser(user);
    },
    "settings.theme": (data) => {
      if (!["light", "dark", "system"].includes(data.mode)) return;
      App.setAppearance({ mode: data.mode });
    },
    "settings.color": (data) => {
      if (!/^#[0-9a-f]{6}$/i.test(String(data.color || ""))) return;
      App.setAppearance({ primary: String(data.color).toLowerCase() });
    },
    "settings.resetTheme": () => {
      if (!requireOwner()) return;
      App.setAppearance({ primary: App.settings.primaryColor || "#0d9488" });
      UI.info("Warna dikembalikan", "Menggunakan warna perusahaan yang tersimpan.");
    },
    "settings.saveTheme": async () => {
      if (!requireOwner()) return;
      try {
        await App.saveSettings({
          primaryColor: App.state.appearance.primary || "#0d9488",
          themeDefault: App.state.appearance.mode || "light",
        });
        UI.success("Tema perusahaan disimpan", "Pengguna baru pada perangkat baru akan mengikuti tema ini.");
      } catch (err) {
        App.handleError(err);
      }
    },
    "settings.connect": () => App.openConnectionModal(),
    "settings.test": (data, el) => testConnection(el),
    "settings.resetDemo": () => resetDemo(),
  });
})();
