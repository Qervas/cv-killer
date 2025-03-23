import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This function is called from the main Electron process
export function startServer(serverPath, env) {
  return new Promise((resolve, reject) => {
    console.log(`Starting server from ${serverPath} with Node.js ES modules`);

    // Spawn Node process directly with the module
    const serverProcess = spawn("node", [serverPath], {
      env,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });

    let serverPort = env.PORT || 3001;
    let serverReady = false;

    serverProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`Server output: ${output}`);

      // Look for port in the output
      const portMatch = output.match(
        /Server running on http:\/\/localhost:(\d+)/,
      );
      if (portMatch && portMatch[1]) {
        serverPort = parseInt(portMatch[1], 10);
        serverReady = true;
        resolve({ serverProcess, port: serverPort });
      }
    });

    serverProcess.stderr.on("data", (data) => {
      console.error(`Server error: ${data.toString()}`);
    });

    serverProcess.on("error", (err) => {
      console.error(`Failed to start server: ${err.message}`);
      reject(err);
    });

    // Wait for a reasonable amount of time
    setTimeout(() => {
      if (!serverReady) {
        // If the port message wasn't found, but the process is still running,
        // assume it's working on the default port
        if (serverProcess.exitCode === null) {
          resolve({ serverProcess, port: serverPort });
        } else {
          reject(new Error("Server failed to start"));
        }
      }
    }, 5000);
  });
}
