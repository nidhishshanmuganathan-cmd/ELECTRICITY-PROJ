import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiTarget = (
    env.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");

  return {
    plugins: [react()],
    build: {
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (/node_modules\/(?:@firebase\/auth|firebase\/auth)\//.test(id))
              return "firebase-auth";
            if (/node_modules\/(?:react|react-dom|scheduler)\//.test(id))
              return "react-vendor";
          },
        },
      },
    },
    server:
      command === "serve"
        ? {
            proxy: {
              "^/api(?:/|$)": {
                target: apiTarget,
                changeOrigin: true,
                // Keep upstream HTTPS certificate verification enabled.
                secure: true,
                rewrite: (path) => path.replace(/^\/api(?=\/|$)/, ""),
              },
            },
          }
        : undefined,
  };
});
