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
    const tbody = document.getElementById('assign-tbody');
    const filterStatus = document.getElementById('filter-status');
    const searchInput = document.getElementById('search-delegate');
    const totalEl = document.getElementById('total-delegates');
    const assignedEl = document.getElementById('assigned-count');
    const unassignedEl = document.getElementById('unassigned-count');

    const assignAllBtn = document.getElementById('assign-all-btn');

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

    assignAllBtn.addEventListener('click', assignAllUnassigned);

    async function init() {
        await loadConstituencies();
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
    'Barmer', 'Barrackpore', 'Basti', 'Bathinda', 'Begusarai',
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
    'North West Delhi', 'Ongole', 'Palakkad', 'Pathanamthitta',
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
    'Udaipur', 'Udhampur', 'Udupi', 'Ujjain', 'Vadodara',
    'Vaishali', 'Varanasi', 'Vellore', 'Vidisha',
    'Vijayawada', 'Visakhapatnam', 'Warangal', 'Wayanad'

        ].sort();
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
            renderTable();
            updateStats();
        } catch {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Failed to load delegates</td></tr>';
        }
    }

    function renderTable() {
        const filter = filterStatus.value;
        const search = searchInput.value.toLowerCase().trim();
        const filtered = delegates.filter(d => {
            if (filter === 'assigned' && !d.assigned_constituency) return false;
            if (filter === 'unassigned' && d.assigned_constituency) return false;
            if (search && !d.name.toLowerCase().includes(search) && !d.college.toLowerCase().includes(search)) return false;
            return true;
        });

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No delegates found</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map((d, i) => {
            const constituency = d.assigned_constituency || '';
            const assigned = !!constituency;
            return `<tr>
                <td style="color:rgba(255,255,255,0.25); font-size:0.78rem;">${i + 1}</td>
                <td>
                    <div class="delegate-name">${escapeHtml(d.name)}</div>
                    <div class="delegate-id">${d.id}</div>
                </td>
                <td><span class="college-cell">${escapeHtml(d.college)}</span></td>
                <td>${assigned ? `<span class="constituency-name">${escapeHtml(constituency)}</span>` : '<span class="constituency-empty">—</span>'}</td>
                <td>${assigned
                    ? '<span class="status-badge status-assigned">Assigned</span>'
                    : '<span class="status-badge status-unassigned">Unassigned</span>'
                }</td>
                <td>
                    <button class="action-btn assign-btn" onclick="window.assignConstituency('${d.id}')" ${assigned ? 'data-assigned="true"' : ''}>
                        ${assigned ? 'Update' : 'Assign'}
                    </button>
                </td>
            </tr>`;
        }).join('');

        updateStats();
    }

    window.assignConstituency = async function (id) {
        if (!adminPassword) return;
        if (!constituencies.length) {
            showToast('No constituencies available', 'error');
            return;
        }
        const button = document.querySelector(`button[onclick="window.assignConstituency('${id}')"]`);
        if (button) {
            button.disabled = true;
            button.textContent = 'Assigning...';
        }

        const constituency = constituencies[Math.floor(Math.random() * constituencies.length)];

        try {
            const res = await fetch(`${API_BASE}/admin/registrations/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': adminPassword,
                },
                body: JSON.stringify({
                    assigned_constituency: constituency,
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
            }
            renderTable();
            showToast(`Assigned ${constituency}`, 'success');
        } catch (ex) {
            showToast(ex.message || 'Error assigning constituency', 'error');
        } finally {
            if (button) {
                button.disabled = false;
                const reg = delegates.find(d => d.id === id);
                button.textContent = (reg && reg.assigned_constituency) ? 'Update' : 'Assign';
            }
        }
    };

    async function assignAllUnassigned() {
        const unassigned = delegates.filter(d => !d.assigned_constituency);
        if (!unassigned.length) {
            showToast('All delegates already assigned', 'error');
            return;
        }
        assignAllBtn.disabled = true;
        assignAllBtn.textContent = `Assigning ${unassigned.length}...`;
        let success = 0;
        for (const d of unassigned) {
            if (!constituencies.length) break;
            const constituency = constituencies[Math.floor(Math.random() * constituencies.length)];
            try {
                const res = await fetch(`${API_BASE}/admin/registrations/${d.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
                    body: JSON.stringify({ assigned_constituency: constituency }),
                });
                if (res.ok) {
                    d.assigned_constituency = constituency;
                    success++;
                }
            } catch {}
        }
        renderTable();
        assignAllBtn.disabled = false;
        assignAllBtn.textContent = 'Assign All';
        showToast(`Assigned ${success} delegate${success > 1 ? 's' : ''}`, 'success');
    }

    function updateStats() {
        totalEl.textContent = delegates.length;
        const assigned = delegates.filter(d => d.assigned_constituency).length;
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
