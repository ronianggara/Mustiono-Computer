/* Laporan transaksi, keuangan & gaji */
(function () {
  "use strict";

  function filters() {
    return App.state.filters.reports;
  }

  function isOwner() {
    return App.user && App.user.role === "owner";
  }

  function activeTab() {
    const f = filters();
    if (!isOwner() && f.tab !== "transaksi") return "transaksi";
    return f.tab;
  }

  function activeMonthKey() {
    return activeTab() === "gaji" ? "salaryPeriod" : "month";
  }

  function activeRange() {
    return U.monthRange(filters()[activeMonthKey()]);
  }

  function summaryCard(label, iconName, value, foot, tone, style) {
    return `<div class="summary-card ${tone || ""}"><span>${UI.icon(iconName, 13)} ${U.esc(label)}</span><strong${style ? ` style="${style}"` : ""}>${value}</strong><small>${U.esc(foot)}</small></div>`;
  }

  function tabsHTML() {
    const tab = activeTab();
    const items = [
      { key: "transaksi", label: "Transaksi", icon: "receipt" },
      { key: "keuangan", label: "Keuangan", icon: "bar-chart", owner: true },
      { key: "gaji", label: "Gaji Karyawan", icon: "briefcase", owner: true },
    ].filter((item) => !item.owner || isOwner());
    return `<div class="tabs">${items.map((item) => `<button type="button" class="tab ${tab === item.key ? "active" : ""}" data-act="reports.tab" data-tab="${item.key}">${UI.icon(item.icon, 15)} ${U.esc(item.label)}</button>`).join("")}</div>`;
  }

  function monthBar() {
    const month = filters()[activeMonthKey()];
    return `<div class="filter-bar">
      <label class="filter-field"><span>Periode laporan</span><input class="input" type="month" value="${U.esc(month)}" data-report-month></label>
      <button type="button" class="button button-secondary button-sm" data-act="reports.prev">${UI.icon("chevron-left", 14)} Bulan lalu</button>
      <button type="button" class="button button-secondary button-sm" data-act="reports.next">Bulan depan ${UI.icon("chevron-right", 14)}</button>
      ${month !== U.currentMonth() ? `<button type="button" class="button button-ghost button-sm" data-act="reports.now">${UI.icon("refresh", 14)} Bulan ini</button>` : ""}
      <span class="spacer"></span>
      <span class="badge badge-neutral">${UI.icon("calendar", 12)} ${U.esc(U.monthLabel(month))}</span>
    </div>`;
  }

  /* =====================================================
     Transaksi
     ===================================================== */

  function transactionCSV(list) {
    const rows = [["Tanggal bayar", "Tiket", "Pelanggan", "Telepon", "Perangkat", "Merek", "Model", "Teknisi", "Metode", "Jasa", "Sparepart", "Total"]];
    list.forEach((o) => rows.push([
      U.formatDateTime(o.paidAt),
      o.ticketNo,
      o.customerName,
      o.customerPhone || "",
      U.deviceMeta(o.deviceType).label,
      o.brand || "",
      o.model || "",
      o.technicianName || "",
      U.paymentLabel(o.paymentMethod),
      Number(o.serviceCost) || 0,
      Number(o.partsCost) || 0,
      Number(o.total) || 0,
    ]));
    return rows;
  }

  function renderTransaksi() {
    const f = filters();
    const range = U.monthRange(f.month);
    const orders = App.data.orders || [];
    const paid = U.paidBetween(orders, range.start, range.end)
      .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
    const revenue = paid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const parts = paid.reduce((sum, o) => sum + (Number(o.partsCost) || 0), 0);
    const service = paid.reduce((sum, o) => sum + (Number(o.serviceCost) || 0), 0);
    const cash = paid.filter((o) => o.paymentMethod === "cash").reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const nonCash = revenue - cash;
    const unpaid = orders.filter((o) => o.paymentStatus === "belum" && Number(o.total) > 0 && o.status !== "batal" && U.inRange(o.createdAt, range.start, range.end));
    const unpaidTotal = unpaid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const avg = paid.length ? revenue / paid.length : 0;

    const summary = isOwner()
      ? `<div class="report-summary">
          ${summaryCard("Pendapatan", "credit-card", U.money(revenue), `${paid.length} transaksi lunas`, "", "font-size:15px")}
          ${summaryCard("HPP sparepart", "package", U.money(parts), "Biaya komponen terjual")}
          ${summaryCard("Jasa servis", "wrench", U.money(service), `Rata-rata ${U.money(avg)} / transaksi`)}
          ${summaryCard("Piutang periode", "clock", U.money(unpaidTotal), `${unpaid.length} tiket belum dibayar`, unpaid.length ? "negative" : "")}
        </div>`
      : `<div class="report-summary">
          ${summaryCard("Pendapatan", "credit-card", U.money(revenue), `${paid.length} transaksi lunas`, "highlight", "font-size:15px")}
          ${summaryCard("Pembayaran tunai", "banknote", U.money(cash), "Total metode tunai")}
          ${summaryCard("Pembayaran non-tunai", "credit-card", U.money(nonCash), "Transfer, QRIS, kartu, e-wallet")}
          ${summaryCard("Rata-rata transaksi", "trending-up", U.money(avg), `${unpaid.length} tagihan belum dibayar`)}
        </div>`;

    const rows = paid.map((o) => `<tr data-act="order.view" data-id="${U.esc(o.id)}">
      <td><span class="ticket-number">${U.esc(U.formatShortDate(o.paidAt))}</span><span class="cell-sub">${U.esc(U.formatTime(o.paidAt))}</span></td>
      <td><span class="cell-primary">${U.esc(o.customerName)}</span><span class="cell-sub ticket-number">${U.esc(o.ticketNo)}</span></td>
      <td><div class="device-cell">${UI.deviceIcon(o.deviceType)}<div><span class="cell-primary" style="font-size:11px">${U.esc(o.brand || U.deviceMeta(o.deviceType).short)}</span><span class="cell-sub">${U.esc(o.model || "")}</span></div></div></td>
      <td><span class="badge badge-neutral">${U.esc(UI.payMethod(o.paymentMethod))}</span></td>
      <td class="cell-money cell-right">${U.money(o.serviceCost)}</td>
      <td class="cell-money cell-right">${U.money(o.partsCost)}</td>
      <td class="cell-money cell-right" style="color:var(--text);font-weight:700">${U.money(o.total)}</td>
    </tr>`).join("");

    const table = paid.length
      ? `<div class="table-wrap"><table class="data-table" style="min-width:720px">
          <thead><tr><th>Tanggal</th><th>Tiket / Pelanggan</th><th>Perangkat</th><th>Metode</th><th class="cell-right">Jasa</th><th class="cell-right">Sparepart</th><th class="cell-right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : UI.emptyState("receipt", "Belum ada transaksi", `Tidak ada pembayaran lunas pada ${U.monthLabel(f.month)}.`);

    return `${summary}
      ${unpaid.length ? `<div class="alert alert-warning">${UI.icon("alert-triangle", 17)}<span><strong>${unpaid.length} tiket belum dibayar</strong> senilai ${U.money(unpaidTotal)} pada periode ini. <a href="#/orders?filter=unpaid" style="font-weight:700;text-decoration:underline">Lihat tagihan</a></span></div>` : ""}
      <div class="card table-card">
        <div class="card-head"><div class="card-head-title"><strong>Rincian transaksi lunas</strong><span>${U.esc(U.monthLabel(f.month))} · diurutkan dari pembayaran terbaru</span></div><button type="button" class="button button-secondary button-sm" data-act="reports.export">${UI.icon("download", 14)} CSV</button></div>
        ${table}
        <div class="table-footer"><span><strong>${U.num(paid.length)}</strong> transaksi lunas</span><span>Total pendapatan <strong>${U.money(revenue)}</strong></span></div>
      </div>`;
  }

  /* =====================================================
     Keuangan
     ===================================================== */

  function financeCSV(rows) {
    const csv = [["Tanggal", "Jenis", "Keterangan", "Nominal"]];
    rows.forEach((row) => csv.push([U.formatDate(row.date), row.label, row.description, row.amount]));
    return csv;
  }

  function renderKeuangan() {
    if (!isOwner()) return "";
    const f = filters();
    const range = U.monthRange(f.month);
    const finance = U.financeFor(App.data, range.start, range.end);
    const margin = finance.revenue ? Math.round((finance.net / finance.revenue) * 100) : 0;
    const totalExpense = finance.parts + finance.opex + finance.salaryTotal;
    const ledger = U.financeLedger(App.data, range.start, range.end);

    const months = U.lastNMonths(6, f.month).map((month) => {
      const r = U.monthRange(month.value);
      const fin = U.financeFor(App.data, r.start, r.end);
      return {
        ...month,
        revenue: fin.revenue,
        expense: fin.parts + fin.opex + fin.salaryTotal,
        net: fin.net,
      };
    });
    const max = Math.max(1, ...months.map((m) => Math.max(m.revenue, m.expense)));
    const bars = months.map((m) => `<div class="finance-month" title="${U.attr(U.monthLabel(m.value))}: Pendapatan ${U.attr(U.money(m.revenue))}, Beban ${U.attr(U.money(m.expense))}">
      <div class="finance-bar-group">
        <div class="finance-bar revenue" style="height:${Math.max(m.revenue ? 3 : 0, Math.round((m.revenue / max) * 100))}%"></div>
        <div class="finance-bar expense" style="height:${Math.max(m.expense ? 3 : 0, Math.round((m.expense / max) * 100))}%"></div>
      </div>
      <span>${U.esc(m.label)}</span>
    </div>`).join("");

    const ledgerRows = ledger.map((row) => `<tr>
      <td><span class="ticket-number">${U.esc(U.formatShortDate(row.date))}</span></td>
      <td><span class="ledger-type ${row.type}">${U.esc(row.label)}</span></td>
      <td><span class="cell-primary" style="font-size:11px">${U.esc(row.description)}</span></td>
      <td class="ledger-amount ${row.amount >= 0 ? "in" : "out"}">${row.amount >= 0 ? "+" : "−"}${U.money(Math.abs(row.amount))}</td>
    </tr>`).join("");

    return `<div class="report-summary">
      ${summaryCard("Pendapatan", "credit-card", U.money(finance.revenue), `${finance.paidCount} transaksi lunas`)}
      ${summaryCard("Total beban", "trending-down", U.money(totalExpense), "HPP + operasional + gaji")}
      ${summaryCard("Laba bersih", "trending-up", U.money(finance.net), "Setelah seluruh beban", finance.net >= 0 ? "positive" : "negative", "font-size:15px")}
      ${summaryCard("Margin bersih", "percent", `${U.num(margin)}%`, "Laba bersih / pendapatan", margin >= 0 ? "positive" : "negative")}
    </div>
    <div class="finance-layout">
      <div class="card finance-chart">
        <div class="card-head" style="padding:0;border:0">
          <div class="card-head-title"><strong>Pendapatan vs beban</strong><span>Enam bulan terakhir hingga ${U.esc(U.monthLabel(f.month))}</span></div>
          <span class="badge badge-success">${UI.icon("trending-up", 12)} ${U.money(finance.net)}</span>
        </div>
        <div class="finance-bars">${bars}</div>
        <div class="finance-legend"><span><i style="background:var(--primary)"></i> Pendapatan</span><span><i style="background:var(--accent)"></i> Beban</span><span style="margin-left:auto">Laba bersih periode: <strong style="color:${finance.net >= 0 ? "var(--success)" : "var(--danger)"}">${U.money(finance.net)}</strong></span></div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-head-title"><strong>Rincian laba rugi</strong><span>${U.esc(U.monthLabel(f.month))}</span></div></div>
        <div class="breakdown">
          <div class="breakdown-row"><span><i style="background:var(--primary)"></i> Pendapatan servis</span><strong>${U.money(finance.revenue)}</strong></div>
          <div class="breakdown-row"><span><i style="background:var(--warning)"></i> HPP sparepart</span><strong>−${U.money(finance.parts)}</strong></div>
          <div class="breakdown-row"><span><i style="background:var(--violet)"></i> Laba kotor</span><strong>${U.money(finance.gross)}</strong></div>
          <div class="breakdown-row"><span><i style="background:var(--danger)"></i> Operasional kas kecil</span><strong>−${U.money(finance.opex)}</strong></div>
          <div class="breakdown-row"><span><i style="background:var(--info)"></i> Gaji dibayar</span><strong>−${U.money(finance.salaryTotal)}</strong></div>
          <div class="breakdown-row total"><span>Laba bersih</span><strong style="color:${finance.net >= 0 ? "var(--success)" : "var(--danger)"}">${U.money(finance.net)}</strong></div>
        </div>
        <div class="helper-text" style="padding:0 19px 16px">Alokasi kas kecil dari laba tiket adalah perpindahan dana internal, bukan beban usaha, sehingga tidak mengurangi laba bersih.</div>
      </div>
    </div>
    <div class="card table-card">
      <div class="card-head">
        <div class="card-head-title"><strong>Buku kas & laba rugi</strong><span>Pendapatan, HPP, operasional, dan gaji pada periode ini</span></div>
        <button type="button" class="button button-secondary button-sm" data-act="reports.export">${UI.icon("download", 14)} CSV</button>
      </div>
      ${ledger.length ? `<div class="table-wrap"><table class="data-table" style="min-width:620px">
        <thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th class="cell-right">Nominal</th></tr></thead>
        <tbody>${ledgerRows}</tbody>
      </table></div>` : UI.emptyState("bar-chart", "Belum ada mutasi", "Tidak ada transaksi keuangan pada periode ini.")}
      <div class="table-footer"><span><strong>${U.num(ledger.length)}</strong> baris mutasi</span><span>Laba bersih <strong style="color:${finance.net >= 0 ? "var(--success)" : "var(--danger)"}">${U.money(finance.net)}</strong></span></div>
    </div>`;
  }

  /* =====================================================
     Gaji
     ===================================================== */

  function salaryCSV(records) {
    const rows = [["Periode", "Nama", "Gaji pokok", "Bonus", "Potongan", "Total", "Status", "Tanggal bayar", "Catatan"]];
    records.forEach((s) => rows.push([
      U.monthLabel(s.period), s.userName, s.base, s.bonus, s.deduction, s.total,
      s.status === "dibayar" ? "Dibayar" : "Belum dibayar",
      s.paidAt ? U.formatDateTime(s.paidAt) : "", s.note || "",
    ]));
    return rows;
  }

  function openSalaryForm(record) {
    if (!isOwner()) return;
    const isEdit = !!record;
    const s = record || {};
    const total = (Number(s.base) || 0) + (Number(s.bonus) || 0) - (Number(s.deduction) || 0);
    UI.openModal({
      title: isEdit ? "Edit gaji karyawan" : "Tambah data gaji",
      subtitle: isEdit ? `${s.userName} · ${U.monthLabel(s.period)}` : "Atur komponen gaji bulanan.",
      iconName: "briefcase",
      size: "sm",
      body: `<form id="salaryForm" novalidate>
        <div class="form-grid">
          <label class="field span-2"><span class="field-label">Gaji pokok</span><span class="input-with-prefix"><span>Rp</span><input class="input" name="base" inputmode="numeric" value="${U.num(s.base || 0)}"></span></label>
          <label class="field"><span class="field-label">Bonus</span><span class="input-with-prefix"><span>Rp</span><input class="input" name="bonus" inputmode="numeric" value="${U.num(s.bonus || 0)}"></span></label>
          <label class="field"><span class="field-label">Potongan</span><span class="input-with-prefix"><span>Rp</span><input class="input" name="deduction" inputmode="numeric" value="${U.num(s.deduction || 0)}"></span></label>
          <label class="field span-2"><span class="field-label">Catatan</span><input class="input" name="note" value="${U.esc(s.note || "")}" placeholder="cth. Bonus lembur, potongan kasbon"></label>
          <div class="span-2"><label class="check-row"><input type="checkbox" name="paid" ${s.status === "dibayar" ? "checked" : ""}> Tandai sudah dibayar</label></div>
          <div class="span-2"><div class="kas-form-total"><span>Total gaji diterima</span><strong id="salaryTotalPreview">${U.money(total)}</strong></div></div>
        </div>
      </form>`,
      footer: `<button type="button" class="button button-secondary" data-close>Batal</button>
        <button type="submit" form="salaryForm" class="button button-primary" id="saveSalaryBtn">${UI.icon("save", 15)} Simpan</button>`,
      onMount: (overlay) => {
        const form = overlay.querySelector("#salaryForm");
        const preview = overlay.querySelector("#salaryTotalPreview");
        const calc = () => {
          const value = U.parseNumber(form.elements.base.value) + U.parseNumber(form.elements.bonus.value) - U.parseNumber(form.elements.deduction.value);
          preview.textContent = U.money(value);
        };
        ["base", "bonus", "deduction"].forEach((key) => form.elements[key].addEventListener("input", calc));
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const btn = overlay.querySelector("#saveSalaryBtn");
          const paid = form.elements.paid.checked;
          UI.setLoading(btn, true, "Menyimpan…");
          try {
            await App.db.upsert("salaries", {
              ...(record || {}),
              base: U.parseNumber(form.elements.base.value),
              bonus: U.parseNumber(form.elements.bonus.value),
              deduction: U.parseNumber(form.elements.deduction.value),
              status: paid ? "dibayar" : "belum",
              paidAt: paid ? (s.paidAt || U.nowISO()) : "",
              note: form.elements.note.value.trim(),
            });
            await App.reload();
            UI.closeOverlay();
            App.refreshPage();
            UI.success("Data gaji disimpan", `${s.userName || "Karyawan"} · ${U.monthLabel(s.period || filters().salaryPeriod)}`);
          } catch (err) {
            UI.error("Gagal menyimpan gaji", err.message);
          } finally {
            UI.setLoading(btn, false);
          }
        });
      },
    });
  }

  async function generateSalary() {
    if (!isOwner()) return;
    const period = filters().salaryPeriod;
    const existing = (App.data.salaries || []).filter((s) => s.period === period);
    const existingIds = new Set(existing.map((s) => s.userId));
    const users = (App.data.users || []).filter((u) => u.active !== false && Number(u.salary) > 0 && !existingIds.has(u.id));
    if (!users.length) {
      return UI.info("Tidak ada data baru", existing.length ? "Seluruh karyawan dengan skema gaji sudah memiliki record periode ini." : "Atur gaji pokok karyawan terlebih dahulu di Pengaturan → Akun.");
    }
    const ok = await UI.confirm({
      title: "Buat gaji periode",
      heading: `Buat ${users.length} record gaji?`,
      message: `Gaji ${U.monthLabel(period)} akan dibuat untuk karyawan aktif yang memiliki skema gaji dan belum memiliki record periode ini.`,
      detail: users.map((u) => `${U.esc(u.name)} · ${U.money(u.salary)}`).join("<br>"),
      confirmText: "Buat data gaji",
      danger: false,
      iconName: "briefcase",
    });
    if (!ok) return;
    try {
      for (const user of users) {
        await App.db.upsert("salaries", {
          period,
          userId: user.id,
          userName: user.name,
          base: Number(user.salary) || 0,
          bonus: 0,
          deduction: 0,
          status: "belum",
          paidAt: "",
          note: "Gaji bulanan",
        });
      }
      await App.reload();
      App.refreshPage();
      UI.success("Gaji berhasil dibuat", `${users.length} record gaji ${U.monthLabel(period)}.`);
    } catch (err) {
      UI.error("Gagal membuat gaji", err.message);
    }
  }

  async function paySalary(record) {
    if (!isOwner()) return;
    const ok = await UI.confirm({
      title: "Bayar gaji",
      heading: `Tandai gaji ${record.userName} sudah dibayar?`,
      message: `Total ${U.money(record.total)} akan tercatat sebagai beban gaji pada laporan keuangan sesuai tanggal pembayaran.`,
      confirmText: "Tandai dibayar",
      danger: false,
      iconName: "check-circle",
    });
    if (!ok) return;
    try {
      await App.db.upsert("salaries", { ...record, status: "dibayar", paidAt: U.nowISO() });
      await App.reload();
      App.refreshPage();
      UI.success("Gaji ditandai lunas", `${record.userName} · ${U.money(record.total)}`);
    } catch (err) {
      UI.error("Gagal memperbarui gaji", err.message);
    }
  }

  function deleteSalary(record) {
    if (!isOwner()) return;
    UI.confirm({
      title: "Hapus record gaji",
      heading: "Hapus data gaji ini?",
      message: "Record gaji akan dihapus dari periode dan laporan keuangan.",
      detail: `${U.esc(record.userName)} · ${U.monthLabel(record.period)}<br>${U.money(record.total)}`,
      confirmText: "Hapus record",
      iconName: "trash",
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await App.db.remove("salaries", record.id);
        await App.reload();
        App.refreshPage();
        UI.success("Record gaji dihapus", record.userName);
      } catch (err) {
        UI.error("Gagal menghapus gaji", err.message);
      }
    });
  }

  function renderGaji() {
    if (!isOwner()) return "";
    const f = filters();
    const records = (App.data.salaries || [])
      .filter((s) => s.period === f.salaryPeriod)
      .sort((a, b) => String(a.userName).localeCompare(String(b.userName)));
    const total = records.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const paid = records.filter((s) => s.status === "dibayar");
    const paidTotal = paid.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const percent = total ? Math.round((paidTotal / total) * 100) : 0;
    const employees = new Set(records.map((s) => s.userId)).size;

    const rows = records.map((s) => {
      const user = U.userById(App.data.users || [], s.userId);
      return `<tr>
        <td><div class="table-user">${UI.avatar(s.userName)}<div class="table-user-copy"><strong>${U.esc(s.userName)}</strong><span>${U.esc(user ? U.roleLabel(user.role) : "Karyawan")}</span></div></div></td>
        <td class="cell-money cell-right">${U.money(s.base)}</td>
        <td class="cell-money cell-right" style="color:var(--success)">${s.bonus ? "+" + U.money(s.bonus) : "—"}</td>
        <td class="cell-money cell-right" style="color:var(--danger)">${s.deduction ? "−" + U.money(s.deduction) : "—"}</td>
        <td class="cell-money cell-right" style="font-weight:700;color:var(--text)">${U.money(s.total)}</td>
        <td>${s.status === "dibayar" ? '<span class="status-pill status-green">Dibayar</span>' : '<span class="status-pill status-amber">Belum dibayar</span>'}<span class="cell-sub">${s.paidAt ? U.esc(U.formatShortDate(s.paidAt)) : "—"}</span></td>
        <td class="cell-actions"><div class="row-actions">
          ${s.status !== "dibayar" ? `<button type="button" class="row-action success" data-act="salary.pay" data-id="${U.esc(s.id)}" title="Bayar gaji">${UI.icon("check-circle", 14)}</button>` : ""}
          <button type="button" class="row-action primary" data-act="salary.edit" data-id="${U.esc(s.id)}" title="Edit gaji">${UI.icon("pencil", 14)}</button>
          <button type="button" class="row-action danger" data-act="salary.delete" data-id="${U.esc(s.id)}" title="Hapus record">${UI.icon("trash", 14)}</button>
        </div></td>
      </tr>`;
    }).join("");

    return `<div class="report-summary">
      ${summaryCard("Total gaji periode", "briefcase", U.money(total), `${employees} karyawan`, "", "font-size:15px")}
      ${summaryCard("Sudah dibayar", "check-circle", U.money(paidTotal), `${paid.length} dari ${records.length} record`, "positive")}
      ${summaryCard("Belum dibayar", "clock", U.money(total - paidTotal), `${records.length - paid.length} record menunggu`, records.length - paid.length ? "negative" : "")}
      ${summaryCard("Progres pembayaran", "percent", `${percent}%`, U.monthLabel(f.salaryPeriod))}
    </div>
    <div class="salary-progress">
      <div class="salary-progress-copy"><strong>Realisasi gaji ${U.esc(U.monthLabel(f.salaryPeriod))}</strong><span>${U.money(paidTotal)} dari ${U.money(total)}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <strong style="font-family:var(--font-mono);font-size:11px">${percent}%</strong>
    </div>
    <div class="card table-card">
      <div class="card-head">
        <div class="card-head-title"><strong>Daftar gaji karyawan</strong><span>Gaji pokok, bonus, potongan, dan status pembayaran</span></div>
        <div class="card-head-actions">
          <button type="button" class="button button-secondary button-sm" data-act="salary.generate">${UI.icon("refresh", 14)} Buat periode</button>
          <button type="button" class="button button-secondary button-sm" data-act="reports.export">${UI.icon("download", 14)} CSV</button>
        </div>
      </div>
      ${records.length ? `<div class="table-wrap"><table class="data-table" style="min-width:760px">
        <thead><tr><th>Karyawan</th><th class="cell-right">Gaji pokok</th><th class="cell-right">Bonus</th><th class="cell-right">Potongan</th><th class="cell-right">Total</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>` : UI.emptyState("briefcase", "Belum ada data gaji", `Buat record gaji ${U.monthLabel(f.salaryPeriod)} untuk karyawan aktif.`,
        `<button type="button" class="button button-primary button-sm" data-act="salary.generate">${UI.icon("plus", 14)} Buat gaji periode</button>`)}
      <div class="table-footer"><span><strong>${records.length}</strong> record · <strong>${employees}</strong> karyawan</span><span>Total <strong>${U.money(total)}</strong></span></div>
    </div>`;
  }

  /* =====================================================
     Halaman
     ===================================================== */

  App.registerPage("reports", {
    label: "Laporan",
    navLabel: "Laporan",
    group: "Keuangan",
    icon: "bar-chart",
    render() {
      const tab = activeTab();
      const titles = {
        transaksi: { title: "Laporan Transaksi", subtitle: "Rekap pembayaran lunas dan tagihan pelanggan per periode." },
        keuangan: { title: "Laporan Keuangan", subtitle: "Pendapatan, HPP, operasional, gaji, dan laba bersih usaha." },
        gaji: { title: "Laporan Gaji Karyawan", subtitle: "Kelola gaji bulanan, bonus, potongan, dan status pembayaran." },
      };
      const current = titles[tab];
      const actions = tab === "gaji"
        ? `<button type="button" class="button button-secondary" data-act="reports.export">${UI.icon("download", 16)} Ekspor CSV</button>
           <button type="button" class="button button-primary" data-act="salary.generate">${UI.icon("briefcase", 16)} Buat Gaji</button>`
        : `<button type="button" class="button button-primary" data-act="reports.export">${UI.icon("download", 16)} Ekspor CSV</button>`;
      return `<div class="page">
        ${UI.pageHead({
          kicker: "Laporan",
          title: current.title,
          subtitle: current.subtitle,
          actions,
          meta: `${UI.icon("calendar", 13)} ${U.esc(U.monthLabel(filters()[activeMonthKey()]))} · ${isOwner() ? "Akses penuh owner" : "Akses kasir"}`,
        })}
        ${tabsHTML()}
        ${monthBar()}
        ${tab === "transaksi" ? renderTransaksi() : tab === "keuangan" ? renderKeuangan() : renderGaji()}
      </div>`;
    },
    mount() {
      const monthInput = document.querySelector("[data-report-month]");
      if (monthInput) {
        monthInput.addEventListener("change", () => {
          if (!monthInput.value) return;
          filters()[activeMonthKey()] = monthInput.value;
          App.refreshPage();
        });
      }
    },
  });

  App.registerActions({
    "reports.tab": (data) => {
      if (!["transaksi", "keuangan", "gaji"].includes(data.tab)) return;
      if (!isOwner() && data.tab !== "transaksi") return UI.warning("Akses dibatasi", "Laporan keuangan hanya dapat dibuka owner.");
      filters().tab = data.tab;
      App.refreshPage();
    },
    "reports.prev": () => {
      const key = activeMonthKey();
      filters()[key] = U.shiftMonth(filters()[key], -1);
      App.refreshPage();
    },
    "reports.next": () => {
      const key = activeMonthKey();
      filters()[key] = U.shiftMonth(filters()[key], 1);
      App.refreshPage();
    },
    "reports.now": () => {
      const key = activeMonthKey();
      filters()[key] = U.currentMonth();
      App.refreshPage();
    },
    "reports.export": () => {
      const tab = activeTab();
      if (tab === "transaksi") {
        const range = U.monthRange(filters().month);
        const list = U.paidBetween(App.data.orders || [], range.start, range.end).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
        U.downloadCSV(`laporan-transaksi-${filters().month}.csv`, transactionCSV(list));
        UI.success("Ekspor transaksi selesai", `${list.length} transaksi diunduh.`);
      } else if (tab === "keuangan") {
        const range = U.monthRange(filters().month);
        const rows = U.financeLedger(App.data, range.start, range.end);
        U.downloadCSV(`laporan-keuangan-${filters().month}.csv`, financeCSV(rows));
        UI.success("Ekspor keuangan selesai", `${rows.length} baris mutasi diunduh.`);
      } else if (tab === "gaji") {
        const records = (App.data.salaries || []).filter((s) => s.period === filters().salaryPeriod);
        U.downloadCSV(`laporan-gaji-${filters().salaryPeriod}.csv`, salaryCSV(records));
        UI.success("Ekspor gaji selesai", `${records.length} record diunduh.`);
      }
    },
    "salary.generate": () => generateSalary(),
    "salary.edit": (data) => {
      const record = (App.data.salaries || []).find((s) => s.id === data.id);
      if (record) openSalaryForm(record);
    },
    "salary.pay": (data) => {
      const record = (App.data.salaries || []).find((s) => s.id === data.id);
      if (record) paySalary(record);
    },
    "salary.delete": (data) => {
      const record = (App.data.salaries || []).find((s) => s.id === data.id);
      if (record) deleteSalary(record);
    },
  });
})();
