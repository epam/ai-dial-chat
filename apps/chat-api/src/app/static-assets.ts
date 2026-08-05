import { existsSync } from 'fs';
import { join } from 'path';
import type { ServeStaticModuleOptions } from '@nestjs/serve-static';

const API_ROUTE_EXCLUDE_PATTERN = '/api{/*splat}';
export const OVERLAY_SANDBOX_ROUTE = '/overlay-sandbox';
const OVERLAY_SANDBOX_ROUTE_EXCLUDE_PATTERN = `${OVERLAY_SANDBOX_ROUTE}{/*splat}`;
const ASSETS_ROUTE_EXCLUDE_PATTERN = '/assets{/*splat}';
const OVERLAY_SANDBOX_ASSETS_ROUTE_EXCLUDE_PATTERN = `${OVERLAY_SANDBOX_ROUTE}/assets{/*splat}`;
const SPA_RENDER_PATH = '/{*frontendRoute}';

type PathExists = (path: string) => boolean;

interface CreateServeStaticOptionsParams {
  frontendRootPath?: string;
  overlaySandboxRootPath?: string;
  overlaySandboxEnabled?: boolean;
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

const createFrontendStaticOptions = (
  rootPath: string,
): ServeStaticModuleOptions => ({
  rootPath,
  renderPath: SPA_RENDER_PATH,
  exclude: [
    API_ROUTE_EXCLUDE_PATTERN,
    OVERLAY_SANDBOX_ROUTE_EXCLUDE_PATTERN,
    ASSETS_ROUTE_EXCLUDE_PATTERN,
  ],
});

const createOverlaySandboxStaticOptions = (
  rootPath: string,
): ServeStaticModuleOptions => ({
  rootPath,
  serveRoot: OVERLAY_SANDBOX_ROUTE,
  renderPath: SPA_RENDER_PATH,
  exclude: [
    API_ROUTE_EXCLUDE_PATTERN,
    OVERLAY_SANDBOX_ASSETS_ROUTE_EXCLUDE_PATTERN,
  ],
});

export const createServeStaticOptions = ({
  frontendRootPath = resolveFrontendRootPath(),
  overlaySandboxRootPath = resolveOverlaySandboxRootPath(),
  overlaySandboxEnabled = false,
}: CreateServeStaticOptionsParams = {}): ServeStaticModuleOptions[] => [
  ...(overlaySandboxEnabled
    ? [createOverlaySandboxStaticOptions(overlaySandboxRootPath)]
    : []),
  createFrontendStaticOptions(frontendRootPath),
];
