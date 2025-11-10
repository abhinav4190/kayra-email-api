const allowedOrigins = [
  "https://kayra-two.vercel.app",
  "https://kayrainternational.com",
  "http://localhost:3000",
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId, amount, customerName, customerPhone, customerEmail, token, tokenType } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "OAuth token is required",
      });
    }

    const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
    const PHONEPE_API_URL = process.env.PHONEPE_API_URL;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

    const merchantOrderId = `TXN_${orderId}_${Date.now()}`; // Use this as merchantOrderId (V2 naming)

    const payload = {
      merchantOrderId: merchantOrderId,
      amount: amount * 100, // In paise
      expireAfter: 1800, // Optional: 30 minutes expiry (in seconds)
      metaInfo: { // Optional: Store customer info as UDFs
        udf1: customerName,
        udf2: customerPhone,
        udf3: customerEmail,
      },
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: "Payment for order", // Optional
        merchantUrls: {
          redirectUrl: `${BASE_URL}/payment/callback?orderId=${orderId}&merchantOrderId=${merchantOrderId}`,
        },
        // paymentModeConfig: { ... } // Optional: Add if you want to enable/disable specific instruments (e.g., UPI, cards)
      },
    };

    // Call PhonePe payment API with OAuth token
    const response = await fetch(`${PHONEPE_API_URL}/checkout/v2/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `O-Bearer ${token}`, // Use O-Bearer as per docs
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.redirectUrl) { // V2 success check
      return res.json({
        success: true,
        data,
        merchantOrderId, // Return for client-side use
      });
    } else {
      console.error("PhonePe response:", data);
      return res.status(400).json({
        success: false,
        message: data.message || "Payment initiation failed",
      });
    }
  } catch (error) {
    console.error("PhonePe API Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};