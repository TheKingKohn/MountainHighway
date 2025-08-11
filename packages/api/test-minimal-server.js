// Simple server test with more logging
const express = require('express');

const app = express();
const PORT = 4001; // Use different port

console.log('📋 Starting minimal server test...');

app.get('/health', (req, res) => {
  console.log('📋 Health check received');
  res.json({ ok: true, test: 'minimal' });
});

app.listen(PORT, () => {
  console.log(`🚀 Minimal server running on http://localhost:${PORT}`);
  console.log(`📋 Health check available at http://localhost:${PORT}/health`);
});

// Enhanced error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', () => {
  console.log('📋 SIGINT received');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('📋 SIGTERM received');
  process.exit(0);
});

console.log('📋 Minimal server setup complete');
