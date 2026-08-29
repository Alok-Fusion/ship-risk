const express = require('express');
const app = express();
const adminRoutes = require('./routes/admin');
const billingRoutes = require('./routes/billing');

app.use(express.json());
app.use(adminRoutes);
app.use(billingRoutes);

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
