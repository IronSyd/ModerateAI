import express, { type Express, type Request } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";
import { pathToFileURL } from "url";
import { renderSeoDocument, SEO_SITE_BASE_FALLBACK } from "./lib/seo";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const viteConfigUrl = pathToFileURL(
    path.resolve(import.meta.dirname, "..", "vite.config.ts"),
  ).href;

  const [{ createServer: createViteServer, createLogger }, { default: viteConfig }] = await Promise.all([
    import("vite"),
    import(viteConfigUrl),
  ]);
  const viteLogger = createLogger();

  const serverOptions: import("vite").ServerOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const siteBaseUrl = resolveSiteBaseUrl(req);
      const seoTemplate = renderSeoDocument(template, url, { siteBaseUrl });
      const page = await vite.transformIndexHtml(url, seoTemplate);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  const indexPath = path.resolve(distPath, "index.html");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        const relativePath = path.relative(distPath, filePath).replace(/\\/g, "/");

        if (relativePath.startsWith("assets/")) {
          // Fingerprinted build artifacts can be cached aggressively.
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }

        if (relativePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }

        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res, next) => {
    try {
      const template = await fs.promises.readFile(indexPath, "utf-8");
      const siteBaseUrl = resolveSiteBaseUrl(req);
      const page = renderSeoDocument(template, req.originalUrl, { siteBaseUrl });
      res.setHeader("Cache-Control", "no-cache");
      res.status(200).set({ "Content-Type": "text/html" }).send(page);
    } catch (error) {
      next(error);
    }
  });
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return null;
  }
}

function resolveSiteBaseUrl(req: Request): string {
  const configured =
    normalizeBaseUrl(process.env.VITE_SITE_URL) ??
    normalizeBaseUrl(process.env.FRONTEND_URL);
  if (configured) return configured;

  const host = String(req.get("host") ?? "").trim();
  if (!host) return SEO_SITE_BASE_FALLBACK;

  const forwardedProto = String(req.get("x-forwarded-proto") ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol = forwardedProto === "https" ? "https" : req.secure ? "https" : "http";

  return `${protocol}://${host}`;
}
