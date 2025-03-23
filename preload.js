const { contextBridge } = require("electron");

// Expose limited APIs to renderer
contextBridge.exposeInMainWorld("electronAPI", {
  // Basic functions for the loading page
  retryServer: () => {
    console.log("Retry requested - reloading window");
    window.location.reload();
  },
  useStaticMode: (staticPath) => {
    console.log("Static mode requested");
    if (staticPath) {
      window.location.href = staticPath;
    }
  },
});

console.log("Preload script loaded");
