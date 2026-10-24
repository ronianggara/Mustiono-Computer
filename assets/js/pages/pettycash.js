/* Kas kecil — alokasi laba otomatis & pengeluaran operasional */
(function () {
  "use strict";

  const IN_CATEGORIES = ["Saldo Awal", "Tambahan Dana", "Pengembalian", "Penyesuaian"];
  const OUT_CATEGORIES = ["Pembelian Operasional", "Konsumsi", "Transportasi", "Perawatan", "Utilitas", "Lainnya"];

  function filters() {
    return App.state.filters.pettycash;
  }

  function allKas() {
    return App.data.kas || [];
  }

  function canManage() {
    return App.can("manageKas");
  }

  function selectedMonth() {
    if (!filters().month) filters().month = U.currentMonth();
    return filters().month;
  }

  function missingAllocations() {
    if (!App.settings.kasAutoEnabled) return [];
    const allocated = new Set();
    allKas().forEach((entry) => {
      if (entry.orderId) allocated.add(entry.orderId);
    });
    return (App.data.orders || []).filter((order) => {
      if (order.paymentStatus !== "lunas") return false;
      if (allocated.has(order.id)) return false;
      return U.kasAllocationFor(order, App.settings.kasPercent) > 0;
    });
  }

  function entryMatches(entry, q) {
    if (!q) return true;
    const haystack = [
      entry.category,
      entry.description,
      entry.reference,
      entry.createdBy,
      entry.source === "otomatis" ? "otomatis" : "manual",
    ].concat((entry.items || []).map((item) => item.name));
    return haystack.some((value) => U.normalize(value).includes(q));
  }

  function currentView() {
    const month = selectedMonth();
    const q = U.normalize(filters().q);
    const type = filters().type || "all";
    const entries = allKas().filter((entry) => U.monthOf(entry.date) === month);
    const filtered = entries
      .filter((entry) => type === "all" || entry.type === type)
      .filter((entry) => entryMatches(entry, q))
      .sort((a, b) => {
        const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
        if (dateCompare) return dateCompare;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    const { start, end } = U.monthRange(month);
    const totals = U.kasBetween(allKas(), start, end);
    return {
      month,
      q: filters().q || "",
      type,
      entries,
      filtered,
      totals,
      balance: U.kasBalance(allKas()),
      missing: missingAllocations(),
    };
  }

  function itemsTotal(items) {
    return (items || []).reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);
  }

  function purchaseDetail(entry) {
    const items = entry.items || [];
    if (!items.length) return "";
    return `<div class="purchase-details">
      <div class="purchase-detail-head"><span>Barang / keperluan</span><span>Qty</span><span>Harga satuan</span><span>Subtotal</span></div>
      ${items.map((item) => `<div class="purchase-detail-item">
        <span>${U.esc(item.name || "—")}</span>
        <span>${U.num(item.qty)}</span>
        <span style="text-align:right">${U.money(item.unitPrice)}</span>
        <strong>${U.money((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}</strong>
      </div>`).join("")}
      <div class="purchase-detail-item" style="border-top:1px dashed var(--border);margin-top:4px;padding-top:7px">
        <span style="font-weight:700;color:var(--text)">Total pembelian</span><span></span><span></span>
        <strong style="color:var(--text)">${U.money(itemsTotal(items))}</strong>
      </div>
      <div class="helper-text" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px">
        <span>Dicatat oleh <strong style="color:var(--text-2)">${U.esc(entry.createdBy || "—")}</strong></span>
        ${entry.reference ? `<span>Ref. <strong style="color:var(--text-2)">${U.esc(entry.reference)}</strong></span>` : ""}
        ${entry.updatedAt ? `<span>Diperbarui ${U.esc(U.formatDateTime(entry.updatedAt))}</span>` : ""}
      </div>
    </div>`;
  }

  function entryRow(entry) {
    const isIn = entry.type === "in";
    const items = entry.items || [];
    const auto = entry.source === "otomatis";
    const actions = auto
      ? (entry.orderId ? `<button type="button" class="row-action primary" data-act="order.view" data-id="${U.esc(entry.orderId)}" title="Lihat tiket">${UI.icon("external-link", 14)}</button>` : "")
      : `<button type="button" class="row-action primary" data-act="kas.edit" data-id="${U.esc(entry.id)}" title="Edit catatan">${UI.icon("pencil", 14)}</button>
        <button type="button" class="row-action danger" data-act="kas.delete" data-id="${U.esc(entry.id)}" title="Hapus catatan">${UI.icon("trash", 14)}</button>`;
    return `<tr>
      <td><span class="cell-primary">${U.esc(U.formatShortDate(entry.date))}</span><span class="cell-sub">${U.esc(U.formatDate(entry.date, "long"))}</span></td>
      <td>
        <div class="device-cell">
          <span class="kas-type-icon ${isIn ? "in" : "out"}">${UI.icon(isIn ? "arrow-down" : "arrow-up", 14)}</span>
          <div style="min-width:0">
            <span class="cell-primary">${U.esc(entry.description || entry.category || "—")}</span>
            <span class="cell-sub">${U.esc(entry.category || "Lainnya")}${entry.reference ? " · " + U.esc(entry.reference) : ""}</span>
          </div>
        </div>
      </td>
      <td><span class="source-badge ${auto ? "auto" : "manual"}">${auto ? UI.icon("sparkles", 10) : UI.icon("user", 10)} ${auto ? "Otomatis" : "Manual"}</span></td>
      <td>${items.length ? `<button type="button" class="kas-detail-toggle" data-act="kas.detail" data-id="${U.esc(entry.id)}">${UI.icon("chevron-down", 11)} ${items.length} item</button>` : '<span style="color:var(--muted);font-size:10px">—</span>'}</td>
      <td class="cell-right"><span class="kas-amount ${isIn ? "in" : "out"}">${isIn ? "+" : "−"} ${U.money(entry.amount)}</span></td>
      <td class="cell-actions"><span class="row-actions">${actions}</span></td>
    </tr>
    ${items.length ? `<tr id="kas-detail-${U.esc(entry.id)}" class="purchase-detail-row hidden"><td colspan="6">${purchaseDetail(entry)}</td></tr>` : ""}`;
  }

  /* =====================================================
     Form kas manual
     ===================================================== */

  function itemLineHTML(item, index) {
    const it = item || {};
    return `<div class="purchase-line" data-line-index="${index}">
      <input class="input" data-item-name placeholder="Nama barang / keperluan" value="${U.esc(it.name || "")}">
      <input class="input" data-item-qty type="number" min="1" step="1" placeholder="Qty" value="${it.qty ? U.esc(it.qty) : ""}">
      <input class="input" data-item-price type="number" min="0" step="1000" placeholder="Harga satuan" value="${it.unitPrice ? U.esc(it.unitPrice) : ""}">
      <button type="button" class="row-action danger" data-remove-line title="Hapus baris">${UI.icon("trash", 14)}</button>
    </div>`;
  }

  function openKasForm(type, entry) {
    if (!canManage()) return UI.warning("Akses dibatasi", "Hanya owner yang dapat mengelola kas kecil.");
    if (entry && entry.source !== "manual") return UI.warning("Tidak dapat diubah", "Alokasi otomatis terikat ke tiket dan tidak dapat diedit manual.");
    const isEdit = !!entry;
    const kind = entry ? entry.type : type;
    const isIn = kind === "in";
    const categories = isIn ? IN_CATEGORIES : OUT_CATEGORIES;
    const existingItems = !isIn && entry && Array.isArray(entry.items) ? entry.items : [];
    const initialAmount = entry ? Number(entry.amount) || 0 : 0;
    const balance = U.kasBalance(allKas());
    const available = balance + (isEdit && !isIn ? initialAmount : 0);
    const today = U.todayISO();
    const category = entry ? entry.category : categories[0];

    UI.openModal({
      title: isEdit ? "Edit catatan kas" : isIn ? "Catat kas masuk" : "Catat kas keluar",
      subtitle: isIn ? "Tambahan dana operasional di luar alokasi laba." : "Catat pengeluaran beserta rincian pembelian bila ada.",
      iconName: isIn ? "arrow-down" : "arrow-up",
      size: "lg",
      body: `<form id="kasForm" novalidate>
        <div class="form-grid">
          <label class="field"><span class="field-label">Tanggal <span class="required">*</span></span>
            <input class="input" type="date" name="date" max="${today}" value="${U.esc(entry && entry.date ? entry.date : today)}" required>
          </label>
          <label class="field"><span class="field-label">Kategori <span class="required">*</span></span>
            <select class="select" name="category">${categories.map((item) => `<option value="${U.esc(item)}" ${item === category ? "selected" : ""}>${U.esc(item)}</option>`).join("")}</select>
          </label>
          <label class="field span-2"><span class="field-label">Keterangan <span class="required">*</span></span>
            <input class="input" name="description" value="${U.esc(entry ? entry.description || "" : "")}" placeholder="${isIn ? "cth. Tambahan dana kas toko" : "cth. Pembelian tinta printer"}" required>
          </label>
          <label class="field"><span class="field-label">Nominal <span class="required">*</span></span>
            <div class="input-with-prefix"><span>Rp</span><input class="input" name="amount" inputmode="numeric" value="${initialAmount ? U.num(initialAmount).replace(/\./g, "") : ""}" placeholder="0" ${existingItems.length ? "readonly" : ""}></div>
            <span class="helper-text" id="kasAmountHint">${existingItems.length ? "Nominal mengikuti total rincian pembelian." : "Masukkan nominal tanpa titik atau koma."}</span>
          </label>
          <label class="field"><span class="field-label">Referensi / nomor nota</span>
            <input class="input" name="reference" value="${U.esc(entry ? entry.reference || "" : "")}" placeholder="cth. Nota ET-1029">
          </label>
          ${isIn ? "" : `<div class="field span-2">
            <div class="field-label-row">
              <span class="field-label">Rincian pembelian</span>
              <span class="helper-text">Opsional · nominal dihitung otomatis jika diisi</span>
            </div>
            <div class="purchase-lines" id="kasItems">${existingItems.map((item, index) => itemLineHTML(item, index)).join("")}</div>
            <button type="button" class="button button-secondary button-sm purchase-add" id="addKasItem">${UI.icon("plus", 14)} Tambah baris</button>
          </div>`}
        </div>
        <div class="kas-form-total"><span>${isIn ? "Total kas masuk" : "Total kas keluar"}</span><strong id="kasFormTotal">${U.money(initialAmount)}</strong></div>
        <div class="printer-note">${UI.icon("info", 15)}<p>Saldo kas tersedia${isEdit && !isIn ? " (setelah dikembalikan dari catatan ini)" : ""}: <strong>${U.money(available)}</strong>. ${isIn ? "Kas masuk akan menambah saldo." : "Pengeluaran tidak boleh melebihi saldo kas."}</p></div>
      </form>`,
      footer: `<button type="button" class="button button-secondary" data-close>Batal</button>
        <button type="submit" form="kasForm" class="button button-primary" id="saveKasBtn">${UI.icon("save", 15)} ${isEdit ? "Simpan perubahan" : isIn ? "Catat kas masuk" : "Catat pengeluaran"}</button>`,
      onMount: (overlay) => {
        const form = overlay.querySelector("#kasForm");
        const itemsBox = overlay.querySelector("#kasItems");
        const amountInput = form.elements.amount;
        const totalEl = overlay.querySelector("#kasFormTotal");
        const hint = overlay.querySelector("#kasAmountHint");

        const lineRows = () => (itemsBox ? Array.from(itemsBox.querySelectorAll(".purchase-line")) : []);

        const readLines = () => {
          const items = [];
          let error = "";
          lineRows().forEach((row, index) => {
            const name = row.querySelector("[data-item-name]").value.trim();
            const qtyRaw = row.querySelector("[data-item-qty]").value;
            const priceRaw = row.querySelector("[data-item-price]").value;
            if (!name && !qtyRaw && !priceRaw) return;
            if (!name) error = error || `Nama barang pada baris ${index + 1} wajib diisi.`;
            const qty = Number(qtyRaw);
            const price = U.parseNumber(priceRaw);
            if (!(qty > 0)) error = error || `Qty pada baris ${index + 1} harus lebih dari nol.`;
            if (!(price >= 0)) error = error || `Harga pada baris ${index + 1} tidak valid.`;
            items.push({ name, qty, unitPrice: price });
          });
          return { items, error };
        };

        const syncAmount = () => {
          if (!itemsBox) return;
          const { items } = readLines();
          if (items.length) {
            const total = itemsTotal(items);
            amountInput.value = total || "";
            amountInput.readOnly = true;
            if (hint) hint.textContent = "Nominal mengikuti total rincian pembelian.";
            if (totalEl) totalEl.textContent = U.money(total);
          } else {
            amountInput.readOnly = false;
            if (hint) hint.textContent = "Masukkan nominal tanpa titik atau koma.";
            if (totalEl) totalEl.textContent = U.money(U.parseNumber(amountInput.value));
          }
        };

        if (itemsBox) {
          itemsBox.addEventListener("input", syncAmount);
          itemsBox.addEventListener("click", (event) => {
            const remove = event.target.closest("[data-remove-line]");
            if (!remove) return;
            const row = remove.closest(".purchase-line");
            if (row) row.remove();
            syncAmount();
          });
          const addBtn = overlay.querySelector("#addKasItem");
          addBtn.addEventListener("click", () => {
            itemsBox.insertAdjacentHTML("beforeend", itemLineHTML({ qty: 1 }, lineRows().length));
            const rows = lineRows();
            const last = rows[rows.length - 1];
            if (last) last.querySelector("[data-item-name]").focus();
            syncAmount();
          });
          syncAmount();
        }

        amountInput.addEventListener("input", () => {
          if (totalEl) totalEl.textContent = U.money(U.parseNumber(amountInput.value));
        });

        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const btn = overlay.querySelector("#saveKasBtn");
          const date = form.elements.date.value || today;
          const description = form.elements.description.value.trim();
          const categoryValue = form.elements.category.value;
          if (!date || date > today) return UI.warning("Tanggal tidak valid", "Pilih tanggal hari ini atau sebelumnya.");
          if (!description) return UI.warning("Keterangan wajib diisi", "Tuliskan keperluan kas secara singkat.");
          if (!categoryValue) return UI.warning("Kategori wajib diisi", "Pilih kategori kas.");

          let items = [];
          let amount = 0;
          if (!isIn && itemsBox) {
            const parsed = readLines();
            if (parsed.error) return UI.warning("Periksa rincian pembelian", parsed.error);
            items = parsed.items;
          }
          amount = items.length ? itemsTotal(items) : Math.round(U.parseNumber(amountInput.value));
          if (!(amount > 0)) return UI.warning("Nominal belum valid", "Masukkan nominal kas lebih dari nol.");
          if (!isIn && amount > available) {
            return UI.warning("Saldo kas tidak cukup", `Saldo tersedia ${U.money(available)}, sedangkan pengeluaran ${U.money(amount)}.`);
          }

          UI.setLoading(btn, true, "Menyimpan…");
          try {
            const record = {
              ...(entry || {}),
              id: entry ? entry.id : "",
              date,
              type: kind,
              category: categoryValue,
              description,
              amount,
              source: "manual",
              orderId: "",
              items,
              reference: form.elements.reference.value.trim(),
              createdBy: entry && entry.createdBy ? entry.createdBy : App.user.name,
            };
            if (!record.id) delete record.id;
            await App.db.upsert("kas", record);
            await App.reload();
            UI.closeOverlay();
            UI.success(isEdit ? "Catatan kas diperbarui" : "Kas berhasil dicatat", `${description} · ${U.money(amount)}`);
            App.refreshPage();
          } catch (err) {
            UI.setLoading(btn, false);
            App.handleError(err);
          }
        });
      },
    });
  }

  /* =====================================================
     Aturan alokasi otomatis
     ===================================================== */

  function openRuleForm() {
    if (!canManage()) return UI.warning("Akses dibatasi", "Hanya owner yang dapat mengatur kas kecil.");
    const settings = App.settings;
    const enabled = settings.kasAutoEnabled !== false;
    const percent = Number(settings.kasPercent) || 0;
    UI.openModal({
      title: "Aturan alokasi kas",
      subtitle: "Sisihkan sebagian laba tiket lunas menjadi saldo kas kecil.",
      iconName: "sliders",
      size: "sm",
      body: `<form id="kasRuleForm" novalidate>
        <div class="field">
          <label class="check-row"><input type="checkbox" id="kasAutoEnabled" ${enabled ? "checked" : ""}> <span>Aktifkan alokasi otomatis</span></label>
          <span class="helper-text">Berlaku saat tiket ditandai lunas.</span>
        </div>
        <label class="field mt-3"><span class="field-label">Persentase dari laba tiket</span>
          <input class="input" id="kasPercent" type="number" min="1" max="100" step="1" value="${percent}" ${enabled ? "" : "disabled"}>
          <span class="helper-text">Laba tiket = total biaya tiket − HPP sparepart.</span>
        </label>
        <div class="kas-form-total"><span>Contoh laba tiket ${U.money(350000)}</span><strong id="kasRuleExample">${U.money(Math.round(350000 * percent / 100))}</strong></div>
        <div class="printer-note">${UI.icon("info", 15)}<p>Mengubah persentase tidak menghitung ulang catatan yang sudah masuk. Hanya pembayaran baru yang mengikuti aturan terbaru.</p></div>
      </form>`,
      footer: `<button type="button" class="button button-secondary" data-close>Batal</button>
        <button type="submit" form="kasRuleForm" class="button button-primary" id="saveKasRuleBtn">${UI.icon("save", 15)} Simpan aturan</button>`,
      onMount: (overlay) => {
        const form = overlay.querySelector("#kasRuleForm");
        const toggle = overlay.querySelector("#kasAutoEnabled");
        const percentInput = overlay.querySelector("#kasPercent");
        const example = overlay.querySelector("#kasRuleExample");
        const refreshExample = () => {
          const value = Number(percentInput.value) || 0;
          example.textContent = U.money(Math.round(350000 * value / 100));
        };
        toggle.addEventListener("change", () => {
          percentInput.disabled = !toggle.checked;
        });
        percentInput.addEventListener("input", refreshExample);
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const btn = overlay.querySelector("#saveKasRuleBtn");
          const useAuto = toggle.checked;
          const value = Number(percentInput.value);
          if (useAuto && (!(value > 0) || value > 100)) {
            return UI.warning("Persentase tidak valid", "Gunakan angka antara 1 dan 100.");
          }
          UI.setLoading(btn, true, "Menyimpan…");
          try {
            await App.saveSettings({ kasAutoEnabled: useAuto, kasPercent: useAuto ? Math.round(value) : value || 0 });
            UI.closeOverlay();
            UI.success("Aturan kas diperbarui", useAuto ? `Alokasi otomatis ${Math.round(value)}% dari laba tiket.` : "Alokasi otomatis dinonaktifkan untuk pembayaran baru.");
            App.refreshPage();
          } catch (err) {
            UI.setLoading(btn, false);
            App.handleError(err);
          }
        });
      },
    });
  }

  /* =====================================================
     Sinkronisasi & hapus
     ===================================================== */

  async function syncAllocations(el) {
    if (!canManage()) return UI.warning("Akses dibatasi", "Hanya owner yang dapat mengelola kas kecil.");
    if (!App.settings.kasAutoEnabled) {
      return UI.info("Alokasi otomatis nonaktif", "Aktifkan aturan alokasi terlebih dahulu untuk menyinkronkan.");
    }
    const list = missingAllocations();
    if (!list.length) return UI.info("Semua sudah sinkron", "Tidak ada tiket lunas yang belum dialokasikan.");
    const total = list.reduce((sum, order) => sum + U.kasAllocationFor(order, App.settings.kasPercent), 0);
    const ok = await UI.confirm({
      title: "Sinkronkan alokasi kas",
      heading: `Tambahkan ${list.length} alokasi otomatis?`,
      message: `Tiket lunas berikut belum memiliki catatan alokasi kas. Total yang akan masuk: <strong>${U.money(total)}</strong>.`,
      detail: `<div style="display:flex;flex-direction:column;gap:5px">${list.slice(0, 6).map((order) => `<span style="display:flex;justify-content:space-between;gap:12px"><span>${U.esc(order.ticketNo)} · ${U.esc(order.customerName)}</span><strong style="font-family:var(--font-mono);font-size:10px">${U.money(U.kasAllocationFor(order, App.settings.kasPercent))}</strong></span>`).join("")}${list.length > 6 ? `<span style="color:var(--muted)">+${list.length - 6} tiket lainnya</span>` : ""}</div>`,
      confirmText: "Sinkronkan sekarang",
      danger: false,
      iconName: "refresh",
    });
    if (!ok) return;
    UI.setLoading(el, true, "Menyinkronkan…");
    try {
      let count = 0;
      let totalAdded = 0;
      for (const order of list) {
        const amount = U.kasAllocationFor(order, App.settings.kasPercent);
        if (amount <= 0) continue;
        await App.db.upsert("kas", {
          date: U.dateOf(order.paidAt || order.updatedAt || order.createdAt),
          type: "in",
          category: "Alokasi Laba",
          description: `Alokasi otomatis laba ${order.ticketNo}`,
          amount,
          source: "otomatis",
          orderId: order.id,
          items: [],
          reference: order.ticketNo,
          createdBy: "Sistem",
        });
        count += 1;
        totalAdded += amount;
      }
      await App.reload();
      UI.success("Sinkronisasi selesai", `${count} alokasi ditambahkan · ${U.money(totalAdded)}`);
      App.refreshPage();
    } catch (err) {
      App.handleError(err);
    } finally {
      UI.setLoading(el, false);
    }
  }

  async function deleteKas(id) {
    if (!canManage()) return UI.warning("Akses dibatasi", "Hanya owner yang dapat menghapus catatan kas.");
    const entry = allKas().find((row) => row.id === id);
    if (!entry) return;
    if (entry.source !== "manual") {
      return UI.warning("Tidak dapat dihapus", "Alokasi otomatis mengikuti tiket. Hapus tiketnya bila alokasi ingin dibatalkan.");
    }
    const ok = await UI.confirm({
      title: "Hapus catatan kas?",
      heading: entry.description || "Hapus transaksi",
      message: `Catatan ${entry.type === "in" ? "kas masuk" : "kas keluar"} sebesar <strong>${U.money(entry.amount)}</strong> pada ${U.esc(U.formatDate(entry.date, "long"))} akan dihapus permanen.`,
      detail: (entry.items || []).length ? `<div style="display:flex;flex-direction:column;gap:4px">${entry.items.map((item) => `<span style="display:flex;justify-content:space-between;gap:12px"><span>${U.esc(item.name)} × ${U.num(item.qty)}</span><strong style="font-family:var(--font-mono);font-size:10px">${U.money((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}</strong></span>`).join("")}</div>` : "",
      confirmText: "Hapus catatan",
    });
    if (!ok) return;
    try {
      await App.db.remove("kas", id);
      await App.reload();
      UI.success("Catatan kas dihapus", "Saldo kas telah diperbarui.");
      App.refreshPage();
    } catch (err) {
      App.handleError(err);
    }
  }

  function exportKas() {
    if (!canManage()) return UI.warning("Akses dibatasi", "Hanya owner yang dapat mengekspor kas kecil.");
    const view = currentView();
    const rows = [["Tanggal", "Tipe", "Kategori", "Keterangan", "Referensi", "Sumber", "Rincian pembelian", "Nominal", "Dicatat oleh"]];
    view.filtered.forEach((entry) => {
      const items = (entry.items || []).map((item) => `${item.name} x${item.qty} @${Math.round(Number(item.unitPrice) || 0)}`).join("; ");
      rows.push([
        entry.date,
        entry.type === "in" ? "Masuk" : "Keluar",
        entry.category || "",
        entry.description || "",
        entry.reference || "",
        entry.source === "otomatis" ? "Otomatis" : "Manual",
        items,
        Number(entry.amount) || 0,
        entry.createdBy || "",
      ]);
    });
    U.downloadCSV(`kas-kecil-${view.month}.csv`, rows);
    UI.success("Ekspor selesai", `${view.filtered.length} transaksi · ${U.monthLabel(view.month)}.`);
  }

  /* =====================================================
     Halaman
     ===================================================== */

  App.registerPage("pettycash", {
    label: "Kas Kecil",
    navLabel: "Kas Kecil",
    group: "Keuangan",
    icon: "wallet",
    render() {
      const view = currentView();
      const { month, filtered, totals, balance, missing } = view;
      const auto = App.settings.kasAutoEnabled !== false;
      const percent = Number(App.settings.kasPercent) || 0;
      const netMonth = totals.totalIn - totals.totalOut;
      const priorBalance = U.kasBalance(allKas().filter((entry) => U.dateOf(entry.date) < `${month}-01`));
      const closingBalance = priorBalance + netMonth;
      const hasFilter = !!view.q || view.type !== "all";

      const actions = `<button type="button" class="button button-secondary" data-act="kas.export">${UI.icon("download", 15)} Ekspor</button>
        <button type="button" class="button button-secondary" data-act="pettycash.addIn">${UI.icon("arrow-down", 15)} Kas masuk</button>
        <button type="button" class="button button-primary" data-act="pettycash.addOut">${UI.icon("plus", 15)} Kas keluar</button>`;

      const rows = filtered.map(entryRow).join("");
      const emptyAction = hasFilter
        ? `<button type="button" class="button button-secondary button-sm" data-act="kas.reset">Reset filter</button>`
        : `<button type="button" class="button button-primary button-sm" data-act="pettycash.addOut">${UI.icon("plus", 14)} Catat pengeluaran</button>`;

      return `${UI.pageHead({
        kicker: "Keuangan",
        title: "Kas kecil",
        subtitle: "Alokasi otomatis dari laba tiket untuk menutup kebutuhan operasional harian.",
        actions,
      })}
      <div class="kas-banner">
        <div class="kas-banner-main">
          <span class="kas-eyebrow">${UI.icon("wallet", 12)} Saldo kas tersedia</span>
          <div class="kas-saldo">${U.money(balance)}</div>
          <div class="kas-banner-meta">
            <span class="in">Masuk ${U.esc(U.monthLabel(month))}<strong>+ ${U.money(totals.totalIn)}</strong></span>
            <span class="out">Keluar ${U.esc(U.monthLabel(month))}<strong>− ${U.money(totals.totalOut)}</strong></span>
            <span>Arus bersih ${U.esc(U.monthLabel(month))}<strong style="color:${netMonth >= 0 ? "#6ee7a0" : "#fca5a5"}">${U.money(netMonth)}</strong></span>
          </div>
        </div>
        <div class="kas-banner-actions">
          <a class="button button-secondary" href="#/reports">${UI.icon("bar-chart", 15)} Laporan</a>
          <button type="button" class="button button-primary" data-act="kas.rule">${UI.icon("sliders", 15)} Atur alokasi</button>
        </div>
      </div>

      <div class="kas-rule-card">
        <span class="kas-rule-icon">${UI.icon(auto ? "percent" : "toggle-left", 18)}</span>
        <div class="kas-rule-copy">
          <strong>Alokasi otomatis ${auto ? `${percent}% dari laba tiket` : "nonaktif"}
            <span class="badge ${auto ? "badge-success" : "badge-neutral"}">${auto ? "Aktif" : "Nonaktif"}</span>
            ${missing.length ? `<span class="badge badge-warning">${missing.length} belum sinkron</span>` : ""}
          </strong>
          <p>${auto
            ? `Setiap tiket yang lunas menyisihkan ${percent}% dari nilai jasa setelah HPP sparepart. Contoh: total ${U.money(500000)} dengan HPP ${U.money(200000)} → kas masuk ${U.money(Math.round(300000 * percent / 100))}.`
            : "Pembayaran tiket tidak lagi otomatis menambah kas. Catatan yang sudah ada tetap tersimpan."}</p>
        </div>
        <div class="kas-rule-actions">
          <button type="button" class="button button-secondary button-sm" data-act="kas.rule">${UI.icon("settings", 14)} Ubah aturan</button>
          ${auto ? `<button type="button" class="button button-soft button-sm" data-act="kas.sync">${UI.icon("refresh", 14)} Sinkronkan${missing.length ? ` (${missing.length})` : ""}</button>` : ""}
        </div>
      </div>

      <div class="card table-card">
        <div class="card-head">
          <div class="card-head-title"><strong>Buku kas kecil</strong><span>${U.esc(U.monthLabel(month))} · ${U.num(view.entries.length)} transaksi tercatat</span></div>
          <span class="badge ${totals.totalOut > totals.totalIn ? "badge-warning" : "badge-neutral"}">Pengeluaran ${U.money(totals.totalOut)}</span>
        </div>
        <div class="table-toolbar">
          <div class="kas-period">
            <input class="input" type="month" data-kas-month value="${U.esc(month)}" aria-label="Pilih bulan">
          </div>
          <span class="toolbar-search">
            ${UI.icon("search", 15)}
            <input class="input" type="search" data-kas-search value="${U.esc(view.q)}" placeholder="Cari keterangan, nota, atau barang…">
          </span>
          <div class="toolbar-filters">
            <select class="select" data-kas-type aria-label="Jenis transaksi">
              <option value="all" ${view.type === "all" ? "selected" : ""}>Semua jenis</option>
              <option value="in" ${view.type === "in" ? "selected" : ""}>Kas masuk</option>
              <option value="out" ${view.type === "out" ? "selected" : ""}>Kas keluar</option>
            </select>
          </div>
          <span class="filter-count">Masuk <strong style="color:var(--success)">${U.money(totals.totalIn)}</strong> · Keluar <strong style="color:var(--danger)">${U.money(totals.totalOut)}</strong></span>
        </div>
        ${filtered.length ? `<div class="table-wrap"><table class="data-table" style="min-width:840px">
          <thead><tr><th>Tanggal</th><th>Keterangan</th><th>Sumber</th><th>Rincian</th><th class="cell-right">Nominal</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>` : UI.emptyState("wallet", hasFilter ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi kas", hasFilter ? "Coba kata kunci lain atau reset filter." : "Catat pengeluaran operasional atau tambahkan dana kas.", emptyAction)}
        <div class="table-footer">
          <span>Menampilkan <strong>${U.num(filtered.length)}</strong> dari ${U.num(view.entries.length)} transaksi ${U.esc(U.monthLabel(month))}</span>
          <span>Saldo akhir ${U.esc(U.monthLabel(month))} <strong>${U.money(closingBalance)}</strong></span>
        </div>
      </div>`;
    },
    mount() {
      const monthInput = document.querySelector("[data-kas-month]");
      if (monthInput) {
        monthInput.addEventListener("change", () => {
          filters().month = monthInput.value || U.currentMonth();
          App.refreshPage();
        });
      }
      const search = document.querySelector("[data-kas-search]");
      if (search) {
        search.addEventListener("input", U.debounce(() => {
          filters().q = search.value;
          App.refreshPage();
          const next = document.querySelector("[data-kas-search]");
          if (next) {
            next.focus();
            next.setSelectionRange(next.value.length, next.value.length);
          }
        }, 220));
      }
      const typeInput = document.querySelector("[data-kas-type]");
      if (typeInput) {
        typeInput.addEventListener("change", () => {
          filters().type = typeInput.value;
          App.refreshPage();
        });
      }
    },
  });

  App.registerActions({
    "pettycash.addIn": () => openKasForm("in"),
    "pettycash.addOut": () => openKasForm("out"),
    "kas.edit": (data) => {
      const entry = allKas().find((row) => row.id === data.id);
      if (entry) openKasForm(entry.type, entry);
    },
    "kas.delete": (data) => deleteKas(data.id),
    "kas.detail": (data, el) => {
      const row = document.getElementById(`kas-detail-${data.id}`);
      if (!row) return;
      row.classList.toggle("hidden");
      if (el) el.classList.toggle("open", !row.classList.contains("hidden"));
    },
    "kas.rule": () => openRuleForm(),
    "kas.sync": (data, el) => syncAllocations(el),
    "kas.export": () => exportKas(),
    "kas.reset": () => {
      filters().q = "";
      filters().type = "all";
      filters().month = U.currentMonth();
      App.refreshPage();
    },
  });
})();
