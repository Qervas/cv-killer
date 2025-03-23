import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import https from "https";
import http from "http";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INSTALL_DIR = path.join(__dirname, "..", "tinytex");
const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";
const isLinux = process.platform === "linux";

// Extract platform-specific info
const getPlatformInfo = () => {
  if (isWindows) return { os: "win32", arch: process.arch, ext: ".zip" };
  if (isMac) return { os: "darwin", arch: process.arch, ext: ".tgz" };
  return { os: "linux", arch: process.arch, ext: ".tgz" };
};

// TinyTeX download URLs
const getTinyTexURL = () => {
  const { os, arch } = getPlatformInfo();

  // Use TinyTeX installer directly from the official TinyTeX installer
  if (isWindows) {
    return "https://yihui.org/tinytex/TinyTeX-1.zip";
  } else if (isMac) {
    // For Mac, use the universal binary
    return "https://yihui.org/tinytex/TinyTeX-1.tgz";
  } else {
    // Linux
    return "https://yihui.org/tinytex/TinyTeX-1.tgz";
  }
};

// Get the binary path
export function getBinaryPath() {
  if (isWindows) {
    return path.join(INSTALL_DIR, "bin", "win32", "pdflatex.exe");
  } else if (isMac) {
    return path.join(INSTALL_DIR, "bin", "universal-darwin", "pdflatex");
  } else {
    // Linux
    return path.join(INSTALL_DIR, "bin", "x86_64-linux", "pdflatex");
  }
}

// Download file with progress tracking - moved outside the main function
async function downloadFileWithProgress(
  url,
  destination,
  progressCallback = () => {},
) {
  return new Promise((resolve, reject) => {
    // Choose http or https module based on URL
    const requester = url.startsWith("https") ? https : http;

    const request = requester.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        // Handle redirects
        console.log(`Redirecting to ${response.headers.location}`);
        return downloadFileWithProgress(
          response.headers.location,
          destination,
          progressCallback,
        )
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(
          new Error(
            `Failed to download: Server responded with ${response.statusCode}`,
          ),
        );
      }

      const fileSize = parseInt(response.headers["content-length"] || "0", 10);
      let downloadedBytes = 0;

      const file = fs.createWriteStream(destination);

      response.pipe(file);

      if (fileSize > 0) {
        response.on("data", (chunk) => {
          downloadedBytes += chunk.length;
          const progress = (downloadedBytes / fileSize) * 100;
          progressCallback(progress);
        });
      }

      file.on("finish", () => {
        file.close();
        resolve();
      });

      file.on("error", (err) => {
        fs.unlink(destination).catch(() => {});
        reject(err);
      });

      response.on("error", (err) => {
        fs.unlink(destination).catch(() => {});
        reject(err);
      });
    });

    request.on("error", (err) => {
      reject(err);
    });

    request.end();
  });
}

// Extract ZIP files cross-platform
async function extractZip(zipFile, destDir) {
  if (process.platform === "win32") {
    // Use PowerShell on Windows
    await execAsync(
      `powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${destDir}' -Force"`,
    );
  } else {
    // Use unzip on other platforms if available
    try {
      await execAsync(`unzip -o "${zipFile}" -d "${destDir}"`);
    } catch (err) {
      // If unzip fails, try shell commands
      if (zipFile.endsWith(".zip")) {
        // Try native unzip
        await execAsync(
          `mkdir -p "${destDir}" && unzip -q -o "${zipFile}" -d "${destDir}"`,
        );
      } else {
        // For tgz files
        await execAsync(
          `mkdir -p "${destDir}" && tar -xzf "${zipFile}" -C "${destDir}"`,
        );
      }
    }
  }
}

// Download and install TinyTeX
export async function installTinyTex(progressCallback = () => {}) {
  try {
    progressCallback({
      status: "Preparing for LaTeX installation...",
      progress: 5,
    });

    // Create directory if it doesn't exist
    await fs.ensureDir(INSTALL_DIR);
    progressCallback({
      status: "Installation directory created",
      progress: 10,
    });

    const { os, ext } = getPlatformInfo();
    const downloadURL = getTinyTexURL();
    const downloadFile = path.join(INSTALL_DIR, `tinytex${ext}`);

    // Remove any existing file
    try {
      await fs.remove(downloadFile);
    } catch (err) {
      // Ignore errors if the file doesn't exist
    }

    progressCallback({
      status: `Downloading TinyTeX for ${os}...`,
      progress: 15,
    });

    // Download file using our downloadFileWithProgress function
    try {
      await downloadFileWithProgress(
        downloadURL,
        downloadFile,
        (dlProgress) => {
          progressCallback({
            status: `Downloading TinyTeX: ${Math.round(dlProgress)}%`,
            progress: 15 + Math.round(dlProgress * 0.25),
          });
        },
      );
    } catch (downloadErr) {
      console.error("Download error:", downloadErr);

      // Try a different approach - use curl command
      try {
        progressCallback({
          status: "Trying alternative download method...",
          progress: 20,
        });

        await execAsync(`curl -L "${downloadURL}" -o "${downloadFile}"`);

        progressCallback({
          status: "Download completed with curl",
          progress: 40,
        });
      } catch (curlErr) {
        console.error("Curl download error:", curlErr);
        progressCallback({
          status: `Download failed: ${curlErr.message}`,
          progress: -1,
        });
        return false;
      }
    }

    // Verify the downloaded file exists and has content
    try {
      const stats = await fs.stat(downloadFile);
      if (stats.size < 1000) {
        // Much smaller check just to ensure file exists
        throw new Error(
          `Downloaded file is too small (${stats.size} bytes). Download may be incomplete.`,
        );
      }
      console.log(`Downloaded file size: ${stats.size} bytes`);
      progressCallback({
        status: "Download complete, preparing to extract...",
        progress: 45,
      });
    } catch (statErr) {
      progressCallback({
        status: `Download verification failed: ${statErr.message}`,
        progress: -1,
      });
      return false;
    }

    progressCallback({
      status: "Extracting TinyTeX archive...",
      progress: 50,
    });

    // Simple direct approach for extraction based on platform
    try {
      if (isWindows) {
        // Windows
        await execAsync(
          `powershell -Command "Expand-Archive -Path '${downloadFile}' -DestinationPath '${INSTALL_DIR}' -Force"`,
        );
      } else {
        // macOS/Linux
        if (ext === ".tgz") {
          await execAsync(`tar -xzf "${downloadFile}" -C "${INSTALL_DIR}"`);
        } else {
          await execAsync(`unzip -o "${downloadFile}" -d "${INSTALL_DIR}"`);
        }
      }

      progressCallback({
        status: "Archive extracted successfully",
        progress: 70,
      });
    } catch (extractErr) {
      console.error("Extraction error:", extractErr);
      progressCallback({
        status: `Extraction failed: ${extractErr.message}`,
        progress: -1,
      });
      return false;
    }

    // Try to find the pdflatex binary
    const possibleBinDirs = [
      path.join(INSTALL_DIR, "bin"),
      path.join(INSTALL_DIR, "bin", "win32"),
      path.join(INSTALL_DIR, "bin", "universal-darwin"),
      path.join(INSTALL_DIR, "bin", "x86_64-linux"),
    ];

    let binDir = null;
    for (const dir of possibleBinDirs) {
      try {
        await fs.access(dir);
        binDir = dir;
        break;
      } catch (err) {}
    }

    if (!binDir) {
      console.log(
        "Couldn't find TinyTeX binary directory, checking for system LaTeX...",
      );
      try {
        // Try to find system-installed LaTeX
        const systemLatexCheck = await execAsync(
          "which pdflatex || where pdflatex",
        );
        if (systemLatexCheck.stdout.trim()) {
          console.log("System LaTeX found at:", systemLatexCheck.stdout.trim());
          progressCallback({
            status: "Found system-installed LaTeX. Using that instead.",
            progress: 100,
          });
          return true;
        }
      } catch (systemCheckErr) {
        console.log("No system LaTeX found:", systemCheckErr.message);
      }

      progressCallback({
        status: "Could not find LaTeX binary directory",
        progress: -1,
      });
      return false;
    }

    progressCallback({
      status: "LaTeX installed, setting up...",
      progress: 90,
    });

    // Just check if the basic binary exists
    const binaryName = isWindows ? "pdflatex.exe" : "pdflatex";
    const binaryPath = path.join(binDir, binaryName);

    try {
      await fs.access(binaryPath);
      progressCallback({
        status: "LaTeX installation complete!",
        progress: 100,
      });
      return true;
    } catch (err) {
      progressCallback({
        status: `Could not find pdflatex binary: ${err.message}`,
        progress: -1,
      });
      return false;
    }
  } catch (err) {
    console.error("Error installing TinyTeX:", err);
    progressCallback({
      status: `Installation failed: ${err.message}`,
      progress: -1,
    });
    return false;
  }
}

// Run LaTeX command using the bundled TinyTeX
export function runLatexCommand(command, args = [], options = {}) {
  const binaryPath = getBinaryPath();
  return new Promise((resolve, reject) => {
    const process = spawn(binaryPath, args, options);

    let stdout = "";
    let stderr = "";

    if (process.stdout) {
      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });
    }

    if (process.stderr) {
      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });
    }

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`LaTeX process exited with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    process.on("error", (err) => {
      reject(err);
    });
  });
}

export async function findSystemLatex() {
  try {
    if (isWindows) {
      // Windows - check common install locations
      const possiblePaths = [
        "C:\\texlive\\bin\\win32\\pdflatex.exe",
        "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
        "C:\\Program Files (x86)\\MiKTeX\\miktex\\bin\\pdflatex.exe",
      ];

      for (const p of possiblePaths) {
        try {
          await fs.access(p);
          return p;
        } catch (e) {
          // Path not found, try next
        }
      }

      // Try using where command
      try {
        const { stdout } = await execAsync("where pdflatex");
        if (stdout.trim()) return stdout.trim().split("\r\n")[0];
      } catch (e) {
        // Command failed, continue with other methods
      }
    } else {
      // macOS/Linux - use which command
      try {
        const { stdout } = await execAsync("which pdflatex");
        if (stdout.trim()) return stdout.trim();
      } catch (e) {
        // Command failed, continue with other methods
      }

      // Check common locations on macOS
      if (isMac) {
        const macPaths = [
          "/Library/TeX/texbin/pdflatex",
          "/usr/texbin/pdflatex",
          "/opt/homebrew/bin/pdflatex", // Homebrew path on Apple Silicon
          "/usr/local/bin/pdflatex", // Homebrew path on Intel Macs
        ];

        for (const p of macPaths) {
          try {
            await fs.access(p);
            return p;
          } catch (e) {
            // Path not found, try next
          }
        }
      } else if (isLinux) {
        // Additional Linux paths
        const linuxPaths = [
          "/usr/bin/pdflatex",
          "/usr/local/bin/pdflatex",
          "/usr/share/texlive/bin/x86_64-linux/pdflatex",
        ];

        for (const p of linuxPaths) {
          try {
            await fs.access(p);
            return p;
          } catch (e) {
            // Path not found, try next
          }
        }
      }
    }
  } catch (e) {
    console.log("Error finding system LaTeX:", e);
  }

  return null;
}

export async function isLatexInstalled() {
  // First check bundled LaTeX
  const binaryPath = getBinaryPath();
  try {
    await fs.access(binaryPath);
    return true;
  } catch (err) {
    // Not found in bundle, check system LaTeX
    const systemPath = await findSystemLatex();
    return !!systemPath;
  }
}

// Export all functions and constants
export default {
  INSTALL_DIR,
  getBinaryPath,
  isLatexInstalled,
  installTinyTex,
  runLatexCommand,
  findSystemLatex,
};
