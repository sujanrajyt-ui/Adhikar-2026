/**
 * Adhikar'26 Leaderboard Logic
 */

const API_BASE = '/api';
let allData = { leaderboard: [], criteria: [] };

// Elements
const awardSelector = document.getElementById('award-selector');
const podiumSection = document.getElementById('podium-section');
const rankingsBody = document.getElementById('rankings-body');
const updateTime = document.getElementById('update-time');

async function init() {
    await fetchData();
    renderCriteriaOptions();
    renderLeaderboard();
}

async function fetchData() {
    try {
        const res = await fetch(`${API_BASE}/public/leaderboard`);
        allData = await res.json();
        updateTime.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        console.error("Failed to fetch leaderboard", err);
    }
}

function renderCriteriaOptions() {
    const options = allData.criteria.map(c =>
        `<option value="${c.id}">Specific Award: ${c.name}</option>`
    ).join('');
    awardSelector.innerHTML += options;
}

function renderLeaderboard() {
    const filter = awardSelector.value;
    let data = [...allData.leaderboard];

    if (filter === 'overall') {
        // Already sorted by totalScore from backend
    } else {
        // Sort by specific criteria score
        data.sort((a, b) => b.criteriaScores[filter] - a.criteriaScores[filter]);
    }

    renderPodium(data);
    renderTable(data, filter);
}

function renderPodium(data) {
    if (data.length === 0) {
        podiumSection.innerHTML = '';
        return;
    }

    const top3 = data.slice(0, 3);
    // Order: 2nd, 1st, 3rd for visual podium
    const displayOrder = [];
    if (top3[1]) displayOrder.push({ ...top3[1], rank: 2 });
    if (top3[0]) displayOrder.push({ ...top3[0], rank: 1 });
    if (top3[2]) displayOrder.push({ ...top3[2], rank: 3 });

    podiumSection.innerHTML = displayOrder.map(d => `
        <div class="podium-item podium-${d.rank}">
            <div class="podium-rank rank-${d.rank}">${d.rank}</div>
            <div class="podium-box">
                <div class="podium-name">${escapeHtml(d.name)}</div>
                <div class="podium-meta">
                    ${escapeHtml(d.committee)}<br>
                    ${escapeHtml(d.party)}
                </div>
                <div class="podium-score">
                    ${getDisplayScore(d, awardSelector.value)}
                </div>
            </div>
        </div>
    `).join('');
}

function renderTable(data, filter) {
    const list = data.slice(3); // Everyone after top 3
    if (list.length === 0 && data.length <= 3) {
        rankingsBody.innerHTML = '<tr><td colspan="4" class="muted text-center">No additional rankings.</td></tr>';
        return;
    }

    rankingsBody.innerHTML = data.map((d, index) => `
        <tr>
            <td><span class="rank-num">#${index + 1}</span></td>
            <td>
                <div class="delegate-name">${escapeHtml(d.name)}</div>
                <div class="delegate-sub">${escapeHtml(d.portfolio || 'Delegate')}</div>
            </td>
            <td>
                <div class="delegate-sub">${escapeHtml(d.committee)} | ${escapeHtml(d.party)}</div>
            </td>
            <td class="text-right">
                <div class="score-value">${getDisplayScore(d, filter)}</div>
            </td>
        </tr>
    `).join('');
}

function getDisplayScore(delegate, filter) {
    if (filter === 'overall') {
        return delegate.totalScore.toFixed(1);
    } else {
        return (delegate.criteriaScores[filter] || 0).toFixed(1);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

// Events
awardSelector.addEventListener('change', renderLeaderboard);

document.addEventListener('DOMContentLoaded', () => {
    init();
    initReveal();

    // Loader
    setTimeout(() => {
        const loader = document.getElementById('page-loader');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => loader.remove(), 400);
        }
    }, 400);
});
