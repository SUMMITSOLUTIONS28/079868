const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ========== REPLACE WITH YOUR NEW KEYS (after revoking old ones) ==========
const CONSUMER_KEY = "5AnFeLarnnmT5+0KUUHuqF6LQKxg+J17";
const CONSUMER_SECRET = "EfNwwzvSJCnsMix1uNDLOVHf0jA=";
// For sandbox testing: use "https://cybqa.pesapal.com/pesapalv3"
// For live: use "https://pay.pesapal.com/v3"
const PESAPAL_ENV = "https://pay.pesapal.com/v3";
// ==========================================================================

// Helper: Get OAuth token
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
        const { phone, amount } = req.body;

        // Enforce exactly 2 KSH (prevents any tampering)
        if (amount !== 2.00) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        if (!phone.match(/^(07|01)\d{8}$/)) {
            return res.status(400).json({ success: false, message: "Invalid phone number" });
        }

        const token = await getAccessToken();

        const orderId = crypto.randomBytes(16).toString('hex');

        const payload = {
            id: orderId,
            currency: "KES",
            amount: 2.00,
            description: "Payment of 2 KSH",
            callback_url: "https://your-backend.onrender.com/callback", // optional
            notification_id: null,
            billing_address: {
                email_address: "customer@example.com",
                phone_number: phone,
                country_code: "KE",
                first_name: "Customer",
                last_name: "M-Pesa"
            }
        };

        const submitResponse = await axios.post(
            `${PESAPAL_ENV}/api/Transactions/SubmitOrderRequest`,
            payload,
            { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' } }
        );

        if (submitResponse.data.status === "200" || submitResponse.data.status === "PENDING") {
            return res.json({ success: true, message: "STK Push sent" });
        } else {
            return res.status(500).json({ success: false, message: "PesaPal error: " + JSON.stringify(submitResponse.data) });
        }
    } catch (error) {
        console.error(error.response?.data || error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// Optional callback endpoint
app.post('/callback', (req, res) => {
    console.log("Payment callback:", req.body);
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
