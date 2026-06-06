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

async function init() {
    await fetchData();
    renderCriteriaOptions();
    renderLeaderboard();
}

async function fetchData() {
    try {
        const res = await fetch(`${API_BASE}/public/leaderboard?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        allData = data;
        updateTime.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        console.error("Failed to fetch leaderboard", err);
        rankingsBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error loading data: ${err.message}</td></tr>`;
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
                const sideText = (userSide + " " + (d.party || "") + " " + userRole).toLowerCase();

                let roleMatch = true;
                if (reqRole) {
                    const roles = reqRole.split(',').map(r => r.trim().toLowerCase());
                    roleMatch = roles.some(r => userRole.includes(r) || r.includes(userRole) && userRole.length > 3);
                }

                let sideMatch = true;
                if (reqSide) {
                    if (reqSide === 'ruling') {
                        sideMatch = sideText.includes('ruling') || sideText.includes('gov') || sideText.includes('treasury');
                    } else if (reqSide === 'opposition') {
                        sideMatch = sideText.includes('opposition');
                    } else {
                        sideMatch = sideText.includes(reqSide);
                    }
                }

                // inclusive for Team awards
                if (award.id.includes('ruling') || award.id.includes('opposition')) {
                    return roleMatch || sideMatch;
                }
                return roleMatch;
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
                <div class="podium-meta">${escapeHtml(d.portfolio || 'Delegate')}</div>
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

    const rows = data.map((d, index) => `
        <tr class="${index < 3 ? 'podium-row' : ''}">
            <td><span class="rank-num">#${index + 1}</span></td>
            <td>
                <div class="delegate-name">${escapeHtml(d.name)}</div>
                <div class="delegate-sub">${escapeHtml(d.elected_role || 'General Delegate')}</div>
            </td>
            <td>
                <div class="delegate-sub">${escapeHtml(d.committee || 'All Members')} | ${escapeHtml(d.party || 'Independent')}</div>
            </td>
            <td class="text-right">
                <div class="score-value">${getDisplayScore(d, filter)}</div>
            </td>
        </tr>
    `).join('');

    rankingsBody.innerHTML = rows;
}

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

awardSelector.addEventListener('change', renderLeaderboard);
document.addEventListener('DOMContentLoaded', init);
