import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Are we running in Electron?
const isElectron = process.env.ELECTRON_RUN === "true";
console.log("Running in Electron mode:", isElectron);

// In Electron, we use userData for persistent storage
const USER_DATA_PATH = process.env.USER_DATA_PATH || __dirname;

// Define base directories
let BASE_DIR = __dirname;
let buildDirPath = path.join(__dirname, "..", "build"); // Changed variable name here

if (isElectron) {
  // In Electron, store data in user data directory
  BASE_DIR = USER_DATA_PATH;
  buildDirPath = path.join(USER_DATA_PATH, "build"); // Changed variable name here
}

// Define paths
export const DATA_DIR = path.join(BASE_DIR, "data");
export const PUBLIC_DIR = path.join(BASE_DIR, "public");
export const PREVIEWS_DIR = path.join(PUBLIC_DIR, "previews");
export const BUILD_DIR = buildDirPath; // Now this is fine, using the local variable

// Log paths for debugging
console.log("Path configuration:", {
  __dirname,
  BASE_DIR,
  DATA_DIR,
  PUBLIC_DIR,
  PREVIEWS_DIR,
  BUILD_DIR,
  isElectron,
  USER_DATA_PATH,
});

// Create all required directories
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(PUBLIC_DIR);
fs.ensureDirSync(PREVIEWS_DIR);
fs.ensureDirSync(BUILD_DIR);

// Create a utility function to resolve paths
export function resolvePath(relativePath) {
  return path.join(BASE_DIR, relativePath);
}

// Export debug info
export const pathInfo = {
  __dirname,
  BASE_DIR,
  DATA_DIR,
  PUBLIC_DIR,
  PREVIEWS_DIR,
  BUILD_DIR,
  isElectron,
  USER_DATA_PATH,
};
