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
  const { name, email, phone, year, college, role_preference, notes } = req.body;

  // Basic validation
  if (!name || !email || !phone || !year || !college) {
    return res.status(400).json({ detail: "Missing required registration details" });
  }

  // Create temporary local registration first
  const reg = await db.create({
    name,
    email,
    phone,
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
      upiString: `upi://pay?pa=9980964089@cnrb&pn=ADHIKAR'26&am=650.00&cu=INR&tn=Adhikar26 Registration ${reg.id.slice(0, 8)}`,
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

// 3. UroPay Payment Confirmation Webhook
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

/* ============ Admin Secretariat APIs (Protected) ============ */

// Middleware to protect admin routes
function adminAuth(req, res, next) {
  const providedPassword = req.headers['x-admin-password'] || '';
  const actualPassword = process.env.ADMIN_PASSWORD || 'secretariat2026';

  if (providedPassword !== actualPassword) {
    return res.status(401).json({ detail: "Unauthorized Secretariat Password" });
  }
  next();
}

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const actualPassword = process.env.ADMIN_PASSWORD || 'secretariat2026';

  if (password === actualPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ detail: "Invalid Password" });
  }
});

// Get all registrations
app.get('/api/admin/registrations', adminAuth, async (req, res) => {
  res.json(await db.getAll());
});

// Get stats summary
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  res.json(await db.getStats());
});

// Manually update status of a registration (verify / reject)
app.post('/api/admin/registrations/:id/status', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ['pending', 'payment_claimed', 'verified', 'rejected'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ detail: "Invalid status state" });
  }

  const updated = await db.update(id, { status });
  if (!updated) {
    return res.status(404).json({ detail: "Registration not found" });
  }

  console.log(`[Admin Action] Manual status change for ${id} to ${status}`);
  res.json(updated);
});

// Delete a registration
app.delete('/api/admin/registrations/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const deleted = await db.delete(id);

  if (!deleted) {
    return res.status(404).json({ detail: "Registration not found" });
  }

  console.log(`[Admin Action] Deleted registration record: ${id}`);
  res.json({ success: true });
});

/* ============ Fallback Web Route ============ */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start Server - listen on 0.0.0.0 for accessibility
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(` ADHIKAR'26 REPLICATED BACKEND SERVER IS RUNNING`);
    console.log(` Listening on: 0.0.0.0:${PORT}`);
    console.log(` Admin Desk default password: secretariat2026`);
    console.log(`===============================================`);
  });
}

module.exports = app;
