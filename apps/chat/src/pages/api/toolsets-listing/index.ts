import { createApiHandler } from '@/src/utils/server/api-handler';

import { HTTPMethod } from '@/src/types/http';

export default createApiHandler({
  endpoint: '/openai/toolsets',
  method: HTTPMethod.GET,
});
