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

// Get the installation directory from user data path or fall back to default
const USER_DATA_PATH = process.env.USER_DATA_PATH || path.join(__dirname, "..");
const INSTALL_DIR = path.join(USER_DATA_PATH, "tinytex");

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";
const isLinux = process.platform === "linux";

// Log the installation path
console.log("TinyTeX installation directory:", INSTALL_DIR);

// Extract platform-specific info
const getPlatformInfo = () => {
  if (isWindows) return { os: "win32", arch: process.arch, ext: ".zip" };
  if (isMac) return { os: "darwin", arch: process.arch, ext: ".tgz" };
  return { os: "linux", arch: process.arch, ext: ".tar.gz" };
};

// Add this after the imports
async function getLatestTinyTeXVersion() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/rstudio/tinytex-releases/releases/latest',
      headers: {
        'User-Agent': 'CV-Killer-App'
      }
    };

    https.get(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const release = JSON.parse(data);
          console.log('Latest release info:', release.tag_name);
          resolve(release.tag_name); // Will be like v2025.03.10
        } catch (err) {
          console.error('Error parsing GitHub API response:', err);
          resolve('v2025.03.10'); // Fallback to latest known version
        }
      });
    }).on('error', (err) => {
      console.error('Error fetching latest version:', err);
      resolve('v2025.03.10'); // Fallback to latest known version
    });
  });
}

// TinyTeX download URLs
const getTinyTexURL = async () => {
  const { os, arch } = getPlatformInfo();
  const version = await getLatestTinyTeXVersion();
  console.log('Using TinyTeX version:', version);

  // Base URL for TinyTeX releases
  const baseUrl = "https://github.com/rstudio/tinytex-releases/releases/download";

  // We want TinyTeX-1 which contains enough LaTeX packages for document generation
  if (isWindows) {
    return `${baseUrl}/${version}/TinyTeX-1-${version}.zip`;
  } else if (isMac) {
    return `${baseUrl}/${version}/TinyTeX-1-${version}.tgz`;
  } else {
    // Linux - use the appropriate architecture
    return `${baseUrl}/${version}/TinyTeX-1-${version}.tar.gz`;
  }
};

// Get the binary path
export function getBinaryPath(binary = 'pdflatex') {
  const tinyTexPath = path.join(INSTALL_DIR, "TinyTeX");
  console.log(`Looking for ${binary} in:`, tinyTexPath);

  if (isWindows) {
    return path.join(tinyTexPath, "bin", "windows", `${binary}.exe`);
  } else if (isMac) {
    // Check both Intel and Apple Silicon paths
    const paths = [
      path.join(tinyTexPath, "bin", "universal-darwin", binary),
      path.join(tinyTexPath, "bin", "x86_64-darwin", binary),
      path.join(tinyTexPath, "bin", "arm64-darwin", binary)
    ];
    
    for (const binPath of paths) {
      if (fs.existsSync(binPath)) {
        console.log(`Found ${binary} at:`, binPath);
        return binPath;
      }
    }
    // Default to universal-darwin path
    return paths[0];
  } else {
    // Linux - check both x86_64 and aarch64 paths
    const paths = [
      path.join(tinyTexPath, "bin", "x86_64-linux", binary),
      path.join(tinyTexPath, "bin", "aarch64-linux", binary)
    ];

    for (const binPath of paths) {
      if (fs.existsSync(binPath)) {
        console.log(`Found ${binary} at:`, binPath);
        return binPath;
      }
    }
    // Default to x86_64 path
    return paths[0];
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
  try {
    if (process.platform === "win32") {
      // Use PowerShell on Windows
      await execAsync(
        `powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${destDir}' -Force"`,
      );
    } else {
      // For Linux/Mac, use tar for .tgz or .tar.gz and unzip for .zip
      if (zipFile.endsWith('.tgz') || zipFile.endsWith('.tar.gz')) {
        console.log(`Extracting ${zipFile} to ${destDir}`);
        await execAsync(`tar -xzf "${zipFile}" -C "${destDir}"`);
      } else {
        console.log(`Unzipping ${zipFile} to ${destDir}`);
        await execAsync(`unzip -o "${zipFile}" -d "${destDir}"`);
      }
    }

    // Verify extraction
    const files = await fs.readdir(destDir);
    console.log('Extracted files:', files);

    if (files.length === 0) {
      throw new Error('Extraction completed but no files were extracted');
    }
  } catch (err) {
    console.error('Extraction error:', err);
    throw new Error(`Extraction failed: ${err.message}`);
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
    const downloadURL = await getTinyTexURL();
    console.log('Using download URL:', downloadURL);
    const downloadFile = path.join(INSTALL_DIR, `tinytex${ext}`);

    // Clean up any existing installation
    try {
      await fs.remove(path.join(INSTALL_DIR, 'TinyTeX'));
      await fs.remove(downloadFile);
    } catch (err) {
      console.log('Cleanup of existing files failed:', err);
      // Continue anyway
    }

    progressCallback({
      status: `Downloading TinyTeX for ${os}...`,
      progress: 15,
    });

    // Download file
    try {
      await downloadFileWithProgress(downloadURL, downloadFile, (dlProgress) => {
        progressCallback({
          status: `Downloading TinyTeX: ${Math.round(dlProgress)}%`,
          progress: 15 + Math.round(dlProgress * 0.25),
        });
      });
    } catch (err) {
      console.error('Download failed:', err);
      throw err;
    }

    progressCallback({
      status: "Extracting TinyTeX archive...",
      progress: 50,
    });

    // Extract the archive
    try {
      await extractZip(downloadFile, INSTALL_DIR);
      progressCallback({
        status: "Archive extracted successfully",
        progress: 70,
      });
    } catch (err) {
      console.error('Extraction failed:', err);
      throw err;
    }

    // Verify the installation
    const binaryPath = getBinaryPath();
    console.log('Looking for LaTeX binary at:', binaryPath);

    try {
      await fs.access(binaryPath);
      console.log('LaTeX binary found at:', binaryPath);

      // Make the binary executable on Unix systems
      if (!isWindows) {
        await execAsync(`chmod +x "${binaryPath}"`);
      }

      progressCallback({
        status: "LaTeX installation complete!",
        progress: 100,
      });

      return true;
    } catch (err) {
      console.error('Binary verification failed:', err);
      throw new Error(`Could not find or access LaTeX binary at ${binaryPath}`);
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
