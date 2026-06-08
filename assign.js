document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginSection = document.getElementById('login-section');
    const assignPanel = document.getElementById('assign-panel');
    const loginError = document.getElementById('login-error');
    const adminInfo = document.getElementById('admin-info');
    const logoutBtn = document.getElementById('assign-logout');
    const tbody = document.getElementById('assign-tbody');
    const filterStatus = document.getElementById('filter-status');
    const searchInput = document.getElementById('search-delegate');
    const totalEl = document.getElementById('total-delegates');
    const assignedEl = document.getElementById('assigned-count');
    const unassignedEl = document.getElementById('unassigned-count');

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

    filterStatus.addEventListener('change', renderTable);
    searchInput.addEventListener('input', renderTable);

    async function init() {
        await loadParties();
        await loadDelegates();
    }

    async function loadParties() {
        try {
            const data = await fetch(`${API_BASE}/parties`).then(r => r.json());
            parties = data.filter(p => p.type === 'party');
            committees = data.filter(p => p.type === 'committee');
            if (committees.length === 0) {
                committees = [{ id: 'loksabha', name: 'Lok Sabha', type: 'committee' }];
            }
        } catch {
            parties = [];
            committees = [{ id: 'loksabha', name: 'Lok Sabha', type: 'committee' }];
        }
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
            delegates = await res.json();
            renderTable();
            updateStats();
        } catch {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Failed to load delegates</td></tr>';
        }
    }

    function renderTable() {
        const filter = filterStatus.value;
        const search = searchInput.value.toLowerCase().trim();
        const filtered = delegates.filter(d => {
            if (filter === 'assigned' && !d.assigned_party) return false;
            if (filter === 'unassigned' && d.assigned_party) return false;
            if (search && !d.name.toLowerCase().includes(search) && !d.college.toLowerCase().includes(search)) return false;
            return true;
        });

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No delegates found</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map((d, i) => {
            const assigned = !!(d.assigned_party && d.assigned_committee);
            return `<tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHtml(d.name)}</strong><br><span class="delegate-id">${d.id}</span></td>
                <td>${escapeHtml(d.college)}</td>
                <td>${assigned ? escapeHtml(d.assigned_party) : '<span class="unassigned-badge">—</span>'}</td>
                <td>${assigned ? escapeHtml(d.assigned_committee) : '<span class="unassigned-badge">—</span>'}</td>
                <td>${assigned
                    ? '<span class="status-badge status-assigned">Assigned</span>'
                    : '<span class="status-badge status-unassigned">Unassigned</span>'
                }</td>
                <td>
                    <button class="action-btn assign-btn" onclick="window.assignConstituency('${d.id}')" ${assigned ? 'data-assigned="true"' : ''}>
                        ${assigned ? 'Re-assign' : 'Assign Constituency'}
                    </button>
                </td>
            </tr>`;
        }).join('');

        updateStats();
    }

    window.assignConstituency = async function (id) {
        if (!adminPassword) return;
        if (!parties.length || !committees.length) {
            showToast('No parties or committees available', 'error');
            return;
        }
        const button = document.querySelector(`button[onclick="window.assignConstituency('${id}')"]`);
        if (button) {
            button.disabled = true;
            button.textContent = 'Assigning...';
        }

        const party = parties[Math.floor(Math.random() * parties.length)];
        const committee = committees[Math.floor(Math.random() * committees.length)];

        try {
            const res = await fetch(`${API_BASE}/admin/registrations/${id}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': adminPassword,
                },
                body: JSON.stringify({
                    assigned_party: party.name,
                    assigned_committee: committee.name,
                }),
            });
            if (res.status === 403) {
                adminLogout();
                return;
            }
            if (!res.ok) throw new Error('Assignment failed');

            const reg = delegates.find(d => d.id === id);
            if (reg) {
                reg.assigned_party = party.name;
                reg.assigned_committee = committee.name;
            }
            renderTable();
            showToast(`Assigned ${party.name} / ${committee.name}`, 'success');
        } catch (ex) {
            showToast(ex.message || 'Error assigning constituency', 'error');
        } finally {
            if (button) {
                button.disabled = false;
                const assigned = delegates.find(d => d.id === id);
                button.textContent = (assigned && assigned.assigned_party) ? 'Re-assign' : 'Assign Constituency';
            }
        }
    };

    function updateStats() {
        totalEl.textContent = delegates.length;
        const assigned = delegates.filter(d => d.assigned_party && d.assigned_committee).length;
        assignedEl.textContent = assigned;
        unassignedEl.textContent = delegates.length - assigned;
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

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
