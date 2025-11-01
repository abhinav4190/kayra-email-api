import SibApiV3Sdk from "sib-api-v3-sdk";
import "dotenv/config";

export default async function handler(req, res) {
  // ✅ Add allowed origins
  const allowedOrigins = [
    "https://kayra-two.vercel.app",  // main site
    "https://kayrainternational.com/", 
    "http://localhost:3000",         // local dev
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Block other HTTP methods
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer, orderId, items, total, paymentMethod } = req.body;

  // Configure Brevo
  const client = SibApiV3Sdk.ApiClient.instance;
  const apiKey = client.authentications["api-key"];
  apiKey.apiKey = process.env.BREVO_API_KEY;

  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

  // Build items table
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>₹${item.price}</td>
        <td>₹${item.total}</td>
      </tr>`
    )
    .join("");

  const htmlContent = `
    <h2>Hey ${customer.name}, your order #${orderId} is confirmed 🎉</h2>
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
      ${itemsHtml}
    </table>
    <h3>Total: ₹${total}</h3>
    <p>Payment Method: ${paymentMethod}</p>
    <p>Thanks for shopping with Kayra 💛</p>
  `;

  // Create email
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.sender = { name: "Kayra", email: "contact@kayrainternational.com" };
  sendSmtpEmail.to = [{ email: customer.email, name: customer.name }];
  sendSmtpEmail.subject = `Order Confirmation #${orderId}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Email sent successfully:", data);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Brevo API error:", error.response?.body || error);
    res.status(500).json({ error: "Failed to send email" });
  }
}
