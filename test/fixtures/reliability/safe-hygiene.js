const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: 'https://app.example.com',
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api', limiter);

app.get('/api/users', (req, res) => {
  res.json([]);
});

app.listen(3000);

module.exports = app;
