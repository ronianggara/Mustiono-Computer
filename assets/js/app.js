/* =========================================================
   ServisPro — inti aplikasi
   ========================================================= */
(function () {
  "use strict";

  const NAV_SECTIONS = [
    { title: "Ringkasan", pages: ["dashboard"] },
    { title: "Operasional", pages: ["orders", "customers", "suppliers"] },
    { title: "Keuangan", pages: ["reports", "pettycash"] },
    { title: "Sistem", pages: ["settings"] },
  ];

  const PAGE_ACCESS = {
    dashboard: ["owner", "teknisi", "kasir", "pramugari"],
    orders: ["owner", "teknisi", "kasir", "pramugari"],
    customers: ["owner", "teknisi", "kasir", "pramugari"],
    suppliers: ["owner"],
    reports: ["owner", "kasir"],
    pettycash: ["owner"],
    settings: ["owner"],
  };

  const PERMISSIONS = {
    orderCreate: ["owner", "kasir", "pramugari"],
    orderEdit: ["owner", "kasir", "pramugari"],
    orderProgress: ["owner", "teknisi", "kasir", "pramugari"],
    orderPayment: ["owner", "kasir"],
    orderDelete: ["owner"],
    customerManage: ["owner", "kasir", "pramugari"],
    supplierManage: ["owner"],
    viewReports: ["owner", "kasir"],
    viewFinance: ["owner"],
    manageSalary: ["owner"],
    manageKas: ["owner"],
    manageSettings: ["owner"],
    manageUsers: ["owner"],
  };

  const App = {
    state: {
      user: null,
      data: SPData.blankData(),
      db: null,
      page: "dashboard",
      filters: {
        orders: { q: "", status: "all", device: "all", tech: "all", payment: "all" },
        customers: { q: "" },
        suppliers: { q: "" },
        reports: { tab: "transaksi", month: U.currentMonth(), start: "", end: "", salaryPeriod: U.currentMonth() },
        pettycash: { month: U.currentMonth(), q: "", type: "all" },
        settings: { tab: "akun" },
      },
      appearance: { mode: "light", primary: "" },
    },
    pages: {},
    actions: {},
    _hashBound: false,
    _remember: true,

    init() {
      document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
      this.state.appearance = SPData.getAppearance();
      this.statusMedia = window.matchMedia("(prefers-color-scheme: dark)");
      this.statusMedia.addEventListener("change", () => {
        if (this.state.appearance.mode === "system") this.applyAppearance();
      });
      this.applyAppearance();
      this.state.db = SPData.createDB();
      this.updateConnectionUI();
      this.bindLogin();
      this.bindShell();
      this.bindGlobal();
      this.checkSession();
    },

    registerPage(name, definition) {
      this.pages[name] = definition;
    },

    registerActions(actions) {
      Object.assign(this.actions, actions);
    },

    get db() {
      return this.state.db;
    },

    get user() {
      return this.state.user;
    },

    get data() {
      return this.state.data;
    },

    get settings() {
      return this.state.data.settings;
    },

    can(permission) {
      if (!this.state.user) return false;
      if (this.state.user.role === "owner") return true;
      const roles = PERMISSIONS[permission] || [];
      return roles.includes(this.state.user.role);
    },

    canAccessPage(page) {
      if (!this.state.user) return false;
      return (PAGE_ACCESS[page] || []).includes(this.state.user.role);
    },

    async checkSession() {
      const saved = SPData.getSavedSession();
      if (saved) {
        try {
          const user = await this.db.resume(saved);
          if (user) {
            const data = await this.db.bootstrap(user);
            this.startSession(user, data, { remembered: true, resumed: true });
            return;
          }
          SPData.clearSession();
        } catch (err) {
          console.warn("Gagal melanjutkan sesi:", err);
          if (err.code === "AUTH") SPData.clearSession();
          else this.pendingLoginAlert = err.message;
        }
      }
      this.showLogin();
    },

    showLogin(alertMessage) {
      document.getElementById("bootScreen").classList.add("hidden");
      document.getElementById("appShell").classList.add("hidden");
      document.getElementById("loginScreen").classList.remove("hidden");
      this.updateConnectionUI();
      const alert = document.getElementById("loginAlert");
      const message = alertMessage || this.pendingLoginAlert;
      this.pendingLoginAlert = "";
      if (message) {
        alert.className = "alert alert-warning";
        alert.innerHTML = `${UI.icon("alert-triangle", 17)}<span>${U.esc(message)}</span>`;
      } else {
        alert.className = "alert alert-danger hidden";
        alert.innerHTML = "";
      }
      setTimeout(() => document.getElementById("loginUsername").focus({ preventScroll: true }), 80);
    },

    startSession(user, data, options) {
      const opts = options || {};
      this.state.user = data.me || user;
      this.state.data = {
        users: data.users || [],
        suppliers: data.suppliers || [],
        customers: data.customers || [],
        orders: data.orders || [],
        kas: data.kas || [],
        salaries: data.salaries || [],
        settings: SPData.mergeSettings(data.settings),
      };
      let appearanceChanged = false;
      if (!this.state.appearance.primary) {
        this.state.appearance.primary = this.settings.primaryColor || "#0d9488";
        appearanceChanged = true;
      }
      if (!this.state.appearance.mode) {
        const defaultMode = this.settings.themeDefault;
        this.state.appearance.mode = ["light", "dark", "system"].includes(defaultMode) ? defaultMode : "light";
        appearanceChanged = true;
      }
      if (appearanceChanged) {
        SPData.saveAppearance(this.state.appearance);
        this.applyAppearance();
      }
      if (opts.remembered !== false) SPData.saveSession(this.state.user);
      else SPData.clearSession();
      document.getElementById("bootScreen").classList.add("hidden");
      document.getElementById("loginScreen").classList.add("hidden");
      document.getElementById("appShell").classList.remove("hidden");
      document.getElementById("loginForm").reset();
      document.getElementById("loginAlert").className = "alert alert-danger hidden";
      this.renderShell();
      this.bindHashChange();
      if (!location.hash || location.hash === "#" || location.hash === "#/") {
        history.replaceState(null, "", "#/dashboard");
      }
      this.route();
      UI.closeOverlay(true);
      if (!opts.resumed) {
        setTimeout(() => UI.success(`Selamat datang, ${U.firstName(this.state.user.name)}`, "Semoga hari kerja Anda lancar."), 280);
      }
    },

    renderShell() {
      const user = this.state.user;
      if (!user) return;
      const company = this.settings;
      const brandName = company.companyName || "ServisPro";
      const brandTag = company.tagline || "Service Management";

      document.getElementById("sidebarBrandName").textContent = brandName;
      document.getElementById("sidebarBrandTag").textContent = brandTag;
      const logoEl = document.getElementById("sidebarLogo");
      logoEl.innerHTML = company.logo
        ? `<img src="${U.esc(company.logo)}" alt="Logo ${U.esc(brandName)}">`
        : UI.icon("tool", 22);
      document.title = `${this.pages[this.state.page]?.label || "Dashboard"} · ${brandName}`;

      const initials = U.initials(user.name);
      ["sidebarAvatar", "topbarAvatar", "menuAvatar"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = initials;
      });
      document.getElementById("sidebarUserName").textContent = user.name;
      document.getElementById("sidebarUserRole").textContent = U.roleLabel(user.role);
      document.getElementById("topbarUserName").textContent = user.name;
      document.getElementById("topbarUserRole").textContent = U.roleLabel(user.role);
      document.getElementById("menuName").textContent = user.name;
      document.getElementById("menuUsername").textContent = "@" + (user.username || U.normalize(user.name).replace(/\s+/g, ""));
      document.getElementById("topbarUserRole").title = U.roleMeta(user.role).desc;

      const modeChip = document.getElementById("modeChip");
      const remote = this.db.mode === "remote";
      modeChip.textContent = remote ? "Google Sheets" : "Demo lokal";
      modeChip.className = "mode-chip " + (remote ? "remote" : "local");
      modeChip.title = remote ? "Data tersimpan di Google Sheets" : "Data tersimpan di browser perangkat ini";

      const kasCard = document.getElementById("sidebarKasCard");
      if (user.role === "owner") {
        const balance = U.kasBalance(this.state.data.kas);
        const percent = Number(company.kasPercent) || 0;
        kasCard.classList.remove("hidden");
        kasCard.innerHTML = `<div class="sidebar-kas-label"><span>Saldo kas kecil</span>${UI.icon("wallet", 13)}</div>
          <div class="sidebar-kas-value">${U.money(balance)}</div>
          <div class="sidebar-kas-foot">Alokasi ${percent}% laba tiket · <a href="#/pettycash">Kelola</a></div>`;
      } else {
        kasCard.classList.add("hidden");
        kasCard.innerHTML = "";
      }

      this.renderNav();
      this.renderNotifications();
      this.updateThemeButton();
    },

    renderNav() {
      const nav = document.getElementById("sideNav");
      const current = this.state.page;
      const orders = this.state.data.orders || [];
      const activeCount = this.state.user.role === "teknisi"
        ? U.activeOrders(orders).filter((o) => o.technicianId === this.state.user.id).length
        : U.activeOrders(orders).length;
      const html = [];
      NAV_SECTIONS.forEach((section) => {
        const items = section.pages
          .filter((page) => this.pages[page] && this.canAccessPage(page))
          .map((page) => {
            const def = this.pages[page];
            const active = page === current;
            const count = page === "orders" && activeCount > 0 ? `<span class="nav-count">${activeCount}</span>` : "";
            return `<a href="#/${page}" class="nav-link ${active ? "active" : ""}" ${active ? 'aria-current="page"' : ""}>
              ${UI.icon(def.icon || "circle", 17)}
              <span>${U.esc(def.navLabel || def.label)}</span>
              ${count}
            </a>`;
          });
        if (items.length) {
          html.push(`<div class="nav-group"><span class="nav-group-title">${U.esc(section.title)}</span>${items.join("")}</div>`);
        }
      });
      nav.innerHTML = html.join("");
    },

    buildNotifications() {
      const user = this.state.user;
      if (!user) return [];
      const role = user.role;
      const orders = (this.state.data.orders || []).filter((order) => {
        if (role === "teknisi") return order.technicianId === user.id;
        return true;
      });
      const items = [];
      orders.forEach((order) => {
        const overdue = order.estimatedDone && order.estimatedDone < U.todayISO() && U.isActiveOrder(order);
        if (order.status === "selesai" && role !== "teknisi") {
          items.push({
            priority: 1,
            orderId: order.id,
            icon: "package",
            tone: "success",
            title: "Siap diambil · " + order.ticketNo,
            text: `${order.customerName} · ${[order.brand, order.model].filter(Boolean).join(" ")}`,
          });
        } else if (overdue) {
          items.push({
            priority: 2,
            orderId: order.id,
            icon: "clock",
            tone: "warning",
            title: "Melewati estimasi · " + order.ticketNo,
            text: `${order.customerName} · target ${U.formatShortDate(order.estimatedDone)}`,
          });
        } else if (order.paymentStatus === "belum" && Number(order.total) > 0 && ["owner", "kasir"].includes(role)) {
          items.push({
            priority: 3,
            orderId: order.id,
            icon: "credit-card",
            tone: "danger",
            title: "Pembayaran tertunda · " + order.ticketNo,
            text: `${order.customerName} · ${U.money(order.total)}`,
          });
        }
      });
      return items.sort((a, b) => a.priority - b.priority).slice(0, 6);
    },

    renderNotifications() {
      const dot = document.getElementById("notifDot");
      const list = document.getElementById("notifList");
      const count = document.getElementById("notifCount");
      if (!dot || !list) return;
      const items = this.buildNotifications();
      dot.classList.toggle("hidden", items.length === 0);
      count.textContent = `${items.length} baru`;
      if (!items.length) {
        list.innerHTML = `<div class="notif-empty">Tidak ada notifikasi baru.<br>Semua servis berjalan sesuai jadwal.</div>`;
        return;
      }
      list.innerHTML = items.map((item) => `<button type="button" class="notif-item" data-notif-order="${U.esc(item.orderId)}">
        <span class="notif-item-icon" style="${item.tone === "warning" ? "background:var(--warning-soft);color:var(--warning)" : item.tone === "danger" ? "background:var(--danger-soft);color:var(--danger)" : "background:var(--success-soft);color:var(--success)"}">${UI.icon(item.icon, 14)}</span>
        <span class="notif-item-copy"><strong>${U.esc(item.title)}</strong><span>${U.esc(item.text)}</span></span>
      </button>`).join("");
    },

    route() {
      if (!this.state.user) return;
      const raw = location.hash.replace(/^#\/?/, "").split("?")[0];
      let page = raw || "dashboard";
      if (!this.pages[page] || !this.canAccessPage(page)) {
        page = "dashboard";
        history.replaceState(null, "", "#/dashboard");
      }
      const changed = this.state.page !== page;
      this.state.page = page;
      if (changed && document.getElementById("overlayRoot").firstElementChild) UI.closeOverlay();
      this.closeSidebar();
      this.closePopovers();
      this.renderPage();
    },

    renderPage(options) {
      const opts = options || {};
      const page = this.pages[this.state.page];
      const view = document.getElementById("view");
      if (!page) return;
      const scroll = window.scrollY;
      let html = "";
      try {
        html = page.render(this);
      } catch (err) {
        console.error(err);
        html = `${UI.pageHead({ kicker: "Galat", title: "Halaman gagal dimuat", subtitle: U.esc(err.message) })}`;
      }
      view.innerHTML = html;
      const def = page;
      document.getElementById("pageLabel").textContent = def.navLabel || def.label || "Dashboard";
      document.getElementById("pageGroup").textContent = def.group || "Utama";
      document.title = `${def.navLabel || def.label || "Dashboard"} · ${this.settings.companyName || "ServisPro"}`;
      this.renderNav();
      try {
        if (typeof def.mount === "function") def.mount(this);
      } catch (err) {
        console.error("Gagal memasang interaksi halaman:", err);
        UI.error("Terjadi kesalahan", err.message);
      }
      if (opts.keepScroll) window.scrollTo(0, scroll);
      else window.scrollTo(0, 0);
    },

    refreshPage(options) {
      this.renderPage({ keepScroll: true, ...(options || {}) });
    },

    async reload() {
      if (!this.state.user) return;
      const data = await this.db.bootstrap(this.state.user);
      this.state.user = data.me || this.state.user;
      this.state.data = {
        users: data.users || [],
        suppliers: data.suppliers || [],
        customers: data.customers || [],
        orders: data.orders || [],
        kas: data.kas || [],
        salaries: data.salaries || [],
        settings: SPData.mergeSettings(data.settings),
      };
      SPData.saveSession(this.state.user);
      this.renderShell();
    },

    async saveSettings(patch) {
      const merged = { ...this.state.data.settings, ...(patch || {}) };
      const saved = await this.db.upsert("settings", merged);
      this.state.data.settings = SPData.mergeSettings(saved);
      this.renderShell();
      return this.state.data.settings;
    },

    go(page) {
      if (!this.canAccessPage(page)) {
        UI.warning("Akses dibatasi", "Role Anda tidak memiliki akses ke halaman tersebut.");
        return;
      }
      if (location.hash === `#/${page}`) {
        this.route();
      } else {
        location.hash = `#/${page}`;
      }
    },

    bindHashChange() {
      if (this._hashBound) return;
      this._hashBound = true;
      window.addEventListener("hashchange", () => this.route());
    },

    bindLogin() {
      const form = document.getElementById("loginForm");
      const username = document.getElementById("loginUsername");
      const password = document.getElementById("loginPassword");
      const submit = document.getElementById("loginSubmit");
      const toggle = document.getElementById("togglePassword");

      toggle.addEventListener("click", () => {
        const isPassword = password.type === "password";
        password.type = isPassword ? "text" : "password";
        toggle.setAttribute("aria-label", isPassword ? "Sembunyikan password" : "Tampilkan password");
      });

      document.querySelectorAll("[data-demo-user]").forEach((button) => {
        button.addEventListener("click", () => {
          username.value = button.dataset.demoUser;
          password.value = button.dataset.demoPass;
          password.focus();
          UI.info("Akun demo dipilih", `${button.dataset.demoUser} · tekan Masuk untuk melanjutkan.`);
        });
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const u = username.value.trim();
        const p = password.value;
        const alert = document.getElementById("loginAlert");
        alert.classList.add("hidden");
        if (!u || !p) {
          alert.className = "alert alert-danger";
          alert.innerHTML = `${UI.icon("alert-circle", 17)}<span>Username dan password wajib diisi.</span>`;
          return;
        }
        UI.setLoading(submit, true, "Memeriksa akun…");
        try {
          const user = await this.db.login(u, p);
          const data = await this.db.bootstrap(user);
          this._remember = document.getElementById("rememberLogin").checked;
          this.startSession(user, data, { remembered: this._remember });
        } catch (err) {
          console.error(err);
          alert.className = "alert alert-danger";
          alert.innerHTML = `${UI.icon("alert-circle", 17)}<span>${U.esc(err.message)}</span>`;
        } finally {
          UI.setLoading(submit, false);
        }
      });

      document.getElementById("forgotBtn").addEventListener("click", () => this.openForgotPassword());
      document.getElementById("connectDbBtn").addEventListener("click", () => this.openConnectionModal());
    },

    updateConnectionUI() {
      const remote = !!SPData.getApiUrl();
      const button = document.getElementById("connectDbBtn");
      const demoPanel = document.getElementById("demoPanel");
      const title = document.getElementById("connectionTitle");
      const subtitle = document.getElementById("connectionSubtitle");
      if (!button) return;
      button.classList.toggle("connected", remote);
      demoPanel.classList.toggle("hidden", remote);
      if (remote) {
        let host = "Google Apps Script";
        try { host = new URL(SPData.getApiUrl()).hostname; } catch (err) { /* abaikan */ }
        title.textContent = "Terhubung ke Google Sheets";
        subtitle.textContent = host + " · klik untuk kelola koneksi";
      } else {
        title.textContent = "Hubungkan Google Sheets";
        subtitle.textContent = "Database cloud lewat Google Apps Script";
      }
    },

    openConnectionModal() {
      const current = SPData.getApiUrl();
      const isRemote = !!current;
      UI.openModal({
        title: isRemote ? "Koneksi Google Sheets" : "Hubungkan database",
        subtitle: "Gunakan Google Sheets sebagai database operasional melalui Apps Script.",
        iconName: "database",
        size: "lg",
        body: `<div class="integration-status">
          <span class="integration-status-icon ${isRemote ? "success" : ""}">${UI.icon(isRemote ? "cloud" : "database", 17)}</span>
          <div class="integration-status-copy"><strong>${isRemote ? "Mode Google Sheets aktif" : "Saat ini menggunakan mode demo lokal"}</strong><span>${isRemote ? U.esc(current) : "Data demo tersimpan di browser perangkat ini."}</span></div>
        </div>
        <label class="field">
          <span class="field-label">URL Web App Apps Script</span>
          <input class="input" id="apiUrlInput" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${U.esc(current)}">
          <span class="helper-text">Tempel URL hasil deploy Web App dengan akses “Siapa saja”. URL harus berakhiran <code>/exec</code>.</span>
        </label>
        <div id="apiTestResult"></div>
        <div class="alert alert-info" style="margin-top:16px;margin-bottom:0">
          ${UI.icon("info", 17)}
          <span>Pastikan fungsi <strong>setup()</strong> sudah dijalankan satu kali di editor Apps Script. Akun owner bawaan dibuat otomatis saat setup.</span>
        </div>`,
        footer: `${isRemote ? `<button type="button" class="button button-ghost" id="useDemoBtn" style="margin-right:auto">Gunakan mode demo</button>` : `<button type="button" class="button button-ghost" data-close style="margin-right:auto">Nanti</button>`}
          <button type="button" class="button button-secondary" data-close>Batal</button>
          <button type="button" class="button button-primary" id="connectApiBtn">${UI.icon("link", 16)} Uji &amp; simpan</button>`,
        onMount: (overlay) => {
          const input = overlay.querySelector("#apiUrlInput");
          const result = overlay.querySelector("#apiTestResult");
          overlay.querySelector("#connectApiBtn").addEventListener("click", async (event) => {
            const url = input.value.trim();
            if (!/^https:\/\/.+\/exec(\?.*)?$/i.test(url)) {
              result.innerHTML = `<div class="inline-error">${UI.icon("alert-circle", 14)} URL tidak valid. Gunakan URL Web App yang berakhiran /exec.</div>`;
              return;
            }
            UI.setLoading(event.currentTarget, true, "Menguji koneksi…");
            try {
              const tester = new SPData.RemoteDB(url);
              const response = await tester.testConnection();
              result.innerHTML = `<div class="alert alert-success" style="margin:12px 0 0">${UI.icon("check-circle", 17)} <span>${U.esc(response.message)}</span></div>`;
              SPData.setApiUrl(url);
              UI.success("Database terhubung", "Memuat ulang aplikasi…");
              setTimeout(() => location.reload(), 550);
            } catch (err) {
              result.innerHTML = `<div class="alert alert-danger" style="margin:12px 0 0">${UI.icon("alert-circle", 17)} <span>${U.esc(err.message)}</span></div>`;
              UI.setLoading(event.currentTarget, false);
            }
          });
          const demoBtn = overlay.querySelector("#useDemoBtn");
          if (demoBtn) {
            demoBtn.addEventListener("click", async () => {
              const ok = await UI.confirm({
                title: "Kembali ke mode demo?",
                heading: "Gunakan data lokal lagi?",
                message: "Aplikasi akan kembali memakai data demo di browser ini. Data cloud di Google Sheets tidak terhapus.",
                confirmText: "Gunakan mode demo",
                danger: false,
                iconName: "database",
              });
              if (!ok) return;
              SPData.setApiUrl("");
              SPData.clearSession();
              location.reload();
            });
          }
        },
      });
    },

    openForgotPassword() {
      const remote = this.db.mode === "remote";
      UI.openModal({
        title: "Lupa password?",
        subtitle: "Pemulihan akun dilakukan oleh administrator sistem.",
        iconName: "key",
        size: "sm",
        body: `<div class="detail-note">
          ${remote
            ? "Akun dikelola di Google Sheets. Minta admin membuka Apps Script lalu menjalankan fungsi <strong>resetPassword(username, passwordBaru)</strong>, atau ubah password melalui menu Pengaturan → Akun setelah masuk."
            : "Pada mode demo, gunakan salah satu akun contoh di halaman login. Untuk produksi, aktifkan mode Google Sheets dan ganti seluruh password bawaan."}
        </div>
        <div class="form-section" style="margin-top:16px">
          <div class="form-section-title">
            <span class="section-icon">${UI.icon("shield-check", 17)}</span>
            <div><strong>Tips keamanan</strong><span>Segera ganti password bawaan sebelum aplikasi dipakai operasional.</span></div>
          </div>
        </div>`,
        footer: `<button type="button" class="button button-primary" data-close>Mengerti</button>`,
      });
    },

    bindShell() {
      document.getElementById("menuButton").addEventListener("click", () => this.openSidebar());
      document.getElementById("sidebarCloseBtn").addEventListener("click", () => this.closeSidebar());
      document.getElementById("sidebarOverlay").addEventListener("click", () => this.closeSidebar());

      document.getElementById("themeToggle").addEventListener("click", () => this.cycleTheme());
      document.getElementById("menuThemeBtn").addEventListener("click", () => this.cycleTheme());

      document.getElementById("notifBtn").addEventListener("click", (event) => {
        event.stopPropagation();
        const panel = document.getElementById("notifPanel");
        const open = !panel.classList.contains("hidden");
        this.closePopovers();
        panel.classList.toggle("hidden", open);
      });

      document.getElementById("userMenuBtn").addEventListener("click", (event) => {
        event.stopPropagation();
        const panel = document.getElementById("userMenuPanel");
        const open = !panel.classList.contains("hidden");
        this.closePopovers();
        panel.classList.toggle("hidden", open);
        document.getElementById("userMenuBtn").setAttribute("aria-expanded", String(!open));
      });

      document.getElementById("menuProfileBtn").addEventListener("click", () => {
        this.closePopovers();
        this.openProfile();
      });
      document.getElementById("globalSearchBtn").addEventListener("click", () => this.openSearch());

      const logoutHandler = () => this.confirmLogout();
      document.getElementById("logoutBtn").addEventListener("click", logoutHandler);
      document.getElementById("sidebarLogoutBtn").addEventListener("click", logoutHandler);

      document.getElementById("notifList").addEventListener("click", (event) => {
        const button = event.target.closest("[data-notif-order]");
        if (!button) return;
        this.closePopovers();
        const id = button.dataset.notifOrder;
        this.closeSidebar();
        this.runAction("order.view", { id }, button).catch((err) => this.handleError(err));
      });

      document.getElementById("sideNav").addEventListener("click", (event) => {
        if (event.target.closest(".nav-link")) this.closeSidebar();
      });
    },

    bindGlobal() {
      document.addEventListener("click", async (event) => {
        if (!event.target.closest(".popover-wrap")) {
          const notif = document.getElementById("notifPanel");
          if (notif && !notif.classList.contains("hidden")) notif.classList.add("hidden");
        }
        if (!event.target.closest(".user-menu-wrap")) {
          const menu = document.getElementById("userMenuPanel");
          if (menu && !menu.classList.contains("hidden")) {
            menu.classList.add("hidden");
            document.getElementById("userMenuBtn").setAttribute("aria-expanded", "false");
          }
        }
        const actionEl = event.target.closest("[data-act]");
        if (!actionEl || !this.state.user) return;
        const action = this.actions[actionEl.dataset.act];
        if (!action) return;
        event.preventDefault();
        if (actionEl.disabled) return;
        try {
          await action(actionEl.dataset, actionEl, event);
        } catch (err) {
          this.handleError(err);
        }
      });

      document.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && this.state.user) {
          event.preventDefault();
          this.openSearch();
        }
        if (event.key === "Escape") {
          this.closeSidebar();
          this.closePopovers();
        }
      });

      window.addEventListener("resize", () => {
        if (window.innerWidth > 960) this.closeSidebar();
      });
    },

    openSidebar() {
      document.getElementById("sidebar").classList.add("open");
      document.getElementById("sidebarOverlay").classList.add("open");
    },

    closeSidebar() {
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("sidebarOverlay").classList.remove("open");
    },

    closePopovers() {
      document.getElementById("notifPanel").classList.add("hidden");
      document.getElementById("userMenuPanel").classList.add("hidden");
      document.getElementById("userMenuBtn").setAttribute("aria-expanded", "false");
    },

    async confirmLogout() {
      this.closePopovers();
      const ok = await UI.confirm({
        title: "Keluar dari aplikasi?",
        heading: "Akhiri sesi Anda?",
        message: "Semua perubahan yang sudah disimpan tetap aman. Anda perlu memasukkan password lagi untuk masuk.",
        confirmText: "Keluar",
        danger: false,
        iconName: "logout",
      });
      if (ok) this.logout();
    },

    logout() {
      if (this.db.mode === "remote" && typeof this.db.logout === "function") this.db.logout();
      SPData.clearSession();
      this.state.user = null;
      this.state.data = SPData.blankData();
      this.state.page = "dashboard";
      this._remember = true;
      UI.closeOverlay(true);
      this.closeSidebar();
      this.closePopovers();
      history.replaceState(null, "", location.pathname + location.search);
      document.getElementById("appShell").classList.add("hidden");
      document.getElementById("loginScreen").classList.remove("hidden");
      document.getElementById("loginUsername").value = "";
      document.getElementById("loginPassword").value = "";
      this.updateConnectionUI();
      UI.info("Anda telah keluar", "Sesi berakhir dengan aman.");
    },

    handleError(err) {
      console.error(err);
      if (err && err.code === "AUTH") {
        this.forceLogout("Sesi login berakhir. Silakan masuk kembali.");
        return;
      }
      UI.error("Terjadi kesalahan", (err && err.message) || "Silakan coba lagi.");
    },

    forceLogout(message) {
      if (this.db.mode === "remote" && typeof this.db.logout === "function") this.db.logout();
      SPData.clearSession();
      this.state.user = null;
      this.state.data = SPData.blankData();
      UI.closeOverlay(true);
      this.closeSidebar();
      document.getElementById("appShell").classList.add("hidden");
      document.getElementById("loginScreen").classList.remove("hidden");
      this.showLogin(message);
    },

    async runAction(name, dataset, el) {
      const action = this.actions[name];
      if (!action) throw new Error(`Aksi ${name} belum tersedia.`);
      return action(dataset || {}, el || document.body);
    },

    openProfile() {
      const user = this.state.user;
      if (!user) return;
      const meta = U.roleMeta(user.role);
      UI.openModal({
        title: "Profil saya",
        subtitle: "Informasi akun yang sedang aktif.",
        iconName: "user",
        size: "sm",
        body: `<div class="profile-hero">
          <span class="avatar avatar-lg" style="width:48px;height:48px;border-radius:14px;font-size:14px">${U.esc(U.initials(user.name))}</span>
          <div><strong>${U.esc(user.name)}</strong><span>${U.esc(meta.label)} · ${U.esc(meta.desc)}</span></div>
          <span class="badge badge-primary" style="margin-left:auto">${U.esc(user.username || "")}</span>
        </div>
        <div class="profile-grid">
          <div class="field"><span>Username</span><strong>@${U.esc(user.username || "—")}</strong></div>
          <div class="field"><span>Role akses</span><strong>${U.esc(meta.label)}</strong></div>
          <div class="field"><span>Nomor telepon</span><strong>${U.esc(user.phone || "Belum diisi")}</strong></div>
          <div class="field"><span>Email</span><strong>${U.esc(user.email || "Belum diisi")}</strong></div>
          <div class="field"><span>Skema gaji</span><strong>${Number(user.salary) > 0 ? U.money(user.salary) + " / bulan" : "Tidak diatur"}</strong></div>
          <div class="field"><span>Status akun</span><strong style="color:var(--success)">Aktif</strong></div>
        </div>
        <div class="helper-text mt-3">Perubahan data akun dilakukan oleh Owner melalui menu Pengaturan → Akun.</div>`,
        footer: `<button type="button" class="button button-secondary" data-close>Tutup</button>
          ${user.role === "owner" ? `<button type="button" class="button button-primary" id="goAccountSettings">${UI.icon("settings", 16)} Kelola akun</button>` : ""}`,
        onMount: (overlay) => {
          const btn = overlay.querySelector("#goAccountSettings");
          if (btn) btn.addEventListener("click", () => {
            UI.closeOverlay();
            this.state.filters.settings.tab = "akun";
            this.go("settings");
          });
        },
      });
    },

    openSearch() {
      if (!this.state.user) return;
      UI.openModal({
        title: "Pencarian cepat",
        subtitle: "Cari tiket servis, pelanggan, perangkat, atau supplier.",
        iconName: "search",
        size: "lg",
        body: `<div class="toolbar-search" style="max-width:none;margin-bottom:15px">
          <span style="position:relative;display:block">
            ${UI.icon("search", 15)}
            <input class="input" id="globalSearchInput" type="search" placeholder="Ketik nomor tiket, nama pelanggan, atau perangkat…" autocomplete="off">
          </span>
        </div>
        <div id="globalSearchResults" class="search-results"></div>`,
        footer: `<span class="helper-text" style="margin-right:auto">Tekan <kbd style="font-family:var(--font-sans);border:1px solid var(--border);background:var(--surface-2);border-radius:4px;padding:1px 4px">Esc</kbd> untuk menutup</span>
          <button type="button" class="button button-secondary" data-close>Tutup</button>`,
        onMount: (overlay) => {
          const input = overlay.querySelector("#globalSearchInput");
          const results = overlay.querySelector("#globalSearchResults");
          let currentItems = [];
          const paint = U.debounce(() => {
            const q = U.normalize(input.value);
            const data = this.state.data;
            currentItems = [];
            let html = "";
            if (!q) {
              const recent = [...(data.orders || [])].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 5);
              html = `<div class="search-group-title">Servis terbaru</div>` + recent.map((o) => this.searchOrderHTML(o)).join("");
              currentItems = recent.map((o) => ({ type: "order", id: o.id }));
            } else {
              const orders = (data.orders || []).filter((o) =>
                [o.ticketNo, o.customerName, o.customerPhone, o.brand, o.model, o.serial, o.complaint].some((v) => U.normalize(v).includes(q))
              ).slice(0, 6);
              const customers = (data.customers || []).filter((c) =>
                [c.name, c.phone, c.email, c.address].some((v) => U.normalize(v).includes(q))
              ).slice(0, 4);
              const suppliers = this.state.user.role === "owner"
                ? (data.suppliers || []).filter((s) => [s.name, s.contact, s.phone].some((v) => U.normalize(v).includes(q))).slice(0, 3)
                : [];
              if (orders.length) {
                html += `<div class="search-group-title">Tiket servis</div>` + orders.map((o) => this.searchOrderHTML(o)).join("");
              }
              if (customers.length) {
                html += `<div class="search-group-title">Pelanggan</div>` + customers.map((c) => `<button type="button" class="search-result" data-search-customer="${U.esc(c.id)}">
                  <span class="avatar avatar-sm">${U.esc(U.initials(c.name))}</span>
                  <span class="search-result-copy"><strong>${U.esc(c.name)}</strong><span>${U.esc(c.phone || "Nomor belum diisi")} · ${U.esc(c.email || "Email belum diisi")}</span></span>
                  ${UI.icon("chevron-right", 14)}
                </button>`).join("");
              }
              if (suppliers.length) {
                html += `<div class="search-group-title">Supplier</div>` + suppliers.map((s) => `<button type="button" class="search-result" data-search-supplier="${U.esc(s.id)}">
                  <span class="avatar avatar-sm">${U.esc(U.initials(s.name))}</span>
                  <span class="search-result-copy"><strong>${U.esc(s.name)}</strong><span>${U.esc(s.contact || "—")} · ${U.esc(s.phone || "—")}</span></span>
                  ${UI.icon("chevron-right", 14)}
                </button>`).join("");
              }
              if (!orders.length && !customers.length && !suppliers.length) {
                html = `<div class="table-empty" style="padding:34px 12px">
                  <div class="empty-icon">${UI.icon("search", 21)}</div>
                  <strong>Tidak ada hasil untuk “${U.esc(input.value.trim())}”</strong>
                  <span>Coba kata kunci lain atau periksa ejaan.</span>
                </div>`;
              }
              currentItems = [
                ...orders.map((o) => ({ type: "order", id: o.id, data: o })),
                ...customers.map((c) => ({ type: "customer", id: c.id, data: c })),
                ...suppliers.map((s) => ({ type: "supplier", id: s.id, data: s })),
              ];
            }
            results.innerHTML = html;
          }, 120);
          input.addEventListener("input", paint);
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && currentItems.length) {
              event.preventDefault();
              this.openSearchResult(currentItems[0]);
            }
          });
          results.addEventListener("click", (event) => {
            const orderBtn = event.target.closest("[data-search-order]");
            const customerBtn = event.target.closest("[data-search-customer]");
            const supplierBtn = event.target.closest("[data-search-supplier]");
            if (orderBtn) this.openSearchResult({ type: "order", id: orderBtn.dataset.searchOrder });
            if (customerBtn) this.openSearchResult({ type: "customer", id: customerBtn.dataset.searchCustomer });
            if (supplierBtn) this.openSearchResult({ type: "supplier", id: supplierBtn.dataset.searchSupplier });
          });
          paint();
          setTimeout(() => input.focus(), 50);
        },
      });
    },

    searchOrderHTML(order) {
      return `<button type="button" class="search-result" data-search-order="${U.esc(order.id)}">
        ${UI.deviceIcon(order.deviceType)}
        <span class="search-result-copy"><strong>${U.esc(order.ticketNo)} · ${U.esc(order.customerName)}</strong><span>${U.esc([order.brand, order.model].filter(Boolean).join(" "))} · ${U.esc(U.statusMeta(order.status).label)}</span></span>
        ${UI.icon("chevron-right", 14)}
      </button>`;
    },

    openSearchResult(item) {
      if (!item) return;
      UI.closeOverlay();
      setTimeout(() => {
        if (item.type === "order") this.runAction("order.view", { id: item.id }).catch((err) => this.handleError(err));
        else if (item.type === "customer") this.runAction("customer.view", { id: item.id }).catch((err) => this.handleError(err));
        else if (item.type === "supplier") this.runAction("supplier.view", { id: item.id }).catch((err) => this.handleError(err));
      }, 50);
    },

    cycleTheme() {
      const current = this.effectiveTheme();
      const next = current === "dark" ? "light" : "dark";
      this.setAppearance({ mode: next });
    },

    setAppearance(patch) {
      this.state.appearance = {
        mode: "light",
        primary: this.state.appearance.primary || this.settings.primaryColor || "#0d9488",
        ...this.state.appearance,
        ...(patch || {}),
      };
      SPData.saveAppearance(this.state.appearance);
      this.applyAppearance();
      this.updateThemeButton();
      if (this.state.user) this.renderShell();
      if (this.state.page === "settings" && this.state.filters.settings.tab === "tampilan" && this.state.user) {
        this.renderPage({ keepScroll: true });
      }
    },

    effectiveTheme() {
      const mode = (this.state.appearance && this.state.appearance.mode) || "light";
      if (mode === "system") return this.statusMedia && this.statusMedia.matches ? "dark" : "light";
      return mode === "dark" ? "dark" : "light";
    },

    applyAppearance() {
      const effective = this.effectiveTheme();
      document.documentElement.dataset.theme = effective;
      const primary = (this.state.appearance && this.state.appearance.primary) || "#0d9488";
      document.documentElement.style.setProperty("--primary", primary);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", effective === "dark" ? "#070d18" : "#f3f6f9");
    },

    updateThemeButton() {
      const button = document.getElementById("themeToggle");
      if (!button) return;
      button.setAttribute("aria-label", this.effectiveTheme() === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap");
    },
  };

  window.App = App;
  document.addEventListener("DOMContentLoaded", () => App.init());
})();
