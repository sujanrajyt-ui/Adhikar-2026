/**
 * Adhikar'26 Leaderboard Logic
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
        // Cache busting to ensure latest awards/scores are fetched
        const res = await fetch(`${API_BASE}/public/leaderboard?t=${Date.now()}`);
        const data = await res.json();
        allData = data;
        updateTime.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        console.error("Failed to fetch leaderboard", err);
    }
}

function renderCriteriaOptions() {
    // Highly simplified: Only show Overall and the Special Awards to reduce clutter
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
    let data = [...allData.leaderboard];

    if (filter === 'overall') {
        // Exclude Chairs/Speaker from overall excellence (typically reserved for delegates)
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

        // Resilient Requirement Filtering
        if (reqSide || reqRole) {
            data = data.filter(d => {
                const userRole = (d.elected_role || "").toLowerCase();
                const userSide = (d.side || "").toLowerCase();
                const sideText = (userSide + " " + (d.party || "") + " " + userRole).toLowerCase();

                // 1. Role match check (if specified)
                let roleMatch = true;
                if (reqRole) {
                    const roles = reqRole.split(',').map(r => r.trim());
                    roleMatch = roles.some(r => userRole.includes(r));
                }

                // 2. Side match check (if specified)
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

                // Use "OR" matching for Asset/Team awards to be more inclusive
                if (award.id.includes('ruling') || award.id.includes('opposition')) {
                    return roleMatch || sideMatch;
                }

                // Default: Role MUST match for specific titles (like Best Minister)
                return roleMatch;
            });
        } else {
            // General Awards (Neutral): Exclude Chairs/Speakers by default to avoid confusion
            data = data.filter(d => {
                const role = (d.elected_role || "").toLowerCase();
                return !["speaker", "deputy speaker", "marshal"].some(r => role.includes(r));
            });
        }

        // Calculate Award-Specific Score
        data.forEach(d => {
            d.awardScore = formula.reduce((sum, item) => {
                const cid = item.id || item;
                const weight = item.weight || (1 / formula.length);
                return sum + ((d.criteriaScores[cid] || 0) * weight);
            }, 0);
        });

        // Tie-breaking logic
        data.sort((a, b) => {
            if (b.awardScore !== a.awardScore) return b.awardScore - a.awardScore;
            if (formula.length > 0) {
                const primary = formula.reduce((prev, curr) => (prev.weight > curr.weight) ? prev : curr);
                const pId = primary.id || primary;
                if (b.criteriaScores[pId] !== a.criteriaScores[pId]) return (b.criteriaScores[pId] || 0) - (a.criteriaScores[pId] || 0);
            }
            return b.totalScore - a.totalScore;
        });
    } else {
        // Specific criteria sorting
        data.sort((a, b) => {
            const scoreA = a.criteriaScores[filter] || 0;
            const scoreB = b.criteriaScores[filter] || 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            return b.totalScore - a.totalScore;
        });
    }

    renderPodium(data);
    renderTable(data, filter);
    renderAwardInfo(filter);
}

function renderAwardInfo(filter) {
    const infoEl = document.getElementById('award-info-box');
    if (!infoEl) return;

    if (filter === 'overall') {
        infoEl.innerHTML = `<strong>Overall Excellence:</strong> Based on the average of all parliamentary metrics.`;
    } else if (filter.startsWith('awd_')) {
        const award = allData.awards.find(a => a.id === filter);
        if (award) {
            const formula = award.criteria_ids.map(c => {
                const criteria = allData.criteria.find(cr => cr.id === (c.id || c));
                const weight = (c.weight * 100).toFixed(0) + '%';
                return `<span>${criteria ? criteria.name : c.id}: <b>${weight}</b></span>`;
            }).join(' + ');
            infoEl.innerHTML = `<div class="award-formula-tag">Formula:</div> ${formula}`;
        }
    } else {
        const crit = allData.criteria.find(c => c.id === filter);
        infoEl.innerHTML = `<strong>Metric Focus:</strong> Ranking solely by ${crit ? crit.name : filter}.`;
    }
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
    if (data.length === 0) {
        rankingsBody.innerHTML = '<tr><td colspan="4" class="muted text-center">No eligible delegates found in this category.</td></tr>';
        return;
    }

    const list = data.slice(3); // Everyone after top 3
    if (list.length === 0 && data.length <= 3) {
        rankingsBody.innerHTML = '<tr><td colspan="4" class="muted text-center">No additional rankings.</td></tr>';
        // But we still have podium, so this is fine.
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
    } else if (filter.startsWith('awd_')) {
        return (delegate.awardScore || 0).toFixed(1);
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
