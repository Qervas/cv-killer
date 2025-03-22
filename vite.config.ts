import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    fs: {
      // Allow serving files from these directories
      allow: [
        // Default directories
        ".",
        // Custom directories
        path.resolve(__dirname, "build"),
      ],
    },
  },
});
