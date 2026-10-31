import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Tests der React-App (jsdom)
export default defineConfig({
  plugins: [react()],
  test: {
    name: "app",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
  },
});
