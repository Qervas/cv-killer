const path = require("path");
const { spawn } = require("child_process");

function startServer(options = {}) {
  const { serverPath, env = process.env, onData, onError, onExit } = options;

  console.log(`Starting server from: ${serverPath}`);

  // Start Node.js with experimental modules support
  const serverProcess = spawn(
    "node",
    ["--experimental-modules", "--no-warnings", serverPath],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  // Handle stdout
  serverProcess.stdout.on("data", (data) => {
    const output = data.toString();
    console.log(`Server: ${output}`);
    if (onData) onData(output);
  });

  // Handle stderr
  serverProcess.stderr.on("data", (data) => {
    const output = data.toString();
    console.error(`Server error: ${output}`);
    if (onError) onError(output);
  });

  // Handle process exit
  serverProcess.on("exit", (code) => {
    console.log(`Server process exited with code ${code}`);
    if (onExit) onExit(code);
  });

  return serverProcess;
}

module.exports = { startServer };
