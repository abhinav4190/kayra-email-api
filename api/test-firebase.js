// api/test-firebase.js

const admin = require('firebase-admin');

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Try to initialize Firebase
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
    
    // Try a simple query
    const testQuery = await db.collection('orders').limit(1).get();
    
    return res.status(200).json({
      success: true,
      message: "Firebase Admin works!",
      docsFound: testQuery.size,
      adminInitialized: admin.apps.length > 0
    });
    
  } catch (error) {
    console.error("Firebase error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}