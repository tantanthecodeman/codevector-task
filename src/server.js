
const express = require('express');
const cors = require('cors');
const path = require('path');
const productsRouter = require('./routes/products');

const app = express();

app.use(cors()); 
app.use(express.static(path.join(__dirname, '..', 'public'))); 

app.use('/api', productsRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
