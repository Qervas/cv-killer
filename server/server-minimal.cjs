// THIS FILE IS AUTO-GENERATED - DO NOT EDIT DIRECTLY
// Generated from scripts/generate-cjs-server.js

console.log("===== MINIMAL SERVER STARTING (CommonJS) =====");
console.log("Current directory:", process.cwd());
console.log("Node version:", process.version);

// Use require instead of import
const express = require('express');
const fs = require('fs-extra');
const path = require('path');

try {
  console.log("Dependencies loaded successfully");

  const app = express();
  const PORT = process.env.PORT || 3001;

  // Get base directory based on environment
  const __dirname = process.env.SERVER_PATH
    ? path.dirname(process.env.SERVER_PATH)
    : __dirname;

  // Determine user data path for storage
  const USER_DATA_PATH = process.env.USER_DATA_PATH || path.join(__dirname, 'data');
  console.log("Base paths:", { __dirname, USER_DATA_PATH });

  // Create essential directories
  const dataDirs = [
    path.join(USER_DATA_PATH, "data"),
    path.join(USER_DATA_PATH, "public"),
    path.join(USER_DATA_PATH, "public/previews"),
    path.join(USER_DATA_PATH, "build")
  ];

  dataDirs.forEach(dir => {
    try {
      fs.ensureDirSync(dir);
      console.log(`Directory exists or was created: ${dir}`);
    } catch (err) {
      console.error(`Failed to create directory ${dir}:`, err);
    }
  });

  // Basic health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      message: "Minimal server is running (CommonJS version)",
      time: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        ELECTRON_RUN: process.env.ELECTRON_RUN,
        USER_DATA_PATH: process.env.USER_DATA_PATH,
        SERVER_PATH: process.env.SERVER_PATH,
        cwd: process.cwd()
      }
    });
  });

  // Serve static files from the build directory
  app.use(express.static(path.join(USER_DATA_PATH, 'build')));
  app.use('/build', express.static(path.join(USER_DATA_PATH, 'build')));

  // Fallback route to serve index.html for client-side routing
  app.get('*', (req, res) => {
    if (req.url.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Try to serve index.html if it exists
    const indexPath = path.join(USER_DATA_PATH, 'build', 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    res.status(404).send('Not found');
  });

  // Start the server
  const server = app.listen(PORT, () => {
    console.log(`Minimal server running on http://localhost:${PORT}`);
    if (process.send) {
      try {
        process.send({ type: "SERVER_READY", port: PORT });
        console.log("Sent SERVER_READY signal to parent process");
      } catch (err) {
        console.error("Failed to send ready signal:", err);
      }
    }
  });

  // Handle errors
  server.on('error', (err) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is in use, trying ${PORT + 1}...`);
      server.close();
      app.listen(PORT + 1, () => {
        console.log(`Server running on http://localhost:${PORT + 1}`);
        if (process.send) {
          process.send({ type: "SERVER_READY", port: PORT + 1 });
        }
      });
    }
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

} catch (err) {
  console.error("CRITICAL ERROR STARTING SERVER:", err);
  process.exit(1);
}
