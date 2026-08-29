const express = require('express');
const { z } = require('zod');
const app = express();
const db = require('./db');

const UserSchema = z.object({
  username: z.string().min(3),
  role: z.enum(['admin', 'user']),
});

app.post('/api/users', (req, res) => {
  const result = UserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json(result.error);
  }

  // Parameterized SQL query
  db.query('SELECT * FROM users WHERE username = $1', [result.data.username]);

  res.send('ok');
});

module.exports = app;
