# UroPay Integration Guide for Adhikar'26

Follow these steps to fully integrate the UroPay payment gateway with your deployed Adhikar'26 website.

## 1. UroPay Dashboard Configuration

1. **Sign In**: Log in to your [UroPay Dashboard](https://dashboard.uropay.me/).
2. **API Credentials**:
   - Navigate to **Settings** > **API Keys**.
   - Copy your **X-API-KEY**.
   - Copy your **Secret Key**.
3. **Webhook Setup**:
   - Navigate to **Webhooks**.
   - Add a new webhook.
   - **URL**: `https://your-app-name.up.railway.app/api/webhook/uropay` (Replace `your-app-name` with your actual Railway app name).
   - **Events**: Select `Payment Success`.

## 2. Railway Environment Variables

Go to your Railway project settings and add the following environment variables:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `UROPAY_API_KEY` | Your UroPay X-API-KEY | `upl_...` |
| `UROPAY_API_SECRET` | Your UroPay Secret Key | `...` |
| `RECEIVING_VPA` | The UPI ID that should receive funds | `9980964089@cnrb` |
| `ADMIN_PASSWORD` | Password for the Secretariat Admin panel | `iwantitthatway` |
| `DATABASE_URL` | (Optional) Railway PostgreSQL URL | `postgresql://...` |

> [!IMPORTANT]
> **Node.js Version**: This project uses the `fetch` API. Ensure your Railway environment is set to **Node.js v18 or higher**. If you are using an older version, you must add `node-fetch` as a dependency.

## 3. How it Works

- **Registration**: When a student registers, the backend communicates with UroPay to generate a unique QR code and UPI link.
- **Payment**: The student pays via UPI.
- **Verification**: 
  - **Auto**: Once the payment is successful, UroPay hits your webhook, and the registration is automatically marked as **Verified**.
  - **Manual**: Students can also submit their 12-digit UTR number if the auto-verification hasn't happened yet. Admin can then verify this in the Admin Panel.

## 4. Mobile Opening Fix

The backend has been updated to listen on `0.0.0.0`, ensuring it is accessible from mobile devices and external networks once deployed. You can verify the backend is up by visiting:
`https://your-app-name.up.railway.app/api/health`
