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
    const PHONEPE_API_URL = process.env.PHONEPE_AUTH_URL;

    // Debug: Log environment variables (remove in production!)
    console.log("=== PhonePe Token Request Debug ===");
    console.log("CLIENT_ID:", CLIENT_ID ? "✓ Set" : "✗ Missing");
    console.log("CLIENT_SECRET:", CLIENT_SECRET ? "✓ Set" : "✗ Missing");
    console.log("PHONEPE_API_URL:", PHONEPE_API_URL);

    // Check if credentials are set
    if (!CLIENT_ID || !CLIENT_SECRET || !PHONEPE_API_URL) {
      return res.status(500).json({
        success: false,
        message: "PhonePe credentials not configured",
        debug: {
          hasClientId: !!CLIENT_ID,
          hasClientSecret: !!CLIENT_SECRET,
          hasApiUrl: !!PHONEPE_API_URL,
        },
      });
    }

const tokenUrl = `${PHONEPE_API_URL}/v1/oauth/token`;

    console.log("Token URL:", tokenUrl);

const requestBody = {
  grant_type: "client_credentials",
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
};

console.log("Request body (sanitized):", {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET.substring(0, 5) + "...",
});

    // Get OAuth token
const tokenResponse = await fetch(tokenUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CLIENT-VERSION": "v1",
  },
  body: JSON.stringify(requestBody),
});
console.log(await tokenResponse.text());

    console.log("Response status:", tokenResponse.status);
const tokenData = await tokenResponse.json();
console.log("PhonePe response:", JSON.stringify(tokenData, null, 2));

    if (tokenData.access_token) {
  console.log("✓ Token obtained successfully");
  return res.json({
    success: true,
    token: tokenData.access_token,
    tokenType: tokenData.token_type,
    expiresIn: tokenData.expires_in || 3600,
  });
} else {
  console.error("✗ Token request failed:", tokenData);
  return res.status(400).json({
    success: false,
    message: tokenData.message || "Failed to get OAuth token",
    details: tokenData,
  });
}

  } catch (error) {
    console.error("Token Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get OAuth token",
      error: error.message,
      stack: error.stack,
    });
  }
}