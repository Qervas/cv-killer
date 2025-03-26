import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      // Static adapter options
      pages: "build",
      assets: "build",
      fallback: "index.html", // This is important for SPA routing
      precompress: false,
    }),
    paths: {
      base: "",
    },
    prerender: {
      handleHttpError: ({ path, referrer, message }) => {
        // Ignore prerendering errors for dynamic routes
        if (path.includes("[id]") || path.includes("/:")) {
          return;
        }
        throw new Error(message);
      },
    },
  },
};

export default config;
