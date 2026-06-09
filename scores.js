const API_BASE = '/api';
let currentJudge = sessionStorage.getItem('adhikar_judge') || null;
let currentSession = null;
let allDelegates = [];
let allCriteria = [];
let allSessions = [];
let sessionStatus = {}; // { sessionId: 'locked' | 'unlocked' | 'completed' }

const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const judgeInfo = document.getElementById('judge-info');
const judgeDisplayId = document.getElementById('judge-display-id');
const delegateList = document.getElementById('delegate-list');
const criteriaList = document.getElementById('criteria-list');
const delegateSearch = document.getElementById('delegate-search');
const sessionTabs = document.getElementById('session-tabs');

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
    currentSession = null;
    sessionStorage.removeItem('adhikar_judge');
    sessionStorage.removeItem('adhikar_session');
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    judgeInfo.classList.add('hidden');
}

async function initDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    judgeInfo.classList.remove('hidden');
    judgeDisplayId.textContent = currentJudge;

    try {
        await Promise.all([loadCriteria(), loadSessions()]);
        resolveSession();
        renderSessionTabs();
        await loadDelegates();
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

async function loadSessions() {
    const res = await fetch(`${API_BASE}/sessions?judgeId=${currentJudge}`);
    if (!res.ok) throw new Error("Failed to load sessions");
    allSessions = await res.json();

    // Build session status map
    sessionStatus = {};
    for (let i = 0; i < allSessions.length; i++) {
        const s = allSessions[i];
        if (i === 0) {
            sessionStatus[s.id] = s.hasScores ? 'completed' : 'unlocked';
        } else if (s.hasScores) {
            sessionStatus[s.id] = 'completed';
        } else if (sessionStatus[allSessions[i - 1].id] === 'completed') {
            sessionStatus[s.id] = 'unlocked';
        } else {
            sessionStatus[s.id] = 'locked';
        }
    }
}

function resolveSession() {
    const saved = sessionStorage.getItem('adhikar_session');
    if (saved && sessionStatus[saved] && sessionStatus[saved] !== 'locked') {
        currentSession = saved;
        return;
    }
    // Fall back to first unlocked session
    const first = allSessions.find(s => sessionStatus[s.id] === 'unlocked');
    currentSession = first ? first.id : (allSessions[0] ? allSessions[0].id : null);
    if (currentSession) sessionStorage.setItem('adhikar_session', currentSession);
}

function renderSessionTabs() {
    if (!sessionTabs) return;
    sessionTabs.innerHTML = allSessions.map((s, i) => {
        const status = sessionStatus[s.id] || 'locked';
        const isActive = s.id === currentSession;
        let icon = '';
        let label = '';
        if (status === 'completed') {
            icon = `<svg class="tab-icon completed" viewBox="0 0 24 24" width="16" height="16"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/></svg>`;
            label = 'completed';
        } else if (status === 'locked') {
            icon = `<svg class="tab-icon locked" viewBox="0 0 24 24" width="16" height="16"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor"/></svg>`;
            label = 'locked';
        }
        return `
            <button class="session-tab ${isActive ? 'active' : ''} ${status}"
                data-session="${s.id}"
                ${status === 'locked' ? 'disabled' : ''}
                title="${status === 'locked' ? 'Score the previous session first' : s.name}">
                ${icon}
                <span class="tab-short">${s.id}</span>
                <span class="tab-full">${escapeHtml(s.name)}</span>
                ${status === 'completed' ? `<span class="tab-badge">${label}</span>` : ''}
                ${status === 'unlocked' && !isActive ? `<span class="tab-badge tab-ready">ready</span>` : ''}
            </button>
        `;
    }).join('');
}

function handleTabClick(sessionId) {
    if (sessionStatus[sessionId] === 'locked') return;
    if (sessionId === currentSession) return;
    currentSession = sessionId;
    sessionStorage.setItem('adhikar_session', currentSession);
    switchSession();
}

async function switchSession() {
    renderSessionTabs();
    await loadDelegates();
    renderDelegates();
    updateProgress();
    showToast(`Switched to ${allSessions.find(s => s.id === currentSession)?.name || currentSession}`, 'info');
}

async function loadDelegates() {
    const res = await fetch(`${API_BASE}/scores/delegates?judgeId=${currentJudge}&sessionId=${currentSession || ''}`);
    if (!res.ok) throw new Error("Failed to load delegates");
    allDelegates = await res.json();
}

function renderCriteria() {
    if (!criteriaList) return;
    criteriaList.innerHTML = allCriteria.map(c => `
    <div class="criteria-item" title="${escapeHtml(c.description)}">
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
        delegateList.innerHTML = '<div class="empty-state"><p>No delegates found for this session.</p></div>';
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
              ${d.assigned_constituency ? `<span class="meta-pill meta-constituency">${escapeHtml(d.assigned_constituency)}</span>` : ''}
              ${d.assigned_party ? `<span class="meta-pill">${escapeHtml(d.assigned_party)}</span>` : ''}
              ${d.assigned_committee ? `<span class="meta-pill">${escapeHtml(d.assigned_committee)}</span>` : ''}
              ${d.portfolio ? `<span class="meta-pill gold-text">${escapeHtml(d.portfolio)}</span>` : ''}
              ${d.elected_role ? `<span class="role-badge-mini">${escapeHtml(d.elected_role)}</span>` : ''}
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

async function handleInlineSave(delegateId) {
    const delegate = allDelegates.find(d => d.id === delegateId);
    if (!delegate) return;

    const submissions = [];
    const btn = document.getElementById(`save-btn-${delegateId}`);

    btn.disabled = true;
    btn.innerHTML = '<span class="saving-spinner"></span> Saving...';

    try {
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
                        score: val,
                        session_id: currentSession
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

        const responses = await Promise.all(submissions.map(s =>
            fetch(`${API_BASE}/scores/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(s)
            })
        ));

        for (const res of responses) {
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Server ${res.status}: ${errorText}`);
            }
        }

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

        const totalScore = allDelegates[dIdx].scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
        const maxPoss = allCriteria.reduce((sum, c) => sum + c.max_points, 0);
        const badgeWrap = document.querySelector(`[data-id="${delegateId}"] .score-badge-wrap`);
        if (badgeWrap) {
            badgeWrap.innerHTML = `<span class="score-badge">${totalScore} / ${maxPoss}</span>`;
        }

        btn.classList.remove('dirty');
        btn.innerHTML = '✓ Saved';
        btn.classList.add('saved');
        setTimeout(() => btn.classList.remove('saved'), 2000);

        showToast(`Scores saved for ${delegate.name}`);
        updateProgress();

        // Unlock next session if this was the first score in current session
        await checkSessionUnlock();

        focusNextDelegate(delegateId);

    } catch (err) {
        console.error("Save error:", err);
        showToast(err.message || "Failed to save scores", "error");
        btn.disabled = false;
        btn.innerHTML = '⟳ Retry Save';
    }
}

async function checkSessionUnlock() {
    // Check if this session now has scores (first submission unlocks next)
    const hadScoresBefore = sessionStatus[currentSession] === 'completed';
    if (hadScoresBefore) return;

    // Check if current session actually has scores now
    const hasAnyScore = allDelegates.some(d => d.scores && d.scores.length > 0);
    if (!hasAnyScore) return;

    // Mark current as completed
    sessionStatus[currentSession] = 'completed';

    // Unlock next session
    const currentIdx = allSessions.findIndex(s => s.id === currentSession);
    if (currentIdx >= 0 && currentIdx < allSessions.length - 1) {
        const nextSession = allSessions[currentIdx + 1];
        if (sessionStatus[nextSession.id] === 'locked') {
            sessionStatus[nextSession.id] = 'unlocked';
            showToast(`🔓 ${nextSession.name} is now unlocked!`, 'info');
        }
    }

    renderSessionTabs();
}

function updateProgress() {
    const total = allDelegates.length;
    const scored = allDelegates.filter(d => d.scores && d.scores.length > 0).length;

    const scoredEl = document.getElementById('scored-count');
    const totalEl = document.getElementById('total-count');
    if (scoredEl) scoredEl.textContent = scored;
    if (totalEl) totalEl.textContent = total;

    const pct = total > 0 ? (scored / total) * 100 : 0;
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = `${pct}%`;

    const circle = document.getElementById('progress-circle');
    const pctText = document.getElementById('progress-percent');
    if (circle) {
        const circumference = 2 * Math.PI * 26;
        circle.setAttribute('stroke-dasharray', circumference);
        circle.setAttribute('stroke-dashoffset', circumference - (pct / 100) * circumference);
    }
    if (pctText) pctText.textContent = `${Math.round(pct)}%`;
}

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

document.addEventListener('DOMContentLoaded', () => {
    console.log("Scoring Dashboard v4 — Sequential Session Tabs");
    initReveal();

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('scores-logout').addEventListener('click', handleLogout);
    if (delegateSearch) delegateSearch.addEventListener('input', renderDelegates);

    // Delegate tab clicks via event delegation
    if (sessionTabs) {
        sessionTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.session-tab');
            if (tab && !tab.disabled) {
                handleTabClick(tab.dataset.session);
            }
        });
    }

    const saved = sessionStorage.getItem('adhikar_judge');
    if (saved) {
        currentJudge = saved;
        initDashboard();
    }

    setTimeout(() => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => loader.remove(), 400);
        }
    }, 400);
});