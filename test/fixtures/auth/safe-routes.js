const express = require('express');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.headers.authorization) return res.status(401).send();
  next();
}

function checkAdminRole(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).send();
}

router.get('/api/admin/users', requireAuth, checkAdminRole, (req, res) => {
  res.json({ users: ['admin'] });
});

router.post('/api/billing/charge', requireAuth, (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
