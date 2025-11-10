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
    const CLIENT_ID = process.env.PHONEPE_CLIENT_ID;
    const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET;
    const PHONEPE_API_URL = process.env.PHONEPE_API_URL;

    // Get OAuth token
    const tokenResponse = await fetch(`${PHONEPE_API_URL}/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.success && tokenData.data?.token) {
      return res.json({
        success: true,
        token: tokenData.data.token,
        expiresIn: tokenData.data.expiresIn || 3600,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: tokenData.message || "Failed to get OAuth token",
      });
    }
  } catch (error) {
    console.error("Token Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get OAuth token",
      error: error.message,
    });
  }
}
