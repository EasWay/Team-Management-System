import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setupFileUpload } from "./fileUpload";
import { initializeSocketServer } from "../socket-server";
import { registerWebhookEndpoint } from "../github-webhooks";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Initialize Socket.io server
  initializeSocketServer(server);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Add CSP headers to allow GitHub OAuth and development tools
  app.use((req, res, next) => {
    // In development, be more permissive with CSP to allow dev tools and HMR
    const cspHeader = process.env.NODE_ENV === "development"
      ? "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://github.com https://api.github.com https://accounts.google.com https://www.googleapis.com ws: wss: http://localhost:* http://127.0.0.1:*; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self' https://github.com https://accounts.google.com; " +
      "frame-src 'self' https://github.com https://accounts.google.com; " +
      "worker-src 'self' blob:"
      : "default-src 'self'; " +
      "script-src 'self' 'sha256-Eoj6XODkFF87BVabaKx38kr7sC0DCgv0l0N3CdsTja8='; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://github.com https://api.github.com https://accounts.google.com https://www.googleapis.com; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self' https://github.com https://accounts.google.com";

    res.setHeader("Content-Security-Policy", cspHeader);
    next();
  });

  // GitHub webhook endpoint (must be before other routes)
  registerWebhookEndpoint(app);

  // Healthcheck route
  app.get('/healthcheck', (req, res) => {
    res.status(200).send('Service is awake');
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // File upload endpoint
  setupFileUpload(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
