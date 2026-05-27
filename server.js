const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

// Allow all origins for debugging (you can restrict later)
app.use(cors());
app.use(express.json());

// Hardcoded credentials (as you requested)
const PESAPAL_KEY = '5AnFeLarnnmT5+0KUUHuqF6LQKxg+J17';
const PESAPAL_SECRET = 'EfNwwzvSJcnsMix1uNDLOVHf0jA=';

app.post('/initiate-payment', async (req, res) => {
  const { amount, phone } = req.body;
  if (amount !== 10) return res.status(400).json({ error: 'Amount must be 10 KES' });
  if (!phone || !/^07\d{8}$/.test(phone)) return res.status(400).json({ error: 'Valid Kenyan phone required (07XXXXXXXX)' });

  const pesapalUrl = 'https://www.pesapal.com/api/PostPesapalDirectOrderV4';
  const merchantRef = `ORDER_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  let mpesaPhone = phone.replace(/^07/, '254');
  
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
    // 🔥 SEND THE REAL ERROR TO THE FRONTEND
    let errorDetail = 'Unknown error';
    if (error.response) {
      // The request was made and the server responded with a status code outside 2xx
      errorDetail = `HTTP ${error.response.status}: ${error.response.data}`;
    } else if (error.request) {
      errorDetail = 'No response from PesaPal (network error)';
    } else {
      errorDetail = error.message;
    }
    console.error('Full error:', errorDetail);
    res.status(500).json({ error: errorDetail });
  }
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
