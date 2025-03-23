const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const electron = require("electron");

/**
 * Starts the server as a child process
 */
function startServer(options = {}) {
  return new Promise((resolve, reject) => {
    // Default path to server script
    const serverPath =
      options.serverPath || path.join(__dirname, "server", "index.js");

    console.log(`Starting server from: ${serverPath}`);

    // Check if the server file exists
    if (!fs.existsSync(serverPath)) {
      console.error(`Server file not found: ${serverPath}`);

      // Log directory contents for debugging
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

    // Log relevant environment variables
    console.log("Starting server with env:", {
      ELECTRON_RUN: env.ELECTRON_RUN,
      NODE_ENV: env.NODE_ENV,
      USER_DATA_PATH: env.USER_DATA_PATH,
    });

    let serverPort = options.port || 3001;
    let serverReady = false;
    let timeoutId;

    // Determine if we're in a packaged app without using electron-is-dev
    const isPackaged = !process.defaultApp;
    console.log(`Running in packaged app: ${isPackaged}`);

    // Try using fork first (more reliable for IPC)
    console.log("Using child_process.fork to start server...");

    try {
      const { fork } = require("child_process");

      const serverProcess = fork(serverPath, [], {
        env,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });

      // Set timeout for server startup
      timeoutId = setTimeout(() => {
        if (!serverReady) {
          console.warn("Server startup timed out - assuming it failed");
          serverProcess.kill();
          reject(new Error("Server startup timed out after 30s"));
        }
      }, 30000);

      // Listen for stdout if available
      if (serverProcess.stdout) {
        serverProcess.stdout.on("data", (data) => {
          const output = data.toString();
          console.log(`Server stdout: ${output}`);

          // Look for the port number in the server output
          const portMatch = output.match(
            /Server running on http:\/\/localhost:(\d+)/,
          );
          if (portMatch && portMatch[1]) {
            serverPort = parseInt(portMatch[1], 10);
            console.log(`Detected server running on port: ${serverPort}`);
          }

          // If we see the server is running but the IPC message isn't working,
          // consider the server ready anyway
          if (output.includes("Server running on http://localhost")) {
            if (!serverReady) {
              serverReady = true;
              clearTimeout(timeoutId);
              resolve({ serverProcess, port: serverPort });
            }
          }
        });
      }

      // Listen for IPC messages from the server
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

          resolve({ serverProcess, port: serverPort });
        }
      });

      // Listen for stderr if available
      if (serverProcess.stderr) {
        serverProcess.stderr.on("data", (data) => {
          const errorOutput = data.toString();
          console.error(`Server stderr: ${errorOutput}`);
        });
      }

      // Handle server process errors
      serverProcess.on("error", (err) => {
        console.error("Server process error:", err);
        clearTimeout(timeoutId);

        // Try alternate method if fork fails
        trySpawnServer(err);
      });

      // Handle unexpected exit
      serverProcess.on("exit", (code, signal) => {
        console.log(
          `Server process exited with code ${code} and signal ${signal}`,
        );
        clearTimeout(timeoutId);

        if (!serverReady) {
          // Try alternate method if fork exits
          trySpawnServer(new Error(`Server exited with code ${code}`));
        }
      });
    } catch (forkError) {
      console.error("Fork failed:", forkError);
      // Try alternate method if fork throws
      trySpawnServer(forkError);
    }

    // Fallback function to try spawn if fork fails
    function trySpawnServer(originalError) {
      try {
        console.log("Fork failed, trying spawn as fallback...");

        // Just use the regular system node command
        const nodeCmd = process.platform === "win32" ? "node.exe" : "node";
        console.log(`Using ${nodeCmd} to start server...`);

        const serverProcess = spawn(nodeCmd, [serverPath], {
          env,
          stdio: ["ignore", "pipe", "pipe", "ipc"],
          shell: true, // Try with shell to help resolve PATH
        });

        // Re-implement all the event handlers...
        serverProcess.stdout.on("data", (data) => {
          const output = data.toString();
          console.log(`Server stdout (spawn): ${output}`);

          // Look for the port number in the server output
          const portMatch = output.match(
            /Server running on http:\/\/localhost:(\d+)/,
          );
          if (portMatch && portMatch[1]) {
            serverPort = parseInt(portMatch[1], 10);
            console.log(
              `Detected server running on port (spawn): ${serverPort}`,
            );
          }

          // If we see the server is running message, consider it ready
          if (output.includes("Server running on http://localhost")) {
            if (!serverReady) {
              serverReady = true;
              clearTimeout(timeoutId);
              resolve({ serverProcess, port: serverPort });
            }
          }
        });

        serverProcess.stderr.on("data", (data) => {
          console.error(`Server stderr (spawn): ${data.toString()}`);
        });

        serverProcess.on("error", (err) => {
          console.error("Server process error (spawn):", err);
          clearTimeout(timeoutId);
          reject(
            new Error(
              `Server failed to start: ${originalError.message}, spawn error: ${err.message}`,
            ),
          );
        });

        serverProcess.on("exit", (code, signal) => {
          console.log(
            `Server process exited with code ${code} and signal ${signal} (spawn)`,
          );
          clearTimeout(timeoutId);

          if (!serverReady) {
            reject(
              new Error(
                `All server start methods failed. Original error: ${originalError.message}`,
              ),
            );
          }
        });
      } catch (spawnError) {
        console.error("Spawn also failed:", spawnError);
        reject(
          new Error(
            `All server start methods failed. Fork error: ${originalError.message}, Spawn error: ${spawnError.message}`,
          ),
        );
      }
    }
  });
}

module.exports = { startServer };
