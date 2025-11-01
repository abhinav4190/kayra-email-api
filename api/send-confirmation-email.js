import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customer, orderId, items, total, paymentMethod } = req.body;

  // Set up Brevo SMTP transporter
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASS,
    },
  });

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

  try {
    await transporter.sendMail({
      from: "Kayra <contact@kayrainternational.com>",
      to: customer.email,
      subject: `Order Confirmation #${orderId}`,
      html: htmlContent,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
}
