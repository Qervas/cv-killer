const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, exec } = require("child_process");
const isDev = process.env.NODE_ENV === "development";
const enableDebug = process.env.DEBUG === "true";
const util = require('util');
const execPromise = util.promisify(exec);
const log = require('electron-log');

log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'debug' : 'info';

// Replace console.log with log
log.info('Application starting...');
log.info('Environment:', {
  isDev,
  resourcePath: process.resourcesPath,
  userData: app.getPath('userData')
});

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
const forceDevTools = false; // Set to true to force DevTools to open in production

// Get user data path
const userDataPath = app.getPath("userData");
console.log("User data path:", userDataPath);

let mainWindow;
let debugWindow = null;
let serverProcess = null;
let serverPort = 3001;

// Add at the top level
const processes = new Map();
let isShuttingDown = false;

function registerProcess(type, process) {
  processes.set(type, process);
  
  process.on('exit', (code) => {
    console.log(`Process ${type} exited with code ${code}`);
    processes.delete(type);
    
    if (!isShuttingDown) {
      // Unexpected exit - handle reconnection
      app.emit('process-exit', { type, code });
    }
  });
}

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
    try {
      // Escape special characters that might break the JavaScript
      const safeMessage = String(message).replace(/[\\"\n\r\t]/g, (match) => {
        return {
          "\\": "\\\\",
          '"': '\\"',
          "\n": "\\n",
          "\r": "\\r",
          "\t": "\\t",
        }[match];
      });

      // Simpler approach to sending messages
      debugWindow.webContents
        .executeJavaScript(
          `
        try {
          const logLine = document.createElement('div');
          logLine.className = '${type}';
          logLine.textContent = "${safeMessage}";
          document.getElementById('logs').appendChild(logLine);
          window.scrollTo(0, document.body.scrollHeight);
        } catch (e) {
          console.error("Error adding log:", e);
        }
      `,
        )
        .catch((err) => {
          // Just log the error locally and continue
          console.error("Debug window logging error:", err.message);
        });
    } catch (error) {
      console.error("Failed to format debug message:", error);
    }
  }
}

// Utility function to get server file diagnostics
function getServerDiagnostics(serverPath) {
  try {
    const stats = fs.statSync(serverPath);
    return {
      exists: true,
      size: stats.size,
      permissions: stats.mode,
      lastModified: stats.mtime,
      isFile: stats.isFile(),
      absolutePath: path.resolve(serverPath)
    };
  } catch (err) {
    return {
    exists: false,
      error: err.message
    };
  }
}

// Utility function to check server availability
async function checkServerAvailability(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      return response.ok;
  } catch (err) {
      console.log(`Server health check attempt ${i + 1} failed:`, err.message);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
  }
    }
  }
  return false;
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

// Add cleanup function at the top level
async function cleanupApplication() {
  console.log('Cleaning up application resources...');

  // Kill server process if it exists
  if (serverProcess) {
    try {
      const isRunning = serverProcess.pid && !serverProcess.killed;
      if (isRunning) {
        console.log(`Killing server process (PID: ${serverProcess.pid})`);
        serverProcess.kill('SIGTERM');
        // Give it a moment to shut down gracefully
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Force kill if still running
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }
    } catch (err) {
      console.error('Error killing server process:', err);
    }
    serverProcess = null;
  }

  // Clean up any remaining processes on our ports
  try {
    await cleanupPorts(3001, 3010);
  } catch (err) {
    console.error('Error cleaning up ports:', err);
  }

  // Clean up temp directories with improved error handling
  try {
    const tempDirs = [
      path.join(userDataPath, 'public', 'previews'),
      path.join(userDataPath, 'temp')
    ];

    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        try {
          // Use rimraf pattern with safety checks
          const files = fs.readdirSync(dir);
          for (const file of files) {
            try {
              const filePath = path.join(dir, file);
              const fileStats = fs.statSync(filePath);
              
              if (fileStats.isDirectory()) {
                // Only delete subdirectories and files, not the directory itself
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                // Delete individual files
                fs.unlinkSync(filePath);
              }
            } catch (fileErr) {
              console.error(`Error removing file ${file} in ${dir}:`, fileErr);
              // Continue with next file
            }
          }
          console.log(`Cleaned up files in directory: ${dir}`);
        } catch (rmErr) {
          console.error(`Error accessing directory ${dir}:`, rmErr);
          // If folder deletion fails, try the next one
        }
      }
    }
  } catch (err) {
    console.error('Error cleaning temp directories:', err);
  }
}

// Modify the app quit handler
app.on("window-all-closed", async function () {
  isShuttingDown = true;
  
  // Gracefully shut down all processes
  for (const [type, process] of processes) {
    try {
      process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (process.killed === false) {
        process.kill('SIGKILL');
      }
    } catch (err) {
      console.error(`Error shutting down ${type}:`, err);
    }
  }
  
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Add handlers for other termination scenarios
app.on('before-quit', async (event) => {
  console.log('Application is about to quit...');
  event.preventDefault(); // Prevent immediate quit
  await cleanupApplication();
  app.exit(); // Force exit after cleanup
});

// Handle process signals
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, cleaning up...`);
    await cleanupApplication();
    process.exit(0);
  });
});

// Add error handler for server process
function setupServerProcessHandlers(serverProcess) {
  if (!serverProcess) return;

  serverProcess.on('error', (err) => {
    console.error('Server process error:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`Server process exited with code ${code} and signal ${signal}`);
    serverProcess = null;
  });

  // Handle server process stdout/stderr
  serverProcess.stdout?.on('data', (data) => {
    console.log(`Server: ${data}`);
      if (enableDebug) {
      sendToDebugWindow(data.toString(), 'info');
    }
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error(`Server error: ${data}`);
          if (enableDebug) {
      sendToDebugWindow(data.toString(), 'error');
    }
  });
}

// Modify initializeServer to use the new handler
async function initializeServer() {
  try {
    if (enableDebug && !debugWindow) {
      createDebugWindow();
      sendToDebugWindow("Starting server initialization...", "info");
    }

    // Determine server path based on environment
    let serverPath;
    if (isDev) {
      serverPath = path.join(__dirname, "server/index.js");
    } else {
      // For packaged app, try multiple possible locations
      const possiblePaths = [
        path.join(process.resourcesPath, "app.asar", "server", "index.js"),
        path.join(process.resourcesPath, "app", "server", "index.js"),
        path.join(__dirname, "server", "index.js")
      ];
      serverPath = possiblePaths.find(p => fs.existsSync(p));
      
      if (!serverPath) {
        throw new Error(`Server file not found in any of the expected locations: ${possiblePaths.join(', ')}`);
      }
    }

    console.log(`Using server path: ${serverPath}`);

    // Get server file diagnostics
    const diagnostics = getServerDiagnostics(serverPath);
    console.log('Server diagnostics:', diagnostics);

    if (enableDebug) {
      sendToDebugWindow(`Server path: ${serverPath}`, "info");
      sendToDebugWindow(`Server diagnostics: ${JSON.stringify(diagnostics, null, 2)}`, "info");
    }

    // Define the server environment variables
    const serverEnv = {
      ...process.env,
      ELECTRON_RUN: "true",
      USER_DATA_PATH: userDataPath,
      SERVER_PATH: serverPath,
      NODE_ENV: isDev ? "development" : "production",
      PORT: "3001",
      DEBUG: enableDebug ? "true" : "false",
      RESOURCE_PATH: process.resourcesPath || path.dirname(process.execPath)
    };

    console.log("Starting server with environment:", serverEnv);

    // For packaged app, ensure we're using the correct working directory
    const serverCwd = isDev ? __dirname : path.dirname(serverPath);

    // Create the server process
    const childProcess = spawn("node", [serverPath], {
      env: serverEnv,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: serverCwd
    });

    // Set up server process handlers
    setupServerProcessHandlers(childProcess);

    return new Promise((resolve, reject) => {
      let serverStarted = false;
      let startupTimeout = setTimeout(() => {
        if (!serverStarted) {
          console.log("Server startup timeout - checking health endpoint");
          checkServerAvailability(`http://localhost:${serverPort}`)
            .then(available => {
              if (available) {
                serverStarted = true;
                resolve({ port: serverPort, process: childProcess });
              } else {
                reject(new Error("Server health check failed after timeout"));
              }
            });
        }
      }, 5000);

      childProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`Server: ${output}`);

        if (enableDebug) {
          sendToDebugWindow(output, "info");
        }

        if (output.includes("Server running on http://localhost:")) {
          const portMatch = output.match(/localhost:(\d+)/);
        if (portMatch && portMatch[1]) {
          serverPort = parseInt(portMatch[1], 10);
          serverStarted = true;
            clearTimeout(startupTimeout);
          resolve({ port: serverPort, process: childProcess });
          }
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
        clearTimeout(startupTimeout);
        reject(err);
      });

      childProcess.on("exit", (code) => {
        if (!serverStarted) {
          clearTimeout(startupTimeout);
          reject(new Error(`Server exited with code ${code} before starting`));
        }
      });
    });
  } catch (err) {
    console.error("Server initialization error:", err);
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
    NODE_ENV: isDev ? "development" : "production",
    PORT: "3001",
    DEBUG: enableDebug ? "true" : "false",
    NODE_PATH: isDev
      ? path.join(__dirname, "node_modules")
      : path.join(process.resourcesPath, "app", "node_modules"),
  };

  const childProcess = spawn(
    "node",
    ["--experimental-modules", "--no-warnings", serverPath],
    {
      env: serverEnv,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: isDev ? __dirname : path.join(process.resourcesPath, "app"),
      shell: true,
    },
  );

  // Similar promise-based logic as in initializeServer
  return new Promise((resolve, reject) => {
    let output = "";
    let errorOutput = "";

    childProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log(`Server: ${chunk}`);

      if (enableDebug) {
        sendToDebugWindow(chunk, "info");
      }

      // Look for startup confirmation
      if (chunk.includes("Server running on http://localhost:")) {
        serverStarted = true;
        const portMatch = chunk.match(/localhost:(\d+)/);
        if (portMatch) {
          serverPort = parseInt(portMatch[1], 10);
        }
        resolve({ port: serverPort, process: childProcess });
      }
    });

    childProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      console.error(`Server error: ${chunk}`);

      if (enableDebug) {
        sendToDebugWindow(chunk, "error");
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
      // Only reject if server hasn't started successfully
      if (!serverStarted) {
        const message = `Server process exited with code ${code}\nOutput: ${output}\nErrors: ${errorOutput}`;
        console.error(message);
        if (enableDebug) {
          sendToDebugWindow(message, "error");
        }
        reject(new Error(message));
      }
    });

    // Increase timeout and add more debug info
    setTimeout(() => {
      if (!serverStarted) {
        const timeoutMessage = `Server startup timeout after 10s\nOutput: ${output}\nErrors: ${errorOutput}`;
        console.warn(timeoutMessage);
        if (enableDebug) {
          sendToDebugWindow(timeoutMessage, "warning");
        }
        // Still resolve to try to continue
        resolve({ port: serverPort, process: childProcess });
      }
    }, 10000);
  });
}

const LOADING_HTML = `
<!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
      background: #1a1b1e;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 0;
              display: flex;
              justify-content: center;
      align-items: center;
              height: 100vh;
      text-align: center;
            }
            .loader {
      width: 48px;
      height: 48px;
      border: 5px solid #FFF;
      border-bottom-color: transparent;
              border-radius: 50%;
      animation: rotation 1s linear infinite;
              margin-bottom: 20px;
            }
    @keyframes rotation {
      0% { transform: rotate(0deg) }
      100% { transform: rotate(360deg) }
    }
    .error { color: #ff4d4d; }
    .retry-button {
      background: #5865F2;
              border: none;
      padding: 10px 20px;
              border-radius: 4px;
      color: white;
              cursor: pointer;
      margin-top: 15px;
            }
          </style>
        </head>
        <body>
  <div id="content">
          <div class="loader"></div>
    <div id="status">Loading application...</div>
    <button id="retry-button" class="retry-button" style="display: none" onclick="window.electron.retry()">
      Retry Connection
    </button>
            </div>
  <script>
    let retryCount = 0;
    const maxRetries = 3;
    
    window.electron = {
      retry: () => {
        if (retryCount < maxRetries) {
          retryCount++;
          document.getElementById('status').textContent = 'Retrying connection...';
          document.getElementById('retry-button').style.display = 'none';
          // Send retry message to main process
          window.postMessage('retry-connection', '*');
        }
      }
    };
  </script>
        </body>
      </html>
`;

// Main window creation with proper error handling
async function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: !isDev
    },
    show: false, // Don't show until content is ready
    backgroundColor: '#1a1b1e'
  });

  // Load the loading screen first
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOADING_HTML)}`);
  win.show();

  // Set up server connection monitoring
  let serverCheckTimeout;
  let serverStartAttempts = 0;
  const MAX_SERVER_ATTEMPTS = 3;

  const connectToServer = async () => {
    try {
      const { port } = await initializeServer();
      const appUrl = `http://localhost:${port}`;
      
      // Check if server is actually responding
      const response = await fetch(`${appUrl}/api/health`);
      if (!response.ok) throw new Error('Server health check failed');

      // Load the actual application
      await win.loadURL(appUrl);
      console.log('Application loaded successfully');
    } catch (error) {
      console.error('Server connection error:', error);
      serverStartAttempts++;

      if (serverStartAttempts < MAX_SERVER_ATTEMPTS) {
        // Update loading screen with retry message
        win.webContents.executeJavaScript(`
          document.getElementById('status').innerHTML = 'Connection failed.<br>Retrying... (${serverStartAttempts}/${MAX_SERVER_ATTEMPTS})';
        `);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return connectToServer();
      } else {
        // Show error screen
        win.webContents.executeJavaScript(`
          document.getElementById('status').innerHTML = 'Unable to connect to the application server.<br>Please check your connection and try again.';
          document.getElementById('status').className = 'error';
          document.getElementById('retry-button').style.display = 'block';
        `);
      }
    }
  };

  // Start the connection process
  await connectToServer();

  // Handle window state
  win.on('ready-to-show', () => {
    win.show();
  });

  return win;
}

// App lifecycle events
app.whenReady().then(createMainWindow);

app.on("activate", function () {
  if (mainWindow === null) {
    createMainWindow();
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

// Add a more reliable port cleanup function for macOS
async function cleanupPorts(startPort, endPort) {
  console.log(`Cleaning up any processes using ports ${startPort}-${endPort}...`);
  
  try {
    // For macOS, use a more reliable approach
    if (process.platform === 'darwin') {
      // Use netstat on macOS which doesn't require elevated permissions
      const { stdout } = await execPromise(`netstat -anv | grep LISTEN`);
      
      // Process each line looking for our ports
      const portRegex = /\.(\d+)\s+/;
      const pidRegex = /\s+(\d+)\s*$/;
      
      const lines = stdout.split('\n');
      const killPromises = [];
      
      for (const line of lines) {
        const portMatch = line.match(portRegex);
        if (portMatch) {
          const port = parseInt(portMatch[1], 10);
          if (port >= startPort && port <= endPort) {
            const pidMatch = line.match(pidRegex);
            if (pidMatch) {
              const pid = parseInt(pidMatch[1], 10);
              if (pid !== process.pid) {
                console.log(`Found process ${pid} using port ${port}, attempting to terminate`);
                try {
                  // First try a gentle SIGTERM
                  process.kill(pid, 'SIGTERM');
                  
                  // Wait a moment then check if still running
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  try {
                    // Check if process still exists
                    process.kill(pid, 0);
                    // If we get here, process still exists, try SIGKILL
                    console.log(`Process ${pid} still running, sending SIGKILL`);
                    process.kill(pid, 'SIGKILL');
                  } catch (e) {
                    // Process no longer exists
                    console.log(`Process ${pid} terminated successfully`);
                  }
                } catch (killErr) {
                  console.error(`Error killing process ${pid}:`, killErr.message);
                }
              }
            }
          }
        }
      }
    } else if (process.platform === 'win32') {
      // Windows approach
      for (let port = startPort; port <= endPort; port++) {
        try {
          const { stdout } = await execPromise(`netstat -ano | findstr :${port}`);
          if (stdout) {
            const lines = stdout.split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length > 4) {
                const pid = parseInt(parts[parts.length - 1], 10);
                if (pid && pid !== process.pid) {
                  console.log(`Found process ${pid} using port ${port}, attempting to terminate`);
                  await execPromise(`taskkill /F /PID ${pid}`);
                }
              }
            }
          }
        } catch (err) {
          // Ignore errors when no process is found
          if (!err.message.includes('no tasks')) {
            console.error(`Error checking port ${port}:`, err.message);
          }
        }
      }
    } else {
      // Linux and other Unix-like systems
      try {
        const { stdout } = await execPromise(`lsof -i :${startPort}-${endPort} -t`);
        if (stdout) {
          const pids = stdout.split('\n').filter(Boolean);
          for (const pid of pids) {
            if (parseInt(pid, 10) !== process.pid) {
              console.log(`Found process ${pid} using a port in range ${startPort}-${endPort}, attempting to terminate`);
              await execPromise(`kill -15 ${pid}`);
              // Follow up with force kill after a delay if needed
              setTimeout(async () => {
                try {
                  await execPromise(`kill -0 ${pid}`);
                  console.log(`Process ${pid} still running, sending SIGKILL`);
                  await execPromise(`kill -9 ${pid}`);
    } catch (e) {
                  // Process no longer exists
                }
              }, 1000);
            }
          }
        }
      } catch (err) {
        console.error(`Error finding processes on ports ${startPort}-${endPort}:`, err.message);
      }
    }
    
    console.log(`Port cleanup completed for range ${startPort}-${endPort}`);
  } catch (err) {
    console.error('Port cleanup error:', err.message);
  }
}
