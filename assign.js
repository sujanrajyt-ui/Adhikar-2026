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
            'Agra', 'Ahmedabad East', 'Ahmedabad West', 'Ajmer', 'Akola', 'Alappuzha', 'Aligarh',
            'Allahabad', 'Almora', 'Alwar', 'Ambedkar Nagar', 'Amravati', 'Amreli', 'Amritsar',
            'Anand', 'Anantapur', 'Anantnag', 'Angul', 'Araria', 'Aravakkurichi', 'Ariyalur',
            'Arrah', 'Asansol', 'Aurangabad', 'Azamgarh',
            'Badaun', 'Bagalkot', 'Bahadurgarh', 'Bahraich', 'Baldota', 'Ballia', 'Balurghat',
            'Banda', 'Bangalore Central', 'Bangalore North', 'Bangalore Rural', 'Bangalore South',
            'Bankura', 'Banswara', 'Barabanki', 'Baramati', 'Barasat', 'Bardhaman', 'Bardhaman Purba',
            'Barmer', 'Barnala', 'Barrackpore', 'Basti', 'Bathinda', 'Begusarai', 'Belgaum',
            'Bellary', 'Berhampur', 'Bettiah', 'Bhagalpur', 'Bharatpur', 'Bharuch', 'Bhavnagar',
            'Bhilwara', 'Bhiwani', 'Bhojpur', 'Bhopal', 'Bhubaneswar', 'Bhuj', 'Bidar', 'Bijapur',
            'Bikaner', 'Bilaspur', 'Bokaro', 'Bulandshahr', 'Burdwan',
            'Calicut', 'Chalakudy', 'Chamarajanagar', 'Chandigarh', 'Chandni Chowk', 'Chatra',
            'Chennai Central', 'Chennai North', 'Chennai South', 'Chhindwara', 'Chikkballapur',
            'Chitradurga', 'Chittoor', 'Chittorgarh', 'Cuddalore',
            'Dadra and Nagar Haveli', 'Dahod', 'Dakshina Kannada', 'Darbhanga', 'Darjeeling',
            'Dausa', 'Dehradun', 'Delhi Sadar', 'Dhanbad', 'Dharamshala', 'Dharwad', 'Dhule',
            'Dibrugarh', 'Dindigul', 'Dindori', 'Dumka', 'Durg', 'Durgapur',
            'Eluru', 'Ernakulam',
            'Faridabad', 'Farrukhabad', 'Fatehpur', 'Fatehpur Sikri', 'Firozabad', 'Firozpur',
            'Gandhinagar', 'Ganganagar', 'Gaya', 'Ghaziabad', 'Ghazipur', 'Giridih', 'Godda',
            'Gonda', 'Gorakhpur', 'Gulbarga', 'Guna', 'Guntur', 'Gurdaspur', 'Guwahati',
            'Gwalior', 'Hajipur', 'Haldwani', 'Hardoi', 'Haridwar', 'Hassan', 'Hathras',
            'Haveri', 'Hazaribagh', 'Hissar', 'Hooghly', 'Hoshiarpur', 'Hyderabad',
            'Idukki', 'Indore', 'Jabalpur', 'Jadavpur', 'Jaipur', 'Jaipur Rural', 'Jalandhar',
            'Jalaun', 'Jalgaon', 'Jalna', 'Jalore', 'Jalpaiguri', 'Jammu', 'Jamnagar',
            'Jamshedpur', 'Jaunpur', 'Jehanabad', 'Jhansi', 'Jhargram', 'Jhunjhunu', 'Jodhpur',
            'Junagadh', 'Kachchh', 'Kairana', 'Kaiserganj', 'Kakinada', 'Kalahandi', 'Kannauj',
            'Kannur', 'Kanpur', 'Kanyakumari', 'Kapurthala', 'Karaikal', 'Karauli', 'Kargil',
            'Karnal', 'Karur', 'Kasaragod', 'Kathua', 'Katihar', 'Kendrapara', 'Keonjhar',
            'Khadoor Sahib', 'Khajuraho', 'Khandwa', 'Khargone', 'Kheda', 'Kheri', 'Kolkata Dakshin',
            'Kolkata Uttar', 'Kollam', 'Koppal', 'Kota', 'Kottayam', 'Kozhikode', 'Kullu',
            'Kumbakonam', 'Kurnool', 'Kurukshetra', 'Ladakh', 'Lakhimpur', 'Lalganj', 'Latur',
            'Leh', 'Lucknow', 'Ludhiana', 'Machilipatnam', 'Madha', 'Madhubani', 'Madurai',
            'Mahabubabad', 'Mahabubnagar', 'Maharajganj', 'Mahesana', 'Mahoba', 'Mainpuri',
            'Malappuram', 'Maldah Dakshin', 'Maldah Uttar', 'Mathura', 'Mavelikkara', 'Mayiladuthurai',
            'Medak', 'Meerut', 'Mira Bhayandar', 'Mirzapur', 'Mohanlalganj', 'Monghyr', 'Mumbai North',
            'Mumbai North Central', 'Mumbai North East', 'Mumbai North West', 'Mumbai South',
            'Mumbai South Central', 'Murshidabad', 'Muzaffarnagar', 'Muzaffarpur', 'Mysore',
            'Nabadwip', 'Nagaland', 'Nagarkurnool', 'Nagpur', 'Nainital', 'Nalgonda', 'Nanded',
            'Nandyal', 'Narsapuram', 'Nashik', 'Natham', 'Navsari', 'Nawada', 'Nellore',
            'New Delhi', 'Nizamabad', 'North Goa', 'North West Delhi', 'Ongole', 'Osmanabad',
            'Palakkad', 'Palali', 'Palamau', 'Pali', 'Palladam', 'Panchmahal', 'Panihati',
            'Pannipat', 'Parbhani', 'Patan', 'Pathanamthitta', 'Patiala', 'Patna', 'Patna Sahib',
            'Pattukkottai', 'Pawayan', 'Peddapalle', 'Perambalur', 'Phulpur', 'Pilibhit', 'Pondicherry',
            'Porbandar', 'Pratapgarh', 'Pulwama', 'Pune', 'Purba Medinipur', 'Puri', 'Purnia',
            'Purulia', 'Raebareli', 'Raichur', 'Raigarh', 'Raipur', 'Rajahmundry', 'Rajkot',
            'Rajmahal', 'Rajnandgaon', 'Rajouri', 'Ramanathapuram', 'Ramgarh', 'Rampur',
            'Ranaghat', 'Ranchi', 'Ranikhet', 'Ratlam', 'Ratnagiri', 'Raver', 'Rewa', 'Rewari',
            'Rohtak', 'Rohtas', 'Ropar', 'Sabar Kantha', 'Sagar', 'Saharanpur', 'Salem',
            'Samastipur', 'Sambhal', 'Sambalpur', 'Sangli', 'Sangrur', 'Sant Kabir Nagar',
            'Saran', 'Sasaram', 'Satara', 'Satna', 'Sawai Madhopur', 'Secunderabad', 'Sehore',
            'Sheohar', 'Shillong', 'Shimla', 'Shimoga', 'Shirur', 'Shivaji Nagar', 'Shrawasti',
            'Sikar', 'Silchar', 'Siliguri', 'Sindhudurg', 'Singrauli', 'Sironj', 'Sitapur',
            'Siwan', 'Solapur', 'Sonipat', 'South Goa', 'South Mumbai', 'Srikakulam', 'Srinagar',
            'Sultanpur', 'Sultanpur Lodhi', 'Supaul', 'Surat', 'Surendranagar', 'Suryapet',
            'Tamluk', 'Tankara', 'Tapi', 'Tarn Taran', 'Tavistock', 'Tehri Garhwal', 'Tenkasi',
            'Thane', 'Thanjavur', 'Thiruvananthapuram', 'Thoothukudi', 'Thrissur', 'Tikamgarh',
            'Tiruchirappalli', 'Tirunelveli', 'Tirupati', 'Tirur', 'Tiruvallur', 'Tiruvannamalai',
            'Tonk', 'Tumkur', 'Tura', 'Udaipur', 'Udhampur', 'Udupi', 'Ujjain', 'Uluberia',
            'Unnao', 'Uttara Kannada', 'Uttarpara', 'Vadakara', 'Vadodara', 'Vaishali',
            'Valmiki Nagar', 'Valsad', 'Varanasi', 'Vellore', 'Vidisha', 'Vijayawada',
            'Viluppuram', 'Virudhunagar', 'Visakhapatnam', 'Wardha', 'Warangal', 'Wayanad',
            'West Delhi', 'Yadgir', 'Yavatmal'
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
                        ${assigned ? 'Re-assign' : 'Assign Constituency'}
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
                button.textContent = (reg && reg.assigned_constituency) ? 'Re-assign' : 'Assign Constituency';
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
        assignAllBtn.textContent = 'Assign All Unassigned';
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
