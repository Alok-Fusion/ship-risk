const express = require('express');
const router = express.Router();

// Sensitive routes with NO auth middleware
router.get('/api/admin/users', (req, res) => {
  res.json({ users: ['admin', 'alice'] });
});

router.post('/api/billing/charge', (req, res) => {
  res.json({ status: 'charged' });
});

router.delete('/api/admin/delete-database', (req, res) => {
  // Missing role check as well!
  res.json({ deleted: true });
});

// General api route with no auth
router.get('/api/data', (req, res) => {
  res.json({ data: 123 });
});

module.exports = router;
