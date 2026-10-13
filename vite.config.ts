import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import UnoCSS from "unocss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;
const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);
const isPagesDemo = process.env.VITE_PAGES_DEMO === "true";

export default defineConfig(async () => ({
  plugins: [basicSsl(), UnoCSS(), solidPlugin()],
  base: isPagesDemo ? "/workspaceweb/web/" : "/",

  cacheDir: ".vite-cache",

  clearScreen: false,

  server: {
    port: 1430,
    strictPort: false,
    host: host || false,
    https: true,
    proxy: {
      "/api": {
        target: process.env.MINDZJ_API_TARGET || "http://127.0.0.1:3000",
        ws: true,
      },
    },
    hmr: host
      ? { protocol: "ws", host, port: 1431 }
      : undefined,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/target/**",
        "**/target-codex-check*/**",
        "**/vault1/**",
        "**/.mindzj/**",
        "**/dist/**",
        "**/dist-electron/**",
        "**/.git/**",
      ],
    },
  },

  optimizeDeps: {
    entries: ["src/index.tsx", "src/App.tsx"],
    include: [
      "solid-js",
      "solid-js/web",
      "katex",
      "lucide-solid",
      "sortablejs",
      "@tauri-apps/api/core",
      "@tauri-apps/api/window",
      "@tauri-apps/api/event",
    ],
  },

  build: {
    outDir: isPagesDemo ? "dist-pages" : "dist",
    emptyOutDir: !isPagesDemo,
    sourcemap: !isPagesDemo,
    target: "esnext",
    minify: isTauriBuild ? false : "esbuild",
    rollupOptions: isPagesDemo
      ? undefined
      : { input: { main: resolve(process.cwd(), "index.html") } },
  },

  resolve: {
    alias: {
      "@": "/src",
    },
  },

  test: {
    environment: "node",
  },
}));
