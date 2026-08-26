import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const aiGatewayProxy = {
  target: "http://127.0.0.1:8787",
  changeOrigin: false,
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api/ai": aiGatewayProxy } },
  preview: { proxy: { "/api/ai": aiGatewayProxy } },
});
