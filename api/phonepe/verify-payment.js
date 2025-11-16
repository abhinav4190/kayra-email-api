// api/phonepe/verify-payment.js

import admin from 'firebase-admin';

// Initialize Firebase Admin
function initializeFirebase() {
  if (admin.apps.length) {
    return admin.firestore();
  }

  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey && privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });

    return admin.firestore();
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

const allowedOrigins = [
  "https://kayra-two.vercel.app",
  "https://kayrainternational.com",
  "https://www.kayrainternational.com",
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

  let db;

  try {
    const { orderId, merchantOrderId, token } = req.body;
    console.log(`Verifying payment for order: ${orderId}, merchantOrderId: ${merchantOrderId}`);

    if (!merchantOrderId || !orderId || !token) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters",
      });
    }

    const PHONEPE_API_URL = process.env.PHONEPE_API_URL;

    // CRITICAL: Check actual payment status with PhonePe
    const response = await fetch(
      `${PHONEPE_API_URL}/checkout/v2/order/${merchantOrderId}/status?details=true`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `O-Bearer ${token}`,
        },
      }
    );

    console.log(`PhonePe API response status: ${response.status}`);

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: "Failed to verify payment with PhonePe",
      });
    }

    const data = await response.json();
    console.log('PhonePe verification response:', JSON.stringify(data, null, 2));

    // Check if payment is actually completed
    const isSuccess = data.state === "COMPLETED";

    if (!isSuccess) {
      console.log(`Payment not completed. State: ${data.state}`);
      return res.json({
        success: false,
        paymentStatus: data.state, // Could be PENDING, FAILED, etc.
        code: data.code,
        message: data.message || "Payment was not completed",
        data: data,
      });
    }

    // Payment is successful - update Firestore
    db = initializeFirebase();
    
    const ordersRef = db.collection("orders");
    const querySnapshot = await ordersRef
      .where("orderId", "==", orderId)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderDoc = querySnapshot.docs[0];
    
    // Update order status
    await orderDoc.ref.update({
      paymentStatus: "completed",
      orderStatus: "confirmed",
      phonepeTransactionId: data.transactionId || merchantOrderId,
      merchantOrderId: merchantOrderId,
      paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Order updated successfully');

    // Send confirmation email (non-blocking)
    const orderData = orderDoc.data();
    sendConfirmationEmail(orderData).catch(err => {
      console.error('Email sending failed:', err.message);
    });

    return res.json({
      success: true,
      paymentStatus: "COMPLETED",
      code: data.code,
      message: "Payment verified and order confirmed",
      data: data,
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

// Helper function to send confirmation email
async function sendConfirmationEmail(orderData) {
  try {
    const emailPayload = {
      customer: {
        name: orderData.customer?.name || 'Customer',
        email: orderData.customer?.email || '',
      },
      orderId: orderData.orderId || '',
      items: orderData.items || [],
      total: orderData.total || 0,
      paymentMethod: 'PhonePe',
    };

    const response = await fetch(
      'https://kayra-email-api.vercel.app/api/send-confirmation-email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      }
    );

    if (response.ok) {
      console.log('Confirmation email sent');
    }
  } catch (error) {
    console.error('Email error:', error.message);
  }
}