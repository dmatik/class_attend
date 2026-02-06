import path from "path"
import fs from "fs"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: "ניהול חוגים",
        short_name: "חוגים",
        description: "מעקב נוכחות בחוגים",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        lang: "he",
        dir: "rtl",
        icons: [
          {
            src: "/favicon.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/favicon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/tests/setup.ts',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("/recharts/")) {
              return "recharts";
            }
            if (
              id.includes("/@radix-ui/") ||
              id.includes("/framer-motion/") ||
              id.includes("/lucide-react/")
            ) {
              return "ui-vendor";
            }
            return "vendor";
          }
        },
      },
    },
  },
  define: {
    '__APP_VERSION__': JSON.stringify(JSON.parse(fs.readFileSync('package.json', 'utf-8')).version),
  }
})
