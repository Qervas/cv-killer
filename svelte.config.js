import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      // Static adapter options
      pages: "build",
      assets: "build",
      fallback: "index.html",
      precompress: false,
    }),
    paths: {
      base: "",
    },
  },
};

export default config;
