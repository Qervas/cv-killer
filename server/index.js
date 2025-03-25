console.log("===== FULL SERVER STARTING =====");
console.log("Current directory:", process.cwd());
console.log("Node version:", process.version);
console.log("Environment:", {
  NODE_ENV: process.env.NODE_ENV,
  ELECTRON_RUN: process.env.ELECTRON_RUN,
  USER_DATA_PATH: process.env.USER_DATA_PATH,
});

// Global error handler to prevent crashes
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception in server process:", error);
  // Continue running if possible
});

import express from "express";
import cors from "cors";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./api-routes.js";

import {
  DATA_DIR,
  PUBLIC_DIR,
  PREVIEWS_DIR,
  BUILD_DIR,
  pathInfo,
} from "./server-paths.js";

// ES modules fix for __dirname (must be at the top)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log("Server starting with environment:", {
    NODE_ENV: process.env.NODE_ENV,
    ELECTRON_RUN: process.env.ELECTRON_RUN,
    RESOURCE_PATH: process.env.RESOURCE_PATH,
    __dirname: __dirname,
    cwd: process.cwd()
  });

  // Ensure directories exist
  fs.ensureDirSync(DATA_DIR);
  fs.ensureDirSync(PUBLIC_DIR);
  fs.ensureDirSync(PREVIEWS_DIR);
  fs.ensureDirSync(BUILD_DIR);
} catch (startupError) {
  console.error("Critical server startup error:", startupError);
  process.exit(1);
}

const app = express();

// Handle process communication errors
process.on("disconnect", () => {
  console.log("Parent process has been disconnected. Shutting down...");
  process.exit(0);
});

// Handle graceful shutdown
function setupGracefulShutdown(server) {
  let isShuttingDown = false;

  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("Gracefully shutting down server...");
    
    // Close the server
    server.close(() => {
      console.log("HTTP server closed");
    });

    // Clean up temporary directories
    try {
      console.log("Cleaning up temporary directories...");
      
      const dirsToClean = [PREVIEWS_DIR, path.join(process.cwd(), 'temp')];
      
      for (const dir of dirsToClean) {
        if (fs.existsSync(dir)) {
          try {
            // Instead of deleting entire directories, just clear their contents
            const files = fs.readdirSync(dir);
            console.log(`Found ${files.length} files in ${dir}`);
            
            for (const file of files) {
              try {
                const filePath = path.join(dir, file);
                // Skip deleting hidden files and system files
                if (file.startsWith('.') || file === '.DS_Store') {
                  continue;
                }
                
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                  // For subdirectories, we can use rmSync with force
                  fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                  // For files, use unlinkSync which is more specific
                  fs.unlinkSync(filePath);
                }
                console.log(`Removed: ${filePath}`);
              } catch (fileErr) {
                console.error(`Error removing file ${file}:`, fileErr.message);
                // Continue to next file
              }
            }
          } catch (dirErr) {
            console.error(`Error cleaning directory ${dir}:`, dirErr.message);
            // Continue to next directory
          }
        } else {
          console.log(`Directory does not exist: ${dir}`);
        }
      }
    } catch (err) {
      console.error("Error during cleanup:", err);
    }

    // Give active connections time to close before exiting
    setTimeout(() => {
      console.log("Server process exiting...");
      process.exit(0);
    }, 1000);
  };

  // Handle various shutdown signals
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGQUIT", cleanup);

  // Handle unexpected errors
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    cleanup();
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
    cleanup();
  });

  // Handle IPC messages (for Electron integration)
  process.on("message", (msg) => {
    if (msg === "shutdown") {
      console.log("Received shutdown message from parent process");
      cleanup();
    }
  });

  return cleanup;
}

const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3001',
        'app://',
        'file://'
      ];
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Add development mode logging for debugging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - Origin: ${req.get('origin')}`);
    next();
  });
}

app.use(express.json());

// Configure static file serving based on environment
const isDev = process.env.NODE_ENV === 'development';
const isElectron = process.env.ELECTRON_RUN === 'true';

// Serve static files from public directory
app.use('/public', express.static(PUBLIC_DIR, {
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'inline');
    }
  }
}));

// Serve preview files
app.use('/public/previews', express.static(PREVIEWS_DIR, {
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'inline');
    }
  }
}));

// Serve build files
app.use('/build', express.static(BUILD_DIR, {
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'inline');
    }
  }
}));

// API routes
app.use("/api", apiRoutes);

// Add a comprehensive health check endpoint
app.get('/api/health', (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      server: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        pid: process.pid
      },
      paths: {
        static: [PUBLIC_DIR, PREVIEWS_DIR, BUILD_DIR].filter(p => fs.existsSync(p)),
        current: __dirname,
        resources: process.env.RESOURCE_PATH
      }
    };

    // Check if we can access critical directories
    health.directories = {
      public: fs.existsSync(PUBLIC_DIR),
      previews: fs.existsSync(PREVIEWS_DIR),
      build: fs.existsSync(BUILD_DIR)
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Improve static file serving with better error handling
app.use('/public', (req, res, next) => {
  console.log(`Static file request: ${req.path}`);
  
  // Try each static path until we find the file
  const tryPaths = [PUBLIC_DIR, PREVIEWS_DIR, BUILD_DIR].filter(p => fs.existsSync(p));
  
  for (const staticPath of tryPaths) {
    const filePath = path.join(staticPath, req.path);
    if (fs.existsSync(filePath)) {
      console.log(`Serving ${req.path} from ${staticPath}`);
      return res.sendFile(filePath);
    }
  }

  console.log(`File not found in any static path: ${req.path}`);
  next();
});

// Serve SPA routes for client-side navigation
app.get("*", (req, res) => {
  // Skip API routes
  if (req.url.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // Serve the index.html for all other routes
  const indexPath = path.join(__dirname, "../build/index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Not found");
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Set up graceful shutdown
  setupGracefulShutdown(server);

  // Signal ready state for Electron integration
  if (process.send) {
    try {
      process.send({ type: "SERVER_READY", port: PORT });
      console.log("Sent SERVER_READY signal to parent process");
    } catch (err) {
      console.error("Failed to send ready signal:", err);
    }
  }
});

// Handle server errors
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Trying ${PORT + 1}...`);
    app.listen(PORT + 1, () => {
      console.log(`Server running on http://localhost:${PORT + 1}`);
      if (process.send) {
        try {
          process.send({ type: "SERVER_READY", port: PORT + 1 });
          console.log("Sent SERVER_READY signal to parent process");
        } catch (err) {
          console.error("Failed to send ready signal:", err);
        }
      }
    });
  } else {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
});
