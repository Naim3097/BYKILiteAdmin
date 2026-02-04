# Lean.x Transmission Payment Integration Guide

This document details the accurate integration process of the **Lean.x Payment Gateway** into the **One X Home Booking** (One X Transmission) platform. The integration is currently live and functional using the production API endpoints.

## 1. Integration Architecture

The payment system uses a **Hosted Payment Page (Redirect Model)** architecture:

1.  **Frontend (`src/components/booking/BookingForm.tsx`)**: Collects user input (Name, Email, Phone) and initiates the payment request.
2.  **Backend (`api/create-payment.ts`)**: Serverless function that:
    *   Validates input data.
    *   Communicates securely with Lean.x API using server-side credentials.
    *   Generates the payment page URL.
3.  **Lean.x Gateway**: The user is redirected to `payment.leanx.io` to complete the transaction.
4.  **Completion**: Lean.x redirects the user back to `/payment/success` on our domain.

---

## 2. Configuration & Credentials

The system relies on three critical environment variables. These must be configured in your Vercel project settings (for production) and your local `.env` file (for development).

### Environment Variables

| Variable | Description | Value (Production) | Notes |
| :--- | :--- | :--- | :--- |
| `LEANX_API_HOST` | The base URL for the Lean.x API | `https://api.leanx.io` | **Critical:** Do NOT use `api.leanx.dev` for these credentials. It will cause `INVALID_UUID` errors. |
| `LEANX_AUTH_TOKEN` | Merchant authentication token | `LP-C64B42C3...` | Keep secret. Never expose in frontend code. |
| `LEANX_COLLECTION_UUID` | Unique identifier for your payment collection | `Dc-E5317E6652-Lx` | Specific to the "One X Transmission" collection. |

### Credential Verification
*   **Collection UUID**: `Dc-E5317E6652-Lx`
*   **API Host**: `https://api.leanx.io` (Production)

---

## 3. Implementation Details

### A. Backend Logic (`api/create-payment.ts`)

This is the core of the integration. It handles the secure handshake with Lean.x.

**Input Validation:**
The API validates that:
*   `amount` is a positive number between 0.01 and 10,000 MYR.
*   `customerEmail` is a valid format.
*   `customerPhone` is a valid Malaysian mobile number (e.g., `0123456789` or `+60123456789`).

**Payload Construction:**
The backend constructs the payload required by Lean.x:

```typescript
const leanxPayload = {
  collection_uuid: process.env.LEANX_COLLECTION_UUID,
  amount: parseFloat(amount.toFixed(2)), // Ensure 2 decimal places
  invoice_ref: invoiceRef,
  // Dynamic Redirect URL: Appends invoiceNo for the success page to track
  redirect_url: `${baseUrl}/payment/success?invoiceNo=${invoiceRef}`, 
  callback_url: `${baseUrl}/api/payment-webhook`,
  full_name: customerName,
  email: customerEmail,
  phone_number: customerPhone.replace(/[\s-]/g, ''), // Clean phone format
};
```

**API Request:**
*   **Endpoint:** `POST {LEANX_API_HOST}/api/v1/merchant/create-bill-page`
*   **Headers:**
    *   `Content-Type: application/json`
    *   `auth-token: {LEANX_AUTH_TOKEN}`

### B. Frontend Redirection

The frontend (`src/components/booking/BookingForm.tsx`) waits for the backend response:

```typescript
// Response from /api/create-payment
{
  "success": true,
  "redirectUrl": "https://payment.leanx.io/pay/..."
}
```

Upon success, the browser immediately redirects:
```javascript
window.location.href = data.redirectUrl;
```

---

## 4. Payment Success Handling

After payment, the user lands on:
`https://boox.vercel.app/payment/success?invoiceNo=INV-12345`

The **PaymentSuccess Page** (`src/pages/PaymentSuccess.tsx`):
1.  Reads the `invoiceNo` from the URL query parameters.
2.  Displays a success message with the reference number (e.g., "Booking Confirmed: INV-12345").
3.  (Optional) Can trigger a secondary verification call to Firebase to update the booking status.

---

## 5. Troubleshooting & Common Issues

| Error | Cause | Solution |
| :--- | :--- | :--- |
| **`INVALID_UUID` (Code 5699)** | Using the wrong API Host. | Ensure `LEANX_API_HOST` is set to `https://api.leanx.io`. Do not use `.dev`. |
| **`ENOTFOUND`** | API Host variable is malformed. | Check for typos in `.env`. |
| **Payment Page shows "RM 0"** | Parsing error or empty amount. | Ensure `amount` is passed as a number (float), not a string. |
| **400 Bad Request** | Missing phone or email. | Ensure frontend validation mimics backend rules (Malaysian phone format). |

## 6. Testing

To verify the integration without a real transaction:
1.  **Unit Test:** Run `node test-leanx-exact.cjs` locally. This script simulates the exact payload sent by the backend.
2.  **Live Test:** Create a booking with a small amount (e.g., RM 1.00) and verify the redirection to the Lean.x payment page loads correctly with your merchant logo and correct amount.
3.  **Environment Check:** Run `node debug-links.cjs` to verify that your environment correctly resolves the API URLs.
