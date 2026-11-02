import { createRequire as tempoStylesRequire } from "node:module";
const tempoHostStyles = tempoStylesRequire(import.meta.url)("./.tempo-styles/host-styles.cjs");
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tempoVitePlugin } from "tempo-sdk";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const tempoRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(tempoRoot, "..");

export default defineConfig({
  root: tempoRoot,
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "tempo-sdk"],
  },
  plugins: [
    tempoHostStyles.vite(),
    tailwindcss(),
    tempoVitePlugin({ sourceIdentityRoot: projectRoot }),
    react(),
    tsconfigPaths({
      projectDiscovery: "lazy",
    }),
  ],
  server: {
    fs: {
      allow: [".."],
      deny: ["**/.demo/**", "**/local-design/**", "**/docs/**", "**/apps/api/**", "**/.git/**", "**/.env*", "**/*.sqlite*", "**/*.pem"],
    },
  },
  optimizeDeps: {
    // The generated host imports only canvases requested by the user. Keep
    // unused canvases and their dependencies off the cold-start path.
    entries: ["index.html"],
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
});
