/* Dashboard multi-role */
(function () {
  "use strict";

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 11) return "Selamat pagi";
    if (hour < 15) return "Selamat siang";
    if (hour < 18) return "Selamat sore";
    return "Selamat malam";
  }

  function kpiCard({ label, value, iconName, featured, foot, iconStyle }) {
    return `<article class="kpi-card ${featured ? "featured" : ""}">
      <div class="kpi-top">
        <span class="kpi-label">${U.esc(label)}</span>
        <span class="kpi-icon" ${iconStyle ? `style="${iconStyle}"` : ""}>${UI.icon(iconName, 16)}</span>
      </div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-foot">${foot || ""}</div>
    </article>`;
  }

  function trendFoot(current, previous, fallback) {
    if (!previous) return fallback;
    const pct = Math.round(((current - previous) / previous) * 100);
    const cls = pct >= 0 ? "up" : "down";
    return `<span class="kpi-trend ${cls}">${UI.icon(pct >= 0 ? "arrow-up-right" : "arrow-down-left", 11)} ${Math.abs(pct)}%</span> bulan lalu`;
  }

  function chartCard({ title, subtitle, days, values, moneyMode }) {
    const total = values.reduce((s, v) => s + v, 0);
    const max = Math.max(...values, 1);
    const bars = days.map((day, index) => {
      const value = values[index];
      const height = value > 0 ? Math.max(8, Math.round((value / max) * 100)) : 2;
      const tip = moneyMode ? U.money(value) : `${value} tiket`;
      return `<div class="bar-col ${index === days.length - 1 ? "today" : ""}" title="${U.attr(day.full)}: ${U.attr(tip)}">
        <div class="bar-track"><div class="bar-fill" style="height:${height}%"><span class="bar-tip">${U.esc(tip)}</span></div></div>
        <span>${U.esc(day.label)}</span>
      </div>`;
    }).join("");
    return `<div class="card">
      <div class="chart-head">
        <div class="chart-title"><strong>${U.esc(title)}</strong><span>${U.esc(subtitle)}</span></div>
        <div class="chart-total"><strong>${moneyMode ? U.money(total) : U.num(total) + " tiket"}</strong><span>7 hari terakhir</span></div>
      </div>
      <div class="bar-chart">${bars}</div>
    </div>`;
  }

  function statusDonut(orders) {
    const keys = ["masuk", "diagnosa", "menunggu", "proses", "selesai", "diambil"];
    const counts = {};
    keys.forEach((key) => { counts[key] = 0; });
    let total = 0;
    orders.forEach((order) => {
      if (counts[order.status] != null) {
        counts[order.status] += 1;
        total += 1;
      }
    });
    let acc = 0;
    const segments = keys.map((key) => {
      const count = counts[key];
      const start = total ? (acc / total) * 360 : 0;
      acc += count;
      const end = total ? (acc / total) * 360 : 0;
      return `${U.statusMeta(key).chart} ${start}deg ${end}deg`;
    }).join(", ");
    const legend = keys.filter((key) => counts[key] > 0 || ["masuk", "proses", "selesai"].includes(key)).map((key) => `<div class="legend-row">
      <span class="legend-dot" style="background:${U.statusMeta(key).chart}"></span>
      <span class="legend-label">${U.statusMeta(key).label}</span>
      <span class="legend-value">${U.num(counts[key])}</span>
    </div>`).join("");
    return `<div class="card">
      <div class="card-head">
        <div class="card-head-title"><strong>Status pengerjaan</strong><span>Distribusi seluruh tiket</span></div>
        <a class="link-button" href="#/orders">Lihat semua</a>
      </div>
      <div class="donut-wrap">
        <div class="donut" style="background:${total ? `conic-gradient(${segments})` : "var(--surface-3)"}">
          <div class="donut-center"><strong>${U.num(total)}</strong><span>Total tiket</span></div>
        </div>
        <div class="legend">${legend || '<div class="tech-empty">Belum ada tiket.</div>'}</div>
      </div>
    </div>`;
  }

  function recentOrdersCard(orders, role) {
    const sorted = [...orders].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 6);
    const moneyCol = ["owner", "kasir"].includes(role);
    const techCol = role === "owner";
    const table = sorted.length ? `<div class="table-wrap"><table class="data-table" style="min-width:520px">
      <thead><tr>
        <th>Tiket / Pelanggan</th>
        <th>Perangkat</th>
        ${techCol ? "<th>Teknisi</th>" : ""}
        <th>Status</th>
        ${moneyCol ? '<th class="cell-right">Biaya</th>' : ""}
        <th></th>
      </tr></thead>
      <tbody>${sorted.map((order) => `<tr style="cursor:pointer" data-act="order.view" data-id="${U.esc(order.id)}">
        <td><span class="cell-primary">${U.esc(order.customerName)}</span><span class="cell-sub ticket-number">${U.esc(order.ticketNo)}</span></td>
        <td><div class="device-cell">${UI.deviceIcon(order.deviceType)}<div><span class="cell-primary" style="font-size:11.5px">${U.esc(order.brand || U.deviceMeta(order.deviceType).short)}</span><span class="cell-sub">${U.esc(order.model || "")}</span></div></div></td>
        ${techCol ? `<td><span style="font-size:10.5px">${U.esc(order.technicianName || "Belum ditugaskan")}</span></td>` : ""}
        <td>${UI.statusPill(order.status)}</td>
        ${moneyCol ? `<td class="cell-money cell-right">${U.money(order.total)}<span class="cell-sub" style="color:${order.paymentStatus === "lunas" ? "var(--success)" : "var(--warning)"}">${order.paymentStatus === "lunas" ? "Lunas" : "Belum bayar"}</span></td>` : ""}
        <td class="cell-actions"><span class="row-action">${UI.icon("chevron-right", 14)}</span></td>
      </tr>`).join("")}</tbody>
    </table></div>` : UI.emptyState("clipboard", "Belum ada tiket", "Tiket servis akan muncul di sini.");
    return `<div class="card table-card">
      <div class="card-head">
        <div class="card-head-title"><strong>${role === "teknisi" ? "Tugas terbaru saya" : "Aktivitas servis terbaru"}</strong><span>Diperbarui otomatis dari papan servis</span></div>
        <a class="link-button" href="#/orders">Semua tiket</a>
      </div>
      ${table}
    </div>`;
  }

  function quickActionsCard(role) {
    let actions = "";
    if (["owner", "kasir", "pramugari"].includes(role)) {
      actions += `<button type="button" class="quick-action" data-act="order.add"><span class="quick-action-icon">${UI.icon("plus-circle", 15)}</span>Input barang</button>`;
    }
    if (["owner", "kasir", "pramugari"].includes(role)) {
      actions += `<button type="button" class="quick-action" data-act="customer.add"><span class="quick-action-icon">${UI.icon("user-plus", 15)}</span>Pelanggan baru</button>`;
    }
    if (role === "owner") {
      actions += `<button type="button" class="quick-action" data-act="pettycash.addOut"><span class="quick-action-icon">${UI.icon("wallet", 15)}</span>Kas keluar</button>
        <a class="quick-action" href="#/reports"><span class="quick-action-icon">${UI.icon("bar-chart", 15)}</span>Lihat laporan</a>`;
    } else if (role === "teknisi") {
      actions += `<a class="quick-action" href="#/orders"><span class="quick-action-icon">${UI.icon("clipboard", 15)}</span>Tugas saya</a>
        <a class="quick-action" href="#/customers"><span class="quick-action-icon">${UI.icon("users", 15)}</span>Data pelanggan</a>`;
    } else if (role === "kasir") {
      actions += `<a class="quick-action" href="#/orders?filter=unpaid"><span class="quick-action-icon">${UI.icon("credit-card", 15)}</span>Tagihan</a>
        <a class="quick-action" href="#/reports"><span class="quick-action-icon">${UI.icon("file-text", 15)}</span>Laporan transaksi</a>`;
    } else {
      actions += `<a class="quick-action" href="#/orders"><span class="quick-action-icon">${UI.icon("clipboard", 15)}</span>Papan servis</a>
        <a class="quick-action" href="#/customers"><span class="quick-action-icon">${UI.icon("users", 15)}</span>Data pelanggan</a>`;
    }
    return `<div class="card">
      <div class="card-head"><div class="card-head-title"><strong>Aksi cepat</strong><span>Shortcut pekerjaan harian</span></div></div>
      <div class="quick-actions">${actions}</div>
    </div>`;
  }

  function attentionCard(user, orders) {
    const today = U.todayISO();
    const items = [];
    const scope = user.role === "teknisi" ? orders.filter((o) => o.technicianId === user.id) : orders;
    scope.forEach((order) => {
      const overdue = order.estimatedDone && order.estimatedDone < today && U.isActiveOrder(order);
      if (order.status === "selesai" && ["owner", "kasir", "pramugari"].includes(user.role)) {
        items.push({ priority: 1, orderId: order.id, icon: "package", tone: "success", title: `${order.customerName} siap diambil`, meta: `${order.ticketNo} · ${[order.brand, order.model].filter(Boolean).join(" ")}` });
      } else if (overdue) {
        items.push({ priority: 2, orderId: order.id, icon: "clock", tone: "warning", title: `Lewat estimasi · ${order.ticketNo}`, meta: `${order.customerName} · target ${U.formatShortDate(order.estimatedDone)}` });
      } else if (order.paymentStatus === "belum" && Number(order.total) > 0 && ["owner", "kasir"].includes(user.role)) {
        items.push({ priority: 3, orderId: order.id, icon: "credit-card", tone: "danger", title: `Belum dibayar · ${order.ticketNo}`, meta: `${order.customerName} · ${U.money(order.total)}` });
      }
    });
    const unique = [];
    const seen = new Set();
    items.sort((a, b) => a.priority - b.priority).forEach((item) => {
      if (!seen.has(item.title)) {
        seen.add(item.title);
        unique.push(item);
      }
    });
    const list = unique.slice(0, 4).map((item) => `<button type="button" class="attention-item" data-act="order.view" data-id="${U.esc(item.orderId)}">
      <span class="attention-icon ${item.tone}">${UI.icon(item.icon, 14)}</span>
      <span class="attention-copy"><strong>${U.esc(item.title)}</strong><span>${U.esc(item.meta)}</span></span>
      ${UI.icon("chevron-right", 13)}
    </button>`).join("");
    return `<div class="card">
      <div class="card-head"><div class="card-head-title"><strong>Perlu perhatian</strong><span>Prioritas hari ini</span></div>
        ${unique.length ? `<span class="badge badge-warning">${unique.length}</span>` : ""}</div>
      <div class="attention-list">${list || `<div class="tech-empty" style="padding:22px 8px">Semua terkendali. Tidak ada tugas mendesak.</div>`}</div>
    </div>`;
  }

  function technicianPerformanceCard(orders, users) {
    const month = U.currentMonth();
    const techs = (users || []).filter((u) => u.role === "teknisi" && u.active !== false);
    const rows = techs.map((tech) => {
      const assigned = orders.filter((o) => o.technicianId === tech.id);
      const active = assigned.filter(U.isActiveOrder).length;
      const done = assigned.filter((o) => ["selesai", "diambil"].includes(o.status) && U.monthOf(o.updatedAt || o.createdAt) === month).length;
      return { tech, active, done };
    }).sort((a, b) => b.done - a.done);
    const max = Math.max(1, ...rows.map((r) => r.done));
    return `<div class="card">
      <div class="card-head"><div class="card-head-title"><strong>Performa teknisi</strong><span>Servis selesai bulan ini</span></div><a class="link-button" href="#/orders">Detail</a></div>
      <div class="tech-performance">
        ${rows.length ? rows.map(({ tech, active, done }) => `<div class="tech-row">
          <div class="tech-row-head">${UI.avatar(tech.name)}<strong>${U.esc(tech.name)}</strong><span>${done} selesai · ${active} aktif</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.max(done > 0 ? 8 : 0, (done / max) * 100)}%"></div></div>
        </div>`).join("") : '<div class="tech-empty">Belum ada teknisi aktif.</div>'}
      </div>
    </div>`;
  }

  App.registerPage("dashboard", {
    label: "Dashboard",
    navLabel: "Dashboard",
    group: "Ringkasan",
    icon: "layout-dashboard",
    render() {
      const user = App.state.user;
      const data = App.state.data;
      const orders = data.orders || [];
      const role = user.role;
      const today = U.todayISO();
      const month = U.currentMonth();
      const { start, end } = U.monthRange(month);
      const days = U.lastNDays(7);
      const finance = U.financeFor(data, start, end);

      const myOrders = role === "teknisi" ? orders.filter((o) => o.technicianId === user.id) : orders;
      const active = U.activeOrders(orders);
      const activeMy = U.activeOrders(myOrders);
      const counts = U.statusCounts(orders);

      let kpis = "";
      let chartTitle = "Pendapatan 7 hari terakhir";
      let chartSubtitle = "Transaksi lunas per hari";
      let moneyMode = true;
      let chartValues;

      if (role === "owner") {
        const prevMonth = U.monthRange(U.shiftMonth(month, -1));
        const prevFinance = U.financeFor(data, prevMonth.start, prevMonth.end);
        const kas = U.kasBalance(data.kas);
        const todayOrders = orders.filter((o) => U.dateOf(o.createdAt) === today).length;
        kpis = [
          kpiCard({
            label: "Pendapatan bulan ini", value: U.money(finance.revenue), iconName: "credit-card", featured: true,
            foot: trendFoot(finance.revenue, prevFinance.revenue, `${finance.paidCount} tiket lunas bulan ini`),
          }),
          kpiCard({
            label: "Laba bersih bulan ini", value: U.money(finance.net), iconName: "trending-up",
            foot: `<span class="kpi-trend ${finance.net >= 0 ? "up" : "down"}">${UI.icon(finance.net >= 0 ? "arrow-up-right" : "arrow-down-left", 11)}</span> setelah HPP, operasional & gaji`,
            iconStyle: finance.net >= 0 ? "background:var(--success-soft);color:var(--success)" : "background:var(--danger-soft);color:var(--danger)",
          }),
          kpiCard({
            label: "Servis aktif", value: `${U.num(active.length)} <small>tiket</small>`, iconName: "wrench",
            foot: `${U.num(todayOrders)} masuk hari ini · ${U.num(counts.proses)} dikerjakan`,
            iconStyle: "background:var(--violet-soft);color:var(--violet)",
          }),
          kpiCard({
            label: "Saldo kas kecil", value: U.money(kas), iconName: "wallet",
            foot: `Alokasi ${Number(App.settings.kasPercent) || 0}% laba tiket`,
            iconStyle: "background:var(--warning-soft);color:var(--warning)",
          }),
        ].join("");
        chartValues = days.map((day) => U.paidBetween(orders, day.date, day.date).reduce((sum, o) => sum + (Number(o.total) || 0), 0));
      } else if (role === "kasir") {
        const todayPaid = U.paidBetween(orders, today, today);
        const todayRevenue = todayPaid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const unpaid = orders.filter((o) => o.paymentStatus === "belum" && Number(o.total) > 0);
        const unpaidTotal = unpaid.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const ready = orders.filter((o) => o.status === "selesai").length;
        kpis = [
          kpiCard({ label: "Pendapatan hari ini", value: U.money(todayRevenue), iconName: "credit-card", featured: true, foot: `${todayPaid.length} transaksi lunas hari ini` }),
          kpiCard({ label: "Tagihan belum dibayar", value: U.money(unpaidTotal), iconName: "wallet", foot: `${unpaid.length} tiket memerlukan pembayaran`, iconStyle: "background:var(--warning-soft);color:var(--warning)" }),
          kpiCard({ label: "Siap diambil", value: `${U.num(ready)} <small>tiket</small>`, iconName: "package", foot: "Perangkat selesai & menunggu pelanggan", iconStyle: "background:var(--success-soft);color:var(--success)" }),
          kpiCard({ label: "Servis aktif", value: `${U.num(active.length)} <small>tiket</small>`, iconName: "wrench", foot: `${U.num(orders.filter((o) => U.dateOf(o.createdAt) === today).length)} masuk hari ini`, iconStyle: "background:var(--violet-soft);color:var(--violet)" }),
        ].join("");
        chartValues = days.map((day) => U.paidBetween(orders, day.date, day.date).reduce((sum, o) => sum + (Number(o.total) || 0), 0));
      } else if (role === "teknisi") {
        const doneMonth = myOrders.filter((o) => ["selesai", "diambil"].includes(o.status) && U.monthOf(o.updatedAt || o.createdAt) === month).length;
        const dueToday = activeMy.filter((o) => o.estimatedDone === today).length;
        const processing = myOrders.filter((o) => o.status === "proses").length;
        kpis = [
          kpiCard({ label: "Tugas aktif saya", value: `${U.num(activeMy.length)} <small>tiket</small>`, iconName: "wrench", featured: true, foot: `${dueToday} jatuh tempo hari ini` }),
          kpiCard({ label: "Sedang dikerjakan", value: `${U.num(processing)} <small>tiket</small>`, iconName: "tool", foot: "Perangkat dalam proses perbaikan", iconStyle: "background:var(--violet-soft);color:var(--violet)" }),
          kpiCard({ label: "Selesai bulan ini", value: `${U.num(doneMonth)} <small>tiket</small>`, iconName: "check-circle", foot: "Termasuk perangkat yang sudah diambil", iconStyle: "background:var(--success-soft);color:var(--success)" }),
          kpiCard({ label: "Menunggu konfirmasi", value: `${U.num(myOrders.filter((o) => o.status === "menunggu").length)} <small>tiket</small>`, iconName: "clock", foot: "Menunggu persetujuan pelanggan", iconStyle: "background:var(--warning-soft);color:var(--warning)" }),
        ].join("");
        chartTitle = "Tugas baru 7 hari terakhir";
        chartSubtitle = "Penugasan servis per hari";
        moneyMode = false;
        chartValues = days.map((day) => myOrders.filter((o) => U.dateOf(o.createdAt) === day.date).length);
      } else {
        const todayIn = orders.filter((o) => U.dateOf(o.createdAt) === today).length;
        const ready = orders.filter((o) => o.status === "selesai").length;
        const newCustomers = (data.customers || []).filter((c) => U.monthOf(c.createdAt) === month).length;
        kpis = [
          kpiCard({ label: "Barang masuk hari ini", value: `${U.num(todayIn)} <small>perangkat</small>`, iconName: "clipboard", featured: true, foot: `${active.length} tiket sedang berjalan` }),
          kpiCard({ label: "Siap diambil", value: `${U.num(ready)} <small>perangkat</small>`, iconName: "package", foot: "Hubungi pelanggan untuk pengambilan", iconStyle: "background:var(--success-soft);color:var(--success)" }),
          kpiCard({ label: "Menunggu konfirmasi", value: `${U.num(orders.filter((o) => o.status === "menunggu").length)} <small>tiket</small>`, iconName: "clock", foot: "Perlu tindak lanjut ke pelanggan", iconStyle: "background:var(--warning-soft);color:var(--warning)" }),
          kpiCard({ label: "Pelanggan baru", value: `${U.num(newCustomers)} <small>bulan ini</small>`, iconName: "user-plus", foot: `Total ${U.num((data.customers || []).length)} pelanggan terdaftar`, iconStyle: "background:var(--info-soft);color:var(--info)" }),
        ].join("");
        chartTitle = "Perangkat masuk 7 hari terakhir";
        chartSubtitle = "Penerimaan baru per hari";
        moneyMode = false;
        chartValues = days.map((day) => orders.filter((o) => U.dateOf(o.createdAt) === day.date).length);
      }

      const actionButtons = [];
      if (App.can("orderCreate")) {
        actionButtons.push(`<button type="button" class="button button-primary" data-act="order.add">${UI.icon("plus", 16)} Input Barang</button>`);
      }
      if (["owner", "kasir"].includes(role)) {
        actionButtons.push(`<a href="#/reports" class="button button-secondary">${UI.icon("bar-chart", 16)} Laporan</a>`);
      } else {
        actionButtons.push(`<a href="#/orders" class="button button-secondary">${UI.icon("clipboard", 16)} ${role === "teknisi" ? "Tugas Saya" : "Papan Servis"}</a>`);
      }

      const rightStack = role === "owner"
        ? technicianPerformanceCard(orders, data.users) + attentionCard(user, orders)
        : quickActionsCard(role) + attentionCard(user, orders);

      return `<div class="page">
        ${UI.pageHead({
          kicker: U.formatDate(today, "long"),
          title: `${greeting()}, ${U.esc(U.firstName(user.name))}.`,
          subtitle: role === "owner"
            ? "Berikut ringkasan bisnis dan operasional service center Anda hari ini."
            : role === "teknisi"
              ? "Fokus pada tugas yang menjadi tanggung jawab Anda hari ini."
              : role === "kasir"
                ? "Pantau transaksi, pembayaran, dan perangkat yang siap diambil."
                : "Pantau penerimaan perangkat dan kebutuhan pelanggan hari ini.",
          actions: actionButtons.join(""),
        })}
        <div class="kpi-grid">${kpis}</div>
        <div class="dash-grid">
          ${chartCard({ title: chartTitle, subtitle: chartSubtitle, days, values: chartValues, moneyMode })}
          ${statusDonut(myOrders)}
        </div>
        <div class="dash-bottom">
          ${recentOrdersCard(myOrders, role)}
          <div class="flex-col gap-3">${rightStack}</div>
        </div>
      </div>`;
    },
  });
})();
