/* Input barang & papan servis */
(function () {
  "use strict";

  const DEVICE_OPTIONS = ["hp", "laptop", "printer", "pc"];

  function moneyVisible() {
    return App.user && App.user.role !== "teknisi";
  }

  function scopedOrders() {
    const user = App.user;
    const orders = App.data.orders || [];
    if (!user) return [];
    if (user.role === "teknisi") return orders.filter((o) => o.technicianId === user.id);
    return orders;
  }

  function matchesQuery(order, q) {
    if (!q) return true;
    return [order.ticketNo, order.customerName, order.customerPhone, order.brand, order.model, order.serial, order.complaint, order.technicianName]
      .some((value) => U.normalize(value).includes(q));
  }

  function statusMatches(order, status) {
    if (!status || status === "all") return true;
    if (status === "aktif") return U.isActiveOrder(order);
    return order.status === status;
  }

  function baseFiltered() {
    const f = App.state.filters.orders;
    const q = U.normalize(f.q);
    return scopedOrders().filter((order) => {
      if (!matchesQuery(order, q)) return false;
      if (f.device !== "all" && order.deviceType !== f.device) return false;
      if (f.tech !== "all" && order.technicianId !== f.tech) return false;
      if (f.payment !== "all" && order.paymentStatus !== f.payment) return false;
      return true;
    });
  }

  function filteredOrders() {
    const f = App.state.filters.orders;
    return baseFiltered()
      .filter((order) => statusMatches(order, f.status))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  function tabCounts() {
    const base = baseFiltered();
    const count = (status) => base.filter((order) => statusMatches(order, status)).length;
    return {
      all: base.length,
      aktif: count("aktif"),
      menunggu: count("menunggu"),
      proses: count("proses"),
      selesai: count("selesai"),
      diambil: count("diambil"),
      batal: count("batal"),
    };
  }

  function summaryCards() {
    const base = scopedOrders();
    const active = base.filter(U.isActiveOrder);
    const ready = base.filter((o) => o.status === "selesai");
    const waiting = base.filter((o) => o.status === "menunggu");
    const unpaid = base.filter((o) => o.paymentStatus === "belum" && Number(o.total) > 0);
    const unpaidTotal = unpaid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const todayIn = base.filter((o) => U.dateOf(o.createdAt) === U.todayISO()).length;
    const doneMonth = base.filter((o) => ["selesai", "diambil"].includes(o.status) && U.monthOf(o.updatedAt || o.createdAt) === U.currentMonth()).length;

    if (App.user.role === "teknisi") {
      return `<div class="report-summary">
        <div class="summary-card"><span>${UI.icon("clipboard", 13)} Tugas aktif</span><strong>${U.num(active.length)}</strong><small>${U.num(active.filter((o) => o.estimatedDone === U.todayISO()).length)} jatuh tempo hari ini</small></div>
        <div class="summary-card"><span>${UI.icon("tool", 13)} Sedang dikerjakan</span><strong>${U.num(base.filter((o) => o.status === "proses").length)}</strong><small>Perangkat dalam perbaikan</small></div>
        <div class="summary-card positive"><span>${UI.icon("check-circle", 13)} Selesai bulan ini</span><strong>${U.num(doneMonth)}</strong><small>Termasuk yang sudah diambil</small></div>
        <div class="summary-card"><span>${UI.icon("clock", 13)} Menunggu konfirmasi</span><strong>${U.num(waiting.length)}</strong><small>Perlu tindak lanjut</small></div>
      </div>`;
    }

    return `<div class="report-summary">
      <div class="summary-card"><span>${UI.icon("clipboard", 13)} Servis aktif</span><strong>${U.num(active.length)}</strong><small>${U.num(todayIn)} barang masuk hari ini</small></div>
      <div class="summary-card"><span>${UI.icon("tool", 13)} Pengerjaan</span><strong>${U.num(base.filter((o) => o.status === "proses").length)}</strong><small>${U.num(waiting.length)} menunggu konfirmasi</small></div>
      <div class="summary-card positive"><span>${UI.icon("package", 13)} Siap diambil</span><strong>${U.num(ready.length)}</strong><small>Sudah selesai dikerjakan</small></div>
      ${moneyVisible()
        ? `<div class="summary-card negative"><span>${UI.icon("credit-card", 13)} Belum dibayar</span><strong style="font-size:15px">${U.money(unpaidTotal)}</strong><small>${U.num(unpaid.length)} tiket menunggu pembayaran</small></div>`
        : `<div class="summary-card"><span>${UI.icon("credit-card", 13)} Belum dibayar</span><strong>${U.num(unpaid.length)}</strong><small>Tiket menunggu pembayaran</small></div>`}
    </div>`;
  }

  function tabHTML(counts) {
    const f = App.state.filters.orders;
    const tabs = [
      { key: "all", label: "Semua" },
      { key: "aktif", label: "Aktif" },
      { key: "menunggu", label: "Menunggu" },
      { key: "proses", label: "Dikerjakan" },
      { key: "selesai", label: "Siap diambil" },
      { key: "diambil", label: "Riwayat" },
      { key: "batal", label: "Batal" },
    ];
    return `<div class="tabs order-tabs">${tabs.map((tab) => `<button type="button" class="tab ${f.status === tab.key ? "active" : ""}" data-act="orders.tab" data-status="${tab.key}">
      ${U.esc(tab.label)}<span class="tab-count">${counts[tab.key] || 0}</span>
    </button>`).join("")}</div>`;
  }

  function tableRow(order) {
    const techCell = App.user.role === "teknisi" ? "" : `<td>
      ${order.technicianName ? `<div class="table-user">${UI.avatar(order.technicianName)}<div class="table-user-copy"><strong>${U.esc(order.technicianName)}</strong><span>Teknisi</span></div></div>` : `<span class="badge badge-warning">Belum ditugaskan</span>`}
    </td>`;
    const moneyCell = moneyVisible() ? `<td class="cell-money cell-right">${U.money(order.total)}
      <span class="cell-sub" style="color:${order.paymentStatus === "lunas" ? "var(--success)" : "var(--warning)"}">${order.paymentStatus === "lunas" ? U.esc(U.paymentLabel(order.paymentMethod)) : "Belum bayar"}</span>
    </td>` : "";
    const payBtn = moneyVisible() && App.can("orderPayment") && order.paymentStatus !== "lunas" && order.status !== "batal" && Number(order.total) > 0
      ? `<button type="button" class="row-action success" data-act="order.pay" data-id="${U.esc(order.id)}" title="Proses pembayaran" aria-label="Proses pembayaran">${UI.icon("credit-card", 14)}</button>`
      : "";
    return `<tr data-act="order.view" data-id="${U.esc(order.id)}">
      <td>
        <span class="cell-primary">${U.esc(order.customerName)}</span>
        <span class="cell-sub ticket-number">${U.esc(order.ticketNo)}</span>
      </td>
      <td>
        <div class="device-cell">${UI.deviceIcon(order.deviceType)}
          <div><span class="cell-primary" style="font-size:11.5px">${U.esc(order.brand || U.deviceMeta(order.deviceType).short)}</span><span class="cell-sub">${U.esc(order.model || U.deviceMeta(order.deviceType).label)}</span></div>
        </div>
      </td>
      ${techCell}
      <td>${UI.statusPill(order.status)}<span class="cell-sub">${U.esc(U.formatShortDate(order.updatedAt || order.createdAt))}</span></td>
      ${moneyCell}
      <td class="cell-actions"><div class="row-actions">${payBtn}<span class="row-action">${UI.icon("chevron-right", 14)}</span></div></td>
    </tr>`;
  }

  function tableHTML(orders) {
    if (!orders.length) {
      return UI.emptyState("clipboard", "Tidak ada tiket ditemukan", "Ubah filter atau buat penerimaan barang baru.", App.can("orderCreate")
        ? `<button type="button" class="button button-primary button-sm" data-act="order.add">${UI.icon("plus", 14)} Input barang</button>`
        : "");
    }
    const techCol = App.user.role !== "teknisi";
    const moneyCol = moneyVisible();
    return `<div class="table-wrap"><table class="data-table" style="min-width:${moneyCol ? 820 : 680}px">
      <thead><tr>
        <th>Tiket / Pelanggan</th>
        <th>Perangkat</th>
        ${techCol ? "<th>Teknisi</th>" : ""}
        <th>Status</th>
        ${moneyCol ? '<th class="cell-right">Biaya</th>' : ""}
        <th></th>
      </tr></thead>
      <tbody>${orders.map(tableRow).join("")}</tbody>
    </table></div>`;
  }

  function optionList(items, selected, valueKey, labelKey) {
    return items.map((item) => `<option value="${U.esc(valueKey ? item[valueKey] : item)}" ${String(selected) === String(valueKey ? item[valueKey] : item) ? "selected" : ""}>${U.esc(labelKey ? item[labelKey] : item)}</option>`).join("");
  }

  function formHTML(order) {
    const isEdit = !!order;
    const o = order || {};
    const customers = [...(App.data.customers || [])].sort((a, b) => a.name.localeCompare(b.name));
    const techs = (App.data.users || []).filter((u) => u.role === "teknisi" && u.active !== false);
    const suppliers = App.data.suppliers || [];
    const device = o.deviceType || "hp";
    const status = o.status || "masuk";
    const statusOptions = [...U.STATUS_FLOW, "batal"].map((key) => ({ value: key, label: U.statusMeta(key).label }));
    return `<form id="orderForm" novalidate>
      <div class="form-section">
        <div class="form-section-title">
          <span class="section-icon">${UI.icon("user", 17)}</span>
          <div><strong>Pelanggan</strong><span>Pilih pelanggan terdaftar atau buat data baru langsung dari form ini.</span></div>
        </div>
        <div class="form-grid">
          <label class="field span-2">
            <span class="field-label">Pelanggan <span class="required">*</span></span>
            <select class="select" name="customerId" id="orderCustomer">
              <option value="">— Pilih pelanggan —</option>
              ${optionList(customers, o.customerId || "", "id", "name")}
              ${isEdit ? "" : '<option value="__new">+ Pelanggan baru…</option>'}
            </select>
          </label>
          ${isEdit ? "" : `<div class="field span-2 hidden" id="newCustomerBox">
            <div class="form-grid" style="gap:12px">
              <label class="field"><span class="field-label">Nama pelanggan <span class="required">*</span></span><input class="input" name="newCustomerName" id="newCustomerName" placeholder="Nama lengkap"></label>
              <label class="field"><span class="field-label">Nomor WhatsApp <span class="required">*</span></span><input class="input" name="newCustomerPhone" id="newCustomerPhone" inputmode="tel" placeholder="08xx-xxxx-xxxx"></label>
              <label class="field span-2"><span class="field-label">Email <span class="text-muted">(opsional)</span></span><input class="input" name="newCustomerEmail" type="email" placeholder="nama@email.com"></label>
            </div>
          </div>`}
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">
          <span class="section-icon">${UI.icon("smartphone", 17)}</span>
          <div><strong>Perangkat & keluhan</strong><span>Catat kondisi fisik dan keluhan awal pelanggan.</span></div>
        </div>
        <div class="form-grid">
          <div class="field span-2">
            <span class="field-label">Jenis perangkat <span class="required">*</span></span>
            <div class="segmented device-selector" id="deviceSelector">
              ${DEVICE_OPTIONS.map((key) => `<button type="button" data-device-choice="${key}" class="${device === key ? "active" : ""}">${UI.icon(U.deviceMeta(key).icon, 14)}<span>${U.esc(U.deviceMeta(key).short)}</span></button>`).join("")}
            </div>
            <input type="hidden" name="deviceType" id="orderDeviceType" value="${U.esc(device)}">
          </div>
          <label class="field"><span class="field-label">Merek <span class="required">*</span></span><input class="input" name="brand" value="${U.esc(o.brand || "")}" placeholder="cth. Asus, Apple, Epson" required></label>
          <label class="field"><span class="field-label">Model / tipe <span class="required">*</span></span><input class="input" name="model" value="${U.esc(o.model || "")}" placeholder="cth. ROG Strix G15" required></label>
          <label class="field"><span class="field-label">Nomor seri / IMEI</span><input class="input" name="serial" value="${U.esc(o.serial || "")}" placeholder="Opsional"></label>
          <label class="field"><span class="field-label">Kelengkapan</span><input class="input" name="accessories" value="${U.esc(o.accessories || "")}" placeholder="Charger, casing, tas…"></label>
          <label class="field span-2"><span class="field-label">Keluhan pelanggan <span class="required">*</span></span><textarea class="textarea" name="complaint" placeholder="Jelaskan gejala kerusakan yang dialami…" required>${U.esc(o.complaint || "")}</textarea></label>
          <label class="field span-2"><span class="field-label">Kondisi fisik saat diterima</span><textarea class="textarea" name="condition" placeholder="Lecet, retak, penyok, atau catatan kondisi lainnya…" style="min-height:70px">${U.esc(o.condition || "")}</textarea></label>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">
          <span class="section-icon">${UI.icon("wrench", 17)}</span>
          <div><strong>Penugasan & biaya</strong><span>Atur teknisi, target penyelesaian, dan estimasi biaya servis.</span></div>
        </div>
        <div class="form-grid">
          <label class="field"><span class="field-label">Teknisi</span>
            <select class="select" name="technicianId">
              <option value="">Belum ditugaskan</option>
              ${optionList(techs, o.technicianId || "", "id", "name")}
            </select>
          </label>
          <label class="field"><span class="field-label">Supplier sparepart</span>
            <select class="select" name="supplierId">
              <option value="">Tidak menggunakan supplier</option>
              ${optionList(suppliers, o.supplierId || "", "id", "name")}
            </select>
          </label>
          <label class="field"><span class="field-label">Estimasi biaya pelanggan</span><span class="input-with-prefix"><span>Rp</span><input class="input" name="estimateCost" inputmode="numeric" value="${o.estimateCost ? U.num(o.estimateCost) : ""}" placeholder="0"></span></label>
          <label class="field"><span class="field-label">Target selesai</span><input class="input" type="date" name="estimatedDone" value="${U.esc(o.estimatedDone || U.addDays(U.todayISO(), 2))}"></label>
          <label class="field"><span class="field-label">Biaya sparepart (HPP)</span><span class="input-with-prefix"><span>Rp</span><input class="input" name="partsCost" inputmode="numeric" value="${o.partsCost ? U.num(o.partsCost) : ""}" placeholder="0"></span></label>
          <label class="field"><span class="field-label">Biaya jasa servis</span><span class="input-with-prefix"><span>Rp</span><input class="input" name="serviceCost" inputmode="numeric" value="${o.serviceCost ? U.num(o.serviceCost) : ""}" placeholder="0"></span></label>
          <label class="field"><span class="field-label">Status servis</span>
            <select class="select" name="status">
              ${optionList(statusOptions, status, "value", "label")}
            </select>
          </label>
          <label class="field"><span class="field-label">Diagnosa teknisi</span><input class="input" name="diagnosis" value="${U.esc(o.diagnosis || "")}" placeholder="Hasil pemeriksaan awal"></label>
          <label class="field span-2"><span class="field-label">Catatan tambahan</span><textarea class="textarea" name="note" placeholder="Instruksi khusus, persetujuan pelanggan, atau info lain…" style="min-height:70px">${U.esc(o.note || "")}</textarea></label>
          <div class="span-2">
            <div class="kas-form-total"><span>Total tagihan (sparepart + jasa)</span><strong id="orderTotalPreview">${U.money((Number(o.partsCost) || 0) + (Number(o.serviceCost) || 0))}</strong></div>
            <div class="helper-text mt-1">Total tagihan dihitung otomatis dan menjadi nilai nota pelanggan. Pembayaran dicatat terpisah agar kas kecil dapat dialokasikan otomatis.</div>
          </div>
          ${isEdit ? `<div class="alert alert-info span-2" style="margin:0">${UI.icon("receipt", 17)}<span>Nomor tiket <strong>${U.esc(o.ticketNo)}</strong> · dibuat ${U.esc(U.formatDateTime(o.createdAt))} oleh ${U.esc(o.createdBy || "—")}. Perubahan biaya pada tiket yang sudah lunas tidak menghitung ulang alokasi kas yang telah masuk.</span></div>` : ""}
        </div>
      </div>
    </form>`;
  }

  function openOrderForm(order, presetCustomerId) {
    if (order ? !App.can("orderEdit") : !App.can("orderCreate")) {
      UI.warning("Akses dibatasi", "Role Anda tidak dapat mengubah data servis.");
      return;
    }
    const isEdit = !!order;
    const overlay = UI.openModal({
      title: isEdit ? "Edit data servis" : "Input barang baru",
      subtitle: isEdit ? `Perbarui detail tiket ${order.ticketNo}.` : "Catat perangkat masuk dan detail keluhan pelanggan.",
      iconName: isEdit ? "pencil" : "plus-circle",
      size: "lg",
      body: formHTML(order),
      footer: `<span class="helper-text" style="margin-right:auto">${isEdit ? `Tiket ${U.esc(order.ticketNo)}` : `Nomor tiket dibuat otomatis saat disimpan`}</span>
        <button type="button" class="button button-secondary" data-close>Batal</button>
        <button type="submit" form="orderForm" class="button button-primary" id="saveOrderBtn">${UI.icon("save", 16)} ${isEdit ? "Simpan perubahan" : "Simpan & buat tiket"}</button>`,
      onMount: (el) => {
        const form = el.querySelector("#orderForm");
        const customerSelect = el.querySelector("#orderCustomer");
        const newBox = el.querySelector("#newCustomerBox");
        const nameInput = el.querySelector("#newCustomerName");
        const phoneInput = el.querySelector("#newCustomerPhone");
        const preview = el.querySelector("#orderTotalPreview");

        if (presetCustomerId) customerSelect.value = presetCustomerId;

        const syncNewCustomer = () => {
          if (!newBox) return;
          const adding = customerSelect.value === "__new";
          newBox.classList.toggle("hidden", !adding);
          nameInput.required = adding;
          phoneInput.required = adding;
          phoneInput.required = adding;
        };
        customerSelect.addEventListener("change", syncNewCustomer);
        syncNewCustomer();

        el.querySelectorAll("[data-device-choice]").forEach((button) => {
          button.addEventListener("click", () => {
            el.querySelectorAll("[data-device-choice]").forEach((btn) => btn.classList.toggle("active", btn === button));
            el.querySelector("#orderDeviceType").value = button.dataset.deviceChoice;
          });
        });

        const updateTotal = () => {
          const parts = U.parseNumber(form.elements.partsCost.value);
          const service = U.parseNumber(form.elements.serviceCost.value);
          preview.textContent = U.money(parts + service);
        };
        form.elements.partsCost.addEventListener("input", updateTotal);
        form.elements.serviceCost.addEventListener("input", updateTotal);

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const btn = el.querySelector("#saveOrderBtn");
          const customerId = customerSelect.value;
          const brand = form.elements.brand.value.trim();
          const model = form.elements.model.value.trim();
          const complaint = form.elements.complaint.value.trim();
          const newName = nameInput ? nameInput.value.trim() : "";
          const newPhone = phoneInput ? phoneInput.value.trim() : "";
          const newEmail = el.querySelector("#newCustomerEmail") ? el.querySelector("#newCustomerEmail").value.trim() : "";

          if (!customerId) return UI.warning("Pelanggan belum dipilih", "Pilih pelanggan terdaftar atau tambahkan pelanggan baru.");
          if (customerId === "__new") {
            if (!newName) return UI.warning("Nama pelanggan wajib diisi", "Lengkapi data pelanggan baru terlebih dahulu.");
            if (!U.isValidPhone(newPhone)) return UI.warning("Nomor telepon tidak valid", "Masukkan minimal 8 digit nomor WhatsApp pelanggan.");
            if (newEmail && !U.isValidEmail(newEmail)) return UI.warning("Email tidak valid", "Periksa kembali alamat email pelanggan.");
          }
          if (!brand || !model) return UI.warning("Data perangkat belum lengkap", "Merek dan model perangkat wajib diisi.");
          if (!complaint) return UI.warning("Keluhan belum diisi", "Tuliskan keluhan pelanggan agar teknisi memahami masalahnya.");

          UI.setLoading(btn, true, "Menyimpan…");
          try {
            let finalCustomerId = customerId;
            if (customerId === "__new") {
              const customer = await App.db.upsert("customers", {
                name: newName,
                phone: newPhone,
                email: newEmail,
                address: "",
                notes: "Dibuat dari form input barang",
              });
              finalCustomerId = customer.id;
            }

            const now = U.nowISO();
            const status = form.elements.status.value;
            const technicianId = form.elements.technicianId.value;
            const technician = U.userById(App.data.users, technicianId);
            const history = Array.isArray(order && order.history) ? U.clone(order.history) : [];
            if (!isEdit) {
              history.push({
                status,
                at: now,
                by: App.user.name,
                note: form.elements.note.value.trim() || (status === "masuk" ? "Perangkat diterima dan dicatat oleh front desk." : `Tiket dibuat dengan status ${U.statusMeta(status).label}.`),
              });
            } else if (status !== order.status) {
              history.push({
                status,
                at: now,
                by: App.user.name,
                note: `Status diubah dari ${U.statusMeta(order.status).label} ke ${U.statusMeta(status).label}.`,
              });
            }

            const record = {
              ...(order || {}),
              customerId: finalCustomerId,
              deviceType: form.elements.deviceType.value,
              brand,
              model,
              serial: form.elements.serial.value.trim(),
              accessories: form.elements.accessories.value.trim(),
              complaint,
              condition: form.elements.condition.value.trim(),
              diagnosis: form.elements.diagnosis.value.trim(),
              technicianId,
              technicianName: technician ? technician.name : "",
              supplierId: form.elements.supplierId.value,
              estimateCost: U.parseNumber(form.elements.estimateCost.value),
              partsCost: U.parseNumber(form.elements.partsCost.value),
              serviceCost: U.parseNumber(form.elements.serviceCost.value),
              status,
              estimatedDone: form.elements.estimatedDone.value,
              note: form.elements.note.value.trim(),
              history,
              createdBy: order ? order.createdBy : App.user.name,
            };

            const saved = await App.db.upsert("orders", record);
            await App.reload();
            UI.closeOverlay();
            App.refreshPage();
            UI.success(isEdit ? "Tiket diperbarui" : "Barang berhasil diterima", `${saved.ticketNo} · ${saved.customerName}`);
            if (saved.__autoKas) {
              UI.success("Kas kecil bertambah", `${U.money(saved.__autoKas.amount)} dialokasikan otomatis.`);
            }
          } catch (err) {
            UI.error("Gagal menyimpan", err.message);
          } finally {
            UI.setLoading(btn, false);
          }
        });
      },
    });
    return overlay;
  }

  function timelineHTML(order) {
    const history = [...(order.history || [])];
    if (!history.length) return '<div class="tech-empty">Belum ada riwayat status.</div>';
    return `<div class="timeline">${history.map((item, index) => `<div class="timeline-item ${index === history.length - 1 ? "current" : ""}">
      <div class="timeline-dot-wrap"><span class="timeline-dot"></span><span class="timeline-line"></span></div>
      <div class="timeline-copy">
        <strong>${U.esc(U.statusMeta(item.status).label)}</strong>
        <span>${U.esc(U.formatDateTime(item.at))} · ${U.esc(item.by || "Sistem")}</span>
        ${item.note ? `<p>${U.esc(item.note)}</p>` : ""}
      </div>
    </div>`).join("")}</div>`;
  }

  function detailHTML(order) {
    const money = moneyVisible();
    const isPaid = order.paymentStatus === "lunas";
    const canPay = money && App.can("orderPayment") && !isPaid && order.status !== "batal" && Number(order.total) > 0;
    const banner = money ? (isPaid
      ? `<div class="payment-banner paid">
          <span class="payment-banner-icon">${UI.icon("check-circle", 15)}</span>
          <div class="payment-banner-copy"><strong>Pembayaran lunas</strong><span>${U.esc(U.paymentLabel(order.paymentMethod))} · ${U.esc(U.formatDateTime(order.paidAt))}</span></div>
          <span class="badge badge-success">${U.money(order.total)}</span>
        </div>`
      : `<div class="payment-banner unpaid">
          <span class="payment-banner-icon">${UI.icon("credit-card", 15)}</span>
          <div class="payment-banner-copy"><strong>Belum dibayar</strong><span>${canPay ? "Proses pembayaran saat pelanggan mengambil perangkat." : "Pembayaran ditangani oleh kasir."}</span></div>
          ${canPay ? `<button type="button" class="button button-primary button-sm" data-act="order.pay" data-id="${U.esc(order.id)}">${UI.icon("credit-card", 14)} Bayar</button>` : `<span class="badge badge-warning">${U.money(order.total)}</span>`}
        </div>`) : "";

    return `<div class="detail-hero">
      ${UI.deviceIcon(order.deviceType)}
      <div class="detail-hero-copy">
        <strong>${U.esc(UI.deviceName(order))}</strong>
        <span>${U.esc(order.serial || "Nomor seri belum diisi")} · ${U.esc(U.deviceMeta(order.deviceType).label)}</span>
      </div>
      <div class="detail-hero-status">${UI.statusPill(order.status)}${UI.paymentPill(order.paymentStatus)}</div>
    </div>
    ${banner}
    <div class="detail-section">
      <div class="detail-section-title"><span>${UI.icon("clipboard", 15)}</span><strong>Informasi servis</strong></div>
      <div class="detail-grid">
        <div class="detail-item"><span>Pelanggan</span><strong>${U.esc(order.customerName)}</strong></div>
        <div class="detail-item"><span>Telepon</span><strong>${U.esc(order.customerPhone || "—")}</strong></div>
        <div class="detail-item"><span>Teknisi</span><strong>${U.esc(order.technicianName || "Belum ditugaskan")}</strong></div>
        <div class="detail-item"><span>Supplier</span><strong>${U.esc(order.supplierName || "—")}</strong></div>
        <div class="detail-item"><span>Masuk</span><strong>${U.esc(U.formatDateTime(order.createdAt))}</strong></div>
        <div class="detail-item"><span>Target selesai</span><strong>${order.estimatedDone ? U.esc(U.formatDate(order.estimatedDone)) : "—"}</strong></div>
        <div class="detail-item"><span>Kelengkapan</span><strong>${U.esc(order.accessories || "—")}</strong></div>
        <div class="detail-item"><span>Dicatat oleh</span><strong>${U.esc(order.createdBy || "—")}</strong></div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title"><span>${UI.icon("message-square", 15)}</span><strong>Keluhan & catatan</strong></div>
      <div class="detail-note"><strong>Keluhan pelanggan</strong><p>${U.esc(order.complaint || "—")}</p></div>
      ${order.condition ? `<div class="detail-note" style="margin-top:8px"><strong>Kondisi saat diterima</strong><p>${U.esc(order.condition)}</p></div>` : ""}
      ${order.diagnosis ? `<div class="detail-note" style="margin-top:8px"><strong>Diagnosa teknisi</strong><p>${U.esc(order.diagnosis)}</p></div>` : ""}
      ${order.note ? `<div class="detail-note" style="margin-top:8px"><strong>Catatan tambahan</strong><p>${U.esc(order.note)}</p></div>` : ""}
    </div>
    ${money ? `<div class="detail-section">
      <div class="detail-section-title"><span>${UI.icon("receipt", 15)}</span><strong>Rincian biaya</strong></div>
      <div class="detail-costs">
        <div class="cost-row"><span>Biaya jasa servis</span><strong>${U.money(order.serviceCost)}</strong></div>
        <div class="cost-row"><span>Sparepart (HPP)</span><strong>${U.money(order.partsCost)}</strong></div>
        <div class="cost-row"><span>Estimasi awal</span><strong>${U.money(order.estimateCost)}</strong></div>
        <div class="cost-row total"><span>Total tagihan</span><strong>${U.money(order.total)}</strong></div>
      </div>
    </div>` : ""}
    <div class="detail-section">
      <div class="detail-section-title"><span>${UI.icon("history", 15)}</span><strong>Riwayat pengerjaan</strong></div>
      ${timelineHTML(order)}
    </div>`;
  }

  function openDetail(orderId) {
    const order = (App.data.orders || []).find((o) => o.id === orderId);
    if (!order) {
      UI.error("Tiket tidak ditemukan", "Data mungkin sudah dihapus atau dimuat ulang.");
      return;
    }
    const isTechOwner = App.user.role !== "teknisi" || order.technicianId === App.user.id;
    const canProgress = App.can("orderProgress") && isTechOwner && !["diambil", "batal"].includes(order.status) && !(App.user.role === "teknisi" && order.status === "selesai");
    const footer = [];
    if (App.user.role === "owner") footer.push(`<button type="button" class="button button-danger-soft button-sm" data-act="order.delete" data-id="${U.esc(order.id)}">${UI.icon("trash", 14)} Hapus</button>`);
    footer.push('<span class="spacer"></span>');
    if (moneyVisible()) footer.push(`<button type="button" class="button button-secondary button-sm" data-act="order.receipt" data-id="${U.esc(order.id)}">${UI.icon("receipt", 15)} Nota</button>`);
    if (App.can("orderEdit")) footer.push(`<button type="button" class="button button-secondary button-sm" data-act="order.edit" data-id="${U.esc(order.id)}">${UI.icon("pencil", 15)} Edit</button>`);
    if (canProgress) footer.push(`<button type="button" class="button button-primary button-sm" data-act="order.progress" data-id="${U.esc(order.id)}">${UI.icon("play", 14)} Update progres</button>`);

    UI.openDrawer({
      title: UI.deviceName(order),
      ticket: order.ticketNo,
      subtitle: `${U.esc(order.customerName)}${order.customerPhone ? " · " + U.esc(order.customerPhone) : ""}`,
      body: detailHTML(order),
      footer: footer.join(""),
    });
  }

  function openProgress(orderId) {
    const order = (App.data.orders || []).find((o) => o.id === orderId);
    if (!order) return UI.error("Tiket tidak ditemukan", "Data servis tidak tersedia.");
    if (!App.can("orderProgress")) return UI.warning("Akses dibatasi", "Role Anda tidak dapat memperbarui progres servis.");
    if (App.user.role === "teknisi" && order.technicianId !== App.user.id) {
      return UI.warning("Bukan tugas Anda", "Progres hanya dapat diperbarui oleh teknisi yang ditugaskan.");
    }

    const currentIndex = U.STATUS_FLOW.indexOf(order.status);
    let allowed = U.STATUS_FLOW.slice(Math.max(currentIndex, 0));
    if (App.user.role === "teknisi") allowed = allowed.filter((s) => s !== "diambil");
    if (App.user.role === "owner") allowed = [...allowed, "batal"];
    const target = allowed.includes("proses") ? "proses" : allowed[0];
    const options = allowed.map((key) => `<option value="${key}" ${key === target ? "selected" : ""}>${U.esc(U.statusMeta(key).label)}</option>`).join("");

    UI.openModal({
      title: "Update progres servis",
      subtitle: `${order.ticketNo} · ${order.customerName}`,
      iconName: "wrench",
      size: "sm",
      body: `<div class="detail-costs mb-3">
        <div class="cost-row"><span>Status saat ini</span><strong>${U.esc(U.statusMeta(order.status).label)}</strong></div>
        <div class="cost-row"><span>Perangkat</span><strong>${U.esc(UI.deviceName(order))}</strong></div>
      </div>
      <div class="field">
        <span class="field-label">Status baru</span>
        <select class="select" id="progressStatus">${options}</select>
      </div>
      <label class="field" style="margin-top:14px">
        <span class="field-label">Diagnosa / catatan progres</span>
        <textarea class="textarea" id="progressNote" placeholder="Hasil pemeriksaan atau tindakan yang dilakukan…">${U.esc(order.diagnosis || "")}</textarea>
      </label>
      <div class="helper-text mt-2">Riwayat perubahan akan tercatat otomatis pada tiket dan terlihat oleh seluruh tim.</div>`,
      footer: `<button type="button" class="button button-secondary" data-close>Batal</button>
        <button type="button" class="button button-primary" id="saveProgressBtn">${UI.icon("save", 15)} Simpan progres</button>`,
      onMount: (overlay) => {
        overlay.querySelector("#saveProgressBtn").addEventListener("click", async (event) => {
          const btn = event.currentTarget;
          const status = overlay.querySelector("#progressStatus").value;
          const note = overlay.querySelector("#progressNote").value.trim();
          if (status === order.status) return UI.info("Status tidak berubah", "Pilih status baru atau ubah catatan diagnosa.");
          UI.setLoading(btn, true, "Menyimpan…");
          try {
            const history = [...(order.history || [])];
            history.push({
              status,
              at: U.nowISO(),
              by: App.user.name,
              note: note || `Status diperbarui menjadi ${U.statusMeta(status).label}.`,
            });
            const record = { ...order, status, diagnosis: note || order.diagnosis, history };
            await App.db.upsert("orders", record);
            await App.reload();
            UI.closeOverlay();
            App.refreshPage();
            UI.success("Progres diperbarui", `${order.ticketNo} · ${U.statusMeta(status).label}`);
          } catch (err) {
            UI.error("Gagal memperbarui progres", err.message);
          } finally {
            UI.setLoading(btn, false);
          }
        });
      },
    });
  }

  function openPayment(orderId) {
    const order = (App.data.orders || []).find((o) => o.id === orderId);
    if (!order) return UI.error("Tiket tidak ditemukan", "Data servis tidak tersedia.");
    if (!App.can("orderPayment") || !moneyVisible()) return UI.warning("Akses dibatasi", "Pembayaran hanya dapat diproses oleh kasir atau owner.");
    if (order.status === "batal") return UI.warning("Tiket dibatalkan", "Pembayaran tidak dapat diproses untuk servis yang dibatalkan.");
    if (order.paymentStatus === "lunas") return UI.info("Sudah lunas", `Pembayaran ${order.ticketNo} telah tercatat.`);

    const autoAmount = App.settings.kasAutoEnabled ? U.kasAllocationFor({ ...order, total: order.total }, App.settings.kasPercent) : 0;
    const canMarkTaken = order.status === "selesai";
    const methods = Object.keys(U.PAYMENT_METHODS).map((key) => `<option value="${key}">${U.esc(U.PAYMENT_METHODS[key].label)}</option>`).join("");
    UI.openModal({
      title: "Pembayaran servis",
      subtitle: `${order.ticketNo} · ${order.customerName}`,
      iconName: "credit-card",
      size: "sm",
      body: `<div class="detail-costs">
        <div class="cost-row"><span>Jasa servis</span><strong>${U.money(order.serviceCost)}</strong></div>
        <div class="cost-row"><span>Sparepart</span><strong>${U.money(order.partsCost)}</strong></div>
        <div class="cost-row total"><span>Total tagihan</span><strong>${U.money(order.total)}</strong></div>
      </div>
      <div class="form-grid" style="margin-top:16px">
        <label class="field"><span class="field-label">Metode pembayaran <span class="required">*</span></span><select class="select" id="paymentMethod">${methods}</select></label>
        <label class="field"><span class="field-label">Tanggal bayar</span><input class="input" type="date" id="paymentDate" value="${U.todayISO()}" max="${U.todayISO()}"></label>
      </div>
      ${canMarkTaken ? `<label class="check-row" style="margin-top:14px"><input type="checkbox" id="markTaken" checked> Serahkan perangkat & tandai sudah diambil</label>` : ""}
      <label class="check-row" style="margin-top:12px"><input type="checkbox" id="printAfterPay" ${App.settings.autoPrint ? "checked" : ""}> Tampilkan nota setelah pembayaran</label>
      ${autoAmount > 0 ? `<div class="alert alert-info" style="margin:16px 0 0">${UI.icon("wallet", 17)}<span><strong>Kas kecil otomatis:</strong> ${U.money(autoAmount)} (${App.settings.kasPercent}% dari laba tiket) akan masuk setelah pembayaran disimpan.</span></div>` : ""}
      <div class="helper-text mt-2">Pastikan nominal perangkat sudah sesuai. Setelah lunas, transaksi masuk ke laporan keuangan dan laba dihitung otomatis.</div>`,
      footer: `<button type="button" class="button button-secondary" data-close>Batal</button>
        <button type="button" class="button button-primary" id="confirmPayBtn">${UI.icon("check-circle", 15)} Konfirmasi lunas</button>`,
      onMount: (overlay) => {
        overlay.querySelector("#confirmPayBtn").addEventListener("click", async (event) => {
          const btn = event.currentTarget;
          const method = overlay.querySelector("#paymentMethod").value;
          const date = overlay.querySelector("#paymentDate").value || U.todayISO();
          if (date > U.todayISO()) return UI.warning("Tanggal tidak valid", "Tanggal pembayaran tidak boleh melewati hari ini.");
          const now = new Date();
          const paidAt = date === U.todayISO()
            ? now.toISOString()
            : new Date(`${date}T${U.pad(now.getHours())}:${U.pad(now.getMinutes())}:00`).toISOString();
          const markTaken = overlay.querySelector("#markTaken");
          const wantsReceipt = overlay.querySelector("#printAfterPay").checked;

          UI.setLoading(btn, true, "Memproses…");
          try {
            const history = [...(order.history || [])];
            let status = order.status;
            if (markTaken && markTaken.checked && status === "selesai") {
              status = "diambil";
              history.push({
                status,
                at: paidAt,
                by: App.user.name,
                note: "Pembayaran lunas dan perangkat diserahkan kepada pelanggan.",
              });
            }
            const record = { ...order, paymentStatus: "lunas", paymentMethod: method, paidAt, status, history };
            const saved = await App.db.upsert("orders", record);
            const autoKas = saved.__autoKas || App.db.lastAutoKas || null;
            await App.reload();
            UI.closeOverlay();
            App.refreshPage();
            UI.success("Pembayaran berhasil", `${order.ticketNo} · ${U.money(order.total)} via ${U.paymentLabel(method)}`);
            if (autoKas) UI.success("Kas kecil bertambah", `${U.money(autoKas.amount)} dialokasikan otomatis.`);
            if (wantsReceipt) {
              const updated = (App.data.orders || []).find((o) => o.id === order.id) || saved;
              setTimeout(() => UI.showReceiptModal(updated, App.settings), 280);
            }
          } catch (err) {
            UI.error("Pembayaran gagal", err.message);
          } finally {
            UI.setLoading(btn, false);
          }
        });
      },
    });
  }

  function deleteOrder(orderId) {
    if (App.user.role !== "owner") return UI.warning("Akses dibatasi", "Hanya owner yang dapat menghapus tiket.");
    const order = (App.data.orders || []).find((o) => o.id === orderId);
    if (!order) return UI.error("Tiket tidak ditemukan", "Data mungkin sudah dihapus.");
    UI.confirm({
      title: "Hapus tiket servis",
      heading: "Hapus tiket ini secara permanen?",
      message: "Tindakan ini tidak dapat dibatalkan.",
      detail: `${order.ticketNo} · ${order.customerName}<br>${UI.deviceName(order)} · ${U.money(order.total)}${order.paymentStatus === "lunas" ? "<br><strong>Pembayaran lunas — alokasi kas terkait juga akan dihapus.</strong>" : ""}`,
      confirmText: "Hapus tiket",
      iconName: "trash",
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await App.db.remove("orders", orderId);
        await App.reload();
        UI.closeOverlay();
        App.refreshPage();
        UI.success("Tiket dihapus", `${order.ticketNo} telah dihapus dari papan servis.`);
      } catch (err) {
        UI.error("Gagal menghapus", err.message);
      }
    });
  }

  function receiptFor(orderId) {
    const order = (App.data.orders || []).find((o) => o.id === orderId);
    if (!order) return UI.error("Tiket tidak ditemukan", "Nota tidak dapat ditampilkan.");
    UI.showReceiptModal(order, App.settings);
  }

  function exportOrders(list) {
    if (!moneyVisible()) return UI.warning("Akses dibatasi", "Ekspor data tidak tersedia untuk role teknisi.");
    const rows = [
      ["Tiket", "Tanggal masuk", "Pelanggan", "Telepon", "Perangkat", "Merek", "Model", "Serial", "Teknisi", "Supplier", "Status", "Pembayaran", "Metode", "Tanggal bayar", "Jasa", "Sparepart", "Total"],
    ];
    list.forEach((o) => rows.push([
      o.ticketNo,
      U.formatDateTime(o.createdAt),
      o.customerName,
      o.customerPhone || "",
      U.deviceMeta(o.deviceType).label,
      o.brand || "",
      o.model || "",
      o.serial || "",
      o.technicianName || "",
      o.supplierName || "",
      U.statusMeta(o.status).label,
      o.paymentStatus === "lunas" ? "Lunas" : "Belum bayar",
      o.paymentMethod ? U.paymentLabel(o.paymentMethod) : "",
      o.paidAt ? U.formatDateTime(o.paidAt) : "",
      o.serviceCost || 0,
      o.partsCost || 0,
      o.total || 0,
    ]));
    U.downloadCSV(`servis-${U.todayISO()}.csv`, rows);
    UI.success("Ekspor selesai", `${list.length} tiket diunduh sebagai CSV.`);
  }

  App.registerPage("orders", {
    label: "Input Barang",
    navLabel: "Input Barang",
    group: "Operasional",
    icon: "clipboard",
    render() {
      const f = App.state.filters.orders;
      const base = baseFiltered();
      const orders = filteredOrders();
      const counts = tabCounts();
      const techs = (App.data.users || []).filter((u) => u.role === "teknisi" && u.active !== false);
      const actionButtons = [];
      if (App.user.role !== "teknisi") {
        actionButtons.push(`<button type="button" class="button button-secondary" data-act="orders.export">${UI.icon("download", 16)} Ekspor CSV</button>`);
      }
      if (App.can("orderCreate")) {
        actionButtons.push(`<button type="button" class="button button-primary" data-act="order.add">${UI.icon("plus", 16)} Input Barang</button>`);
      }

      const subtitle = App.user.role === "teknisi"
        ? "Daftar perangkat yang ditugaskan kepada Anda beserta progres pengerjaannya."
        : "Papan servis terpadu untuk penerimaan barang, penugasan teknisi, progres, dan pembayaran.";

      const resetFilter = `<button type="button" class="button button-secondary button-sm" data-act="orders.reset">Reset filter</button>`;
      const isFiltering = f.q || f.status !== "all" || f.device !== "all" || f.tech !== "all" || f.payment !== "all";

      return `<div class="page">
        ${UI.pageHead({
          kicker: "Operasional",
          title: "Input Barang & Servis",
          subtitle,
          actions: actionButtons.join(""),
          meta: `${UI.icon("clock", 13)} ${U.num(U.activeOrders(App.data.orders || []).length)} servis aktif · ${U.formatDate(U.todayISO(), "long")}`,
        })}
        ${summaryCards()}
        <div class="card table-card">
          <div class="table-toolbar">
            <div class="toolbar-search">
              ${UI.icon("search", 15)}
              <input class="input" type="search" data-order-search value="${U.esc(f.q)}" placeholder="Cari tiket, pelanggan, perangkat…" autocomplete="off">
            </div>
            <div class="toolbar-filters">
              <select class="select" data-order-filter="device" aria-label="Filter perangkat">
                <option value="all">Semua perangkat</option>
                ${DEVICE_OPTIONS.map((key) => `<option value="${key}" ${f.device === key ? "selected" : ""}>${U.esc(U.deviceMeta(key).label)}</option>`).join("")}
              </select>
              ${App.user.role === "teknisi" ? "" : `<select class="select" data-order-filter="tech" aria-label="Filter teknisi">
                <option value="all">Semua teknisi</option>
                ${techs.map((tech) => `<option value="${tech.id}" ${f.tech === tech.id ? "selected" : ""}>${U.esc(tech.name)}</option>`).join("")}
              </select>`}
              <select class="select" data-order-filter="payment" aria-label="Filter pembayaran">
                <option value="all">Semua pembayaran</option>
                <option value="belum" ${f.payment === "belum" ? "selected" : ""}>Belum bayar</option>
                <option value="lunas" ${f.payment === "lunas" ? "selected" : ""}>Lunas</option>
              </select>
            </div>
            <span class="filter-count">${U.num(orders.length)} tiket</span>
          </div>
          ${tabHTML(counts)}
          ${tableHTML(orders)}
          <div class="table-footer">
            <span>Menampilkan <strong>${U.num(orders.length)}</strong> dari <strong>${U.num(base.length)}</strong> tiket</span>
            <span>${moneyVisible() ? `Nilai tampil: <strong>${U.money(orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0))}</strong>` : "Data biaya disembunyikan untuk teknisi"}</span>
          </div>
          ${isFiltering ? `<div style="display:flex;justify-content:center;padding:0 16px 14px">${resetFilter}</div>` : ""}
        </div>
      </div>`;
    },
    mount() {
      const f = App.state.filters.orders;
      const params = new URLSearchParams((location.hash.split("?")[1] || ""));
      const wanted = params.get("filter");
      if (wanted === "unpaid" && f.payment !== "belum") {
        f.payment = "belum";
        App.refreshPage();
        return;
      }
      if (wanted === "ready" && f.status !== "selesai") {
        f.status = "selesai";
        App.refreshPage();
        return;
      }
      const search = document.querySelector("[data-order-search]");
      if (search) {
        const handle = U.debounce(() => {
          f.q = search.value;
          App.refreshPage();
          const next = document.querySelector("[data-order-search]");
          if (next) {
            next.focus();
            next.setSelectionRange(next.value.length, next.value.length);
          }
        }, 220);
        search.addEventListener("input", handle);
      }
      document.querySelectorAll("[data-order-filter]").forEach((select) => {
        select.addEventListener("change", () => {
          f[select.dataset.orderFilter] = select.value;
          App.refreshPage();
        });
      });
    },
  });

  App.registerActions({
    "orders.tab": (data) => {
      App.state.filters.orders.status = data.status;
      App.refreshPage();
    },
    "orders.reset": () => {
      App.state.filters.orders = { q: "", status: "all", device: "all", tech: "all", payment: "all" };
      history.replaceState(null, "", "#/orders");
      App.refreshPage();
    },
    "orders.export": () => exportOrders(filteredOrders()),
    "order.add": (data) => openOrderForm(null, data.customerId || null),
    "order.view": (data) => openDetail(data.id),
    "order.edit": (data) => {
      const order = (App.data.orders || []).find((o) => o.id === data.id);
      if (!order) return UI.error("Tiket tidak ditemukan", "Data servis tidak tersedia.");
      openOrderForm(order);
    },
    "order.progress": (data) => openProgress(data.id),
    "order.pay": (data) => openPayment(data.id),
    "order.receipt": (data) => receiptFor(data.id),
    "order.delete": (data) => deleteOrder(data.id),
  });
})();
