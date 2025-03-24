import fs from "fs-extra";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine user data directory
const userDataPath = path.join(os.homedir(), ".config", "cv-killer");

console.log(`Cleaning up user data in: ${userDataPath}`);

// Remove all data but keep the directory structure
try {
  // Remove data files
  const dataDir = path.join(userDataPath, "data");
  fs.ensureDirSync(dataDir);
  fs.emptyDirSync(dataDir);
  console.log(`Cleared data directory: ${dataDir}`);

  // Create default empty JSON files
  const files = [
    "templates.json",
    "companies.json",
    "cover-letter-templates.json",
    "applications.json",
  ];
  files.forEach((file) => {
    fs.writeJsonSync(path.join(dataDir, file), []);
    console.log(`Created empty ${file}`);
  });

  console.log("Application data reset successfully!");
} catch (err) {
  console.error("Error resetting data:", err);
}
