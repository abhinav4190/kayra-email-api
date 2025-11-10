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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { merchantTransactionId, token } = req.query;

    if (!merchantTransactionId) {
      return res.status(400).json({
        success: false,
        message: "Merchant Transaction ID is required",
      });
    }

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "OAuth token is required",
      });
    }

    const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
    const PHONEPE_API_URL = process.env.PHONEPE_API_URL;

    // Check payment status with PhonePe
    const response = await fetch(
      `${PHONEPE_API_URL}/v2/status/${MERCHANT_ID}/${merchantTransactionId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-MERCHANT-ID": MERCHANT_ID,
        },
      }
    );

    const data = await response.json();

    return res.json({
      success: data.success,
      code: data.code,
      message: data.message,
      data: data.data,
    });
  } catch (error) {
    console.error("Verification Error:", error);
    return res.status(500).json({
      success: false,
      message: "Verification failed",
      error: error.message,
    });
  }
}