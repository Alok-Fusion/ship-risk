const express = require('express');
const router = express.Router();

// Line 6 in billing.js
// Hardcoded token + missing auth
const billingApiKey = "sk_test_mockkey9876543210zyxwvutsrqpo";

router.post('/api/billing/charge', async (req, res) => {
  // Async route without try catch + unvalidated body
  const amount = req.body.amount;
  console.log('Charging amount:', amount);
  res.json({ charged: amount });
});

module.exports = router;
