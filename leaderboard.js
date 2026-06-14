/**
 * Adhikar'26 Leaderboard Logic - Robust Version
 */

const API_BASE = '/api';
let allData = { leaderboard: [], criteria: [], awards: [] };

// Elements
const awardSelector = document.getElementById('award-selector');
const podiumSection = document.getElementById('podium-section');
const rankingsBody = document.getElementById('rankings-body');
const updateTime = document.getElementById('update-time');

let leaderboardPass = localStorage.getItem('leaderboardPassword') || '';

async function init() {
    if (leaderboardPass) {
        checkAndFetch();
    } else {
        showLogin();
    }

    // Auto-refresh every 60 seconds if authenticated
    setInterval(async () => {
        if (leaderboardPass) {
            await fetchData();
            renderLeaderboard();
        }
    }, 60000);
}

function showLogin(invalid = false) {
    document.getElementById('leaderboard-login').style.display = 'flex';
    document.getElementById('main-content').style.display = 'none';
    document.body.classList.add('is-locked');
    if (invalid) {
        document.getElementById('login-error').style.display = 'block';
        localStorage.removeItem('leaderboardPassword');
        leaderboardPass = '';
    }
    const loader = document.getElementById('page-loader');
    if (loader) loader.classList.add('hidden');
}

async function checkAndFetch() {
    try {
        await fetchData();
        renderCriteriaOptions();
        renderLeaderboard();

        // Success: hide login
        document.getElementById('leaderboard-login').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        document.body.classList.remove('is-locked');

        const loader = document.getElementById('page-loader');
        if (loader) loader.classList.add('hidden');
    } catch (err) {
        if (err.message.includes('401')) {
            showLogin(true);
        } else {
            console.error("Fetch failed", err);
        }
    }
}

window.handleLogin = async function () {
    const pw = document.getElementById('leaderboard-pass').value.trim();
    if (!pw) return;

    try {
        const res = await fetch('/api/leaderboard/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
        });

        if (res.ok) {
            leaderboardPass = pw;
            localStorage.setItem('leaderboardPassword', pw);
            await checkAndFetch();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    } catch (err) {
        alert("Server error. Please try again.");
    }
};

async function fetchData() {
    try {
        const res = await fetch(`${API_BASE}/public/leaderboard?t=${Date.now()}`, {
            headers: { 'X-Leaderboard-Password': leaderboardPass }
        });
        if (res.status === 401) throw new Error('HTTP 401');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        allData = data;
        updateTime.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        throw err;
    }
}

function renderCriteriaOptions() {
    let options = `<option value="overall">🏆 Overall Excellence</option>`;

    if (allData.awards && allData.awards.length > 0) {
        options += '<optgroup label="✨ Special Awards">';
        options += allData.awards.map(a =>
            `<option value="${a.id}">Award: ${a.name}</option>`
        ).join('');
        options += '</optgroup>';
    }

    awardSelector.innerHTML = options;
}

function renderLeaderboard() {
    const filter = awardSelector.value;
    let data = [...(allData.leaderboard || [])];

    if (filter === 'overall') {
        // Exclude Chairs/Speaker from overall excellence
        data = data.filter(d => {
            const role = (d.elected_role || "").toLowerCase();
            return !["speaker", "deputy speaker", "secretary general", "marshal"].some(r => role.includes(r));
        });
        data.sort((a, b) => b.totalScore - a.totalScore);
    } else if (filter.startsWith('awd_')) {
        const award = allData.awards.find(a => a.id === filter);
        const formula = award ? award.criteria_ids : [];
        const reqSide = award ? (award.requires_side || "").toLowerCase() : null;
        const reqRole = award ? (award.requires_role || "").toLowerCase() : null;

        if (reqSide || reqRole) {
            data = data.filter(d => {
                const userRole = (d.elected_role || "").toLowerCase();
                const userSide = (d.side || "").toLowerCase();

                let roleMatch = true;
                if (reqRole) {
                    const roles = reqRole.split(',').map(r => r.trim().toLowerCase());
                    roleMatch = roles.some(r => {
                        if (userRole === r) return true;
                        if (r === 'minister' && userRole.startsWith('minister of')) return true;
                        return false;
                    });
                }

                let sideMatch = true;
                if (reqSide) {
                    sideMatch = userSide === reqSide;
                }

                if (reqSide && reqRole) {
                    return roleMatch && sideMatch;
                } else if (reqSide) {
                    return sideMatch;
                } else {
                    return roleMatch;
                }
            });
        } else {
            // Neutral Awards
            data = data.filter(d => {
                const role = (d.elected_role || "").toLowerCase();
                return !["speaker", "deputy speaker", "marshal"].some(r => role.includes(r));
            });
        }

        // Score calculation
        data.forEach(d => {
            d.awardScore = formula.reduce((sum, item) => {
                const cid = item.id || item;
                const weight = item.weight || (1 / formula.length);
                return sum + ((d.criteriaScores[cid] || 0) * weight);
            }, 0);
        });

        data.sort((a, b) => {
            if (b.awardScore !== a.awardScore) return b.awardScore - a.awardScore;
            return b.totalScore - a.totalScore;
        });
    }

    renderPodium(data);
    renderTable(data, filter);
    renderAwardInfo(filter);
}

function renderPodium(data) {
    if (!data || data.length === 0) {
        podiumSection.innerHTML = '';
        return;
    }

    const top3 = data.slice(0, 3);
    const displayOrder = [];
    if (top3[1]) displayOrder.push({ ...top3[1], rank: 2 });
    if (top3[0]) displayOrder.push({ ...top3[0], rank: 1 });
    if (top3[2]) displayOrder.push({ ...top3[2], rank: 3 });

    podiumSection.innerHTML = displayOrder.map(d => `
        <div class="podium-item podium-${d.rank}">
            <div class="podium-rank rank-${d.rank}">${d.rank}</div>
            <div class="podium-box">
                <div class="podium-name">${escapeHtml(d.name)}</div>
                <div class="podium-meta">${escapeHtml(d.portfolio || d.elected_role || 'General Delegate')}</div>
                <div class="podium-score">${getDisplayScore(d, awardSelector.value)}</div>
            </div>
        </div>
    `).join('');
}

function renderTable(data, filter) {
    if (!data || data.length === 0) {
        rankingsBody.innerHTML = '<tr><td colspan="4" class="muted text-center">No entries found for this selection. Check if roles are assigned and delegates are verified.</td></tr>';
        return;
    }

    const rows = data.map((d, index) => {
        const isOverall = filter === 'overall' || filter.startsWith('awd_');

        // Breakdown content
        const breakdownHtml = allData.criteria.map(c => {
            const score = d.criteriaScores[c.id] || 0;
            const pct = (score / c.max_points) * 100;
            return `
                <div class="breakdown-item">
                    <div class="breakdown-label-row">
                        <span class="breakdown-label">${escapeHtml(c.name)}</span>
                        <span class="breakdown-value">${score.toFixed(1)}<small>/${c.max_points}</small></span>
                    </div>
                    <div class="breakdown-bar">
                        <div class="breakdown-fill" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <tr class="leaderboard-row" onclick="toggleDetails('${d.id}')">
                <td><span class="row-rank">#${index + 1}</span></td>
                <td>
                    <div class="row-name">${escapeHtml(d.name)}</div>
                    <div class="delegate-sub">${escapeHtml(d.elected_role || 'General Delegate')}</div>
                </td>
                <td class="hide-mobile">
                    <div class="delegate-sub">${escapeHtml(d.committee || 'All Members')}</div>
                    <div class="podium-meta" style="font-size:0.7rem; margin-top:2px;">${escapeHtml(d.party || 'Independent')}</div>
                </td>
                <td>
                    <div class="row-score">
                        ${getDisplayScore(d, filter)}
                        <span class="detail-toggle-icon">▾</span>
                    </div>
                </td>
            </tr>
            <tr id="details-${d.id}" class="details-row hidden">
                <td colspan="4">
                    <div class="breakdown-container">
                        <div class="breakdown-title">Performance Breakdown <small>(Averaged across sessions)</small></div>
                        <div class="breakdown-grid">
                            ${breakdownHtml}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    rankingsBody.innerHTML = rows;
}

window.toggleDetails = function (id) {
    const el = document.getElementById(`details-${id}`);
    if (el) el.classList.toggle('hidden');
};

function renderAwardInfo(filter) {
    const infoEl = document.getElementById('award-info-box');
    if (!infoEl) return;

    const award = allData.awards.find(a => a.id === filter);
    if (!award && filter !== 'overall') {
        infoEl.innerHTML = `<strong>Status:</strong> Viewing raw scores for individual criteria.`;
        return;
    }

    if (filter === 'overall') {
        infoEl.innerHTML = `<strong>Overall Excellence:</strong> Based on the average of all parliamentary metrics.`;
    } else {
        const reqStr = [
            award.requires_role ? `Roles: ${award.requires_role}` : null,
            award.requires_side ? `Side: ${award.requires_side}` : null
        ].filter(x => x).join(' | ');

        infoEl.innerHTML = `<strong>Requirements:</strong> ${reqStr || 'All Delegates Valid'} <br>
            <small>Ranked by specific category weights.</small>`;
    }
}

function getDisplayScore(delegate, filter) {
    if (filter === 'overall') return (delegate.totalScore || 0).toFixed(1);
    if (filter.startsWith('awd_')) return (delegate.awardScore || 0).toFixed(1);
    return (delegate.criteriaScores[filter] || 0).toFixed(1);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

document.getElementById('leaderboard-pass')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
});
awardSelector.addEventListener('change', renderLeaderboard);
document.addEventListener('DOMContentLoaded', init);
