const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
// Serve static files from the current directory (so index.html is accessible)
app.use(express.static(__dirname));

// ========== YOUR TEST KEYS (sandbox) ==========
const CONSUMER_KEY = "5AnFeLarnnmT5+0KUUHuqF6LQKxg+J17";
const CONSUMER_SECRET = "EfNwwzvSJcnsMix1uNDLOVHf0jA=";
const PESAPAL_ENV = "https://cybqa.pesapal.com/pesapalv3";
// ==============================================

async function getAccessToken() {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
    const response = await axios.post(
        `${PESAPAL_ENV}/api/Auth/RequestToken`,
        {},
        { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
    );
    return response.data.token;
}

app.post('/initiate-payment', async (req, res) => {
    try {
        let { phone, amount } = req.body;

        // Enforce exactly 2 KSH (security)
        if (Math.abs(amount - 2.00) > 0.01) {
            return res.status(400).json({ success: false, message: "Only 2 KSH allowed." });
        }

        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '254' + cleanPhone.substring(1);
        if (!cleanPhone.startsWith('254')) cleanPhone = '254' + cleanPhone;
        if (!cleanPhone.match(/^2547\d{8}$/) && !cleanPhone.match(/^2541\d{8}$/)) {
            return res.status(400).json({ success: false, message: "Invalid Kenyan phone number" });
        }

        const token = await getAccessToken();
        const orderId = crypto.randomBytes(16).toString('hex');
        
        const payload = {
            id: orderId,
            currency: "KES",
            amount: 2.00,
            description: "Payment of 2 KSH (sandbox)",
            callback_url: "https://your-render-url.onrender.com/callback", // Replace after deploy
            notification_id: null,
            billing_address: {
                email_address: "test@example.com",
                phone_number: cleanPhone,
                country_code: "KE",
                first_name: "Test",
                last_name: "User"
            }
        };
        
        const submitResponse = await axios.post(
            `${PESAPAL_ENV}/api/Transactions/SubmitOrderRequest`,
            payload,
            { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' } }
        );
        
        if (submitResponse.data.status === "200" || submitResponse.data.status === "PENDING" || submitResponse.data.status === "SUBMITTED") {
            return res.json({ success: true, message: "STK Push sent", orderId });
        } else {
            return res.status(500).json({ success: false, message: "PesaPal error: " + JSON.stringify(submitResponse.data) });
        }
    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Internal server error. Check logs." });
    }
});

// Dummy callback
app.post('/callback', (req, res) => {
    console.log("Callback received:", req.body);
    res.sendStatus(200);
});

// Default route to serve index.html (optional, but express.static already does it)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
