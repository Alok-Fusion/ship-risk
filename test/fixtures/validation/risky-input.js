const express = require('express');
const app = express();
const db = require('./db');

app.post('/api/users', (req, res) => {
  // Direct unvalidated body access
  const username = req.body.username;
  const role = req.body.role;

  // Raw SQL string concatenation
  const query = "SELECT * FROM users WHERE username = '" + username + "'";
  db.query(query);

  // Raw SQL template literal
  const id = req.query.id;
  db.query(`SELECT * FROM profiles WHERE id = ${id}`);

  // Dangerous eval
  eval("console.log('" + req.body.cmd + "')");

  res.send('done');
});

module.exports = app;
