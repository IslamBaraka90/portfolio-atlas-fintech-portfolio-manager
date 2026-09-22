import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../..", import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const proxy = { "/api": { target: `http://127.0.0.1:${env.API_PORT ?? 3100}` } };
  return {
    envDir: root,
    plugins: [
      react(),
      {
        name: "keep-financial-servers-out-of-the-browser",
        generateBundle() {
          for (const id of this.getModuleIds()) {
            const path = id.replaceAll("\\", "/");
            if (
              /node_modules\/(yahoo-finance2|fintech-algorithms|fastify)\//.test(path) ||
              /packages\/(core|adapters)\//.test(path)
            ) {
              this.error(`Server-only module entered the browser: ${path}`);
            }
          }
        },
      },
    ],
    server: { host: "127.0.0.1", port: Number(env.WEB_PORT ?? 5173), strictPort: true, proxy },
    preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy },
  };
});
