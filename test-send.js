import handler from "./api/send-confirmation-email.js";

// Dummy request + response objects
const req = {
  method: "POST",
  headers: { origin: "http://localhost:3000" }, 
  body: {
    customer: { name: "Abhinav", email: "abhinavsinghabhi56@gmail.com" },
    orderId: "12345",
    items: [
      { name: "T-shirt", quantity: 1, price: 499, total: 499 },
      { name: "Jeans", quantity: 1, price: 999, total: 999 },
    ],
    total: 1498,
    paymentMethod: "COD",
  },
};

const res = {
  setHeader: (key, value) => {
    console.log(`Header set: ${key} = ${value}`);
  },
  status: (code) => ({
    json: (data) => console.log("Response:", code, data),
  }),
  json: (data) => console.log("Response:", data),
};


await handler(req, res);
