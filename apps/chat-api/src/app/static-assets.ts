import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, posix } from 'path';
import express, { type RequestHandler, Router } from 'express';
import helmet from 'helmet';
import {
  createHelmetOptions,
  CspMode,
  CSP_NONCE_PLACEHOLDER,
} from '../config/csp';

export const OVERLAY_SANDBOX_ROUTE = '/overlay-sandbox';
const SPA_RENDER_PATH = '/{*frontendRoute}';
/* Vite emits this same-origin PDF worker as an asset. The policy on the
 * worker script controls its execution; the policy on a PDF download does not. */
const PDF_WORKER_PATH = /^\/assets\/pdf\.worker\.min-[\w-]+\.mjs$/;

type PathExists = (path: string) => boolean;

interface FrontendMiddlewareOptions {
  frontendRootPath?: string;
  overlaySandboxRootPath?: string;
  overlaySandboxEnabled?: boolean;
  allowedIframeOrigins?: string[];
  secureTransport?: boolean;
  cspMode?: CspMode;
  reportUri?: string;
  apiPrefix?: string;
}

const getAppRootPathCandidates = (
  baseDir: string,
  appDirectoryName: string,
): string[] => [
  join(baseDir, '..', '..', '..', appDirectoryName, 'dist'),
  join(baseDir, '..', '..', appDirectoryName, 'dist'),
];

export const resolveFrontendRootPath = (
  baseDir = __dirname,
  pathExists: PathExists = existsSync,
): string => {
  const candidates = getAppRootPathCandidates(baseDir, 'chat');

  return candidates.find(pathExists) ?? candidates[0];
};

export const resolveOverlaySandboxRootPath = (
  baseDir = __dirname,
  pathExists: PathExists = existsSync,
): string => {
  const candidates = getAppRootPathCandidates(baseDir, 'chat-overlay-sandbox');

  return candidates.find(pathExists) ?? candidates[0];
};

const isWithinPath = (path: string, prefix: string): boolean => {
  try {
    const normalizedPath = posix
      .normalize(decodeURIComponent(path))
      .toLowerCase();
    const normalizedPrefix = prefix.toLowerCase().replace(/\/+$/, '');
    return (
      normalizedPath === normalizedPrefix ||
      normalizedPath.startsWith(`${normalizedPrefix}/`)
    );
  } catch {
    return false;
  }
};

/** Caches only the immutable template. Nonces are generated when HTML is sent. */
export const createFrontendMiddleware = async ({
  frontendRootPath = resolveFrontendRootPath(),
  overlaySandboxRootPath = resolveOverlaySandboxRootPath(),
  overlaySandboxEnabled = false,
  allowedIframeOrigins = [],
  secureTransport = true,
  cspMode = CspMode.ReportOnly,
  reportUri,
  apiPrefix = 'api',
}: FrontendMiddlewareOptions = {}): Promise<RequestHandler> => {
  const router = Router();
  const reportingUrl = reportUri ? new URL(reportUri).href : undefined;
  const policy = (options: Parameters<typeof createHelmetOptions>[2]) => {
    const { contentSecurityPolicy } = createHelmetOptions(
      allowedIframeOrigins,
      secureTransport,
      options,
    );
    return helmet.contentSecurityPolicy(
      typeof contentSecurityPolicy === 'object' ? contentSecurityPolicy : {},
    );
  };

  const createStaticRouter = async (
    rootPath: string,
    allowWasm: boolean,
  ): Promise<Router> => {
    const staticRouter = Router();
    const indexPath = join(rootPath, 'index.html');
    /* API-only development is supported without a frontend build. An existing
     * build must contain the marker so a stale frontend cannot silently bypass
     * nonce integration when deployed with the new backend. */
    const template = existsSync(indexPath)
      ? await readFile(indexPath, 'utf8')
      : null;
    if (template != null && !template.includes(CSP_NONCE_PLACEHOLDER)) {
      throw new Error(
        `Rebuild the frontend: CSP nonce marker missing in ${indexPath}`,
      );
    }

    const serveHtml: RequestHandler = (req, res, next) => {
      if (template == null) {
        next();
        return;
      }
      const nonce = randomBytes(32).toString('base64');
      const monitoring = cspMode === CspMode.ReportOnly;
      if (monitoring) {
        policy({ allowWasm, allowInlineStyles: true })(
          req,
          res,
          () => undefined,
        );
      }
      policy({
        nonce,
        allowWasm,
        reportOnly: monitoring,
        reportUri: reportingUrl,
      })(req, res, () => undefined);
      if (reportingUrl) {
        res.setHeader('Reporting-Endpoints', `csp="${reportingUrl}"`);
      }
      const html = template.replaceAll(CSP_NONCE_PLACEHOLDER, nonce);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(html));
      /* res.send() can apply Express's ETag/conditional-GET handling. A nonce
       * document must always deliver the full matching body and policy. */
      res.end(req.method === 'HEAD' ? undefined : html);
    };

    staticRouter.use((req, res, next) => {
      let path: string;
      try {
        path = posix.normalize(decodeURIComponent(req.path));
      } catch {
        res.sendStatus(400);
        return;
      }
      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        (path === '/' || path.toLowerCase() === '/index.html')
      ) {
        serveHtml(req, res, next);
      } else {
        next();
      }
    });
    const workerPolicy = policy({ allowWasm: true });
    staticRouter.use((req, res, next) => {
      if (allowWasm && PDF_WORKER_PATH.test(req.path)) {
        workerPolicy(req, res, next);
      } else {
        next();
      }
    });
    staticRouter.use(express.static(rootPath, { index: false }));
    staticRouter.get(SPA_RENDER_PATH, (req, res, next) => {
      if (isWithinPath(req.path, '/assets')) {
        next();
      } else {
        serveHtml(req, res, next);
      }
    });
    return staticRouter;
  };

  router.use((req, _res, next) => {
    if (
      isWithinPath(req.path, '/api') ||
      isWithinPath(req.path, `/${apiPrefix}`)
    ) {
      next('router');
    } else {
      next();
    }
  });
  if (overlaySandboxEnabled) {
    router.use(
      OVERLAY_SANDBOX_ROUTE,
      await createStaticRouter(overlaySandboxRootPath, false),
    );
  }
  router.use((req, _res, next) => {
    if (isWithinPath(req.path, OVERLAY_SANDBOX_ROUTE)) {
      next('router');
    } else {
      next();
    }
  });
  router.use(await createStaticRouter(frontendRootPath, true));
  return router;
};
