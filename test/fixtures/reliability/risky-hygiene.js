const express = require('express');
const cors = require('cors');
const app = express();

// Wildcard CORS
app.use(cors({ origin: '*' }));

// Missing rate limiting and helmet in this Express app!

app.get('/api/users', (req, res) => {
  // Leftover console logs in production path
  console.log('Fetching all users from database...');
  console.debug('User query debug payload:', req.headers);
  res.json([]);
});

app.listen(3000);

module.exports = app;
