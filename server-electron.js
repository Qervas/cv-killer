const { createRequire } = require("module");
const require = createRequire(import.meta.url);
const path = require("path");
const { spawn } = require("child_process");

function startServer() {
  // Start the server process using spawn
  // We use this approach because it lets us run the ES module server
  // as a separate process without trying to require/import it directly
  const serverProcess = spawn("node", ["server/index.js"], {
    stdio: "inherit",
    env: { ...process.env },
  });

  return serverProcess;
}

module.exports = {
  startServer,
};
