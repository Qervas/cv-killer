import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: "build",
      assets: "build",
      fallback: "index.html",
      precompress: false,
      strict: false
    }),
    paths: {
      base: "",
      assets: ""
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
    appDir: "_app"
  }
};

export default config;
