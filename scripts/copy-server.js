import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source paths
const serverSourceDir = path.join(__dirname, "..", "server");
const serverMinimalJs = path.join(serverSourceDir, "server-minimal.js");
const serverMinimalCjs = path.join(serverSourceDir, "server-minimal.cjs");

// Destination paths
const buildDir = path.join(__dirname, "..", "build");
const serverDestDir = path.join(buildDir, "server");

// Create the server directory in build
fs.ensureDirSync(serverDestDir);

// Copy server-minimal.js
if (fs.existsSync(serverMinimalJs)) {
  console.log(`Copying ${serverMinimalJs} to ${serverDestDir}`);
  fs.copyFileSync(
    serverMinimalJs,
    path.join(serverDestDir, "server-minimal.js"),
  );
}

// Copy server-minimal.cjs if it exists
if (fs.existsSync(serverMinimalCjs)) {
  console.log(`Copying ${serverMinimalCjs} to ${serverDestDir}`);
  fs.copyFileSync(
    serverMinimalCjs,
    path.join(serverDestDir, "server-minimal.cjs"),
  );
} else {
  console.error(
    "WARNING: server-minimal.cjs not found. Create this file for better Electron compatibility.",
  );
}

// Copy other server files
console.log("Copying other server files");
fs.readdirSync(serverSourceDir).forEach((file) => {
  if (
    !file.includes("node_modules") &&
    file !== "server-minimal.js" &&
    file !== "server-minimal.cjs"
  ) {
    const sourcePath = path.join(serverSourceDir, file);
    const destPath = path.join(serverDestDir, file);

    if (fs.statSync(sourcePath).isFile()) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied: ${file}`);
    }
  }
});

console.log("Server files copied successfully");
