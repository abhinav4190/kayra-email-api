// api/process-payment-success.js

const admin = require('firebase-admin');

// Initialize Firebase Admin (singleton pattern)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Set CORS headers FIRST
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("=== Payment Processing Started ===");
    console.log("Body:", JSON.stringify(req.body));

    const { orderId, merchantOrderId, transactionId } = req.body;

    // Validate input
    if (!orderId || !merchantOrderId) {
      console.log("Missing parameters");
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: orderId and merchantOrderId",
      });
    }

    console.log(`Searching for order: ${orderId}`);

    // Query Firestore
    const ordersRef = db.collection("orders");
    const snapshot = await ordersRef.where("orderId", "==", orderId).get();

    if (snapshot.empty) {
      console.log("Order not found in database");
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get first matching order
    const orderDoc = snapshot.docs[0];
    const orderData = orderDoc.data();

    console.log(`Found order. Current status: ${orderData.paymentStatus}`);

    // Update order
    await orderDoc.ref.update({
      paymentStatus: "completed",
      orderStatus: "confirmed",
      phonepeTransactionId: transactionId || "ASSUMED_SUCCESS",
      merchantOrderId: merchantOrderId,
      paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("Order updated successfully");

    // Send email asynchronously (don't block response)
    sendConfirmationEmail(orderData).catch(err => {
      console.error("Email send failed:", err.message);
    });

    // Return success
    return res.status(200).json({
      success: true,
      message: "Order processed successfully",
      orderId: orderId,
    });

  } catch (error) {
    console.error("=== Error in payment processing ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Server error while processing payment",
      error: error.message,
    });
  }
}

// Helper function to send confirmation email
async function sendConfirmationEmail(orderData) {
  try {
    const response = await fetch(
      "https://kayra-email-api.vercel.app/api/send-confirmation-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: orderData.customer?.name || "Customer",
            email: orderData.customer?.email || "",
          },
          orderId: orderData.orderId,
          items: orderData.items || [],
          total: orderData.total || 0,
          paymentMethod: "PhonePe",
        }),
      }
    );

    if (response.ok) {
      console.log("Confirmation email sent successfully");
    } else {
      console.error("Email API returned status:", response.status);
    }
  } catch (error) {
    console.error("Failed to send confirmation email:", error.message);
    // Don't throw - we don't want email failures to break payment processing
  }
}