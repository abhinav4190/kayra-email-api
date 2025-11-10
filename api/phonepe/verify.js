// const allowedOrigins = [
//   "https://kayra-two.vercel.app",
//   "https://kayrainternational.com",
//   "https://www.kayrainternational.com", // Added with www in case
//   "http://localhost:3000",
// ];

// const { adminDb } = require('../../lib/firebase-admin'); // Adjust path as needed

// export default async function handler(req, res) {
//   const origin = req.headers.origin;
//   console.log(`Received origin: ${origin}`); // Debug log
//   if (allowedOrigins.includes(origin)) {
//     res.setHeader("Access-Control-Allow-Origin", origin);
//   } else {
//     console.log(`Origin not allowed: ${origin}`); // Debug log
//   }
//   res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
//   res.setHeader("Access-Control-Allow-Headers", "Content-Type");

//   if (req.method === "OPTIONS") {
//     return res.status(200).end();
//   }

//   if (req.method !== "POST") {
//     return res.status(405).json({ error: "Method not allowed" });
//   }

//   try {
//     const { orderId, merchantOrderId, token } = req.body;
//     console.log(`Received body: ${JSON.stringify(req.body)}`); // Debug log

//     if (!merchantOrderId) {
//       return res.status(400).json({
//         success: false,
//         message: "Merchant Order ID is required",
//       });
//     }

//     if (!orderId) {
//       return res.status(400).json({
//         success: false,
//         message: "Order ID is required",
//       });
//     }

//     if (!token) {
//       return res.status(400).json({
//         success: false,
//         message: "OAuth token is required",
//       });
//     }

//     const PHONEPE_API_URL = process.env.PHONEPE_API_URL;

//     // Check payment status with PhonePe
//     const response = await fetch(
//       `${PHONEPE_API_URL}/checkout/v2/order/${merchantOrderId}/status?details=true`,
//       {
//         method: "GET",
//         headers: {
//           "Content-Type": "application/json",
//           "Authorization": `O-Bearer ${token}`,
//         },
//       }
//     );

//     console.log(`PhonePe status: ${response.status}`); // Debug log

//     const data = await response.json();

//     const isSuccess = data.state === "COMPLETED";

//     if (isSuccess) {
//       // Find and update the order in Firestore using admin SDK
//       const ordersRef = adminDb.collection("orders");
//       const q = ordersRef.where("orderId", "==", orderId);
//       const querySnapshot = await q.get();

//       if (querySnapshot.empty) {
//         return res.status(404).json({
//           success: false,
//           message: "Order not found.",
//         });
//       }

//       const orderDoc = querySnapshot.docs[0];
//       await orderDoc.ref.update({
//         paymentStatus: "completed",
//         orderStatus: "confirmed",
//         phonepeTransactionId: data.transactionId,
//         merchantOrderId: merchantOrderId,
//         paymentCompletedAt: new Date(),
//       });
//     }

//     return res.json({
//       success: isSuccess,
//       code: data.code,
//       message: data.message,
//       data: data,
//     });
//   } catch (error) {
//     console.error("Verification Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Verification failed",
//       error: error.message,
//     });
//   }
// };