const PARTY_NAME_MAP = {
    'A': 'Rashtriya Yuva Pragati Manch (A)',
    'B': 'Yuva Drishti Party (B)',
    'C': 'New Gen Leaders (C)',
    'D': 'Catalyst Party (D)',
    'E': 'Navpeedhi Bharat Party (E)'
};

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
const coalitionInfo = document.getElementById('coalition-info');
let allParties = [];
let coalitionRefreshInterval = null;

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
    stopCoalitionRefresh();
    flushAttendance();
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
        await Promise.all([loadCriteria(), loadSessions(), loadParties()]);
        resolveSession();
        renderSessionTabs();
        await loadDelegates();
        renderCriteria();
        renderDelegates();
        renderCoalition();
        updateProgress();
        startCoalitionRefresh();
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

    // All sessions always accessible; mark completed if has scores
    sessionStatus = {};
    allSessions.forEach(s => {
        sessionStatus[s.id] = s.hasScores ? 'completed' : 'unlocked';
    });
}

function resolveSession() {
    currentSession = allSessions[0] ? allSessions[0].id : null;
    if (currentSession) sessionStorage.setItem('adhikar_session', currentSession);
}

function renderSessionTabs() {
    if (!sessionTabs) return;
    sessionTabs.innerHTML = allSessions.map((s, i) => {
        const status = sessionStatus[s.id] || 'unlocked';
        const isActive = s.id === currentSession;
        const isRC = s.id === 'RC' || s.id === 'RC2';
        const icon = status === 'completed'
            ? `<svg class="tab-icon completed" viewBox="0 0 24 24" width="16" height="16"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/></svg>`
            : isRC
                ? `<svg class="tab-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
                : '';
        return `
            <button class="session-tab ${isActive ? 'active' : ''} ${status === 'completed' ? 'completed' : ''} ${isRC ? 'rc-tab' : ''}"
                data-session="${s.id}"
                title="${s.name}">
                ${icon}
                <span class="tab-short">${s.id}</span>
                <span class="tab-full">${escapeHtml(s.name)}</span>
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

async function loadParties() {
    try {
        const res = await fetch(`${API_BASE}/parties?t=${Date.now()}`);
        if (res.ok) allParties = await res.json();
    } catch (e) {
        console.error("Failed to load parties", e);
    }
}

function renderCoalition() {
    if (!coalitionInfo) return;

    const counts = {};
    allDelegates.forEach(d => {
        const p = PARTY_NAME_MAP[d.assigned_party] || d.assigned_party || 'Unassigned';
        counts[p] = (counts[p] || 0) + 1;
    });

    const parties = allParties.filter(p => p.type === 'party');
    const total = allDelegates.length;
    const hasSides = parties.some(p => p.side && p.side !== 'neutral');

    if (!hasSides) {
        // No coalition formed yet — show individual parties only
        const sorted = [...parties].sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0));
        coalitionInfo.innerHTML = `
            <div class="coal-flat-list">
                ${sorted.map(p => {
            const count = counts[p.name] || 0;
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            return `
                        <div class="coal-party coal-flat">
                            <span class="coal-party-name">${escapeHtml(p.name)}</span>
                            <span class="coal-party-count">${count} <small>${pct}%</small></span>
                        </div>
                    `;
        }).join('')}
            </div>
            <div class="coal-total-row">
                <span><strong>Total</strong></span>
                <span><strong>${total}</strong></span>
            </div>
        `;
        return;
    }

    // Coalition sides are set — show grouped view
    const ruling = parties.filter(p => p.side === 'ruling');
    const opposition = parties.filter(p => p.side === 'opposition');
    const neutral = parties.filter(p => !p.side || p.side === 'neutral');

    const totalRuling = ruling.reduce((sum, p) => sum + (counts[p.name] || 0), 0);
    const totalOpp = opposition.reduce((sum, p) => sum + (counts[p.name] || 0), 0);
    const totalNeutral = neutral.reduce((sum, p) => sum + (counts[p.name] || 0), 0);

    const partyRow = (party, side) => {
        const count = counts[party.name] || 0;
        const sideClass = side === 'ruling' ? 'coal-gov' : side === 'opposition' ? 'coal-opp' : 'coal-neutral';
        return `
            <div class="coal-party ${sideClass}">
                <span class="coal-party-name">${escapeHtml(party.name)}</span>
                <span class="coal-party-count">${count}</span>
            </div>
        `;
    };

    const govPct = total > 0 ? (totalRuling / total * 100) : 0;
    const oppPct = total > 0 ? (totalOpp / total * 100) : 0;
    const neuPct = total > 0 ? (totalNeutral / total * 100) : 0;

    coalitionInfo.innerHTML = `
        <div class="coal-bar-wrap">
            <div class="coal-bar">
                ${totalRuling > 0 ? `<div class="coal-bar-seg coal-bar-gov" style="width:${govPct}%"></div>` : ''}
                ${totalOpp > 0 ? `<div class="coal-bar-seg coal-bar-opp" style="width:${oppPct}%"></div>` : ''}
                ${totalNeutral > 0 ? `<div class="coal-bar-seg coal-bar-neutral" style="width:${neuPct}%"></div>` : ''}
            </div>
            <div class="coal-bar-labels">
                ${totalRuling > 0 ? `<span class="coal-bar-label coal-label-gov">${totalRuling}</span>` : ''}
                ${totalOpp > 0 ? `<span class="coal-bar-label coal-label-opp">${totalOpp}</span>` : ''}
                ${totalNeutral > 0 ? `<span class="coal-bar-label coal-label-neutral">${totalNeutral}</span>` : ''}
            </div>
        </div>
        ${ruling.length > 0 ? `
            <div class="coal-block">
                <div class="coal-block-head coal-head-gov">
                    <span class="coal-label">GOVERNMENT</span>
                    <span class="coal-total">${totalRuling} <small>${Math.round(govPct)}%</small></span>
                </div>
                <div class="coal-block-body">${ruling.map(p => partyRow(p, 'ruling')).join('')}</div>
            </div>
        ` : ''}
        ${opposition.length > 0 ? `
            <div class="coal-block">
                <div class="coal-block-head coal-head-opp">
                    <span class="coal-label">OPPOSITION</span>
                    <span class="coal-total">${totalOpp} <small>${Math.round(oppPct)}%</small></span>
                </div>
                <div class="coal-block-body">${opposition.map(p => partyRow(p, 'opposition')).join('')}</div>
            </div>
        ` : ''}
        ${neutral.length > 0 ? `
            <div class="coal-block">
                <div class="coal-block-head coal-head-neutral">
                    <span class="coal-label">CROSS BENCH</span>
                    <span class="coal-total">${totalNeutral} <small>${Math.round(neuPct)}%</small></span>
                </div>
                <div class="coal-block-body">${neutral.map(p => partyRow(p, 'neutral')).join('')}</div>
            </div>
        ` : ''}
        <div class="coal-total-row">
            <span><strong>Total</strong></span>
            <span><strong>${total}</strong></span>
        </div>
    `;
}

function startCoalitionRefresh() {
    stopCoalitionRefresh();
    coalitionRefreshInterval = setInterval(async () => {
        await loadParties();
        renderCoalition();
    }, 15000);
}

function stopCoalitionRefresh() {
    if (coalitionRefreshInterval) {
        clearInterval(coalitionRefreshInterval);
        coalitionRefreshInterval = null;
    }
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

function getDelegateSide(delegate) {
    const partyName = PARTY_NAME_MAP[delegate.assigned_party] || delegate.assigned_party;
    if (!partyName || !allParties) return null;
    const party = allParties.find(p => p.name === partyName && p.type === 'party');
    return party ? (party.side || null) : null;
}

function renderDelegates() {
    if (!delegateList) return;
    // Hide criteria sidebar in Roll Call mode
    const isRollCall = currentSession === 'RC' || currentSession === 'RC2';
    const criteriaCard = document.querySelector('.criteria-card');
    const statsCard = document.querySelector('.stats-card');
    if (criteriaCard) criteriaCard.style.display = isRollCall ? 'none' : 'block';
    if (statsCard) statsCard.style.display = isRollCall ? 'none' : 'block';
    // Roll Call mode
    if (isRollCall) {
        renderAttendance();
        return;
    }
    const query = (delegateSearch ? delegateSearch.value : '').toLowerCase();
    const filtered = allDelegates.filter(d => {
        const party = PARTY_NAME_MAP[d.assigned_party] || d.assigned_party || '';
        return d.name.toLowerCase().includes(query) ||
            party.toLowerCase().includes(query) ||
            (d.assigned_committee && d.assigned_committee.toLowerCase().includes(query));
    });

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
              ${d.assigned_party ? `<span class="meta-pill">${escapeHtml(PARTY_NAME_MAP[d.assigned_party] || d.assigned_party)}</span>` : ''}
              ${d.assigned_committee ? `<span class="meta-pill">${escapeHtml(d.assigned_committee)}</span>` : ''}
              ${d.portfolio ? `<span class="meta-pill gold-text">${escapeHtml(d.portfolio)}</span>` : ''}
              ${d.elected_role ? `<span class="meta-pill" style="border-color:var(--gold); border-style:dashed;">${escapeHtml(d.elected_role)}</span>` : ''}
              ${getDelegateSide(d) === 'ruling' ? '<span class="meta-pill meta-side-ruling">GOVERNMENT</span>' : getDelegateSide(d) === 'opposition' ? '<span class="meta-pill meta-side-opposition">OPPOSITION</span>' : ''}
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
          <button class="btn-primary" id="save-btn-${d.id}" onclick="handleInlineSave('${d.id}')" style="margin-top:0;">
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
            fetch(`${API_BASE} /scores/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(s)
            })
        ));

        for (const res of responses) {
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Server ${res.status}: ${errorText} `);
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

        // Mark session as completed if first score
        if (sessionStatus[currentSession] !== 'completed') {
            sessionStatus[currentSession] = 'completed';
            renderSessionTabs();
        }

        focusNextDelegate(delegateId);

    } catch (err) {
        console.error("Save error:", err);
        showToast(err.message || "Failed to save scores", "error");
        btn.disabled = false;
        btn.innerHTML = '⟳ Retry Save';
    }
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
    if (pctText) pctText.textContent = `${Math.round(pct)}% `;
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

let attendanceDirty = {};
let attendanceTimer = null;

function renderAttendance() {
    const query = (delegateSearch ? delegateSearch.value : '').toLowerCase();
    const filtered = allDelegates.filter(d => {
        const party = PARTY_NAME_MAP[d.assigned_party] || d.assigned_party || '';
        return d.name.toLowerCase().includes(query) ||
            party.toLowerCase().includes(query) ||
            (d.assigned_committee && d.assigned_committee.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
        delegateList.innerHTML = '<div class="empty-state"><p>No delegates found.</p></div>';
        return;
    }

    const presentCount = filtered.filter(d => getAttendanceStatus(d)).length;
    const total = filtered.length;

    delegateList.innerHTML = `
        <div class="attn-header">
            <div class="attn-stats">
                <span class="attn-stat attn-stat-present">${presentCount} Present</span>
                <span class="attn-sep">·</span>
                <span class="attn-stat attn-stat-absent">${total - presentCount} Absent</span>
                <span class="attn-sep">·</span>
                <span class="attn-stat attn-stat-total">${total} Total</span>
            </div>
            <div class="attn-actions">
                <button class="attn-btn attn-btn-all" onclick="markAllAttendance(true)" title="Mark all present (P key)">✓ All Present</button>
                <button class="attn-btn attn-btn-none" onclick="markAllAttendance(false)" title="Mark all absent (A key)">✗ All Absent</button>
            </div>
        </div>
            <div class="attn-list">
                ${filtered.map((d, idx) => {
        const present = getAttendanceStatus(d);
        return `
                    <div class="attn-item ${present ? 'attn-item-present' : 'attn-item-absent'}" 
                         data-id="${d.id}" style="animation-delay: ${idx * 0.03}s">
                        <div class="attn-item-info">
                            <span class="attn-item-icon" style="background:rgba(255,255,255,0.05); color:white; border:1px solid var(--glass-border);">${present ? '✓' : '○'}</span>
                            <div>
                                <div class="attn-item-name" style="font-size:1.1rem; font-weight:700;">${escapeHtml(d.name)}</div>
                                <div class="attn-item-meta" style="display:flex; gap:6px; margin-top:4px;">
                                    ${d.assigned_party ? `<span class="meta-pill">${escapeHtml(PARTY_NAME_MAP[d.assigned_party] || d.assigned_party)}</span>` : ''}
                                    ${d.assigned_committee ? `<span class="meta-pill">${escapeHtml(d.assigned_committee)}</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="attn-item-toggles" style="display:flex; gap:10px;">
                            <button class="attn-toggle ${present ? 'attn-toggle-active attn-toggle-yes' : 'attn-toggle-yes'}" 
                                    onclick="handleAttendanceToggle('${d.id}', true, this)">
                                ✓ Present
                            </button>
                            <button class="attn-toggle ${!present && d.scores && d.scores.some(s => s.criteria_id === 'attendance') ? 'attn-toggle-active attn-toggle-no' : 'attn-toggle-no'}" 
                                    onclick="handleAttendanceToggle('${d.id}', false, this)">
                                ✗ Absent
                            </button>
                        </div>
                    </div>
                `;
    }).join('')}
            </div>
        `;

    updateAttendanceStats();
}

function getAttendanceStatus(delegate) {
    const attnScore = delegate.scores && delegate.scores.find(s => s.criteria_id === 'attendance');
    return attnScore ? attnScore.score === 1 : false;
}

function updateAttendanceStats() {
    const items = document.querySelectorAll('.attn-item');
    const present = document.querySelectorAll('.attn-item.attn-item-present').length;
    const total = items.length;
    const absent = total - present;

    const statsEl = document.querySelector('.attn-stats');
    if (statsEl) {
        statsEl.innerHTML = `
            <span class="attn-stat attn-stat-present">${present} Present</span>
            <span class="attn-sep">·</span>
            <span class="attn-stat attn-stat-absent">${absent} Absent</span>
            <span class="attn-sep">·</span>
            <span class="attn-stat attn-stat-total">${total} Total</span>
        `;
    }
}

async function handleAttendanceToggle(delegateId, present, btnElement) {
    const delegate = allDelegates.find(d => d.id === delegateId);
    if (!delegate) return;

    // Optimistic UI update
    const item = btnElement.closest('.attn-item');
    if (!item) return;

    const yesBtn = item.querySelector('.attn-toggle-yes');
    const noBtn = item.querySelector('.attn-toggle-no');

    if (present) {
        item.classList.add('attn-item-present');
        item.classList.remove('attn-item-absent');
        yesBtn.classList.add('attn-toggle-active');
        noBtn.classList.remove('attn-toggle-active');
        item.querySelector('.attn-item-icon').textContent = '✓';
    } else {
        item.classList.add('attn-item-absent');
        item.classList.remove('attn-item-present');
        noBtn.classList.add('attn-toggle-active');
        yesBtn.classList.remove('attn-toggle-active');
        item.querySelector('.attn-item-icon').textContent = '○';
    }

    // Update local data
    if (!delegate.scores) delegate.scores = [];
    const existing = delegate.scores.find(s => s.criteria_id === 'attendance');
    if (existing) {
        existing.score = present ? 1 : 0;
    } else {
        delegate.scores.push({ criteria_id: 'attendance', score: present ? 1 : 0 });
    }

    // Mark dirty for this delegate
    attendanceDirty[delegateId] = present ? 1 : 0;

    updateAttendanceStats();

    // Debounced bulk save
    clearTimeout(attendanceTimer);
    attendanceTimer = setTimeout(() => flushAttendance(), 800);
}

async function flushAttendance() {
    const entries = Object.entries(attendanceDirty);
    if (entries.length === 0) return;

    const attendance = entries.map(([delegate_id, score]) => ({
        delegate_id,
        present: score === 1
    }));

    attendanceDirty = {};

    try {
        const res = await fetch(`${API_BASE}/scores/attendance/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                judge_id: currentJudge,
                session_id: 'RC',
                attendance
            })
        });
        if (!res.ok) throw new Error('Failed to save attendance');

        // Mark session as completed
        if (sessionStatus[currentSession] !== 'completed') {
            sessionStatus[currentSession] = 'completed';
            renderSessionTabs();
        }
    } catch (err) {
        console.error('Attendance save error:', err);
        showToast('Failed to save attendance', 'error');
    }
}

function markAllAttendance(present) {
    const items = document.querySelectorAll('.attn-item');
    items.forEach(item => {
        const id = item.dataset.id;
        const btn = present
            ? item.querySelector('.attn-toggle-yes')
            : item.querySelector('.attn-toggle-no');
        if (btn) {
            handleAttendanceToggle(id, present, btn);
        }
    });
    showToast(present ? 'All marked Present' : 'All marked Absent', 'info');
}

// Keyboard shortcuts for attendance
document.addEventListener('keydown', (e) => {
    if (!(currentSession === 'RC' || currentSession === 'RC2') || !delegateList || delegateList.querySelector('.attn-list') === null) return;
    if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        markAllAttendance(true);
    }
    if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        markAllAttendance(false);
    }
    if (e.key === 'Enter' && e.target.closest('.attn-item')) {
        const item = e.target.closest('.attn-item');
        const id = item.dataset.id;
        const present = !item.classList.contains('attn-item-present');
        const btn = present
            ? item.querySelector('.attn-toggle-yes')
            : item.querySelector('.attn-toggle-no');
        if (btn) handleAttendanceToggle(id, present, btn);
    }
});

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