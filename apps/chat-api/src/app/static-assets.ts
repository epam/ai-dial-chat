import { existsSync } from 'fs';
import { join } from 'path';
import type { ServeStaticModuleOptions } from '@nestjs/serve-static';

const API_ROUTE_EXCLUDE_PATTERN = '/api{/*splat}';
const SPA_RENDER_PATH = '/{*frontendRoute}';

type PathExists = (path: string) => boolean;

const getFrontendRootPathCandidates = (baseDir: string): string[] => [
  join(baseDir, '..', '..', '..', 'chat', 'dist'),
  join(baseDir, '..', '..', 'chat', 'dist'),
];

export const resolveFrontendRootPath = (
  baseDir = __dirname,
  pathExists: PathExists = existsSync,
): string => {
  const candidates = getFrontendRootPathCandidates(baseDir);

  return candidates.find(pathExists) ?? candidates[0];
};

export const createServeStaticOptions = (
  rootPath = resolveFrontendRootPath(),
): ServeStaticModuleOptions => ({
  rootPath,
  renderPath: SPA_RENDER_PATH,
  exclude: [API_ROUTE_EXCLUDE_PATTERN],
});
