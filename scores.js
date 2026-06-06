/**
 * Adhikar'26 Scoring Dashboard Logic
 */

const API_BASE = '/api';
let currentJudge = null;
let allDelegates = [];
let allCriteria = [];
let selectedDelegate = null;

// Select elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const judgeInfo = document.getElementById('judge-info');
const judgeDisplayId = document.getElementById('judge-display-id');
const delegateList = document.getElementById('delegate-list');
const criteriaList = document.getElementById('criteria-list');
const scoringModal = document.getElementById('scoring-modal');
const modalClose = document.getElementById('modal-close');
const scoringForm = document.getElementById('scoring-form');
const delegateSearch = document.getElementById('delegate-search');

// Toast helper
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 100);
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

// Authentication
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

        if (!res.ok) throw new Error("Invalid Judge ID or Passcode");

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

// Data Fetching
async function initDashboard() {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    judgeInfo.classList.remove('hidden');
    judgeDisplayId.textContent = currentJudge;

    await Promise.all([
        loadCriteria(),
        loadDelegates()
    ]);

    renderCriteria();
    renderDelegates();
    updateProgress();
}

async function loadCriteria() {
    try {
        const res = await fetch(`${API_BASE}/scores/criteria`);
        allCriteria = await res.json();
    } catch (err) {
        showToast("Failed to load criteria", "error");
    }
}

async function loadDelegates() {
    try {
        const res = await fetch(`${API_BASE}/scores/delegates?judgeId=${currentJudge}`);
        allDelegates = await res.json();
    } catch (err) {
        showToast("Failed to load delegates", "error");
    }
}

// Rendering
function renderCriteria() {
    criteriaList.innerHTML = allCriteria.map(c => `
    <div class="criteria-item">
      <span>${escapeHtml(c.name)}</span>
      <span class="gold-text">${c.max_points} pts</span>
    </div>
  `).join('');
}

function renderDelegates() {
    const query = delegateSearch.value.toLowerCase();
    const filtered = allDelegates.filter(d =>
        d.name.toLowerCase().includes(query) ||
        (d.assigned_party && d.assigned_party.toLowerCase().includes(query)) ||
        (d.assigned_committee && d.assigned_committee.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        delegateList.innerHTML = '<div class="muted">No delegates found.</div>';
        return;
    }

    delegateList.innerHTML = filtered.map(d => {
        const totalScore = d.scores.reduce((sum, s) => sum + s.score, 0);
        const maxPoss = allCriteria.reduce((sum, c) => sum + c.max_points, 0);
        const hasScored = d.scores.length > 0;

        const criteriaHtml = allCriteria.map(c => {
            const existing = d.scores.find(s => s.criteria_id === c.id);
            const val = existing ? existing.score : '';
            return `
        <div class="inline-criteria">
          <label>${escapeHtml(c.name)} <small>/${c.max_points}</small></label>
          <input type="number" 
            id="score_${d.id}_${c.id}" 
            min="0" max="${c.max_points}" 
            value="${val}" 
            onchange="markDirty('${d.id}')"
            placeholder="—">
        </div>
      `;
        }).join('');

        return `
      <div class="delegate-card" id="card-${d.id}">
        <div class="card-head">
          <div class="delegate-info">
            <h3>${escapeHtml(d.name)}</h3>
            <div class="delegate-meta">
              <span class="meta-pill">${escapeHtml(d.assigned_party || 'No Party')}</span>
              <span class="meta-pill">${escapeHtml(d.assigned_committee || 'No Committee')}</span>
              ${d.portfolio ? `<span class="meta-pill gold-text">${escapeHtml(d.portfolio)}</span>` : ''}
            </div>
          </div>
          <div class="scrolling-score">
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

function markDirty(delegateId) {
    const btn = document.getElementById(`save-btn-${delegateId}`);
    if (btn) btn.classList.add('dirty');
}

async function handleInlineSave(delegateId) {
    const delegate = allDelegates.find(d => d.id === delegateId);
    if (!delegate) return;

    const submissions = [];
    const btn = document.getElementById(`save-btn-${delegateId}`);

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        for (const criteria of allCriteria) {
            const input = document.getElementById(`score_${delegateId}_${criteria.id}`);
            const score = parseInt(input.value, 10);
            if (isNaN(score)) continue; // skip if empty

            submissions.push({
                delegate_id: delegateId,
                judge_id: currentJudge,
                criteria_id: criteria.id,
                score: score
            });
        }

        if (submissions.length === 0) {
            showToast("Please enter at least one score", "error");
            btn.disabled = false;
            btn.textContent = 'Submit Scores';
            return;
        }

        await Promise.all(submissions.map(s =>
            fetch(`${API_BASE}/scores/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(s)
            }).then(r => r.json())
        ));

        showToast(`Scores saved for ${delegate.name}`);
        btn.classList.remove('dirty');
        btn.textContent = '✓ Saved';

        // Update local counts without full re-render immediately to keep focus if possible, 
        // but for now, re-render to update total score badge
        await loadDelegates();
        renderDelegates();
        updateProgress();
    } catch (err) {
        showToast("Failed to save scores", "error");
        btn.disabled = false;
        btn.textContent = 'Retry Save';
    }
}

// Reveal Animation
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

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("Scoring Dashboard Initializing...");
    initReveal();
    document.getElementById('login-form').addEventListener('submit', handleLogin);


    document.getElementById('scores-logout').addEventListener('click', handleLogout);
    delegateSearch.addEventListener('input', renderDelegates);


    // Auto-login
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
