require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database file
db.init();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from parent directory (root directory)
app.use(express.static(path.join(__dirname, '..')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ============ Helper Functions ============ */

// Generate SHA-512 hash of UroPay Secret
function getHashedSecret() {
  const secret = process.env.UROPAY_API_SECRET || '';
  return crypto.createHash('sha512').update(secret).digest('hex');
}

// Generate Auth headers for UroPay API
function getUroPayHeaders() {
  const apiKey = process.env.UROPAY_API_KEY || '';
  const hashedSecret = getHashedSecret();
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-KEY': apiKey,
    'Authorization': `Bearer ${hashedSecret}`
  };
}

/* ============ Client Side APIs ============ */

// 1. Submit Registration Form
app.post('/api/registrations', async (req, res) => {
  // Registrations are closed
  return res.status(403).json({ detail: "Registrations are now closed. Thank you for your interest!" });

  const { name, email, phone, parent_name, parent_phone, year, college, role_preference, notes } = req.body;
  console.log("[API] Registration request received:", { name, email, phone, parent_name, parent_phone });

  // Basic validation
  if (!name || !email || !phone || !year || !college) {
    console.error("[API] Registration failed: Missing required fields", { name, email, phone, year, college });
    return res.status(400).json({ detail: "Missing required registration details" });
  }

  // Create temporary local registration first
  const reg = await db.create({
    name,
    email,
    phone,
    parent_name,
    parent_phone,
    year,
    college,
    role_preference,
    notes
  });

  const uropayApiKey = process.env.UROPAY_API_KEY || '';
  const uropaySecret = process.env.UROPAY_API_SECRET || '';

  // Graceful Fallback check: if no credentials, bypass UroPay API
  if (!uropayApiKey || uropayApiKey === 'YOUR_API_KEY_HERE' || !uropaySecret || uropaySecret === 'YOUR_UROPAY_SECRET_HERE') {
    console.log(`[Graceful Fallback] No UroPay credentials configured. Serving static manual payment flow for Registration: ${reg.id}`);
    return res.json({
      ...reg,
      useFallback: true,
      upiString: `upi://pay?pa=9980964089@cnrb&pn=ADHIKAR'26&am=599.00&cu=INR&tn=Adhikar26 Registration ${reg.id.slice(0, 8)}`,
      qrCodeUrl: 'assets/fallback_qr.jpeg'
    });
  }

  try {
    console.log(`[UroPay] Generating payment order for Registration ID: ${reg.id}`);

    // Call UroPay Generate Order API
    const response = await fetch('https://api.uropay.me/order/generate', {
      method: 'POST',
      headers: getUroPayHeaders(),
      body: JSON.stringify({
        amount: 65000, // 650 INR in paise
        merchantOrderId: reg.id,
        customerName: reg.name,
        customerEmail: reg.email,
        vpa: process.env.RECEIVING_VPA || undefined,
        vpaName: "ADHIKAR'26"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`UroPay generation returned status ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.status === 'success' && result.data) {
      // Save the returned UroPay Order ID locally
      db.update(reg.id, { uropay_order_id: result.data.uroPayOrderId });

      console.log(`[UroPay] Order created successfully: ${result.data.uroPayOrderId}`);

      return res.json({
        ...reg,
        uropay_order_id: result.data.uroPayOrderId,
        upiString: result.data.upiString,
        qrCodeBase64: result.data.qrCode, // base64 encoded image
        useFallback: false
      });
    } else {
      throw new Error(result.message || "Failed to generate payment order in UroPay response");
    }
  } catch (err) {
    console.error("[Graceful Fallback Alert] UroPay Order Generation failed:", err.message);
    // Graceful fallback to static payment details so the user registration never fails
    return res.json({
      ...reg,
      useFallback: true,
      upiString: `upi://pay?pa=9980964089@cnrb&pn=ADHIKAR'26&am=650.00&cu=INR&tn=Adhikar26 Registration ${reg.id.slice(0, 8)}`,
      qrCodeUrl: 'assets/fallback_qr.jpeg'
    });
  }
});

// 2. Submit UPI Transaction ID (UTR / Reference Number)
app.post('/api/registrations/:id/submit-utr', async (req, res) => {
  const { id } = req.params;
  const { utr } = req.body;

  if (!utr || !/^\d{12}$/.test(utr)) {
    return res.status(400).json({ detail: "UTR must be a 12-digit reference number" });
  }

  const reg = await db.getById(id);
  if (!reg) {
    return res.status(404).json({ detail: "Registration not found" });
  }

  // Update local database status
  await db.update(id, {
    status: 'payment_claimed',
    utr: utr
  });

  // If we generated an order through UroPay, submit the UTR to UroPay's system too
  if (reg.uropay_order_id) {
    try {
      console.log(`[UroPay] Submitting UTR ${utr} for Order ${reg.uropay_order_id}`);

      const response = await fetch('https://api.uropay.me/order/update', {
        method: 'PATCH',
        headers: getUroPayHeaders(),
        body: JSON.stringify({
          uroPayOrderId: reg.uropay_order_id,
          referenceNumber: utr
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[UroPay Warning] PATCH /order/update returned status ${response.status}: ${errorText}`);
      } else {
        const result = await response.json();
        console.log(`[UroPay] PATCH /order/update succeeded:`, result.message);
      }
    } catch (err) {
      console.error("[UroPay Error] Failed to submit UTR patch:", err.message);
    }
  }

  res.json({ success: true });
});

// 5. UroPay Payment Confirmation Webhook
app.post('/api/webhook/uropay', async (req, res) => {
  console.log("[Webhook Received] UroPay Webhook incoming header parameters:");
  const env = req.headers['x-uropay-environment'] || 'PRODUCTION';
  const webhookId = req.headers['x-uropay-webhook-id'];
  const signature = req.headers['x-uropay-signature'];
  const payload = req.body;

  console.log(`Payload: ${JSON.stringify(payload)}`);
  console.log(`Signature: ${signature}`);

  const utr = payload.referenceNumber;
  if (!utr) {
    return res.status(400).send("Missing reference number");
  }

  // Webhook Signature Verification
  const secret = process.env.UROPAY_API_SECRET || '';
  if (secret && secret !== 'YOUR_UROPAY_SECRET_HERE') {
    try {
      const hashedSecret = getHashedSecret();
      // Concatenate transaction data string and environment string (per documentation findings)
      const dataToSign = JSON.stringify(payload) + env;

      const expectedSignature = crypto
        .createHmac('sha256', hashedSecret)
        .update(dataToSign)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.warn(`[Webhook Invalid Signature] Webhook ID: ${webhookId}. Expected: ${expectedSignature}, Received: ${signature}`);
        // For security testing, we'll continue if it's explicitly locally forced, 
        // but log a warning. Let's enforce strict validation:
        return res.status(401).send("Invalid signature signature");
      }
      console.log(`[Webhook Secure] Webhook verified successfully for ID: ${webhookId}`);
    } catch (err) {
      console.error("[Webhook Error] Signature validation crashed:", err.message);
      return res.status(500).send("Signature verification error");
    }
  } else {
    console.log("[Webhook Warning] UroPay Secret is not set. Bypassing signature check for dev environment.");
  }

  // Process the payment confirmation
  // Look up registration matching this UTR / Reference Number
  const reg = await db.getByUtr(utr);

  if (reg) {
    console.log(`[Webhook Confirmed] UTR Match! Auto-verifying Registration: ${reg.id}`);
    await db.update(reg.id, { status: 'verified' });
  } else {
    // If not found by UTR, look up by Order ID if present in incoming data, or log it
    console.log(`[Webhook Warning] No local registration found for UTR: ${utr}. Payment received, but unmapped.`);
  }

  // Always return 200 OK to prevent UroPay from retrying or flagging failures
  res.status(200).send("OK");
});

/* ============ Parties, Committees & Constituencies ============ */

const CONSTITUENCIES = [
  'Agra', 'Ahmedabad East', 'Ahmedabad West', 'Ajmer', 'Alappuzha',
  'Aligarh', 'Amethi', 'Amravati', 'Amritsar', 'Anand',
  'Anantapur', 'Araria', 'Arrah', 'Asansol', 'Aurangabad',
  'Azamgarh', 'Badaun', 'Bagalkot', 'Bahraich', 'Ballia',
  'Banda', 'Bangalore Central', 'Bangalore North', 'Bangalore Rural',
  'Bangalore South', 'Bankura', 'Barabanki', 'Baramati', 'Barasat',
  'Barmer', 'Basti', 'Bathinda', 'Begusarai', 'Belgaum',
  'Bellary', 'Berhampur', 'Bhagalpur', 'Bharatpur', 'Bharuch',
  'Bhavnagar', 'Bhilwara', 'Bhopal', 'Bhubaneswar', 'Bidar',
  'Bijapur', 'Bikaner', 'Bilaspur', 'Bulandshahr', 'Calicut',
  'Chalakudy', 'Chamarajanagar', 'Chandigarh', 'Chandni Chowk',
  'Chennai Central', 'Chennai North', 'Chennai South', 'Chhindwara',
  'Chikkballapur', 'Chitradurga', 'Chittoor', 'Cuddalore',
  'Dakshina Kannada', 'Darbhanga', 'Darjeeling', 'Dausa',
  'Dehradun', 'Dhanbad', 'Dharwad', 'Dibrugarh', 'Dindigul',
  'Dumka', 'Durg', 'Eluru', 'Ernakulam', 'Faridabad',
  'Fatehpur Sikri', 'Firozpur', 'Gandhinagar', 'Gaya', 'Ghaziabad',
  'Ghazipur', 'Gonda', 'Gorakhpur', 'Gulbarga', 'Guntur',
  'Gurdaspur', 'Guwahati', 'Gwalior', 'Hajipur', 'Haridwar',
  'Hassan', 'Haveri', 'Hazaribagh', 'Hisar', 'Hoshiarpur',
  'Hyderabad', 'Idukki', 'Indore', 'Jabalpur', 'Jadavpur',
  'Jaipur', 'Jaipur Rural', 'Jalandhar', 'Jalgaon', 'Jammu',
  'Jamnagar', 'Jamshedpur', 'Jaunpur', 'Jhansi', 'Jodhpur',
  'Junagadh', 'Kairana', 'Kakinada', 'Kalahandi', 'Kannur',
  'Kanpur', 'Kanyakumari', 'Karnal', 'Karur', 'Katihar',
  'Kendrapara', 'Khajuraho', 'Khandwa', 'Kheda', 'Kolkata Dakshin',
  'Kolkata Uttar', 'Kollam', 'Koppal', 'Kota', 'Kottayam',
  'Kozhikode', 'Kurnool', 'Kurukshetra', 'Latur', 'Lucknow',
  'Ludhiana', 'Machilipatnam', 'Madurai', 'Dharwad', 'Mainpuri',
  'Malappuram', 'Mathura', 'Meerut', 'Mirzapur', 'Mumbai North',
  'Mumbai North Central', 'Mumbai North East', 'Mumbai North West',
  'Mumbai South', 'Mumbai South Central', 'Muzaffarpur', 'Mysore',
  'Nagpur', 'Nalgonda', 'Nanded', 'Nashik', 'Navsari',
  'Nellore', 'New Delhi', 'Nizamabad', 'North Goa',
  'North West Delhi', 'Ongole', 'Palakkad', 'Patiala',
  'Patna Sahib', 'Peddapalle', 'Perambalur', 'Phulpur', 'Pilibhit',
  'Pondicherry', 'Porbandar', 'Pratapgarh', 'Pune', 'Puri',
  'Purnia', 'Raebareli', 'Raichur', 'Raipur', 'Rajahmundry',
  'Rajkot', 'Rampur', 'Ranchi', 'Ratlam', 'Ratnagiri', 'Rewa',
  'Rohtak', 'Sagar', 'Saharanpur', 'Salem', 'Sambalpur',
  'Sangli', 'Sangrur', 'Saran', 'Satara', 'Udupi',
  'Secunderabad', 'Shillong', 'Shimla', 'Shimoga', 'Silchar',
  'Siliguri', 'Sitapur', 'Solapur', 'Sonipat', 'Srikakulam',
  'Srinagar', 'Sultanpur', 'Surat', 'Thane', 'Thanjavur',
  'Thiruvananthapuram', 'Thoothukudi', 'Thrissur', 'Tiruchirappalli',
  'Tirunelveli', 'Tirupati', 'Tumkur', 'Udaipur', 'Udhampur',
  'Ujjain', 'Vadodara', 'Vaishali', 'Varanasi', 'Vellore',
  'Vidisha', 'Vijayawada', 'Visakhapatnam', 'Warangal', 'Wayanad'
];

// Public: get all parties & committees
app.get('/api/parties', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  try {
    let parties = await db.getParties();
    if (!parties || parties.length === 0) {
      const defaults = [
        { id: 'party_a', name: 'Rashtriya Yuva Pragati Manch (A)', type: 'party', side: null },
        { id: 'party_b', name: 'Yuva Drishti Party (B)', type: 'party', side: null },
        { id: 'party_c', name: 'New Gen Leaders (C)', type: 'party', side: null },
        { id: 'party_d', name: 'Catalyst Party (D)', type: 'party', side: null },
        { id: 'party_e', name: 'Navpeedhi Bharat Party (E)', type: 'party', side: null },
        { id: 'com_education', name: 'EDUCATION', type: 'committee' },
        { id: 'com_finance', name: 'FINANCE', type: 'committee' },
        { id: 'com_home_affairs', name: 'HOME AFFAIRS', type: 'committee' },
        { id: 'com_health', name: 'HEALTH', type: 'committee' },
        { id: 'com_justice', name: 'JUSTICE', type: 'committee' }
      ];
      for (const p of defaults) await db.createParty(p);
      parties = await db.getParties();
    }
    res.json(parties);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Public: get all constituencies
app.get('/api/constituencies', (req, res) => {
  res.json(CONSTITUENCIES);
});

// Public: get verified delegates with their assignments
app.get('/api/delegates', async (req, res) => {
  try {
    const all = await db.getAll();
    const verified = all.filter(r => (r.status || '').toLowerCase() === 'verified');
    res.json(verified.map(d => ({
      id: d.id,
      name: d.name,
      assigned_party: d.assigned_party || '',
      assigned_constituency: d.assigned_constituency || '',
      assigned_committee: d.assigned_committee || ''
    })));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Admin: add a party or committee
app.post('/api/admin/parties', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const { name, type, side, description } = req.body;
  if (!name || !type) return res.status(400).json({ detail: 'name and type required' });
  try {
    const entry = await db.createParty({ name, type, side, description });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Admin: delete a party or committee
app.delete('/api/admin/parties/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const deleted = await db.deleteParty(req.params.id);
  if (!deleted) return res.status(404).json({ detail: 'Not found' });
  res.json({ success: true });
});

// Admin: rename a party/committee or update its side (updates all delegates too)
app.patch('/api/admin/parties/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const { name, side } = req.body;
  if ((!name || !name.trim()) && side === undefined) return res.status(400).json({ detail: 'Name or side required' });
  try {
    const result = await db.renameParty(req.params.id, name ? name.trim() : null, side);
    if (!result) return res.status(404).json({ detail: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Admin: normalize party names (consolidate short-name duplicates into full names)
app.post('/api/admin/parties/normalize', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  try {
    const result = await db.normalizeParties();
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Admin: get/set institution groups (raw college name → group name)
app.get('/api/admin/institution-groups', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  try {
    const groups = await db.getInstitutionGroups();
    const all = await db.getAll();
    const verified = all.filter(r => (r.status || '').toLowerCase() === 'verified');
    const colleges = [...new Set(verified.map(r => r.college || '').filter(Boolean))].sort();
    res.json({ groups, colleges });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});
app.put('/api/admin/institution-groups', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  try {
    const result = await db.setInstitutionGroups(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Admin: set ruling coalition (which parties form govt, rest become opposition)
app.post('/api/admin/parties/coalition', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const rulingList = req.body.ruling_ids || req.body.ruling_names;
  if (!Array.isArray(rulingList)) return res.status(400).json({ detail: 'ruling_names array required' });
  try {
    console.log('[Coalition] Setting coalition with ruling_list:', JSON.stringify(rulingList));
    await db.setCoalition(rulingList);
    await db.setCoalitionLock(true);
    const ver = await db.getParties();
    const sides = ver.filter(p => p.type === 'party').map(p => ({ id: p.id, name: p.name, side: p.side }));
    console.log('[Coalition] Verification after save:', JSON.stringify(sides));
    res.json({ success: true, sides });
  } catch (err) {
    console.error('[Coalition] Error saving coalition:', err);
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/admin/parties/no-confidence', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  try {
    await db.resetCoalition();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/coalition-lock', async (req, res) => {
  try {
    const state = await db.getCoalitionLock();
    res.json(state);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/admin/coalition-lock', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  try {
    const result = await db.setCoalitionLock(req.body.locked === true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Debug: dump raw party data from DB
app.get('/api/debug/parties', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_PASSWORD) return res.status(403).json({ detail: 'Forbidden' });
  try {
    const raw = await db.getParties();
    res.json(raw.map(p => ({ id: p.id, name: p.name, side: p.side, type: p.type })));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/debug/coalition', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_PASSWORD) return res.status(403).json({ detail: 'Forbidden' });
  try {
    const { rulingIds, partyCount } = await db.getCoalitionDebug();
    res.json({ rulingIds, partyCount });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Public: get current leadership
app.get('/api/leadership', async (req, res) => {
  try {
    const data = await db.getLeadership();
    // Enrich with delegate names
    const regs = await db.getAll();
    const enrich = (id) => {
      const d = regs.find(r => r.id === id);
      return d ? { id: d.id, name: d.name, party: d.assigned_party, college: d.college } : null;
    };
    const result = {
      pm: enrich(data.pm),
      dpm: enrich(data.dpm),
      lop: enrich(data.lop),
      dep_lop: enrich(data.dep_lop),
      ministers: {}
    };
    if (data.ministers) {
      for (const [key, val] of Object.entries(data.ministers)) {
        result.ministers[key] = enrich(val);
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Admin: save leadership
app.post('/api/admin/leadership', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  try {
    await db.setLeadership(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

/* ============ Admin Secretariat APIs (Protected) ============ */

// Admin login
app.post('/api/admin/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    res.json({ token: 'dummy-token' });
  } else {
    res.status(401).json({ detail: 'Wrong password' });
  }
});

// Get all registrations
app.get('/api/admin/registrations', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  res.json(await db.getAll());
});

// Get stats summary
app.get('/api/admin/stats', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  res.json(await db.getStats());
});

// Manually update status of a registration (verify / reject / party & committee assignment)
app.post('/api/admin/registrations/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, portfolio, assigned_party, assigned_committee } = req.body;
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const updates = {};
  if (status !== undefined) updates.status = status;
  if (portfolio !== undefined) updates.portfolio = portfolio;
  if (assigned_party !== undefined) updates.assigned_party = assigned_party;
  if (assigned_committee !== undefined) updates.assigned_committee = assigned_committee;
  await db.update(id, updates);
  res.json({ success: true });
});

// Edit delegate demographics (name, college, elected_role)
app.patch('/api/admin/registrations/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const { id } = req.params;
  try {
    const result = await db.update(id, req.body);
    if (!result) return res.status(404).json({ detail: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Update specifically the elected role (used by inline assignment)
app.post('/api/admin/registrations/:id/elected_role', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  try {
    const { role } = req.body;
    await db.setElectedRole(req.params.id, role);
    res.json({ success: true, role });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Update award status
app.post('/api/admin/registrations/:id/award_status', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  try {
    const { status } = req.body;
    const result = await db.setAwardStatus(req.params.id, status);
    res.json({ success: result });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Delete a registration
app.delete('/api/admin/registrations/:id', async (req, res) => {
  const { id } = req.params;
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const deleted = await db.delete(id);

  if (!deleted) {
    return res.status(404).json({ detail: "Registration not found" });
  }

  console.log(`[Admin Action] Deleted registration record: ${id}`);
  res.json({ success: true });
});

/* ============ Scoring & Judges APIs ============ */

// Judge login
app.post('/api/scores/login', async (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) return res.status(400).json({ detail: 'ID and password required' });
  const judge = await db.verifyJudge(id, password);
  if (judge) {
    res.json({ success: true, judgeId: judge.id });
  } else {
    res.status(401).json({ detail: 'Invalid ID or password' });
  }
});

// Admin: Manage Judges
app.get('/api/admin/judges', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  res.json(await db.getJudges());
});

app.post('/api/admin/judges', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const { id, password } = req.body;
  if (!id || !password) return res.status(400).json({ detail: 'ID and password required' });
  try {
    const judge = await db.createJudge({ id, password });
    res.json(judge);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/admin/judges/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const deleted = await db.deleteJudge(req.params.id);
  if (!deleted) return res.status(404).json({ detail: 'Not found' });
  res.json({ success: true });
});

// Admin: Manage Scoring Criteria
app.get('/api/admin/scoring-criteria', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  res.json(await db.getCriteria());
});

app.post('/api/admin/scoring-criteria', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const { name, max_points, description } = req.body;
  if (!name || !max_points) return res.status(400).json({ detail: 'name and max_points required' });
  try {
    const entry = await db.createCriteria({ name, max_points, description });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/admin/scoring-criteria/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const deleted = await db.deleteCriteria(req.params.id);
  if (!deleted) return res.status(404).json({ detail: 'Not found' });
  res.json({ success: true });
});

// Admin: Manage Awards
app.get('/api/admin/awards', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  res.json(await db.getAwards());
});

app.post('/api/admin/awards/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const { name, requires_role, requires_side, criteria_ids } = req.body;
  try {
    await db.updateAward(req.params.id, { name, requires_role, requires_side, criteria_ids });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/admin/awards', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const { name, criteria_ids } = req.body;
  if (!name || !criteria_ids || !Array.isArray(criteria_ids)) {
    return res.status(400).json({ detail: 'name and criteria_ids (array) required' });
  }
  try {
    const entry = await db.createAward({ name, criteria_ids });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/admin/awards/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const deleted = await db.deleteAward(req.params.id);
  if (!deleted) return res.status(404).json({ detail: 'Not found' });
  res.json({ success: true });
});

// Public: Get awards definition
app.get('/api/awards', async (req, res) => {
  res.json(await db.getAwards());
});

// ============ Sessions APIs ============

// Public: Get all sessions (with optional judgeId for completion status)
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await db.getSessions();
    const required = [
      { id: 'RC', name: 'Roll Call (RC)' },
      { id: 'QH', name: 'Question Hour (QH)' },
      { id: 'ZH', name: 'Zero Hour 1 (ZH)' },
      { id: 'MR', name: 'Ministry Reports (MR)' },
      { id: 'SS', name: 'Surprise Session (SS)' },
      { id: 'RC2', name: 'Roll Call Day 2 (RC2)' },
      { id: 'ZH2', name: 'Zero Hour 2 (ZH2)' },
      { id: 'BP', name: 'Bill Presentations (BP)' },
      { id: 'FSH', name: 'Final Sitting of the House (FSH)' }
    ];

    // Insert any missing sessions
    const existingIds = sessions.map(s => s.id);
    for (const s of required) {
      if (!existingIds.includes(s.id)) {
        await db.createSession(s);
      }
    }

    let updated = await db.getSessions();

    // Sort by the required order
    const order = required.map(s => s.id);
    updated.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

    // If judgeId is provided, annotate which sessions they have scored in
    const judgeId = req.query.judgeId;
    if (judgeId) {
      const allScores = await db.getAllScores();
      const result = updated.map(s => ({
        ...s,
        hasScores: allScores.some(sc => sc.judge_id === judgeId && (sc.session_id || 'general') === s.id)
      }));
      return res.json(result);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Admin: Create session
app.post('/api/admin/sessions', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const { id, name } = req.body;
  if (!name) return res.status(400).json({ detail: 'name required' });
  try {
    const entry = await db.createSession({ id, name });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Admin: Delete session
app.delete('/api/admin/sessions/:id', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const deleted = await db.deleteSession(req.params.id);
  if (!deleted) return res.status(404).json({ detail: 'Not found' });
  res.json({ success: true });
});

// Public/Judge: Get all criteria
app.get('/api/scores/criteria', async (req, res) => {
  res.json(await db.getCriteria());
});

// Judge: Get all verified delegates with their scores
app.get('/api/scores/delegates', async (req, res) => {
  const judgeId = req.query.judgeId;
  const sessionId = req.query.sessionId || null;
  if (!judgeId) return res.status(400).json({ detail: 'judgeId required' });

  const [registrations, scores] = await Promise.all([
    db.getAll(),
    db.getScoresForJudge(judgeId, sessionId)
  ]);

  // Filter for delegates who are either verified OR have been assigned a committee
  const verified = registrations.filter(r =>
    r.status === 'verified' || (r.assigned_committee && r.assigned_committee.trim() !== '')
  );

  // Map scores to delegates
  const mapped = verified.map(v => {
    const delegateScores = scores.filter(s => s.delegate_id === v.id);
    return { ...v, scores: delegateScores };
  });

  res.json(mapped);
});


// Judge: Submit score
app.post('/api/scores/submit', async (req, res) => {
  const { delegate_id, judge_id, criteria_id, score, session_id } = req.body;
  if (!delegate_id || !judge_id || !criteria_id || score === undefined) {
    return res.status(400).json({ detail: 'Missing required fields' });
  }
  try {
    const scoreVal = parseInt(score, 10);
    if (isNaN(scoreVal)) return res.status(400).json({ detail: 'Invalid score value' });

    // Check if score is within reasonable bounds (0 to 100, though max_points is usually 10)
    if (scoreVal < 0 || scoreVal > 100) {
      return res.status(400).json({ detail: 'Score out of range (0-100)' });
    }

    const entry = await db.submitScore({ delegate_id, judge_id, criteria_id, score: scoreVal, session_id: session_id || 'general' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});




// Bulk attendance submit
app.post('/api/scores/attendance/bulk', async (req, res) => {
  const { judge_id, session_id, attendance } = req.body;
  if (!judge_id || !session_id || !Array.isArray(attendance)) {
    return res.status(400).json({ detail: 'judge_id, session_id, and attendance array required' });
  }
  try {
    const results = await Promise.all(attendance.map(a =>
      db.submitScore({
        delegate_id: a.delegate_id,
        judge_id,
        criteria_id: 'attendance',
        score: a.present ? 1 : 0,
        session_id
      })
    ));
    res.json({ success: true, count: results.length });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

/* ============ Leaderboard API ============ */

// Leaderboard Login
app.post('/api/leaderboard/login', (req, res) => {
  if (req.body.password === process.env.LEADERBOARD_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ detail: 'Invalid password' });
  }
});

app.get('/api/public/leaderboard', async (req, res) => {
  const incomingPw = req.headers['x-leaderboard-password'];
  if (incomingPw !== process.env.LEADERBOARD_PASSWORD) {
    return res.status(401).json({ detail: 'Leaderboard is protected. Please provide a password.' });
  }

  res.setHeader('Cache-Control', 'no-cache');
  try {
    const [scores, registrations, rawCriteria, awards, parties] = await Promise.all([
      db.getAllScores(),
      db.getAll(),
      db.getCriteria(),
      db.getAwards(),
      db.getParties()
    ]);

    // Deduplicate criteria by ID (take last entry per ID)
    // Deduplicate criteria by ID, exclude attendance
    const criteriaMap = {};
    rawCriteria.forEach(c => {
      if (c.id && c.id !== 'attendance') criteriaMap[c.id] = c;
    });
    const criteria = Object.values(criteriaMap);

    // Scorable session IDs (exclude roll calls)
    const scorableSessions = ['QH', 'ZH', 'MR', 'SS', 'BP', 'FSH', 'ZH2', 'general'];

    const verified = registrations.filter(r => (r.status || '').toLowerCase() === 'verified');

    const leaderboardData = verified.map(d => {
      const dScores = scores.filter(s =>
        s.delegate_id === d.id &&
        s.criteria_id !== 'attendance' &&
        scorableSessions.includes(s.session_id || 'general')
      );
      const criteriaScores = {};
      let sessionCount = 0;

      criteria.forEach(c => {
        const cMatches = dScores.filter(s => s.criteria_id === c.id);
        if (cMatches.length === 0) {
          criteriaScores[c.id] = 0;
          return;
        }

        // Group scores by session_id, average within each session
        const sessionMap = {};
        cMatches.forEach(s => {
          const sid = s.session_id || 'general';
          if (!sessionMap[sid]) sessionMap[sid] = [];
          sessionMap[sid].push(s.score);
        });

        const sessionAvgs = Object.values(sessionMap).map(scores =>
          scores.reduce((sum, sc) => sum + sc, 0) / scores.length
        );

        criteriaScores[c.id] = sessionAvgs.reduce((sum, avg) => sum + avg, 0) / sessionAvgs.length;
        sessionCount = Math.max(sessionCount, Object.keys(sessionMap).length);
      });

      const totalScore = Object.values(criteriaScores).reduce((sum, s) => sum + s, 0);

      // Find individual side - match via canonical name (resolve aliases)
      const PARTY_ALIAS = {
        'A': 'Rashtriya Yuva Pragati Manch (A)', 'B': 'Yuva Drishti Party (B)',
        'C': 'New Gen Leaders (C)', 'D': 'Catalyst Party (D)', 'E': 'Navpeedhi Bharat Party (E)',
        'Party A': 'Rashtriya Yuva Pragati Manch (A)', 'Party B': 'Yuva Drishti Party (B)',
        'Party C': 'New Gen Leaders (C)', 'Party D': 'Catalyst Party (D)', 'Party E': 'Navpeedhi Bharat Party (E)',
        'Next Gen Leaders (C)': 'New Gen Leaders (C)',
      };
      const canonical = (name) => {
        const m = PARTY_ALIAS[name?.trim()];
        return m ? m.trim().toLowerCase() : (name?.trim().toLowerCase() || '');
      };
      const dpCanon = canonical(d.assigned_party);
      const partyMatch = parties.find(p => p.name && canonical(p.name) === dpCanon);
      const side = partyMatch ? partyMatch.side : null;

      return {
        id: d.id,
        name: d.name,
        college: d.college,
        party: d.assigned_party,
        side: side,
        committee: d.assigned_committee,
        portfolio: d.portfolio,
        elected_role: d.elected_role,
        criteriaScores,
        totalScore: parseFloat(totalScore.toFixed(2))
      };
    });

    leaderboardData.sort((a, b) => b.totalScore - a.totalScore);
    res.json({ leaderboard: leaderboardData, criteria, awards });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

function smartInstKey(name) {
  if (!name) return 'Unspecified';
  const raw = name.trim();
  const upper = raw.toUpperCase();

  // Special group for Chinmaya institutions (including CEPS)
  if (upper.includes('CHINMAYA') || upper.includes('CEPS')) {
    return 'CHINMAYA';
  }

  const drops = new Set(['college', 'school', 'pu', 'junior', 'degree', 'university', 'institute', 'academy', 'high', 'primary', 'secondary', 'commerce', 'science', 'arts', 'english', 'medium', 'cbse', 'public', 'society', 'campus', 'of', 'the', '&', 'and', 'at', 'in', 'for', 'vidyalaya', 'vidyanikethana', 'school', 'college', 'hostel']);
  const parts = raw.split(/[\s,/-]+/).filter(Boolean);
  if (!parts.length) return 'Unspecified';
  let base = parts[0].replace(/\./g, '').toUpperCase();
  // If first word is a common prefix and second word is meaningful, use both
  if (parts.length > 1) {
    const second = parts[1].replace(/\./g, '');
    if (!drops.has(second.toLowerCase())) base += ' ' + second;
  }
  return base;
}

// Public: get institutions (college) with delegate members grouped and total scores
app.get('/api/institutions', async (req, res) => {
  try {
    const [all, customGroups, rawCriteria, rawScores] = await Promise.all([
      db.getAll(), db.getInstitutionGroups(), db.getCriteria(), db.getAllScores()
    ]);
    const verified = all.filter(r => (r.status || '').toLowerCase() === 'verified');

    // Build scorable criteria (exclude attendance)
    const criteriaMap = {};
    rawCriteria.forEach(c => { if (c.id && c.id !== 'attendance') criteriaMap[c.id] = c; });
    const scorableSessions = ['QH', 'ZH', 'MR', 'SS', 'BP', 'FSH', 'ZH2', 'general'];

    const groups = {};
    // First, pre-create groups from custom group names
    const groupNames = new Set(Object.values(customGroups));
    for (const name of groupNames) {
      if (!groups[name]) groups[name] = { institution: name, members: [] };
    }
    verified.forEach(d => {
      const raw = (d.college || '').trim();
      const name = raw || 'Unspecified';
      // Priority: custom group > smart key > raw name
      let key = customGroups[name];
      if (!key) key = smartInstKey(name);
      if (!groups[key]) groups[key] = { institution: key, members: [] };

      // Compute totalScore for this delegate (same logic as leaderboard)
      const dScores = rawScores.filter(s =>
        s.delegate_id === d.id &&
        s.criteria_id !== 'attendance' &&
        scorableSessions.includes(s.session_id || 'general')
      );
      let delegateTotal = 0;
      Object.values(criteriaMap).forEach(c => {
        const cMatches = dScores.filter(s => s.criteria_id === c.id);
        if (cMatches.length === 0) return;
        const sessionMap = {};
        cMatches.forEach(s => {
          const sid = s.session_id || 'general';
          if (!sessionMap[sid]) sessionMap[sid] = [];
          sessionMap[sid].push(s.score);
        });
        const sessionAvgs = Object.values(sessionMap).map(scores =>
          scores.reduce((sum, sc) => sum + sc, 0) / scores.length
        );
        delegateTotal += sessionAvgs.reduce((sum, avg) => sum + avg, 0) / sessionAvgs.length;
      });

      groups[key].members.push({
        id: d.id,
        name: d.name,
        year: d.year || '',
        party: d.assigned_party || '',
        committee: d.assigned_committee || '',
        totalScore: parseFloat(delegateTotal.toFixed(2))
      });
    });
    const result = Object.values(groups).map(g => ({
      ...g,
      count: g.members.length,
      totalPoints: parseFloat(g.members.reduce((sum, m) => sum + (m.totalScore || 0), 0).toFixed(2))
    })).sort((a, b) => b.totalPoints - a.totalPoints);
    res.json(result);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/public/leadership', async (req, res) => {
  try {
    const [all, parties] = await Promise.all([db.getAll(), db.getParties()]);
    const leadership = all
      .filter(r => (r.status || '').toLowerCase() === 'verified' && r.elected_role && r.elected_role.trim() !== '')
      .map(r => {
        const p = parties.find(party =>
          party.name && r.assigned_party &&
          party.name.trim().toLowerCase() === r.assigned_party.trim().toLowerCase()
        );
        return {
          id: r.id,
          name: r.name,
          role: r.elected_role,
          party: r.assigned_party,
          side: p ? p.side : null,
          committee: r.assigned_committee,
          portfolio: r.portfolio
        };
      });
    res.json(leadership);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

/* ============ Scores Export (CSV / Excel) ============ */

app.get('/api/admin/scores/export', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }

  try {
    const [scores, registrations, criteria, judges] = await Promise.all([
      db.getAllScores(),
      db.getAll(),
      db.getCriteria(),
      db.getJudges()
    ]);

    // Build CSV header
    const criteriaNames = criteria.map(c => c.name);
    const headerRow = ['Delegate Name', 'Party', 'Committee', 'Portfolio', 'Judge ID', 'Session', ...criteriaNames, 'Total Score', 'Scored At'];

    // Build rows: one row per delegate per judge
    const rows = [];
    const eligible = registrations.filter(r =>
      r.status === 'verified' || (r.assigned_committee && r.assigned_committee.trim() !== '')
    );

    for (const delegate of eligible) {
      // Group scores by judge
      const delegateScores = scores.filter(s => s.delegate_id === delegate.id);
      const judgeIds = [...new Set(delegateScores.map(s => s.judge_id))];

      if (judgeIds.length === 0) {
        // Delegate has no scores yet — single row with empty scores
        const row = [
          delegate.name,
          delegate.assigned_party || '',
          delegate.assigned_committee || '',
          delegate.portfolio || '',
          '—',
          '—',
          ...criteriaNames.map(() => ''),
          '0',
          ''
        ];
        rows.push(row);
      } else {
        for (const judgeId of judgeIds) {
          const judgeScores = delegateScores.filter(s => s.judge_id === judgeId);
          const criteriaValues = criteria.map(c => {
            const match = judgeScores.find(s => s.criteria_id === c.id);
            return match ? match.score : '';
          });
          const total = criteriaValues.reduce((sum, v) => sum + (Number(v) || 0), 0);
          const lastUpdate = judgeScores.length > 0
            ? judgeScores.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0].updated_at
            : '';

          const sessionId = judgeScores.length > 0 ? (judgeScores[0].session_id || 'general') : '—';
          const row = [
            delegate.name,
            delegate.assigned_party || '',
            delegate.assigned_committee || '',
            delegate.portfolio || '',
            judgeId,
            sessionId,
            ...criteriaValues,
            total,
            lastUpdate
          ];
          rows.push(row);
        }
      }
    }

    // Generate CSV string
    function csvEscape(val) {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    const csvContent = [headerRow, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=adhikar26_scores_summary_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csvContent);
  } catch (err) {
    console.error('[Export] Error:', err);
    res.status(500).json({ detail: err.message });
  }
});

// RAW SCORE LOG EXPORT (Live append log)
app.get('/api/admin/scores/raw-log', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const LOG_FILE = path.join(__dirname, '..', 'scores_log.csv');
  if (fs.existsSync(LOG_FILE)) {

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=adhikar26_raw_score_log.csv');
    res.sendFile(LOG_FILE);
  } else {
    res.status(404).json({ detail: 'Log file not found yet (wait for first submission)' });
  }
});



// GET RECENT SCORES JSON (For Scoring Dashboard)
app.get('/api/admin/live-log', async (req, res) => {
  const incomingPw = req.headers['x-admin-password'];
  console.log('[Recent Scores Audit] Incoming Header:', incomingPw);
  console.log('[Recent Scores Audit] Server Env PW exists:', !!process.env.ADMIN_PASSWORD);

  if (incomingPw !== process.env.ADMIN_PASSWORD) {
    console.error('[Recent Scores Audit] Authentication failed');
    return res.status(403).json({ detail: 'Forbidden' });
  }
  const LOG_FILE = path.join(__dirname, '..', 'scores_log.csv');
  if (!fs.existsSync(LOG_FILE)) {
    return res.json([]);
  }
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim() !== "");
    if (lines.length <= 1) return res.json([]); // just header

    const recent = lines.slice(1).slice(-15).reverse().map(line => {
      const [ts, delId, jId, critId, score] = line.split(',');
      return { timestamp: ts, delegate_id: delId, judge_id: jId, criteria: critId, score: score };
    });
    res.json(recent);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});


// OFFLINE REGISTRATION (Admin)
app.post('/api/admin/registrations/offline', async (req, res) => {
  if (req.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
    return res.status(403).json({ detail: 'Forbidden' });
  }
  try {
    const reg = await db.create({
      ...req.body,
      status: req.body.status || 'verified',
      utr: req.body.utr || 'OFFLINE'
    });
    res.json(reg);
  } catch (err) {
    console.error('[Offline Reg] Error:', err);
    res.status(500).json({ detail: err.message });
  }
});

// End of Admin Routes


// API 404 Handler (Prevents HTML leakage to API consumers)
app.use('/api/*', (req, res) => {
  res.status(404).json({ detail: 'API route not found' });
});


/* ============ Fallback Web Route ============ */


app.get('/scores', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'scores.html'));
});

app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'leaderboard.html'));
});

app.get('/institution', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'institution.html'));
});

app.get('/assign', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'assign.html'));
});

app.get('/coalition', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});


// Start Server - listen on 0.0.0.0 for accessibility
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(` ADHIKAR'26 REPLICATED BACKEND SERVER IS RUNNING`);
    console.log(` Listening on: 0.0.0.0:${PORT}`);
    console.log(` Admin Desk: Authentication via ADMIN_PASSWORD env var`);
    console.log(`===============================================`);
  });
}

module.exports = app;
