const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;
const BOT_API_URL = process.env.BOT_API_URL || 'https://ai-chat-bot-htn4.onrender.com';

app.use(express.json({ limit: '10mb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Health check
app.get('/api/admin-health', (req, res) => {
  res.json({ status: 'OK', botApiUrl: BOT_API_URL, timestamp: new Date().toISOString() });
});

// Proxy all /api/* requests to bot
app.all('/api/*', async (req, res) => {
  try {
    const targetUrl = BOT_API_URL + req.originalUrl;
    const options = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Proxy': 'MatrixMindAdmin'
      }
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body);
    }
    const response = await fetch(targetUrl, options);
    const data = await response.text();
    res.status(response.status);
    // Forward content type
    const ct = response.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.send(data);
  } catch (err) {
    console.error('[PROXY] Error:', err.message);
    res.status(502).json({ error: 'Bot API unreachable', message: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`MatrixMind Admin Dashboard running on port ${PORT}`);
  console.log(`Proxying to Bot API: ${BOT_API_URL}`);
});
