// api/process-payment-success.js

const allowedOrigins = [
  "https://kayra-two.vercel.app",
  "https://kayrainternational.com",
  "https://www.kayrainternational.com", // Added with www
  "http://localhost:3000",
];

const { adminDb } = require('../lib/firebase-admin'); // Adjust path

export default async function handler(req, res) {
  const origin = req.headers.origin;
  console.log(`Received request method: ${req.method}, Origin: ${origin || 'none'}`); // Debug log

  // Temporarily allow all origins for testing (comment out after confirming)
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Production version (uncomment after test):
  // if (allowedOrigins.includes(origin)) {
  //   res.setHeader("Access-Control-Allow-Origin", origin);
  // } else {
  //   console.log(`Origin not allowed: ${origin}`); // Debug if mismatch
  //   return res.status(403).json({ error: "Origin not allowed" });
  // }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    console.log("Handled OPTIONS preflight"); // Debug log
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId, merchantOrderId, transactionId } = req.body;
    console.log(`Received body: ${JSON.stringify(req.body)}`); // Debug log

    if (!orderId || !merchantOrderId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Find and update the order in Firestore using admin SDK
    const ordersRef = adminDb.collection("orders");
    const q = ordersRef.where("orderId", "==", orderId);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const orderDoc = querySnapshot.docs[0];
    const orderData = orderDoc.data();

    await orderDoc.ref.update({
      paymentStatus: "completed",
      orderStatus: "confirmed",
      phonepeTransactionId: transactionId || "ASSUMED_SUCCESS",
      merchantOrderId: merchantOrderId,
      paymentCompletedAt: new Date(),
    });

    // Send order confirmation email
    try {
      const emailResponse = await fetch(
        "https://kayra-email-api.vercel.app/api/send-confirmation-email",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: {
              name: orderData.customer.name,
              email: orderData.customer.email,
            },
            orderId: orderData.orderId,
            items: orderData.items,
            total: orderData.total,
            paymentMethod: "PhonePe",
          }),
        }
      );

      if (!emailResponse.ok) {
        console.error("Email send failed");
      }
    } catch (emailErr) {
      console.error("Failed to send confirmation email:", emailErr);
    }

    return res.json({
      success: true,
      message: "Order processed successfully",
    });
  } catch (error) {
    console.error("Processing Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};