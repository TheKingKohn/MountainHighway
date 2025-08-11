#!/usr/bin/env node

/**
 * Production Startup Script for Mountain Highway API
 * This script handles the production deployment startup sequence
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Mountain Highway API in production mode...');

// Set production environment
process.env.NODE_ENV = 'production';

// Run database migrations first
console.log('📊 Running database migrations...');
const migrate = spawn('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

migrate.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Database migration failed with code:', code);
    process.exit(1);
  }
  
  console.log('✅ Database migrations completed successfully');
  console.log('🔄 Generating Prisma client...');
  
  // Generate Prisma client
  const generate = spawn('npx', ['prisma', 'generate'], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  });
  
  generate.on('close', (generateCode) => {
    if (generateCode !== 0) {
      console.error('❌ Prisma client generation failed with code:', generateCode);
      process.exit(1);
    }
    
    console.log('✅ Prisma client generated successfully');
    console.log('🚀 Starting API server...');
    
    // Start the API server
    const server = spawn('node', ['dist/index.js'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });
    
    server.on('close', (serverCode) => {
      console.log('🛑 Server process exited with code:', serverCode);
      process.exit(serverCode);
    });
    
    server.on('error', (error) => {
      console.error('❌ Server startup error:', error);
      process.exit(1);
    });
  });
  
  generate.on('error', (error) => {
    console.error('❌ Prisma generation error:', error);
    process.exit(1);
  });
});

migrate.on('error', (error) => {
  console.error('❌ Migration error:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
