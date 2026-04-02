const express = require('express');
const path = require('path');
const cors = require('cors');
const speedRoutes = require('./routes/speed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));
app.use('/api', speedRoutes);
app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NetPulse Real running at http://localhost:${PORT}`);
});
