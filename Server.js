const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

// Your PesaPal credentials (will use env vars or fallback to your keys)
const PESAPAL_KEY = process.env.PESAPAL_CONSUMER_KEY || '5AnFeLarnnmT5+0KUUHuqF6LQKxg+J17';
const PESAPAL_SECRET = process.env.PESAPAL_CONSUMER_SECRET || 'EfNwwzvSJcnsMix1uNDLOVHf0jA=';

app.post('/initiate-payment', async (req, res) => {
  const { amount, phone } = req.body;
  if (amount !== 10) return res.status(400).json({ error: 'Amount must be exactly 10 KES' });
  if (!phone || !/^07\d{8}$/.test(phone)) return res.status(400).json({ error: 'Valid Kenyan phone number required (07XXXXXXXX)' });

  const pesapalUrl = 'https://www.pesapal.com/api/PostPesapalDirectOrderV4';
  const merchantRef = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  
  let mpesaPhone = phone;
  if (mpesaPhone.startsWith('07')) mpesaPhone = '254' + mpesaPhone.substring(1);
  
  const xml = `<?xml version="1.0" encoding="utf-8"?>
    <PesapalDirectOrderInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      Amount="10.00" Currency="KES" Description="M-Pesa Payment" Type="MERCHANT"
      Reference="${merchantRef}" FirstName="Customer" LastName="Payment"
      Email="customer@example.com" PhoneNumber="${mpesaPhone}"
      xmlns="http://www.pesapal.com" />`;

  const oauth_nonce = crypto.randomBytes(16).toString('hex');
  const oauth_timestamp = Math.floor(Date.now() / 1000).toString();
  const baseString = `POST&${encodeURIComponent(pesapalUrl)}&${encodeURIComponent(
    `oauth_consumer_key=${PESAPAL_KEY}&oauth_nonce=${oauth_nonce}&oauth_signature_method=HMAC-SHA1&oauth_timestamp=${oauth_timestamp}&oauth_version=1.0`
  )}`;
  const signingKey = `${PESAPAL_SECRET}&`;
  const oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  const authHeader = `OAuth oauth_consumer_key="${PESAPAL_KEY}", oauth_nonce="${oauth_nonce}", oauth_signature="${encodeURIComponent(oauth_signature)}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${oauth_timestamp}", oauth_version="1.0"`;

  try {
    const response = await axios.post(pesapalUrl, xml, {
      headers: { 'Content-Type': 'application/xml', 'Authorization': authHeader }
    });
    const redirectMatch = response.data.match(/<RedirectURL>(.*?)<\/RedirectURL>/);
    if (!redirectMatch) throw new Error('No redirect URL from PesaPal');
    res.json({ redirect_url: redirectMatch[1] });
  } catch (error) {
    console.error('PesaPal error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Payment gateway error. Please try again.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Payment backend running on port ${PORT}`));
