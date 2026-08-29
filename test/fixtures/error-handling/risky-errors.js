const express = require('express');
const app = express();

// Async route without try/catch
app.get('/api/data', async (req, res) => {
  const data = await Promise.reject(new Error('fail'));
  res.json(data);
});

function processItems() {
  // Empty catch block
  try {
    throw new Error('something bad');
  } catch (err) {
  }

  // Floating unhandled promise
  fetch('https://api.example.com/webhook');
}

module.exports = { app, processItems };
