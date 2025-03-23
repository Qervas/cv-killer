const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

ipcMain.handle("retry-server", () => {
  if (mainWindow) {
    mainWindow.reload();
  }
  return true;
});

ipcMain.handle("show-error", (event, message) => {
  console.log("Received show-error request:", message);
  // Send to all renderer processes
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send("show-error", message);
    }
  });
  return true;
});

ipcMain.handle("use-static-mode", () => {
  console.log("Switching to static mode via IPC");
  const staticPath = isDev
    ? path.join(__dirname, "build", "index.html")
    : path.join(process.resourcesPath, "app", "build", "index.html");

  if (fs.existsSync(staticPath) && mainWindow) {
    mainWindow.loadFile(staticPath);
    return true;
  }
  return false;
});

// Debug settings
const enableDebug = true; // Set to true to enable debugging in production build
const forceDevTools = true; // Set to true to force DevTools to open in production

// Flag to track if we're in development mode
const isDev = !app.isPackaged;
console.log("Running in development mode:", isDev);

// Get user data path
const userDataPath = app.getPath("userData");
console.log("User data path:", userDataPath);

let mainWindow;
let debugWindow = null;
let serverProcess = null;
let serverPort = 3001;

// Create directories needed for app
function createAppDirectories() {
  const dirs = [
    path.join(userDataPath, "data"),
    path.join(userDataPath, "public"),
    path.join(userDataPath, "public/previews"),
    path.join(userDataPath, "build"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } catch (err) {
        console.error(`Failed to create directory ${dir}:`, err);
      }
    }
  }
}

// Create a debug window for server logs
function createDebugWindow() {
  // Create a debugging window
  debugWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: "CV Killer Server Logs",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load a simple HTML page to display logs
  debugWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <head>
        <title>CV Killer Server Logs</title>
        <style>
          body {
            margin: 0;
            padding: 10px;
            font-family: monospace;
            background: #1e1e1e;
            color: #ddd;
            overflow-x: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .error { color: #ff6b6b; }
          .info { color: #69c0ff; }
          .success { color: #69db7c; }
          .warning { color: #fcc419; }
        </style>
      </head>
      <body>
        <div id="logs"></div>
        <script>
          const logsDiv = document.getElementById('logs');

          // Function to append log message
          function appendLog(message, type) {
            const logLine = document.createElement('div');
            logLine.className = type || '';
            logLine.textContent = message;
            logsDiv.appendChild(logLine);

            // Auto-scroll to bottom
            window.scrollTo(0, document.body.scrollHeight);
          }

          // Initialize
          appendLog('Debug console initialized', 'info');
          appendLog('Waiting for server logs...', 'info');

          // Message receiver
          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'log') {
              appendLog(event.data.message, event.data.logType);
            }
          });
        </script>
      </body>
    </html>
  `);

  // When debug window is closed
  debugWindow.on("closed", () => {
    debugWindow = null;
  });

  return debugWindow;
}

// Function to send logs to debug window
function sendToDebugWindow(message, type = "info") {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents
      .executeJavaScript(
        `
      const logEvent = new MessageEvent('message', {
        data: { type: 'log', message: ${JSON.stringify(message)}, logType: '${type}' }
      });
      window.dispatchEvent(logEvent);
    `,
      )
      .catch((err) =>
        console.error("Failed to send log to debug window:", err),
      );
  }
}

// Get server diagnostics
function getServerDiagnostics(serverPath) {
  const diagnostics = {
    serverPath,
    exists: false,
    directory: null,
    directoryExists: false,
    directoryContents: null,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
  };

  try {
    diagnostics.exists = fs.existsSync(serverPath);

    const directory = path.dirname(serverPath);
    diagnostics.directory = directory;

    if (fs.existsSync(directory)) {
      diagnostics.directoryExists = true;
      diagnostics.directoryContents = fs.readdirSync(directory);
    }
  } catch (err) {
    diagnostics.error = err.message;
  }

  return diagnostics;
}

// Find a valid Node.js path
function getNodePath() {
  // First, try to use the node executable from the PATH
  let nodePath = process.platform === "win32" ? "node.exe" : "node";

  // Check if the selected Node executable is executable
  try {
    if (nodePath !== "node" && fs.existsSync(nodePath)) {
      // Check permissions (this is for Unix systems only)
      if (process.platform !== "win32") {
        const stats = fs.statSync(nodePath);
        const isExecutable = !!(stats.mode & 0o111);
        console.log(
          `Node path ${nodePath} executable permission: ${isExecutable}`,
        );

        if (!isExecutable) {
          console.log(`Attempting to make ${nodePath} executable`);
          try {
            // Try to make it executable
            fs.chmodSync(nodePath, "755");
            console.log(`Successfully made ${nodePath} executable`);
          } catch (chmodErr) {
            console.error(`Failed to make ${nodePath} executable:`, chmodErr);
            // Fall back to system node
            nodePath = "node";
          }
        }
      }
    }
  } catch (err) {
    console.error("Error checking node permissions:", err);
  }

  // If we're in a packaged app, we can try to use other locations
  if (!isDev) {
    try {
      // On macOS, try common locations
      if (process.platform === "darwin") {
        const macPaths = [
          "/usr/local/bin/node",
          "/usr/bin/node",
          "/opt/homebrew/bin/node",
        ];

        for (const p of macPaths) {
          if (fs.existsSync(p)) {
            nodePath = p;
            break;
          }
        }
      }
      // On Windows, try to use node from Program Files
      else if (process.platform === "win32") {
        const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
        const windowsPaths = [
          path.join(programFiles, "nodejs", "node.exe"),
          "C:\\Program Files\\nodejs\\node.exe",
        ];

        for (const p of windowsPaths) {
          if (fs.existsSync(p)) {
            nodePath = p;
            break;
          }
        }
      }
    } catch (err) {
      console.error("Error finding Node path:", err);
    }
  }

  console.log(`Using Node path: ${nodePath}`);
  return nodePath;
}

// Initialize the server
async function initializeServer() {
  try {
    if (enableDebug && !debugWindow) {
      createDebugWindow();
      sendToDebugWindow("Starting server initialization...", "info");
    }

    // Determine which server script to use - use CommonJS version for production
    const serverPath = isDev
      ? path.join(__dirname, "server/server-minimal.js")
      : path.join(process.resourcesPath, "app", "server", "server-minimal.cjs"); // Use CJS in production

    console.log(`Using server path: ${serverPath}`);

    if (enableDebug) {
      sendToDebugWindow(`Server path: ${serverPath}`, "info");
    }

    // Check if server file exists
    if (!fs.existsSync(serverPath)) {
      const errorMsg = `Server file not found: ${serverPath}`;
      console.error(errorMsg);
      if (enableDebug) {
        sendToDebugWindow(errorMsg, "error");
      }

      // Try fallback if production server file is missing
      if (!isDev) {
        const fallbackPath = path.join(
          process.resourcesPath,
          "app",
          "server",
          "server-minimal.js",
        );
        if (fs.existsSync(fallbackPath)) {
          console.log(`Found fallback server at: ${fallbackPath}`);
          if (enableDebug) {
            sendToDebugWindow(
              `Found fallback server at: ${fallbackPath}`,
              "info",
            );
          }
          return startFallbackServer(fallbackPath);
        }
      }

      throw new Error(errorMsg);
    }

    // Define the server environment variables
    const serverEnv = {
      ...process.env, // Include all existing env vars
      ELECTRON_RUN: "true",
      USER_DATA_PATH: userDataPath,
      SERVER_PATH: serverPath,
      NODE_ENV: isDev ? "development" : "production",
      PORT: "3001",
      DEBUG: enableDebug ? "true" : "false",
    };

    console.log("Starting server with environment:", serverEnv);
    if (enableDebug) {
      sendToDebugWindow(
        `Starting server with env: ${JSON.stringify(serverEnv)}`,
        "info",
      );
    }

    // Direct execution - no fancy starter needed for CJS
    const childProcess = spawn("node", [serverPath], {
      env: serverEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let serverPort = 3001;
    let serverStarted = false;

    return new Promise((resolve, reject) => {
      childProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`Server: ${output}`);

        if (enableDebug) {
          sendToDebugWindow(output, "info");
        }

        // Look for port in the output
        const portMatch = output.match(
          /Server running on http:\/\/localhost:(\d+)/,
        );
        if (portMatch && portMatch[1]) {
          serverPort = parseInt(portMatch[1], 10);
          serverStarted = true;
          resolve({ port: serverPort, process: childProcess });
        }
      });

      childProcess.stderr.on("data", (data) => {
        const errorOutput = data.toString();
        console.error(`Server error: ${errorOutput}`);

        if (enableDebug) {
          sendToDebugWindow(errorOutput, "error");
        }
      });

      childProcess.on("error", (err) => {
        console.error(`Failed to start server: ${err}`);

        if (enableDebug) {
          sendToDebugWindow(`Server process error: ${err.message}`, "error");
        }

        reject(err);
      });

      childProcess.on("exit", (code) => {
        const message = `Server process exited with code ${code}`;
        console.log(message);

        if (enableDebug) {
          sendToDebugWindow(message, code === 0 ? "info" : "error");
        }

        if (!serverStarted) {
          reject(new Error(`Server exited with code ${code} before starting`));
        }
      });

      // Timeout - assume server started if no explicit failure
      setTimeout(() => {
        if (!serverStarted) {
          console.log("Server startup timeout - assuming it started anyway");
          if (enableDebug) {
            sendToDebugWindow(
              "Server startup timeout - assuming it works",
              "warning",
            );
          }
          resolve({ port: serverPort, process: childProcess });
        }
      }, 10000);
    });
  } catch (err) {
    console.error("Server initialization error:", err);
    if (enableDebug) {
      sendToDebugWindow(
        `Server initialization failed: ${err.message}`,
        "error",
      );
    }
    throw err;
  }
}

// Fallback server function
function startFallbackServer(serverPath) {
  // This will use the JS version with experimental flags
  console.log("Starting fallback ES Modules server");

  const serverEnv = {
    ...process.env,
    ELECTRON_RUN: "true",
    USER_DATA_PATH: userDataPath,
    SERVER_PATH: serverPath,
    NODE_ENV: "production",
    PORT: "3001",
  };

  const childProcess = spawn(
    "node",
    ["--experimental-modules", "--no-warnings", serverPath],
    {
      env: serverEnv,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  // Similar promise-based logic as in initializeServer
  return new Promise((resolve, reject) => {
    // Processing stdout to find port, handling errors, etc.
    // (Essentially the same as in initializeServer)
    // ...

    let serverPort = 3001;
    let serverStarted = false;

    childProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`Fallback server: ${output}`);

      if (enableDebug) {
        sendToDebugWindow(`Fallback: ${output}`, "info");
      }

      // Look for port in output
      const portMatch = output.match(
        /Server running on http:\/\/localhost:(\d+)/,
      );
      if (portMatch && portMatch[1]) {
        serverPort = parseInt(portMatch[1], 10);
        serverStarted = true;
        resolve({ port: serverPort, process: childProcess });
      }
    });

    // Handle errors and timeouts (similar to initializeServer)
    // ...

    // Handle timeout
    setTimeout(() => {
      if (!serverStarted) {
        console.log("Fallback server startup timeout - assuming it started");
        resolve({ port: serverPort, process: childProcess });
      }
    }, 10000);
  });
}

async function createWindow() {
  try {
    // Create directories
    createAppDirectories();

    // Create the browser window first
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true, // Change to true for security
        preload: path.join(__dirname, "preload.js"), // Add a preload script
      },
      show: false,
    });

    // Show loading screen with corrected script
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
        <head>
          <title>Starting CV Killer...</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #f5f5f5;
              color: #333;
            }
            h1 { margin-bottom: 30px; }
            .loader {
              border: 6px solid #f3f3f3;
              border-top: 6px solid #007bff;
              border-radius: 50%;
              width: 60px;
              height: 60px;
              animation: spin 2s linear infinite;
              margin-bottom: 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .status {
              margin-top: 20px;
              padding: 10px;
              max-width: 80%;
              text-align: center;
            }
            .error {
              color: #721c24;
              background-color: #f8d7da;
              padding: 15px;
              border-radius: 4px;
              margin-top: 20px;
              max-width: 80%;
              text-align: center;
              display: none; /* Hide by default */
            }
            button {
              margin-top: 20px;
              padding: 10px 20px;
              background-color: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
            }
            button:disabled {
              background-color: #cccccc;
              cursor: not-allowed;
            }
          </style>
        </head>
        <body>
          <h1>CV Killer</h1>
          <div class="loader"></div>
          <h2>Starting Application...</h2>
          <div class="status">Please wait while the application initializes</div>
          <div id="error-container" class="error">
            <strong>Error:</strong> <span id="error-message">Unknown error</span>
            <div>
              <button id="retry-button">Retry</button>
              <button id="static-button">Use Offline Mode</button>
            </div>
          </div>
        </body>
      </html>
    `);

    // Show window once loaded
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });

    // Wait for page to load before we start setting up stuff
    await new Promise((resolve) => {
      mainWindow.webContents.once("did-finish-load", resolve);
    });

    // Start the server
    try {
      const result = await initializeServer();
      serverProcess = result.process;
      serverPort = result.port;

      // Now load the actual application
      const appUrl = `http://localhost:${serverPort}`;
      console.log(`Loading application from ${appUrl}`);

      if (enableDebug) {
        sendToDebugWindow(`Loading application from ${appUrl}`, "info");
      }

      // Try to connect to the server
      let serverAvailable = await checkServerAvailability(appUrl);
      if (serverAvailable) {
        mainWindow.loadURL(appUrl);
      } else {
        throw new Error("Could not connect to server");
      }
    } catch (err) {
      console.error("Failed to start server:", err);

      // Determine static fallback path
      const staticPath = isDev
        ? path.join(__dirname, "build", "index.html")
        : path.join(process.resourcesPath, "app", "build", "index.html");

      const staticExists = fs.existsSync(staticPath);
      console.log(
        `Static fallback ${staticExists ? "available" : "not available"} at: ${staticPath}`,
      );

      // IMPORTANT: Use setTimeout to ensure the DOM is fully loaded before manipulation
      setTimeout(() => {
        mainWindow.webContents
          .executeJavaScript(
            `
          (function() {
            try {
              // Find our elements safely
              const loader = document.querySelector('.loader');
              const status = document.querySelector('.status');
              const errorMsg = document.getElementById('error-message');
              const errorContainer = document.getElementById('error-container');

              // Update UI elements if they exist
              if (loader) loader.style.display = 'none';
              if (status) status.textContent = 'Failed to start application server';
              if (errorMsg) errorMsg.textContent = ${JSON.stringify(err.message)};
              if (errorContainer) errorContainer.style.display = 'block';

              // Add event listeners to buttons
              const retryButton = document.getElementById('retry-button');
              if (retryButton) {
                retryButton.addEventListener('click', () => {
                  console.log('Retry clicked');
                  window.location.reload();
                });
              }

              // Setup static mode button if fallback is available
              ${
                staticExists
                  ? `
                const staticButton = document.getElementById('static-button');
                if (staticButton) {
                  staticButton.addEventListener('click', () => {
                    console.log('Static mode clicked');
                    if (status) status.textContent = 'Loading in offline mode...';
                    if (errorContainer) errorContainer.style.display = 'none';
                    window.location.href = 'file://${staticPath.replace(/\\/g, "/")}';
                  });
                }
              `
                  : `
                // No static fallback available
                const staticButton = document.getElementById('static-button');
                if (staticButton) {
                  staticButton.disabled = true;
                  staticButton.textContent = 'Offline Mode Unavailable';
                }
              `
              }

              console.log('Error UI successfully updated');
            } catch (e) {
              console.error('Error updating UI:', e);
            }
          })();
        `,
          )
          .catch((err) => {
            console.error("Failed to execute error UI script:", err);
          });
      }, 500); // Give the DOM time to load
    }

    // Open DevTools in development or if forced
    if (isDev || forceDevTools) {
      mainWindow.webContents.openDevTools();
    }
  } catch (err) {
    console.error("Error during app initialization:", err);
    dialog.showMessageBox({
      type: "error",
      title: "Application Error",
      message: `An error occurred while starting the application: ${err.message}`,
    });
  }
}

// Helper function to check if server is available
async function checkServerAvailability(url) {
  return new Promise((resolve) => {
    try {
      const http = require("http");
      const testRequest = http.get(url, (res) => {
        resolve(res.statusCode === 200);
      });

      testRequest.on("error", (err) => {
        console.error(`Server check error: ${err.message}`);
        resolve(false);
      });

      // Set a timeout
      testRequest.setTimeout(3000, () => {
        testRequest.destroy();
        console.log("Server check timed out");
        resolve(false);
      });
    } catch (err) {
      console.error("Error during server availability check:", err);
      resolve(false);
    }
  });
}

// App lifecycle events
app.whenReady().then(createWindow);

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }

  // Kill the server process when closing the app
  if (serverProcess) {
    console.log("Killing server process...");
    try {
      serverProcess.kill();
    } catch (e) {
      console.error("Error killing server process:", e);
    }
    serverProcess = null;
  }
});

app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);

  if (enableDebug && debugWindow) {
    sendToDebugWindow(`Uncaught Exception: ${error.message}`, "error");
  }

  if (dialog) {
    dialog.showErrorBox(
      "Unexpected Error",
      `An unexpected error occurred: ${error.message}\n\n` +
        `Please restart the application.`,
    );
  }
});
