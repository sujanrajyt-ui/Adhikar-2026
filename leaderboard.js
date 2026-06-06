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
        const res = await fetch(`${API_BASE}/public/leaderboard`);
        const data = await res.json();
        allData = data;
        updateTime.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        console.error("Failed to fetch leaderboard", err);
    }
}

function renderCriteriaOptions() {
    // 1. Add Single Criteria Awards
    let options = allData.criteria.map(c =>
        `<option value="${c.id}">Specific Metric: ${c.name}</option>`
    ).join('');

    // 2. Add Composite Formula Awards
    if (allData.awards && allData.awards.length > 0) {
        options += `<optgroup label="Custom Award Standings">`;
        options += allData.awards.map(a =>
            `<option value="${a.id}">Award: ${a.name}</option>`
        ).join('');
        options += `</optgroup>`;
    }

    awardSelector.innerHTML = `<option value="overall">Overall Excellence (All Metrics)</option>` + options;
}

function renderLeaderboard() {
    const filter = awardSelector.value;
    let data = [...allData.leaderboard];

    if (filter === 'overall') {
        // Already sorted by totalScore from backend
        data.sort((a, b) => b.totalScore - a.totalScore);
    } else if (filter.startsWith('awd_')) {
        // Dynamic Award Formula
        const award = allData.awards.find(a => a.id === filter);
        const items = award ? award.criteria_ids : [];
        const requiredSide = award ? award.requires_side : null;

        // Apply eligibility filter (Robust multi-keyword match)
        if (requiredSide) {
            data = data.filter(d => {
                const s = (d.side || d.party || "").toLowerCase();
                if (!s) return false;
                const r = requiredSide.toLowerCase();

                // Map "ruling" to "government" and "treasury"
                if (r === 'ruling') {
                    return s.includes('ruling') || s.includes('government') || s.includes('treasury');
                }
                // Map "opposition"
                if (r === 'opposition') {
                    return s.includes('opposition');
                }

                return s.includes(r) || r.includes(s);
            });
        }

        data.forEach(d => {
            d.awardScore = items.reduce((sum, item) => {
                const cid = item.id || item;
                const weight = item.weight || 1.0;
                return sum + ((d.criteriaScores[cid] || 0) * weight);
            }, 0);
        });

        // Tie-breaking
        data.sort((a, b) => {
            // Main score
            if (b.awardScore !== a.awardScore) return b.awardScore - a.awardScore;

            // Rule 1: Primary Criterion (largest weight)
            if (items.length > 0) {
                const primaryItem = items.reduce((prev, current) => (prev.weight > current.weight) ? prev : current);
                const pCid = primaryItem.id || primaryItem;
                const scoreA = a.criteriaScores[pCid] || 0;
                const scoreB = b.criteriaScores[pCid] || 0;
                if (scoreB !== scoreA) return scoreB - scoreA;
            }

            // Rule 2: Overall Common Score
            return b.totalScore - a.totalScore;
        });
    } else {
        // Sort by specific criteria score
        data.sort((a, b) => {
            const scoreA = a.criteriaScores[filter] || 0;
            const scoreB = b.criteriaScores[filter] || 0;
            if (scoreB !== scoreA) return scoreB - scoreA;
            return b.totalScore - a.totalScore; // Tier 2 tie-break
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
        infoEl.innerHTML = `<strong>Overall Excellence:</strong> Based on the average of all 6 parliamentary metrics.`;
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
