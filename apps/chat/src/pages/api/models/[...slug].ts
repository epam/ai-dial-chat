import { createDialApiSlugsHandler } from '@/src/utils/server/api-slug-handler';

export default createDialApiSlugsHandler({
  generalErrorMessage: 'Application request failed',
  apiVersion: 'openai',
  dynamicSlugs: true,
});
