// api/process-payment-success.js

const { adminDb } = require('../lib/firebase-admin');

export default async function handler(req, res) {
  // CORS headers - set these FIRST before anything else
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    origin: req.headers.origin,
    body: req.body
  };

  try {
    console.log("=== Payment Processing Start ===", JSON.stringify(logData));

    const { orderId, merchantOrderId, transactionId } = req.body;

    if (!orderId || !merchantOrderId) {
      console.log("Missing parameters");
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    console.log(`Looking for order: ${orderId}`);

    // Check if adminDb is initialized
    if (!adminDb) {
      console.error("Firebase Admin not initialized!");
      return res.status(500).json({
        success: false,
        message: "Database connection error",
      });
    }

    const ordersRef = adminDb.collection("orders");
    const q = ordersRef.where("orderId", "==", orderId);
    const querySnapshot = await q.get();

    console.log(`Query returned ${querySnapshot.size} documents`);

    if (querySnapshot.empty) {
      console.log("Order not found");
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const orderDoc = querySnapshot.docs[0];
    const orderData = orderDoc.data();

    console.log("Updating order document...");

    await orderDoc.ref.update({
      paymentStatus: "completed",
      orderStatus: "confirmed",
      phonepeTransactionId: transactionId || "ASSUMED_SUCCESS",
      merchantOrderId: merchantOrderId,
      paymentCompletedAt: new Date(),
    });

    console.log("Order updated successfully");

    // Send email asynchronously (don't wait)
    sendConfirmationEmail(orderData).catch(err => 
      console.error("Email failed:", err)
    );

    return res.status(200).json({
      success: true,
      message: "Order processed successfully",
    });

  } catch (error) {
    console.error("=== Processing Error ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
      errorType: error.name
    });
  }
}

async function sendConfirmationEmail(orderData) {
  try {
    const response = await fetch(
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
    
    if (!response.ok) {
      throw new Error(`Email API returned ${response.status}`);
    }
    
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Email error:", error);
  }
}