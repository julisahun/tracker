/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works under a GitHub Pages project subpath
  // (https://<user>.github.io/<repo>/). Safe here because the app has no
  // client-side routing. For a user/org site or custom domain, "/" is fine too.
  base: "./",
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
