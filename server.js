const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Hardcoded credentials (replace if needed)
const PESAPAL_KEY = '5AnFeLarnnmT5+0KUUHuqF6LQKxg+J17';
const PESAPAL_SECRET = 'EfNwwzvSJcnsMix1uNDLOVHf0jA=';

// Your Render backend URL (for IPN and callback)
const BASE_URL = 'https://zero79868.onrender.com';
const IPN_URL = `${BASE_URL}/ipn`;
const CALLBACK_URL = `${BASE_URL}/payment-callback`;

const IS_PRODUCTION = true;
const API_BASE_URL = IS_PRODUCTION
  ? 'https://pay.pesapal.com/v3/api'
  : 'https://cybqa.pesapal.com/pesapalv3/api';

let registeredIpnId = null;

// Helper: get OAuth token
async function getAuthToken() {
  const response = await axios.post(`${API_BASE_URL}/Auth/RequestToken`, {
    consumer_key: PESAPAL_KEY,
    consumer_secret: PESAPAL_SECRET,
  });
  return response.data.token;
}

// Helper: register IPN URL
async function registerIpnUrl(token) {
  const response = await axios.post(
    `${API_BASE_URL}/URLSetup/RegisterIPN`,
    { url: IPN_URL, ipn_notification_type: 'POST' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.ipn_id;
}

// Helper: submit order with dynamic amount
async function submitOrder(token, ipnId, orderDetails) {
  const requestBody = {
    id: `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    currency: 'KES',
    amount: parseFloat(orderDetails.amount).toFixed(2),
    description: orderDetails.description,
    callback_url: CALLBACK_URL,
    cancellation_url: CALLBACK_URL,
    notification_id: ipnId,
    billing_address: {
      email_address: orderDetails.email,
      phone_number: orderDetails.phone,
      first_name: 'Customer',
      last_name: 'Payment',
    },
  };

  const response = await axios.post(
    `${API_BASE_URL}/Transactions/SubmitOrderRequest`,
    requestBody,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return response.data.redirect_url;
}

// ================== ENDPOINTS ==================
app.post('/initiate-payment', async (req, res) => {
  const { amount, phone, email = 'customer@example.com' } = req.body;

  // Accept any positive amount (no hardcoded limit)
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }
  if (!phone || !/^07\d{8}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid Kenyan phone number required (07XXXXXXXX)' });
  }

  try {
    const token = await getAuthToken();
    let ipnId = registeredIpnId;
    if (!ipnId) {
      ipnId = await registerIpnUrl(token);
      registeredIpnId = ipnId;
      console.log(`✅ IPN registered with ID: ${ipnId}`);
    }

    const redirectUrl = await submitOrder(token, ipnId, {
      amount: parseFloat(amount).toFixed(2),
      description: `M-Pesa Payment KES ${amount}`,
      phone: phone,
      email: email,
    });

    res.json({ redirect_url: redirectUrl });
  } catch (error) {
    console.error('Payment initiation failed:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
});

app.post('/ipn', (req, res) => {
  console.log('📞 IPN received:', req.body);
  res.status(200).send('OK');
});

app.get('/payment-callback', (req, res) => {
  console.log('🔁 Payment callback:', req.query);
  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:2rem;">
      <h2>Payment Processing</h2>
      <p>Your payment is being processed. You will receive an SMS confirmation shortly.</p>
      <a href="https://summitsolutions28.github.io/C">Return to Merchant</a>
    </body></html>
  `);
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ PesaPal V3 backend running on port ${PORT}`);
  console.log(`   Production mode: ${IS_PRODUCTION ? 'YES (real money)' : 'Sandbox'}`);
});
