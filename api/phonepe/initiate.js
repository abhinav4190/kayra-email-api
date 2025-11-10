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
   const { orderId, amount, customerName, customerPhone, customerEmail, token, tokenType } = req.body; // Add tokenType if returning it

   if (!token) {
  return res.status(400).json({
    success: false,
    message: "OAuth token is required",
  });
}

    const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
    const PHONEPE_API_URL = process.env.PHONEPE_API_URL;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

    const merchantTransactionId = `TXN_${orderId}_${Date.now()}`;
    const merchantUserId = `USER_${customerPhone}`;

    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: merchantUserId,
      amount: amount * 100, // Convert to paise
      redirectUrl: `${BASE_URL}/payment/callback?orderId=${orderId}&merchantTxnId=${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${BASE_URL}/payment/callback?orderId=${orderId}&merchantTxnId=${merchantTransactionId}`,
      mobileNumber: customerPhone,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    // Call PhonePe payment API with OAuth token
const response = await fetch(`${PHONEPE_API_URL}/checkout/v2/pay`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`, // Or `${tokenType || "O-Bearer"} ${token}` if dynamic
    "X-MERCHANT-ID": MERCHANT_ID,
  },
  body: JSON.stringify(payload),
});

    const data = await response.json();

    if (data.success && data.data?.instrumentResponse?.redirectInfo?.url) {
      return res.json({
        success: true,
        data: data.data,
        merchantTransactionId,
      });
    } else {
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
}