import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

/** Dev-only: POST a canvas dataURL to /__shot and it lands on disk for inspection. */
function screenshotEndpoint(): Plugin {
  return {
    name: "screenshot-endpoint",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__shot", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }
        let body = "";
        req.on("data", (c: Buffer) => (body += c.toString()));
        req.on("end", () => {
          const b64 = body.replace(/^data:image\/\w+;base64,/, "");
          const dir = path.resolve(__dirname, ".shots");
          fs.mkdirSync(dir, { recursive: true });
          const file = path.join(dir, `shot-${Date.now()}.png`);
          fs.writeFileSync(file, Buffer.from(b64, "base64"));
          res.end(file);
        });
      });
    },
  };
}

export default defineConfig({
  // PORT is set by tooling that assigns a free port; 5173 is the manual default.
  server: { port: process.env.PORT ? Number(process.env.PORT) : 5173 },
  build: { target: "es2022" },
  plugins: [screenshotEndpoint()],
});
