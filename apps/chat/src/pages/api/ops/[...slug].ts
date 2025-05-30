import { createDialApiSlugsHandler } from '@/src/utils/server/api-slug-handler';

export default createDialApiSlugsHandler({
  generalErrorMessage: 'Operation failed',
  pathParameter: 'ops',
});
