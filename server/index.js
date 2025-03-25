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
  console.log("Starting server process, environment:", {
    cwd: process.cwd(),
    dirname: __dirname,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      ELECTRON_RUN: process.env.ELECTRON_RUN,
      USER_DATA_PATH: process.env.USER_DATA_PATH,
    },
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
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Shutting down gracefully...");
  process.exit(0);
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "app://.", "*"],
    credentials: true,
  }),
);

app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/build", express.static(path.join(__dirname, "../build")));
app.use(express.static(path.join(__dirname, "../build")));

// Also serve from user data path in Electron environment
if (process.env.ELECTRON_RUN === "true" && process.env.USER_DATA_PATH) {
  app.use(
    "/build",
    express.static(path.join(process.env.USER_DATA_PATH, "build")),
  );
  app.use(
    "/public",
    express.static(path.join(process.env.USER_DATA_PATH, "public")),
  );
}

// Ensure directories exist
fs.ensureDirSync(path.join(__dirname, "public/previews"));
fs.ensureDirSync(path.join(__dirname, "../build"));

// Use API routes
app.use("/api", apiRoutes);

// Direct root health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    serverInfo: {
      port: PORT,
      paths: pathInfo,
      environment: process.env.NODE_ENV || "development",
    },
  });
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

// Add graceful shutdown handler
function setupGracefulShutdown(server) {
  let isShuttingDown = false;

  async function cleanup() {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('Server is shutting down...');

    // Close the server
    server.close(() => {
      console.log('Server closed');
    });

    // Clean up temp directories
    try {
      const tempDirs = [
        path.join(PUBLIC_DIR, 'previews'),
        path.join(__dirname, 'temp')
      ];

      for (const dir of tempDirs) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`Cleaned up directory: ${dir}`);
        }
      }
    } catch (err) {
      console.error('Error cleaning temp directories:', err);
    }

    // Give active connections time to close
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Cleanup complete');
    process.exit(0);
  }

  // Handle various shutdown signals
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGQUIT', cleanup);
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      cleanup();
    }
  });

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup();
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    cleanup();
  });
}

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

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

// Setup graceful shutdown
setupGracefulShutdown(server);

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
