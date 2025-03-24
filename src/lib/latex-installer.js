// This is a frontend stub for the LaTeX installer
// The actual implementation is in the server

const API_URL = "http://localhost:3001/api";

/**
 * Check if LaTeX is installed
 */
export async function checkLatexInstallation() {
  try {
    const response = await fetch(`${API_URL}/latex/status`);
    if (!response.ok) {
      throw new Error("Failed to check LaTeX status");
    }
    return await response.json();
  } catch (error) {
    console.error("Error checking LaTeX status:", error);
    return { installed: false, error: error.message };
  }
}

/**
 * Start LaTeX installation
 */
export async function startLatexInstallation() {
  try {
    const response = await fetch(`${API_URL}/latex/install-start`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to start LaTeX installation");
    }
    return await response.json();
  } catch (error) {
    console.error("Error starting LaTeX installation:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the current status of LaTeX installation
 */
export async function getLatexInstallationStatus() {
  try {
    const response = await fetch(`${API_URL}/latex/install-status`);
    if (!response.ok) {
      throw new Error("Failed to get LaTeX installation status");
    }
    return await response.json();
  } catch (error) {
    console.error("Error getting LaTeX installation status:", error);
    return {
      isInstalling: false,
      status: `Error: ${error.message}`,
      progress: -1,
      error: error.message,
    };
  }
}

export default {
  checkLatexInstallation,
  startLatexInstallation,
  getLatexInstallationStatus,
};
