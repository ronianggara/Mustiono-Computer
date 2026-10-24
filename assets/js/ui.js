/* =========================================================
   ServisPro — komponen UI bersama
   ========================================================= */
(function () {
  "use strict";

  const overlayRoot = () => document.getElementById("overlayRoot");
  let overlayState = null;

  function esc(value) {
    return U.esc(value);
  }

  function icon(name, size, className) {
    return window.icon(name, size, className);
  }

  function avatar(name, className) {
    return `<span class="avatar ${className || ""}">${esc(U.initials(name))}</span>`;
  }

  function roleBadge(role) {
    return `<span class="badge badge-neutral"><span class="role-dot ${esc(role)}"></span>${esc(U.roleLabel(role))}</span>`;
  }

  function statusPill(status) {
    const meta = U.statusMeta(status);
    return `<span class="status-pill status-${meta.color}">${esc(meta.label)}</span>`;
  }

  function paymentPill(status) {
    return status === "lunas"
      ? '<span class="status-pill status-green">Lunas</span>'
      : '<span class="status-pill status-amber">Belum bayar</span>';
  }

  function payMethod(method) {
    if (!method) return "—";
    return U.paymentLabel(method);
  }

  function deviceIcon(type) {
    const meta = U.deviceMeta(type);
    return `<span class="device-icon ${esc(type)}">${icon(meta.icon, 15)}</span>`;
  }

  function deviceName(order) {
    return [order.brand, order.model].filter(Boolean).join(" ") || U.deviceMeta(order.deviceType).label;
  }

  function emptyState(iconName, title, text, action) {
    return `<div class="table-empty">
      <div class="empty-icon">${icon(iconName || "inbox", 21)}</div>
      <strong>${esc(title)}</strong>
      <span>${esc(text || "")}</span>
      ${action || ""}
    </div>`;
  }

  function pageHead({ kicker, title, subtitle, actions, meta }) {
    return `<div class="page-head">
      <div class="page-title-block">
        ${kicker ? `<span class="page-kicker">${esc(kicker)}</span>` : ""}
        <h1 class="page-title">${esc(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ""}
        ${meta ? `<div class="page-meta">${meta}</div>` : ""}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </div>`;
  }

  function modalHeader({ title, subtitle, iconName, iconBg }) {
    return `<div class="modal-head">
      <span class="modal-head-icon"${iconBg ? ` style="background:${iconBg};color:${iconBg}"` : ""}>${icon(iconName || "sparkles", 17)}</span>
      <div class="modal-head-copy"><h3>${esc(title)}</h3>${subtitle ? `<p>${subtitle}</p>` : ""}</div>
      <button type="button" class="modal-close" data-close aria-label="Tutup">${icon("x", 18)}</button>
    </div>`;
  }

  function lockScroll() {
    document.body.style.overflow = "hidden";
  }

  function unlockScroll() {
    document.body.style.overflow = "";
  }

  function closeOverlay(silent) {
    const root = overlayRoot();
    if (!root || !root.firstElementChild) return;
    root.innerHTML = "";
    unlockScroll();
    const state = overlayState;
    overlayState = null;
    if (state && typeof state.onClose === "function" && !silent) {
      try { state.onClose(); } catch (err) { console.warn(err); }
    }
  }

  function bindOverlay(overlay, options, onClose) {
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay && options.closeOnBackdrop !== false) {
        closeOverlay();
      }
    });
    overlay.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeOverlay());
    });
    overlayState = { onClose };
  }

  function openModal(options) {
    const root = overlayRoot();
    root.innerHTML = "";
    const wasOpen = !!document.body.style.overflow;
    const sizeClass = options.size ? ` modal-${options.size}` : "";
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="modal${sizeClass}" role="dialog" aria-modal="true" aria-label="${esc(U.stripHtml(options.title || "Dialog"))}">
      ${modalHeader(options)}
      <div class="modal-body${options.flush ? " flush" : ""}">${options.body || ""}</div>
      ${options.footer ? `<div class="modal-foot">${options.footer}</div>` : ""}
    </div>`;
    root.appendChild(overlay);
    bindOverlay(overlay, options, options.onClose);
    if (!wasOpen) lockScroll();
    setTimeout(() => {
      const first = overlay.querySelector(".modal-body input:not([type=hidden]):not([disabled]), .modal-body select:not([disabled]), .modal-body textarea:not([disabled])");
      const cancel = overlay.querySelector(".modal-foot .button-secondary");
      if (first) first.focus();
      else if (cancel) cancel.focus();
    }, 60);
    if (typeof options.onMount === "function") options.onMount(overlay);
    return overlay;
  }

  function openDrawer(options) {
    const root = overlayRoot();
    root.innerHTML = "";
    const wasOpen = !!document.body.style.overflow;
    const overlay = document.createElement("div");
    overlay.className = "overlay drawer-overlay";
    overlay.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(U.stripHtml(options.title || "Detail"))}">
      <div class="drawer-head">
        <div class="drawer-head-top">
          <div style="min-width:0">
            ${options.ticket ? `<span class="ticket-number">${options.ticket}</span>` : ""}
            <h3>${esc(options.title || "Detail")}</h3>
            ${options.subtitle ? `<p>${options.subtitle}</p>` : ""}
          </div>
          <button type="button" class="modal-close" data-close aria-label="Tutup">${icon("x", 18)}</button>
        </div>
      </div>
      <div class="drawer-body">${options.body || ""}</div>
      ${options.footer ? `<div class="drawer-foot">${options.footer}</div>` : ""}
    </aside>`;
    root.appendChild(overlay);
    bindOverlay(overlay, options, options.onClose);
    if (!wasOpen) lockScroll();
    if (typeof options.onMount === "function") options.onMount(overlay);
    return overlay;
  }

  function confirmDialog(options) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const danger = options.danger !== false;
      openModal({
        title: options.title || "Konfirmasi",
        iconName: options.iconName || (danger ? "alert-triangle" : "help-circle"),
        size: "sm",
        body: `<div class="confirm-body">
          <div class="confirm-icon" ${danger ? "" : 'style="background:var(--primary-soft);color:var(--primary)"'}>${icon(options.iconName || (danger ? "trash" : "help-circle"), 24)}</div>
          <h3>${esc(options.heading || options.title || "Konfirmasi tindakan")}</h3>
          <p>${options.message || "Apakah Anda yakin ingin melanjutkan?"}</p>
          ${options.detail ? `<div class="confirm-detail">${options.detail}</div>` : ""}
        </div>`,
        footer: `<button type="button" class="button button-secondary" data-cancel>Batal</button>
          <button type="button" class="button ${danger ? "button-danger" : "button-primary"}" data-confirm>${esc(options.confirmText || "Ya, lanjutkan")}</button>`,
        onMount: (overlay) => {
          overlay.querySelector("[data-cancel]").addEventListener("click", () => {
            finish(false);
            closeOverlay();
          });
          overlay.querySelector("[data-confirm]").addEventListener("click", () => {
            finish(true);
            closeOverlay();
          });
        },
        onClose: () => finish(false),
      });
    });
  }

  function toast(type, title, message) {
    const root = document.getElementById("toastRoot");
    if (!root) return;
    const iconName = type === "success" ? "check-circle" : type === "error" ? "x-circle" : type === "warning" ? "alert-triangle" : "info";
    const el = document.createElement("div");
    el.className = `toast ${type || "info"}`;
    el.innerHTML = `<span class="toast-icon">${icon(iconName, 17)}</span>
      <div class="toast-copy"><strong>${esc(title)}</strong>${message ? `<span>${esc(message)}</span>` : ""}</div>
      <button type="button" class="toast-close" aria-label="Tutup">${icon("x", 13)}</button>`;
    root.appendChild(el);
    const timer = setTimeout(remove, type === "error" ? 6500 : 4200);
    function remove() {
      clearTimeout(timer);
      if (!el.parentNode) return;
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 220);
    }
    el.querySelector(".toast-close").addEventListener("click", remove);
  }

  const success = (title, message) => toast("success", title, message);
  const error = (title, message) => toast("error", title, message);
  const info = (title, message) => toast("info", title, message);
  const warning = (title, message) => toast("warning", title, message);

  function setLoading(button, loading, label) {
    if (!button) return;
    if (loading) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span style="display:inline-flex;align-items:center;gap:7px"><span style="width:13px;height:13px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block"></span>${esc(label || "Memproses…")}</span>`;
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  function receiptHTML(order, settings) {
    const company = settings || {};
    const isPaid = order.paymentStatus === "lunas";
    const total = Number(order.total) || 0;
    const parts = Number(order.partsCost) || 0;
    const service = Number(order.serviceCost) || 0;
    const paper = company.receiptPaper === "58mm" ? "58" : "80";
    const showLogo = company.receiptShowLogo !== false && company.logo;
    const technicianLine = company.receiptShowTechnician !== false && order.technicianName
      ? `<div class="receipt-meta-row"><span>Teknisi</span><span>${esc(order.technicianName)}</span></div>` : "";
    const printTime = U.formatDateTime(new Date().toISOString());
    return `<div class="receipt-paper-${paper}">
      <div class="receipt-sheet">
        <div class="receipt-header">
          ${showLogo ? `<div class="receipt-logo"><img src="${esc(company.logo)}" alt=""></div>` : ""}
          <div class="receipt-company">${esc(company.companyName || "ServisPro")}</div>
          <div class="receipt-tagline">${esc(company.tagline || "")}</div>
          <div class="receipt-addr">${esc(company.address || "")}<br>${esc(company.phone || "")}${company.website ? " · " + esc(company.website) : ""}</div>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-meta">
          <div class="receipt-meta-row"><span>No. Tiket</span><span>${esc(order.ticketNo || "—")}</span></div>
          <div class="receipt-meta-row"><span>Tanggal</span><span>${esc(U.formatDateTime(order.paidAt || order.createdAt))}</span></div>
          <div class="receipt-meta-row"><span>Pelanggan</span><span>${esc(order.customerName || "—")}</span></div>
          <div class="receipt-meta-row"><span>Perangkat</span><span>${esc([order.brand, order.model].filter(Boolean).join(" ") || U.deviceMeta(order.deviceType).label)}</span></div>
          <div class="receipt-meta-row"><span>Keluhan</span><span>${esc(order.complaint || "—")}</span></div>
          ${technicianLine}
          <div class="receipt-meta-row"><span>Status</span><span>${esc(U.statusMeta(order.status).label)}</span></div>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-items">
          <div class="receipt-item"><span>Jasa servis</span><span>${esc(U.money(service))}</span></div>
          <div class="receipt-item"><span>Sparepart</span><span>${esc(U.money(parts))}</span></div>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-total-row"><span>TOTAL</span><span>${esc(U.money(total))}</span></div>
        <div class="receipt-payment ${isPaid ? "lunas" : "unpaid"}">${isPaid ? "LUNAS · " + U.paymentLabel(order.paymentMethod).toUpperCase() : "BELUM BAYAR"}</div>
        <div class="receipt-barcode">${Array.from({ length: 34 }).map(() => "<i></i>").join("")}</div>
        <div class="receipt-ticket-code">${esc(order.ticketNo || "")}</div>
        <div class="receipt-divider"></div>
        <div class="receipt-footer">
          <strong>${esc(company.receiptHeader || "Terima kasih atas kepercayaan Anda.")}</strong>
          ${esc(company.receiptFooter || "")}
          <br>Dicetak ${esc(printTime)}
        </div>
      </div>
    </div>`;
  }

  function preparePrint(order, settings) {
    const root = document.getElementById("receiptRoot");
    const paper = settings.receiptPaper === "58mm" ? "58" : "80";
    root.className = `receipt-root receipt-paper-${paper}`;
    root.innerHTML = receiptHTML(order, settings);
    root.setAttribute("aria-hidden", "false");
    setTimeout(() => {
      window.print();
      root.setAttribute("aria-hidden", "true");
    }, 80);
  }

  function showReceiptModal(order, settings) {
    const html = receiptHTML(order, settings);
    openModal({
      title: "Preview nota",
      subtitle: "Periksa tampilan sebelum mencetak.",
      iconName: "receipt",
      size: "sm",
      body: `<div class="receipt-preview-wrap">${html}</div>`,
      footer: `<label class="check-row" style="margin-right:auto"><input type="checkbox" id="receiptAutoPrint" ${settings.autoPrint ? "checked" : ""}> Simpan sebagai default cetak otomatis</label>
        <button type="button" class="button button-secondary" data-close>Tutup</button>
        <button type="button" class="button button-primary" id="doPrintReceipt">${icon("printer", 16)} Cetak Nota</button>`,
      onMount: (overlay) => {
        overlay.querySelector("#doPrintReceipt").addEventListener("click", () => {
          closeOverlay();
          preparePrint(order, settings);
        });
        overlay.querySelector("#receiptAutoPrint").addEventListener("change", async (event) => {
          try {
            await window.App.saveSettings({ ...settings, autoPrint: event.target.checked });
            settings.autoPrint = event.target.checked;
            App.state.data.settings.autoPrint = event.target.checked;
          } catch (err) {
            UI.error("Gagal menyimpan preferensi", err.message);
          }
        });
      },
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const root = overlayRoot();
      if (root && root.firstElementChild) closeOverlay();
    }
  });

  window.UI = {
    esc,
    icon,
    avatar,
    roleBadge,
    statusPill,
    paymentPill,
    payMethod,
    deviceIcon,
    deviceName,
    emptyState,
    pageHead,
    openModal,
    openDrawer,
    closeOverlay,
    confirm: confirmDialog,
    toast,
    success,
    error,
    info,
    warning,
    setLoading,
    receiptHTML,
    preparePrint,
    showReceiptModal,
    lockScroll,
    unlockScroll,
  };
})();
