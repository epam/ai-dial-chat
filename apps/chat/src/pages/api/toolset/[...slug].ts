import { createDialApiSlugsHandler } from '@/src/utils/server/api-slug-handler';

export default createDialApiSlugsHandler({
  pathParameter: 'toolset',
  dynamicSlugs: true,
});
