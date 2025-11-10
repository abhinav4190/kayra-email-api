// api/test-firebase.js

import admin from 'firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Initialize if not already done
    if (!admin.apps.length) {
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
    }

    const db = admin.firestore();
    
    // Try to query orders collection
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.limit(1).get();
    
    return res.status(200).json({
      success: true,
      message: 'Firebase Admin initialized and working!',
      ordersCollectionExists: !snapshot.empty,
      documentCount: snapshot.size,
      firebaseInitialized: admin.apps.length > 0,
    });
    
  } catch (error) {
    console.error('Firebase test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      errorName: error.name,
      stack: error.stack,
    });
  }
}