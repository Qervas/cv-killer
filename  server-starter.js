import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Starts the server as a child process
 */
export function startServer(options = {}) {
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

    // Start the server process with Node flags to support ES modules
    console.log("Spawning server process...");
    const serverProcess = spawn("node", [serverPath], {
      env,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      // Pass through Node.js options
      windowsHide: true,
    });

    // Set timeout for server startup
    timeoutId = setTimeout(() => {
      if (!serverReady) {
        console.warn("Server startup timed out - assuming it failed");
        serverProcess.kill();
        reject(new Error("Server startup timed out after 30s"));
      }
    }, 30000);

    // Listen for stdout to extract port information and debug messages
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

    // Listen for stderr for debugging - this is critical for diagnosing issues
    serverProcess.stderr.on("data", (data) => {
      const errorOutput = data.toString();
      console.error(`Server stderr: ${errorOutput}`);

      // If we see common error patterns, log and reject
      if (
        errorOutput.includes("SyntaxError") ||
        errorOutput.includes("Cannot find module") ||
        errorOutput.includes("Error: Cannot find module")
      ) {
        serverProcess.kill();
        reject(new Error(`Server failed to start: ${errorOutput}`));
      }
    });

    // Handle server process errors
    serverProcess.on("error", (err) => {
      console.error("Server process error:", err);
      clearTimeout(timeoutId);
      reject(err);
    });

    // Handle unexpected exit
    serverProcess.on("exit", (code, signal) => {
      console.log(
        `Server process exited with code ${code} and signal ${signal}`,
      );
      clearTimeout(timeoutId);

      if (!serverReady) {
        reject(
          new Error(`Server exited with code ${code} before initialization`),
        );
      }
    });
  });
}

// Default export for compatibility
export default { startServer };
