import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local development and `vite preview` only. Production builds do not use this proxy;
// configure VITE_AI_GATEWAY_URL to an explicitly managed production gateway at deploy time.
const aiGatewayProxy = {
  target: "http://127.0.0.1:8787",
  changeOrigin: false,
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api/ai": aiGatewayProxy } },
  preview: { proxy: { "/api/ai": aiGatewayProxy } },
});
