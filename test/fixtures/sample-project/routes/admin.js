const express = require('express');
const router = express.Router();
const db = require('../services/db');

// No auth guard, raw SQL concatenation
router.get('/api/admin/users', (req, res) => {
  const filter = req.query.filter;
  const sql = "SELECT * FROM users WHERE role = '" + filter + "'";
  db.query(sql);
  res.json({ ok: true });
});

module.exports = router;
