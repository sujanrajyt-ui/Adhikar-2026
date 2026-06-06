/**
 * Adhikar'26 — Scoring Dashboard (Perfection Edition)
 * Features: Inline scoring, keyboard navigation, auto-focus, progress ring, real-time validation
 */

const API_BASE = '/api';
let currentJudge = sessionStorage.getItem('adhikar_judge') || null;
let allDelegates = [];
let allCriteria = [];

// DOM Cache
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const judgeInfo = document.getElementById('judge-info');
const judgeDisplayId = document.getElementById('judge-display-id');
const delegateList = document.getElementById('delegate-list');
const criteriaList = document.getElementById('criteria-list');
const delegateSearch = document.getElementById('delegate-search');

/* ========== Utilities ========== */
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 50);
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ========== Authentication ========== */
async function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('login-judge-id').value.trim();
    const password = document.getElementById('login-judge-pass').value.trim();
    const err = document.getElementById('login-err');
    const btn = e.target.querySelector('button');

    err.textContent = '';
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/scores/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, password })
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail || "Invalid Judge ID or Passcode");
        }

        const data = await res.json();
        currentJudge = data.judgeId;
        sessionStorage.setItem('adhikar_judge', currentJudge);
        initDashboard();
    } catch (ex) {
        err.textContent = ex.message;
    } finally {
        btn.disabled = false;
    }
}

function handleLogout() {
    currentJudge = null;
    sessionStorage.removeItem('adhikar_judge');
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    judgeInfo.classList.add('hidden');
}

/* ========== Data Fetching ========== */
async function initDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    judgeInfo.classList.remove('hidden');
    judgeDisplayId.textContent = currentJudge;

    try {
        await Promise.all([loadCriteria(), loadDelegates()]);
        renderCriteria();
        renderDelegates();
        updateProgress();
    } catch (err) {
        console.error("Dashboard init error:", err);
        showToast("Failed to initialize dashboard", "error");
    }
}

async function loadCriteria() {
    const res = await fetch(`${API_BASE}/scores/criteria`);
    if (!res.ok) throw new Error("Failed to load criteria");
    allCriteria = await res.json();
}

async function loadDelegates() {
    const res = await fetch(`${API_BASE}/scores/delegates?judgeId=${currentJudge}`);
    if (!res.ok) throw new Error("Failed to load delegates");
    allDelegates = await res.json();
}

/* ========== Rendering ========== */
function renderCriteria() {
    if (!criteriaList) return;
    criteriaList.innerHTML = allCriteria.map(c => `
    <div class="criteria-item">
      <span>${escapeHtml(c.name)}</span>
      <span class="gold-text">${c.max_points} pts</span>
    </div>
  `).join('');
}

function renderDelegates() {
    if (!delegateList) return;
    const query = (delegateSearch ? delegateSearch.value : '').toLowerCase();
    const filtered = allDelegates.filter(d =>
        d.name.toLowerCase().includes(query) ||
        (d.assigned_party && d.assigned_party.toLowerCase().includes(query)) ||
        (d.assigned_committee && d.assigned_committee.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        delegateList.innerHTML = '<div class="empty-state"><p>No delegates found.</p></div>';
        return;
    }

    delegateList.innerHTML = filtered.map((d, idx) => {
        const totalScore = d.scores ? d.scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0) : 0;
        const maxPoss = allCriteria.reduce((sum, c) => sum + c.max_points, 0);
        const hasScored = d.scores && d.scores.length > 0;

        const criteriaHtml = allCriteria.map(c => {
            const existing = d.scores ? d.scores.find(s => s.criteria_id === c.id) : null;
            const val = existing ? existing.score : '';
            return `
        <div class="inline-criteria">
          <label>${escapeHtml(c.name)} <small>/${c.max_points}</small></label>
          <input type="number"
            id="score_${d.id}_${c.id}"
            min="0" max="${c.max_points}"
            value="${val}"
            oninput="validateInput(this, ${c.max_points})"
            onchange="markDirty('${d.id}')"
            placeholder="—">
        </div>
      `;
        }).join('');

        return `
      <div class="delegate-card" data-id="${d.id}" style="animation-delay: ${idx * 0.04}s">
        <div class="card-head">
          <div class="delegate-info">
            <h3>${escapeHtml(d.name)}</h3>
            <div class="delegate-meta">
              <span class="meta-pill">${escapeHtml(d.assigned_party || 'No Party')}</span>
              <span class="meta-pill">${escapeHtml(d.assigned_committee || 'No Committee')}</span>
              ${d.portfolio ? `<span class="meta-pill gold-text">${escapeHtml(d.portfolio)}</span>` : ''}
            </div>
          </div>
          <div class="score-badge-wrap">
            ${hasScored ? `<span class="score-badge">${totalScore} / ${maxPoss}</span>` : `<span class="score-empty">Pending</span>`}
          </div>
        </div>

        <div class="inline-scoring-box">
          <div class="criteria-row">
            ${criteriaHtml}
          </div>
          <button class="inline-save-btn" id="save-btn-${d.id}" onclick="handleInlineSave('${d.id}')">
            Submit Scores
          </button>
        </div>
      </div>
    `;
    }).join('');
}

/* ========== Real-time Validation ========== */
function validateInput(input, maxPoints) {
    const val = parseInt(input.value, 10);
    if (input.value !== '' && (isNaN(val) || val < 0 || val > maxPoints)) {
        input.classList.add('input-invalid');
    } else {
        input.classList.remove('input-invalid');
    }
}

function markDirty(delegateId) {
    const btn = document.getElementById(`save-btn-${delegateId}`);
    if (btn) {
        btn.classList.add('dirty');
        btn.textContent = 'Submit Scores';
    }
}

/* ========== Save Handler (with local state update) ========== */
async function handleInlineSave(delegateId) {
    const delegate = allDelegates.find(d => d.id === delegateId);
    if (!delegate) return;

    const submissions = [];
    const btn = document.getElementById(`save-btn-${delegateId}`);

    btn.disabled = true;
    btn.innerHTML = '<span class="saving-spinner"></span> Saving...';

    try {
        // Validate all inputs first
        let hasValidationError = false;
        for (const criteria of allCriteria) {
            const input = document.getElementById(`score_${delegateId}_${criteria.id}`);
            const val = parseInt(input.value, 10);
            if (input.value !== '' && !isNaN(val)) {
                if (val < 0 || val > criteria.max_points) {
                    input.classList.add('input-invalid');
                    hasValidationError = true;
                } else {
                    submissions.push({
                        delegate_id: delegateId,
                        judge_id: currentJudge,
                        criteria_id: criteria.id,
                        score: val
                    });
                }
            }
        }

        if (hasValidationError) {
            throw new Error("Some scores exceed the maximum allowed points");
        }

        if (submissions.length === 0) {
            showToast("Please enter at least one score", "error");
            btn.disabled = false;
            btn.textContent = 'Submit Scores';
            return;
        }

        // Send all scores
        const responses = await Promise.all(submissions.map(s =>
            fetch(`${API_BASE}/scores/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(s)
            })
        ));

        // Check for errors
        for (const res of responses) {
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Server ${res.status}: ${errorText}`);
            }
        }

        // ✅ Update LOCAL state (no re-fetch needed → preserves focus)
        const dIdx = allDelegates.findIndex(d => d.id === delegateId);
        if (dIdx > -1) {
            if (!allDelegates[dIdx].scores) allDelegates[dIdx].scores = [];
            submissions.forEach(s => {
                const sIdx = allDelegates[dIdx].scores.findIndex(os => os.criteria_id === s.criteria_id);
                if (sIdx > -1) {
                    allDelegates[dIdx].scores[sIdx].score = s.score;
                } else {
                    allDelegates[dIdx].scores.push({ criteria_id: s.criteria_id, score: s.score });
                }
            });
        }

        // Update the score badge on THIS card (no re-render)
        const totalScore = allDelegates[dIdx].scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
        const maxPoss = allCriteria.reduce((sum, c) => sum + c.max_points, 0);
        const badgeWrap = document.querySelector(`[data-id="${delegateId}"] .score-badge-wrap`);
        if (badgeWrap) {
            badgeWrap.innerHTML = `<span class="score-badge">${totalScore} / ${maxPoss}</span>`;
        }

        // Success feedback
        btn.classList.remove('dirty');
        btn.innerHTML = '✓ Saved';
        btn.classList.add('saved');
        setTimeout(() => btn.classList.remove('saved'), 2000);

        showToast(`Scores saved for ${delegate.name}`);
        updateProgress();

        // Auto-focus next delegate
        focusNextDelegate(delegateId);

    } catch (err) {
        console.error("Save error:", err);
        showToast(err.message || "Failed to save scores", "error");
        btn.disabled = false;
        btn.innerHTML = '⟳ Retry Save';
    }
}

/* ========== Progress Tracking ========== */
function updateProgress() {
    const total = allDelegates.length;
    const scored = allDelegates.filter(d => d.scores && d.scores.length > 0).length;

    // Update text counters
    const scoredEl = document.getElementById('scored-count');
    const totalEl = document.getElementById('total-count');
    if (scoredEl) scoredEl.textContent = scored;
    if (totalEl) totalEl.textContent = total;

    // Update progress bar
    const pct = total > 0 ? (scored / total) * 100 : 0;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = `${pct}%`;

    // Update progress ring (SVG)
    const circle = document.getElementById('progress-circle');
    const pctText = document.getElementById('progress-percent');
    if (circle) {
        const circumference = 2 * Math.PI * 26; // r=26
        circle.setAttribute('stroke-dasharray', circumference);
        circle.setAttribute('stroke-dashoffset', circumference - (pct / 100) * circumference);
    }
    if (pctText) pctText.textContent = `${Math.round(pct)}%`;
}

/* ========== Auto-Focus & Keyboard Navigation ========== */
function focusNextDelegate(currentId) {
    const cards = Array.from(document.querySelectorAll('.delegate-card'));
    const currentIdx = cards.findIndex(c => c.getAttribute('data-id') === currentId);
    if (currentIdx !== -1 && currentIdx < cards.length - 1) {
        const nextCard = cards[currentIdx + 1];
        const nextInput = nextCard.querySelector('input[type="number"]');
        if (nextInput) {
            setTimeout(() => {
                nextInput.focus();
                nextInput.select();
                nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.id && e.target.id.startsWith('score_')) {
        const parts = e.target.id.split('_');
        if (parts.length < 3) return;
        const delegateId = parts[1];
        const criteriaId = parts[2];

        if (e.key === 'Enter') {
            e.preventDefault();
            handleInlineSave(delegateId);
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusVertical(delegateId, criteriaId, 1);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusVertical(delegateId, criteriaId, -1);
        }
    }
});

function focusVertical(currentId, criteriaId, direction) {
    const cards = Array.from(document.querySelectorAll('.delegate-card'));
    const currentIdx = cards.findIndex(c => c.getAttribute('data-id') === currentId);
    const nextIdx = currentIdx + direction;

    if (nextIdx >= 0 && nextIdx < cards.length) {
        const nextCardId = cards[nextIdx].getAttribute('data-id');
        const nextInput = document.getElementById(`score_${nextCardId}_${criteriaId}`);
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
            cards[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

/* ========== Scroll Reveal ========== */
function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    els.forEach(el => observer.observe(el));
}

/* ========== Init ========== */
document.addEventListener('DOMContentLoaded', () => {
    console.log("Scoring Dashboard v2 — Perfection Edition");
    initReveal();

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('scores-logout').addEventListener('click', handleLogout);
    if (delegateSearch) delegateSearch.addEventListener('input', renderDelegates);

    // Auto-login from session
    const saved = sessionStorage.getItem('adhikar_judge');
    if (saved) {
        currentJudge = saved;
        initDashboard();
    }

    // Loader
    setTimeout(() => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => loader.remove(), 400);
        }
    }, 400);
});
