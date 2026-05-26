/* =====================================================
   Adhikar'26 — Vanilla JS
   Registration flow + UroPay Gateway + Admin panel
   ===================================================== */

const EVENT_DATE = new Date("2026-06-13T09:00:00+05:30");

// API base — read from <meta name="adhikar-api"> in index.html.
// Falls back to /api.
const _apiMeta = document.querySelector('meta[name="adhikar-api"]');
const API_BASE =
  ((_apiMeta && _apiMeta.content) || window.location.origin).replace(/\/+$/, "") +
  "/api";

// EmailJS Initialization
const EMAILJS_PUBLIC_KEY = "7MYjmRFHID52KXBoF";
const EMAILJS_SERVICE_ID = "service_ih7ntjl";
const EMAILJS_TEMPLATE_ID = "template_9gk7idl";

if (typeof emailjs !== 'undefined') {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

const AWARDS = [
  {
    title: "General Championship Award",
    desc: "Presented to the institution that achieves the highest overall distinction through exceptional participation and outstanding award-winning performances across the conference.",
    isGrand: true
  },
  { title: "Best Student Speaker", desc: "Awarded to the delegate who demonstrates the highest level of clarity and persuasion." },
  { title: "Exceptional Debater", desc: "For the individual who masters the art of the rebuttal and logical counter-argument." },
  { title: "Asset of the Ruling Government", desc: "Recognizing the most strategic and effective defender of government policies." },
  { title: "Asset of the Opposition", desc: "Honoring the most rigorous and insightful critic of the treasury benches." },
  { title: "Best Leader of the House", desc: "For the student who displays supreme command and organizational leadership over the proceedings." },
  { title: "Best Minister", desc: "For the delegate who demonstrates the most profound knowledge of their specific portfolio." },
  { title: "Most Creative Mind", desc: "For the MP who proposes the most innovative and out-of-the-box legislative solutions." },
  { title: "Best Orator", desc: "For the speaker with the most powerful command over rhetoric and public address." },
  { title: "Distinguished Policy Advocate", desc: "Awarded for the most thoroughly researched and detailed legislative contributions." },
  { title: "Most Impactful Presence", desc: "For the individual who commands the room through sheer conviction and parliamentary aura." },
];

const TEAM = [
  "Kshiti Thakkar", "Saad Neelgund", "Khushi Dalbanjan", "Manish Tilvalli",
  "Maitri Sabharwal", "Kiran Badami", "Reeth Markumbi", "Nishtha I",
  "Shreya Naikar", "Sambhav Bafna", "Shashank Habib", "Kavan Bhatt",
];

const MIDMAC_LOGO = "assets/midmac.png";

const trophySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`;

/* ============ Utilities ============ */
function initials(name) {
  return name.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function pad(n) { return String(n).padStart(2, "0"); }
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function formatStatus(s) {
  return s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
}
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}

/* ============ Render static content ============ */
function renderAwards() {
  const grid = document.getElementById("awards-grid");
  if (!grid) return;
  grid.innerHTML = AWARDS.map((a, i) => `
    <article class="award-card reveal ${a.isGrand ? 'card-grand' : ''}" data-testid="award-card-${i}">
      <div class="award-head">
        <div class="award-icon">${trophySVG}</div>
        <span class="award-num">${String(i + 1).padStart(2, "0")}</span>
      </div>
      <h3 class="award-title">${a.title}</h3>
      <p class="award-desc">${a.desc}</p>
    </article>
  `).join("");
}
function renderTeam() {
  const grid = document.getElementById("team-grid");
  if (!grid) return;
  grid.innerHTML = TEAM.map((name, i) => `
    <article class="team-card reveal" data-testid="team-card-${i}">
      <div class="avatar"><span class="avatar-text">${initials(name)}</span></div>
      <div>
        <p class="team-name">${name}</p>
        <p class="team-role">Member</p>
      </div>
    </article>
  `).join("");
}
function renderMarquee() {
  const track = document.getElementById("marquee-track");
  if (!track) return;
  const chunk = `
    <div class="marquee-chunk">
      <div class="marquee-mark"><img src="${MIDMAC_LOGO}" alt="MIDMAC"/></div>
      <span class="marquee-text">MIDMAC Group Presents</span>
      <span class="marquee-diamond">◆</span>
      <span class="marquee-text">ADHIKAR'26</span>
      <span class="marquee-diamond">◆</span>
    </div>
  `;
  track.innerHTML = chunk.repeat(8);
}

/* ============ Countdown ============ */
function tickCountdown() {
  const diff = Math.max(0, EVENT_DATE.getTime() - Date.now());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = pad(val);
  };
  set("cd-days", d);
  set("cd-hours", h);
  set("cd-minutes", m);
  set("cd-seconds", s);
}

/* ============ Navbar ============ */
function initNavbar() {
  const nav = document.getElementById("navbar");
  if (!nav) return;
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}
function initMobileMenu() {
  const toggle = document.getElementById("nav-toggle");
  const menu = document.getElementById("mobile-menu");
  const iconMenu = document.getElementById("icon-menu");
  const iconClose = document.getElementById("icon-close");
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    menu.classList.toggle("hidden", !open);
    iconMenu.classList.toggle("hidden", open);
    iconClose.classList.toggle("hidden", !open);
  };
  toggle.addEventListener("click", () => setOpen(menu.classList.contains("hidden")));
  document.querySelectorAll("[data-scroll-top]").forEach(el =>
    el.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }))
  );
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setOpen(false)));
}
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id && id.length > 1 && id.startsWith("#")) {
        const target = document.querySelector(id);
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth" }); }
      }
    });
  });
}

/* ============ Reveal ============ */
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = Array.from(entry.target.parentElement?.children || []).indexOf(entry.target);
        entry.target.style.animationDelay = `${Math.max(0, idx * 60)}ms`;
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
}

/* ============ Accordion ============ */
function initAccordion() {
  document.querySelectorAll(".acc-trigger").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".acc-item");
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".acc-item.open").forEach(i => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });
}

/* ============ Toasts ============ */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => {
    t.style.animation = "toastOut 0.3s forwards";
    setTimeout(() => t.remove(), 320);
  }, 2000);
}

/* ============ Registration flow ============ */
const FIELD_LABELS = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  parent_name: "Parent Name",
  parent_phone: "Parent Phone",
  year: "Year",
  college: "College",
  role_preference: "Preferred Role",
};

let currentRegistration = null;

function setStep(n) {
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`step-${i}`)?.classList.toggle("hidden", i !== n);
  }
  document.querySelectorAll(".step").forEach(el => {
    const sn = Number(el.dataset.step);
    el.classList.toggle("active", sn === n);
    el.classList.toggle("done", sn < n);
  });
}

function openRegisterOverlay() {
  const overlay = document.getElementById("register-overlay");
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setStep(1);
  document.getElementById("form-err").classList.remove("visible");
}

function closeRegisterOverlay() {
  const overlay = document.getElementById("register-overlay");
  overlay.classList.add("hidden");
  document.body.style.overflow = "";
  // reset for next time
  document.getElementById("reg-form")?.reset();
  document.getElementById("utr-form")?.reset();
  currentRegistration = null;
  setStep(1);
}

async function submitRegistration(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("form-submit-btn");
  const err = document.getElementById("form-err");
  err.classList.remove("visible");

  const data = Object.fromEntries(new FormData(form).entries());

  // basic validation
  for (const k of ["name", "email", "phone", "parent_name", "parent_phone", "year", "college"]) {
    if (!data[k] || !String(data[k]).trim()) {
      err.textContent = `Please fill in ${FIELD_LABELS[k] || k}.`;
      err.classList.add("visible");
      return;
    }
  }

  btn.disabled = true;
  btn.style.opacity = "0.7";
  const original = btn.innerHTML;
  btn.innerHTML = "Submitting…";

  try {
    const res = await fetch(`${API_BASE}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || "Registration failed");
    }
    const reg = await res.json();
    currentRegistration = reg;

    // populate summary
    document.getElementById("summary-rows").innerHTML = [
      ["Name", reg.name],
      ["Email", reg.email],
      ["Phone", reg.phone],
      ["Parent", reg.parent_name],
      ["Institution", reg.college],
      ["Year", reg.year],
      ["Role", reg.role_preference],
    ].map(([k, v]) => `
      <div class="summary-row">
        <span class="summary-row-k">${k}</span>
        <span class="summary-row-v">${escapeHtml(v)}</span>
      </div>
    `).join("");

    // Setup deep links and dynamic QR
    const upiLink = reg.upiString;
    document.getElementById("phonepe-link").href = upiLink;

    const upiQuery = upiLink.replace("upi://pay?", "");
    const setHref = (id, href) => {
      const el = document.getElementById(id);
      if (el) el.href = href;
    };
    setHref("pay-phonepe", `phonepe://pay?${upiQuery}`);
    setHref("pay-gpay", `tez://upi/pay?${upiQuery}`);
    setHref("pay-bhim", `bhim://pay?${upiQuery}`);
    setHref("pay-apple", upiLink);

    // Swap QR image source
    if (reg.useFallback) {
      document.getElementById("qr-image").src = reg.qrCodeUrl;
    } else {
      document.getElementById("qr-image").src = reg.qrCodeBase64;
    }

    setStep(2);
    document.querySelector(".overlay").scrollTo({ top: 0, behavior: "smooth" });
  } catch (ex) {
    err.textContent = ex.message || "Could not submit. Please try again.";
    err.classList.add("visible");
  } finally {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.innerHTML = original;
  }
}

// Handle 12-Digit UTR submission
async function submitUtr(e) {
  e.preventDefault();
  if (!currentRegistration) return;
  const btn = document.getElementById("pay-claimed-btn");
  const err = document.getElementById("utr-err");
  const input = document.getElementById("utr-input");
  const utr = input.value.trim();

  err.style.display = "none";

  if (!utr || !/^\d{12}$/.test(utr)) {
    err.textContent = "Please enter a valid 12-digit UPI Reference Number / UTR.";
    err.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.style.opacity = "0.7";
  const original = btn.textContent;
  btn.textContent = "Verifying UTR…";

  try {
    const res = await fetch(`${API_BASE}/registrations/${currentRegistration.id}/submit-utr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utr })
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.detail || "UTR verification failed");
    }

    // Transition to Step 3: Confirmation
    document.getElementById("confirm-id-value").textContent = currentRegistration.id;
    setStep(3);
    document.querySelector(".overlay").scrollTo({ top: 0, behavior: "smooth" });
  } catch (ex) {
    err.textContent = ex.message || "Failed to submit UTR. Please try again.";
    err.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.textContent = original;
  }
}

function initRegistration() {
  document.querySelectorAll("[data-open-register]").forEach(b =>
    b.addEventListener("click", openRegisterOverlay)
  );
  document.getElementById("overlay-close")?.addEventListener("click", closeRegisterOverlay);
  document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("register-overlay");
    if (overlay && e.key === "Escape" && !overlay.classList.contains("hidden")) closeRegisterOverlay();
  });

  document.getElementById("reg-form")?.addEventListener("submit", submitRegistration);
  document.getElementById("utr-form")?.addEventListener("submit", submitUtr);
  document.getElementById("back-to-form")?.addEventListener("click", () => setStep(1));
  document.getElementById("confirm-close")?.addEventListener("click", closeRegisterOverlay);

  // UPI copy buttons
  document.querySelectorAll(".upi-copy").forEach(btn => {
    btn.addEventListener("click", async () => {
      const txt = btn.querySelector("span").textContent.trim();
      try {
        await navigator.clipboard.writeText(txt);
        btn.classList.add("copied");
        showToast("Copied");
        setTimeout(() => btn.classList.remove("copied"), 1500);
      } catch {
        showToast("Couldn't copy", "error");
      }
    });
  });
}

/* ============ Admin panel ============ */
let adminPassword = "";
let currentFilter = "all";
let lastRegistrations = [];
let adminSearchText = "";
let adminCollegeFilter = "all";

function adminHeaders() {
  return { "X-Admin-Password": adminPassword };
}

async function adminLogin(e) {
  e.preventDefault();
  const pw = document.getElementById("admin-password").value.trim();
  const err = document.getElementById("admin-err");
  err.classList.remove("visible");
  if (!pw) {
    err.textContent = "Enter the password";
    err.classList.add("visible");
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) throw new Error("Invalid password");
    adminPassword = pw;
    sessionStorage.setItem("adhikar_admin", pw);
    document.getElementById("admin-login").classList.add("hidden");
    document.getElementById("admin-panel").classList.remove("hidden");
    await loadRegistrations();
  } catch (ex) {
    err.textContent = ex.message || "Login failed";
    err.classList.add("visible");
  }
}

function adminLogout() {
  adminPassword = "";
  sessionStorage.removeItem("adhikar_admin");
  document.getElementById("admin-panel").classList.add("hidden");
  document.getElementById("admin-login").classList.remove("hidden");
  document.getElementById("admin-password").value = "";
  lastRegistrations = [];
}

function csvCell(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportCsv() {
  if (!lastRegistrations.length) {
    showToast("Nothing to export yet", "error");
    return;
  }
  const headers = ["ID", "Name", "Email", "Phone", "Parent Name", "Parent Phone", "Year", "College", "Role Preference", "Notes", "Status", "UTR", "Created At", "Updated At"];
  const rows = lastRegistrations.map(r => [
    r.id, r.name, r.email, r.phone, r.parent_name, r.parent_phone, r.year, r.college, r.role_preference, r.notes, r.status, r.utr, r.created_at, r.updated_at
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `adhikar26-registrations-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported ${lastRegistrations.length} registrations`);
}

async function loadRegistrations() {
  try {
    const [rRes, sRes] = await Promise.all([
      fetch(`${API_BASE}/admin/registrations`, { headers: adminHeaders() }),
      fetch(`${API_BASE}/admin/stats`, { headers: adminHeaders() }),
    ]);
    if (rRes.status === 401 || sRes.status === 401) { adminLogout(); return; }
    if (!rRes.ok) throw new Error("Failed to load");
    lastRegistrations = await rRes.json();
    const stats = await sRes.json();

    updateCollegeDropdown();
    renderStats(stats);
    renderAnalytics(lastRegistrations);
    renderRows();
  } catch (ex) {
    showToast(ex.message || "Could not load", "error");
  }
}

function renderStats(s) {
  const el = document.getElementById("admin-stats");
  if (!el) return;

  const statsList = [
    ["Total", s.total],
    ["Pending", s.pending],
    ["Payment claimed", s.payment_claimed],
    ["Verified", s.verified],
    ["Rejected", s.rejected],
  ];

  el.innerHTML = statsList.map(([k, v]) => `
    <span class="stat-pill"><strong>${v}</strong> ${k}</span>
  `).join("");
}

function renderAnalytics(list) {
  const el = document.getElementById("admin-analytics");
  if (!el) return;

  const total = list.length;
  if (total === 0) {
    el.innerHTML = "";
    return;
  }

  // Role Distribution
  const ruling = list.filter(r => (r.role_preference || "").toLowerCase().includes("ruling")).length;
  const opposition = list.filter(r => (r.role_preference || "").toLowerCase().includes("opposition")).length;

  const rulingPct = Math.round((ruling / (ruling + opposition || 1)) * 100);
  const oppositionPct = 100 - rulingPct;

  el.innerHTML = `
    <div class="analytic-bar-group">
      <div class="analytic-label">
        <span>Balance of Power (Ruling vs Opposition)</span>
        <span>${ruling} / ${opposition}</span>
      </div>
      <div class="analytic-bar-bg" title="Ruling: ${rulingPct}% | Opposition: ${oppositionPct}%">
        <div class="analytic-bar-fill" style="width: ${rulingPct}%; background: var(--gold);"></div>
      </div>
    </div>
  `;
}

function updateCollegeDropdown() {
  const select = document.getElementById("admin-filter-college");
  if (!select) return;

  const colleges = [...new Set(lastRegistrations.map(r => r.college))].sort();
  const current = select.value;

  select.innerHTML = `<option value="all">All Institutions</option>` +
    colleges.map(c => `<option value="${escapeHtml(c)}" ${c === current ? 'selected' : ''}>${escapeHtml(c)}</option>`).join("");
}

function renderRows() {
  const tbody = document.getElementById("admin-rows");
  const empty = document.getElementById("admin-empty");
  if (!tbody) return;

  let list = lastRegistrations;

  // 1. Status Filter
  if (currentFilter !== "all") {
    list = list.filter(r => r.status === currentFilter);
  }

  // 2. Search
  if (adminSearchText) {
    const q = adminSearchText.toLowerCase();
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      (r.portfolio && r.portfolio.toLowerCase().includes(q))
    );
  }

  // 3. College Filter
  if (adminCollegeFilter !== "all") {
    list = list.filter(r => r.college === adminCollegeFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }
  empty?.classList.add("hidden");
  tbody.innerHTML = list.map(r => `
    <tr data-id="${r.id}" data-testid="admin-row-${r.id}">
      <td class="td-delegate">
        <strong>${escapeHtml(r.name)}</strong>
        <p style="font-size:0.75rem; color:#bca0a0; margin:4px 0 0;">${escapeHtml(r.role_preference)} · ${escapeHtml(r.year)}</p>
      </td>
      <td class="td-portfolio">
        <input type="text" value="${escapeHtml(r.portfolio || '')}" 
          placeholder="Assign Portfolio..." 
          onchange="handlePortfolioChange('${r.id}', this.value)" />
      </td>
      <td class="td-parent">
        <strong>${escapeHtml(r.parent_name || "-")}</strong>
        <small>${r.parent_phone ? `<a href="tel:${escapeHtml(r.parent_phone)}">${escapeHtml(r.parent_phone)}</a>` : "-"}</small>
      </td>
      <td class="td-contact">
        <a href="mailto:${escapeHtml(r.email)}">${escapeHtml(r.email)}</a>
        <a href="tel:${escapeHtml(r.phone)}">${escapeHtml(r.phone)}</a>
      </td>
      <td>${escapeHtml(r.college)}</td>
      <td>
        <span class="status-badge status-${r.status}">${formatStatus(r.status)}</span>
        ${r.utr ? `<small style="display:block; font-size:0.75rem; color:#bca0a0; margin-top:2px;">UTR: ${r.utr}</small>` : ""}
      </td>
      <td>${formatDate(r.created_at)}</td>
      <td>
        <div class="td-actions">
          ${r.status !== "verified" ? `<button class="action-btn action-verify" data-action="verified">Verify</button>` : ""}
          ${r.status !== "rejected" ? `<button class="action-btn action-reject" data-action="rejected">Reject</button>` : ""}
          <button class="action-btn action-delete" data-action="delete">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function handleRowAction(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = tr?.dataset.id;
  const action = btn.dataset.action;
  if (!id) return;

  if (action === "delete") {
    if (!confirm("Delete this registration permanently?")) return;
    try {
      const res = await fetch(`${API_BASE}/admin/registrations/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (!res.ok) throw new Error("Delete failed");
      lastRegistrations = lastRegistrations.filter(r => r.id !== id);
      await loadRegistrations();
      showToast("Deleted");
    } catch (ex) { showToast(ex.message, "error"); }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/registrations/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({ status: action }),
    });
    if (!res.ok) throw new Error("Update failed");

    // Send confirmation email via EmailJS
    if (action === "verified") {
      console.log("Verification triggered for ID:", id);
      const reg = lastRegistrations.find((r) => String(r.id) === String(id));
      console.log("Registration found:", reg);

      if (reg && typeof emailjs !== "undefined") {
        showToast("Sending verification email...", "info");
        // Sending multiple common parameter names to ensure template compatibility
        const templateParams = {
          to_name: reg.name,
          user_name: reg.name,
          to_email: reg.email,
          user_email: reg.email,
          email: reg.email,
          recipient_email: reg.email,
          registration_id: reg.id,
          college: reg.college,
          role: reg.role_preference,
        };
        console.log("Sending EmailJS with params:", templateParams);
        emailjs
          .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
          .then((res) => {
            console.log("EmailJS Success:", res);
            showToast("Confirmation email sent!");
          })
          .catch((err) => {
            console.error("EmailJS Error:", err);
            showToast("Failed to send email: " + (err.text || err.message || "Unknown error"), "error");
          });
      } else {
        console.warn("EmailJS not ready or registration not found", { reg, emailjs: typeof emailjs });
        if (!reg) showToast("Error: Registration data not found locally", "error");
        if (typeof emailjs === "undefined") showToast("Error: EmailJS SDK not loaded", "error");
      }
    }

    await loadRegistrations();
    showToast(`Marked as ${formatStatus(action)}`);
  } catch (ex) {
    showToast(ex.message, "error");
  }
}

function initAdmin() {
  document.getElementById("admin-login-form")?.addEventListener("submit", adminLogin);
  document.getElementById("admin-logout")?.addEventListener("click", adminLogout);
  document.getElementById("admin-refresh")?.addEventListener("click", loadRegistrations);
  document.getElementById("admin-export")?.addEventListener("click", exportCsv);
  document.getElementById("admin-rows")?.addEventListener("click", handleRowAction);
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.filter;
      renderRows();
    });
  });

  document.getElementById("admin-search")?.addEventListener("input", (e) => {
    adminSearchText = e.target.value.trim();
    renderRows();
  });

  document.getElementById("admin-filter-college")?.addEventListener("change", (e) => {
    adminCollegeFilter = e.target.value;
    renderRows();
  });

  // restore session
  const saved = sessionStorage.getItem("adhikar_admin");
  if (saved) {
    adminPassword = saved;
    const loginEl = document.getElementById("admin-login");
    const panelEl = document.getElementById("admin-panel");
    if (loginEl) loginEl.classList.add("hidden");
    if (panelEl) panelEl.classList.remove("hidden");
    loadRegistrations();
  }
}

async function handlePortfolioChange(id, value) {
  const input = document.querySelector(`tr[data-id="${id}"] .td-portfolio input`);
  try {
    const res = await fetch(`${API_BASE}/admin/registrations/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminHeaders() },
      body: JSON.stringify({ portfolio: value }),
    });
    if (!res.ok) throw new Error("Save failed");

    // Update local data
    const reg = lastRegistrations.find(r => r.id === id);
    if (reg) reg.portfolio = value;

    input?.classList.add("saved");
    setTimeout(() => input?.classList.remove("saved"), 2000);
  } catch (err) {
    showToast("Portfolio save failed", "error");
  }
}

/* ============ Boot ============ */
document.addEventListener("DOMContentLoaded", () => {
  renderAwards();
  renderTeam();
  renderMarquee();
  tickCountdown();
  setInterval(tickCountdown, 1000);
  initNavbar();
  initMobileMenu();
  initSmoothScroll();
  initReveal();
  initAccordion();
  initRegistration();
  initAdmin();
});
