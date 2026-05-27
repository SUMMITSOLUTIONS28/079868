const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

// CORS configuration
const allowedOrigins = ['https://summitsolutions28.github.io', 'https://zero79868.onrender.com'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

const PESAPAL_KEY = process.env.PESAPAL_CONSUMER_KEY || '5AnFeLarnnmT5+0KUUHuqF6LQKxg+J17';
const PESAPAL_SECRET = process.env.PESAPAL_CONSUMER_SECRET;

app.post('/initiate-payment', async (req, res) => {
  const { amount, phone } = req.body;
  if (amount !== 10) return res.status(400).json({ error: 'Amount must be exactly 10 KES' });
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

  console.log('Sending request to PesaPal...');
  console.log('Phone (converted):', mpesaPhone);
  console.log('Merchant ref:', merchantRef);

  try {
    const response = await axios.post(pesapalUrl, xml, {
      headers: { 'Content-Type': 'application/xml', 'Authorization': authHeader }
    });
    console.log('PesaPal response status:', response.status);
    console.log('PesaPal response data:', response.data);
    const redirectMatch = response.data.match(/<RedirectURL>(.*?)<\/RedirectURL>/);
    if (!redirectMatch) throw new Error('No redirect URL from PesaPal');
    res.json({ redirect_url: redirectMatch[1] });
  } catch (error) {
    // Log the full error for debugging
    console.error('PesaPal error details:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
    res.status(500).json({ error: 'Payment gateway error. Check logs for details.' });
  }
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
