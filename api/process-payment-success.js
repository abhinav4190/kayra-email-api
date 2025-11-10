// api/process-payment-success.js

const admin = require('firebase-admin');

// Initialize Firebase Admin (with singleton pattern)
function getAdminDb() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error) {
      console.error("Firebase initialization error:", error);
      throw error;
    }
  }
  return admin.firestore();
}

export default async function handler(req, res) {
  // CORS headers FIRST
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Starting payment processing...");
    
    const { orderId, merchantOrderId, transactionId } = req.body;

    if (!orderId || !merchantOrderId) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    console.log(`Processing order: ${orderId}`);

    // Get Firebase Admin instance
    const adminDb = getAdminDb();
    
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

    console.log("Updating order status...");

    await orderDoc.ref.update({
      paymentStatus: "completed",
      orderStatus: "confirmed",
      phonepeTransactionId: transactionId || "ASSUMED_SUCCESS",
      merchantOrderId: merchantOrderId,
      paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("Order updated successfully");

    // Send email (non-blocking)
    sendEmailAsync(orderData);

    return res.status(200).json({
      success: true,
      message: "Order processed successfully",
    });

  } catch (error) {
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      message: "Server error: " + error.message,
    });
  }
}

// Non-blocking email function
function sendEmailAsync(orderData) {
  fetch("https://kayra-email-api.vercel.app/api/send-confirmation-email", {
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
  })
  .then(res => console.log("Email sent:", res.ok))
  .catch(err => console.error("Email error:", err));
}