import { createDialApiSlugsHandler } from '@/src/utils/server/api-slug-handler';

export default createDialApiSlugsHandler({
  generalErrorMessage: 'Toolset request failed',
  pathParameter: 'toolsets',
  dynamicSlugs: true,
});
