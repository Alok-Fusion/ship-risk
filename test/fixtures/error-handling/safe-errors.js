const express = require('express');
const app = express();

app.get('/api/data', async (req, res, next) => {
  try {
    const data = await Promise.resolve({ ok: true });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

async function processItems() {
  try {
    const res = await fetch('https://api.example.com/webhook');
    return res.json();
  } catch (err) {
    console.error('Failed to webhook:', err);
    throw err;
  }
}

module.exports = { app, processItems };
