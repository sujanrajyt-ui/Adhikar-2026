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
const EMAILJS_PUBLIC_KEY = "CzcZFPPmnh0lYjeTL";
const EMAILJS_SERVICE_ID = "service_cujpkh8";
const EMAILJS_TEMPLATE_ID = "template_lvde63l";
const EMAILJS_OTP_TEMPLATE_ID = "template_tpacxoq";
const EMAILJS_ASSIGN_TEMPLATE_ID = "template_assign"; // ← Party assignment template (primary account)

// Second EmailJS account — used specifically for Committee assignment emails
const EMAILJS_COMM_PUBLIC_KEY = "zRHLlDneLr7oBZpMg";
const EMAILJS_COMM_SERVICE_ID = "service_grtfn4f";
const EMAILJS_COMM_TEMPLATE_ID = "template_jqezo8h";

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
  { name: "Kshiti Thakkar", image: "assets/team/kshiti.jpg", role: "Team Member", bio: "The Official Unpaid Therapist" },
  { name: "Saad Neelgund", image: "assets/team/saad.jpg", role: "Team Member", bio: "Loves Background Noise" },
  { name: "Khushi Dalbanjan", image: "assets/team/khushi.jpg", role: "Team Member", bio: "Khushi likes Prateek Kuhad." },
  { name: "Manish Tilvalli", image: "assets/team/manish.jpg", role: "Team Member", bio: "Outasses Everyone" },
  { name: "Maitri Sabharwal", image: "assets/team/maitri.jpg", role: "Team Member", bio: "The Official Bluepaglu💙" },
  { name: "Kiran Badami", image: "assets/team/kiran.jpg", role: "Team Member", bio: "The 'Pro' in 'Procrastinate'" },
  { name: "Reeth Markumbi", image: "assets/team/reeth.jpg", role: "Team Member", bio: "I have hardly anything in common with myself." },
  { name: "Nishtha I", image: "assets/team/nishtha.jpg", role: "Team Member", bio: "Not a bully,It's just you" },
  { name: "Shreya Naikar", image: "assets/team/shreya.jpg", role: "Team Member", bio: "Partly philosophical, mostly stupid." },
  { name: "Sambhav Bafna", image: "assets/team/sambhav.jpg", role: "Team Member", bio: "Exists." },
  { name: "Shashank Habib", image: "assets/team/shashank.jpg", role: "Team Member", bio: "On My Shawshank Redemption Arc" },
  { name: "Kavan Bhat", image: "assets/team/kavan.jpg", role: "Team Member", bio: "Doesn't even know why he is here" },
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
    <article class="award-card anim-border ${a.isGrand ? 'card-grand' : ''}" data-testid="award-card-${i}">
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
  grid.innerHTML = TEAM.map((m, i) => `
    <article class="team-portrait-card" data-testid="team-card-${i}">
      <div class="portrait-wrapper" ${m.bio ? 'data-bio="true"' : ''}>
        ${m.image ? `
          <img class="portrait-img" src="${m.image}" alt="${m.name}" 
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        ` : ''}
        <div class="portrait-fallback" style="${m.image ? 'display:none' : 'display:flex'}">
          ${initials(m.name)}
        </div>
        ${m.bio ? `<div class="portrait-bio"><p>${m.bio}</p></div>` : ''}
      </div>
      <div class="team-info">
        <h3 class="team-name">${m.name}</h3>
        <p class="team-role">${m.role || 'Team Member'}</p>
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

/* ============ Parties & Committees ============ */
const PARTY_TBA = `<p class="parties-tba">To be announced by the Secretariat.</p>`;

function makePartyCard(p) {
  const typeClass = p.type === 'committee' ? 'party-card-comm' : (p.side === 'opposition' ? 'party-card-opp' : 'party-card-ruling');
  return `
    <article class="party-card ${typeClass}">
      <h4 class="party-card-name">${escapeHtml(p.name)}</h4>
      ${p.description ? `<p class="party-card-desc">${escapeHtml(p.description)}</p>` : ''}
    </article>`;
}

async function renderParties() {
  const rulingEl = document.getElementById('ruling-grid');
  const oppEl = document.getElementById('opposition-grid');
  const commEl = document.getElementById('committees-grid');
  if (!rulingEl || !oppEl || !commEl) return;
  try {
    const all = await fetch(`${API_BASE}/parties`).then(r => r.json());
    const ruling = all.filter(p => p.type === 'party' && p.side === 'ruling');
    const opp = all.filter(p => p.type === 'party' && p.side === 'opposition');
    const comm = all.filter(p => p.type === 'committee');
    rulingEl.innerHTML = ruling.length ? ruling.map(makePartyCard).join('') : PARTY_TBA;
    oppEl.innerHTML = opp.length ? opp.map(makePartyCard).join('') : PARTY_TBA;
    commEl.innerHTML = comm.length ? comm.map(makePartyCard).join('') : PARTY_TBA;
  } catch {
    rulingEl.innerHTML = oppEl.innerHTML = commEl.innerHTML = PARTY_TBA;
  }
}

function initPartiesAdmin() {
  const form = document.getElementById('party-form');
  const listEl = document.getElementById('parties-admin-list');
  if (!form || !listEl) return;

  async function loadList() {
    try {
      const all = await fetch(`${API_BASE}/parties`).then(r => r.json());
      if (!all.length) { listEl.innerHTML = '<p style="opacity:.5;font-size:.85rem;">No entries yet.</p>'; return; }
      listEl.innerHTML = all.map(p => `
        <div class="party-admin-row">
          <span class="party-admin-label">
            <strong>${escapeHtml(p.name)}</strong>
            <em style="opacity:.6;font-size:.8rem;"> — ${p.type}${p.side ? ' · ' + p.side : ''}</em>
          </span>
          <button class="party-del-btn" data-id="${p.id}" title="Delete">✕</button>
        </div>`).join('');
      listEl.querySelectorAll('.party-del-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Delete "${btn.closest('.party-admin-row').querySelector('strong').textContent}"?`)) return;
          btn.disabled = true;
          try {
            await fetch(`${API_BASE}/admin/parties/${btn.dataset.id}`, {
              method: 'DELETE', headers: { 'X-Admin-Password': adminPassword }
            });
            await Promise.all([loadList(), renderParties()]);
            showToast('Deleted');
          } catch { showToast('Failed to delete', 'error'); btn.disabled = false; }
        });
      });
    } catch { listEl.innerHTML = '<p style="color:#ff6b6b;font-size:.85rem;">Could not load.</p>'; }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('party-name').value.trim();
    const type = document.getElementById('party-type').value;
    const side = document.getElementById('party-side').value;
    const description = document.getElementById('party-desc').value.trim();
    if (!name) return;
    try {
      await fetch(`${API_BASE}/admin/parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
        body: JSON.stringify({ name, type, side, description })
      });
      form.reset();
      await Promise.all([loadList(), renderParties()]);
      showToast('Added!');
    } catch { showToast('Failed to add', 'error'); }
  });

  loadList();
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
/* ============ Email OTP Verification ============ */
let _otp = null, _otpEmail = null, _otpExpiry = null, _otpVerified = false, _otpTimer = null;

function _genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtp() {
  const emailInput = document.getElementById('reg-email-input');
  const nameInput = document.querySelector('#reg-form [name="name"]');
  const sendBtn = document.getElementById('otp-send-btn');
  const block = document.getElementById('otp-block');
  const email = emailInput?.value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Enter a valid email first', 'error'); return;
  }
  sendBtn.disabled = true;
  const orig = sendBtn.textContent;
  sendBtn.textContent = 'Sending…';
  try {
    _otp = _genOtp();
    _otpEmail = email;
    _otpExpiry = Date.now() + 10 * 60 * 1000;
    _otpVerified = false;
    const name = nameInput?.value.trim() || email.split('@')[0];
    console.log('[OTP] Sending to:', email, '| OTP:', _otp);
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_OTP_TEMPLATE_ID, {
      to_email: email,
      email: email,
      to_name: name,
      user_name: name,
      otp: _otp
    });
    block.classList.remove('hidden');
    const otpInput = document.getElementById('otp-input');
    otpInput.value = '';
    otpInput.disabled = false;
    document.getElementById('otp-verify-btn').disabled = false;
    document.getElementById('otp-verified-msg')?.classList.add('hidden');
    showToast('OTP sent! Check your inbox.', 'success');
    _startOtpCountdown();
  } catch (e) {
    _otp = null;
    const msg = e?.text || e?.message || JSON.stringify(e) || 'Unknown error';
    console.error('[OTP] EmailJS send failed:', e);
    showToast('OTP failed: ' + msg, 'error');
  } finally {
    sendBtn.textContent = orig;
    sendBtn.disabled = false;
  }
}

function _startOtpCountdown() {
  clearInterval(_otpTimer);
  let t = 60;
  const btn = document.getElementById('otp-resend-btn');
  const cd = document.getElementById('otp-countdown');
  if (!btn || !cd) return;
  btn.classList.remove('hidden');
  btn.disabled = true;
  cd.textContent = t;
  _otpTimer = setInterval(() => {
    t--;
    cd.textContent = t;
    if (t <= 0) {
      clearInterval(_otpTimer);
      btn.disabled = false;
      btn.innerHTML = 'Resend OTP';
    }
  }, 1000);
}

function checkOtp() {
  const code = document.getElementById('otp-input')?.value.trim();
  if (!_otp || !code || Date.now() > _otpExpiry) {
    showToast('OTP expired. Please request a new one.', 'error'); return;
  }
  if (code === _otp) {
    _otpVerified = true;
    document.getElementById('otp-verified-msg')?.classList.remove('hidden');
    document.getElementById('otp-input').disabled = true;
    document.getElementById('otp-verify-btn').disabled = true;
    document.getElementById('otp-resend-btn')?.classList.add('hidden');
    clearInterval(_otpTimer);
    showToast('✓ Email verified!', 'success');
  } else {
    showToast('Incorrect OTP. Try again.', 'error');
  }
}

function _resetOtp() {
  _otp = null; _otpEmail = null; _otpExpiry = null; _otpVerified = false;
  clearInterval(_otpTimer);
  document.getElementById('otp-block')?.classList.add('hidden');
  document.getElementById('otp-input') && (document.getElementById('otp-input').value = '');
  document.getElementById('otp-verified-msg')?.classList.add('hidden');
  document.getElementById('otp-resend-btn')?.classList.add('hidden');
  const sendBtn = document.getElementById('otp-send-btn');
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Send OTP'; }
}

function initOtp() {
  const emailInput = document.getElementById('reg-email-input');
  emailInput?.addEventListener('input', () => {
    const sendBtn = document.getElementById('otp-send-btn');
    if (!sendBtn) return;
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
    sendBtn.disabled = !valid;
    // if email changed after verification, reset
    if (_otpVerified && emailInput.value.trim() !== _otpEmail) _resetOtp();
  });
  document.getElementById('otp-send-btn')?.addEventListener('click', sendOtp);
  document.getElementById('otp-verify-btn')?.addEventListener('click', checkOtp);
  document.getElementById('otp-resend-btn')?.addEventListener('click', sendOtp);
  document.getElementById('otp-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); checkOtp(); }
  });
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
  _resetOtp();
}

async function submitRegistration(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("form-submit-btn");
  const err = document.getElementById("form-err");
  err.classList.remove("visible");

  if (!_otpVerified) {
    err.textContent = "Please verify your email with the OTP before proceeding.";
    err.classList.add("visible");
    document.getElementById('reg-email-input')?.focus();
    return;
  }

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
let _partiesCache = null; // cached full list from /api/parties
let showOverviewDashboard = false;

async function loadPartiesCache() {
  try {
    _partiesCache = await fetch(`${API_BASE}/parties`).then(r => r.json());
  } catch {
    _partiesCache = [];
  }
}

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
    await loadPartiesCache();       // must complete before renderRows() reads it
    await loadRegistrations();
    if (showOverviewDashboard) renderOverview();
    initPartiesAdmin();
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
  const headers = ["ID", "Name", "Email", "Phone", "Parent Name", "Parent Phone", "Year", "College", "Role Preference", "Portfolio", "Assigned Party", "Assigned Committee", "Notes", "Status", "UTR", "Created At"];
  const rows = lastRegistrations.map(r => [
    r.id, r.name, r.email, r.phone, r.parent_name, r.parent_phone, r.year, r.college, r.role_preference, r.portfolio, r.assigned_party || '', r.assigned_committee || '', r.notes, r.status, r.utr, r.created_at
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

function exportVerifiedSheet() {
  const verified = lastRegistrations.filter(r => r.status === 'verified');
  if (!verified.length) {
    showToast("No verified participants yet", "error");
    return;
  }
  const headers = ["#", "Name", "Email", "Phone", "Parent Name", "Parent Phone", "Year", "College", "Role", "Portfolio", "Assigned Party", "Assigned Committee"];
  const rows = verified.map((r, i) => [
    i + 1, r.name, r.email, r.phone, r.parent_name, r.parent_phone, r.year, r.college, r.role_preference, r.portfolio || '', r.assigned_party || '', r.assigned_committee || ''
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `adhikar26-verified-delegates-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`✓ Downloaded sheet for ${verified.length} verified delegate${verified.length !== 1 ? 's' : ''}`);
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
    if (showOverviewDashboard) renderOverview();
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
  tbody.innerHTML = list.map(r => {
    const isVerified = r.status === 'verified';
    const parties = (_partiesCache || []).filter(p => p.type === 'party');
    const comms = (_partiesCache || []).filter(p => p.type === 'committee');
    const alreadySent = isVerified && r.assigned_party && r.assigned_committee;

    const portfolioCell = isVerified ? `
      <div class="assign-cell">
        <input type="text" value="${escapeHtml(r.portfolio || '')}"
          placeholder="Assign Portfolio..."
          onchange="handlePortfolioChange('${r.id}', this.value)" />
        <select class="assign-select" id="party-sel-${r.id}" title="Party">
          <option value="">— Party —</option>
          ${parties.map(p => `<option value="${escapeHtml(p.name)}" ${r.assigned_party === p.name ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
        </select>
        <select class="assign-select" id="comm-sel-${r.id}" title="Committee">
          <option value="">— Committee —</option>
          ${comms.map(c => `<option value="${escapeHtml(c.name)}" ${r.assigned_committee === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
        ${alreadySent
        ? `<button class="action-btn inform-btn inform-sent" onclick="handleInformDelegate('${r.id}')" id="inform-btn-${r.id}">Resend</button>`
        : `<button class="action-btn inform-btn" onclick="handleInformDelegate('${r.id}')" id="inform-btn-${r.id}">Inform</button>`
      }
      </div>
    ` : `
      <input type="text" value="${escapeHtml(r.portfolio || '')}"
        placeholder="Assign Portfolio..."
        onchange="handlePortfolioChange('${r.id}', this.value)" />
    `;

    return `
    <tr data-id="${r.id}" data-testid="admin-row-${r.id}">
      <td class="td-delegate">
        <strong>${escapeHtml(r.name)}</strong>
        <p style="font-size:0.75rem; color:#bca0a0; margin:4px 0 0;">${escapeHtml(r.role_preference)} · ${escapeHtml(r.year)}</p>
      </td>
      <td class="td-portfolio">${portfolioCell}</td>
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
    </tr>`;
  }).join("");
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
          portfolio: reg.portfolio || "will be assigned soon",
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
  document.getElementById("admin-verified-sheet")?.addEventListener("click", exportVerifiedSheet);
  document.getElementById("admin-rows")?.addEventListener("click", handleRowAction);
  document.getElementById("admin-view-overview")?.addEventListener("click", toggleOverview);
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
    loadPartiesCache().then(() => {
      loadRegistrations().then(() => {
        if (showOverviewDashboard) renderOverview();
      });
    });
    initPartiesAdmin();
  }
}

function toggleOverview() {
  showOverviewDashboard = !showOverviewDashboard;
  const btn = document.getElementById("admin-view-overview");
  const tableWrap = document.getElementById("admin-table-wrap");
  const overviewSection = document.getElementById("admin-overview");
  const controlsBar = document.querySelector(".admin-controls-bar");

  if (showOverviewDashboard) {
    btn.classList.add("admin-view-overview-active");
    tableWrap.classList.add("hidden");
    controlsBar.classList.add("hidden");
    overviewSection.classList.remove("hidden");
    renderOverview();
  } else {
    btn.classList.remove("admin-view-overview-active");
    tableWrap.classList.remove("hidden");
    controlsBar.classList.remove("hidden");
    overviewSection.classList.add("hidden");
  }
}

function renderOverview() {
  const containerParties = document.getElementById("overview-parties");
  const containerComms = document.getElementById("overview-committees");
  if (!containerParties || !containerComms) return;

  const verified = lastRegistrations.filter(r => r.status === 'verified');

  // Groups
  const partyGroups = {};
  const commGroups = {};

  verified.forEach(r => {
    if (r.assigned_party) {
      if (!partyGroups[r.assigned_party]) partyGroups[r.assigned_party] = [];
      partyGroups[r.assigned_party].push(r);
    }
    if (r.assigned_committee) {
      if (!commGroups[r.assigned_committee]) commGroups[r.assigned_committee] = [];
      commGroups[r.assigned_committee].push(r);
    }
  });

  // Render Parties
  const partyNames = Object.keys(partyGroups).sort();
  containerParties.innerHTML = partyNames.length ? partyNames.map(name => `
    <div class="group-card">
      <div class="group-name">
        <span>${escapeHtml(name)}</span>
        <span class="group-count">${partyGroups[name].length}</span>
      </div>
      <div class="member-pills">
        ${partyGroups[name].map(m => `<span class="member-pill">${escapeHtml(m.name)}</span>`).join('')}
      </div>
    </div>
  `).join('') : '<p class="muted">No party assignments yet.</p>';

  // Render Committees
  const commNames = Object.keys(commGroups).sort();
  containerComms.innerHTML = commNames.length ? commNames.map(name => `
    <div class="group-card">
      <div class="group-name">
        <span>${escapeHtml(name)}</span>
        <span class="group-count">${commGroups[name].length}</span>
      </div>
      <div class="member-pills">
        ${commGroups[name].map(m => `
          <span class="member-pill">
            ${escapeHtml(m.name)}
            ${m.assigned_party ? `<span class="member-party">(${escapeHtml(m.assigned_party)})</span>` : ''}
          </span>
        `).join('')}
      </div>
    </div>
  `).join('') : '<p class="muted">No committee assignments yet.</p>';
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

async function handleInformDelegate(id) {
  const partySel = document.getElementById(`party-sel-${id}`);
  const commSel = document.getElementById(`comm-sel-${id}`);
  const btn = document.getElementById(`inform-btn-${id}`);
  if (!partySel || !commSel || !btn) return;

  const assigned_party = partySel.value;
  const assigned_committee = commSel.value;

  if (!assigned_party || !assigned_committee) {
    showToast('Please select both a Party and a Committee first.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    // 1. Persist assignment to DB
    const res = await fetch(`${API_BASE}/admin/registrations/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify({ assigned_party, assigned_committee }),
    });
    if (!res.ok) throw new Error('DB save failed');

    // Update local cache
    const reg = lastRegistrations.find(r => r.id === id);
    if (reg) {
      reg.assigned_party = assigned_party;
      reg.assigned_committee = assigned_committee;
    }

    // 2. Send single assignment email (party + committee combined)
    if (reg && typeof emailjs !== 'undefined') {
      await emailjs.send(
        EMAILJS_COMM_SERVICE_ID,
        EMAILJS_COMM_TEMPLATE_ID,
        {
          to_email: reg.email,
          to_name: reg.name,
          party_name: assigned_party,
          committee_name: assigned_committee,
          reg_id: reg.id,
        },
        { publicKey: EMAILJS_COMM_PUBLIC_KEY }
      );
    }

    // 3. Swap button to ✓ Sent momentarily, then allow Resend
    btn.textContent = '✓ Sent';
    btn.classList.add('inform-sent');
    showToast('Assignment email sent!');
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Resend';
    }, 3000);
  } catch (err) {
    console.error('[Inform Delegate] Error:', err);
    showToast('Failed: ' + (err.text || err.message || 'Unknown error'), 'error');
    btn.disabled = false;
    btn.textContent = 'Inform';
  }
}

/* ============ Portrait Bio Toggle ============ */
function initPortraitBio() {
  // Use event delegation so it works for dynamically rendered team cards too
  document.addEventListener("click", (e) => {
    const wrapper = e.target.closest(".portrait-wrapper[data-bio]");
    if (wrapper) {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains("bio-open");
      // close all others first
      document.querySelectorAll(".portrait-wrapper.bio-open").forEach(w => w.classList.remove("bio-open"));
      if (!isOpen) wrapper.classList.add("bio-open");
    } else {
      // click outside closes all
      document.querySelectorAll(".portrait-wrapper.bio-open").forEach(w => w.classList.remove("bio-open"));
    }
  });
}

/* ============ Loading Screen ============ */
function initLoadingScreen() {
  const loader = document.getElementById("page-loader");
  if (!loader) return;
  const hide = () => {
    loader.classList.add("fade-out");
    loader.addEventListener("transitionend", () => loader.remove(), { once: true });
  };
  if (document.readyState === "complete") {
    setTimeout(hide, 300);
  } else {
    window.addEventListener("load", () => setTimeout(hide, 400), { once: true });
  }
}

/* ============ Smooth Scroll ============ */
function initSmoothScroll() {
  document.querySelectorAll("a[href^='#']").forEach(link => {
    link.addEventListener("click", e => {
      const id = link.getAttribute("href");
      const target = id === "#" ? document.body : document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

/* ============ Scroll Reveal ============ */
function initReveal() {
  const els = document.querySelectorAll(".reveal, .reveal-stagger");
  if (!els.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
  els.forEach(el => observer.observe(el));
}

/* ============ Number Counters ============ */
function animateCounter(el) {
  const target = +el.dataset.count;
  const suffix = el.dataset.suffix || "";
  const duration = 1800;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const val = Math.floor((1 - Math.pow(1 - t, 3)) * target);
    el.textContent = val + suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function initCounters() {
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.8 });
  counters.forEach(el => observer.observe(el));
}

/* ============ Cursor Spotlight ============ */
function initCursorSpotlight() {
  const el = document.getElementById("cursor-spotlight");
  if (!el || window.matchMedia("(hover: none)").matches) return;
  let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
  let cx = tx, cy = ty;
  window.addEventListener("mousemove", e => { tx = e.clientX; ty = e.clientY; });
  const tick = () => {
    cx += (tx - cx) * 0.1;
    cy += (ty - cy) * 0.1;
    el.style.left = cx + "px";
    el.style.top = cy + "px";
    requestAnimationFrame(tick);
  };
  tick();
}

/* ============ Magnetic Buttons ============ */
function initMagneticButtons() {
  if (window.matchMedia("(hover: none)").matches) return;
  document.querySelectorAll(".btn-primary").forEach(btn => {
    btn.addEventListener("mousemove", e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.22;
      const y = (e.clientY - r.top - r.height / 2) * 0.22;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener("mouseleave", () => btn.style.transform = "");
  });
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
  initPortraitBio();
  initCounters();
  initCursorSpotlight();
  initMagneticButtons();
  initOtp();
  renderParties();
});
