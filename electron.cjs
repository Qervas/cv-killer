const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, fork, execFile } = require("child_process");

// Flag to track if we're in development mode
const isDev = !app.isPackaged;
console.log("Running in development mode:", isDev);

// Get user data path
const userDataPath = app.getPath("userData");
console.log("User data path:", userDataPath);

let mainWindow;
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

// Function to start the server
async function startServer(options = {}) {
  return new Promise((resolve, reject) => {
    // Default path to server script
    const serverPath =
      options.serverPath || path.join(__dirname, "server", "index.js");
    console.log(`Starting server from: ${serverPath}`);

    // Check if the server file exists
    if (!fs.existsSync(serverPath)) {
      console.error(`Server file not found: ${serverPath}`);

      try {
        const dir = path.dirname(serverPath);
        console.log(`Directory contents of ${dir}:`, fs.readdirSync(dir));
      } catch (dirErr) {
        console.error(`Cannot read directory: ${dirErr.message}`);
      }

      return reject(new Error(`Server file not found: ${serverPath}`));
    }

    // Set up environment variables
    const env = {
      ...process.env,
      ...options.env,
      ELECTRON_RUN: "true",
      NODE_ENV: process.env.NODE_ENV || "production",
    };

    // Log environment variables
    console.log("Starting server with env:", {
      ELECTRON_RUN: env.ELECTRON_RUN,
      NODE_ENV: env.NODE_ENV,
      USER_DATA_PATH: env.USER_DATA_PATH,
    });

    let serverPort = options.port || 3001;
    let serverReady = false;
    let timeoutId;

    // Method 1: Try using fork first (best for IPC)
    tryWithFork();

    function tryWithFork() {
      console.log("Attempting to start server with fork...");
      try {
        const serverProcess = fork(serverPath, [], {
          env,
          stdio: ["ignore", "pipe", "pipe", "ipc"],
        });

        timeoutId = setTimeout(() => {
          if (!serverReady) {
            console.warn("Fork method timed out - trying spawn instead");
            serverProcess.kill();
            tryWithSpawn();
          }
        }, 10000);

        serverProcess.on("message", (message) => {
          console.log("Received message from server:", message);

          if (
            message === "SERVER_READY" ||
            (message &&
              typeof message === "object" &&
              message.type === "SERVER_READY")
          ) {
            serverReady = true;
            clearTimeout(timeoutId);

            if (message && typeof message === "object" && message.port) {
              serverPort = message.port;
            }

            console.log(`Server ready on port ${serverPort} (fork method)`);
            resolve({ serverProcess, port: serverPort });
          }
        });

        if (serverProcess.stdout) {
          serverProcess.stdout.on("data", (data) => {
            const output = data.toString();
            console.log(`Server stdout (fork): ${output}`);

            const portMatch = output.match(
              /Server running on http:\/\/localhost:(\d+)/,
            );
            if (portMatch && portMatch[1]) {
              serverPort = parseInt(portMatch[1], 10);
              console.log(
                `Detected server running on port: ${serverPort} (fork)`,
              );

              if (
                !serverReady &&
                output.includes("Server running on http://localhost")
              ) {
                serverReady = true;
                clearTimeout(timeoutId);
                resolve({ serverProcess, port: serverPort });
              }
            }
          });
        }

        if (serverProcess.stderr) {
          serverProcess.stderr.on("data", (data) => {
            console.error(`Server stderr (fork): ${data.toString()}`);
          });
        }

        serverProcess.on("error", (err) => {
          console.error("Server fork error:", err);
          clearTimeout(timeoutId);
          tryWithSpawn();
        });

        serverProcess.on("exit", (code, signal) => {
          console.log(
            `Server process exited with code ${code} and signal ${signal} (fork)`,
          );

          if (!serverReady) {
            clearTimeout(timeoutId);
            tryWithSpawn();
          }
        });
      } catch (forkError) {
        console.error("Fork failed:", forkError);
        tryWithSpawn();
      }
    }

    // Method 2: Try using spawn if fork fails
    function tryWithSpawn() {
      console.log("Attempting to start server with spawn...");
      try {
        // Determine which node executable to use
        const nodeCmd = process.platform === "win32" ? "node.exe" : "node";
        console.log(`Using ${nodeCmd} to start server...`);

        const spawnedProcess = spawn(nodeCmd, [serverPath], {
          env,
          stdio: ["ignore", "pipe", "pipe"],
          shell: true, // Try with shell to help resolve PATH
        });

        timeoutId = setTimeout(() => {
          if (!serverReady) {
            console.warn("Spawn method timed out - trying execFile");
            spawnedProcess.kill();
            tryWithExecFile();
          }
        }, 10000);

        spawnedProcess.stdout.on("data", (data) => {
          const output = data.toString();
          console.log(`Server stdout (spawn): ${output}`);

          const portMatch = output.match(
            /Server running on http:\/\/localhost:(\d+)/,
          );
          if (portMatch && portMatch[1]) {
            serverPort = parseInt(portMatch[1], 10);
            console.log(
              `Detected server running on port: ${serverPort} (spawn)`,
            );
          }

          if (output.includes("Server running on http://localhost")) {
            if (!serverReady) {
              serverReady = true;
              clearTimeout(timeoutId);
              resolve({ serverProcess: spawnedProcess, port: serverPort });
            }
          }
        });

        spawnedProcess.stderr.on("data", (data) => {
          console.error(`Server stderr (spawn): ${data.toString()}`);
        });

        spawnedProcess.on("error", (err) => {
          console.error("Server spawn error:", err);
          clearTimeout(timeoutId);
          tryWithExecFile();
        });

        spawnedProcess.on("exit", (code, signal) => {
          console.log(
            `Server process exited with code ${code} and signal ${signal} (spawn)`,
          );

          if (!serverReady) {
            clearTimeout(timeoutId);
            tryWithExecFile();
          }
        });
      } catch (spawnError) {
        console.error("Spawn failed:", spawnError);
        tryWithExecFile();
      }
    }

    // Method 3: Last resort - execFile
    function tryWithExecFile() {
      console.log("Attempting to start server with execFile (last resort)...");
      try {
        const execProcess = execFile("node", [serverPath], {
          env,
          shell: true,
        });

        // Wait a fixed time and assume server is ready (not ideal but last resort)
        console.log("Using execFile with assumed port after delay");

        setTimeout(() => {
          if (!serverReady) {
            serverReady = true;
            console.log(
              `Assuming server is running on port ${serverPort} (execFile)`,
            );
            resolve({
              serverProcess: execProcess,
              port: serverPort,
            });
          }
        }, 5000);

        execProcess.stdout.on("data", (data) => {
          console.log(`Server stdout (execFile): ${data}`);
        });

        execProcess.stderr.on("data", (data) => {
          console.error(`Server stderr (execFile): ${data}`);
        });

        execProcess.on("error", (err) => {
          console.error("Server execFile error:", err);
          if (!serverReady) {
            reject(new Error("All server start methods failed"));
          }
        });
      } catch (execError) {
        console.error("ExecFile failed:", execError);
        reject(new Error("All server start methods failed"));
      }
    }
  });
}

// Initialize the server
async function initializeServer() {
  try {
    // Determine the server script path
    const serverPath = isDev
      ? path.join(__dirname, "server/index.js")
      : path.join(process.resourcesPath, "app", "server", "index.js");

    console.log(`Server script path: ${serverPath}`);
    console.log(`Server script exists: ${fs.existsSync(serverPath)}`);

    // Debug directory contents in production
    if (!isDev) {
      try {
        const resourcesDir = path.join(process.resourcesPath, "app");
        console.log(
          `Resources directory contents:`,
          fs.readdirSync(resourcesDir),
        );

        const serverDir = path.join(process.resourcesPath, "app", "server");
        if (fs.existsSync(serverDir)) {
          console.log(`Server directory contents:`, fs.readdirSync(serverDir));
        } else {
          console.log(`Server directory doesn't exist at ${serverDir}`);
        }
      } catch (err) {
        console.error("Error listing directory contents:", err);
      }
    }

    // Set environment variables
    const serverEnv = {
      ELECTRON_RUN: "true",
      USER_DATA_PATH: userDataPath,
      NODE_ENV: isDev ? "development" : "production",
      PORT: "3001", // Starting port
    };

    console.log("Starting server with environment:", serverEnv);

    // Start the server using our internal function
    const serverInfo = await startServer({
      serverPath: serverPath,
      env: serverEnv,
    });

    serverProcess = serverInfo.serverProcess;
    serverPort = serverInfo.port;

    console.log(`Server started successfully on port ${serverPort}`);
    return serverPort;
  } catch (err) {
    console.error("Failed to start server:", err);
    throw err;
  }
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
        nodeIntegration: true,
        contextIsolation: false,
      },
      show: false,
    });

    // Show loading screen
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
          </style>
        </head>
        <body>
          <h1>CV Killer</h1>
          <div class="loader"></div>
          <h2>Starting Application...</h2>
          <div class="status">Please wait while the application initializes</div>
        </body>
      </html>
    `);

    // Show window once loaded
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });

    // Start the server
    try {
      const port = await initializeServer();

      // Now load the actual application
      const appUrl = `http://localhost:${port}`;
      console.log(`Loading application from ${appUrl}`);
      mainWindow.loadURL(appUrl);
    } catch (err) {
      console.error("Failed to start server:", err);

      dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "Server Error",
        message: "The application server failed to start.",
        detail: err.message,
        buttons: ["OK"],
      });

      // Try static fallback if server fails
      try {
        const staticPath = isDev
          ? path.join(__dirname, "build", "index.html")
          : path.join(process.resourcesPath, "app", "build", "index.html");

        if (fs.existsSync(staticPath)) {
          mainWindow.loadFile(staticPath);
        }
      } catch (fallbackErr) {
        console.error("Failed to load static fallback:", fallbackErr);
      }
    }

    // Open DevTools in development
    if (isDev) {
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

  if (dialog) {
    dialog.showErrorBox(
      "Unexpected Error",
      `An unexpected error occurred: ${error.message}\n\n` +
        `Please restart the application.`,
    );
  }
});
