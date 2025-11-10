// api/process-payment-success.js

const allowedOrigins = [
  "https://kayra-two.vercel.app",
  "https://kayrainternational.com",
  "https://www.kayrainternational.com",
  "http://localhost:3000",
];

const { adminDb } = require('../lib/firebase-admin');

export default async function handler(req, res) {
  const origin = req.headers.origin;
  console.log(`Received request method: ${req.method}, Origin: ${origin || 'none'}`);

  // IMPORTANT: Set CORS headers FIRST, before any other logic
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // For testing, allow all origins temporarily
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle OPTIONS preflight request
  if (req.method === "OPTIONS") {
    console.log("Handled OPTIONS preflight");
    return res.status(200).end();
  }

  // Only POST allowed for actual request
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId, merchantOrderId, transactionId } = req.body;
    console.log(`Processing payment for order: ${orderId}`);

    if (!orderId || !merchantOrderId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    // Find and update the order in Firestore
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

    // Update order status
    await orderDoc.ref.update({
      paymentStatus: "completed",
      orderStatus: "confirmed",
      phonepeTransactionId: transactionId || "ASSUMED_SUCCESS",
      merchantOrderId: merchantOrderId,
      paymentCompletedAt: new Date(),
    });

    // Send confirmation email (non-blocking)
    fetch(
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
    ).catch(err => console.error("Email send failed:", err));

    return res.status(200).json({
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
}