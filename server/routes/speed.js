const express = require('express');
const crypto = require('crypto');

const router = express.Router();

router.get('/ping', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, ts: Date.now() });
});

router.get('/download', (req, res) => {
  const sizeMB = Math.max(1, Math.min(parseInt(req.query.sizeMB, 10) || 20, 100));
  const totalBytes = sizeMB * 1024 * 1024;
  const chunkSize = 256 * 1024;
  let sent = 0;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', totalBytes);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  function writeChunk() {
    while (sent < totalBytes) {
      const remaining = totalBytes - sent;
      const currentSize = Math.min(chunkSize, remaining);
      const chunk = crypto.randomBytes(currentSize);
      const canContinue = res.write(chunk);
      sent += currentSize;
      if (!canContinue) {
        res.once('drain', writeChunk);
        return;
      }
    }
    res.end();
  }

  writeChunk();
});

router.post('/upload', (req, res) => {
  const sizeBytes = Buffer.isBuffer(req.body) ? req.body.length : 0;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, receivedBytes: sizeBytes, ts: Date.now() });
});

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'NetPulse Real API' });
});

module.exports = router;
