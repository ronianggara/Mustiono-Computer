/* Data pelanggan & supplier */
(function () {
  "use strict";

  function allOrders() {
    return App.data.orders || [];
  }

  function customerOrders(customerId) {
    return allOrders().filter((o) => o.customerId === customerId);
  }

  function supplierOrders(supplierId) {
    return allOrders().filter((o) => o.supplierId === supplierId);
  }

  function moneyVisible() {
    return App.user && App.user.role !== "teknisi";
  }

  function lastOrderOf(orders) {
    return [...orders].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0] || null;
  }

  function paidByCustomer(customerId) {
    return allOrders().filter((o) => o.customerId === customerId && o.paymentStatus === "lunas");
  }

  function waLink(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    const normalized = digits.startsWith("0") ? "62" + digits.slice(1) : digits.startsWith("62") ? digits : "62" + digits;
    return `https://wa.me/${normalized}`;
  }

  function orderMiniList(orders) {
    if (!orders.length) return '<div class="tech-empty">Belum ada riwayat servis.</div>';
    return [...orders].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 6).map((order) => `<button type="button" class="attention-item" data-act="order.view" data-id="${U.esc(order.id)}">
      <span class="attention-icon ${order.status === "selesai" ? "success" : order.status === "batal" ? "danger" : "info"}">${UI.icon(U.deviceMeta(order.deviceType).icon, 14)}</span>
      <span class="attention-copy">
        <strong>${U.esc(order.ticketNo)} · ${U.esc(UI.deviceName(order))}</strong>
        <span>${U.esc(U.formatShortDate(order.createdAt))} · ${U.esc(U.statusMeta(order.status).label)}</span>
      </span>
      ${moneyVisible() ? `<span class="cell-money">${U.money(order.total)}</span>` : UI.icon("chevron-right", 13)}
    </button>`).join("");
  }

  function summaryCard(label, iconName, value, foot, tone) {
    return `<div class="summary-card ${tone || ""}"><span>${UI.icon(iconName, 13)} ${U.esc(label)}</span><strong>${value}</strong><small>${U.esc(foot)}</small></div>`;
  }

  /* =====================================================
     Pelanggan
     ===================================================== */

  function openCustomerForm(customer) {
    if (!App.can("customerManage")) return UI.warning("Akses dibatasi", "Role Anda tidak dapat mengubah data pelanggan.");
    const c = customer || {};
    const isEdit = !!customer;
    UI.openModal({
      title: isEdit ? "Edit pelanggan" : "Tambah pelanggan",
      subtitle: isEdit ? `Perbarui data kontak ${customer.name}.` : "Simpan kontak pelanggan agar mudah dihubungi kembali.",
      iconName: isEdit ? "pencil" : "user-plus",
      size: "sm",
      body: `<form id="customerForm" novalidate>
        <div class="form-grid">
          <label class="field span-2"><span class="field-label">Nama lengkap <span class="required">*</span></span><input class="input" name="name" value="${U.esc(c.name || "")}" placeholder="Nama pelanggan" required></label>
          <label class="field span-2"><span class="field-label">Nomor WhatsApp <span class="required">*</span></span><input class="input" name="phone" inputmode="tel" value="${U.esc(c.phone || "")}" placeholder="08xx-xxxx-xxxx" required></label>
          <label class="field span-2"><span class="field-label">Email</span><input class="input" name="email" type="email" value="${U.esc(c.email || "")}" placeholder="nama@email.com"></label>
          <label class="field span-2"><span class="field-label">Alamat</span><textarea class="textarea" name="address" style="min-height:70px" placeholder="Alamat pelanggan">${U.esc(c.address || "")}</textarea></label>
          <label class="field span-2"><span class="field-label">Catatan</span><textarea class="textarea" name="notes" style="min-height:60px" placeholder="Preferensi komunikasi, instruksi khusus, dll.">${U.esc(c.notes || "")}</textarea></label>
        </div>
      </form>`,
      footer: `<button type="button" class="button button-secondary" data-close>Batal</button>
        <button type="submit" form="customerForm" class="button button-primary" id="saveCustomerBtn">${UI.icon("save", 15)} ${isEdit ? "Simpan perubahan" : "Tambah pelanggan"}</button>`,
      onMount: (overlay) => {
        const form = overlay.querySelector("#customerForm");
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const btn = overlay.querySelector("#saveCustomerBtn");
          const name = form.elements.name.value.trim();
          const phone = form.elements.phone.value.trim();
          const email = form.elements.email.value.trim();
          if (!name) return UI.warning("Nama wajib diisi", "Masukkan nama lengkap pelanggan.");
          if (!U.isValidPhone(phone)) return UI.warning("Nomor tidak valid", "Masukkan minimal 8 digit nomor WhatsApp.");
          if (email && !U.isValidEmail(email)) return UI.warning("Email tidak valid", "Periksa kembali alamat email pelanggan.");
          UI.setLoading(btn, true, "Menyimpan…");
          try {
            const saved = await App.db.upsert("customers", {
              ...(customer || {}),
              name,
              phone,
              email,
              address: form.elements.address.value.trim(),
              notes: form.elements.notes.value.trim(),
            });
            await App.reload();
            UI.closeOverlay();
            App.refreshPage();
            UI.success(isEdit ? "Pelanggan diperbarui" : "Pelanggan ditambahkan", saved.name);
          } catch (err) {
            UI.error("Gagal menyimpan pelanggan", err.message);
          } finally {
            UI.setLoading(btn, false);
          }
        });
      },
    });
  }

  function openCustomerDetail(customerId) {
    const customer = U.customerById(App.data.customers || [], customerId);
    if (!customer) return UI.error("Pelanggan tidak ditemukan", "Data mungkin sudah dihapus.");
    const orders = customerOrders(customer.id);
    const active = orders.filter(U.isActiveOrder);
    const paid = orders.filter((o) => o.paymentStatus === "lunas");
    const totalSpent = paid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const last = lastOrderOf(orders);
    const footer = [];
    if (App.user.role === "owner") footer.push(`<button type="button" class="button button-danger-soft button-sm" data-act="customer.delete" data-id="${U.esc(customer.id)}">${UI.icon("trash", 14)} Hapus</button>`);
    footer.push('<span class="spacer"></span>');
    const wa = waLink(customer.phone);
    if (wa) footer.push(`<a class="button button-secondary button-sm" href="${U.esc(wa)}" target="_blank" rel="noopener">${UI.icon("message-square", 15)} WhatsApp</a>`);
    if (App.can("orderCreate")) footer.push(`<button type="button" class="button button-secondary button-sm" data-act="order.add" data-customer-id="${U.esc(customer.id)}">${UI.icon("plus", 15)} Servis baru</button>`);
    if (App.can("customerManage")) footer.push(`<button type="button" class="button button-primary button-sm" data-act="customer.edit" data-id="${U.esc(customer.id)}">${UI.icon("pencil", 15)} Edit</button>`);

    UI.openDrawer({
      title: customer.name,
      subtitle: `${U.num(orders.length)} riwayat servis · pelanggan sejak ${U.esc(U.formatShortDate(customer.createdAt))}`,
      body: `<div class="detail-hero">
        <span class="avatar avatar-square-lg">${U.esc(U.initials(customer.name))}</span>
        <div class="detail-hero-copy">
          <strong>${U.esc(customer.name)}</strong>
          <span>${U.esc(customer.phone || "Nomor belum diisi")}</span>
        </div>
        <div class="detail-hero-status"><span class="badge badge-primary">Pelanggan</span>${active.length ? `<span class="badge badge-warning">${active.length} servis aktif</span>` : ""}</div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title"><span>${UI.icon("id-card", 15)}</span><strong>Kontak & alamat</strong></div>
        <div class="detail-grid">
          <div class="detail-item"><span>Telepon</span><strong>${U.esc(customer.phone || "—")}</strong></div>
          <div class="detail-item"><span>Email</span><strong>${U.esc(customer.email || "—")}</strong></div>
          <div class="detail-item full"><span>Alamat</span><strong>${U.esc(customer.address || "—")}</strong></div>
          <div class="detail-item"><span>Terdaftar</span><strong>${U.esc(U.formatDate(customer.createdAt))}</strong></div>
          <div class="detail-item"><span>Servis terakhir</span><strong>${last ? U.esc(U.formatShortDate(last.createdAt)) : "—"}</strong></div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title"><span>${UI.icon("bar-chart", 15)}</span><strong>Ringkasan pelanggan</strong></div>
        <div class="detail-grid">
          <div class="detail-item"><span>Total servis</span><strong>${U.num(orders.length)} tiket</strong></div>
          <div class="detail-item"><span>Servis aktif</span><strong>${U.num(active.length)} tiket</strong></div>
          <div class="detail-item"><span>Servis lunas</span><strong>${U.num(paid.length)} tiket</strong></div>
          ${moneyVisible() ? `<div class="detail-item"><span>Total transaksi</span><strong>${U.money(totalSpent)}</strong></div>` : `<div class="detail-item"><span>Status</span><strong>Pelanggan terdaftar</strong></div>`}
        </div>
      </div>
      ${customer.notes ? `<div class="detail-section"><div class="detail-section-title"><span>${UI.icon("message-square", 15)}</span><strong>Catatan</strong></div><div class="detail-note"><p>${U.esc(customer.notes)}</p></div></div>` : ""}
      <div class="detail-section">
        <div class="detail-section-title"><span>${UI.icon("history", 15)}</span><strong>Riwayat servis</strong></div>
        <div class="attention-list" style="padding:0">${orderMiniList(orders)}</div>
        ${orders.length > 6 ? `<div class="helper-text mt-2">Menampilkan 6 servis terbaru. Buka papan servis untuk melihat seluruh tiket.</div>` : ""}
      </div>`,
      footer: footer.join(""),
    });
  }

  function openCustomerDelete(customerId) {
    if (App.user.role !== "owner") return UI.warning("Akses dibatasi", "Hanya owner yang dapat menghapus pelanggan.");
    const customer = U.customerById(App.data.customers || [], customerId);
    if (!customer) return;
    const orders = customerOrders(customerId);
    if (orders.length) {
      return UI.warning("Pelanggan tidak dapat dihapus", `${customer.name} memiliki ${orders.length} riwayat servis. Riwayat transaksi harus tetap tersimpan.`);
    }
    UI.confirm({
      title: "Hapus pelanggan",
      heading: "Hapus data pelanggan ini?",
      message: "Data kontak akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.",
      detail: `${U.esc(customer.name)}<br>${U.esc(customer.phone || "Tanpa nomor telepon")}`,
      confirmText: "Hapus pelanggan",
      iconName: "trash",
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await App.db.remove("customers", customerId);
        await App.reload();
        UI.closeOverlay();
        App.refreshPage();
        UI.success("Pelanggan dihapus", customer.name);
      } catch (err) {
        UI.error("Gagal menghapus pelanggan", err.message);
      }
    });
  }

  function exportCustomers(list) {
    if (App.user.role === "teknisi") return UI.warning("Akses dibatasi", "Ekspor data pelanggan tidak tersedia untuk teknisi.");
    const rows = [["Nama", "Telepon", "Email", "Alamat", "Catatan", "Total servis", "Servis aktif", "Total transaksi", "Terakhir servis"]];
    list.forEach((c) => {
      const orders = customerOrders(c.id);
      const active = orders.filter(U.isActiveOrder).length;
      const paid = orders.filter((o) => o.paymentStatus === "lunas");
      const spent = paid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const last = lastOrderOf(orders);
      rows.push([c.name, c.phone || "", c.email || "", c.address || "", c.notes || "", orders.length, active, spent, last ? U.formatDate(last.createdAt) : ""]);
    });
    U.downloadCSV(`pelanggan-${U.todayISO()}.csv`, rows);
    UI.success("Ekspor selesai", `${list.length} pelanggan diunduh sebagai CSV.`);
  }

  /* =====================================================
     Supplier
     ===================================================== */

  function openSupplierForm(supplier) {
    if (!App.can("supplierManage")) return UI.warning("Akses dibatasi", "Hanya owner yang dapat mengelola supplier.");
    const s = supplier || {};
    const isEdit = !!supplier;
    UI.openModal({
      title: isEdit ? "Edit supplier" : "Tambah supplier",
      subtitle: isEdit ? `Perbarui data ${supplier.name}.` : "Catat mitra penyedia sparepart dan consumable.",
      iconName: isEdit ? "pencil" : "truck",
      size: "sm",
      body: `<form id="supplierForm" novalidate>
        <div class="form-grid">
          <label class="field span-2"><span class="field-label">Nama supplier <span class="required">*</span></span><input class="input" name="name" value="${U.esc(s.name || "")}" placeholder="Nama perusahaan / toko" required></label>
          <label class="field"><span class="field-label">Nama kontak</span><input class="input" name="contact" value="${U.esc(s.contact || "")}" placeholder="Sales / PIC"></label>
          <label class="field"><span class="field-label">Telepon</span><input class="input" name="phone" inputmode="tel" value="${U.esc(s.phone || "")}" placeholder="08xx / 021-…"></label>
          <label class="field span-2"><span class="field-label">Email</span><input class="input" name="email" type="email" value="${U.esc(s.email || "")}" placeholder="sales@supplier.com"></label>
          <label class="field span-2"><span class="field-label">Alamat</span><textarea class="textarea" name="address" style="min-height:70px" placeholder="Alamat supplier">${U.esc(s.address || "")}</textarea></label>
          <label class="field span-2"><span class="field-label">Catatan</span><textarea class="textarea" name="notes" style="min-height:60px" placeholder="Termin pembayaran, jenis sparepart, dll.">${U.esc(s.notes || "")}</textarea></label>
        </div>
      </form>`,
      footer: `<button type="button" class="button button-secondary" data-close>Batal</button>
        <button type="submit" form="supplierForm" class="button button-primary" id="saveSupplierBtn">${UI.icon("save", 15)} ${isEdit ? "Simpan perubahan" : "Tambah supplier"}</button>`,
      onMount: (overlay) => {
        const form = overlay.querySelector("#supplierForm");
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const btn = overlay.querySelector("#saveSupplierBtn");
          const name = form.elements.name.value.trim();
          const phone = form.elements.phone.value.trim();
          const email = form.elements.email.value.trim();
          if (!name) return UI.warning("Nama supplier wajib diisi", "Masukkan nama perusahaan atau toko supplier.");
          if (phone && !U.isValidPhone(phone)) return UI.warning("Telepon tidak valid", "Masukkan minimal 8 digit nomor telepon.");
          if (email && !U.isValidEmail(email)) return UI.warning("Email tidak valid", "Periksa kembali alamat email supplier.");
          UI.setLoading(btn, true, "Menyimpan…");
          try {
            const saved = await App.db.upsert("suppliers", {
              ...(supplier || {}),
              name,
              contact: form.elements.contact.value.trim(),
              phone,
              email,
              address: form.elements.address.value.trim(),
              notes: form.elements.notes.value.trim(),
            });
            await App.reload();
            UI.closeOverlay();
            App.refreshPage();
            UI.success(isEdit ? "Supplier diperbarui" : "Supplier ditambahkan", saved.name);
          } catch (err) {
            UI.error("Gagal menyimpan supplier", err.message);
          } finally {
            UI.setLoading(btn, false);
          }
        });
      },
    });
  }

  function openSupplierDetail(supplierId) {
    const supplier = (App.data.suppliers || []).find((s) => s.id === supplierId);
    if (!supplier) return UI.error("Supplier tidak ditemukan", "Data mungkin sudah dihapus.");
    const orders = supplierOrders(supplier.id);
    const paid = orders.filter((o) => o.paymentStatus === "lunas");
    const partsValue = paid.reduce((sum, o) => sum + (Number(o.partsCost) || 0), 0);
    const active = orders.filter(U.isActiveOrder);
    const footer = `<button type="button" class="button button-danger-soft button-sm" data-act="supplier.delete" data-id="${U.esc(supplier.id)}">${UI.icon("trash", 14)} Hapus</button>
      <span class="spacer"></span>
      <button type="button" class="button button-secondary button-sm" data-act="supplier.edit" data-id="${U.esc(supplier.id)}">${UI.icon("pencil", 15)} Edit</button>`;

    UI.openDrawer({
      title: supplier.name,
      subtitle: supplier.contact ? `PIC ${supplier.contact}` : "Mitra penyedia sparepart",
      body: `<div class="detail-hero">
        <span class="device-icon pc" style="width:42px;height:42px;border-radius:11px">${UI.icon("truck", 20)}</span>
        <div class="detail-hero-copy"><strong>${U.esc(supplier.name)}</strong><span>${U.esc(supplier.contact || "Kontak belum diisi")}</span></div>
        <div class="detail-hero-status"><span class="badge badge-primary">Supplier</span></div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title"><span>${UI.icon("id-card", 15)}</span><strong>Kontak & alamat</strong></div>
        <div class="detail-grid">
          <div class="detail-item"><span>Kontak</span><strong>${U.esc(supplier.contact || "—")}</strong></div>
          <div class="detail-item"><span>Telepon</span><strong>${U.esc(supplier.phone || "—")}</strong></div>
          <div class="detail-item"><span>Email</span><strong>${U.esc(supplier.email || "—")}</strong></div>
          <div class="detail-item"><span>Terdaftar</span><strong>${U.esc(U.formatDate(supplier.createdAt))}</strong></div>
          <div class="detail-item full"><span>Alamat</span><strong>${U.esc(supplier.address || "—")}</strong></div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title"><span>${UI.icon("bar-chart", 15)}</span><strong>Kontribusi supplier</strong></div>
        <div class="detail-grid">
          <div class="detail-item"><span>Servis terkait</span><strong>${U.num(orders.length)} tiket</strong></div>
          <div class="detail-item"><span>Servis aktif</span><strong>${U.num(active.length)} tiket</strong></div>
          <div class="detail-item"><span>HPP lunas</span><strong>${U.money(partsValue)}</strong></div>
          <div class="detail-item"><span>Transaksi lunas</span><strong>${U.num(paid.length)} tiket</strong></div>
        </div>
      </div>
      ${supplier.notes ? `<div class="detail-section"><div class="detail-section-title"><span>${UI.icon("message-square", 15)}</span><strong>Catatan</strong></div><div class="detail-note"><p>${U.esc(supplier.notes)}</p></div></div>` : ""}
      <div class="detail-section">
        <div class="detail-section-title"><span>${UI.icon("history", 15)}</span><strong>Servis menggunakan supplier ini</strong></div>
        <div class="attention-list" style="padding:0">${orderMiniList(orders)}</div>
        ${orders.length > 6 ? `<div class="helper-text mt-2">Menampilkan 6 servis terbaru.</div>` : ""}
      </div>`,
      footer,
    });
  }

  function openSupplierDelete(supplierId) {
    if (!App.can("supplierManage")) return UI.warning("Akses dibatasi", "Hanya owner yang dapat menghapus supplier.");
    const supplier = (App.data.suppliers || []).find((s) => s.id === supplierId);
    if (!supplier) return;
    const linked = supplierOrders(supplierId);
    if (linked.length) {
      return UI.warning("Supplier masih digunakan", `${supplier.name} terhubung dengan ${linked.length} tiket servis. Pindahkan atau kosongkan supplier pada tiket tersebut terlebih dahulu.`);
    }
    UI.confirm({
      title: "Hapus supplier",
      heading: "Hapus data supplier ini?",
      message: "Data kontak supplier akan dihapus permanen.",
      detail: U.esc(supplier.name),
      confirmText: "Hapus supplier",
      iconName: "trash",
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await App.db.remove("suppliers", supplierId);
        await App.reload();
        UI.closeOverlay();
        App.refreshPage();
        UI.success("Supplier dihapus", supplier.name);
      } catch (err) {
        UI.error("Gagal menghapus supplier", err.message);
      }
    });
  }

  function exportSuppliers(list) {
    const rows = [["Nama", "Kontak", "Telepon", "Email", "Alamat", "Catatan", "Servis terkait", "HPP lunas"]];
    list.forEach((s) => {
      const orders = supplierOrders(s.id);
      const paid = orders.filter((o) => o.paymentStatus === "lunas");
      const value = paid.reduce((sum, o) => sum + (Number(o.partsCost) || 0), 0);
      rows.push([s.name, s.contact || "", s.phone || "", s.email || "", s.address || "", s.notes || "", orders.length, value]);
    });
    U.downloadCSV(`supplier-${U.todayISO()}.csv`, rows);
    UI.success("Ekspor selesai", `${list.length} supplier diunduh sebagai CSV.`);
  }

  /* =====================================================
     Halaman pelanggan
     ===================================================== */

  App.registerPage("customers", {
    label: "Pelanggan",
    navLabel: "Pelanggan",
    group: "Operasional",
    icon: "users",
    render() {
      const q = U.normalize(App.state.filters.customers.q);
      const customers = (App.data.customers || [])
        .filter((c) => !q || [c.name, c.phone, c.email, c.address, c.notes].some((v) => U.normalize(v).includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name));
      const all = App.data.customers || [];
      const newThisMonth = all.filter((c) => U.monthOf(c.createdAt) === U.currentMonth()).length;
      const withActive = all.filter((c) => customerOrders(c.id).some(U.isActiveOrder)).length;
      const totalSpent = all.reduce((sum, c) => sum + paidByCustomer(c.id).reduce((s, o) => s + (Number(o.total) || 0), 0), 0);
      const actions = [];
      if (App.user.role !== "teknisi") actions.push(`<button type="button" class="button button-secondary" data-act="customers.export">${UI.icon("download", 16)} Ekspor CSV</button>`);
      if (App.can("customerManage")) actions.push(`<button type="button" class="button button-primary" data-act="customer.add">${UI.icon("user-plus", 16)} Tambah Pelanggan</button>`);

      const rows = customers.map((c) => {
        const orders = customerOrders(c.id);
        const active = orders.filter(U.isActiveOrder).length;
        const last = lastOrderOf(orders);
        const spent = paidByCustomer(c.id).reduce((s, o) => s + (Number(o.total) || 0), 0);
        return `<tr data-act="customer.view" data-id="${U.esc(c.id)}">
          <td><div class="table-user"><span class="avatar avatar-sm">${U.esc(U.initials(c.name))}</span><div class="table-user-copy"><strong>${U.esc(c.name)}</strong><span>${U.esc(c.phone || "Tanpa nomor")}</span></div></div></td>
          <td><span class="cell-primary" style="font-size:11px">${U.esc(c.email || "—")}</span><span class="cell-sub">${U.esc(c.address || "Alamat belum diisi")}</span></td>
          <td><span class="badge ${active ? "badge-warning" : "badge-neutral"}">${U.num(orders.length)} servis${active ? " · " + active + " aktif" : ""}</span></td>
          <td><span style="font-size:11px">${last ? U.esc(U.formatShortDate(last.createdAt)) : "—"}</span><span class="cell-sub">${last ? U.esc(U.statusMeta(last.status).label) : "Belum pernah servis"}</span></td>
          ${moneyVisible() ? `<td class="cell-money cell-right">${U.money(spent)}</td>` : ""}
          <td class="cell-actions"><span class="row-action">${UI.icon("chevron-right", 14)}</span></td>
        </tr>`;
      }).join("");

      return `<div class="page">
        ${UI.pageHead({
          kicker: "Operasional",
          title: "Data Pelanggan",
          subtitle: "Kelola kontak pelanggan dan lihat riwayat servis mereka dalam satu tempat.",
          actions: actions.join(""),
          meta: `${UI.icon("users", 13)} ${U.num(all.length)} pelanggan terdaftar`,
        })}
        <div class="report-summary">
          ${summaryCard("Total pelanggan", "users", U.num(all.length), `${customers.length} ditampilkan`)}
          ${summaryCard("Baru bulan ini", "user-plus", U.num(newThisMonth), U.monthLabel(U.currentMonth()), "positive")}
          ${summaryCard("Memiliki servis aktif", "wrench", U.num(withActive), "Sedang dikerjakan saat ini")}
          ${moneyVisible()
            ? summaryCard("Total transaksi", "credit-card", U.money(totalSpent), "Akumulasi seluruh pelanggan")
            : summaryCard("Total servis", "clipboard", U.num(allOrders().filter((o) => customers.some((c) => c.id === o.customerId)).length), "Tiket pelanggan terdaftar")}
        </div>
        <div class="card table-card">
          <div class="table-toolbar">
            <div class="toolbar-search">
              ${UI.icon("search", 15)}
              <input class="input" type="search" data-contact-search value="${U.esc(App.state.filters.customers.q)}" placeholder="Cari nama, telepon, email, alamat…" autocomplete="off">
            </div>
            <span class="filter-count">${U.num(customers.length)} pelanggan</span>
          </div>
          ${customers.length ? `<div class="table-wrap"><table class="data-table" style="min-width:${moneyVisible() ? 760 : 650}px">
            <thead><tr><th>Pelanggan</th><th>Kontak & alamat</th><th>Servis</th><th>Terakhir servis</th>${moneyVisible() ? '<th class="cell-right">Total transaksi</th>' : ""}<th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>` : UI.emptyState("users", q ? "Pelanggan tidak ditemukan" : "Belum ada pelanggan", q ? "Coba kata kunci lain atau reset pencarian." : "Tambahkan pelanggan pertama untuk memulai.",
            q ? `<button type="button" class="button button-secondary button-sm" data-act="customers.reset">Reset pencarian</button>` : (App.can("customerManage") ? `<button type="button" class="button button-primary button-sm" data-act="customer.add">${UI.icon("user-plus", 14)} Tambah pelanggan</button>` : ""))}
          <div class="table-footer"><span>Total <strong>${U.num(all.length)}</strong> pelanggan</span><span>Data pelanggan digunakan otomatis saat input barang</span></div>
        </div>
      </div>`;
    },
    mount() {
      const search = document.querySelector("[data-contact-search]");
      if (!search) return;
      search.addEventListener("input", U.debounce(() => {
        App.state.filters.customers.q = search.value;
        App.refreshPage();
        const next = document.querySelector("[data-contact-search]");
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      }, 220));
    },
  });

  App.registerActions({
    "customer.add": () => openCustomerForm(null),
    "customer.view": (data) => openCustomerDetail(data.id),
    "customer.edit": (data) => {
      const customer = U.customerById(App.data.customers || [], data.id);
      if (customer) openCustomerForm(customer);
    },
    "customer.delete": (data) => openCustomerDelete(data.id),
    "customers.export": () => exportCustomers(App.data.customers || []),
    "customers.reset": () => {
      App.state.filters.customers.q = "";
      App.refreshPage();
    },
  });

  /* =====================================================
     Halaman supplier
     ===================================================== */

  App.registerPage("suppliers", {
    label: "Supplier",
    navLabel: "Supplier",
    group: "Operasional",
    icon: "truck",
    render() {
      const q = U.normalize(App.state.filters.suppliers.q);
      const suppliers = (App.data.suppliers || [])
        .filter((s) => !q || [s.name, s.contact, s.phone, s.email, s.address, s.notes].some((v) => U.normalize(v).includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name));
      const all = App.data.suppliers || [];
      const activeSuppliers = all.filter((s) => supplierOrders(s.id).some(U.isActiveOrder)).length;
      const monthRange = U.monthRange(U.currentMonth());
      const monthPaid = U.paidBetween(allOrders(), monthRange.start, monthRange.end).filter((o) => o.supplierId);
      const monthHpp = monthPaid.reduce((sum, o) => sum + (Number(o.partsCost) || 0), 0);
      const totalLinked = all.reduce((sum, s) => sum + supplierOrders(s.id).length, 0);

      const rows = suppliers.map((s) => {
        const orders = supplierOrders(s.id);
        const paid = orders.filter((o) => o.paymentStatus === "lunas");
        const hpp = paid.reduce((sum, o) => sum + (Number(o.partsCost) || 0), 0);
        const active = orders.filter(U.isActiveOrder).length;
        return `<tr data-act="supplier.view" data-id="${U.esc(s.id)}">
          <td><div class="table-user">${UI.avatar(s.name)}<div class="table-user-copy"><strong>${U.esc(s.name)}</strong><span>${U.esc(s.contact || "PIC belum diisi")}</span></div></div></td>
          <td><span class="cell-primary" style="font-size:11px">${U.esc(s.phone || "—")}</span><span class="cell-sub">${U.esc(s.email || "Email belum diisi")}</span></td>
          <td><span style="font-size:11px">${U.esc(s.address || "—")}</span></td>
          <td><span class="badge ${active ? "badge-warning" : "badge-neutral"}">${U.num(orders.length)} tiket${active ? " · " + active + " aktif" : ""}</span></td>
          <td class="cell-money cell-right">${U.money(hpp)}</td>
          <td class="cell-actions"><span class="row-action">${UI.icon("chevron-right", 14)}</span></td>
        </tr>`;
      }).join("");

      return `<div class="page">
        ${UI.pageHead({
          kicker: "Operasional",
          title: "Data Supplier",
          subtitle: "Kelola mitra penyedia sparepart beserta keterkaitannya dengan tiket servis.",
          actions: `<button type="button" class="button button-secondary" data-act="suppliers.export">${UI.icon("download", 16)} Ekspor CSV</button>
            <button type="button" class="button button-primary" data-act="supplier.add">${UI.icon("plus", 16)} Tambah Supplier</button>`,
          meta: `${UI.icon("truck", 13)} ${U.num(all.length)} supplier terdaftar`,
        })}
        <div class="report-summary">
          ${summaryCard("Total supplier", "truck", U.num(all.length), `${suppliers.length} ditampilkan`)}
          ${summaryCard("Supplier aktif", "wrench", U.num(activeSuppliers), "Terhubung servis berjalan", "positive")}
          ${summaryCard("Nilai HPP bulan ini", "coins", U.money(monthHpp), `${monthPaid.length} transaksi lunas`)}
          ${summaryCard("Servis terkait", "clipboard", U.num(totalLinked), "Seluruh tiket dengan supplier")}
        </div>
        <div class="card table-card">
          <div class="table-toolbar">
            <div class="toolbar-search">${UI.icon("search", 15)}<input class="input" type="search" data-contact-search value="${U.esc(App.state.filters.suppliers.q)}" placeholder="Cari supplier, kontak, telepon…" autocomplete="off"></div>
            <span class="filter-count">${U.num(suppliers.length)} supplier</span>
          </div>
          ${suppliers.length ? `<div class="table-wrap"><table class="data-table" style="min-width:760px">
            <thead><tr><th>Supplier</th><th>Kontak</th><th>Alamat</th><th>Servis terkait</th><th class="cell-right">HPP lunas</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>` : UI.emptyState("truck", q ? "Supplier tidak ditemukan" : "Belum ada supplier", q ? "Coba kata kunci lain." : "Tambahkan supplier untuk mencatat asal sparepart.",
            q ? `<button type="button" class="button button-secondary button-sm" data-act="suppliers.reset">Reset pencarian</button>` : `<button type="button" class="button button-primary button-sm" data-act="supplier.add">${UI.icon("plus", 14)} Tambah supplier</button>`)}
          <div class="table-footer"><span>Total <strong>${U.num(all.length)}</strong> supplier</span><span>HPP dihitung dari tiket lunas yang menggunakan supplier</span></div>
        </div>
      </div>`;
    },
    mount() {
      const search = document.querySelector("[data-contact-search]");
      if (!search) return;
      search.addEventListener("input", U.debounce(() => {
        App.state.filters.suppliers.q = search.value;
        App.refreshPage();
        const next = document.querySelector("[data-contact-search]");
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      }, 220));
    },
  });

  App.registerActions({
    "supplier.add": () => openSupplierForm(null),
    "supplier.view": (data) => openSupplierDetail(data.id),
    "supplier.edit": (data) => {
      const supplier = (App.data.suppliers || []).find((s) => s.id === data.id);
      if (supplier) openSupplierForm(supplier);
    },
    "supplier.delete": (data) => openSupplierDelete(data.id),
    "suppliers.export": () => exportSuppliers(App.data.suppliers || []),
    "suppliers.reset": () => {
      App.state.filters.suppliers.q = "";
      App.refreshPage();
    },
  });
})();
