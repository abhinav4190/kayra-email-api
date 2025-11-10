// api/process-payment-success.js

import admin from 'firebase-admin';

// Initialize Firebase Admin (with proper error handling)
function initializeFirebase() {
  if (admin.apps.length) {
    return admin.firestore();
  }

  try {
    // Get the private key and handle the newlines properly
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Replace literal \n with actual newlines
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

    console.log('Firebase Admin initialized successfully');
    return admin.firestore();
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // IMPORTANT: Set CORS headers BEFORE anything else
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight');
    return res.status(200).end();
  }

  // Only allow POST for actual requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  let db;

  try {
    console.log('=== Starting payment processing ===');
    console.log('Request body:', JSON.stringify(req.body));

    // Initialize Firebase
    db = initializeFirebase();

    const { orderId, merchantOrderId, transactionId } = req.body;

    // Validate required fields
    if (!orderId || !merchantOrderId) {
      console.log('Missing required parameters');
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: orderId and merchantOrderId',
      });
    }

    console.log(`Querying Firestore for order: ${orderId}`);

    // Query Firestore for the order
    const ordersRef = db.collection('orders');
    const querySnapshot = await ordersRef
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      console.log('Order not found in database');
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Get the order document
    const orderDoc = querySnapshot.docs[0];
    const orderData = orderDoc.data();

    console.log(`Found order. Current payment status: ${orderData.paymentStatus}`);

    // Update the order in Firestore
    await orderDoc.ref.update({
      paymentStatus: 'completed',
      orderStatus: 'confirmed',
      phonepeTransactionId: transactionId || 'ASSUMED_SUCCESS',
      merchantOrderId: merchantOrderId,
      paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Order successfully updated in Firestore');

    // Send confirmation email (non-blocking)
    sendConfirmationEmail(orderData).catch(err => {
      console.error('Email sending failed (non-critical):', err.message);
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Order processed successfully',
      orderId: orderId,
    });

  } catch (error) {
    console.error('=== Payment Processing Error ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      success: false,
      message: 'Server error while processing payment',
      error: error.message,
      errorType: error.name,
    });
  }
}

// Helper function to send confirmation email (async, non-blocking)
async function sendConfirmationEmail(orderData) {
  try {
    console.log('Attempting to send confirmation email...');

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
      console.log('Confirmation email sent successfully');
    } else {
      const errorText = await response.text();
      console.error(`Email API error (${response.status}):`, errorText);
    }
  } catch (error) {
    console.error('Email sending error:', error.message);
    // Don't throw - email failures shouldn't break payment processing
  }
}