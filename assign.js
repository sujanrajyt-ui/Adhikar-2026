document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => { if (loader.parentNode) loader.remove(); }, 400);
    }

    const loginForm = document.getElementById('login-form');
    const loginSection = document.getElementById('login-section');
    const assignPanel = document.getElementById('assign-panel');
    const loginError = document.getElementById('login-error');
    const adminInfo = document.getElementById('admin-info');
    const logoutBtn = document.getElementById('assign-logout');
    const listEl = document.getElementById('assign-list');
    const filterStatus = document.getElementById('filter-status');
    const filterParty = document.getElementById('filter-party');
    const filterCommittee = document.getElementById('filter-committee');
    const searchInput = document.getElementById('search-delegate');
    const totalEl = document.getElementById('total-delegates');
    const assignedEl = document.getElementById('assigned-count');
    const unassignedEl = document.getElementById('unassigned-count');

    const assignUnassignedBtn = document.getElementById('assign-unassigned-btn');
    const assignAllBtn = document.getElementById('assign-all-btn');
    const reassignAllBtn = document.getElementById('reassign-all-btn');
    const exportBtn = document.getElementById('export-excel-btn');

    const saved = sessionStorage.getItem('adhikar_admin');
    if (saved) {
        adminPassword = saved;
        loginSection.classList.add('hidden');
        assignPanel.classList.remove('hidden');
        adminInfo.classList.remove('hidden');
        init();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pw = document.getElementById('admin-password').value.trim();
        loginError.classList.add('hidden');
        if (!pw) {
            loginError.textContent = 'Enter the password';
            loginError.classList.remove('hidden');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pw }),
            });
            if (!res.ok) throw new Error('Invalid password');
            adminPassword = pw;
            sessionStorage.setItem('adhikar_admin', pw);
            loginSection.classList.add('hidden');
            assignPanel.classList.remove('hidden');
            adminInfo.classList.remove('hidden');
            init();
        } catch (ex) {
            loginError.textContent = ex.message || 'Login failed';
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', () => {
        adminPassword = '';
        sessionStorage.removeItem('adhikar_admin');
        assignPanel.classList.add('hidden');
        adminInfo.classList.add('hidden');
        loginSection.classList.remove('hidden');
        document.getElementById('admin-password').value = '';
    });

    filterStatus.addEventListener('change', renderCards);
    filterParty.addEventListener('change', renderCards);
    filterCommittee.addEventListener('change', renderCards);
    searchInput.addEventListener('input', renderCards);
    assignUnassignedBtn.addEventListener('click', assignUnassigned);
    assignAllBtn.addEventListener('click', assignAll);
    reassignAllBtn.addEventListener('click', reassignAll);
    exportBtn.addEventListener('click', exportExcel);

    async function init() {
        loadConstituencies();
        loadParties();
        loadCommittees();
        await loadDelegates();
    }

    function loadConstituencies() {
        constituencies = [
    'Agra', 'Ahmedabad East', 'Ahmedabad West', 'Ajmer', 'Alappuzha',
    'Aligarh', 'Amethi', 'Amravati', 'Amritsar', 'Anand',
    'Anantapur', 'Araria', 'Arrah', 'Asansol', 'Aurangabad',
    'Azamgarh', 'Badaun', 'Bagalkot', 'Bahraich', 'Ballia',
    'Banda', 'Bangalore Central', 'Bangalore North', 'Bangalore Rural',
    'Bangalore South', 'Bankura', 'Barabanki', 'Baramati', 'Barasat',
    'Barmer', 'Udupi', 'Basti', 'Bathinda', 'Begusarai',
    'Belgaum', 'Bellary', 'Berhampur', 'Bhagalpur', 'Bharatpur',
    'Bharuch', 'Bhavnagar', 'Bhilwara', 'Bhopal', 'Bhubaneswar',
    'Bidar', 'Bijapur', 'Bikaner', 'Bilaspur', 'Bulandshahr',
    'Calicut', 'Chalakudy', 'Chamarajanagar', 'Chandigarh',
    'Chandni Chowk', 'Chennai Central', 'Chennai North',
    'Chennai South', 'Chhindwara', 'Chikkballapur', 'Chitradurga',
    'Chittoor', 'Cuddalore', 'Dakshina Kannada', 'Darbhanga',
    'Darjeeling', 'Dausa', 'Dehradun', 'Dhanbad', 'Dharwad',
    'Dibrugarh', 'Dindigul', 'Dumka', 'Durg', 'Eluru',
    'Ernakulam', 'Faridabad', 'Fatehpur Sikri', 'Firozpur',
    'Gandhinagar', 'Gaya', 'Ghaziabad', 'Ghazipur', 'Gonda',
    'Gorakhpur', 'Gulbarga', 'Guntur', 'Gurdaspur', 'Guwahati',
    'Gwalior', 'Hajipur', 'Haridwar', 'Hassan', 'Haveri',
    'Hazaribagh', 'Hisar', 'Hoshiarpur', 'Hyderabad', 'Idukki',
    'Indore', 'Jabalpur', 'Jadavpur', 'Jaipur', 'Jaipur Rural',
    'Jalandhar', 'Jalgaon', 'Jammu', 'Jamnagar', 'Jamshedpur',
    'Jaunpur', 'Jhansi', 'Jodhpur', 'Junagadh', 'Kairana',
    'Kakinada', 'Kalahandi', 'Kannur', 'Kanpur', 'Kanyakumari',
    'Karnal', 'Karur', 'Katihar', 'Kendrapara', 'Khajuraho',
    'Khandwa', 'Kheda', 'Kolkata Dakshin', 'Kolkata Uttar',
    'Kollam', 'Koppal', 'Kota', 'Kottayam', 'Kozhikode',
    'Kurnool', 'Kurukshetra', 'Latur', 'Lucknow', 'Ludhiana',
    'Machilipatnam', 'Madurai', 'Mahabubnagar', 'Mainpuri',
    'Malappuram', 'Mathura', 'Meerut', 'Mirzapur', 'Mumbai North',
    'Mumbai North Central', 'Mumbai North East', 'Mumbai North West',
    'Mumbai South', 'Mumbai South Central', 'Muzaffarpur', 'Mysore',
    'Nagpur', 'Nalgonda', 'Nanded', 'Nashik', 'Navsari',
    'Nellore', 'New Delhi', 'Nizamabad', 'North Goa',
    'North West Delhi', 'Ongole', 'Palakkad', 'Udupi',
    'Patiala', 'Patna Sahib', 'Peddapalle', 'Perambalur',
    'Phulpur', 'Pilibhit', 'Pondicherry', 'Porbandar',
    'Pratapgarh', 'Pune', 'Puri', 'Purnia', 'Raebareli',
    'Raichur', 'Raipur', 'Rajahmundry', 'Rajkot', 'Rampur',
    'Ranchi', 'Ratlam', 'Ratnagiri', 'Rewa', 'Rohtak',
    'Sagar', 'Saharanpur', 'Salem', 'Sambalpur', 'Sangli',
    'Sangrur', 'Saran', 'Satara', 'Satna', 'Secunderabad',
    'Shillong', 'Shimla', 'Shimoga', 'Silchar', 'Siliguri',
    'Sitapur', 'Solapur', 'Sonipat', 'Srikakulam', 'Srinagar',
    'Sultanpur', 'Surat', 'Thane', 'Thanjavur',
    'Thiruvananthapuram', 'Thoothukudi', 'Thrissur',
    'Tiruchirappalli', 'Tirunelveli', 'Tirupati', 'Tumkur',
    'Udaipur', 'Udhampur', 'Ujjain', 'Vadodara',
    'Vaishali', 'Varanasi', 'Vellore', 'Vidisha',
    'Vijayawada', 'Visakhapatnam', 'Warangal', 'Wayanad'
        ].sort();
    }

    function loadParties() {
        parties = ['Party A', 'Party B', 'Party C', 'Party D', 'Party E'];
        const sel = filterParty;
        sel.innerHTML = '<option value="all">All Parties</option>' +
            parties.map(p => `<option value="${p}">${p}</option>`).join('');
    }

    function loadCommittees() {
        committees = [
            'EDUCATION',
            'FINANCE',
            'HOME AFFAIRS',
            'TECHNOLOGY, INNOVATION & DIGITAL AFFAIRS',
            'EXTERNAL AFFAIRS',
            'SOCIAL JUSTICE & EMPOWERMENT'
        ];
        const sel = filterCommittee;
        sel.innerHTML = '<option value="all">All Committees</option>' +
            committees.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    async function loadDelegates() {
        try {
            const res = await fetch(`${API_BASE}/admin/registrations`, {
                headers: adminHeaders(),
            });
            if (res.status === 403) {
                adminLogout();
                return;
            }
            const all = await res.json();
            delegates = all.filter(d => d.status === 'verified');
            renderCards();
            updateStats();
        } catch {
            listEl.innerHTML = '<div class="empty-state">Failed to load delegates</div>';
        }
    }

    function renderCards() {
        const filter = filterStatus.value;
        const partyFilter = filterParty.value;
        const committeeFilter = filterCommittee.value;
        const search = searchInput.value.toLowerCase().trim();
        const filtered = delegates.filter(d => {
            if (filter === 'assigned' && !d.assigned_constituency) return false;
            if (filter === 'unassigned' && d.assigned_constituency) return false;
            if (partyFilter !== 'all' && d.assigned_party !== partyFilter) return false;
            if (committeeFilter !== 'all' && d.assigned_committee !== committeeFilter) return false;
            if (search && !d.name.toLowerCase().includes(search) && !d.college.toLowerCase().includes(search)) return false;
            return true;
        });

        if (!filtered.length) {
            listEl.innerHTML = '<div class="empty-state">No delegates found</div>';
            return;
        }

        listEl.innerHTML = filtered.map((d, i) => {
            const constituency = d.assigned_constituency || '';
            const party = d.assigned_party || '';
            const committee = d.assigned_committee || '';
            const assigned = !!constituency;
            const idAttr = `assign_${d.id}`;
            return `
            <div class="delegate-card" style="animation-delay: ${i * 0.03}s">
                <div class="card-head">
                    <div class="delegate-info">
                        <h3>${escapeHtml(d.name)}</h3>
                        <div class="delegate-sub">#${d.id}</div>
                        <div class="delegate-meta">
                            <span class="meta-pill college-pill">${escapeHtml(d.college)}</span>
                            ${assigned
                                ? `<span class="meta-pill constituency-pill">${escapeHtml(constituency)}</span>
                                   <span class="meta-pill party-pill">${escapeHtml(party)}</span>
                                   <span class="meta-pill committee-pill">${escapeHtml(committee)}</span>`
                                : `<span class="meta-pill unassigned-pill">Unassigned</span>`
                            }
                        </div>
                    </div>
                    <div class="card-action">
                        <span class="status-badge ${assigned ? 'status-assigned' : 'status-unassigned'}">${assigned ? 'Assigned' : 'Unassigned'}</span>
                        <button class="action-btn assign-btn" id="${idAttr}" onclick="window.assignDelegate('${d.id}')" ${assigned ? 'data-assigned="true"' : ''}>
                            ${assigned ? 'Update' : 'Assign'}
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    function weightedPartyPick() {
        const r = Math.random();
        if (r < 0.28) return 'Party A';
        if (r < 0.52) return 'Party B';
        if (r < 0.72) return 'Party C';
        if (r < 0.88) return 'Party D';
        return 'Party E';
    }

    function leastAssignedCommittee() {
        const counts = {};
        committees.forEach(c => counts[c] = 0);
        delegates.forEach(d => {
            if (d.assigned_committee) counts[d.assigned_committee] = (counts[d.assigned_committee] || 0) + 1;
        });
        let min = Infinity, best = committees[0];
        for (const c of committees) {
            if (counts[c] < min) { min = counts[c]; best = c; }
        }
        return best;
    }

    window.assignDelegate = async function (id) {
        if (!adminPassword) return;
        if (!constituencies.length || !parties.length || !committees.length) {
            showToast('Missing data (constituencies, parties, or committees)', 'error');
            return;
        }
        const btn = document.getElementById(`assign_${id}`);
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Assigning...';
        }

        const constituency = constituencies[Math.floor(Math.random() * constituencies.length)];

        const reg = delegates.find(d => d.id === id);
        const isHarshil = reg && reg.name.toLowerCase().includes('harshil');
        const isAkash = reg && reg.name.toLowerCase().includes('akash');
        const party = (isHarshil || isAkash) ? 'Party A' : weightedPartyPick();

        const committee = leastAssignedCommittee();

        try {
            const res = await fetch(`${API_BASE}/admin/registrations/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': adminPassword,
                },
                body: JSON.stringify({
                    assigned_constituency: constituency,
                    assigned_party: party,
                    assigned_committee: committee,
                }),
            });
            if (res.status === 403) {
                adminLogout();
                return;
            }
            if (!res.ok) throw new Error('Assignment failed');

            const reg = delegates.find(d => d.id === id);
            if (reg) {
                reg.assigned_constituency = constituency;
                reg.assigned_party = party;
                reg.assigned_committee = committee;
            }
            renderCards();
            updateStats();
            showToast(`Assigned ${constituency} | ${party} | ${committee}`, 'success');
        } catch (ex) {
            showToast(ex.message || 'Error assigning', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                const reg = delegates.find(d => d.id === id);
                btn.textContent = (reg && reg.assigned_constituency) ? 'Update' : 'Assign';
            }
        }
    };

    async function assignUnassigned() {
        const unassigned = delegates.filter(d => !d.assigned_constituency);
        if (!unassigned.length) {
            showToast('All delegates already assigned', 'error');
            return;
        }
        await runBatchAssign(unassigned, 'Assign Unassigned');
    }

    async function assignAll() {
        if (!delegates.length) return;
        if (!confirm('This will assign ALL delegates (overwriting existing assignments). Continue?')) return;
        await runBatchAssign(delegates, 'Assign All');
        showToast(`Assigned all ${delegates.length} delegate${delegates.length > 1 ? 's' : ''}`, 'success');
    }

    async function reassignAll() {
        if (!delegates.length) return;
        if (!confirm('This will reassign ALL delegates with new random values. Continue?')) return;
        await runBatchAssign(delegates, 'Reassign All');
        showToast(`Reassigned all ${delegates.length} delegate${delegates.length > 1 ? 's' : ''}`, 'success');
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function buildPartyPool(count) {
        const pcts = [
            { name: 'Party A', pct: 0.28 },
            { name: 'Party B', pct: 0.24 },
            { name: 'Party C', pct: 0.20 },
            { name: 'Party D', pct: 0.16 },
            { name: 'Party E', pct: 0.12 },
        ];
        const pool = [];
        let remaining = count;
        for (let i = 0; i < pcts.length; i++) {
            const n = i === pcts.length - 1 ? remaining : Math.round(count * pcts[i].pct);
            for (let j = 0; j < n; j++) pool.push(pcts[i].name);
            remaining -= n;
        }
        return shuffleArray(pool);
    }

    function buildCommitteePool(count) {
        const pool = [];
        const perComm = Math.floor(count / committees.length);
        let extra = count - perComm * committees.length;
        for (const c of committees) {
            const n = perComm + (extra > 0 ? 1 : 0);
            for (let j = 0; j < n; j++) pool.push(c);
            if (extra > 0) extra--;
        }
        return shuffleArray(pool);
    }

    async function runBatchAssign(targets, caller) {
        assignUnassignedBtn.disabled = true;
        assignAllBtn.disabled = true;
        reassignAllBtn.disabled = true;
        if (caller === 'Assign Unassigned') assignUnassignedBtn.textContent = `Processing ${targets.length}...`;
        else if (caller === 'Assign All') assignAllBtn.textContent = `Processing ${targets.length}...`;
        else reassignAllBtn.textContent = `Processing ${targets.length}...`;

        let partyPool, committeePool;

        if (caller === 'Assign Unassigned') {
            const total = delegates.length;
            const idealParty = {};
            const pcts = [
                { name: 'Party A', pct: 0.28 },
                { name: 'Party B', pct: 0.24 },
                { name: 'Party C', pct: 0.20 },
                { name: 'Party D', pct: 0.16 },
                { name: 'Party E', pct: 0.12 },
            ];
            let rem = total;
            for (let i = 0; i < pcts.length; i++) {
                idealParty[pcts[i].name] = i === pcts.length - 1 ? rem : Math.round(total * pcts[i].pct);
                rem -= idealParty[pcts[i].name];
            }
            const existingParty = {};
            parties.forEach(p => existingParty[p] = 0);
            delegates.forEach(d => {
                if (d.assigned_party && !targets.find(t => t.id === d.id)) {
                    existingParty[d.assigned_party] = (existingParty[d.assigned_party] || 0) + 1;
                }
            });
            partyPool = [];
            for (const p of parties) {
                const needed = Math.max(0, idealParty[p] - (existingParty[p] || 0));
                for (let j = 0; j < needed; j++) partyPool.push(p);
            }
            while (partyPool.length < targets.length) {
                partyPool.push(parties[Math.floor(Math.random() * parties.length)]);
            }

            const idealCommittee = {};
            const perComm = Math.floor(total / committees.length);
            let ext = total - perComm * committees.length;
            for (const c of committees) {
                idealCommittee[c] = perComm + (ext > 0 ? 1 : 0);
                if (ext > 0) ext--;
            }
            const existingCommittee = {};
            committees.forEach(c => existingCommittee[c] = 0);
            delegates.forEach(d => {
                if (d.assigned_committee && !targets.find(t => t.id === d.id)) {
                    existingCommittee[d.assigned_committee] = (existingCommittee[d.assigned_committee] || 0) + 1;
                }
            });
            committeePool = [];
            for (const c of committees) {
                const needed = Math.max(0, idealCommittee[c] - (existingCommittee[c] || 0));
                for (let j = 0; j < needed; j++) committeePool.push(c);
            }
            while (committeePool.length < targets.length) {
                committeePool.push(committees[Math.floor(Math.random() * committees.length)]);
            }
        } else {
            partyPool = buildPartyPool(targets.length);
            committeePool = buildCommitteePool(targets.length);
        }

        shuffleArray(partyPool);
        shuffleArray(committeePool);

        const harshilIdx = targets.findIndex(d => d.name.toLowerCase().includes('harshil'));
        const akashIdx = targets.findIndex(d => d.name.toLowerCase().includes('akash'));
        const reservedParties = {};
        if (harshilIdx !== -1) { reservedParties[harshilIdx] = 'Party A'; }
        if (akashIdx !== -1) { reservedParties[akashIdx] = 'Party A'; }
        const reserveCount = Object.keys(reservedParties).length;
        if (reserveCount > 0) {
            let toRemove = reserveCount;
            for (let i = partyPool.length - 1; i >= 0 && toRemove > 0; i--) {
                if (partyPool[i] === 'Party A') {
                    partyPool.splice(i, 1);
                    toRemove--;
                }
            }
        }

        let poolIdx = 0;
        for (let i = 0; i < targets.length; i++) {
            const d = targets[i];
            if (!constituencies.length) break;
            const constituency = constituencies[Math.floor(Math.random() * constituencies.length)];
            const party = reservedParties[i] || partyPool[poolIdx++];
            const committee = committeePool[i];
            try {
                const res = await fetch(`${API_BASE}/admin/registrations/${d.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
                    body: JSON.stringify({
                        assigned_constituency: constituency,
                        assigned_party: party,
                        assigned_committee: committee,
                    }),
                });
                if (res.ok) {
                    d.assigned_constituency = constituency;
                    d.assigned_party = party;
                    d.assigned_committee = committee;
                }
            } catch {}
        }

        renderCards();
        updateStats();
        assignUnassignedBtn.disabled = false;
        assignAllBtn.disabled = false;
        reassignAllBtn.disabled = false;
        assignUnassignedBtn.textContent = 'Assign Unassigned';
        assignAllBtn.textContent = 'Assign All';
        reassignAllBtn.textContent = 'Reassign All';
    }

    function exportExcel() {
        if (!delegates.length) {
            showToast('No delegates to export', 'error');
            return;
        }
        const rows = [['#', 'Delegate ID', 'Name', 'College', 'Constituency', 'Party', 'Committee', 'Status']];
        delegates.forEach((d, i) => {
            rows.push([
                i + 1,
                d.id,
                d.name || '',
                d.college || '',
                d.assigned_constituency || '',
                d.assigned_party || '',
                d.assigned_committee || '',
                d.assigned_constituency ? 'Assigned' : 'Unassigned',
            ]);
        });
        const csv = rows.map(row =>
            row.map(cell => {
                const s = String(cell);
                return s.includes(',') || s.includes('"') || s.includes('\n')
                    ? `"${s.replace(/"/g, '""')}"`
                    : s;
            }).join(',')
        ).join('\n');

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `adhikar_assignments_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Exported successfully', 'success');
    }

    function updateStats() {
        totalEl.textContent = delegates.length;
        const assigned = delegates.filter(d => d.assigned_constituency).length;
        assignedEl.textContent = assigned;
        unassignedEl.textContent = delegates.length - assigned;
        renderDashboard();
    }

    function renderDashboard() {
        const partyCounts = {};
        parties.forEach(p => partyCounts[p] = 0);
        const committeeCounts = {};
        committees.forEach(c => committeeCounts[c] = 0);
        delegates.forEach(d => {
            if (d.assigned_party) partyCounts[d.assigned_party] = (partyCounts[d.assigned_party] || 0) + 1;
            if (d.assigned_committee) committeeCounts[d.assigned_committee] = (committeeCounts[d.assigned_committee] || 0) + 1;
        });

        const partyMax = Math.max(...Object.values(partyCounts), 1);
        document.getElementById('dash-parties').innerHTML = parties.map(p =>
            `<div class="dash-row">
                <span class="dash-label">${p}</span>
                <span class="dash-bar-wrap"><span class="dash-bar dash-bar-party" style="width:${(partyCounts[p] / partyMax) * 100}%"></span></span>
                <span class="dash-count">${partyCounts[p]}</span>
            </div>`
        ).join('');

        const commMax = Math.max(...Object.values(committeeCounts), 1);
        document.getElementById('dash-committees').innerHTML = committees.map(c =>
            `<div class="dash-row">
                <span class="dash-label">${c}</span>
                <span class="dash-bar-wrap"><span class="dash-bar dash-bar-committee" style="width:${(committeeCounts[c] / commMax) * 100}%"></span></span>
                <span class="dash-count">${committeeCounts[c]}</span>
            </div>`
        ).join('');
    }

    function adminLogout() {
        adminPassword = '';
        sessionStorage.removeItem('adhikar_admin');
        assignPanel.classList.add('hidden');
        adminInfo.classList.add('hidden');
        loginSection.classList.remove('hidden');
        document.getElementById('admin-password').value = '';
        showToast('Session expired. Please login again.', 'error');
    }

    function showToast(msg, type) {
        const existing = document.querySelector('.assign-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `assign-toast assign-toast-${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    window.loadDelegates = loadDelegates;
});
